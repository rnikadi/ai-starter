"use client";

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { appConfig } from "@/lib/app-config";

interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface ConversationWorkspaceProps {
  canTestAI: boolean;
  isAdmin: boolean;
  userRoles?: string[];
}

const STARTER_PROMPTS = [
  {
    title: "Test AI Gateway",
    prompt: "Reply with exactly: MASTRA_ARCHESTRA_CONNECTION_SUCCESS",
    subtitle: "Validate connection to the Archestra LLM gateway",
  },
  {
    title: "System Architecture",
    prompt: `Explain the architecture of ${appConfig.displayName}: Next.js, Node backend, Keycloak, Archestra, and PostgreSQL with pgvector.`,
    subtitle: "High-level overview of services and security boundaries",
  },
  {
    title: "Database Persistence",
    prompt: "How does PostgreSQL conversation persistence and schema migration work with Drizzle ORM in this project?",
    subtitle: "Learn about the isolated database setup and migrations",
  },
];

export function ConversationWorkspace({
  canTestAI,
}: ConversationWorkspaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<{ message: string; traceId?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [menuOpenConvId, setMenuOpenConvId] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isViewer = !canTestAI;

  // Close thread menu on click outside
  useEffect(() => {
    function handleClickOutside() {
      setMenuOpenConvId(null);
    }
    if (menuOpenConvId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenConvId]);

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard access error fallback
    }
  }

  // Auto-scroll to bottom whenever messages or loading change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 1. Initial fetch of conversations on mount
  useEffect(() => {
    let isMounted = true;
    fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { conversations?: Conversation[] } | null) => {
        if (!isMounted) return;
        const list = data?.conversations || [];
        setConversations(list);
        setLoadingConvs(false);
        if (list.length > 0) {
          setActiveConvId((prev) => prev ?? list[0].id);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingConvs(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch messages whenever active conversation changes
  useEffect(() => {
    let isMounted = true;
    if (!activeConvId) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setMessages([]);
          setLoadingMessages(false);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    fetch(`/api/conversations/${encodeURIComponent(activeConvId)}/messages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages?: Message[] } | null) => {
        if (!isMounted) return;
        setMessages(data?.messages || []);
        setLoadingMessages(false);
      })
      .catch(() => {
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeConvId]);

  // 3. Create a new conversation thread
  async function handleNewThread() {
    if (!canTestAI) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New chat",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { conversation: Conversation };
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
        setPrompt("");
        textareaRef.current?.focus();
      }
    } catch {
      setError({ message: "Failed to create new conversation." });
    }
  }

  // 4. Rename a conversation thread
  async function handleSaveRename(convId: string) {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingConvId(null);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c)),
        );
      }
    } catch {
      setError({ message: "Failed to rename conversation." });
    } finally {
      setEditingConvId(null);
    }
  }

  // 5. Delete a conversation thread
  async function handleDelete(convId: string, event?: React.MouseEvent) {
    event?.stopPropagation();
    if (!canTestAI) return;
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConvId === convId) {
          const remaining = conversations.filter((c) => c.id !== convId);
          setActiveConvId(remaining[0]?.id || null);
        }
      }
    } catch {
      setError({ message: "Failed to delete conversation." });
    }
  }

  // 6. Submit AI Prompt
  async function executePrompt(textToSend: string) {
    if (!canTestAI || loading || !textToSend.trim()) return;

    setError(null);
    setLoading(true);
    const userText = textToSend.trim();
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let targetConvId = activeConvId;

    // If no active conversation, create one first with prompt snippet
    if (!targetConvId) {
      try {
        const titleSnippet = userText.slice(0, 32).trim() || "New chat";
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: titleSnippet }),
        });
        if (res.ok) {
          const data = (await res.json()) as { conversation: Conversation };
          targetConvId = data.conversation.id;
          setConversations((prev) => [data.conversation, ...prev]);
          setActiveConvId(data.conversation.id);
        }
      } catch {
        // Fall back to executing without persistence if creation fails
      }
    } else {
      // If the active conversation still has default "New chat" title, rename it to the user's prompt snippet
      const currentConv = conversations.find((c) => c.id === targetConvId);
      if (currentConv && (currentConv.title === "New chat" || currentConv.title.startsWith("Chat "))) {
        const newTitle = userText.slice(0, 32).trim() || "New chat";
        void fetch(`/api/conversations/${encodeURIComponent(targetConvId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        }).then((res) => {
          if (res.ok) {
            setConversations((prev) =>
              prev.map((c) => (c.id === targetConvId ? { ...c, title: newTitle } : c)),
            );
          }
        });
      }
    }

    // Add optimistic user message
    const tempUserMsg: Message = {
      id: `temp-${crypto.randomUUID()}`,
      conversationId: targetConvId || "",
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          ...(targetConvId ? { conversationId: targetConvId } : {}),
        }),
      });

      const data = (await response.json()) as {
        result?: string;
        error?: string;
        traceId?: string;
        conversationId?: string;
      };

      if (!response.ok) {
        setError({
          message: data.error ?? `Request failed (${response.status}).`,
          traceId: data.traceId || response.headers.get("x-trace-id") || undefined,
        });
        return;
      }

      const assistantMsg: Message = {
        id: `resp-${crypto.randomUUID()}`,
        conversationId: targetConvId || "",
        role: "assistant",
        content: data.result ?? "(No content returned)",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError({
        message: "Could not reach backend API server. Check container logs.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void executePrompt(prompt);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void executePrompt(prompt);
    }
  }

  return (
    <div className="chat-layout">
      {/* 1. Left Sidebar (Unified theme matching admin console) */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-top">
          {canTestAI ? (
            <button
              type="button"
              className="chat-new-btn"
              onClick={handleNewThread}
              disabled={loading}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New chat</span>
            </button>
          ) : (
            <div className="chat-sidebar-viewer-banner">
              <span>Viewer Mode (Read-Only)</span>
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="chat-threads-scroll">
          <div className="chat-threads-heading">Recent Chats</div>

          {loadingConvs && (
            <div className="chat-threads-empty">Loading history...</div>
          )}

          {!loadingConvs && conversations.length === 0 && (
            <div className="chat-threads-empty">No conversations yet</div>
          )}

          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            const isEditing = conv.id === editingConvId;
            const isMenuOpen = conv.id === menuOpenConvId;

            return (
              <div
                key={conv.id}
                className={`chat-thread-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (!isEditing) {
                    setActiveConvId(conv.id);
                    setMenuOpenConvId(null);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <svg
                  className="chat-thread-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>

                {isEditing ? (
                  <form
                    className="chat-thread-rename-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSaveRename(conv.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="chat-thread-rename-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditingConvId(null);
                        }
                      }}
                      autoFocus
                      maxLength={64}
                    />
                    <button type="submit" className="chat-thread-rename-btn" title="Save">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="chat-thread-rename-btn cancel"
                      onClick={() => setEditingConvId(null)}
                      title="Cancel"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </form>
                ) : (
                  <span className="chat-thread-title">{conv.title}</span>
                )}

                {canTestAI && !isEditing && (
                  <div className="chat-thread-actions-wrapper" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`chat-thread-menu-btn ${isMenuOpen ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenConvId((prev) => (prev === conv.id ? null : conv.id));
                      }}
                      title="More options"
                      aria-label="More options"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                        <circle cx="5" cy="12" r="2" />
                      </svg>
                    </button>

                    {isMenuOpen && (
                      <div className="chat-thread-dropdown">
                        <button
                          type="button"
                          className="chat-thread-dropdown-item"
                          onClick={() => {
                            setEditingConvId(conv.id);
                            setEditingTitle(conv.title);
                            setMenuOpenConvId(null);
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          className="chat-thread-dropdown-item danger"
                          onClick={(e) => {
                            setMenuOpenConvId(null);
                            void handleDelete(conv.id, e);
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <section className="chat-main">
        {/* Message Stream */}
        <div className="chat-message-stream">
          {error && (
            <div
              className="notice-banner error"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{error.message}</span>
              {error.traceId && (
                <span
                  style={{
                    fontSize: "11px",
                    opacity: 0.85,
                    fontFamily: "monospace",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(0,0,0,0.15)",
                  }}
                  title="OpenTelemetry Trace Correlation ID"
                >
                  Trace: {error.traceId}
                </span>
              )}
            </div>
          )}

          {/* Empty State */}
          {!loadingMessages && messages.length === 0 && (
            <div className="chat-empty-view">
              <div className="chat-empty-logo">AI</div>
              <h1 className="chat-empty-title">What can I help with today?</h1>

              {isViewer && (
                <p className="chat-empty-viewer-notice">
                  You are logged in with the <strong>Viewer</strong> role. You can browse
                  saved conversations and model responses, but prompt execution is restricted.
                </p>
              )}

              {canTestAI && (
                <div className="chat-starters-grid">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className="chat-starter-card"
                      onClick={() => void executePrompt(item.prompt)}
                      disabled={loading}
                    >
                      <span className="chat-starter-title">{item.title}</span>
                      <span className="chat-starter-sub">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message List */}
          {loadingMessages && (
            <div className="chat-loading-messages">Loading messages...</div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`chat-message-row ${isUser ? "user" : "assistant"}`}
              >
                <div className="chat-message-inner">
                  <div
                    className={`chat-message-avatar ${isUser ? "user" : "assistant"}`}
                  >
                    {isUser ? "You" : "AI"}
                  </div>

                  <div className="chat-message-content">
                    {isUser ? (
                      <div className="chat-message-text">{msg.content}</div>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                    {!isUser && (
                      <button
                        type="button"
                        className="chat-copy-btn"
                        onClick={() => void handleCopy(msg.id, msg.content)}
                        title="Copy to clipboard"
                        aria-label="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="chat-message-row assistant">
              <div className="chat-message-inner">
                <div className="chat-message-avatar assistant">AI</div>
                <div className="chat-message-content loading">
                  <div className="chat-thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Bottom Floating Input Bar */}
        <div className="chat-input-dock">
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                rows={1}
                placeholder={
                  isViewer
                    ? "Viewer role is read-only (prompt execution disabled)..."
                    : `Message ${appConfig.displayName}...`
                }
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={handleKeyDown}
                disabled={isViewer || loading}
              />

              <button
                type="submit"
                className="chat-send-btn"
                disabled={isViewer || loading || !prompt.trim()}
                aria-label="Send prompt"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </form>

          <p className="chat-disclaimer">
            AI responses may contain inaccuracies. Verify important information.
          </p>
        </div>
      </section>
    </div>
  );
}
