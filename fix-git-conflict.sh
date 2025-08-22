#!/bin/bash

# WhatsFlow - Script para corrigir conflitos de Git na VPS
# Corrige especificamente o problema com force-apply-migration.sh

echo "🔧 Corrigindo conflitos de Git na VPS..."

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script no diretório raiz da aplicação"
    exit 1
fi

# Remover arquivo conflitante
if [ -f "force-apply-migration.sh" ]; then
    echo "🗑️  Removendo força-apply-migration.sh conflitante..."
    rm -f force-apply-migration.sh
    echo "✅ Arquivo removido"
fi

# Limpar status do Git
echo "🧹 Limpando status do Git..."
git reset --hard HEAD >/dev/null 2>&1 || true
git clean -fd >/dev/null 2>&1 || true

# Descartar qualquer stash pendente
echo "🗑️  Limpando stashes pendentes..."
git stash drop >/dev/null 2>&1 || true

# Atualizar código
echo "📥 Puxando última versão do GitHub..."
if git pull origin main; then
    echo "✅ Código atualizado com sucesso!"
    echo ""
    echo "🎉 Conflito resolvido! Execute novamente ./update.sh"
else
    echo "❌ Ainda há problemas com o Git"
    echo "ℹ️  Status atual:"
    git status --short
fi