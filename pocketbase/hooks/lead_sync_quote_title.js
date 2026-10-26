// Hook para atualizar o título padrão dos orçamentos quando o lead for renomeado
// Nome do arquivo: pocketbase/hooks/lead_sync_quote_title.js
// IMPORTANTE: Todas as variáveis e funções devem estar inline dentro do callback (regras de escopo da VM do PocketBase)

onRecordAfterUpdateSuccess((e) => {
  const lead = e.record
  const leadId = lead.id || lead.getString('id')
  const novoNome = lead.getString('nome')
  const nomeAntigo = lead.original() ? lead.original().getString('nome') : ''

  if (!leadId || !novoNome || novoNome === nomeAntigo) {
    e.next()
    return
  }

  try {
    // Busca orçamentos vinculados a este lead
    const quotes = $app.findRecordsByFilter('quotes', "lead_id = '" + leadId + "'", '', 100, 0)
    for (let i = 0; i < quotes.length; i++) {
      const q = quotes[i]
      const currentTitulo = q.getString('titulo')

      // Se o título for padrão ("Orçamento — ...") ou baseado no nome anterior, atualiza para o novo nome
      if (
        !currentTitulo ||
        currentTitulo.startsWith('Orçamento —') ||
        currentTitulo === 'Orçamento' ||
        (nomeAntigo && currentTitulo.includes(nomeAntigo))
      ) {
        q.set('titulo', 'Orçamento — ' + novoNome.trim())
        $app.save(q)
      }
    }
  } catch (err) {
    console.log('Erro ao sincronizar titulo de orcamentos ao renomear lead:', err)
  }

  e.next()
}, 'leads')
