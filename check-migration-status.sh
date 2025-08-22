#!/bin/bash

# WhatsFlow - Script para verificar status da migração
# Verifica se a constraint foi aplicada corretamente

echo "🔍 Verificando status da migração de constraint..."

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script no diretório raiz da aplicação"
    exit 1
fi

echo ""
echo "📊 Verificando estrutura atual da tabela message_queue..."

# Verificar se instanceId é nullable
echo "1. Verificando se instanceId é nullable:"
sudo -u postgres psql -d whatsflow_db -c "\d message_queue" | grep instance_id

echo ""
echo "2. Verificando constraint ON DELETE:"
sudo -u postgres psql -d whatsflow_db -c "
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'message_queue'::regclass 
AND contype = 'f'
AND conname LIKE '%instance%';"

echo ""
echo "3. Testando se existem mensagens órfãs (instanceId NULL):"
sudo -u postgres psql -d whatsflow_db -c "
SELECT COUNT(*) as orphan_messages 
FROM message_queue 
WHERE instance_id IS NULL;"

echo ""
echo "4. Verificando se podemos excluir uma instância (simulação):"
echo "   (Procurando instâncias existentes...)"
sudo -u postgres psql -d whatsflow_db -c "
SELECT id, instance_id, client_id, name, status 
FROM whatsapp_instances 
LIMIT 3;"

echo ""
echo "✅ Verificação concluída!"
echo "📋 Interpretação dos resultados:"
echo "   - instanceId deve mostrar 'nullable' ou sem 'not null'"
echo "   - Constraint deve mostrar 'ON DELETE SET NULL'"
echo "   - Se houver mensagens órfãs, a migração funcionou"
echo "   - Instâncias listadas podem ser testadas para exclusão"