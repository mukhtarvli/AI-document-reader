
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
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");

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
    setSummary("");

    setSummary("");
    setExtractedText("");

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,

      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to analyze document");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        setSummary((previous) => previous + chunk);
      }

      const remaining = decoder.decode();
      if (remaining) {
        setSummary((previous) => previous + remaining);
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

  const chatting = async () =>{
    try {

      const response = await fetch("http://127.0.0.1:8000/ask",{
        method:"POST",
        headers: {
        "Content-Type": "application/json",
  },
  body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error("Failed to send question");
      }

      const data = await response.json();

      console.log(data.answer);

    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    }
  }




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

        {/* Scrollable Summary */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {summary && (
            <>
              <h2 className="mb-6 text-xl font-semibold text-indigo-400">
                ✨ AI Summary
              </h2>

              <div className="prose prose-invert prose-indigo max-w-none leading-relaxed">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            </>
          )}
        </div>

        {/* Chat Input */}
        <div className="shrink-0 border-t border-slate-700/60 bg-slate-900 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about this document..."
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-white outline-none placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={chatting}
              disabled={!question.trim() && isLoading}
              className="cursor-pointer rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </div>
      </div>



      {/* {extractedText && (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-semibold text-indigo-400">
            Extracted Document Text
          </h2>

          <p className="whitespace-pre-wrap text-slate-300">
            {extractedText}
          </p>
        </div>
      )} */}

    </div>
  );
}

export default FileUpload;
