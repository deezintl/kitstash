"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabase";
import { SignatureModal } from "@/components/SignatureModal";
import {
  Upload,
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

type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "error";

interface FileEntry {
  file: File;
  status: UploadStatus;
  mediaId?: string;
  error?: string;
  notes?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalNotes, setGlobalNotes] = useState("");
  const [txtDragOver, setTxtDragOver] = useState(false);

  // Extract date (YYYY-MM-DD HH:MM:SS) from filename patterns like
  // "..._2021_02_09__12_07_28.jpg" -> "2021-02-09 12:07:28"
  const extractDateFromFilename = (filename: string): string | null => {
    const m = filename.match(/(\d{4})_(\d{2})_(\d{2})__(\d{2})_(\d{2})_(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
    const m2 = filename.match(/(\d{4})_(\d{2})_(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    return null;
  };

  // Separate .txt files from media files, matching captions to images by filename
  const processDroppedFiles = useCallback(async (accepted: File[]) => {
    const mediaFiles: File[] = [];
    const captionMap = new Map<string, File>();
    const unmatchedTxt: File[] = [];

    for (const file of accepted) {
      const name = file.name;
      if (name.endsWith(".caption.txt")) {
        const imageName = name.slice(0, -".caption.txt".length);
        captionMap.set(imageName, file);
      } else if (name.endsWith(".txt") || file.type === "text/plain") {
        unmatchedTxt.push(file);
      } else {
        mediaFiles.push(file);
      }
    }

    const entries: FileEntry[] = [];
    const usedCaptions = new Set<string>();
    for (const file of mediaFiles) {
      const caption = captionMap.get(file.name);
      let notes = "";
      const dateStr = extractDateFromFilename(file.name);
      if (dateStr) notes = `Date: ${dateStr}`;
      if (caption) {
        usedCaptions.add(file.name);
        const text = await caption.text();
        notes = notes ? `${notes}\n\n${text.trim()}` : text.trim();
      }
      entries.push({ file, status: "idle", notes });
    }

    // Leftover captions (no matching image in this drop): try matching against
    // files already in state, else append to global notes
    const leftover: File[] = [];
    for (const [imgName, capFile] of Array.from(captionMap.entries())) {
      if (!usedCaptions.has(imgName)) leftover.push(capFile);
    }

    if (leftover.length > 0) {
      const leftoverTexts: { name: string; text: string }[] = [];
      for (const tf of leftover) {
        leftoverTexts.push({ name: tf.name, text: await tf.text() });
      }
      setFiles((prev) => {
        const updated = [...prev];
        const stillUnmatched: { name: string; text: string }[] = [];
        for (const lt of leftoverTexts) {
          const imgName = lt.name.slice(0, -".caption.txt".length);
          const idx = updated.findIndex((e) => e.file.name === imgName);
          if (idx >= 0) {
            const existing = updated[idx];
            const combined = existing.notes
              ? `${existing.notes}\n\n${lt.text.trim()}`
              : lt.text.trim();
            updated[idx] = { ...existing, notes: combined };
          } else {
            stillUnmatched.push(lt);
          }
        }
        if (stillUnmatched.length > 0) {
          const combined = stillUnmatched
            .map((s) => `# ${s.name}\n${s.text}`)
            .join("\n\n");
          setGlobalNotes((prevNotes) =>
            prevNotes.trim() ? prevNotes + "\n\n" + combined : combined
          );
        }
        return updated;
      });
    }

    if (unmatchedTxt.length > 0) {
      const texts: string[] = [];
      for (const tf of unmatchedTxt) {
        texts.push(await tf.text());
      }
      const combined = texts.join("\n\n");
      setGlobalNotes((prev) => (prev.trim() ? prev + "\n\n" + combined : combined));
    }

    if (entries.length > 0) {
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

  const handleUpload = async (signatureName: string) => {
    setSignatureOpen(false);
    setIsUploading(true);

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
          {isDragActive ? "Drop files here" : "Drag & drop a folder of images + .caption.txt files"}
        </p>
        <p className="text-[10px] font-mono text-text-secondary/50">
          Auto-matches <span className="text-accent/70">image.jpg</span> with <span className="text-accent/70">image.jpg.caption.txt</span> &mdash; parses date from filename
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
