
## 5 Formas de Verificar se o Webhook está Funcionando:

### 1. Teste Interno (Botão na Interface)
- Clique no botão 'Testar Webhook' na interface
- Verifique se aparece 'Webhook teste enviado com sucesso'
- Veja se aparece um log com evento 'test.webhook'

### 2. Teste via Linha de Comando
curl -X POST https://c737058c-1d7a-400d-b9a5-fffce39cea32-00-1tblbex3jars3.worf.replit.dev/api/webhook/woocommerce \
  -H 'Content-Type: application/json' \
  -H 'x-client-id: demo-client-id' \
  -d '{"event": "order.created", "data": {"order_id": "12345"}}'

### 3. No WooCommerce Real
- Vá em: WooCommerce → Configurações → Avançado → Webhooks
- Crie um novo webhook com sua URL
- Use o botão 'Testar' do próprio WooCommerce
- Faça um pedido teste na loja

### 4. Monitoramento de Logs
- Abra a página de Webhooks do sistema
- Deixe aberta enquanto faz testes
- Os logs aparecem automaticamente em tempo real

### 5. Verificação de Resposta
- Webhook funcionando: retorna {"success": true}
- Erro: retorna código de erro e mensagem

