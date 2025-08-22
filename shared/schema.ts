import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(), // Made optional since we use email as username
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  phone: text("phone"),
  role: text("role").notNull().default("user"), // "user" | "admin"
  plan: text("plan").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("active"),
  monthlyMessages: integer("monthly_messages").default(0),
  lastAccess: timestamp("last_access"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const whatsappInstances = pgTable("whatsapp_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  instanceId: text("instance_id").notNull(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  status: text("status").notNull().default("disconnected"),
  qrCode: text("qr_code"),
  lastConnection: timestamp("last_connection"),
  dailyMessages: integer("daily_messages").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  orderStatus: text("order_status").notNull(),
  sequence: integer("sequence").notNull().default(1),
  content: text("content").notNull(),
  delayMinutes: integer("delay_minutes").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhookConfigs = pgTable("webhook_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  webhookUrl: text("webhook_url").notNull(),
  secretKey: text("secret_key").notNull(),
  isActive: boolean("is_active").default(true),
  events: jsonb("events").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  event: text("event").notNull(),
  status: text("status").notNull(),
  response: text("response"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const messageQueue = pgTable("message_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").references(() => whatsappInstances.id), // Made nullable for deleted instances
  templateId: varchar("template_id").notNull().references(() => messageTemplates.id),
  recipientPhone: text("recipient_phone").notNull(),
  message: text("message").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  encrypted: boolean("encrypted").default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  instances: many(whatsappInstances),
  templates: many(messageTemplates),
  webhookConfigs: many(webhookConfigs),
  webhookLogs: many(webhookLogs),
}));

export const instancesRelations = relations(whatsappInstances, ({ one, many }) => ({
  client: one(clients, { fields: [whatsappInstances.clientId], references: [clients.id] }),
  messageQueue: many(messageQueue),
}));

export const templatesRelations = relations(messageTemplates, ({ one, many }) => ({
  client: one(clients, { fields: [messageTemplates.clientId], references: [clients.id] }),
  messageQueue: many(messageQueue),
}));

export const webhookConfigsRelations = relations(webhookConfigs, ({ one }) => ({
  client: one(clients, { fields: [webhookConfigs.clientId], references: [clients.id] }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  client: one(clients, { fields: [webhookLogs.clientId], references: [clients.id] }),
}));

export const messageQueueRelations = relations(messageQueue, ({ one }) => ({
  instance: one(whatsappInstances, { fields: [messageQueue.instanceId], references: [whatsappInstances.id] }),
  template: one(messageTemplates, { fields: [messageQueue.templateId], references: [messageTemplates.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  username: true, // Omit username since we use email as identifier
  stripeCustomerId: true,
  stripeSubscriptionId: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertInstanceSchema = createInsertSchema(whatsappInstances).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedByUser: one(users, { fields: [systemSettings.updatedBy], references: [users.id] }),
}));

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertInstance = z.infer<typeof insertInstanceSchema>;
export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type MessageQueueItem = typeof messageQueue.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
