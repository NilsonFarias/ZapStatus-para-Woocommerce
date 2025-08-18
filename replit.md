# WhatsFlow - WhatsApp Business Automation Platform

## Overview
WhatsFlow is a SaaS platform designed to automate WhatsApp messaging for e-commerce businesses. It allows clients to manage multiple WhatsApp instances, create message templates, and automatically send order notifications via webhook integrations, primarily with WooCommerce. The platform provides a comprehensive dashboard for client management, message tracking, and billing across various subscription plans. Its vision is to simplify and enhance e-commerce communication, enabling businesses to scale their customer engagement effectively.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is a React Single Page Application (SPA) built with TypeScript and Vite. It utilizes `shadcn/ui` components based on Radix UI primitives and styled with Tailwind CSS. State management for server data is handled by TanStack Query, and Wouter is used for client-side routing. Authentication uses a context-based system, integrating with Stripe for subscription management.

### Backend Architecture
The backend is a Node.js/Express RESTful API server developed with TypeScript. It connects to a PostgreSQL database using Drizzle ORM for type-safe operations. Session management is handled by `connect-pg-simple`. For production, it serves the built React application. The system supports multi-tenancy with role-based access control (admin/user) ensuring data isolation per client.

### Data Storage Solutions
The primary database is PostgreSQL, hosted on Neon Database for serverless capabilities and connection pooling. Drizzle ORM manages the schema and migrations, defined in `shared/schema.ts`. Key tables include users, clients, WhatsApp instances, message templates, webhook configurations, webhook logs, and a message queue.

### Authentication and Authorization
The platform features a public registration and login system with session-based authentication using bcryptjs. It implements a robust role-based access control (RBAC) system with 'admin' and 'user' roles, each having specific routes and functionalities. Authentication middleware protects sensitive routes, and a client is automatically created upon user registration.

### External Service Integrations
WhatsFlow integrates with the Evolution API for WhatsApp instance management, QR code generation, and message sending. Stripe handles payment processing and subscription management. WooCommerce webhooks are used for processing order events and triggering automated messages. A cron-based system manages the message queue for delayed delivery.

### Key Design Patterns
The architecture emphasizes reusability and maintainability through shared TypeScript types and Zod schemas. It employs a Repository Pattern for database abstraction and a Service Layer for business logic, particularly for Evolution API and message queue processing. The system also features robust error handling, type safety, and a component-based UI architecture.

### Feature Specifications
- **WhatsApp Automation**: Supports configurable templates per order status with dynamic variable substitution. Messages are processed through an optimized queue system.
- **WooCommerce Integration**: Comprehensive webhook configuration for 11 WooCommerce events, enabling automated responses to order lifecycle changes.
- **Instance Management**: Allows creation and management of WhatsApp instances, including QR code generation, real-time status updates, and reconnection capabilities. A simplified business model enforces one instance per client.
- **Message Queue**: Manages message delivery with functionalities to view, resend, and delete messages.
- **User Dashboard**: Provides personalized metrics and activity tracking for non-admin users.
- **Public Registration**: Fully functional registration and login system, automatically creating a client for new users.

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting.
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

## Recent Changes (August 15, 2025)

### Subscription Management System - COMPLETED
**Features Implemented**: 
- Complete subscription cancellation system with immediate vs period-end options
- Stripe webhook integration for automatic synchronization of subscription status changes
- Subscription management interface with modal dialogs, cancellation reasons, and reactivation capabilities
- Settings page reorganized with subscription management as dedicated menu item
- Date formatting fixes for subscription periods (Unix timestamp conversion from Stripe API)

**Testing Confirmed**: User Nilson Farias successfully tested cancellation and reactivation flow.

### Client Registration Simplified - COMPLETED (August 15, 2025)
**Change**: Modified client creation process to automatically assign "free" plan to all new users
**Implementation**:
- Removed plan selection dropdown from client creation modal
- All new clients automatically start with "free" plan
- Added informational text explaining upgrade options
- Backend already configured to default to "free" plan when none specified

