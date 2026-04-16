"use client";

import { useState, useRef, useCallback } from "react";

import { Plus, Crosshair, User, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { BoundingBox } from "./BoundingBox";
import { ItemSearch } from "./ItemSearch";
import { SignatureModal } from "./SignatureModal";
import { supabase } from "@/lib/supabase";
import type { Annotation, Media, Item, Coords } from "@/lib/types";

interface PersonDot {
  id: string;
  person_index: number;
  x: number;
  y: number;
  callsign?: string | null;
}

interface MediaCanvasProps {
  media: Media;
  annotations: Annotation[];
  onAnnotationsChange: () => void;
  personDots?: PersonDot[];
  activePersonIndex?: number | null;
  onPersonDotClick?: (personIndex: number) => void;
  onPlacePersonDot?: (personMpId: string, x: number, y: number) => void;
  placingDotForPerson?: string | null;
  gearAnnotationMode?: { gearId: string; gearName: string; personIndex: number } | null;
  onGearAnnotationComplete?: (gearId: string, coords: Coords) => void;
  onCancelGearAnnotation?: () => void;
}

type DrawState =
  | { mode: "idle" }
  | { mode: "drawing"; start: { x: number; y: number }; current: { x: number; y: number } }
  | { mode: "selecting_item"; coords: Coords }
  | { mode: "confirming"; annotationId: string; action: "confirm" | "reject" }
  | { mode: "editing"; annotationId: string }
  | { mode: "drawing_gear"; start: { x: number; y: number }; current: { x: number; y: number } };

const PERSON_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
];

