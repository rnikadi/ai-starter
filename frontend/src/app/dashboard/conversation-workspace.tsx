"use client";

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";

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
    title: "Starter Architecture",
    prompt: "Explain the architecture of this AI starter kit: Next.js, FastAPI/Node backend, Keycloak, Archestra, and PostgreSQL.",
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
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isViewer = !canTestAI;

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
          title: `Chat ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
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
      setError("Failed to create new conversation.");
    }
  }

  // 4. Delete a conversation thread
  async function handleDelete(convId: string, event: React.MouseEvent) {
    event.stopPropagation();
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
      setError("Failed to delete conversation.");
    }
  }

  // 5. Submit AI Prompt
  async function executePrompt(textToSend: string) {
    if (!canTestAI || loading || !textToSend.trim()) return;

    setError("");
    setLoading(true);
    const userText = textToSend.trim();
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let targetConvId = activeConvId;

    // If no active conversation, create one first
    if (!targetConvId) {
      try {
        const titleSnippet = userText.slice(0, 36);
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: titleSnippet || "New Conversation" }),
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
        conversationId?: string;
      };

      if (!response.ok) {
        setError(data.error ?? `Request failed (${response.status}).`);
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
      setError("Could not reach backend API server. Check container logs.");
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

  const activeTitle = conversations.find((c) => c.id === activeConvId)?.title || "ChatGPT";

  return (
    <div className="chatgpt-layout">
      {/* 1. Left Sidebar (Unified theme matching admin console) */}
      <aside className="chatgpt-sidebar">
        <div className="chatgpt-sidebar-top">
          {canTestAI ? (
            <button
              type="button"
              className="chatgpt-new-chat-btn"
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
            <div className="chatgpt-sidebar-viewer-banner">
              <span>Viewer Mode (Read-Only)</span>
            </div>
          )}
        </div>

        {/* Conversation List */}
        <div className="chatgpt-threads-scroll">
          <div className="chatgpt-threads-heading">Recent Chats</div>

          {loadingConvs && (
            <div className="chatgpt-threads-empty">Loading history...</div>
          )}

          {!loadingConvs && conversations.length === 0 && (
            <div className="chatgpt-threads-empty">No conversations yet</div>
          )}

          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                className={`chatgpt-thread-item ${isActive ? "active" : ""}`}
                onClick={() => setActiveConvId(conv.id)}
                role="button"
                tabIndex={0}
              >
                <svg
                  className="chatgpt-thread-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>

                <span className="chatgpt-thread-title">{conv.title}</span>

                {canTestAI && (
                  <button
                    type="button"
                    className="chatgpt-thread-del-btn"
                    onClick={(e) => void handleDelete(conv.id, e)}
                    title="Delete chat"
                    aria-label="Delete chat"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <section className="chatgpt-main">
        {/* Subtle top subheader */}
        <div className="chatgpt-chat-topbar">
          <span className="chatgpt-active-thread-name">{activeTitle}</span>
        </div>

        {/* Message Stream */}
        <div className="chatgpt-message-stream">
          {error && <div className="notice-banner error">{error}</div>}

          {/* Empty State */}
          {!loadingMessages && messages.length === 0 && (
            <div className="chatgpt-empty-view">
              <div className="chatgpt-empty-logo">AI</div>
              <h1 className="chatgpt-empty-title">What can I help with today?</h1>

              {isViewer && (
                <p className="chatgpt-empty-viewer-notice">
                  You are logged in with the <strong>Viewer</strong> role. You can browse
                  saved conversations and model responses, but prompt execution is restricted.
                </p>
              )}

              {canTestAI && (
                <div className="chatgpt-starters-grid">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className="chatgpt-starter-card"
                      onClick={() => void executePrompt(item.prompt)}
                      disabled={loading}
                    >
                      <span className="chatgpt-starter-title">{item.title}</span>
                      <span className="chatgpt-starter-sub">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message List */}
          {loadingMessages && (
            <div className="chatgpt-loading-messages">Loading messages...</div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`chatgpt-message-row ${isUser ? "user" : "assistant"}`}
              >
                <div className="chatgpt-message-inner">
                  <div
                    className={`chatgpt-message-avatar ${isUser ? "user" : "assistant"}`}
                  >
                    {isUser ? "You" : "AI"}
                  </div>

                  <div className="chatgpt-message-content">
                    <div className="chatgpt-message-text">{msg.content}</div>
                    {!isUser && (
                      <button
                        type="button"
                        className="chatgpt-copy-btn"
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
            <div className="chatgpt-message-row assistant">
              <div className="chatgpt-message-inner">
                <div className="chatgpt-message-avatar assistant">AI</div>
                <div className="chatgpt-message-content">
                  <div className="chatgpt-thinking-dots">
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
        <div className="chatgpt-input-dock">
          <form className="chatgpt-input-form" onSubmit={handleSubmit}>
            <div className="chatgpt-input-wrapper">
              <textarea
                ref={textareaRef}
                className="chatgpt-textarea"
                rows={1}
                placeholder={
                  isViewer
                    ? "Viewer role is read-only (prompt execution disabled)..."
                    : "Message AI Starter..."
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
                className="chatgpt-send-button"
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

          <p className="chatgpt-disclaimer">
            AI responses may contain inaccuracies. Verify important information.
          </p>
        </div>
      </section>
    </div>
  );
}
