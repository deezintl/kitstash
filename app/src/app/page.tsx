"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Image as ImageIcon,
  Video,
  Clock,
  Tag,
  ArrowRight,
  Cpu,
  ShieldCheck,
  ShieldOff,
  ArrowUpDown,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type { Media, Kit, MediaTag } from "@/lib/types";

interface MediaWithKit extends Media {
  kit: Kit | null;
  _annotation_count?: number;
  _person_count?: number;
  _weapon_names?: string[];
}

type SortDir = "newest" | "oldest";

const TAG_COLORS: Record<string, string> = {
  "Direct Action": "bg-red-900/70 text-red-300 border-red-800",
  Recon: "bg-emerald-900/70 text-emerald-300 border-emerald-800",
  Arrest: "bg-amber-900/70 text-amber-300 border-amber-800",
  "Comp/Exercise": "bg-violet-900/70 text-violet-300 border-violet-800",
  "Winter/Snow": "bg-sky-900/70 text-sky-300 border-sky-800",
  Patches: "bg-pink-900/70 text-pink-300 border-pink-800",
  Calendar: "bg-teal-900/70 text-teal-300 border-teal-800",
  Misc: "bg-zinc-800/70 text-zinc-300 border-zinc-700",
};

const ALL_TAGS: MediaTag[] = ["Direct Action", "Recon", "Arrest", "Comp/Exercise", "Winter/Snow", "Patches", "Calendar", "Misc"];

