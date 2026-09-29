import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { CompanySettings } from '@/types/crm'
import {
  getCompanySettings,
  updateCompanySettings,
  DEFAULT_COMPANY_SETTINGS,
} from '@/services/settings'

interface SettingsContextType {
  settings: CompanySettings
  loading: boolean
  reloadSettings: () => Promise<void>
  saveSettings: (data: Partial<CompanySettings> | FormData) => Promise<CompanySettings>
}

const fallbackRecord: CompanySettings = {
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

const SettingsContext = createContext<SettingsContextType>({
  settings: fallbackRecord,
  loading: true,
  reloadSettings: async () => {},
  saveSettings: async () => fallbackRecord,
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(fallbackRecord)
  const [loading, setLoading] = useState(true)

  const reloadSettings = useCallback(async () => {
    try {
      const data = await getCompanySettings()
      setSettings(data || fallbackRecord)
    } catch (e) {
      console.warn('Falha ao recarregar configurações da empresa, mantendo defaults:', e)
      setSettings(fallbackRecord)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadSettings()
  }, [reloadSettings])

  const saveSettings = async (data: Partial<CompanySettings> | FormData) => {
    const updated = await updateCompanySettings(settings.id, data)
    setSettings(updated)
    return updated
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        reloadSettings,
        saveSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useCompanySettings() {
  return useContext(SettingsContext)
}
