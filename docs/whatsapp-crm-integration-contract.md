# Integração CRM ↔ WhatsApp — contrato técnico inicial (proposta, NÃO implantado)

**Estado:** desenho para homologação. Nenhum endpoint deste documento foi criado ou publicado.
**Origem:** CRM em PocketBase/Skip; atendimento WhatsApp em Supabase/Evolution API/Hostinger.
**Princípio:** bancos separados, acesso por servidor autorizado, sem replicar histórico de mensagens.

## 1. Escopo da primeira entrega

Ao abrir o perfil de um contato no atendimento WhatsApp, um operador autorizado poderá:
1. consultar se existe vínculo confirmado com cadastro do CRM;
2. visualizar resumo mínimo: nome comercial, estágio dos leads, referências e status dos últimos orçamentos;
3. abrir o CRM no registro correspondente, respeitando autenticação e autorização de ambos os sistemas.

A primeira entrega é **somente leitura**. Não cria leads, não muda orçamentos e não envia mensagens.

## 2. Limites de confiança e autorização

- Nunca chamar uma API administrativa do PocketBase diretamente do navegador.
- Nunca incorporar credenciais do PocketBase no frontend, em VITE_*, no GitHub ou no app WhatsApp.
- Gateway de integração em serviço privado: autentica a sessão do operador, valida organização, instância e permissões, aplica limitação de taxa e consulta o PocketBase com credenciais de escopo mínimo.
- O endpoint responde apenas aos campos necessários; sem nomes de usuário técnicos, segredos, tokens ou histórico integral.
- O login do WhatsApp não concede automaticamente permissões sobre o CRM. O gateway deve mapear os perfis autorizados de ambos os ambientes.
- Negar acesso por padrão se usuário, vínculo, escopo ou origem não forem comprovados.
- A lista de contatos e de negociações deverá ser limitada à organização permitida. O esquema atual do CRM possui regras amplas de autenticação; autorização por organização é um pré-requisito para dados compartilhados entre empresas.
- Logs somente com IDs técnicos, código de resultado, duração e ação; não registrar números completos, corpo de mensagens, tokens ou documentos.

## 3. Identidade e vínculos

O CRM usa IDs PocketBase e telefone textual. O WhatsApp usa UUIDs de contato, instância e identificadores de conversa/LID.

**Não associar registros apenas pelo texto do número sem verificação.** LID não é telefone. Números duplicados e compartilhados são possíveis.

Tabela de vínculos proposta (persistência no gateway ou banco isolado, NÃO executar DDL agora):

| Campo | Função |
| --- | --- |
| organization_id | Escopo da empresa |
| whatsapp_contact_id | UUID do contato WhatsApp |
| whatsapp_instance_id | UUID da instância de atendimento |
| pocketbase_contact_id | ID original no CRM |
| link_status | pending / verified / rejected |
| verified_by | Identificação do responsável pela confirmação |
| verified_at | Data da confirmação |
| created_at / updated_at | Auditoria |

Índice único para vínculos ativos por organização + contato WhatsApp + instância; não alterar nem substituir o ID do PocketBase. Resolução automática por telefone pode apenas **sugerir** candidatos, nunca vincular em silêncio.

## 4. Contrato REST proposto (somente leitura)

`GET /api/internal/crm/v1/contacts/{whatsappContactId}/summary?instanceId={uuid}`

Entrada:
- token de serviço ou sessão validada pelo gateway e vinculada ao operador autenticado;
- whatsappContactId e instanceId devem existir e pertencer ao escopo autorizado.

Resposta **200**, se vínculo confirmado:
```json
{
  "status": "linked",
  "crmContact": { "id": "pb_record_id", "name": "Cliente" },
  "leads": [{ "id": "pb_lead_id", "stage": "Proposta Enviada" }],
  "quotes": [{ "id": "pb_quote_id", "reference": "EXEMPLO", "status": "Enviado" }],
  "limits": { "leads": 10, "quotes": 10 }
}
```

Resposta **200** sem vínculo: `{"status":"unlinked","crmContact":null,"leads":[],"quotes":[]}`.
Resposta **409** para identidade ambígua (sem dados de candidatos não autorizados).
Resposta **401/403** para autenticação ou autorização insuficiente.
Resposta **429** para limitação de taxa.
Resposta **502/503** quando o backend CRM estiver indisponível. Nunca transformar indisponibilidade em "sem cadastro".

Não retornar valor de orçamento nem detalhes sensíveis até existir política de permissão definida. Ordenar propostas por data e limitar a dez por padrão; não consultar todas as mensagens.

## 5. Consistência, desempenho e segurança operacional

- Consulta sob demanda ao abrir o perfil; cache curto por operador/organização/contato (TTL sugerido de 30 a 60 s), se autorizado, sem polling.
- Timeout curto no gateway, respostas pequenas, paginação em listagens e limites de volume.
- Chaves de idempotência e filas com confirmação somente para futura fase de gravação, nunca na primeira fase.
- Não executar operações no Supabase ou PocketBase ao carregar este documento.
- Comunicação TLS, segredos somente no gerenciador de segredos, autorização de destino para prevenir SSRF.
- Respeitar minimização, finalidade, acesso e retenção segundo LGPD e a política da empresa.

## 6. Pré-requisitos e critérios para implementação

- [ ] Acesso de leitura administrativa ao PocketBase real do CRM e verificação das regras implantadas.
- [ ] Rotação de qualquer senha inicial ainda válida presente no histórico do repositório.
- [ ] Definir perfis/escopos e política para quem visualiza dados do CRM dentro do WhatsApp.
- [ ] Homologação do gateway em ambiente isolado; testar 401, 403, 409, 429 e indisponibilidade do CRM.
- [ ] Teste com contato sem vínculo, vínculo confirmado, duplicidade e LID sem telefone verificado.
- [ ] Confirmar ausência de transferências massivas ou alterações nos bancos de produção.
- [ ] Aprovação humana de implantação e plano de rollback.

## 7. Paginação no CRM

Foi introduzido `getQuotesPage()` em módulo separado, **sem ligação à interface atual**, para permitir testes de leitura paginada antes da migração da tela de Orçamentos.

**Não trocar `getQuotes('todos')` pelo resultado de uma página:** as abas, a busca, os follow-ups e o painel usam o conjunto completo e precisam de contagens agregadas e filtros no servidor. Antes de ativar:
- implementar contagem por status sem carregar registros integrais;
- preservar pesquisa global e ordenação;
- calcular total monetário com agregados autorizados, sem calcular sobre a página atual;
- confirmar comportamento de abas, exportação, edição e PDF;
- testar com múltiplas páginas e registros mudando de status durante a navegação.

A implementação atual continua sendo a fonte de verdade até completar a homologação funcional.
