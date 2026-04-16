"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import clsx from "clsx";
import type { Annotation } from "@/lib/types";

interface BoundingBoxProps {
  annotation: Annotation;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
}

export function BoundingBox({ annotation, onConfirm, onReject, onEdit }: BoundingBoxProps) {
  const [hovered, setHovered] = useState(false);
  const { coords, status, confidence, item } = annotation;

  if (status === "rejected") return null;

  const isConfirmed = status === "confirmed";
  const isSuggested = status === "suggested";

  return (
    <div
      className={clsx(
        "absolute cursor-pointer transition-all",
        isConfirmed && "bbox-confirmed",
        isSuggested && "bbox-suggested"
      )}
      style={{
        left: `${coords.x}%`,
        top: `${coords.y}%`,
        width: `${coords.width}%`,
        height: `${coords.height}%`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={clsx(
          "absolute -top-5 left-0 px-1.5 py-0.5 text-[9px] font-mono font-medium whitespace-nowrap rounded-sm",
          isConfirmed ? "bg-accent/20 text-accent" : "bg-warning/20 text-warning"
        )}
      >
        {item?.name || (isConfirmed ? "Tagged" : "Unknown")}{" "}
        {confidence !== null && (
          <span className="text-text-secondary">
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      {hovered && isSuggested && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-border p-2 rounded-sm shadow-xl z-30 min-w-[160px]">
          <div className="text-xs font-mono text-text-primary mb-1">
            {item?.brand && <span className="text-text-secondary">{item.brand} </span>}
            {item?.name || "Unidentified"}
          </div>
          {confidence !== null && (
            <div className="text-[10px] font-mono text-text-secondary mb-2">
              Confidence: {Math.round(confidence * 100)}%
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onConfirm(annotation.id); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-accent/15 text-accent border border-accent/30 rounded-sm hover:bg-accent/25 transition-colors"
            >
              <Check className="w-3 h-3" /> Confirm
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(annotation.id); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-warning/15 text-warning border border-warning/30 rounded-sm hover:bg-warning/25 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(annotation.id); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-danger/15 text-danger border border-danger/30 rounded-sm hover:bg-danger/25 transition-colors"
            >
              <X className="w-3 h-3" /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}