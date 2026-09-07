import pb from '@/lib/pocketbase/client'
import type { CompanySettings } from '@/types/crm'

export const DEFAULT_COMPANY_SETTINGS: Omit<
  CompanySettings,
  'id' | 'created' | 'updated' | 'collectionId' | 'collectionName'
> = {
  nome_comercial: 'Editora Oeste',
  razao_social: 'Editora Oeste Comunicação & Gráfica Ltda.',
  cnpj: '14.882.910/0001-35',
  cidade_uf: 'Campo Grande - MS',
  telefone: '(67) 99843-2210',
  email: 'contato@editoraoeste.com.br',
  portal: 'editoraoeste.com.br',
  prazo_execucao_dias: 20,
  condicoes_pagamento: 'PIX à vista com 5% de desconto, ou cartão de crédito em até 3x sem juros',
  condicoes_entrega:
    'CIF Campo Grande - MS (frete incluso para Campo Grande/MS; demais regiões sob consulta)',
  validade_proposta_dias: 15,
  texto_condicoes_padrao: `1. Prazo de entrega: até 20 dias úteis após a aprovação final das fichas técnicas e prova digital (AF).
2. Modelo de publicação: livro disponível no portal da Editora Oeste em regime de impressão sob demanda (POD).
3. Lançamento e divulgação: eventos de lançamento e ações promocionais negociados à parte.
4. Condições de pagamento: PIX à vista com 5% de desconto, ou cartão de crédito em até 3x sem juros.
5. Frete e entrega: entrega CIF Campo Grande - MS (frete incluso para Campo Grande/MS; demais regiões sob consulta).`,
}

export function gerarTextoCondicoes(settings: Partial<CompanySettings>): string {
  const nome = settings.nome_comercial || DEFAULT_COMPANY_SETTINGS.nome_comercial
  const prazo = settings.prazo_execucao_dias ?? DEFAULT_COMPANY_SETTINGS.prazo_execucao_dias ?? 20
  const pagamento = settings.condicoes_pagamento || DEFAULT_COMPANY_SETTINGS.condicoes_pagamento
  const entrega = settings.condicoes_entrega || DEFAULT_COMPANY_SETTINGS.condicoes_entrega
  const portal = settings.portal || DEFAULT_COMPANY_SETTINGS.portal

  return `1. Prazo de entrega: até ${prazo} dias úteis após a aprovação final das fichas técnicas e prova digital (AF).
2. Modelo de publicação: livro disponível no portal da ${nome}${portal ? ` (${portal})` : ''} em regime de impressão sob demanda (POD).
3. Lançamento e divulgação: eventos de lançamento e ações promocionais negociados à parte.
4. Condições de pagamento: ${pagamento}.
5. Frete e entrega: entrega ${entrega}.`
}

/**
 * Busca as configurações da empresa gravadas no PocketBase.
 * Caso ainda não haja registro ou ocorra erro, retorna os valores padrão seguros.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const list = await pb.collection('company_settings').getList<CompanySettings>(1, 1, {
      sort: 'created',
      requestKey: null,
    })
    if (list.items.length > 0) {
      return list.items[0]
    }
  } catch (err) {
    console.warn('Erro ao carregar company_settings do PocketBase, usando defaults:', err)
  }

  // Tenta criar se não existir nenhum
  try {
    const created = await pb
      .collection('company_settings')
      .create<CompanySettings>(DEFAULT_COMPANY_SETTINGS)
    return created
  } catch {
    // Retorna fallback em memória se create falhar (ex: sem autenticação momentânea)
    return {
      id: 'default',
      nome_comercial: DEFAULT_COMPANY_SETTINGS.nome_comercial,
      razao_social: DEFAULT_COMPANY_SETTINGS.razao_social,
      cnpj: DEFAULT_COMPANY_SETTINGS.cnpj,
      cidade_uf: DEFAULT_COMPANY_SETTINGS.cidade_uf,
      telefone: DEFAULT_COMPANY_SETTINGS.telefone,
      email: DEFAULT_COMPANY_SETTINGS.email,
      portal: DEFAULT_COMPANY_SETTINGS.portal,
      prazo_execucao_dias: DEFAULT_COMPANY_SETTINGS.prazo_execucao_dias,
      condicoes_pagamento: DEFAULT_COMPANY_SETTINGS.condicoes_pagamento,
      condicoes_entrega: DEFAULT_COMPANY_SETTINGS.condicoes_entrega,
      validade_proposta_dias: DEFAULT_COMPANY_SETTINGS.validade_proposta_dias,
      texto_condicoes_padrao: DEFAULT_COMPANY_SETTINGS.texto_condicoes_padrao,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      collectionId: '',
      collectionName: 'company_settings',
    }
  }
}

/**
 * Atualiza ou cria o registro global de configurações da empresa.
 */
export async function updateCompanySettings(
  id: string | null | undefined,
  data: Partial<CompanySettings>,
): Promise<CompanySettings> {
  if (id && id !== 'default') {
    return await pb.collection('company_settings').update<CompanySettings>(id, data)
  }

  // Verifica se já existe um registro para atualizar em vez de duplicar
  try {
    const list = await pb.collection('company_settings').getList<CompanySettings>(1, 1)
    if (list.items.length > 0) {
      return await pb.collection('company_settings').update<CompanySettings>(list.items[0].id, data)
    }
  } catch {
    /* intentionally ignored */
  }

  return await pb.collection('company_settings').create<CompanySettings>({
    ...DEFAULT_COMPANY_SETTINGS,
    ...data,
  })
}
