"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Crosshair } from "lucide-react";
import { BoundingBox } from "./BoundingBox";
import { ItemSearch } from "./ItemSearch";
import { SignatureModal } from "./SignatureModal";
import { supabase } from "@/lib/supabase";
import type { Annotation, Media, Item, Coords } from "@/lib/types";

interface MediaCanvasProps {
  media: Media;
  annotations: Annotation[];
  onAnnotationsChange: () => void;
}

type DrawState =
  | { mode: "idle" }
  | { mode: "drawing"; start: { x: number; y: number }; current: { x: number; y: number } }
  | { mode: "selecting_item"; coords: Coords }
  | { mode: "confirming"; annotationId: string; action: "confirm" | "reject" }
  | { mode: "editing"; annotationId: string };

export function MediaCanvas({ media, annotations, onAnnotationsChange }: MediaCanvasProps) {
  const [drawState, setDrawState] = useState<DrawState>({ mode: "idle" });
  const [drawMode, setDrawMode] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getRelativeCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!drawMode) return;
      const pos = getRelativeCoords(e);
      setDrawState({ mode: "drawing", start: pos, current: pos });
    },
    [drawMode, getRelativeCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drawState.mode !== "drawing") return;
      setDrawState((s) =>
        s.mode === "drawing" ? { ...s, current: getRelativeCoords(e) } : s
      );
    },
    [drawState.mode, getRelativeCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (drawState.mode !== "drawing") return;
    const { start, current } = drawState;
    const coords: Coords = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
    if (coords.width < 1 || coords.height < 1) {
      setDrawState({ mode: "idle" });
      return;
    }
    setDrawState({ mode: "selecting_item", coords });
    setDrawMode(false);
  }, [drawState]);

  const requestSignature = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setSignatureOpen(true);
  }, []);

  const handleConfirm = useCallback(
    (annotationId: string) => {
      requestSignature(async () => {
        await supabase
          .from("annotations")
          .update({ status: "confirmed" })
          .eq("id", annotationId);
        onAnnotationsChange();
      });
    },
    [requestSignature, onAnnotationsChange]
  );

  const handleReject = useCallback(
    (annotationId: string) => {
      requestSignature(async () => {
        await supabase
          .from("annotations")
          .update({ status: "rejected" })
          .eq("id", annotationId);
        onAnnotationsChange();
      });
    },
    [requestSignature, onAnnotationsChange]
  );

  const handleEdit = useCallback(
    (annotationId: string) => {
      setDrawState({ mode: "editing", annotationId });
    },
    []
  );

  const handleItemSelect = useCallback(
    (item: Item) => {
      if (drawState.mode === "selecting_item") {
        const coords = drawState.coords;
        requestSignature(async () => {
          await supabase.from("annotations").insert({
            media_id: media.id,
            item_id: item.id,
            coords,
            status: "confirmed",
            confidence: null,
          });
          onAnnotationsChange();
          setDrawState({ mode: "idle" });
        });
      } else if (drawState.mode === "editing") {
        const annotationId = drawState.annotationId;
        requestSignature(async () => {
          await supabase
            .from("annotations")
            .update({ item_id: item.id, status: "confirmed" })
            .eq("id", annotationId);
          onAnnotationsChange();
          setDrawState({ mode: "idle" });
        });
      }
    },
    [drawState, media.id, requestSignature, onAnnotationsChange]
  );

  const handleSignatureConfirm = useCallback(
    (name: string) => {
      setSignatureOpen(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    },
    [pendingAction]
  );

  // Drawing preview rect
  const drawRect =
    drawState.mode === "drawing"
      ? {
          x: Math.min(drawState.start.x, drawState.current.x),
          y: Math.min(drawState.start.y, drawState.current.y),
          w: Math.abs(drawState.current.x - drawState.start.x),
          h: Math.abs(drawState.current.y - drawState.start.y),
        }
      : null;

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface">
        <button
          onClick={() => {
            setDrawMode(!drawMode);
            setDrawState({ mode: "idle" });
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
            drawMode
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-text-secondary border border-border hover:bg-white/5"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Tag
        </button>

        {drawMode && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-warning">
            <Crosshair className="w-3 h-3" />
            Click and drag to draw a bounding box
          </span>
        )}

        {(drawState.mode === "selecting_item" || drawState.mode === "editing") && (
          <div className="w-64">
            <ItemSearch
              onSelect={handleItemSelect}
              placeholder="Search to assign item..."
            />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 bg-bg overflow-hidden">
        <div
          ref={containerRef}
          className={`relative max-w-full max-h-full ${
            drawMode ? "cursor-crosshair" : ""
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {media.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.storage_url}
              alt="Media"
              className="max-w-full max-h-[calc(100vh-200px)] object-contain select-none"
              draggable={false}
            />
          ) : (
            <video
              src={media.storage_url}
              controls
              className="max-w-full max-h-[calc(100vh-200px)]"
            />
          )}

          {/* Bounding box overlays */}
          {annotations.map((ann) => (
            <BoundingBox
              key={ann.id}
              annotation={ann}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onEdit={handleEdit}
            />
          ))}

          {/* Drawing preview */}
          {drawRect && (
            <motion.div
              className="absolute border-2 border-dashed border-accent bg-accent/10 pointer-events-none"
              style={{
                left: `${drawRect.x}%`,
                top: `${drawRect.y}%`,
                width: `${drawRect.w}%`,
                height: `${drawRect.h}%`,
              }}
            />
          )}
        </div>
      </div>

      <SignatureModal
        open={signatureOpen}
        onConfirm={handleSignatureConfirm}
        onCancel={() => {
          setSignatureOpen(false);
          setPendingAction(null);
        }}
        actionLabel="Sign & Save"
      />
    </div>
  );
}
