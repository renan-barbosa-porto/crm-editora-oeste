migrate(
  (app) => {
    // 1. Atualizar a coleção 'leads' para permitir o estágio 'Esfriou'
    const leadsCol = app.findCollectionByNameOrId('leads')
    const estagioField = leadsCol.fields.getByName('estagio')
    if (estagioField) {
      estagioField.values = [
        'Novo',
        'Contato Feito',
        'Proposta Enviada',
        'Fechado',
        'Perdido',
        'Esfriou',
      ]
      estagioField.maxSelect = 1
    }
    app.save(leadsCol)

    // 2. Adicionar o campo 'data_envio' (DateField) na coleção 'quotes'
    const quotesCol = app.findCollectionByNameOrId('quotes')
    if (!quotesCol.fields.getByName('data_envio')) {
      quotesCol.fields.add(
        new DateField({
          name: 'data_envio',
          required: false,
        }),
      )
    }
    app.save(quotesCol)

    // 3. Atualizar retroativamente os orçamentos de exemplo com datas de envio coerentes
    // Para que caiam nas faixas:
    // - Vermelha (> 7 dias)
    // - Amarela (4 a 7 dias)
    // - Neutra (até 3 dias)
    const now = new Date()

    // ORC-1002 (status Enviado) -> colocar enviado há 10 dias (Vermelho - urgente)
    try {
      const q2 = app.findFirstRecordByData('quotes', 'codigo', 'ORC-1002')
      const d10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      q2.set('data_envio', d10.toISOString().replace('T', ' '))
      app.save(q2)
    } catch (_) {}

    // ORC-1001 (status Visualizado) -> colocar enviado há 5 dias (Amarelo - 4 a 7 dias)
    try {
      const q1 = app.findFirstRecordByData('quotes', 'codigo', 'ORC-1001')
      const d5 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      q1.set('data_envio', d5.toISOString().replace('T', ' '))
      app.save(q1)
    } catch (_) {}

    // Criar mais um orçamento de exemplo enviado recentemente (2 dias atrás - Neutro) para termos as 3 faixas
    try {
      app.findFirstRecordByData('quotes', 'codigo', 'ORC-1004')
    } catch (_) {
      try {
        const leadEduardo = app.findFirstRecordByData(
          'leads',
          'nome',
          'Eduardo Lima - Publicação Livro Histórico',
        )
        const newQ = new Record(quotesCol)
        newQ.set('codigo', 'ORC-1004')
        newQ.set('titulo', 'Gráfica — 1000 Marcadores de Página Personalizados')
        newQ.set('lead_id', leadEduardo.id)
        if (leadEduardo.get('contact_id')) {
          newQ.set('contact_id', leadEduardo.get('contact_id'))
        }
        newQ.set('status', 'Enviado')
        newQ.set('desconto_percentual', 0)
        const d2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        newQ.set('data_envio', d2.toISOString().replace('T', ' '))
        app.save(newQ)

        // Item do orçamento
        const quoteItemsCol = app.findCollectionByNameOrId('quote_items')
        const item4 = new Record(quoteItemsCol)
        item4.set('quote_id', newQ.id)
        item4.set('descricao', 'Marcador couchê 300g 5x18cm c/ laminação fosca e verniz localizado')
        item4.set('quantidade', 1000)
        item4.set('valor_unitario', 0.85)
        item4.set('desconto_percentual', 0)
        app.save(item4)
      } catch (_) {}
    }

    // Criar um lead de exemplo com status 'Esfriou' para que a aba 'Arquivados' já possa ser testada/visualizada
    try {
      app.findFirstRecordByData('leads', 'nome', 'Juliana Rocha - Revistas Acadêmicas')
    } catch (_) {
      try {
        const leadEsfriou = new Record(leadsCol)
        leadEsfriou.set('nome', 'Juliana Rocha - Revistas Acadêmicas')
        leadEsfriou.set('telefone', '11976541230')
        leadEsfriou.set('email', 'juliana.rocha@universidade.edu.br')
        leadEsfriou.set('empresa', 'Faculdade de Ciências Humanas')
        leadEsfriou.set('estagio', 'Esfriou')
        leadEsfriou.set('valor_estimado', 4500)
        leadEsfriou.set(
          'observacoes',
          'Cliente parou de responder após envio de prévia orçamentária no mês passado.',
        )
        app.save(leadEsfriou)
      } catch (_) {}
    }
  },
  (app) => {
    // Reverter campos se necessário
    try {
      const quotesCol = app.findCollectionByNameOrId('quotes')
      const dataEnvioField = quotesCol.fields.getByName('data_envio')
      if (dataEnvioField) {
        quotesCol.fields.remove(dataEnvioField)
        app.save(quotesCol)
      }
    } catch (_) {}
  },
)
