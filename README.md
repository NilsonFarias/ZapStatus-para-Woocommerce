# WhatsFlow - WhatsApp Business Automation Platform

## 🚀 Instalação e Atualização

### 📋 Scripts Disponíveis

#### 1. **Instalação Completa** - `whatsflow-install-DEFINITIVO.sh`
Script principal para instalação zero-touch em VPS Ubuntu/Debian.

**Funcionalidades:**
- ✅ Instalação Node.js 20 + PM2 + PostgreSQL
- ✅ Configuração SSL automática com Let's Encrypt
- ✅ Setup completo do banco de dados e usuário
- ✅ Build e deploy da aplicação
- ✅ Configuração Nginx proxy reverso
- ✅ Todas as correções VPS aplicadas automaticamente

**Como usar:**
```bash
wget https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/whatsflow-install-DEFINITIVO.sh
chmod +x whatsflow-install-DEFINITIVO.sh
bash whatsflow-install-DEFINITIVO.sh
```

**Solicita interativamente:**
- Domínio para acesso (ex: whatsapp.meusite.com.br)
- Email para certificado SSL

---

#### 2. **Atualização do Sistema** - `update.sh`
Script para atualizar aplicação sem perder dados.

**Funcionalidades:**
- 🛡️ Backup automático de .env e banco PostgreSQL
- ⬇️ Sincronização com última versão do GitHub
- 🔧 Correções VPS automáticas
- 🏗️ Rebuild limpo da aplicação
- 🔄 Restart zero-downtime via PM2
- ✅ Verificações de integridade pós-atualização

**Como usar:**
```bash
cd /home/whatsflow/ZapStatus-para-Woocommerce
sudo bash update.sh
```

---

### 🔄 Workflow de Desenvolvimento

1. **Desenvolver**: Programar e testar no Replit
2. **Versionar**: `git commit` + `git push` das mudanças
3. **Atualizar VPS**: Executar `sudo bash update.sh`
4. **Produção**: Sistema atualizado automaticamente

---

### 🔧 Configuração Pós-Instalação

**1. Login Admin:**
- URL: `https://seu-dominio.com`
- Email: `admin@whatsflow.com`
- Senha: `admin123`

**2. Configurar Evolution API:**
- Admin Panel → API Configuration
- Inserir URL e API Key do servidor Evolution
- Testar conexão

**3. Configurar Stripe (opcional):**
- Adicionar chaves Stripe no arquivo `.env`
- Reiniciar aplicação: `sudo -u whatsflow pm2 restart whatsflow`

---

### 📊 Monitoramento

**Verificar status:**
```bash
sudo -u whatsflow pm2 status
sudo -u whatsflow pm2 logs whatsflow
```

**Verificar aplicação:**
```bash
curl -I https://seu-dominio.com
```

---

### 🆘 Suporte

Em caso de problemas:
1. Verificar logs: `sudo -u whatsflow pm2 logs whatsflow`
2. Restaurar backup: `cp backups/.env_backup_* .env`
3. Reiniciar: `sudo -u whatsflow pm2 restart whatsflow`

---

**Sistema testado em:** Ubuntu 20.04/22.04 e Debian 11/12
**Requisitos:** VPS com pelo menos 1GB RAM e domínio configurado