export default function DashboardPage() {
  const [allMedia, setAllMedia] = useState<MediaWithKit[]>([]);
  const [allKits, setAllKits] = useState<Kit[]>([]);
  const [allWeaponNames, setAllWeaponNames] = useState<string[]>([]);
  const [stats, setStats] = useState({ media: 0, items: 0, annotations: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedWeapons, setSelectedWeapons] = useState<Set<string>>(new Set());
  const [idFilter, setIdFilter] = useState<"all" | "id" | "noid">("all");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "image" | "video">("all");

  const [showTags, setShowTags] = useState(true);
  const [showWeapons, setShowWeapons] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      supabase.from("media").select("*, kit:kits(*)").order("created_at", { ascending: false }).limit(2000),
      supabase.from("kits").select("*").order("name"),
      supabase.from("items").select("id", { count: "exact", head: true }),
      supabase.from("annotations").select("id", { count: "exact", head: true }),
      supabase.from("annotations").select("id", { count: "exact", head: true }).eq("status", "suggested"),
      supabase.from("weapons").select("name").order("name"),
    ]).then(async ([mediaRes, kitsRes, itemsRes, annotationsRes, pendingRes, weaponsRes]) => {
      const mediaList = (mediaRes.data as MediaWithKit[]) || [];
      setAllKits((kitsRes.data as Kit[]) || []);

      const weaponNameList = (weaponsRes.data || []).map((w: { name: string }) => w.name);
      setAllWeaponNames(weaponNameList);

      if (mediaList.length > 0) {
        const mediaIds = mediaList.map((m) => m.id);

        const [annCounts, personCounts, weaponData] = await Promise.all([
          supabase.from("annotations").select("media_id").in("media_id", mediaIds),
          supabase.from("media_persons").select("media_id").in("media_id", mediaIds),
          supabase.from("media_persons").select("media_id, weapons:person_weapons(weapon_name)").in("media_id", mediaIds),
        ]);

        const annMap: Record<string, number> = {};
        if (annCounts.data) {
          for (const row of annCounts.data) {
            annMap[row.media_id] = (annMap[row.media_id] || 0) + 1;
          }
        }

        const personMap: Record<string, number> = {};
        if (personCounts.data) {
          for (const row of personCounts.data) {
            personMap[row.media_id] = (personMap[row.media_id] || 0) + 1;
          }
        }

        const weaponMap: Record<string, Set<string>> = {};
        if (weaponData.data) {
          for (const mp of weaponData.data as any[]) {
            if (!weaponMap[mp.media_id]) weaponMap[mp.media_id] = new Set();
            if (mp.weapons) {
              for (const w of mp.weapons) {
                if (w.weapon_name) weaponMap[mp.media_id].add(w.weapon_name);
              }
            }
          }
        }

        for (const m of mediaList) {
          m._annotation_count = annMap[m.id] || 0;
          m._person_count = personMap[m.id] || 0;
          m._weapon_names = weaponMap[m.id] ? Array.from(weaponMap[m.id]) : [];
        }
      }

      setAllMedia(mediaList);
      setStats({
        media: mediaRes.count || mediaRes.data?.length || 0,
        items: itemsRes.count || 0,
        annotations: annotationsRes.count || 0,
        pending: pendingRes.count || 0,
      });
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const hasId = (m: MediaWithKit) =>
    (m._annotation_count || 0) > 0 || (m._person_count || 0) > 0;

  const weaponsInMedia = useMemo(() => {
    const names = new Set<string>();
    for (const m of allMedia) {
      if (m._weapon_names) {
        for (const n of m._weapon_names) names.add(n);
      }
    }
    return Array.from(names).sort();
  }, [allMedia]);

  const filteredMedia = useMemo(() => {
    let list = [...allMedia];

    if (selectedKits.size > 0) {
      list = list.filter((m) => {
        if (selectedKits.has("__unassigned__")) return !m.kit_id || selectedKits.has(m.kit_id || "");
        return m.kit_id != null && selectedKits.has(m.kit_id);
      });
    }

    if (selectedTags.size > 0) {
      list = list.filter((m) => m.tags && m.tags.some((t) => selectedTags.has(t)));
    }

    if (selectedWeapons.size > 0) {
      list = list.filter((m) => m._weapon_names && m._weapon_names.some((n) => selectedWeapons.has(n)));
    }

    if (idFilter === "id") list = list.filter(hasId);
    if (idFilter === "noid") list = list.filter((m) => !hasId(m));

    if (mediaTypeFilter !== "all") list = list.filter((m) => m.type === mediaTypeFilter);

    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDir === "newest" ? db - da : da - db;
    });

    return list;
  }, [allMedia, selectedKits, selectedTags, selectedWeapons, idFilter, sortDir, mediaTypeFilter]);

  const activeFilterCount =
    selectedKits.size + selectedTags.size + selectedWeapons.size + (idFilter !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedKits(new Set());
    setSelectedTags(new Set());
    setSelectedWeapons(new Set());
    setIdFilter("all");
  };

  const toggleSet = (set: Set<string>, val: string): Set<string> => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return next;
  };

  const handleDeleteMedia = async (mediaId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this image and all its data?")) return;
    const res = await fetch("/api/media/delete?id=" + mediaId, { method: "DELETE" });
    if (res.ok) {
      setAllMedia((prev) => prev.filter((m) => m.id !== mediaId));
    }
  };

  return (
    <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Media Files", value: stats.media, icon: ImageIcon },
          { label: "Gear Items", value: stats.items, icon: Tag },
          { label: "Annotations", value: stats.annotations, icon: Cpu },
          { label: "Pending Review", value: stats.pending, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-surface border border-border rounded-sm px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-mono font-semibold text-text-primary">
              {loading ? "\u2014" : value}
            </div>
          </div>
        ))}
      </div>

      {/* Media type tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {(["all", "image", "video"] as const).map((mt) => {
          const count = mt === "all"
            ? allMedia.length
            : allMedia.filter((m) => m.type === mt).length;
          return (
            <button
              key={mt}
              onClick={() => setMediaTypeFilter(mt)}
              className={clsx(
                "px-4 py-2 text-xs font-mono border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                mediaTypeFilter === mt
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              {mt === "video" && <Video className="w-3 h-3" />}
              {mt === "image" && <ImageIcon className="w-3 h-3" />}
              {mt === "all" ? "All" : mt === "image" ? "Photos" : "Videos"}
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Sort bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-text-primary">
            Media
            {!loading && (
              <span className="text-text-secondary font-normal ml-1.5">
                ({filteredMedia.length}{activeFilterCount > 0 ? " of " + allMedia.length : ""})
              </span>
            )}
          </h2>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-text-secondary hover:text-danger border border-border rounded-sm hover:border-danger/30 transition-colors"
            >
              <X className="w-2.5 h-2.5" /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSortDir(sortDir === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono text-text-secondary border border-border rounded-sm hover:border-accent/30 hover:text-text-primary transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortDir === "newest" ? "Newest first" : "Oldest first"}
          </button>
          <Link href="/upload" className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors">
            Upload New <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-text-secondary animate-pulse">Loading...</div>
      ) : allMedia.length === 0 ? (
        <div className="text-center py-12 border border-border/50 rounded-sm bg-surface">
          <ImageIcon className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
          <p className="text-xs font-mono text-text-secondary mb-3">No media uploaded yet</p>
          <Link href="/upload" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 transition-colors">
            Upload First File
          </Link>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* SIDEBAR */}
          <div className="w-52 shrink-0">
            <div className="sticky top-4 space-y-1">
              <div className="flex items-center gap-1.5 mb-3">
                <Filter className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">Filters</span>
              </div>

              {/* ID Status */}
              <div className="mb-3">
                <div className="text-[10px] font-mono text-text-secondary/70 uppercase tracking-wider mb-1.5 px-1">ID Status</div>
                <div className="flex gap-1">
                  {(["all", "id", "noid"] as const).map((val) => (
                    <button
                      key={val}
                      onClick={() => setIdFilter(val)}
                      className={clsx(
                        "flex-1 px-2 py-1 text-[10px] font-mono rounded-sm border transition-colors",
                        idFilter === val
                          ? "bg-accent/15 text-accent border-accent/30"
                          : "text-text-secondary border-border hover:border-accent/20"
                      )}
                    >
                      {val === "all" ? "All" : val === "id" ? "ID" : "No ID"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="mb-3">
                <button
                  onClick={() => setShowTags(!showTags)}
                  className="flex items-center gap-1 w-full text-[10px] font-mono text-text-secondary/70 uppercase tracking-wider mb-1.5 px-1 hover:text-text-secondary"
                >
                  {showTags ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                  Tags
                  {selectedTags.size > 0 && <span className="ml-auto text-accent">{selectedTags.size}</span>}
                </button>
                {showTags && (
                  <div className="space-y-0.5">
                    {ALL_TAGS.map((tag) => {
                      const active = selectedTags.has(tag);
                      const count = allMedia.filter((m) => m.tags && m.tags.includes(tag)).length;
                      return (
                        <button
                          key={tag}
                          onClick={() => setSelectedTags(toggleSet(selectedTags, tag))}
                          className={clsx(
                            "w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-sm border transition-colors",
                            active ? TAG_COLORS[tag] + " border-current/20" : "text-text-secondary border-transparent hover:bg-white/5"
                          )}
                        >
                          <span>{tag}</span>
                          <span className="text-[9px] opacity-60">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Weapons — from Gun DB */}
              {allWeaponNames.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowWeapons(!showWeapons)}
                    className="flex items-center gap-1 w-full text-[10px] font-mono text-text-secondary/70 uppercase tracking-wider mb-1.5 px-1 hover:text-text-secondary"
                  >
                    {showWeapons ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Weapons
                    {selectedWeapons.size > 0 && <span className="ml-auto text-accent">{selectedWeapons.size}</span>}
                  </button>
                  {showWeapons && (
                    <div className="space-y-0.5 max-h-60 overflow-y-auto">
                      {allWeaponNames.map((wn) => {
                        const active = selectedWeapons.has(wn);
                        const count = allMedia.filter((m) => m._weapon_names && m._weapon_names.includes(wn)).length;
                        return (
                          <button
                            key={wn}
                            onClick={() => setSelectedWeapons(toggleSet(selectedWeapons, wn))}
                            className={clsx(
                              "w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-sm transition-colors",
                              active ? "bg-amber-900/30 text-amber-300" : "text-text-secondary hover:bg-white/5"
                            )}
                          >
                            <span className="truncate">{wn}</span>
                            <span className="text-[9px] opacity-60 shrink-0 ml-1">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* GRID */}
          <div className="flex-1 min-w-0">
            {filteredMedia.length === 0 ? (
              <div className="text-center py-16 text-xs font-mono text-text-secondary">No media matches the current filters.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredMedia.map((m) => (
                  <Link
                    key={m.id}
                    href={"/media/" + m.id}
                    className="group bg-surface border border-border rounded-sm overflow-hidden hover:border-accent/30 transition-colors relative"
                  >
                    <div className="aspect-[16/10] bg-bg flex items-center justify-center relative overflow-hidden">
                      {m.thumbnail_url || m.type === "image" ? (
                        <img
                          src={m.thumbnail_url || m.storage_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                          draggable={false}
                        />
                      ) : (
                        <Video className="w-10 h-10 text-text-secondary/30" />
                      )}

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

                      <div className="absolute top-2 left-2">
                        {hasId(m) ? (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-900/70 text-blue-300 text-[9px] font-mono font-medium rounded-sm">
                            <ShieldCheck className="w-2.5 h-2.5" /> ID
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-800/80 text-zinc-500 text-[9px] font-mono font-medium rounded-sm">
                            <ShieldOff className="w-2.5 h-2.5" /> No ID
                          </span>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteMedia(m.id, e)}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-black/60 hover:bg-red-900/80 text-zinc-400 hover:text-red-300 rounded-sm transition-all"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                          <span className="text-[9px] font-mono text-text-secondary/60 truncate max-w-[120px]">{m.kit.name}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}