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
} from "lucide-react";
import clsx from "clsx";
import type { Media, Kit, MediaTag } from "@/lib/types";

/* ---------- types ---------- */
interface MediaWithKit extends Media {
  kit: Kit | null;
  _annotation_count?: number;
  _person_count?: number;
  _weapon_types?: string[];
}

type SortDir = "newest" | "oldest";

const TAG_COLORS: Record<string, string> = {
  "Direct Action": "bg-red-900/70 text-red-300 border-red-800",
  "Recon": "bg-emerald-900/70 text-emerald-300 border-emerald-800",
  "Arrest": "bg-amber-900/70 text-amber-300 border-amber-800",
  "Comp/Exercise": "bg-violet-900/70 text-violet-300 border-violet-800",
};

const ALL_TAGS: MediaTag[] = ["Direct Action", "Recon", "Arrest", "Comp/Exercise"];

const WEAPON_TYPE_LABELS: Record<string, string> = {
  rifle: "Rifle",
  carbine: "Carbine",
  dmr: "DMR",
  sniper: "Sniper",
  lmg: "LMG",
  smg: "SMG",
  pistol: "Pistol",
  shotgun: "Shotgun",
  launcher: "Launcher",
};

/* ---------- component ---------- */
export default function DashboardPage() {
  const [allMedia, setAllMedia] = useState<MediaWithKit[]>([]);
  const [allKits, setAllKits] = useState<Kit[]>([]);
  const [stats, setStats] = useState({ media: 0, items: 0, annotations: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  // filters
  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedWeaponTypes, setSelectedWeaponTypes] = useState<Set<string>>(new Set());
  const [idFilter, setIdFilter] = useState<"all" | "id" | "noid">("all");

  // sidebar section collapse
  const [showKits, setShowKits] = useState(true);
  const [showTags, setShowTags] = useState(true);
  const [showWeapons, setShowWeapons] = useState(true);

  useEffect(() => {
    async function load() {
      const [mediaRes, kitsRes, itemsRes, annotationsRes, pendingRes] = await Promise.all([
        supabase
          .from("media")
          .select("*, kit:kits(*)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("kits").select("*").order("name"),
        supabase.from("items").select("id", { count: "exact", head: true }),
        supabase.from("annotations").select("id", { count: "exact", head: true }),
        supabase
          .from("annotations")
          .select("id", { count: "exact", head: true })
          .eq("status", "suggested"),
      ]);

      const mediaList = (mediaRes.data as MediaWithKit[]) || [];
      setAllKits((kitsRes.data as Kit[]) || []);

      if (mediaList.length > 0) {
        const mediaIds = mediaList.map((m) => m.id);

        const [annCounts, personCounts, weaponData] = await Promise.all([
          supabase.from("annotations").select("media_id").in("media_id", mediaIds),
          supabase.from("media_persons").select("media_id").in("media_id", mediaIds),
          supabase
            .from("media_persons")
            .select("media_id, weapons:person_weapons(weapon_type)")
            .in("media_id", mediaIds),
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

        // Build weapon types per media
        const weaponMap: Record<string, Set<string>> = {};
        if (weaponData.data) {
          for (const mp of weaponData.data as any[]) {
            if (!weaponMap[mp.media_id]) weaponMap[mp.media_id] = new Set();
            if (mp.weapons) {
              for (const w of mp.weapons) {
                if (w.weapon_type) weaponMap[mp.media_id].add(w.weapon_type);
              }
            }
          }
        }

        for (const m of mediaList) {
          m._annotation_count = annMap[m.id] || 0;
          m._person_count = personMap[m.id] || 0;
          m._weapon_types = weaponMap[m.id] ? Array.from(weaponMap[m.id]) : [];
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
    }
    load();
  }, []);

  /* ---------- derived ---------- */
  const hasId = (m: MediaWithKit) =>
    (m._annotation_count || 0) > 0 || (m._person_count || 0) > 0;

  // Weapon types found across all media (for filter options)
  const availableWeaponTypes = useMemo(() => {
    const types = new Set<string>();
    for (const m of allMedia) {
      if (m._weapon_types) {
        for (const t of m._weapon_types) types.add(t);
      }
    }
    return Array.from(types).sort();
  }, [allMedia]);

  // Kits that actually have media assigned
  const kitsWithMedia = useMemo(() => {
    const kitIds = new Set(allMedia.filter((m) => m.kit_id).map((m) => m.kit_id!));
    return allKits.filter((k) => kitIds.has(k.id));
  }, [allMedia, allKits]);

  const hasUnassigned = useMemo(() => allMedia.some((m) => !m.kit_id), [allMedia]);

  // Apply filters + sort
  const filteredMedia = useMemo(() => {
    let list = [...allMedia];

    // Kit filter
    if (selectedKits.size > 0) {
      list = list.filter((m) => {
        if (selectedKits.has("__unassigned__")) {
          return !m.kit_id || selectedKits.has(m.kit_id);
        }
        return m.kit_id && selectedKits.has(m.kit_id);
      });
    }

    // Tag filter
    if (selectedTags.size > 0) {
      list = list.filter((m) =>
        m.tags && m.tags.some((t) => selectedTags.has(t))
      );
    }

    // Weapon type filter
    if (selectedWeaponTypes.size > 0) {
      list = list.filter((m) =>
        m._weapon_types && m._weapon_types.some((t) => selectedWeaponTypes.has(t))
      );
    }

    // ID filter
    if (idFilter === "id") list = list.filter(hasId);
    if (idFilter === "noid") list = list.filter((m) => !hasId(m));

    // Sort
    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortDir === "newest" ? db - da : da - db;
    });

    return list;
  }, [allMedia, selectedKits, selectedTags, selectedWeaponTypes, idFilter, sortDir]);

  const activeFilterCount =
    selectedKits.size + selectedTags.size + selectedWeaponTypes.size + (idFilter !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedKits(new Set());
    setSelectedTags(new Set());
    setSelectedWeaponTypes(new Set());
    setIdFilter("all");
  };

  /* ---------- toggle helpers ---------- */
  const toggleSet = (set: Set<string>, val: string): Set<string> => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return next;
  };

  /* ---------- render ---------- */
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

      {/* Sort bar + header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-text-primary">
            Media
            {!loading && (
              <span className="text-text-secondary font-normal ml-1.5">
                ({filteredMedia.length}{activeFilterCount > 0 ? ` of ${allMedia.length}` : ""})
              </span>
            )}
          </h2>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-text-secondary hover:text-danger border border-border rounded-sm hover:border-danger/30 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
              Clear filters ({activeFilterCount})
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
          <Link
            href="/upload"
            className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Upload New <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-text-secondary animate-pulse">
          Loading...
        </div>
      ) : allMedia.length === 0 ? (
        <div className="text-center py-12 border border-border/50 rounded-sm bg-surface">
          <ImageIcon className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
          <p className="text-xs font-mono text-text-secondary mb-3">No media uploaded yet</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 transition-colors"
          >
            Upload First File
          </Link>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* ===== SIDEBAR FILTERS ===== */}
          <div className="w-52 shrink-0">
            <div className="sticky top-4 space-y-1">
              <div className="flex items-center gap-1.5 mb-3">
                <Filter className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">Filters</span>
              </div>

              {/* ID Status */}
              <div className="mb-3">
                <div className="text-[10px] font-mono text-text-secondary/70 uppercase tracking-wider mb-1.5 px-1">
                  ID Status
                </div>
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
                  {selectedTags.size > 0 && (
                    <span className="ml-auto text-accent">{selectedTags.size}</span>
                  )}
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
                            active
                              ? TAG_COLORS[tag] + " border-current/20"
                              : "text-text-secondary border-transparent hover:bg-white/3"
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

              {/* Kits */}
              {(kitsWithMedia.length > 0 || hasUnassigned) && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowKits(!showKits)}
                    className="flex items-center gap-1 w-full text-[10px] font-mono text-text-secondary/70 uppercase tracking-wider mb-1.5 px-1 hover:text-text-secondary"
                  >
                    {showKits ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Kits
                    {selectedKits.size > 0 && (
                      <span className="ml-auto text-accent">{selectedKits.size}</span>
                    )}
                  </button>
                  {showKits && (
                    <div className="space-y-0.5">
                      {hasUnassigned && (
                        <button
                          onClick={() => setSelectedKits(toggleSet(selectedKits, "__unassigned__"))}
                          className={clsx(
                            "w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-sm transition-colors",
                            selectedKits.has("__unassigned__")
                              ? "bg-accent/15 text-accent"
                              : "text-text-secondary hover:bg-white/3"
                          )}
                        >
                          <span className="italic">Unassigned</span>
                          <span className="text-[9px] opacity-60">
                            {allMedia.filter((m) => !m.kit_id).length}
                          </span>
                        </button>
                      )}
                      {kitsWithMedia.map((kit) => {
                        const active = selectedKits.has(kit.id);
                        const count = allMedia.filter((m) => m.kit_id === kit.id).length;
                        return (
                          <button
                            key={kit.id}
                            onClick={() => setSelectedKits(toggleSet(selectedKits, kit.id))}
                            className={clsx(
                              "w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-sm transition-colors",
                              active
                                ? "bg-accent/15 text-accent"
                                : "text-text-secondary hover:bg-white/3"
                            )}
                          >
                            <span className="truncate">{kit.name}</span>
                            <span className="text-[9px] opacity-60 shrink-0 ml-1">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Weapons */}
              {availableWeaponTypes.length > 0 && (
                <div className="mb-3">
                  <button
                    onClick={() => setShowWeapons(!showWeapons)}
                    className="flex items-center gap-1 w-full text-[10px] font-mono text-text-secondary/70 uppercase tracking-wider mb-1.5 px-1 hover:text-text-secondary"
                  >
                    {showWeapons ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Weapons
                    {selectedWeaponTypes.size > 0 && (
                      <span className="ml-auto text-accent">{selectedWeaponTypes.size}</span>
                    )}
                  </button>
                  {showWeapons && (
                    <div className="space-y-0.5">
                      {availableWeaponTypes.map((wt) => {
                        const active = selectedWeaponTypes.has(wt);
                        const count = allMedia.filter(
                          (m) => m._weapon_types && m._weapon_types.includes(wt)
                        ).length;
                        return (
                          <button
                            key={wt}
                            onClick={() => setSelectedWeaponTypes(toggleSet(selectedWeaponTypes, wt))}
                            className={clsx(
                              "w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-sm transition-colors",
                              active
                                ? "bg-accent/15 text-accent"
                                : "text-text-secondary hover:bg-white/3"
                            )}
                          >
                            <span>{WEAPON_TYPE_LABELS[wt] || wt}</span>
                            <span className="text-[9px] opacity-60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ===== MEDIA GRID ===== */}
          <div className="flex-1 min-w-0">
            {filteredMedia.length === 0 ? (
              <div className="text-center py-16 text-xs font-mono text-text-secondary">
                No media matches the current filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredMedia.map((m) => (
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
                              className={
                                "px-1.5 py-0.5 text-[9px] font-mono font-medium rounded-sm " +
                                (TAG_COLORS[tag] || "bg-zinc-800 text-zinc-300")
                              }
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
     