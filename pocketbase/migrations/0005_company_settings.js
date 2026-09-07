migrate(
  (app) => {
    // 1. Criar coleção 'company_settings' para configurações globais da empresa
    const settings = new Collection({
      name: 'company_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome_comercial', type: 'text', required: true },
        { name: 'razao_social', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'cidade_uf', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'portal', type: 'text' },
        { name: 'prazo_execucao_dias', type: 'number' },
        { name: 'condicoes_pagamento', type: 'text' },
        { name: 'condicoes_entrega', type: 'text' },
        { name: 'validade_proposta_dias', type: 'number' },
        { name: 'texto_condicoes_padrao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(settings)

    // 2. Seed do registro inicial com os valores padrão atuais da Editora Oeste
    const initialTextCondicoes = `1. Prazo de entrega: até 20 dias úteis após a aprovação final das fichas técnicas e prova digital (AF).
2. Modelo de publicação: livro disponível no portal da Editora Oeste em regime de impressão sob demanda (POD).
3. Lançamento e divulgação: eventos de lançamento e ações promocionais negociados à parte.
4. Condições de pagamento: PIX à vista com 5% de desconto, ou cartão de crédito em até 3x sem juros.
5. Frete e entrega: entrega CIF Campo Grande - MS (frete incluso para Campo Grande/MS; demais regiões sob consulta).`

    try {
      const records = app.findRecordsByFilter('company_settings', '', '', 1, 0)
      if (records.length === 0) {
        const record = new Record(settings)
        record.set('nome_comercial', 'Editora Oeste')
        record.set('razao_social', 'Editora Oeste Comunicação & Gráfica Ltda.')
        record.set('cnpj', '14.882.910/0001-35')
        record.set('cidade_uf', 'Campo Grande - MS')
        record.set('telefone', '(67) 99843-2210')
        record.set('email', 'contato@editoraoeste.com.br')
        record.set('portal', 'editoraoeste.com.br')
        record.set('prazo_execucao_dias', 20)
        record.set(
          'condicoes_pagamento',
          'PIX à vista com 5% de desconto, ou cartão de crédito em até 3x sem juros',
        )
        record.set(
          'condicoes_entrega',
          'CIF Campo Grande - MS (frete incluso para Campo Grande/MS; demais regiões sob consulta)',
        )
        record.set('validade_proposta_dias', 15)
        record.set('texto_condicoes_padrao', initialTextCondicoes)
        app.save(record)
      }
    } catch (e) {
      console.log('Erro ao criar registro inicial de settings:', e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('company_settings')
      app.delete(col)
    } catch (_) {}
  },
)
