import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Filter,
  Users,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Search,
  Menu,
  BookOpen,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NewLeadModal } from '@/components/modals/NewLeadModal'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')

  // Título dinâmico da página atual
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/') return 'Visão Geral'
    if (path.startsWith('/leads')) {
      return path.split('/').length > 2 ? 'Detalhe do Lead' : 'Funil de Leads'
    }
    if (path.startsWith('/contatos')) {
      return path.split('/').length > 2 ? 'Detalhe do Contato' : 'Contatos'
    }
    if (path.startsWith('/orcamentos')) {
      return path.split('/').length > 2 ? 'Detalhe do Orçamento' : 'Orçamentos'
    }
    if (path.startsWith('/configuracoes')) {
      return 'Configurações'
    }
    return 'CRM'
  }

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!globalSearch.trim()) return

    // Se estiver em orçamentos, filtra lá; senão navega para leads com busca
    const term = encodeURIComponent(globalSearch.trim())
    if (location.pathname.startsWith('/orcamentos')) {
      navigate(`/orcamentos?q=${term}`)
    } else if (location.pathname.startsWith('/contatos')) {
      navigate(`/contatos?q=${term}`)
    } else {
      navigate(`/leads?q=${term}`)
    }
  }

  const navItems = [
    { label: 'Visão Geral', to: '/', icon: LayoutDashboard },
    { label: 'Leads', to: '/leads', icon: Filter },
    { label: 'Contatos', to: '/contatos', icon: Users },
    { label: 'Orçamentos', to: '/orcamentos', icon: FileText },
    { label: 'Configurações', to: '/configuracoes', icon: SettingsIcon },
  ]

  const userName = user?.name || user?.email?.split('@')[0] || 'Usuário'
  const userInitials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-[#E5DFD6]">
      {/* Logo da Editora & Gráfica */}
      <div className="p-5 border-b border-[#E5DFD6]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-[#B3541E] text-white flex items-center justify-center shadow-sm">
            <div className="flex items-center -space-x-1">
              <BookOpen className="w-4 h-4" />
              <Printer className="w-3.5 h-3.5 opacity-80" />
            </div>
          </div>
          <div>
            <h1 className="font-serif text-base font-bold text-[#1E1B16] leading-tight">
              Editora & Gráfica
            </h1>
            <p className="text-[11px] text-[#8A8178] uppercase tracking-wider font-medium">
              CRM & Livraria
            </p>
          </div>
        </div>
      </div>

      {/* Navegação Principal */}
      <div className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[#E9E4DC] text-[#B3541E] font-semibold shadow-xs'
                  : 'text-[#1E1B16] hover:bg-[#F7F5F2] hover:text-[#B3541E]',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 transition-colors',
                  isActive ? 'text-[#B3541E]' : 'text-[#8A8178]',
                )}
              />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>

      {/* Rodapé da Sidebar: Usuário + Logout */}
      <div className="p-3 border-t border-[#E5DFD6] bg-[#FAF8F5]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="w-8 h-8 border border-[#E5DFD6] bg-[#E9E4DC] text-[#B3541E] text-xs font-semibold">
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1E1B16] truncate">{userName}</p>
              <p className="text-[11px] text-[#8A8178] truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Sair do sistema"
            className="h-8 w-8 text-[#8A8178] hover:text-[#B3261E] hover:bg-white flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-[#F7F5F2]">
      {/* Sidebar Desktop Fixa 240px */}
      <aside className="hidden lg:block w-[240px] fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Drawer Mobile via Hambúrguer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[260px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de Navegação</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Área Direita: Header Fixo + Conteúdo */}
      <div className="flex-1 lg:pl-[240px] flex flex-col min-h-screen">
        {/* Header Fixo */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#E5DFD6] px-4 sm:px-6 flex items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-[#1E1B16] -ml-2"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1E1B16] truncate">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end max-w-lg">
            {/* Busca Global */}
            <form
              onSubmit={handleGlobalSearchSubmit}
              className="relative flex-1 max-w-xs hidden sm:block"
            >
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8178]" />
              <Input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Buscar lead, contato, orçamento..."
                className="pl-9 h-9 text-xs sm:text-sm border-[#E5DFD6] bg-[#FAF8F5] focus-visible:ring-[#B3541E]"
              />
            </form>

            {/* Botão Novo Lead (cor primária terracota) */}
            <Button
              onClick={() => setNewLeadModalOpen(true)}
              className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs sm:text-sm font-medium h-9 px-3 sm:px-4 shadow-sm"
            >
              <Plus className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Novo Lead</span>
            </Button>
          </div>
        </header>

        {/* Conteúdo com padding 24px */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Modal Novo Lead Global */}
      <NewLeadModal
        open={newLeadModalOpen}
        onOpenChange={setNewLeadModalOpen}
        onSuccess={() => {
          // Atualiza a visualização caso esteja na lista
          if (location.pathname === '/leads') {
            window.location.reload()
          }
        }}
      />
    </div>
  )
}
