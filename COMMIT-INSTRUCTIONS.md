# 📝 Como Fazer Commit dos Scripts de Instalação

## Scripts Criados (Prontos para Commit)
- ✅ `install.sh` - Script principal de instalação completa
- ✅ `quick-install.sh` - One-liner para instalação rápida  
- ✅ `update.sh` - Script de atualização automatizada
- ✅ `README-INSTALLATION.md` - Documentação completa

## Como Fazer o Commit

### 1. Via Terminal Replit
```bash
# Adicionar arquivos
git add install.sh quick-install.sh update.sh README-INSTALLATION.md COMMIT-INSTRUCTIONS.md

# Fazer commit
git commit -m "feat: adicionar scripts de instalação automatizada

- Script install.sh com instalação completa multi-OS (Ubuntu/Debian/CentOS)
- Suporte ARM64 e x86_64
- Configuração automática: PostgreSQL, Nginx, SSL, PM2
- Script quick-install.sh para instalação one-liner
- Script update.sh para atualizações com backup
- Documentação completa em README-INSTALLATION.md"

# Enviar para GitHub
git push origin main
```

### 2. Via Interface GitHub (Alternativa)
1. Acesse: https://github.com/NilsonFarias/ZapStatus-para-Woocommerce
2. Clique em "Upload files"
3. Arraste os arquivos: `install.sh`, `quick-install.sh`, `update.sh`, `README-INSTALLATION.md`
4. Commit message: "feat: scripts instalação automatizada"
5. Commit changes

## Após o Commit

### Comandos Funcionarão:
```bash
# Instalação completa one-liner
curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/quick-install.sh | bash

# Instalação manual
wget https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/install.sh
chmod +x install.sh
./install.sh --full

# Atualização
wget https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/update.sh
chmod +x update.sh
./update.sh --full
```

### Teste Local (Enquanto não fez commit)
```bash
# Testar script local
chmod +x install.sh
./install.sh --help

# Verificar sintaxe
bash -n install.sh
bash -n quick-install.sh  
bash -n update.sh
```

## Status dos Arquivos
- 🔴 **Não commitados ainda** - Por isso o erro 404
- ✅ **Criados e testados** localmente
- ⚡ **Prontos para uso** após commit

## Próximos Passos
1. Execute os comandos git acima
2. Verifique se apareceram no GitHub
3. Teste o comando one-liner
4. Scripts estarão funcionais para todos os usuários

---
**Importante**: Após fazer o commit, aguarde 1-2 minutos para os arquivos ficarem disponíveis via raw.githubusercontent.com