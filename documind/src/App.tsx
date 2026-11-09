
import FileUpload from "./components/FileUpload";
import { BrainCircuit } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
          <BrainCircuit
            size={30}
            className="text-indigo-400"
          />

          <h1 className="text-2xl font-bold">
            DocuMind
          </h1>
        </div>
      </header>

      <main className="flex flex-col items-center px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold md:text-5xl">
            Understand Any Document
            <span className="text-indigo-400"> with AI</span>
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-slate-400">
            Upload your document and let AI summarize,
            explain, and extract the most important
            information in seconds.
          </p>
        </div>

        <FileUpload />
      </main>
    </div>
  );
}

export default App;
