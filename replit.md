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

### Recent Updates (August 21, 2025)

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

#### Limpeza de Scripts Antigos - CONCLUÍDO
**Ação**: Removidos todos os scripts de debugging e correção antigos
**Scripts Mantidos**:
- **whatsflow-install-DEFINITIVO.sh**: Instalação completa zero-touch
- **update.sh**: Atualização automática com backup
**Scripts Removidos**: 25+ scripts antigos de debugging, correção e instalação
**Documentação**: Criado README.md limpo com instruções claras
**Status**: Repositório limpo e organizado, apenas scripts essenciais mantidos