export function MediaCanvas({
  media,
  annotations,
  onAnnotationsChange,
  personDots = [],
  activePersonIndex,
  onPersonDotClick,
  onPlacePersonDot,
  placingDotForPerson,
  gearAnnotationMode,
  onGearAnnotationComplete,
  onCancelGearAnnotation,
}: MediaCanvasProps) {
  const [drawState, setDrawState] = useState<DrawState>({ mode: "idle" });
  const [drawMode, setDrawMode] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
      if (placingDotForPerson && onPlacePersonDot) {
        const pos = getRelativeCoords(e);
        onPlacePersonDot(placingDotForPerson, pos.x, pos.y);
        return;
      }
      if (gearAnnotationMode) {
        const pos = getRelativeCoords(e);
        setDrawState({ mode: "drawing_gear", start: pos, current: pos });
        return;
      }
      if (drawMode) {
        const pos = getRelativeCoords(e);
        setDrawState({ mode: "drawing", start: pos, current: pos });
        return;
      }
      // Pan mode when zoomed
      if (zoom > 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [drawMode, getRelativeCoords, placingDotForPerson, onPlacePersonDot, gearAnnotationMode, zoom, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drawState.mode === "drawing" || drawState.mode === "drawing_gear") {
        setDrawState((s) =>
          (s.mode === "drawing" || s.mode === "drawing_gear")
            ? { ...s, current: getRelativeCoords(e) }
            : s
        );
      } else if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    },
    [drawState.mode, getRelativeCoords, isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);

    if (drawState.mode === "drawing_gear" && gearAnnotationMode && onGearAnnotationComplete) {
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
      onGearAnnotationComplete(gearAnnotationMode.gearId, coords);
      setDrawState({ mode: "idle" });
      return;
    }

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
  }, [drawState, gearAnnotationMode, onGearAnnotationComplete]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom((z) => Math.min(5, Math.max(1, z + delta)));
    }
  }, []);

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const requestSignature = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setSignatureOpen(true);
  }, []);

  const handleConfirm = useCallback(
    (annotationId: string) => {
      requestSignature(async () => {
        await supabase.from("annotations").update({ status: "confirmed" }).eq("id", annotationId);
        onAnnotationsChange();
      });
    },
    [requestSignature, onAnnotationsChange]
  );

  const handleReject = useCallback(
    (annotationId: string) => {
      requestSignature(async () => {
        await supabase.from("annotations").update({ status: "rejected" }).eq("id", annotationId);
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
          await supabase.from("annotations").update({ item_id: item.id, status: "confirmed" }).eq("id", annotationId);
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

  const drawRect =
    (drawState.mode === "drawing" || drawState.mode === "drawing_gear")
      ? {
          x: Math.min(drawState.start.x, drawState.current.x),
          y: Math.min(drawState.start.y, drawState.current.y),
          w: Math.abs(drawState.current.x - drawState.start.x),
          h: Math.abs(drawState.current.y - drawState.start.y),
        }
      : null;

  const isInteractive = drawMode || !!placingDotForPerson || !!gearAnnotationMode;

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface flex-wrap">
        <button
          onClick={() => { setDrawMode(!drawMode); setDrawState({ mode: "idle" }); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
            drawMode
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-text-secondary border border-border hover:bg-white/5"
          }`}
        >
          <Plus className="w-3.5 h-3.5" /> Add Tag
        </button>

        {/* Show/Hide Boxes */}
        <button
          onClick={() => setShowBoxes(!showBoxes)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
            showBoxes
              ? "text-text-secondary border border-border hover:bg-white/5"
              : "bg-zinc-700 text-zinc-300 border border-zinc-600"
          }`}
          title={showBoxes ? "Hide bounding boxes" : "Show bounding boxes"}
        >
          {showBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showBoxes ? "Boxes" : "Hidden"}
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => setZoom((z) => Math.min(5, z + 0.5))}
            className="p-1.5 text-text-secondary border border-border rounded-sm hover:bg-white/5"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            className="p-1.5 text-text-secondary border border-border rounded-sm hover:bg-white/5"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          {zoom > 1 && (
            <button
              onClick={resetZoom}
              className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono text-text-secondary border border-border rounded-sm hover:bg-white/5"
              title="Reset zoom"
            >
              <RotateCcw className="w-3 h-3" /> {Math.round(zoom * 100)}%
            </button>
          )}
        </div>

        {drawMode && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-warning">
            <Crosshair className="w-3 h-3" /> Click and drag to draw a bounding box
          </span>
        )}

        {placingDotForPerson && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-blue-400">
            <User className="w-3 h-3" /> Click on the image to place person dot
          </span>
        )}

        {gearAnnotationMode && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
              <Crosshair className="w-3 h-3" /> Draw box around: {gearAnnotationMode.gearName}
            </span>
            {onCancelGearAnnotation && (
              <button onClick={onCancelGearAnnotation} className="text-[10px] text-zinc-500 hover:text-zinc-300">cancel</button>
            )}
          </div>
        )}

        {(drawState.mode === "selecting_item" || drawState.mode === "editing") && (
          <div className="w-64">
            <ItemSearch onSelect={handleItemSelect} placeholder="Search to assign item..." />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={wrapperRef}
        className="flex-1 flex items-center justify-center p-4 bg-bg overflow-hidden"
        onWheel={handleWheel}
      >
        <div
          ref={containerRef}
          className={`relative max-w-full max-h-full ${isInteractive ? "cursor-crosshair" : zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.15s ease",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {media.type === "image" ? (
            <img
              src={media.storage_url}
              alt="Media"
              className="max-w-full max-h-[calc(100vh-200px)] object-contain select-none"
              draggable={false}
            />
          ) : (
            <video src={media.storage_url} controls className="max-w-full max-h-[calc(100vh-200px)]" />
          )}

          {/* Bounding box overlays */}
          {showBoxes && annotations.map((ann) => (
            <BoundingBox
              key={ann.id}
              annotation={ann}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onEdit={handleEdit}
            />
          ))}

          {/* Person dots */}
          {personDots.map((dot) => {
            const colorClass = PERSON_COLORS[(dot.person_index - 1) % PERSON_COLORS.length];
            const isActive = activePersonIndex === dot.person_index;
            return (
              <button
                key={dot.id}
                onClick={(e) => { e.stopPropagation(); onPersonDotClick?.(dot.person_index); }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg border-2 transition-all ${colorClass} ${
                  isActive ? "w-7 h-7 border-white ring-2 ring-white/30 z-20" : "w-5 h-5 border-black/50 z-10 hover:scale-125"
                }`}
                style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                title={dot.callsign || "Person #" + dot.person_index}
              >
                {dot.person_index}
              </button>
            );
          })}

          {/* Drawing preview */}
          {drawRect && (
            <div
              className={`absolute border-2 border-dashed pointer-events-none ${
                drawState.mode === "drawing_gear" ? "border-amber-400 bg-amber-400/10" : "border-accent bg-accent/10"
              }`}
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
        onCancel={() => { setSignatureOpen(false); setPendingAction(null); }}
        actionLabel="Sign & Save"
      />
    </div>
  );
}