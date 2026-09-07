import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2, FolderPlus, Layers, BookOpen, DollarSign } from 'lucide-react'
import {
  getQuoteCategories,
  getCatalogItems,
  createQuoteCategory,
  updateQuoteCategory,
  deleteQuoteCategory,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from '@/services/catalog'
import type { QuoteCategory, CatalogItem } from '@/types/crm'
import { useToast } from '@/hooks/use-toast'

interface CatalogManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemChanged?: () => void
}

export function CatalogManagerModal({
  open,
  onOpenChange,
  onItemChanged,
}: CatalogManagerModalProps) {
  const { toast } = useToast()

  const [categories, setCategories] = useState<QuoteCategory[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  // Modais de Criação/Edição de Categoria
  const [catNameInput, setCatNameInput] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)

  // Formulário de Criação/Edição de Item
  const [itemNome, setItemNome] = useState('')
  const [itemDescricao, setItemDescricao] = useState('')
  const [itemValor, setItemValor] = useState<number>(0)
  const [itemCatId, setItemCatId] = useState<string>('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)

  const loadCatalog = async () => {
    setLoading(true)
    try {
      const [cats, allItems] = await Promise.all([getQuoteCategories(), getCatalogItems()])
      setCategories(cats)
      setItems(allItems)
      if (cats.length > 0 && !itemCatId) {
        setItemCatId(cats[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadCatalog()
    }
  }, [open])

  // Categorias Handlers
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catNameInput.trim()) return
    try {
      const newCat = await createQuoteCategory({
        nome: catNameInput.trim(),
        ordem: categories.length + 1,
      })
      setCategories([...categories, newCat])
      setCatNameInput('')
      setShowAddCat(false)
      toast({ title: 'Categoria criada com sucesso!' })
      if (onItemChanged) onItemChanged()
    } catch {
      toast({ title: 'Erro ao criar categoria', variant: 'destructive' })
    }
  }

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Deseja excluir esta categoria? Os itens vinculados permanecerão no catálogo.'))
      return
    try {
      await deleteQuoteCategory(catId)
      setCategories(categories.filter((c) => c.id !== catId))
      if (selectedCategoryId === catId) setSelectedCategoryId('all')
      toast({ title: 'Categoria excluída' })
      if (onItemChanged) onItemChanged()
    } catch {
      toast({ title: 'Erro ao excluir categoria', variant: 'destructive' })
    }
  }

  // Itens Handlers
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemNome.trim()) return

    try {
      if (editingItemId) {
        const updated = await updateCatalogItem(editingItemId, {
          nome: itemNome.trim(),
          descricao: itemDescricao.trim() || undefined,
          valor_padrao: itemValor || 0,
          category_id: itemCatId || undefined,
        })
        setItems(items.map((it) => (it.id === editingItemId ? updated : it)))
        toast({ title: 'Item atualizado com sucesso!' })
      } else {
        const created = await createCatalogItem({
          nome: itemNome.trim(),
          descricao: itemDescricao.trim() || undefined,
          valor_padrao: itemValor || 0,
          category_id: itemCatId || undefined,
        })
        setItems([...items, created])
        toast({ title: 'Item cadastrado no catálogo com memória!' })
      }

      // Reset
      setItemNome('')
      setItemDescricao('')
      setItemValor(0)
      setEditingItemId(null)
      setShowAddItem(false)
      if (onItemChanged) onItemChanged()
    } catch {
      toast({ title: 'Erro ao salvar item', variant: 'destructive' })
    }
  }

  const handleStartEditItem = (item: CatalogItem) => {
    setEditingItemId(item.id)
    setItemNome(item.nome)
    setItemDescricao(item.descricao || '')
    setItemValor(item.valor_padrao || 0)
    setItemCatId(item.category_id || categories[0]?.id || '')
    setShowAddItem(true)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Deseja excluir este item do catálogo?')) return
    try {
      await deleteCatalogItem(itemId)
      setItems(items.filter((it) => it.id !== itemId))
      toast({ title: 'Item removido do catálogo' })
      if (onItemChanged) onItemChanged()
    } catch {
      toast({ title: 'Erro ao excluir item', variant: 'destructive' })
    }
  }

  const filteredItems = items.filter((it) => {
    if (selectedCategoryId === 'all') return true
    return it.category_id === selectedCategoryId
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border-[#E5DFD6]">
        <DialogHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] bg-[#FAF8F5]">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-[#1E1B16] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#B3541E]" />
                Catálogo Global de Serviços (2 Níveis com Memória)
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8A8178] mt-0.5">
                Nível 1: Categorias • Nível 2: Itens e serviços editoriais sugeridos no
                preenchimento de propostas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Nível 1: Categorias */}
          <div className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E5DFD6] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-[#B3541E]" />
                Categorias (Nível 1)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddCat(!showAddCat)}
                className="h-7 text-xs border-[#E5DFD6] text-[#B3541E] hover:bg-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Categoria
              </Button>
            </div>

            {showAddCat && (
              <form onSubmit={handleCreateCategory} className="flex gap-2 pt-1">
                <Input
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  placeholder="Nome da categoria (ex: Produção Editorial, Produção Gráfica...)"
                  className="h-8 text-xs bg-white border-[#E5DFD6]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs bg-[#B3541E] hover:bg-[#9A4618] text-white"
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddCat(false)}
                  className="h-8 text-xs text-[#8A8178]"
                >
                  Cancelar
                </Button>
              </form>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#B3541E] text-white border-[#B3541E]'
                    : 'bg-white text-[#4A4238] border-[#E5DFD6] hover:bg-gray-50'
                }`}
              >
                Todas ({items.length})
              </button>
              {categories.map((cat) => (
                <div key={cat.id} className="inline-flex items-center group">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedCategoryId === cat.id
                        ? 'bg-[#B3541E] text-white border-[#B3541E]'
                        : 'bg-white text-[#4A4238] border-[#E5DFD6] hover:bg-gray-50'
                    }`}
                  >
                    {cat.nome} ({items.filter((it) => it.category_id === cat.id).length})
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Nível 2: Itens do Catálogo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#B3541E]" />
                Itens & Serviços Cadastrados (Nível 2 — {filteredItems.length})
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingItemId(null)
                  setItemNome('')
                  setItemDescricao('')
                  setItemValor(0)
                  setShowAddItem(true)
                }}
                className="h-8 text-xs bg-[#B3541E] hover:bg-[#9A4618] text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo Item no Catálogo
              </Button>
            </div>

            {/* Formulário de Adição/Edição de Item */}
            {showAddItem && (
              <form
                onSubmit={handleSaveItem}
                className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E5DFD6] space-y-3"
              >
                <div className="font-semibold text-xs text-[#1E1B16]">
                  {editingItemId ? 'Editar Item do Catálogo' : 'Cadastrar Novo Item no Catálogo'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] uppercase tracking-wider text-[#8A8178]">
                      Nome do Item / Serviço *
                    </Label>
                    <Input
                      value={itemNome}
                      onChange={(e) => setItemNome(e.target.value)}
                      placeholder="Ex: Registro bibliográfico ISBN..."
                      className="mt-1 h-8 text-xs bg-white border-[#E5DFD6]"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-[#8A8178]">
                      Categoria (Nível 1)
                    </Label>
                    <select
                      value={itemCatId}
                      onChange={(e) => setItemCatId(e.target.value)}
                      className="mt-1 w-full h-8 px-2 text-xs bg-white border border-[#E5DFD6] rounded"
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] uppercase tracking-wider text-[#8A8178]">
                      Descrição Detalhada
                    </Label>
                    <Input
                      value={itemDescricao}
                      onChange={(e) => setItemDescricao(e.target.value)}
                      placeholder="Detalhes técnicos sobre este serviço..."
                      className="mt-1 h-8 text-xs bg-white border-[#E5DFD6]"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-[#8A8178]">
                      Valor Padrão (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemValor}
                      onChange={(e) => setItemValor(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1 h-8 text-xs bg-white text-right border-[#E5DFD6]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddItem(false)
                      setEditingItemId(null)
                    }}
                    className="h-8 text-xs text-[#8A8178]"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs bg-[#B3541E] hover:bg-[#9A4618] text-white"
                  >
                    {editingItemId ? 'Salvar Alterações' : 'Adicionar ao Catálogo'}
                  </Button>
                </div>
              </form>
            )}

            {/* Lista dos Itens */}
            <div className="divide-y divide-[#E5DFD6] border border-[#E5DFD6] rounded-lg bg-white overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8A8178]">
                  Nenhum item cadastrado nesta categoria.
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const catNome = categories.find((c) => c.id === item.category_id)?.nome

                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-[#1E1B16]">
                            {idx + 1}. {item.nome}
                          </span>
                          {catNome && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-white border-[#E5DFD6] text-[#B3541E]"
                            >
                              {catNome}
                            </Badge>
                          )}
                        </div>
                        {item.descricao && (
                          <p className="text-xs text-[#8A8178] line-clamp-2">{item.descricao}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end flex-shrink-0">
                        <span className="font-mono font-bold text-xs sm:text-sm text-[#B3541E]">
                          {item.valor_padrao && item.valor_padrao > 0
                            ? item.valor_padrao.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : 'A combinar'}
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEditItem(item)}
                            className="h-7 w-7 text-[#8A8178] hover:text-[#1E1B16]"
                            title="Editar item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-7 w-7 text-[#8A8178] hover:text-[#B3261E]"
                            title="Remover do catálogo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
