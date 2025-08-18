# WhatsFlow - Guia de Instalação Automatizada


⚠️ **ATENÇÃO**. 

Preparar Servidor
Conectar no servidor:
ssh root@SEU_IP_VPS

Atualizar sistema:
apt update && apt upgrade -y

Criar usuário não-root:

adduser whatsflow
usermod -aG sudo whatsflow
su - whatsflow



## 🚀 Instalação Rápida (Recomendado)

### Opção 1: Script Simplificado (Recomendado)
```bash
# Execute como root - mais estável
curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/install-simple.sh | bash -s -- --full
```

### Opção 2: Script Completo
```bash
# Execute como root ou usuário com sudo
curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/quick-install.sh | bash
```

### Instalação Manual
```bash
# Opção A: Script Simplificado (Recomendado)
wget https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/install-simple.sh
chmod +x install-simple.sh
./install-simple.sh --full

# Opção B: Script Completo
wget https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/install.sh
chmod +x install.sh
./install.sh --full
```

**Como Funciona:**
- ✅ Se executar como **root**: cria usuário `whatsflow` automaticamente e continua
- ✅ Se executar como **usuário com sudo**: procede diretamente
- ❌ Se usuário não tem sudo: exibe instruções para corrigir

## 📋 Pré-requisitos

### Preparação do Servidor
**Opção 1: Execute como root (Recomendado)**
```bash
# O script criará automaticamente o usuário 'whatsflow' 
# e continuará a instalação sem parar
ssh root@seu-servidor
```

**Opção 2: Crie usuário dedicado manualmente**
```bash
# Ubuntu/Debian:
adduser whatsflow
usermod -aG sudo whatsflow
su - whatsflow

# CentOS/RHEL:
useradd -m -s /bin/bash whatsflow
usermod -aG wheel whatsflow
passwd whatsflow
su - whatsflow
```

### Sistemas Suportados
- ✅ Ubuntu 20.04+ (x86_64 / ARM64)
- ✅ Debian 11+ (x86_64 / ARM64)  
- ✅ CentOS 8+ (x86_64 / ARM64)
- ✅ RHEL 8+ (x86_64 / ARM64)

### Recursos Mínimos
- **CPU**: 1 vCPU (2+ recomendado)
- **RAM**: 1GB (2GB+ recomendado)
- **Disk**: 10GB SSD
- **Network**: 100Mbps

### Portas Necessárias
- **80**: HTTP (Nginx)
- **443**: HTTPS (SSL)
- **22**: SSH
- **5432**: PostgreSQL (interno)
- **5000**: Node.js (interno)

## 🛠️ O Que o Script Instala

### Dependências do Sistema
- Node.js 18+ (com suporte ARM64)
- PostgreSQL 15+
- Nginx (proxy reverso)
- PM2 (gerenciador de processos)
- Certbot (SSL automático)
- UFW/Firewalld (firewall)

### Configurações Automáticas
- Usuário e banco PostgreSQL
- Proxy reverso Nginx otimizado
- SSL/TLS com Let's Encrypt
- Firewall com regras seguras
- PM2 com auto-restart
- Renovação automática de certificados

## 📝 Configuração Necessária

### Durante a Instalação
O script solicitará apenas:

1. **Senha PostgreSQL**: Para usuário `whatsflow`  
2. **Branch**: Padrão `main` (apenas pressione Enter)

**Instalação Automática**: Se executar como root, o script criará automaticamente o usuário `whatsflow` e continuará a instalação sem interrupção.

### Após a Instalação
**Todas as configurações são feitas pela interface admin:**

1. Acesse: `http://seu-servidor:5000`
2. Login: `admin` / `admin123`
3. Vá em **Configurações** → **Configuração API** 
4. Configure:
   - Stripe (chaves e preços)
   - Evolution API (URL e chave)
   - Domínio do sistema

**Não é necessário editar arquivos manualmente!**

## 🔄 Atualização Automatizada

### Script de Atualização
```bash
# Baixar script de atualização
wget https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/update.sh
chmod +x update.sh

# Atualização completa
./update.sh --full

# Apenas código
./update.sh --code-only

# Interativo (menu)
./update.sh
```

