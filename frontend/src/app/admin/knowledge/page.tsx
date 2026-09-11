"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useToast } from "../../../components/ui/ToastProvider";
import WorkspaceShell from "../../../components/ui/WorkspaceShell";
import { adminApi, type KnowledgeDocumentDto } from "../../../lib/api";

export default function AdminKnowledgePage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<KnowledgeDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const result = await adminApi.getKnowledgeDocuments();
      setDocuments(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load the knowledge base.";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const allowed = [".pdf", ".txt", ".docx"];
    const match = allowed.some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    );
    if (!match) {
      toast("Only PDF, TXT, and DOCX files are supported.", "error");
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, ""));
    }
    if (!sourceName.trim()) {
      setSourceName(file.name);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payloadContent = content.trim();

    if (!selectedFile && !payloadContent) {
      toast("Add text content or choose a file before uploading.", "error");
      return;
    }

    setUploading(true);
    try {
      await adminApi.uploadKnowledgeDocument({
        title: title.trim() || undefined,
        content: payloadContent || undefined,
        sourceName: sourceName.trim() || undefined,
        file: selectedFile,
      });
      setTitle("");
      setContent("");
      setSourceName("");
      setSelectedFile(null);
      toast("Knowledge base updated successfully.", "success");
      await loadDocuments();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to upload this knowledge item.";
      toast(message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (document: KnowledgeDocumentDto) => {
    const confirmed = window.confirm(
      `Delete “${document.title}” from the knowledge base?`,
    );
    if (!confirmed) return;

    try {
      await adminApi.deleteKnowledgeDocument(document.id);
      setDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
      toast("Knowledge document removed.", "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete the knowledge item.";
      toast(message, "error");
    }
  };

  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunkCount, 0),
    [documents],
  );

  return (
    <ProtectedRoute requiredRole="Admin">
      <WorkspaceShell
        role="Admin"
        eyebrow="Knowledge base"
        title="RAG knowledge management"
        description="Upload manuals, FAQs, and policy guidance so the AI assistant can answer customer questions with current business context."
        actions={
          <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
            {documents.length} documents
          </div>
        }
      >
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-violet-100 p-2 text-violet-700">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Upload knowledge
                </h2>
                <p className="text-sm text-slate-500">
                  PDF, TXT, and DOCX support
                </p>
              </div>
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFileSelect(event.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-6 text-center transition ${isDragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50"}`}
            >
              <input
                type="file"
                accept=".pdf,.txt,.docx"
                className="hidden"
                onChange={(event) =>
                  handleFileSelect(event.target.files?.[0] ?? null)
                }
              />
              <UploadCloud className="h-10 w-10 text-violet-600" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Drop files here or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedFile ? selectedFile.name : "No file selected"}
              </p>
            </label>

            <div className="space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Knowledge title"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white"
              />
              <input
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                placeholder="Source name (policy manual, FAQ, etc.)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Manual text entry
              </label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                placeholder="Paste policy, FAQ, or business guidance here ..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing
                  embeddings...
                </>
              ) : (
                "Upload to knowledge base"
              )}
            </button>
          </form>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                  <BookOpenText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Knowledge documents
                  </h2>
                  <p className="text-sm text-slate-500">
                    {totalChunks} indexed chunks
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading knowledge
                base...
              </div>
            ) : documents.length === 0 ? (
              <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No knowledge documents have been uploaded yet.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Uploaded</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {documents.map((document) => (
                      <tr key={document.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 rounded-xl bg-violet-100 p-2 text-violet-700">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">
                                {document.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {document.chunkCount} chunks
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {document.sourceName || document.sourceType}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {new Date(document.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Ready
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDelete(document)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
