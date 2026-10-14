import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "./index.js";
import { conversations, messages, type NewConversation, type NewMessage } from "./schema.js";

export async function createConversation(userId: string, title: string) {
  const db = getDb();
  const [created] = await db
    .insert(conversations)
    .values({
      userId,
      title,
    })
    .returning();
  return created;
}

export async function listUserConversations(userId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(limit);
}

export async function getConversationById(conversationId: string, userId: string) {
  const db = getDb();
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  return conv || null;
}

export async function getConversationMessages(conversationId: string) {
  const db = getDb();
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function addConversationMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
) {
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
}

export async function deleteConversation(conversationId: string, userId: string) {
  const db = getDb();
  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning();
  return Boolean(deleted);
}

export async function getDatabaseStats() {
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
}

export async function clearAllConversations() {
  const db = getDb();
  await db.delete(messages);
  await db.delete(conversations);
  return { success: true };
}

