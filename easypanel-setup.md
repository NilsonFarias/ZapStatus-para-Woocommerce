# WhatsFlow - Deploy no Easypanel

## 1. Preparar o Repositório

### Fazer upload do código para GitHub:
```bash
git add .
git commit -m "Preparar deploy Easypanel"
git push origin main
```

## 2. Configurar no Easypanel

### 2.1. Criar Nova Aplicação
- Entre no Easypanel
- Clique em "Create" → "App"
- Nome: `whatsflow`
- Tipo: "App from Source"

### 2.2. Configurar Source
- Repository: `https://github.com/SEU_USUARIO/whatsflow`
- Branch: `main`
- Build Command: `npm run build`
- Start Command: `npm start`

### 2.3. Configurar Banco PostgreSQL
- No mesmo projeto, criar "Database"
- Tipo: PostgreSQL
- Nome: `whatsflow-db`
- Usuário: `whatsflow`
- Senha: `senha_segura_123`

## 3. Variáveis de Ambiente

### No painel da aplicação, adicionar:

```env
# Database (usar URL gerada pelo Easypanel)
DATABASE_URL=postgresql://whatsflow:senha_segura_123@whatsflow-db:5432/whatsflow

# Stripe (suas chaves reais)
STRIPE_SECRET_KEY=sk_live_SEU_STRIPE_SECRET
VITE_STRIPE_PUBLIC_KEY=pk_live_SEU_STRIPE_PUBLIC
STRIPE_BASIC_PRICE_ID=price_BASIC_ID
STRIPE_PRO_PRICE_ID=price_PRO_ID
STRIPE_ENTERPRISE_PRICE_ID=price_ENTERPRISE_ID

# Evolution API (sua configuração)
EVOLUTION_API_KEY=SUA_API_KEY
EVOLUTION_API_URL=https://sua-evolution-api.com

# Session (gerar chave aleatória forte)
SESSION_SECRET=sua_chave_super_secreta_aqui_64_caracteres_minimo

# Environment
NODE_ENV=production
```

## 4. Configurar Domínio

### No painel do Easypanel:
- Ir em "Domains"
- Adicionar domínio: `seusite.com`
- SSL será configurado automaticamente

## 5. Deploy

### Processo automático:
1. Easypanel detecta mudanças no GitHub
2. Builda aplicação automaticamente
3. Cria containers Docker
4. Configura rede entre app e banco
5. Ativa SSL

## 6. Pós-Deploy

### Executar migrações do banco:
```bash
# No terminal do container (via Easypanel)
npm run migrate
```

### Verificar saúde da aplicação:
- Acessar: `https://seusite.com`
- Teste login/cadastro
- Verificar conexão Evolution API

## 7. Custos Estimados

- **VPS 2GB RAM**: US$ 8-12/mês
- **Domínio**: US$ 12/ano
- **Total**: ~US$ 10/mês vs US$ 182 no Replit!

## 8. Backup & Monitoramento

### Backup automático (Easypanel):
- Banco PostgreSQL: backup diário
- Código: versionado no Git
- Logs: disponíveis no painel

### Monitoramento incluído:
- CPU, RAM, Disk usage
- Uptime monitoring
- SSL certificate renewal

---

**Pronto!** Sua aplicação WhatsFlow estará rodando de forma estável e econômica no Easypanel.