const fs = require('fs');

// Ler arquivo original
let content = fs.readFileSync('server/routes.ts', 'utf8');

// 1. Adicionar import se não existir
if (!content.includes('connect-pg-simple')) {
    content = content.replace(
        'import session from "express-session";',
        'import session from "express-session";\nimport connectPgSimple from "connect-pg-simple";'
    );
}

// 2. Remover duplicações existentes primeiro
content = content.replace(/const PgSession = connectPgSimple\(session\);[\s\S]*?}\);/g, '');
content = content.replace(/const sessionStore = new PgSession\(\{[\s\S]*?\n\s*\}\);/g, '');

// 3. Adicionar configuração de store PostgreSQL antes de app.use(session
const storeConfig = `  // Session store configuration for production
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: 'sessions',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

`;

// Inserir store config antes de app.use(session
if (!content.includes('sessionStore')) {
    content = content.replace(
        /(\s+)\/\/ Session middleware/,
        '\n' + storeConfig + '$1// Session middleware'
    );
}

// 4. Substituir configuração de sessão completa
const sessionConfigRegex = /app\.use\(session\(\{[\s\S]*?\}\)\);/;
const newSessionConfig = `app.use(session({
    secret: process.env.SESSION_SECRET || 'whatsflow-secret-key-dev',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
  }));`;

content = content.replace(sessionConfigRegex, newSessionConfig);

// 5. Corrigir login para usar req.session.save()
const loginSaveRegex = /req\.session\.userId = user\.id;\s*[\s\S]*?res\.json\(userWithoutPassword\);/;
const newLoginSave = `req.session.userId = user.id;
      
      // Force session save before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Erro ao criar sessão" });
        }
        
        console.log(\`Login successful: Session created for user \${user.id}\`);
        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });`;

content = content.replace(loginSaveRegex, newLoginSave);

// Salvar arquivo modificado
fs.writeFileSync('server/routes.ts', content);
console.log('✅ Session fixes applied successfully!');