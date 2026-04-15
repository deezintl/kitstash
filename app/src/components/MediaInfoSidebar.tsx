"use client";

import { useState, useEffect } from "react";
import { Clock, Tag, User, Video } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CategoryBadge } from "./CategoryBadge";
import { StatusDot } from "./StatusDot";
import clsx from "clsx";
import type { Annotation, Media, AuditEntry } from "@/lib/types";

interface MediaInfoSidebarProps {
  media: Media;
  annotations: Annotation[];
  onSeekTo?: (seconds: number) => void;
}

export function MediaInfoSidebar({ media, annotations, onSeekTo }: MediaInfoSidebarProps) {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    async function loadAudit() {
      const annotationIds = annotations.map((a) => a.id);
      if (annotationIds.length === 0) {
        setAuditLog([]);
        return;
      }
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .in("record_id", annotationIds)
        .order("created_at", { ascending: false })
        .limit(20);
      setAuditLog(data || []);
    }
    loadAudit();
  }, [annotations]);

  const confirmed = annotations.filter((a) => a.status === "confirmed");
  const suggested = annotations.filter((a) => a.status === "suggested");

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <aside className="w-72 border-l border-border bg-surface flex flex-col shrink-0 h-full">
      {/* Kit Info */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary mb-1.5">
          Media Info
        </div>
        {media.kit && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-text-primary">
              {media.kit.name}
            </span>
            {media.kit.category && (
              <CategoryBadge category={media.kit.category} />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {annotations.length} tags
          </span>
          <span className="flex items-center gap-1">
            {media.type === "video" ? <Video className="w-3 h-3" /> : null}
            {media.type}
          </span>
        </div>
        {!media.ai_processed && (
          <div className="mt-2 px-2 py-1 bg-warning/10 border border-warning/20 rounded-sm text-[10px] font-mono text-warning">
            AI processing pending...
          </div>
        )}
      </div>

      {/* Tagged Items */}
      <div className="flex-1 overflow-y-auto">
        {/* Confirmed */}
        {confirmed.length > 0 && (
          <div className="px-3 py-2">
            <div className="text-[10px] font-mono text-accent uppercase tracking-wider mb-1.5">
              Confirmed ({confirmed.length})
            </div>
            {confirmed.map((ann) => (
              <div
                key={ann.id}
                onClick={() => ann.timestamp_sec !== null && onSeekTo?.(ann.timestamp_sec)}
                className={clsx(
                  "flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-sm hover:bg-white/5 transition-colors",
                  ann.timestamp_sec !== null && "cursor-pointer"
                )}
              >
                <StatusDot status="production" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-text-primary truncate">
                    {ann.item?.name || "Unknown"}
                  </div>
                  {ann.item?.brand && (
                    <div className="text-[10px] font-mono text-text-secondary truncate">
                      {ann.item.brand}
                    </div>
                  )}
                </div>
                {ann.timestamp_sec !== null && (
                  <span className="text-[10px] font-mono text-text-secondary shrink-0">
                    {formatTime(ann.timestamp_sec)}
                    {ann.timestamp_end !== null && ann.timestamp_end !== undefined
                      ? `–${formatTime(ann.timestamp_end)}`
                      : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Suggested */}
        {suggested.length > 0 && (
          <div className="px-3 py-2 border-t border-border/50">
            <div className="text-[10px] font-mono text-warning uppercase tracking-wider mb-1.5">
              AI Suggested ({suggested.length})
            </div>
            {suggested.map((ann) => (
              <div
                key={ann.id}
                onClick={() => ann.timestamp_sec !== null && onSeekTo?.(ann.timestamp_sec)}
                className={clsx(
                  "flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-sm hover:bg-white/5 transition-colors",
                  ann.timestamp_sec !== null && "cursor-pointer"
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-text-primary truncate">
                    {ann.item?.name || "Unknown"}
                  </div>
                  {ann.confidence !== null && (
                    <div className="text-[10px] font-mono text-text-secondary">
                      {Math.round(ann.confidence * 100)}% confidence
                    </div>
                  )}
                </div>
                {ann.timestamp_sec !== null && (
                  <span className="text-[10px] font-mono text-text-secondary shrink-0">
                    {formatTime(ann.timestamp_sec)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {annotations.length === 0 && (
          <div className="px-3 py-6 text-center text-xs font-mono text-text-secondary">
            No tags yet. Use &quot;Add Tag&quot; or wait for AI processing.
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="border-t border-border max-h-40 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Activity
          </div>
          {auditLog.length === 0 ? (
            <div className="text-[10px] font-mono text-text-secondary">
              No activity yet
            </div>
          ) : (
            auditLog.map((entry) => (
              <div key={entry.id} className="flex items-start gap-1.5 py-1">
                <User className="w-3 h-3 text-text-secondary shrink-0 mt-0.5" />
                <div className="text-[10px] font-mono text-text-secondary leading-tight">
                  <span className="text-text-primary">
                    {entry.signature_name || "Unknown"}
                  </span>{" "}
                  {entry.action}d — {timeAgo(entry.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
