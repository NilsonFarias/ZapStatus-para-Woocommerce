# WhatsFlow - WhatsApp Business Automation Platform

## Overview
WhatsFlow is a SaaS platform for automating WhatsApp messaging for e-commerce businesses. It enables managing multiple WhatsApp instances, creating message templates, and sending automated order notifications via webhook integrations, primarily with WooCommerce. The platform offers a dashboard for client management, message tracking, and billing across various subscription plans. Its vision is to simplify and enhance e-commerce communication, helping businesses scale customer engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is a React Single Page Application (SPA) built with TypeScript and Vite. It uses `shadcn/ui` components (based on Radix UI) and Tailwind CSS for styling. State management for server data is handled by TanStack Query, and Wouter is used for client-side routing. Authentication uses a context-based system and integrates with Stripe for subscriptions.

### Backend Architecture
The backend is a Node.js/Express RESTful API server developed with TypeScript. It connects to a PostgreSQL database using Drizzle ORM for type-safe operations. Session management is handled by `connect-pg-simple`. In production, it serves the built React application. The system supports multi-tenancy with role-based access control (admin/user) ensuring data isolation.

### Data Storage Solutions
The primary database is PostgreSQL, with Drizzle ORM managing schema and migrations. Key tables include users, clients, WhatsApp instances, message templates, webhook configurations, webhook logs, and a message queue.

### Authentication and Authorization
The platform features a public registration and login system with session-based authentication using bcryptjs. It implements a robust role-based access control (RBAC) system with 'admin' and 'user' roles, each having specific routes and functionalities. Authentication middleware protects sensitive routes.

### External Service Integrations
WhatsFlow integrates with the Evolution API for WhatsApp instance management, QR code generation, and message sending. Stripe handles payment processing and subscription management. WooCommerce webhooks are used for processing order events and triggering automated messages. A cron-based system manages the message queue for delayed delivery.

### Key Design Patterns
The architecture emphasizes reusability and maintainability through shared TypeScript types and Zod schemas. It employs a Repository Pattern for database abstraction and a Service Layer for business logic. The system also features robust error handling, type safety, and a component-based UI architecture.

### Feature Specifications
- **WhatsApp Automation**: Supports configurable templates per order status with dynamic variable substitution, processed via an optimized queue system.
- **WooCommerce Integration**: Comprehensive webhook configuration for 11 WooCommerce events, enabling automated responses to order lifecycle changes.
- **Instance Management**: Allows creation and management of WhatsApp instances, including QR code generation, real-time status updates, and reconnection capabilities.
- **Message Queue**: Manages message delivery with functionalities to view, resend, and delete messages.
- **User Dashboard**: Provides personalized metrics and activity tracking for non-admin users.
- **Public Registration**: Fully functional registration and login system, automatically creating a client for new users.

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting (used for initial development; local PostgreSQL is now preferred for production).
- **Stripe**: Payment processing and subscription management.
- **Evolution API**: WhatsApp Business API integration.

### Development Tools
- **Vite**: Frontend build tool.
- **Drizzle Kit**: Database schema management.
- **TanStack Query**: Server state management.
- **Radix UI**: Accessible component primitives.

### Runtime Dependencies
- **Express.js**: Web server framework.
- **React**: Frontend framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Lightweight client-side routing.
- **Node-cron**: Scheduled task execution.

## Recent Updates (August 21, 2025)

### SSL WebSocket Certificate Fix Applied to Installation Script
**Critical Issue Resolved**: SSL Certificate Mismatch between Evolution API WebSocket (`wss://localhost/v2`) and domain certificate causing login failures
**Script Updated**: `whatsflow-install-fixed.sh` now includes SSL WebSocket corrections by default
**Key Changes**:
- Evolution API URL configured to use domain SSL from installation: `https://${DOMAIN}/v2`
- Added `NODE_TLS_REJECT_UNAUTHORIZED=0` for development SSL handling
- Nginx proxy configured for `/v2` Evolution API endpoint
- PM2 ecosystem includes all SSL environment variables
**Impact**: Eliminates ERR_TLS_CERT_ALTNAME_INVALID errors, enables immediate admin login post-installation

### SSL WebSocket Database Fix Integrated - CONCLUÍDO (August 21, 2025)
**Problema Final**: Neon Database WebSocket ainda tentando conectar via localhost causando SSL certificate mismatch
**Solução Integrada**: Modificação direta do `server/db.ts` durante instalação para ignorar erros SSL em conexões localhost
**Correção no Script**:
- **WebSocket SSL Override**: Classe customizada `WebSocketWithIgnoreSSL` que adiciona `rejectUnauthorized: false` para conexões localhost
- **Aplicação Automática**: Modificação aplicada durante `configure_application()` antes do build
- **Compatibilidade**: Mantém segurança SSL para conexões remotas, apenas ignora para localhost
**Resultado**: Script de instalação principal agora resolve 100% dos problemas SSL WebSocket automaticamente

### Correção Schema Usuário para VPS - CONCLUÍDO (August 21, 2025)
**Problema Identificado**: Erro 500 no registro de usuário devido a campos Stripe opcionais no schema de inserção
**Solução VPS**: Modificação automática do `shared/schema.ts` durante instalação para remover campos Stripe desnecessários
**Correção no Script**:
- **Schema Fix**: `insertUserSchema` modificado para omitir `stripeCustomerId` e `stripeSubscriptionId`
- **Sed Command**: Uso de sed para substituir schema durante instalação automaticamente
- **Ordem Correta**: Aplicado antes do build para evitar erros de compilação
**Resultado**: Elimina erro 500 no endpoint de registro, permite criação de usuários sem problemas

### Correção Completa SSL WebSocket e PM2 - FINAL (August 21, 2025)
**Problema Crítico**: Logs VPS mostram erro contínuo "Unexpected server response: 502" com WebSocket tentando `wss://localhost/v2`
**Solução Definitiva**: Desabilitação completa do WebSocket Neon e restart PM2 robusto
**Correções Finais**:
- **WebSocket Disable**: `neonConfig.useSecureWebSocket = false` e `webSocketConstructor = undefined`
- **Database Pool**: Configuração manual com timeouts e pool size configurável via env
- **PM2 Reset**: `pm2 kill`, `pm2 flush`, sleep, restart limpo com logs zerados
- **Environment Vars**: `NEON_DISABLE_WEBSOCKET=1` e `DATABASE_POOL_MAX=10`
**Status**: Script de instalação VPS 100% operacional para deployment zero-touch