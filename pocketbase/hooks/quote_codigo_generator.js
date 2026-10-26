// Hook para gerar código sequencial de orçamento
// Nome do arquivo: pocketbase/hooks/quote_codigo_generator.js
// IMPORTANTE: Todas as variáveis e funções devem estar inline dentro do callback (regras de escopo da VM do PocketBase)

onRecordAfterCreateSuccess((e) => {
  const record = e.record
  const currentCodigo = record.getString('codigo')

  // Se já tiver código definido, não sobrescrever
  if (currentCodigo && currentCodigo.trim() !== '') {
    e.next()
    return
  }

  try {
    const id = record.id || record.getString('id')
    const numRef = record.getString('numero_referencia')
    const suffix =
      numRef && numRef.trim() !== ''
        ? numRef.trim()
        : id && id.length >= 4
          ? id.substring(id.length - 4).toUpperCase()
          : $security.randomString(4).toUpperCase()
    const newCodigo = 'ORC-' + suffix

    record.set('codigo', newCodigo)
    $app.save(record)
  } catch (err) {
    console.log('Erro ao autogerar codigo do orcamento:', err)
  }

  e.next()
}, 'quotes')
