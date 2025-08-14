# WhatsFlow - WhatsApp Business Automation Platform

## Overview

WhatsFlow is a SaaS platform that automates WhatsApp messaging for e-commerce businesses. The system enables clients to manage multiple WhatsApp instances, create message templates, and automatically send order notifications through webhook integrations with WooCommerce stores. The platform provides a comprehensive dashboard for managing clients, tracking message delivery, and monitoring billing across different subscription plans.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### QR Code Generation System (August 14, 2025)
- **Issue Identified**: Evolution API server has issues generating QR codes for instances in "connecting" status
- **Solutions Implemented**:
  - Automatic logout for instances stuck >3 minutes
  - Detection of permanently stuck instances (>8 minutes)
  - Simplified QR code generation logic removing complex retry loops
  - Enhanced error messages indicating Evolution API server issues
  - Added diagnosis endpoint for troubleshooting Evolution API problems
- **Current Status**: QR generation is limited by Evolution API server reliability, not our application logic
- **User Recommendation**: Create new instances if QR codes don't generate within 1-2 minutes

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