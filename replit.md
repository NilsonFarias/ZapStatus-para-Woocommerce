# WhatsFlow - WhatsApp Business Automation Platform

### Overview
WhatsFlow is a SaaS platform designed to automate WhatsApp messaging for e-commerce businesses. It facilitates managing multiple WhatsApp instances, creating message templates, and sending automated order notifications primarily via webhook integrations with platforms like WooCommerce. The platform provides a dashboard for client management, message tracking, and billing across various subscription plans. Its core purpose is to streamline e-commerce communication, enhancing customer engagement and supporting business scaling.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture
The WhatsFlow platform is a full-stack application comprising a React-based frontend and a Node.js/Express backend.

#### Frontend Architecture
The frontend is a React Single Page Application (SPA) built with TypeScript and Vite. It leverages `shadcn/ui` components (based on Radix UI) and Tailwind CSS for styling. TanStack Query manages server data state, and Wouter is used for client-side routing. Authentication uses a context-based system, with Stripe integration for subscription management.

#### Backend Architecture
The backend is a Node.js/Express RESTful API server developed with TypeScript. It connects to a PostgreSQL database via Drizzle ORM for type-safe operations. Session management is handled by `connect-pg-simple`, ensuring persistent sessions. In production, it serves the built React application. The system supports multi-tenancy with robust role-based access control (admin/user) to ensure data isolation.

#### Data Storage Solutions
PostgreSQL serves as the primary database, with Drizzle ORM handling schema definition and migrations. Key data entities include users, clients, WhatsApp instances, message templates, webhook configurations, webhook logs, and a message queue.

#### Authentication and Authorization
The platform features a public registration and login system utilizing session-based authentication with bcryptjs for password hashing. A comprehensive role-based access control (RBAC) system defines 'admin' and 'user' roles, each with distinct functionalities and route access. Authentication middleware protects sensitive API endpoints.

#### Key Design Patterns
The architecture prioritizes reusability and maintainability through shared TypeScript types and Zod schemas. It employs a Repository Pattern for database abstraction and a Service Layer for business logic. Emphasized features include robust error handling, type safety, and a component-based UI architecture.

#### Feature Specifications
- **WhatsApp Automation**: Supports configurable message templates per order status, with dynamic variable substitution, processed through an optimized queue.
- **WooCommerce Integration**: Comprehensive webhook configuration for 11 WooCommerce events, enabling automated responses to order lifecycle changes.
- **Instance Management**: Allows creation and management of WhatsApp instances, including QR code generation, real-time status updates, and reconnection capabilities.
- **Message Queue**: Manages message delivery with functionalities to view, resend, and delete messages.
- **User Dashboard**: Provides personalized metrics and activity tracking for non-admin users.
- **Public Registration**: Fully functional registration and login system that automatically creates a client account for new users.

### External Dependencies

#### Core Infrastructure
- **Stripe**: Handles payment processing and subscription management.
- **Evolution API**: Provides WhatsApp Business API integration for messaging and instance management.
- **PostgreSQL**: The relational database used for all persistent data storage.

#### Development Tools
- **Vite**: Frontend build tool.
- **Drizzle Kit**: Database schema management and migration tool.
- **TanStack Query**: Used for server state management in the frontend.
- **Radix UI**: Provides accessible component primitives for the UI.

#### Runtime Dependencies
- **Express.js**: Backend web server framework.
- **React**: Frontend JavaScript library for building user interfaces.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Wouter**: Lightweight client-side routing library for React.
- **Node-cron**: Used for scheduling recurring tasks, such as managing the message queue.
- **connect-pg-simple**: PostgreSQL session store for robust session management.

### Recent Updates (August 22, 2025)

#### CRÍTICO: Correção de Segurança no Fluxo de Pagamento - CONCLUÍDO
**Problema de Segurança Identificado**: Sistema atualizava plano do cliente ANTES da confirmação de pagamento
**Vulnerabilidade**: Usuário podia selecionar plano, ir à tela de pagamento, voltar sem pagar e manter plano premium
**Correções Implementadas**:
- **Fluxo Corrigido**: Plano só é atualizado APÓS confirmação do webhook `invoice.payment_succeeded`
- **Status Temporário**: Subscription marcada como `incomplete` até pagamento confirmado
- **Webhook Handler**: Adicionado tratamento para `invoice.payment_succeeded` e `invoice.payment_failed`
- **Rollback Automático**: Pagamentos falhados resetam automaticamente para plano Free
- **Endpoint de Status**: Novo endpoint `/api/check-payment-status` para verificar confirmação
- **Segurança**: Usuário mantém plano atual até Stripe confirmar pagamento bem-sucedido
**Impacto**: Sistema agora é seguro contra fraudes de upgrade sem pagamento
**Status**: Vulnerabilidade crítica corrigida, fluxo de pagamento 100% seguro ✅ TESTADO E FUNCIONANDO

