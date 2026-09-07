// Hook para sincronizar status de orçamento com o estágio do lead correspondente
// Nome do arquivo: pocketbase/hooks/quote_sync_lead_status.js
// Regras do usuário:
// - "Enviado" -> lead vai para estágio "Proposta Enviada"
// - "Aprovado" -> lead vai para estágio "Fechado"
// - "Rejeitado" -> lead permanece onde está
// - "Esfriou" -> lead permanece onde está
// - Todas as variáveis e funções inline dentro do callback (regras de escopo da VM do PocketBase)

onRecordAfterUpdateSuccess((e) => {
  const quote = e.record
  const status = quote.getString('status')
  const leadId = quote.getString('lead_id')

  if (!leadId) {
    e.next()
    return
  }

  try {
    let targetEstagio = null

    if (status === 'Enviado') {
      targetEstagio = 'Proposta Enviada'
    } else if (status === 'Aprovado') {
      targetEstagio = 'Fechado'
    }

    if (targetEstagio) {
      const lead = $app.findRecordById('leads', leadId)
      if (lead && lead.getString('estagio') !== targetEstagio) {
        lead.set('estagio', targetEstagio)
        $app.save(lead)
      }
    }
  } catch (err) {
    console.log('Erro ao sincronizar status do lead via quote:', err)
  }

  e.next()
}, 'quotes')

// Também para quando um orçamento for criado já com status 'Enviado' ou 'Aprovado'
onRecordAfterCreateSuccess((e) => {
  const quote = e.record
  const status = quote.getString('status')
  const leadId = quote.getString('lead_id')

  if (!leadId) {
    e.next()
    return
  }

  try {
    let targetEstagio = null

    if (status === 'Enviado') {
      targetEstagio = 'Proposta Enviada'
    } else if (status === 'Aprovado') {
      targetEstagio = 'Fechado'
    }

    if (targetEstagio) {
      const lead = $app.findRecordById('leads', leadId)
      if (lead && lead.getString('estagio') !== targetEstagio) {
        lead.set('estagio', targetEstagio)
        $app.save(lead)
      }
    }
  } catch (err) {
    console.log('Erro ao sincronizar status do lead na criacao do quote:', err)
  }

  e.next()
}, 'quotes')
