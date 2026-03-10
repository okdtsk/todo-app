import { useState, useRef } from "react";
import { X, Send, ImagePlus, Link, Loader2 } from "lucide-react";
import { analyzeWithAI } from "../api/ai";
import type { AIAnalyzeResponse, AIAction } from "../types/api";

type AiPanelProps = {
  onClose: () => void;
  onActionsDone: () => void;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  actions?: AIAction[];
  image?: string;
};

function actionLabel(action: AIAction): string {
  switch (action.type) {
    case "create":
      return `Created: ${action.task_name}`;
    case "update":
      return `Updated: ${action.task_name ?? `#${action.todo_id}`}`;
    case "complete":
      return `Completed: #${action.todo_id}`;
    case "delete":
      return `Deleted: #${action.todo_id}`;
    case "create_project":
      return `Created project: ${action.project_name}`;
    case "update_project":
      return `Updated project: ${action.project_name ?? `#${action.project_id}`}`;
    case "delete_project":
      return `Deleted project: #${action.project_id}`;
    default:
      return `${action.type}`;
  }
}

export function AiPanel({ onClose, onActionsDone }: AiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  }

  function clearImage() {
    setImagePreview(null);
    setImageBase64(null);
    setImageType(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function processImageFile(file: File) {
    setImageType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64 = result.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        return;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message && !imageBase64) return;

    // Capture values before clearing state
    const capturedUrl = urlInput;
    const capturedImage = imageBase64;
    const capturedImageType = imageType;

    const userMsg: ChatMessage = {
      role: "user",
      text: message + (capturedUrl ? `\n🔗 ${capturedUrl}` : ""),
      image: imagePreview ?? undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setUrlInput("");
    setShowUrlInput(false);
    clearImage();
    setLoading(true);
    scrollToBottom();

    try {
      const resp: AIAnalyzeResponse = await analyzeWithAI({
        message,
        url: capturedUrl || undefined,
        image: capturedImage || undefined,
        image_type: capturedImageType || undefined,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        text: resp.summary,
        actions: resp.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (resp.actions.length > 0) {
        onActionsDone();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "AI request failed";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${errMsg}` },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  return (
    <div className="fixed bottom-20 right-6 z-50 w-96 max-h-[70vh] bg-bg border border-border rounded-xl shadow-2xl flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[13px] font-semibold text-text">AI Assistant</span>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text transition-colors duration-150"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-[13px] text-text-tertiary text-center py-8">
            Send a message, paste a URL, or upload an image to create tasks with AI.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.image && (
              <img
                src={msg.image}
                alt="Uploaded"
                className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
              />
            )}
            <div
              className={`text-[13px] px-3 py-2 rounded-lg max-w-[85%] ${
                msg.role === "user"
                  ? "bg-accent text-white"
                  : "bg-bg-secondary text-text"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
            {msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {msg.actions.map((action, j) => (
                  <span
                    key={j}
                    className="text-[11px] text-text-secondary bg-bg-secondary px-2 py-1 rounded"
                  >
                    {actionLabel(action)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Analyzing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-[120px] max-h-[80px] rounded-lg object-cover"
            />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-text text-bg rounded-full flex items-center justify-center"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      )}

      {/* URL input */}
      {showUrlInput && (
        <div className="px-4 pb-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/..."
            className="w-full text-[12px] text-text bg-bg-secondary rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent/30"
            autoFocus
          />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border">
        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-text-tertiary hover:text-text-secondary transition-colors duration-150 p-1"
              title="Upload image"
            >
              <ImagePlus size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={`transition-colors duration-150 p-1 ${
                showUrlInput ? "text-accent" : "text-text-tertiary hover:text-text-secondary"
              }`}
              title="Add URL"
            >
              <Link size={16} />
            </button>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder="Ask AI to create tasks..."
            className="flex-1 text-[13px] text-text bg-bg-secondary rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent/30"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !imageBase64)}
            className="text-accent hover:text-accent-hover disabled:text-text-tertiary transition-colors duration-150 p-1"
          >
            <Send size={16} />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
      </form>
    </div>
  );
}
