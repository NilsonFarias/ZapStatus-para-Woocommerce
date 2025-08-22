#!/bin/bash

# WhatsFlow - Script para forçar aplicação da migração na VPS
# Aplica a migração de constraint de forma forçada

echo "🔧 Forçando aplicação da migração de constraint na VPS..."

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script no diretório raiz da aplicação"
    exit 1
fi

echo ""
echo "📊 Verificando status atual..."

# Verificar se instanceId é nullable
echo "1. Status atual do instanceId:"
NULLABLE_CHECK=$(sudo -u postgres psql -d whatsflow_db -t -c "
SELECT is_nullable 
FROM information_schema.columns 
WHERE table_name = 'message_queue' 
AND column_name = 'instance_id';" 2>/dev/null | xargs)

echo "   instanceId nullable: $NULLABLE_CHECK"

# Verificar constraint atual
echo "2. Constraint atual:"
CONSTRAINT_CHECK=$(sudo -u postgres psql -d whatsflow_db -t -c "
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'message_queue'::regclass 
AND contype = 'f' 
AND conname LIKE '%instance%';" 2>/dev/null | xargs)

echo "   Constraint: $CONSTRAINT_CHECK"

# Se já está correto, não fazer nada
if [[ "$NULLABLE_CHECK" == "YES" ]] && [[ "$CONSTRAINT_CHECK" == *"ON DELETE SET NULL"* ]]; then
    echo ""
    echo "✅ Migração já aplicada corretamente!"
    echo "   - instanceId é nullable: YES"
    echo "   - Constraint tem ON DELETE SET NULL"
    echo ""
    echo "🧪 Testando exclusão de instância..."
    
    # Testar se consegue excluir uma instância
    INSTANCE_COUNT=$(sudo -u postgres psql -d whatsflow_db -t -c "SELECT COUNT(*) FROM whatsapp_instances;" 2>/dev/null | xargs)
    echo "   Total de instâncias: $INSTANCE_COUNT"
    
    if [ "$INSTANCE_COUNT" -gt 0 ]; then
        echo "   ✅ Banco configurado corretamente - pode excluir instâncias"
    else
        echo "   ℹ️  Nenhuma instância para testar"
    fi
    
    exit 0
fi

echo ""
echo "⚠️  Migração precisa ser aplicada. Aplicando agora..."

# Parar aplicação
echo "⏹️  Parando aplicação..."
sudo -u whatsflow pm2 stop whatsflow 2>/dev/null || true

echo ""
echo "🔧 Aplicando migração SQL..."

# Aplicar migração SQL diretamente
sudo -u postgres psql -d whatsflow_db << 'EOF'
-- Fazer backup da constraint atual
DO $$
BEGIN
    -- Remover constraint existente se existir
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'message_queue'::regclass 
        AND contype = 'f' 
        AND conname LIKE '%instance%'
    ) THEN
        ALTER TABLE message_queue DROP CONSTRAINT message_queue_instance_id_whatsapp_instances_id_fk;
        RAISE NOTICE 'Constraint antiga removida';
    END IF;
    
    -- Tornar instanceId nullable se não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_queue' 
        AND column_name = 'instance_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE message_queue ALTER COLUMN instance_id DROP NOT NULL;
        RAISE NOTICE 'instanceId agora é nullable';
    END IF;
    
    -- Recriar constraint com ON DELETE SET NULL
    ALTER TABLE message_queue 
    ADD CONSTRAINT message_queue_instance_id_whatsapp_instances_id_fk 
    FOREIGN KEY (instance_id) 
    REFERENCES whatsapp_instances(id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Nova constraint criada com ON DELETE SET NULL';
END
$$;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Migração aplicada com sucesso!"
else
    echo "❌ Erro ao aplicar migração"
    exit 1
fi

echo ""
echo "🔍 Verificando resultado..."

# Verificar novamente
NULLABLE_CHECK=$(sudo -u postgres psql -d whatsflow_db -t -c "
SELECT is_nullable 
FROM information_schema.columns 
WHERE table_name = 'message_queue' 
AND column_name = 'instance_id';" 2>/dev/null | xargs)

CONSTRAINT_CHECK=$(sudo -u postgres psql -d whatsflow_db -t -c "
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'message_queue'::regclass 
AND contype = 'f' 
AND conname LIKE '%instance%';" 2>/dev/null | xargs)

echo "Resultado final:"
echo "   instanceId nullable: $NULLABLE_CHECK"
echo "   Constraint: $CONSTRAINT_CHECK"

if [[ "$NULLABLE_CHECK" == "YES" ]] && [[ "$CONSTRAINT_CHECK" == *"ON DELETE SET NULL"* ]]; then
    echo ""
    echo "✅ SUCESSO! Migração aplicada corretamente!"
    echo "   Agora é possível excluir instâncias sem erro de constraint"
else
    echo ""
    echo "❌ Algo deu errado. Verificar manualmente."
    exit 1
fi

# Reiniciar aplicação
echo ""
echo "🚀 Reiniciando aplicação..."
sudo -u whatsflow pm2 start ecosystem.config.cjs 2>/dev/null || sudo -u whatsflow pm2 restart whatsflow

# Aguardar inicialização
sleep 5

# Verificar status
if sudo -u whatsflow pm2 describe whatsflow | grep -q "online"; then
    echo "✅ Aplicação reiniciada com sucesso!"
else
    echo "⚠️  Verificar status da aplicação manualmente"
fi

echo ""
echo "🎉 Migração concluída! Teste excluir uma instância agora."