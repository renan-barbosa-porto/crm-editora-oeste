migrate(
  (app) => {
    // 1. Atualizar o orçamento 26197 (id: y3wi5984ps2t8zj) para refletir o nome atual do lead
    try {
      app
        .db()
        .newQuery(`
        UPDATE quotes 
        SET titulo = 'Orçamento — Escola Estadual Onecidio Manoel de Resende' 
        WHERE id = 'y3wi5984ps2t8zj' OR (numero_referencia = '26197' AND lead_id = 'jzx9u5a9qz0xubr')
      `)
        .execute()
    } catch (err) {
      console.log('Erro ao atualizar titulo do orcamento 26197:', err)
    }

    // 2. Atualizar todos os orçamentos cujo título ainda estava congelado no formato "Orçamento — <nome_antigo>"
    // com o nome atual do lead vinculado (caso existam outros leads renomeados)
    try {
      app
        .db()
        .newQuery(`
        UPDATE quotes
        SET titulo = 'Orçamento — ' || (SELECT nome FROM leads WHERE leads.id = quotes.lead_id)
        WHERE lead_id IS NOT NULL 
          AND lead_id != ''
          AND (titulo LIKE 'Orçamento — %' OR titulo = 'Orçamento' OR titulo IS NULL OR titulo = '')
          AND EXISTS (SELECT 1 FROM leads WHERE leads.id = quotes.lead_id AND leads.nome IS NOT NULL AND leads.nome != '')
      `)
        .execute()
    } catch (err) {
      console.log('Erro ao sincronizar titulos legados com leads:', err)
    }
  },
  (app) => {},
)
