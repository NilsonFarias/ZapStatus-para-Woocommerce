#!/bin/bash

# WhatsFlow - Script para corrigir estrutura de build na VPS
# Corrige problemas de caminho do dist/public/index.html

echo "🔧 Corrigindo estrutura de build do WhatsFlow..."

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script no diretório raiz da aplicação"
    exit 1
fi

# Parar aplicação
echo "⏹️ Parando aplicação..."
sudo -u whatsflow pm2 stop whatsflow || true

# Limpar build anterior
echo "🧹 Limpando builds anteriores..."
rm -rf dist/ .vite/ node_modules/.cache/ 2>/dev/null || true

# Rebuild completo
echo "🔨 Reconstruindo aplicação..."
npm run build

# Verificar se build foi criado
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build falhou - dist/index.js não foi criado"
    exit 1
fi

# Corrigir estrutura de arquivos estáticos
echo "📁 Corrigindo estrutura de arquivos estáticos..."

# Criar diretório public dentro de dist se não existir
mkdir -p dist/public

# Se index.html está em dist/, mover para dist/public/
if [ -f "dist/index.html" ] && [ ! -f "dist/public/index.html" ]; then
    echo "📄 Movendo index.html para dist/public/"
    mv dist/index.html dist/public/
fi

# Copiar todos os assets estáticos para dist/public se existirem
if [ -d "dist/assets" ] && [ ! -d "dist/public/assets" ]; then
    echo "📦 Movendo assets para dist/public/"
    mv dist/assets dist/public/
fi

# Verificar se index.html está no lugar correto
if [ ! -f "dist/public/index.html" ]; then
    echo "❌ index.html não encontrado em dist/public/"
    echo "Estrutura atual do dist/:"
    find dist/ -type f -name "*.html" 2>/dev/null || echo "Nenhum arquivo HTML encontrado"
    exit 1
fi

echo "✅ Estrutura corrigida:"
echo "  - dist/index.js (servidor)"
echo "  - dist/public/index.html (frontend)"
echo "  - dist/public/assets/ (assets estáticos)"

# Reiniciar aplicação
echo "🚀 Reiniciando aplicação..."
sudo -u whatsflow pm2 start ecosystem.config.cjs

# Aguardar inicialização
sleep 5

# Verificar status
if sudo -u whatsflow pm2 describe whatsflow | grep -q "online"; then
    echo "✅ Aplicação reiniciada com sucesso!"
    echo "🌐 Teste acessando: http://sua-vps:3000"
else
    echo "❌ Problema ao reiniciar - verificar logs:"
    sudo -u whatsflow pm2 logs whatsflow --lines 10
fi