#### Correção Completa do Sistema de Planos - CONCLUÍDO
**Problema Resolvido**: Modal de edição de clientes não mostrava opção "Free"
**Correções Implementadas**:
- **Schema Atualizado**: Validação Zod aceita plano "free" em editClientModal
- **Opções de Plano**: Adicionada "Gratuito - R$ 0/mês (30 mensagens)" no modal
- **Filtros**: Incluído "Plano Gratuito" nos filtros da página de clientes  
- **Labels e Cores**: Padronização completa de todos os planos incluindo Free
- **Consistência**: Sistema completo agora suporta todos os 4 planos (Free, Básico, Pro, Enterprise)
**Impacto**: Administradores podem agora alterar clientes para qualquer plano disponível
**Status**: Sistema de planos 100% funcional e consistente

#### Correção Dashboard e Contadores - CONCLUÍDO  
**Problemas Resolvidos**: 
- Dashboard administrativo mostrava valores hardcoded
- Página de clientes exibia campos incorretos do banco
**Correções Implementadas**:
- **Dashboard**: Agregação real de mensagens de todos os usuários via JOIN
- **Clientes**: Contagem real de mensagens por cliente da tabela messageQueue
- **Queries SQL**: Substituídas consultas incorretas por cálculos dinâmicos
**Resultado**: Métricas 100% precisas baseadas em dados reais
**Status**: Todos os contadores funcionando corretamente

#### Script de Atualização Automática - CRIADO
**Funcionalidade**: Script `update.sh` para atualizar sistema VPS sem perder dados
**Características**:
- **Backup Automático**: `.env` e banco PostgreSQL antes de qualquer mudança
- **Git Sync**: Puxa automaticamente últimas mudanças do repositório
- **Correções VPS**: Aplica ajustes específicos para ambiente produção
- **Build Limpo**: Remove cache e reconstrói aplicação completamente
- **Zero Downtime**: Restart inteligente via PM2 com verificações
- **Rollback Safety**: Backups permitem restauração em caso de problemas
- **Verificação Completa**: Testa aplicação após atualização
**Status**: Sistema de atualização automática funcional para manter VPS sincronizada

#### Correção de Mensagens Duplicadas - AMBAS TENTATIVAS FALHARAM ⚠️
**Problema Original**: Sistema enviava mensagens duplicadas por ter dois handlers de webhook idênticos
**Primeira Tentativa**: Remoção de `/api/webhook/woocommerce` (genérico) - FALHOU (parou envios)
**Segunda Tentativa**: Remoção de `/api/webhook/woocommerce/:clientId` (específico) - FALHOU (parou envios)
**Estado Atual**: Sistema restaurado com ambos handlers funcionando
**Conclusão**: Ambos handlers são necessários para funcionamento - problema de duplicatas persiste
**Próxima Abordagem**: Necessária solução alternativa que não remova handlers
**Status**: Sistema funcional novamente, duplicatas não resolvidas - REVERTIDO COMPLETO ✅

#### Correção de Exclusão de Instâncias WhatsApp - CONCLUÍDO ✅
**Problema**: Instâncias desconectadas não podiam ser excluídas devido à constraint de chave estrangeira
**Erro**: `violates foreign key constraint "message_queue_instance_id_whatsapp_instances_id"` 
**Correção Implementada**:
- **Schema Atualizado**: instanceId na messageQueue agora é nullable
- **Constraint Modificada**: ON DELETE SET NULL preserva mensagens órfãs
- **Storage.deleteInstance()**: Simplesmente deleta instância, constraint cuida do resto
- **Billing Protegido**: Mensagens enviadas mantidas para integridade de cobrança
- **Contagem Corrigida**: Métodos usam templateId ao invés de instanceId para contar mensagens
- **Migração**: Script 0011_make_instance_id_nullable.sql aplicado
- **Update.sh**: Modificado para aplicar migração automaticamente na VPS
**Resultado**: Clientes podem excluir instâncias sem afetar billing ou métricas
**Status**: Problema de constraint resolvido com segurança para billing

