migrate(
  (app) => {
    // 1. Adicionar campos na coleção 'quotes':
    // - numero_referencia (text): número livre digitado da proposta
    // - pdf_locked (bool): se o orçamento está congelado para edição após gerar PDF
    // - tiragem_valorizacao (text/select): qual faixa de preço da Parte 2 valoriza o dashboard (1, 50, 100, combinar)
    // - inclui_editorial (bool): se o projeto inclui a Parte 1 de produção editorial
    const quotesCol = app.findCollectionByNameOrId('quotes')

    if (!quotesCol.fields.getByName('numero_referencia')) {
      quotesCol.fields.add(
        new TextField({
          name: 'numero_referencia',
          required: false,
        }),
      )
    }

    if (!quotesCol.fields.getByName('pdf_locked')) {
      quotesCol.fields.add(
        new BoolField({
          name: 'pdf_locked',
          required: false,
        }),
      )
    }

    if (!quotesCol.fields.getByName('tiragem_valorizacao')) {
      quotesCol.fields.add(
        new SelectField({
          name: 'tiragem_valorizacao',
          required: false,
          values: ['1', '50', '100', 'combinar'],
          maxSelect: 1,
        }),
      )
    }

    if (!quotesCol.fields.getByName('inclui_editorial')) {
      quotesCol.fields.add(
        new BoolField({
          name: 'inclui_editorial',
          required: false,
        }),
      )
    }

    app.save(quotesCol)

    // 2. Adicionar campo 'logo' (FileField) na coleção 'company_settings'
    const settingsCol = app.findCollectionByNameOrId('company_settings')
    if (!settingsCol.fields.getByName('logo')) {
      settingsCol.fields.add(
        new FileField({
          name: 'logo',
          required: false,
          maxSelect: 1,
          maxSize: 5242880, // 5MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        }),
      )
      app.save(settingsCol)
    }

    // 3. Atualizar retroativamente os orçamentos existentes:
    // Se tiver 'codigo' (ex: ORC-1001), definir numero_referencia = codigo se ainda vazio.
    // inclui_editorial = true por padrão nos orçamentos existentes
    // tiragem_valorizacao = '50' (ou '1' ou 'combinar') por padrão
    try {
      app
        .db()
        .newQuery(`
        UPDATE quotes 
        SET inclui_editorial = 1 
        WHERE inclui_editorial IS NULL
      `)
        .execute()

      app
        .db()
        .newQuery(`
        UPDATE quotes 
        SET tiragem_valorizacao = '50' 
        WHERE tiragem_valorizacao IS NULL OR tiragem_valorizacao = ''
      `)
        .execute()

      app
        .db()
        .newQuery(`
        UPDATE quotes 
        SET numero_referencia = codigo 
        WHERE (numero_referencia IS NULL OR numero_referencia = '') AND (codigo IS NOT NULL AND codigo != '')
      `)
        .execute()
    } catch (e) {
      console.log('Aviso ao atualizar valores padrão em quotes:', e)
    }
  },
  (app) => {
    try {
      const quotesCol = app.findCollectionByNameOrId('quotes')
      const f1 = quotesCol.fields.getByName('numero_referencia')
      if (f1) quotesCol.fields.remove(f1)
      const f2 = quotesCol.fields.getByName('pdf_locked')
      if (f2) quotesCol.fields.remove(f2)
      const f3 = quotesCol.fields.getByName('tiragem_valorizacao')
      if (f3) quotesCol.fields.remove(f3)
      const f4 = quotesCol.fields.getByName('inclui_editorial')
      if (f4) quotesCol.fields.remove(f4)
      app.save(quotesCol)
    } catch (_) {}

    try {
      const settingsCol = app.findCollectionByNameOrId('company_settings')
      const fLogo = settingsCol.fields.getByName('logo')
      if (fLogo) {
        settingsCol.fields.remove(fLogo)
        app.save(settingsCol)
      }
    } catch (_) {}
  },
)
