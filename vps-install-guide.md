# WhatsFlow - Instalação VPS Ubuntu 22.04+

## 1. Preparar Servidor

### Conectar no servidor:
```bash
ssh root@SEU_IP_VPS
```

### Atualizar sistema:
```bash
apt update && apt upgrade -y
```

### Criar usuário não-root:
```bash
adduser whatsflow
usermod -aG sudo whatsflow
su - whatsflow
```

## 2. Instalar Node.js 18+

```bash
# Instalar Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar versão
node --version  # deve ser 18+
npm --version
```

## 3. Instalar PostgreSQL

```bash
# Instalar PostgreSQL 15
sudo apt install postgresql postgresql-contrib -y

# Configurar usuário e banco
sudo -u postgres psql
```

**No console PostgreSQL:**
```sql
CREATE USER whatsflow WITH PASSWORD 'senha_super_forte_123';
CREATE DATABASE whatsflow;
GRANT ALL PRIVILEGES ON DATABASE whatsflow TO whatsflow;
ALTER USER whatsflow CREATEDB;
\q
```

## 4. Instalar PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

## 5. Clonar e Configurar Projeto

```bash
# Clonar repositório
git clone https://github.com/SEU_USUARIO/whatsflow.git
cd whatsflow

# Instalar dependências
npm install

# Criar arquivo de ambiente
cp .env.example .env
nano .env
```

**Configurar .env:**
```env
# Database
DATABASE_URL=postgresql://whatsflow:senha_super_forte_123@localhost:5432/whatsflow

# Stripe (suas chaves reais)
STRIPE_SECRET_KEY=sk_live_SEU_STRIPE_SECRET
VITE_STRIPE_PUBLIC_KEY=pk_live_SEU_STRIPE_PUBLIC
STRIPE_BASIC_PRICE_ID=price_BASIC_ID
STRIPE_PRO_PRICE_ID=price_PRO_ID
STRIPE_ENTERPRISE_PRICE_ID=price_ENTERPRISE_ID

# Evolution API (sua configuração)
EVOLUTION_API_KEY=SUA_API_KEY
EVOLUTION_API_URL=https://sua-evolution-api.com

# Session (gerar chave aleatória de 64+ caracteres)
SESSION_SECRET=sua_chave_super_secreta_aleatoria_de_64_caracteres_minimo_aqui

# Environment
NODE_ENV=production
PORT=5000
```

## 6. Build e Migração

```bash
# Fazer build da aplicação
npm run build

# Executar migrações do banco
npm run migrate
```

## 7. Configurar PM2

```bash
# Iniciar aplicação com PM2
pm2 start npm --name "whatsflow" -- start

# Configurar para iniciar automaticamente
pm2 startup
pm2 save

# Verificar status
pm2 status
pm2 logs whatsflow
```

## 8. Instalar e Configurar Nginx

```bash
# Instalar Nginx
sudo apt install nginx -y

# Criar configuração
sudo nano /etc/nginx/sites-available/whatsflow
```

**Configuração Nginx:**
```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout       605;
        proxy_send_timeout          605;
        proxy_read_timeout          605;
        send_timeout                605;
        keepalive_timeout           605;
    }
}
```

**Ativar site:**
```bash
sudo ln -s /etc/nginx/sites-available/whatsflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 9. Configurar SSL com Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Configurar SSL
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Renovação automática
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

## 10. Configurar Firewall

```bash
# Configurar UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

## 11. Verificação Final

### Testar aplicação:
```bash
# Verificar se está rodando
curl http://localhost:5000

# Verificar logs
pm2 logs whatsflow

# Status dos serviços
sudo systemctl status postgresql
sudo systemctl status nginx
pm2 status
```

### Acessar aplicação:
- **HTTP**: `http://seudominio.com`
- **HTTPS**: `https://seudominio.com`

## 12. Comandos Úteis

### Gerenciar aplicação:
```bash
# Restart
pm2 restart whatsflow

# Parar
pm2 stop whatsflow

# Logs em tempo real
pm2 logs whatsflow --lines 100

# Monitoramento
pm2 monit
```

### Backup banco:
```bash
pg_dump -U whatsflow whatsflow > backup_$(date +%Y%m%d).sql
```

### Update aplicação:
```bash
cd /home/whatsflow/whatsflow
git pull origin main
npm install
npm run build
npm run migrate
pm2 restart whatsflow
```

## 13. Custos Estimados

- **VPS 2GB RAM**: US$ 5-10/mês (Hetzner, DigitalOcean)
- **Domínio**: US$ 12/ano
- **Total**: ~US$ 6-11/mês vs US$ 182 no Replit!

---

**Pronto!** Sua aplicação WhatsFlow estará rodando com máxima performance em VPS dedicada.