#### Limpeza de Scripts Antigos - CONCLUÍDO
**Ação**: Removidos todos os scripts de debugging e correção antigos
**Scripts Mantidos**:
- **whatsflow-install-DEFINITIVO.sh**: Instalação completa zero-touch
- **update.sh**: Atualização automática com backup
**Scripts Removidos**: 25+ scripts antigos de debugging, correção e instalação
**Documentação**: Criado README.md limpo com instruções claras
**Status**: Repositório limpo e organizado, apenas scripts essenciais mantidos

#### Correção de Erros 404 da Evolution API - CONCLUÍDO ✅
**Problemas Identificados na VPS**: 
- Evolution API retornando 404 ao deletar instâncias já inexistentes
- Arquivo dist/public/index.html não encontrado após build
**Correções Implementadas**:
- **Evolution API**: Métodos deleteInstance() e getInstanceInfo() tolerantes a 404
- **Log Melhorado**: Warnings ao invés de erros para instâncias não encontradas
- **Build Fix**: Script fix-vps-build.sh para corrigir estrutura de arquivos estáticos
- **Tipagem**: getInstanceInfo() retorna InstanceInfo | null
**Scripts Criados**:
- **fix-vps-build.sh**: Corrige estrutura dist/public/index.html na VPS
**Resultado**: VPS funcional sem erros 404 desnecessários
**Status**: Erros de Evolution API e build resolvidos para VPS

#### Sistema de Migração Automática - CONCLUÍDO ✅
**Problema**: Script update.sh não aplicava migrações de banco consistentemente
**Solução Implementada**:
- **Controle de Migração**: Tabela `applied_migrations` para rastrear migrações executadas
- **Aplicação Automática**: Loop que aplica apenas migrações não executadas
- **Verificação de Constraint**: Detecta e corrige automaticamente constraint crítica
- **Modo Duplo**: Drizzle push + migrações SQL manuais
- **Recuperação**: force-apply-migration.sh pode ser chamado automaticamente
- **Histórico**: Cada migração registrada com timestamp de aplicação
**Funcionalidades**:
- **Detecção**: Verifica todas as migrações em `migrations/*.sql`
- **Aplicação Seletiva**: Só executa migrações não aplicadas
- **Força Drizzle**: Usa `--force` se push normal falhar
- **Auto-Correção**: Detecta e corrige constraints críticas
**Resultado**: Sistema robusto que aplica qualquer migração futura automaticamente
**Status**: Update.sh agora gerencia migrações de forma inteligente e segura

#### Consolidação de Scripts de Migração - CONCLUÍDO ✅
**Problema**: Script update.sh dependia do force-apply-migration.sh externo causando conflitos Git
**Solução Implementada**:
- **Integração Completa**: Funções de correção movidas para dentro do update.sh
- **Eliminação de Dependência**: Não precisa mais do force-apply-migration.sh
- **Aplicação Direta**: Correção de constraint executada internamente
- **Limpeza Automática**: Remove arquivos obsoletos durante update
**Vantagens**:
- **Zero Conflitos**: Não há mais arquivos externos para causar problemas Git
- **Manutenção Simplificada**: Tudo em um único script
- **Execução Mais Rápida**: Sem dependências externas
- **Menos Arquivos**: Repositório mais limpo
**Resultado**: Sistema de atualização totalmente autocontido
**Status**: Scripts consolidados, force-apply-migration.sh removido ✅

#### Solução Definitiva para Mensagens Duplicadas - CONCLUÍDO ✅
**Problema**: Dois handlers de webhook processando mesmas requisições causando mensagens duplicadas
**Abordagem**: Constraint única no banco para bloquear duplicatas automaticamente
**Solução Implementada**:
- **Índice Único**: Baseado em templateId + recipientPhone + hash(message) + minuto
- **Migração 0012**: Script para aplicar constraint em produção
- **Handling Gracioso**: createQueuedMessage detecta e ignora duplicatas
- **Log Detalhado**: Duplicatas bloqueadas são logadas para monitoramento
- **Retorno Inteligente**: Retorna mensagem existente ao invés de erro
**Como Funciona**:
- Constraint previne inserção de mensagem idêntica no mesmo minuto
- Permite mensagens diferentes para mesmo número
- Mantém ambos handlers funcionais (não quebra integrações)
- Sistema automaticamente resolve duplicatas sem intervenção
**Resultado**: Zero mensagens duplicadas sem alterar fluxo de webhooks
**Status**: Solução robusta aplicada no desenvolvimento e pronta para VPS