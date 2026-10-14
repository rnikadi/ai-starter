import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "./index.js";
import { conversations, messages } from "./schema.js";
import { traceAsync } from "../lib/tracing.js";

export async function createConversation(userId: string, title: string) {
  return traceAsync("db.createConversation", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "INSERT");
    span.setAttribute("user.id", userId);
    const db = getDb();
    const [created] = await db
      .insert(conversations)
      .values({
        userId,
        title,
      })
      .returning();
    return created;
  });
}

export async function listUserConversations(userId: string, limit = 50) {
  return traceAsync("db.listUserConversations", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    span.setAttribute("user.id", userId);
    const db = getDb();
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
  });
}

export async function getConversationById(conversationId: string, userId: string) {
  return traceAsync("db.getConversationById", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    span.setAttribute("conversation.id", conversationId);
    span.setAttribute("user.id", userId);
    const db = getDb();
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
    return conv || null;
  });
}

export async function getConversationMessages(conversationId: string) {
  return traceAsync("db.getConversationMessages", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT");
    span.setAttribute("conversation.id", conversationId);
    const db = getDb();
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  });
}

export async function addConversationMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
) {
  return traceAsync("db.addConversationMessage", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "INSERT");
    span.setAttribute("conversation.id", conversationId);
    span.setAttribute("message.role", role);
    span.setAttribute("message.length", content.length);
    const db = getDb();
    const [msg] = await db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
      })
      .returning();

    // Update conversation updated_at timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return msg;
  });
}

export async function deleteConversation(conversationId: string, userId: string) {
  return traceAsync("db.deleteConversation", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "DELETE");
    span.setAttribute("conversation.id", conversationId);
    span.setAttribute("user.id", userId);
    const db = getDb();
    const [deleted] = await db
      .delete(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning();
    return Boolean(deleted);
  });
}

export async function updateConversationTitle(conversationId: string, userId: string, title: string) {
  return traceAsync("db.updateConversationTitle", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "UPDATE");
    span.setAttribute("conversation.id", conversationId);
    span.setAttribute("user.id", userId);
    const db = getDb();
    const [updated] = await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning();
    return updated || null;
  });
}

export async function getDatabaseStats() {
  return traceAsync("db.getDatabaseStats", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "SELECT_AGGREGATE");
    const db = getDb();
    const [convResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations);
    const [msgResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages);

    return {
      status: "healthy" as const,
      totalConversations: Number(convResult?.count || 0),
      totalMessages: Number(msgResult?.count || 0),
    };
  });
}

export async function clearAllConversations() {
  return traceAsync("db.clearAllConversations", async (span) => {
    span.setAttribute("db.system", "postgresql");
    span.setAttribute("db.operation", "DELETE_ALL");
    const db = getDb();
    await db.delete(messages);
    await db.delete(conversations);
    return { success: true };
  });
}

