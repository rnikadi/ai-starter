import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("./index.js", () => ({
  getDb: () => mockDb,
}));

import {
  createConversation,
  listUserConversations,
  getConversationById,
  addConversationMessage,
  deleteConversation,
  updateConversationTitle,
  createDocument,
  listDocuments,
  deleteDocument,
  searchSimilarDocuments,
} from "./repository.js";

describe("Database Conversation Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a conversation with userId and title", async () => {
    const mockCreated = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "user-1",
      title: "My AI Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockCreated]),
      }),
    });

    const result = await createConversation("user-1", "My AI Chat");
    expect(result).toEqual(mockCreated);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("lists conversations for a specific user", async () => {
    const mockList = [
      { id: "1", userId: "user-1", title: "Chat 1" },
      { id: "2", userId: "user-1", title: "Chat 2" },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockList),
          }),
        }),
      }),
    });

    const result = await listUserConversations("user-1");
    expect(result).toEqual(mockList);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("retrieves a conversation by id and user", async () => {
    const mockConv = { id: "conv-1", userId: "user-1", title: "Chat 1" };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockConv]),
      }),
    });

    const result = await getConversationById("conv-1", "user-1");
    expect(result).toEqual(mockConv);
  });

  it("adds a message and touches conversation timestamp", async () => {
    const mockMsg = {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "Hello",
      createdAt: new Date(),
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockMsg]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await addConversationMessage("conv-1", "user", "Hello");
    expect(result).toEqual(mockMsg);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deletes a conversation and returns true if deleted", async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "conv-1" }]),
      }),
    });

    const result = await deleteConversation("conv-1", "user-1");
    expect(result).toBe(true);
  });

  it("updates conversation title and returns updated record", async () => {
    const mockUpdated = { id: "conv-1", userId: "user-1", title: "New Title", updatedAt: new Date() };
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUpdated]),
        }),
      }),
    });

    const result = await updateConversationTitle("conv-1", "user-1", "New Title");
    expect(result).toEqual(mockUpdated);
    expect(mockDb.update).toHaveBeenCalled();
  });

  describe("Document Knowledge Base & Vector Search", () => {
    it("creates a document with content and embedding", async () => {
      const mockDoc = {
        id: "doc-123",
        title: "Architecture",
        content: "Microservices with Prometheus",
        metadata: JSON.stringify({ category: "infra" }),
        embedding: [0.1, 0.2],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockDoc]),
        }),
      });

      const result = await createDocument({
        title: "Architecture",
        content: "Microservices with Prometheus",
        metadata: JSON.stringify({ category: "infra" }),
        embedding: [0.1, 0.2],
      });

      expect(result).toEqual(mockDoc);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("lists documents with limit", async () => {
      const mockDocs = [{ id: "doc-1", title: "Doc 1" }];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockDocs),
          }),
        }),
      });

      const result = await listDocuments(10);
      expect(result).toEqual(mockDocs);
    });

    it("deletes a document and returns true if deleted", async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "doc-1" }]),
        }),
      });

      const result = await deleteDocument("doc-1");
      expect(result).toBe(true);
    });

    it("searches similar documents using vector similarity", async () => {
      const mockMatches = [
        {
          id: "doc-1",
          title: "Doc 1",
          content: "Content 1",
          metadata: null,
          similarity: 0.92,
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockMatches),
            }),
          }),
        }),
      });

      const result = await searchSimilarDocuments([0.1, 0.2], 3, 0.5);
      expect(result).toEqual(mockMatches);
    });
  });
});

