import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getContacts } from '@/services/contacts'
import { getLeads } from '@/services/leads'
import { getRecentConversations } from '@/services/conversations'
import { useRealtime } from '@/hooks/use-realtime'
import type { Contact, Lead, Conversation } from '@/types/crm'
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Building,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NewContactModal } from '@/components/modals/NewContactModal'

export default function Contacts() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)

  // Metadados auxiliares: contagem de leads vinculados e data da última conversa
  const [leadsCountMap, setLeadsCountMap] = useState<Record<string, number>>({})
  const [lastConvMap, setLastConvMap] = useState<Record<string, string>>({})

  const [newContactModalOpen, setNewContactModalOpen] = useState(false)

  const fetchContacts = async () => {
    try {
      const res = await getContacts(page, 10, searchTerm)
      setContacts(res.items)
      setTotalItems(res.totalItems)
      setTotalPages(res.totalPages)

      // Buscar leads e conversas para montar os metadados
      const [allLeads, allConvs] = await Promise.all([getLeads(), getRecentConversations(50)])

      const counts: Record<string, number> = {}
      for (const l of allLeads) {
        if (l.contact_id) {
          counts[l.contact_id] = (counts[l.contact_id] || 0) + 1
        }
      }
      setLeadsCountMap(counts)

      const lastConvs: Record<string, string> = {}
      for (const c of allConvs) {
        if (c.contact_id && !lastConvs[c.contact_id]) {
          lastConvs[c.contact_id] = c.created
        }
      }
      setLastConvMap(lastConvs)
    } catch (err) {
      console.error('Erro ao buscar contatos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [page, searchTerm])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) {
      setSearchTerm(q)
    }
  }, [searchParams])

  useRealtime('contacts', () => fetchContacts())

  const formatTelefone = (tel: string) => {
    const clean = tel.replace(/\D/g, '')
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
    }
    return tel
  }

  return (
    <div className="space-y-5">
      {/* Barra Superior: Busca e Botão Novo Contato */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-md border border-[#E5DFD6] shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8178]" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
              setSearchParams({ q: e.target.value })
            }}
            placeholder="Buscar por nome, empresa, e-mail ou telefone..."
            className="pl-9 h-9 text-xs sm:text-sm border-[#E5DFD6] bg-[#FAF8F5]"
          />
        </div>

        <Button
          onClick={() => setNewContactModalOpen(true)}
          className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs sm:text-sm font-medium h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Contato
        </Button>
      </div>

      {/* Tabela de Contatos (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-md border border-[#E5DFD6] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B3541E] border-t-transparent" />
              <p className="text-xs text-[#8A8178]">Carregando contatos...</p>
            </div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8A8178]">
            <Users className="w-10 h-10 mx-auto opacity-30 mb-2 text-[#B3541E]" />
            Nenhum contato encontrado.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF8F5] border-b border-[#E5DFD6] text-[#8A8178] uppercase font-semibold tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Leads Vinculados</th>
                    <th className="py-3 px-4">Última Conversa</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD6]">
                  {contacts.map((contact) => {
                    const initials = contact.nome
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                    const leadsCount = leadsCountMap[contact.id] || 0
                    const lastConv = lastConvMap[contact.id]
                      ? new Date(lastConvMap[contact.id]).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : 'Sem registro'

                    return (
                      <tr
                        key={contact.id}
                        onClick={() => navigate(`/contatos/${contact.id}`)}
                        className="hover:bg-[#FAF8F5] cursor-pointer transition-colors duration-150"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#1E1B16]">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-7 h-7 border border-[#E5DFD6] bg-[#E9E4DC] text-[#B3541E] text-xs font-semibold">
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <span>{contact.nome}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#8A8178]">{contact.empresa || '—'}</td>
                        <td className="py-3.5 px-4 text-[#1E1B16] font-medium font-mono text-xs">
                          {formatTelefone(contact.telefone)}
                        </td>
                        <td className="py-3.5 px-4 text-[#8A8178] truncate max-w-[180px]">
                          {contact.email || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FAF8F5] text-[#1E1B16] border border-[#E5DFD6]">
                            {leadsCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#8A8178]">{lastConv}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[#B3541E] hover:underline">
                            Ver <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack de Cards */}
            <div className="md:hidden divide-y divide-[#E5DFD6]">
              {contacts.map((contact) => {
                const initials = contact.nome
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <div
                    key={contact.id}
                    onClick={() => navigate(`/contatos/${contact.id}`)}
                    className="p-3.5 hover:bg-[#FAF8F5] cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7 border border-[#E5DFD6] bg-[#E9E4DC] text-[#B3541E] text-xs font-semibold">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold text-sm text-[#1E1B16]">{contact.nome}</p>
                      </div>
                      <span className="text-xs text-[#B3541E] font-medium">Ver detalhes</span>
                    </div>

                    {contact.empresa && (
                      <p className="text-xs text-[#8A8178] flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" />
                        {contact.empresa}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-[#8A8178] pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-[#2F7D4F]" />
                        {formatTelefone(contact.telefone)}
                      </span>
                      {contact.email && (
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Rodapé de Paginação */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[#E5DFD6] bg-[#FAF8F5] flex items-center justify-between text-xs text-[#8A8178]">
            <span>
              Mostrando {contacts.length} de {totalItems} contatos
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-7 w-7 p-0 border-[#E5DFD6]"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 font-medium text-[#1E1B16]">
                {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-7 w-7 p-0 border-[#E5DFD6]"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <NewContactModal
        open={newContactModalOpen}
        onOpenChange={setNewContactModalOpen}
        onSuccess={fetchContacts}
      />
    </div>
  )
}