**Impact**: Streamlined onboarding process - new users start with free tier and can upgrade through subscription system.

### Domain Configuration System - COMPLETED (August 18, 2025)
**Features Implemented**:
- Added "System Domain" field to API Configuration page for admin interface
- System settings stored in database instead of environment variables only
- Evolution API service now uses configured domain for webhook setup
- Enhanced validation for URL formats in test connection functionality
- Fallback system maintains compatibility with existing environment variables

**Technical Details**:
- New `system_settings` table with key-value storage for configuration
- Enhanced `/api/settings/evolution-api` endpoints to handle domain configuration
- Improved error messages for connection testing with specific failure reasons
- Evolution API service dynamically retrieves domain from database settings

**Benefits**: Simplified deployment process - admins can configure system domain through interface instead of modifying environment variables on server.

### Admin Navigation Consolidation - COMPLETED (August 18, 2025)
**Features Implemented**:
- Consolidated "Clientes" and "Usuários Admin" menus into single "Gerenciar" menu
- Created tabbed interface with "Clientes" and "Usuários Admin" tabs
- Maintained all original functionalities without loss
- Enhanced user experience with cleaner navigation structure

### Billing Metrics System Overhaul - COMPLETED (August 18, 2025)
**Problem Identified**: Billing dashboard displayed static/mockup data instead of real system metrics
**Solution Implemented**:
- Created new `/api/billing/metrics` endpoint with real database calculations
- Replaced all hardcoded values with dynamic data from active clients
- Implemented accurate revenue calculations based on client plans (Basic R$ 29, Pro R$ 89, Enterprise R$ 199)
- Added real-time churn rate calculation based on inactive vs total clients
- Dynamic plan distribution showing actual client counts and percentages
- Upcoming renewals based on real client data

**Technical Details**:
- New `getBillingMetrics()` method in storage layer
- Real-time calculation of: monthly revenue, active subscriptions, churn rate, average ticket
- Plan distribution filtered to show only plans with active clients
- Frontend connected to authentic data source with loading states

**Impact**: Billing dashboard now provides accurate business intelligence for decision making instead of fictional metrics.

### Scripts de Instalação Automatizada - CRIADOS (August 18, 2025)
**Features Implementadas**:
- Script `install.sh` principal com instalação completa multi-OS e multi-arquitetura
- Suporte completo para Ubuntu 20.04+, Debian 11+, CentOS 8+ em x86_64 e ARM64
- Configuração automática: PostgreSQL, Node.js 18+, PM2, Nginx, SSL/TLS, Firewall
- Script `quick-install.sh` para instalação one-liner via curl
- Script `update.sh` para atualizações com backup automático (código + banco)
- Documentação completa em `README-INSTALLATION.md`
- Interface de documentação no painel admin com todos os guias acessíveis

**Detalhes Técnicos**:
- Detecção automática de SO e arquitetura com validações de compatibilidade
- Configuração SSL automática com Let's Encrypt e renovação via cron
- Proxy reverso Nginx otimizado com headers de segurança e compressão gzip
- PM2 com auto-restart e configuração de startup
- Firewall configurado automaticamente (UFW/Firewalld)
- Sistema de backup completo com restauração em caso de falha
- Health checks e verificações de integridade pós-instalação

**Repositório**: https://github.com/NilsonFarias/ZapStatus-para-Woocommerce
**Status**: Arquivos criados localmente, aguardando commit para funcionar publicamente

**Comando de instalação (após commit)**:
```bash
curl -fsSL https://raw.githubusercontent.com/NilsonFarias/ZapStatus-para-Woocommerce/main/quick-install.sh | bash
```

**Benefícios**: Reduz tempo de deploy de horas para minutos, elimina erros de configuração manual, suporte para VPS ARM64 (30% mais barato), instalação zero-touch para usuários não-técnicos.