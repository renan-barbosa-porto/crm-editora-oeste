migrate(
  (app) => {
    // Garantir que inclui_editorial seja true (SQLite booleans are 1/0 or true/false)
    try {
      app.db().newQuery('UPDATE quotes SET inclui_editorial = 1').execute()
    } catch (_) {}
  },
  (app) => {},
)
