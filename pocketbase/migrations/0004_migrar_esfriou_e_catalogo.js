migrate(
  (app) => {
    // 1. Atualizar coleção 'quotes': adicionar 'Esfriou' aos valores permitidos de status
    const quotesCol = app.findCollectionByNameOrId('quotes')
    const quoteStatusField = quotesCol.fields.getByName('status')
    if (quoteStatusField) {
      quoteStatusField.values = [
        'Rascunho',
        'Enviado',
        'Visualizado',
        'Aprovado',
        'Rejeitado',
        'Esfriou',
      ]
      quoteStatusField.maxSelect = 1
    }

    // Adicionar campos opcionais em quotes para Produção Gráfica e Condições Gerais (para o modelo de proposta em PDF)
    if (!quotesCol.fields.getByName('grafica_especificacoes')) {
      quotesCol.fields.add(
        new TextField({
          name: 'grafica_especificacoes',
          required: false,
        }),
      )
    }
    if (!quotesCol.fields.getByName('grafica_tiragens')) {
      quotesCol.fields.add(
        new JSONField({
          name: 'grafica_tiragens',
          required: false,
          maxSize: 2000000,
        }),
      )
    }
    if (!quotesCol.fields.getByName('condicoes_gerais')) {
      quotesCol.fields.add(
        new TextField({
          name: 'condicoes_gerais',
          required: false,
        }),
      )
    }
    app.save(quotesCol)

    // 2. Reverter leads que estavam com estágio 'Esfriou' para um estágio ativo ('Contato Feito')
    app
      .db()
      .newQuery("UPDATE leads SET estagio = 'Contato Feito' WHERE estagio = 'Esfriou'")
      .execute()

    // 3. Atualizar coleção 'leads': remover 'Esfriou' dos valores de estagio
    const leadsCol = app.findCollectionByNameOrId('leads')
    const leadEstagioField = leadsCol.fields.getByName('estagio')
    if (leadEstagioField) {
      leadEstagioField.values = ['Novo', 'Contato Feito', 'Proposta Enviada', 'Fechado', 'Perdido']
      leadEstagioField.maxSelect = 1
    }
    app.save(leadsCol)

    // 4. Criar coleção 'quote_categories' (Nível 1 do catálogo global)
    const quoteCategories = new Collection({
      name: 'quote_categories',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'ordem', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_quote_categories_nome ON quote_categories (nome)'],
    })
    app.save(quoteCategories)

    const categoriesColId = app.findCollectionByNameOrId('quote_categories').id

    // 5. Criar coleção 'catalog_items' (Nível 2 do catálogo global)
    const catalogItems = new Collection({
      name: 'catalog_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'category_id',
          type: 'relation',
          collectionId: categoriesColId,
          required: false,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'valor_padrao', type: 'number' },
        { name: 'unidade', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_catalog_items_category_id ON catalog_items (category_id)',
        'CREATE INDEX idx_catalog_items_nome ON catalog_items (nome)',
      ],
    })
    app.save(catalogItems)

    // 6. Cadastrar a categoria "Produção Editorial" e "Produção Gráfica"
    let catEditorialRecord = null
    try {
      catEditorialRecord = app.findFirstRecordByData(
        'quote_categories',
        'nome',
        'Produção Editorial',
      )
    } catch (_) {
      catEditorialRecord = new Record(quoteCategories)
      catEditorialRecord.set('nome', 'Produção Editorial')
      catEditorialRecord.set(
        'descricao',
        'Serviços editoriais: ISBN, diagramação, revisão, capa e e-book',
      )
      catEditorialRecord.set('ordem', 1)
      app.save(catEditorialRecord)
    }

    try {
      app.findFirstRecordByData('quote_categories', 'nome', 'Produção Gráfica')
    } catch (_) {
      const catGrafica = new Record(quoteCategories)
      catGrafica.set('nome', 'Produção Gráfica')
      catGrafica.set('descricao', 'Impressão de livros e materiais gráficos')
      catGrafica.set('ordem', 2)
      app.save(catGrafica)
    }

    // 7. Seed dos 5 itens EXATOS da categoria "Produção Editorial"
    const itensProducaoEditorial = [
      {
        nome: 'Registro bibliográfico ISBN, código de barras, catalogação (ficha) e disponibilização no catálogo da Editora (Online)',
        descricao:
          'Registro oficial ISBN, código de barras e ficha catalográfica com publicação no catálogo online.',
        valor_padrao: 300.0,
      },
      {
        nome: 'Criação e editoração da CAPA',
        descricao: 'Design e editoração completa de capa, contracapa e orelhas.',
        valor_padrao: 1030.0,
      },
      {
        nome: 'Diagramação e editoração em arquivo a ser formatado com software Adobe Indesign, entregue com links, no formato PDF',
        descricao:
          'Diagramação profissional de miolo em Adobe InDesign com links interativos em formato PDF pronto para gráfica.',
        valor_padrao: 490.0,
      },
      {
        nome: 'Revisão ortográfica e gramatical, contemplando a adequação à linguagem, repetições desnecessárias, coerência e organização textual',
        descricao:
          'Revisão textual aprofundada contemplando gramática, estilo e fluidez narrativa.',
        valor_padrao: 0.0,
      },
      {
        nome: 'Conversão do documento para Kindle/Amazon e disponibilização para comercialização.',
        descricao:
          'Adaptação do livro para formato e-book Kindle/Mobi/ePub e publicação na Amazon.',
        valor_padrao: 24.0,
      },
    ]

    for (const itemData of itensProducaoEditorial) {
      try {
        app.findFirstRecordByData('catalog_items', 'nome', itemData.nome)
      } catch (_) {
        const itemRec = new Record(catalogItems)
        itemRec.set('category_id', catEditorialRecord.id)
        itemRec.set('nome', itemData.nome)
        itemRec.set('descricao', itemData.descricao)
        itemRec.set('valor_padrao', itemData.valor_padrao)
        app.save(itemRec)
      }
    }

    // 8. Se houver algum orçamento para testar a nova aba "Esfriados", marcar um como "Esfriou" ou criar um de exemplo
    try {
      const orcSample = app.findFirstRecordByData('quotes', 'codigo', 'ORC-1002')
      orcSample.set('status', 'Esfriou')
      app.save(orcSample)
    } catch (_) {}
  },
  (app) => {
    try {
      const colItems = app.findCollectionByNameOrId('catalog_items')
      app.delete(colItems)
    } catch (_) {}
    try {
      const colCat = app.findCollectionByNameOrId('quote_categories')
      app.delete(colCat)
    } catch (_) {}
  },
)
