migrate(
  (app) => {
    // 1. Criar usuário inicial se não existir
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'renandm@gmail.com')
    } catch (_) {
      const adminUser = new Record(users)
      adminUser.setEmail('renandm@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Renan Gerente')
      app.save(adminUser)
    }

    const contactsCol = app.findCollectionByNameOrId('contacts')
    const leadsCol = app.findCollectionByNameOrId('leads')
    const conversationsCol = app.findCollectionByNameOrId('conversations')
    const quotesCol = app.findCollectionByNameOrId('quotes')
    const quoteItemsCol = app.findCollectionByNameOrId('quote_items')

    // Idempotência: verificar se já existem contatos semeados
    let contact1, contact2, contact3
    try {
      contact1 = app.findFirstRecordByData('contacts', 'email', 'marina.cerimonial@festas.com.br')
    } catch (_) {
      contact1 = new Record(contactsCol)
      contact1.set('nome', 'Marina Albuquerque')
      contact1.set('email', 'marina.cerimonial@festas.com.br')
      contact1.set('telefone', '11987654321')
      contact1.set('empresa', 'Albuquerque Cerimonial & Eventos')
      contact1.set('endereco', 'Av. Paulista, 1578, Cj 42 - Bela Vista, São Paulo - SP')
      app.save(contact1)
    }

    try {
      contact2 = app.findFirstRecordByData('contacts', 'email', 'eduardo.lima@novocaminho.org')
    } catch (_) {
      contact2 = new Record(contactsCol)
      contact2.set('nome', 'Prof. Eduardo Lima')
      contact2.set('email', 'eduardo.lima@novocaminho.org')
      contact2.set('telefone', '21998765432')
      contact2.set('empresa', 'Instituto Novo Caminho Cultural')
      contact2.set('endereco', 'Rua do Ouvidor, 102 - Centro, Rio de Janeiro - RJ')
      app.save(contact2)
    }

    try {
      contact3 = app.findFirstRecordByData('contacts', 'email', 'beatriz@livrariadoleitor.com.br')
    } catch (_) {
      contact3 = new Record(contactsCol)
      contact3.set('nome', 'Beatriz Fontes')
      contact3.set('email', 'beatriz@livrariadoleitor.com.br')
      contact3.set('telefone', '31984561234')
      contact3.set('empresa', 'Livraria do Leitor Independente')
      contact3.set('endereco', 'Rua Sergipe, 885 - Savassi, Belo Horizonte - MG')
      app.save(contact3)
    }

    // 4 leads com estágios variados
    let lead1, lead2, lead3, lead4
    try {
      lead1 = app.findFirstRecordByData('leads', 'nome', 'Marina Albuquerque - Convites Casamento')
    } catch (_) {
      lead1 = new Record(leadsCol)
      lead1.set('nome', 'Marina Albuquerque - Convites Casamento')
      lead1.set('telefone', '11987654321')
      lead1.set('email', 'marina.cerimonial@festas.com.br')
      lead1.set('empresa', 'Albuquerque Cerimonial & Eventos')
      lead1.set('estagio', 'Visualizado' === 'Visualizado' ? 'Proposta Enviada' : 'Novo')
      lead1.set('valor_estimado', 1850)
      lead1.set(
        'observacoes',
        'Cliente busca acabamento em hot-stamping dourado e papel linho 250g.',
      )
      lead1.set('contact_id', contact1.id)
      app.save(lead1)
    }

    try {
      lead2 = app.findFirstRecordByData(
        'leads',
        'nome',
        'Eduardo Lima - Publicação Livro Histórico',
      )
    } catch (_) {
      lead2 = new Record(leadsCol)
      lead2.set('nome', 'Eduardo Lima - Publicação Livro Histórico')
      lead2.set('telefone', '21998765432')
      lead2.set('email', 'eduardo.lima@novocaminho.org')
      lead2.set('empresa', 'Instituto Novo Caminho Cultural')
      lead2.set('estagio', 'Contato Feito')
      lead2.set('valor_estimado', 6400)
      lead2.set(
        'observacoes',
        'Projeto de livro com 120 páginas, miolo pólen soft 80g e capa cartão com laminação fosca.',
      )
      lead2.set('contact_id', contact2.id)
      app.save(lead2)
    }

    try {
      lead3 = app.findFirstRecordByData('leads', 'nome', 'Beatriz Fontes - Reposição de Catálogo')
    } catch (_) {
      lead3 = new Record(leadsCol)
      lead3.set('nome', 'Beatriz Fontes - Reposição de Catálogo')
      lead3.set('telefone', '31984561234')
      lead3.set('email', 'beatriz@livrariadoleitor.com.br')
      lead3.set('empresa', 'Livraria do Leitor Independente')
      lead3.set('estagio', 'Novo')
      lead3.set('valor_estimado', 2200)
      lead3.set(
        'observacoes',
        'Encomenda para a feira literária regional de 50 exemplares do catálogo ilustrado.',
      )
      lead3.set('contact_id', contact3.id)
      app.save(lead3)
    }

    try {
      lead4 = app.findFirstRecordByData('leads', 'nome', 'Carlos Menezes - Apostilas Técnicas')
    } catch (_) {
      lead4 = new Record(leadsCol)
      lead4.set('nome', 'Carlos Menezes - Apostilas Técnicas')
      lead4.set('telefone', '19971234567')
      lead4.set('email', 'carlos@cursosteclab.com.br')
      lead4.set('empresa', 'TecLab Cursos Profissionalizantes')
      lead4.set('estagio', 'Fechado')
      lead4.set('valor_estimado', 3100)
      lead4.set('observacoes', 'Lote fechado de 150 apostilas encadernadas wire-o.')
      app.save(lead4)
    }

    // 3 Orçamentos realistas ("Rascunho", "Enviado", "Visualizado")
    let quote1, quote2, quote3
    try {
      quote1 = app.findFirstRecordByData(
        'quotes',
        'titulo',
        'Gráfica Rápida — 200 convites de casamento finos',
      )
    } catch (_) {
      quote1 = new Record(quotesCol)
      quote1.set('codigo', 'ORC-1001')
      quote1.set('titulo', 'Gráfica Rápida — 200 convites de casamento finos')
      quote1.set('lead_id', lead1.id)
      quote1.set('contact_id', contact1.id)
      quote1.set('status', 'Visualizado')
      quote1.set('desconto_percentual', 5)
      app.save(quote1)

      const item1a = new Record(quoteItemsCol)
      item1a.set('quote_id', quote1.id)
      item1a.set('descricao', 'Convite impresso em Papel Linho 250g c/ Hot-stamping Ouro')
      item1a.set('quantidade', 200)
      item1a.set('valor_unitario', 7.5)
      item1a.set('desconto_percentual', 0)
      app.save(item1a)

      const item1b = new Record(quoteItemsCol)
      item1b.set('quote_id', quote1.id)
      item1b.set('descricao', 'Envelope artesanal modelo bico 240g com lacre de cera personalizado')
      item1b.set('quantidade', 200)
      item1b.set('valor_unitario', 2.25)
      item1b.set('desconto_percentual', 0)
      app.save(item1b)
    }

    try {
      quote2 = app.findFirstRecordByData(
        'quotes',
        'titulo',
        'Editora — Projeto de livro 120 páginas (300 ex)',
      )
    } catch (_) {
      quote2 = new Record(quotesCol)
      quote2.set('codigo', 'ORC-1002')
      quote2.set('titulo', 'Editora — Projeto de livro 120 páginas (300 ex)')
      quote2.set('lead_id', lead2.id)
      quote2.set('contact_id', contact2.id)
      quote2.set('status', 'Enviado')
      quote2.set('desconto_percentual', 0)
      app.save(quote2)

      const item2a = new Record(quoteItemsCol)
      item2a.set('quote_id', quote2.id)
      item2a.set('descricao', 'Diagramação completa do miolo (120 páginas) e preparação editorial')
      item2a.set('quantidade', 1)
      item2a.set('valor_unitario', 1600)
      item2a.set('desconto_percentual', 0)
      app.save(item2a)

      const item2b = new Record(quoteItemsCol)
      item2b.set('quote_id', quote2.id)
      item2b.set(
        'descricao',
        'Impressão e encadernação colada PUR - 300 exemplares miolo pólen 80g',
      )
      item2b.set('quantidade', 300)
      item2b.set('valor_unitario', 16)
      item2b.set('desconto_percentual', 0)
      app.save(item2b)
    }

    try {
      quote3 = app.findFirstRecordByData(
        'quotes',
        'titulo',
        'Livraria — Encomenda de 50 exemplares Catálogo',
      )
    } catch (_) {
      quote3 = new Record(quotesCol)
      quote3.set('codigo', 'ORC-1003')
      quote3.set('titulo', 'Livraria — Encomenda de 50 exemplares Catálogo')
      quote3.set('lead_id', lead3.id)
      quote3.set('contact_id', contact3.id)
      quote3.set('status', 'Rascunho')
      quote3.set('desconto_percentual', 10)
      app.save(quote3)

      const item3a = new Record(quoteItemsCol)
      item3a.set('quote_id', quote3.id)
      item3a.set(
        'descricao',
        'Catálogo Ilustrado Colorido Couché 150g - 48 páginas c/ grampo canoa',
      )
      item3a.set('quantidade', 50)
      item3a.set('valor_unitario', 48.0)
      item3a.set('desconto_percentual', 0)
      app.save(item3a)
    }

    // 4 mensagens de conversa vinculadas aos leads/contatos
    try {
      app.findFirstRecordByData(
        'conversations',
        'mensagem',
        'Olá Marina! Recebemos seu pedido de orçamento para os 200 convites com hot-stamping.',
      )
    } catch (_) {
      const c1 = new Record(conversationsCol)
      c1.set(
        'mensagem',
        'Olá Marina! Recebemos seu pedido de orçamento para os 200 convites com hot-stamping.',
      )
      c1.set('direcao', 'enviada')
      c1.set('lead_id', lead1.id)
      c1.set('contact_id', contact1.id)
      app.save(c1)

      const c2 = new Record(conversationsCol)
      c2.set(
        'mensagem',
        'Excelente! Gostaria de saber se vocês conseguem enviar uma prova digital do monograma antes de produzir.',
      )
      c2.set('direcao', 'recebida')
      c2.set('lead_id', lead1.id)
      c2.set('contact_id', contact1.id)
      app.save(c2)

      const c3 = new Record(conversationsCol)
      c3.set(
        'mensagem',
        'Com certeza! Enviamos a prova em PDF e se desejar fazemos o boneco físico aqui na gráfica.',
      )
      c3.set('direcao', 'enviada')
      c3.set('lead_id', lead1.id)
      c3.set('contact_id', contact1.id)
      app.save(c3)

      const c4 = new Record(conversationsCol)
      c4.set(
        'mensagem',
        'Bom dia! Gostaria de consultar o prazo para produção do livro de 120 páginas do Instituto.',
      )
      c4.set('direcao', 'recebida')
      c4.set('lead_id', lead2.id)
      c4.set('contact_id', contact2.id)
      app.save(c4)
    }
  },
  (app) => {
    // rollback opcional
  },
)
