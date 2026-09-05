migrate(
  (app) => {
    // 1. contacts collection
    const contacts = new Collection({
      name: 'contacts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text', required: true },
        { name: 'empresa', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_contacts_email ON contacts (email)'],
    })
    app.save(contacts)

    const contactsColId = app.findCollectionByNameOrId('contacts').id

    // 2. leads collection
    const leads = new Collection({
      name: 'leads',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'telefone', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'empresa', type: 'text' },
        {
          name: 'estagio',
          type: 'select',
          required: true,
          values: ['Novo', 'Contato Feito', 'Proposta Enviada', 'Fechado', 'Perdido'],
          maxSelect: 1,
        },
        { name: 'valor_estimado', type: 'number' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'contact_id',
          type: 'relation',
          collectionId: contactsColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_leads_estagio ON leads (estagio)',
        'CREATE INDEX idx_leads_contact_id ON leads (contact_id)',
      ],
    })
    app.save(leads)

    const leadsColId = app.findCollectionByNameOrId('leads').id

    // 3. conversations collection
    const conversations = new Collection({
      name: 'conversations',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
      fields: [
        { name: 'mensagem', type: 'text', required: true },
        {
          name: 'direcao',
          type: 'select',
          required: true,
          values: ['enviada', 'recebida'],
          maxSelect: 1,
        },
        {
          name: 'contact_id',
          type: 'relation',
          collectionId: contactsColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'lead_id',
          type: 'relation',
          collectionId: leadsColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_conversations_lead_id ON conversations (lead_id)',
        'CREATE INDEX idx_conversations_contact_id ON conversations (contact_id)',
      ],
    })
    app.save(conversations)

    // 4. quotes collection
    const quotes = new Collection({
      name: 'quotes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'codigo', type: 'text' },
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'lead_id',
          type: 'relation',
          collectionId: leadsColId,
          required: true,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'contact_id',
          type: 'relation',
          collectionId: contactsColId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Rascunho', 'Enviado', 'Visualizado', 'Aprovado', 'Rejeitado'],
          maxSelect: 1,
        },
        { name: 'desconto_percentual', type: 'number' },
        { name: 'validade', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_quotes_status ON quotes (status)',
        'CREATE INDEX idx_quotes_lead_id ON quotes (lead_id)',
        'CREATE INDEX idx_quotes_contact_id ON quotes (contact_id)',
        'CREATE INDEX idx_quotes_created ON quotes (created)',
      ],
    })
    app.save(quotes)

    const quotesColId = app.findCollectionByNameOrId('quotes').id

    // 5. quote_items collection
    const quoteItems = new Collection({
      name: 'quote_items',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'quote_id',
          type: 'relation',
          collectionId: quotesColId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'quantidade', type: 'number', required: true },
        { name: 'valor_unitario', type: 'number', required: true },
        { name: 'desconto_percentual', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_quote_items_quote_id ON quote_items (quote_id)'],
    })
    app.save(quoteItems)
  },
  (app) => {
    const safeDelete = (name) => {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
    safeDelete('quote_items')
    safeDelete('quotes')
    safeDelete('conversations')
    safeDelete('leads')
    safeDelete('contacts')
  },
)
