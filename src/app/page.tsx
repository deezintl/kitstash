"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Image as ImageIcon, Video, Clock, Tag, ArrowRight, Cpu, Search, ShieldCheck, ShieldOff } from "lucide-react";
import type { Media, Kit, MediaTag } from "@/lib/types";

interface MediaWithKit extends Media {
  kit: Kit | null;
  _annotation_count?: number;
  _person_count?: number;
}

const TAG_COLORS: Record<string, string> = {
  "Direct Action": "bg-red-900/70 text-red-300",
  "Recon": "bg-emerald-900/70 text-emerald-300",
  "Arrest": "bg-amber-900/70 text-amber-300",
};

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

      const mediaList = (mediaRes.data as MediaWithKit[]) || [];

      // Fetch annotation counts and person counts per media
      if (mediaList.length > 0) {
        const mediaIds = mediaList.map((m) => m.id);

        const [annCounts, personCounts] = await Promise.all([
          supabase
            .from("annotations")
            .select("media_id")
            .in("media_id", mediaIds),
          supabase
            .from("media_persons")
            .select("media_id")
            .in("media_id", mediaIds),
        ]);

        // Count annotations per media
        const annMap: Record<string, number> = {};
        if (annCounts.data) {
          for (const row of annCounts.data) {
            annMap[row.media_id] = (annMap[row.media_id] || 0) + 1;
          }
        }

        // Count persons per media
        const personMap: Record<string, number> = {};
        if (personCounts.data) {
          for (const row of personCounts.data) {
            personMap[row.media_id] = (personMap[row.media_id] || 0) + 1;
          }
        }

        for (const m of mediaList) {
          m._annotation_count = annMap[m.id] || 0;
          m._person_count = personMap[m.id] || 0;
        }
      }

      setRecentMedia(mediaList);
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

  const hasId = (m: MediaWithKit) => {
    return (m._annotation_count || 0) > 0 || (m._person_count || 0) > 0;
  };

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
              {loading ? "\u2014" : value}
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
        <div className="grid grid-cols-2 gap-4">
          {recentMedia.map((m) => (
            <Link
              key={m.id}
              href={`/media/${m.id}`}
              className="group bg-surface border border-border rounded-sm overflow-hidden hover:border-accent/30 transition-colors"
            >
              <div className="aspect-[16/10] bg-bg flex items-center justify-center relative overflow-hidden">
                {m.thumbnail_url || m.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.thumbnail_url || m.storage_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                ) : (
                  <Video className="w-10 h-10 text-text-secondary/30" />
                )}

                {/* Tag badges — top-right */}
                {m.tags && m.tags.length > 0 && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    {m.tags.map((tag) => (
                      <span
                        key={tag}
                        className={"px-1.5 py-0.5 text-[9px] font-mono font-medium rounded-sm " + (TAG_COLORS[tag] || "bg-zinc-800 text-zinc-300")}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* ID badge — top-left */}
                <div className="absolute top-2 left-2">
                  {hasId(m) ? (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-900/70 text-blue-300 text-[9px] font-mono font-medium rounded-sm">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      ID
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-800/80 text-zinc-500 text-[9px] font-mono font-medium rounded-sm">
                      <ShieldOff className="w-2.5 h-2.5" />
                      No ID
                    </span>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="text-[10px] font-mono text-text-secondary">
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  {m.type === "video" && (
                    <span className="flex items-center gap-0.5 text-[9px] font-mono text-text-secondary">
                      <Video className="w-2.5 h-2.5" /> Video
                    </span>
                  )}
                  {m.kit && (
                    <span className="text-[9px] font-mono text-text-secondary/60 truncate max-w-[120px]">
                      {m.kit.name}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
