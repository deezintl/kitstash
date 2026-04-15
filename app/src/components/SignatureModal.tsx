"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, X } from "lucide-react";
import { getStoredSignature, setStoredSignature } from "@/lib/signature";

interface SignatureModalProps {
  open: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  actionLabel?: string;
}

export function SignatureModal({
  open,
  onConfirm,
  onCancel,
  actionLabel = "Save",
}: SignatureModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setName(getStoredSignature());
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredSignature(trimmed);
    onConfirm(trimmed);
  }, [name, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="bg-surface border border-border p-5 w-80 rounded-sm"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">Who&apos;s making this edit?</span>
              </div>
              <button onClick={onCancel} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="Your name"
              autoFocus
              className="w-full bg-bg border border-border px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-secondary/50 rounded-sm outline-none focus:border-accent/50 transition-colors"
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={onCancel}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {actionLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
