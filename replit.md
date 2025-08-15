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