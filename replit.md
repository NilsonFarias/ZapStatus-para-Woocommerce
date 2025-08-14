# WhatsFlow - WhatsApp Business Automation Platform

## Overview

WhatsFlow is a SaaS platform that automates WhatsApp messaging for e-commerce businesses. The system enables clients to manage multiple WhatsApp instances, create message templates, and automatically send order notifications through webhook integrations with WooCommerce stores. The platform provides a comprehensive dashboard for managing clients, tracking message delivery, and monitoring billing across different subscription plans.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Database Cleanup and Message Queue Management (August 14, 2025)
- **Status**: ✅ **FUNCIONAL** - Sistema de gerenciamento da fila de mensagens completo
- **Funcionalidades**:
  - Botão "Atualizar" corrigido com feedback toast
  - Menu de ações (⋮) para cada mensagem na fila
  - "Enviar Agora" para mensagens pendentes
  - "Tentar Novamente" para mensagens com falha
  - "Excluir" para remover mensagens da fila
  - Endpoints DELETE e POST resend funcionando
  - Instância problemática "Bookstore Bot Demo" removida completamente
- **Limpeza Realizada**:
  - Instância duplicada removida do banco PostgreSQL
  - Mensagens órfãs da fila limpas
  - Código atualizado para buscar de todas as instâncias ativas
  - Erros "Instance not found" resolvidos

### WooCommerce Webhook Configuration System (August 14, 2025)
- **Status**: ✅ **100% FUNCIONAL** - Sistema completo de configuração de webhooks implementado
- **Funcionalidades**:
  - Interface completa para configuração de URL e chave secreta
  - 11 eventos WooCommerce suportados (order.created, order.updated, order.pending, order.processing, order.on-hold, order.completed, order.cancelled, order.refunded, order.failed, order.shipped, order.delivered)
  - Sistema de salvamento real no banco de dados PostgreSQL
  - Botão de teste funcional com logs em tempo real
  - Geração automática de chaves secretas
  - Switches para ativar/desativar eventos individuais
  - Validação de formulário e tratamento de erros
  - Endpoint de recebimento `/api/webhook/woocommerce` funcionando
- **Resolução de Problemas**:
  - Cliente demo criado no banco para resolver erro de chave estrangeira
  - Formatação correta de dados JSON para eventos
  - Validação adequada de payload antes da inserção no banco
- **Teste Realizado**: Sistema testado com sucesso via API endpoints

### WhatsApp Message Automation System (August 14, 2025)
- **Status**: ✅ **100% FUNCIONAL** - Sistema completo de automação de mensagens implementado
- **Funcionalidades**:
  - Webhook WooCommerce totalmente funcional recebendo pedidos
  - Templates configuráveis por status de pedido com delays personalizados
  - Sistema de filas processando mensagens automaticamente
  - Substituição de variáveis dinâmicas ({{nome_cliente}}, {{numero_pedido}}, etc.)
  - Instâncias WhatsApp conectadas ao Evolution API
  - Interface modal completa para configuração de templates
- **Teste Realizado**: 
  - ✅ Webhook recebendo dados de pedidos WooCommerce
  - ✅ Templates sendo aplicados corretamente
  - ✅ Mensagens sendo enfileiradas com delays apropriados
  - ✅ Sistema processando variáveis dinâmicas
  - ✅ Múltiplas mensagens por status funcionando
- **Logs de Sucesso**: Sistema enviando mensagens automaticamente quando pedidos são marcados como "completed"

### QR Code Generation System (August 14, 2025)
- **Evolution API Integration Status**: Successfully receiving structured data from Evolution API server
- **Solutions Implemented**:
  - Complete Socket.IO real-time communication system
  - Hybrid webhook + polling approach for maximum reliability
  - Automatic QR code polling every 6 seconds when webhook fails
  - Detailed response logging to track Evolution API data structure
  - Socket.IO rooms for targeted QR code delivery to specific instances
- **Technical Breakthrough**: 
  - ✅ Established stable connection to Evolution API
  - ✅ Receiving structured responses with keys: ['pairingCode', 'code', 'base64', 'count']
  - ✅ Polling system working with detailed logging
  - ✅ Socket.IO integration complete for real-time QR delivery
- **Current Status**: ✅ **QR CODES FULLY FUNCTIONAL** - Successfully capturing and displaying QR codes from Evolution API server (13KB+ base64 images)
- **Architecture**: Webhook-first with automatic fallback to polling ensures 100% QR code capture
- **UI Status**: ✅ QR codes displaying correctly in frontend modal with proper base64 handling
- **Instance Status**: ✅ Real-time status mapping from Evolution API (open → connected, close → disconnected, connecting → connecting)
- **Instance Management**: ✅ Complete gear button functionality (disconnect, restart, test message, reconnect)
- **Test Messages**: ✅ Working message system with phone number prompt and proper formatting
- **Reconnection System**: ✅ Smart reconnection option for disconnected instances without recreating

## System Architecture

### Frontend Architecture
- **React SPA**: Built with TypeScript using Vite as the build tool and development server
- **UI Framework**: shadcn/ui components with Radix UI primitives and Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for client-side routing with dedicated pages for dashboard, clients, instances, templates, webhooks, billing, and settings
- **Authentication**: Context-based auth system with demo user implementation
- **Payment Processing**: Stripe integration for subscription management

### Backend Architecture
- **Node.js/Express**: RESTful API server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Management**: Connect-pg-simple for session storage
- **Development**: Hot module replacement with Vite middleware integration
- **Production**: Static file serving with Express for the built React application

### Data Storage Solutions
- **Primary Database**: PostgreSQL (via Neon Database) with connection pooling
- **Schema Management**: Drizzle migrations with schema located in `shared/schema.ts`
- **Database Tables**: Users, clients, WhatsApp instances, message templates, webhook configurations, webhook logs, and message queue
- **Connection**: WebSocket constructor configuration for Neon serverless compatibility

### Authentication and Authorization
- **Demo Authentication**: Mock authentication system for development/demo purposes
- **User Context**: React Context API for user state management
- **Session Storage**: PostgreSQL-backed session management
- **Stripe Integration**: Customer and subscription management for billing

### External Service Integrations
- **Evolution API**: WhatsApp instance management, QR code generation, and message sending
- **Stripe**: Payment processing and subscription management
- **WooCommerce Webhooks**: Order event processing and automated message triggering
- **Message Queue**: Cron-based scheduling system for delayed message delivery

### Key Design Patterns
- **Shared Types**: Common TypeScript interfaces and Zod schemas in `shared/` directory
- **Repository Pattern**: Storage abstraction layer for database operations
- **Service Layer**: Dedicated services for Evolution API and message queue processing
- **Component Architecture**: Reusable UI components with consistent prop interfaces
- **Error Handling**: Centralized error boundaries and API error responses
- **Type Safety**: End-to-end TypeScript with runtime validation using Zod schemas

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Stripe**: Payment processing, subscription management, and billing automation
- **Evolution API**: WhatsApp Business API integration for instance management and messaging

### Development Tools
- **Vite**: Frontend build tool with HMR and plugin ecosystem
- **Drizzle Kit**: Database schema management and migrations
- **TanStack Query**: Server state management and caching
- **Radix UI**: Accessible component primitives for the design system

### Runtime Dependencies
- **Express.js**: Web server framework with middleware support
- **React**: Frontend framework with hooks and context
- **Tailwind CSS**: Utility-first CSS framework
- **Wouter**: Lightweight client-side routing
- **Node-cron**: Scheduled task execution for message queue processing