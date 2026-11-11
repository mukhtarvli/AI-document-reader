
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
} from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function FileUpload() {// -----------------------------------

  // vars -------


  type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
  };

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [_question, set_question] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);


  // functions -----------------

  const validateFile = (selectedFile: File) => {
    const extension = selectedFile.name
      .toLowerCase()
      .slice(selectedFile.name.lastIndexOf("."));

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Only PDF, DOCX, and TXT files are supported.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size must be less than 10 MB.");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      validateFile(selectedFile);
    }

    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const selectedFile = event.dataTransfer.files[0];

    if (selectedFile) {
      validateFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError("");
  };



  const handleAnalyze = async () => {
    if (!file) return;

    setIsLoading(true);
    // setSummary("");

    setExtractedText("");

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setDocumentId(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
        method: "POST",
        body: formData,
        signal: controller.signal,

      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to analyze document");
      }

      const newDocumentId = response.headers.get("X-Document-ID");

      if (!newDocumentId) {
        throw new Error("Document ID was not returned by the server");
      }

      setDocumentId(newDocumentId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const summaryId = crypto.randomUUID();

      setMessages([
        {
          id: summaryId,
          role: "assistant",
          content: "",
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === summaryId
            ? { ...message, content: message.content + chunk }
            : message
        )
      );

      const remaining = decoder.decode();

        if (remaining) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === summaryId
                ? { ...message, content: message.content + remaining }
                : message
            )
          );
        }
      }

    } catch (error) {

      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Analysis error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    }
    finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  //chatting -----------------------------------------------


  const chatting = async () => {
    const question = _question.trim();

    if (!question) return;


    try {
      setError("");

      // Add user question to conversation
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: question,
        },
      ]);

      set_question("");


      const response = await fetch(`${import.meta.env.VITE_API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          document_id: documentId,
          history: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send question");
      }
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ]);

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("No response stream available");
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk }
              : message
          )
        );
      }

      const remaining = decoder.decode();

      if (remaining) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + remaining }
              : message
          )
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    }
  };




  return (
   <div className="mx-auto w-full max-w-4xl px-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          isDragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-slate-700 bg-slate-900 hover:border-indigo-500"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <UploadCloud
          size={48}
          className="mx-auto mb-4 text-indigo-400"
        />

        <h3 className="text-lg font-semibold">
          Drag and drop your document
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Or click to browse your files
        </p>

        <p className="mt-4 text-xs text-slate-500">
          PDF, DOCX, TXT — Maximum 10 MB
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {file && (
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center gap-4">
            <FileText
              size={32}
              className="shrink-0 text-indigo-400"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {file.name}
              </p>

              <p className="text-sm text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <CheckCircle2
              size={20}
              className="text-green-400"
            />

            <button
              type="button"
              onClick={removeFile}
              aria-label="Remove file"
              className="text-slate-400 hover:text-red-400"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!file && !isLoading}
        onClick={handleAnalyze}
        className="mt-6 w-full cursor-pointer rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? "Analyzing document..." : "Analyze Document"}
      </button>


      {isLoading && (
        <button
          type="button"
          onClick={handleStop}
          className="mt-3 w-full rounded-xl border border-red-500 px-6 py-3 font-semibold text-red-400 transition hover:bg-red-500/10"
        >
          Stop Generating
        </button>
      )}




      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">
            {error}
          </p>
        </div>
      )}

    <div className="flex h-[650px] w-full flex-col overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-900">

      {/* Scrollable Messages */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-8">

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[80%] rounded-3xl bg-slate-800 px-5 py-3 text-white"
                    : "w-full text-slate-100"
                }
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-invert prose-indigo max-w-none leading-relaxed">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-6">
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Chat Input */}
      <div className="shrink-0 bg-slate-900 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">

          <div className="flex items-center gap-3 rounded-3xl border border-slate-700 bg-slate-800 px-4 py-3">

            <input
              type="text"
              value={_question}
              onChange={(e) => set_question(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && _question.trim() && !isLoading) {
                  e.preventDefault();
                  chatting();
                }
              }}
              placeholder="Ask anything about this document..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={chatting}
              disabled={!_question.trim() || isLoading }
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </button>

          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            Ask questions about your uploaded document
          </p>

        </div>
      </div>

    </div>

    </div>
  );
}

export default FileUpload;
