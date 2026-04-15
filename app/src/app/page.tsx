"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Image as ImageIcon, Video, Clock, Tag, ArrowRight, Cpu } from "lucide-react";
import type { Media, Kit } from "@/lib/types";

interface MediaWithKit extends Media {
  kit: Kit | null;
  _annotation_count?: number;
}

export default function DashboardPage() {
  const [recentMedia, setRecentMedia] = useState<MediaWithKit[]>([]);
  const [stats, setStats] = useState({ media: 0, items: 0, annotations: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [mediaRes, itemsRes, annotationsRes, pendingRes] = await Promise.all([
        supabase
          .from("media")
          .select("*, kit:kits(*)")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("items").select("id", { count: "exact", head: true }),
        supabase.from("annotations").select("id", { count: "exact", head: true }),
        supabase
          .from("annotations")
          .select("id", { count: "exact", head: true })
          .eq("status", "suggested"),
      ]);

      setRecentMedia((mediaRes.data as MediaWithKit[]) || []);
      setStats({
        media: mediaRes.count || mediaRes.data?.length || 0,
        items: itemsRes.count || 0,
        annotations: annotationsRes.count || 0,
        pending: pendingRes.count || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "Media Files", value: stats.media, icon: ImageIcon },
          { label: "Gear Items", value: stats.items, icon: Tag },
          { label: "Annotations", value: stats.annotations, icon: Cpu },
          { label: "Pending Review", value: stats.pending, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-surface border border-border rounded-sm px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
                {label}
              </span>
            </div>
            <div className="text-2xl font-mono font-semibold text-text-primary">
              {loading ? "—" : value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Media */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-text-primary">Recent Media</h2>
        <Link
          href="/upload"
          className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          Upload New <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-text-secondary animate-pulse">
          Loading...
        </div>
      ) : recentMedia.length === 0 ? (
        <div className="text-center py-12 border border-border/50 rounded-sm bg-surface">
          <ImageIcon className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
          <p className="text-xs font-mono text-text-secondary mb-3">
            No media uploaded yet
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 transition-colors"
          >
            Upload First File
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {recentMedia.map((m) => (
            <Link
              key={m.id}
              href={`/media/${m.id}`}
              className="group bg-surface border border-border rounded-sm overflow-hidden hover:border-accent/30 transition-colors"
            >
              <div className="aspect-video bg-bg flex items-center justify-center relative overflow-hidden">
                {m.thumbnail_url || m.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.thumbnail_url || m.storage_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                ) : (
                  <Video className="w-8 h-8 text-text-secondary/30" />
                )}
                {!m.ai_processed && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-warning/20 text-warning text-[9px] font-mono rounded-sm">
                    Processing
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-primary truncate">
                    {m.kit?.name || "Unassigned"}
                  </span>
                  {m.kit?.category && <CategoryBadge category={m.kit.category} />}
                </div>
                <div className="text-[10px] font-mono text-text-secondary mt-0.5">
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