### Recursos da Atualização
- ✅ Backup automático (código + banco)
- ✅ Zero downtime (PM2)
- ✅ Rollback em caso de erro
- ✅ Verificação de saúde
- ✅ Sistema inicia automaticamente

## 🏗️ Instalação Modular

### Apenas Dependências
```bash
./install.sh
# Escolher opção 2
```

### Apenas Aplicação
```bash
./install.sh
# Escolher opção 3
```

### Apenas Servidor Web
```bash
./install.sh
# Escolher opção 4
```

## 🌍 Provedores VPS Recomendados

### ARM64 (Melhor Custo-Benefício)
| Provedor | Configuração | Preço/mês | Performance |
|----------|-------------|-----------|-------------|
| **Hetzner CAX** | 2vCPU, 4GB ARM64 | €4.90 | ⭐⭐⭐⭐⭐ |
| Oracle Cloud | 4vCPU, 24GB ARM64 | **Gratuito** | ⭐⭐⭐⭐ |
| DigitalOcean | 2vCPU, 2GB ARM64 | $18/mês | ⭐⭐⭐⭐ |

### x86_64 (Compatibilidade Total)
| Provedor | Configuração | Preço/mês | Performance |
|----------|-------------|-----------|-------------|
| **Hetzner CX** | 2vCPU, 4GB x86_64 | €5.83 | ⭐⭐⭐⭐⭐ |
| Vultr | 2vCPU, 4GB x86_64 | $12/mês | ⭐⭐⭐⭐ |
| Linode | 2vCPU, 4GB x86_64 | $20/mês | ⭐⭐⭐⭐ |

## 🐛 Solução de Problemas

### Verificar Status
```bash
# Status geral
systemctl status postgresql nginx
pm2 status

# Logs da aplicação
pm2 logs whatsflow

# Teste de conectividade
curl http://localhost:5000/api/health
```

### Problemas Comuns

#### PostgreSQL não inicia
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# CentOS/RHEL
sudo postgresql-setup --initdb
sudo systemctl start postgresql
```

#### Nginx erro de configuração
```bash
# Testar configuração
sudo nginx -t

# Recarregar
sudo systemctl reload nginx
```

#### PM2 não encontrado
```bash
# Reinstalar PM2
sudo npm install -g pm2

# Reconfigurar
pm2 startup
pm2 save
```

#### Porta 5000 ocupada
```bash
# Verificar o que está usando
sudo lsof -i :5000

# Matar processo
sudo pkill -f "node.*5000"
```

## 📊 Monitoramento

### Comandos Úteis
```bash
# Monitor PM2 em tempo real
pm2 monit

# Status detalhado
pm2 show whatsflow

# Logs em tempo real
pm2 logs whatsflow --lines 100

# Reiniciar aplicação
pm2 restart whatsflow

# Recarregar (zero downtime)
pm2 reload whatsflow
```

### Health Check
```bash
# Testar API
curl -I http://localhost:5000/api/health

# Testar domínio
curl -I https://seudominio.com/api/health

# Verificar SSL
openssl s_client -connect seudominio.com:443 -servername seudominio.com
```

## 🔒 Segurança

### Hardening Automático
- ✅ Firewall configurado (apenas portas necessárias)
- ✅ Headers de segurança (Nginx)
- ✅ SSL/TLS obrigatório
- ✅ Usuário não-root para aplicação
- ✅ Rate limiting (Evolution API)

### Recomendações Adicionais
```bash
# Fail2ban para SSH
sudo apt install fail2ban

# Desabilitar root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Atualizar sistema regularmente
sudo apt update && sudo apt upgrade
```

## 📞 Suporte

### Logs de Instalação
Durante a instalação, todos os logs são salvos em:
- `/tmp/whatsflow-install.log`
- `~/.pm2/logs/`

### Backup Automático
O script de atualização cria backups em:
- `../whatsflow-backup-YYYYMMDD-HHMMSS/`

### Contato
Para suporte técnico:
- 📧 Email: suporte@whatsflow.com
- 💬 Discord: [WhatsFlow Community]
- 📚 Docs: [docs.whatsflow.com]

---

**🎉 Pronto!** Sua instalação WhatsFlow está completa e otimizada para produção!