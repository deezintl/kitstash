"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabase";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SignatureModal } from "@/components/SignatureModal";
import {
  Upload,
  Plus,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Cpu,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";
import clsx from "clsx";
import type { Kit, Category } from "@/lib/types";

type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "error";

interface FileEntry {
  file: File;
  status: UploadStatus;
  mediaId?: string;
  error?: string;
  notes?: string;
}

const categories: Category[] = ["Recon", "Direct Action", "Arrest", "Comp/Exercise"];

export default function UploadPage() {
  const router = useRouter();
  const [kits, setKits] = useState<Kit[]>([]);
  const [selectedKit, setSelectedKit] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [newKitCategory, setNewKitCategory] = useState<Category | "">("");
  const [newKitDesc, setNewKitDesc] = useState("");
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalNotes, setGlobalNotes] = useState("");
  const [txtDragOver, setTxtDragOver] = useState(false);

  useEffect(() => {
    async function loadKits() {
      const { data } = await supabase.from("kits").select("*").order("name");
      setKits(data || []);
    }
    loadKits();
  }, []);

  // Separate .txt files from media files
  const processDroppedFiles = useCallback(async (accepted: File[]) => {
    const mediaFiles: File[] = [];
    const txtFiles: File[] = [];

    for (const file of accepted) {
      if (file.name.endsWith(".txt") || file.type === "text/plain") {
        txtFiles.push(file);
      } else {
        mediaFiles.push(file);
      }
    }

    // Read all .txt files and append to global notes
    if (txtFiles.length > 0) {
      const texts: string[] = [];
      for (const tf of txtFiles) {
        const text = await tf.text();
        texts.push(text);
      }
      const combined = texts.join("\n\n");
      setGlobalNotes((prev) => {
        if (!prev.trim()) return combined;
        return prev + "\n\n" + combined;
      });
    }

    // Add media files to file list
    if (mediaFiles.length > 0) {
      const entries: FileEntry[] = mediaFiles.map((file) => ({ file, status: "idle", notes: "" }));
      setFiles((prev) => [...prev, ...entries]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processDroppedFiles,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
      "video/*": [".mp4", ".mov", ".avi", ".webm"],
      "text/plain": [".txt"],
    },
  });

  // Notes-specific drop zone handler
  const handleNotesDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTxtDragOver(true);
  }, []);

  const handleNotesDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTxtDragOver(false);
  }, []);

  const handleNotesDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTxtDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const txtFiles = droppedFiles.filter(
      (f) => f.name.endsWith(".txt") || f.type === "text/plain"
    );

    if (txtFiles.length > 0) {
      const texts: string[] = [];
      for (const tf of txtFiles) {
        const text = await tf.text();
        texts.push(text);
      }
      const combined = texts.join("\n\n");
      setGlobalNotes((prev) => {
        if (!prev.trim()) return combined;
        return prev + "\n\n" + combined;
      });
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileNotes = (index: number, notes: string) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, notes } : f))
    );
  };

  const handleTxtUpload = async (index: number, txtFile: File) => {
    const text = await txtFile.text();
    updateFileNotes(index, text);
  };

  const handleGlobalTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setGlobalNotes((prev) => {
      if (!prev.trim()) return text;
      return prev + "\n\n" + text;
    });
    e.target.value = "";
  };

  const handleCreateKit = async () => {
    if (!newKitName.trim()) return;
    const { data } = await supabase
      .from("kits")
      .insert({
        name: newKitName.trim(),
        category: newKitCategory || null,
        description: newKitDesc.trim() || null,
      })
      .select()
      .single();
    if (data) {
      setKits((prev) => [...prev, data]);
      setSelectedKit(data.id);
      setShowNewKit(false);
      setNewKitName("");
      setNewKitCategory("");
      setNewKitDesc("");
    }
  };

  const handleUpload = async (signatureName: string) => {
    setSignatureOpen(false);
    setIsUploading(true);

    const kitId = selectedKit || null;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status !== "idle") continue;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f))
      );

      try {
        const ext = entry.file.name.split(".").pop() || "bin";
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("media")
          .upload(path, entry.file);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        const storageUrl = urlData.publicUrl;

        // Combine per-file notes with global notes
        const combinedNotes = [globalNotes, entry.notes].filter(Boolean).join("\n\n").trim() || null;

        const isVideo = entry.file.type.startsWith("video/");
        const { data: mediaData, error: mediaErr } = await supabase
          .from("media")
          .insert({
            kit_id: kitId,
            type: isVideo ? "video" : "image",
            storage_url: storageUrl,
            notes: combinedNotes,
          })
          .select()
          .single();

        if (mediaErr || !mediaData) throw mediaErr || new Error("Failed to create media record");

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "processing", mediaId: mediaData.id } : f
          )
        );

        try {
          await fetch("/api/ai/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              media_id: mediaData.id,
              storage_url: storageUrl,
              type: isVideo ? "video" : "image",
            }),
          });
        } catch {
          console.warn("AI trigger failed, will need manual processing");
        }

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "ready", mediaId: mediaData.id } : f
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
              : f
          )
        );
      }
    }

    setIsUploading(false);
  };

  const allDone = files.length > 0 && files.every((f) => f.status === "ready" || f.status === "error");
  const hasFiles = files.some((f) => f.status === "idle");

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-lg font-medium text-text-primary mb-6">Upload Media</h1>

      {/* Kit Selection */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">
          Assign to Kit
        </label>
        <div className="flex gap-2">
          <select
            value={selectedKit}
            onChange={(e) => setSelectedKit(e.target.value)}
            className="flex-1 bg-bg border border-border px-3 py-2 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
          >
            <option value="">No Kit (unassigned)</option>
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.name} {kit.category ? `[${kit.category}]` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewKit(!showNewKit)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium border border-border text-text-secondary rounded-sm hover:bg-white/5 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Kit
          </button>
        </div>

        {showNewKit && (
          <div className="mt-2 p-3 bg-surface border border-border rounded-sm space-y-2">
            <input
              type="text"
              value={newKitName}
              onChange={(e) => setNewKitName(e.target.value)}
              placeholder="Kit name"
              className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
            />
            <div className="flex gap-2">
              <select
                value={newKitCategory}
                onChange={(e) => setNewKitCategory(e.target.value as Category)}
                className="flex-1 bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none"
              >
                <option value="">Category (optional)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleCreateKit}
                disabled={!newKitName.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 disabled:opacity-30"
              >
                Create
              </button>
            </div>
            <input
              type="text"
              value={newKitDesc}
              onChange={(e) => setNewKitDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
            />
          </div>
        )}
      </div>

      {/* Global Notes — textarea + .txt drop zone side by side */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
            Notes (applies to all uploaded images)
          </label>
          {globalNotes && (
            <button
              onClick={() => setGlobalNotes("")}
              className="text-[10px] font-mono text-text-secondary/50 hover:text-danger flex items-center gap-0.5"
            >
              <X className="w-2.5 h-2.5" /> Clear
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
            placeholder="Enter notes for all images in this upload batch... (source info, context, date, location, etc.)"
            className="flex-1 bg-bg border border-border px-3 py-2 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50 h-28 resize-y"
          />
          <div
            onDragOver={handleNotesDragOver}
            onDragLeave={handleNotesDragLeave}
            onDrop={handleNotesDrop}
            className={clsx(
              "w-28 shrink-0 border-2 border-dashed rounded-sm flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors",
              txtDragOver
                ? "border-accent bg-accent/10"
                : "border-border hover:border-accent/30"
            )}
            onClick={() => {
              const inp = document.createElement("input");
              inp.type = "file";
              inp.accept = ".txt";
              inp.multiple = true;
              inp.onchange = async () => {
                if (!inp.files) return;
                const texts: string[] = [];
                for (const f of Array.from(inp.files)) {
                  texts.push(await f.text());
                }
                const combined = texts.join("\n\n");
                setGlobalNotes((prev) => {
                  if (!prev.trim()) return combined;
                  return prev + "\n\n" + combined;
                });
              };
              inp.click();
            }}
          >
            <FileText className="w-5 h-5 text-text-secondary/40" />
            <span className="text-[9px] font-mono text-text-secondary/60 text-center leading-tight px-1">
              Drop .txt here
            </span>
          </div>
        </div>
      </div>

      {/* Dropzone — accepts images, videos, AND .txt files */}
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors mb-6",
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/30"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-text-secondary/40 mx-auto mb-3" />
        <p className="text-xs font-mono text-text-secondary mb-1">
          {isDragActive ? "Drop files here" : "Drag & drop images, videos, or .txt notes"}
        </p>
        <p className="text-[10px] font-mono text-text-secondary/50">
          JPG, PNG, WEBP, MP4, MOV, AVI, WEBM &mdash; .TXT files auto-fill notes
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mb-6">
          <div className="text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-2">
            Files ({files.length})
          </div>
          <div className="space-y-2">
            {files.map((entry, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border rounded-sm overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  {entry.file.type.startsWith("video/") ? (
                    <Video className="w-4 h-4 text-text-secondary shrink-0" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-text-secondary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-text-primary truncate">
                      {entry.file.name}
                    </div>
                    <div className="text-[10px] font-mono text-text-secondary">
                      {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>

                  {entry.status === "idle" && (
                    <button onClick={() => removeFile(idx)} className="text-text-secondary hover:text-danger">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {entry.status === "uploading" && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-accent">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading...
                    </div>
                  )}
                  {entry.status === "processing" && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-warning">
                      <Cpu className="w-3 h-3 animate-pulse" />
                      AI Analyzing...
                    </div>
                  )}
                  {entry.status === "ready" && (
                    <a
                      href={`/media/${entry.mediaId}`}
                      className="flex items-center gap-1 text-[10px] font-mono text-accent hover:underline"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Ready
                    </a>
                  )}
                  {entry.status === "error" && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-danger">
                      <AlertCircle className="w-3 h-3" />
                      {entry.error || "Error"}
                    </div>
                  )}
                </div>

                {/* Per-file notes */}
                {entry.status === "idle" && (
                  <div className="px-3 pb-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-mono text-text-secondary">Per-image note</span>
                      <label className="flex items-center gap-0.5 text-[10px] font-mono text-accent/70 cursor-pointer hover:text-accent">
                        <FileText className="w-2.5 h-2.5" />
                        .txt
                        <input
                          type="file"
                          accept=".txt"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleTxtUpload(idx, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      value={entry.notes || ""}
                      onChange={(e) => updateFileNotes(idx, e.target.value)}
                      placeholder="Note for this specific image..."
                      className="w-full bg-bg border border-border px-2 py-1 text-[11px] font-mono text-text-primary rounded-sm outline-none focus:border-accent/50 h-14 resize-y"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload button */}
      {hasFiles && (
        <button
          onClick={() => setSignatureOpen(true)}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload {files.filter((f) => f.status === "idle").length} file(s)
            </>
          )}
        </button>
      )}

      {allDone && (
        <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-sm text-center">
          <p className="text-xs font-mono text-accent mb-2">All files processed!</p>
          <button
            onClick={() => router.push("/")}
            className="text-xs text-accent hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      )}

      <SignatureModal
        open={signatureOpen}
        onConfirm={handleUpload}
        onCancel={() => setSignatureOpen(false)}
        actionLabel="Sign & Upload"
      />
    </div>
  );
}
