-- Migração para prevenir mensagens duplicadas
-- Adiciona constraint UNIQUE baseada em características que identificam uma mensagem única

-- Criar índice único composto para prevenir duplicatas
-- Baseado em: templateId + recipientPhone + message hash + timestamp (arredondado para minuto)
-- Isso permite que mensagens diferentes sejam enviadas para o mesmo número,
-- mas previne duplicatas exatas no mesmo minuto

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_message_constraint 
ON message_queue (
    template_id,
    recipient_phone,
    MD5(message),
    DATE_TRUNC('minute', created_at)
) 
WHERE status IN ('sent', 'pending', 'processing');

-- Comentário explicativo
COMMENT ON INDEX unique_message_constraint IS 'Previne mensagens duplicadas baseadas em template, telefone, hash da mensagem e minuto de criação';