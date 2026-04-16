"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Plus,
  Grid3X3,
  List,
  X,
  Crosshair,
  ChevronRight,
  Trash2,
  Edit3,
  Save,
} from "lucide-react";
import clsx from "clsx";
import type { Weapon, WeaponSlot } from "@/lib/types";

interface ObservedAttachment {
  slot: WeaponSlot;
  attachment_name: string;
  brand: string | null;
  count: number;
}
import { WEAPON_SLOT_LABELS } from "@/lib/types";

const WEAPON_TYPES = ["rifle", "carbine", "dmr", "sniper", "lmg", "smg", "pistol", "shotgun", "launcher"];

export default function GunsPage() {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon | null>(null);
  const [attachments, setAttachments] = useState<ObservedAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  // Add weapon state
  const [showAdd, setShowAdd] = useState(false);
  const [newWeapon, setNewWeapon] = useState({
    name: "",
    weapon_type: "rifle",
    caliber: "",
    brand: "",
    notes: "",
  });

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Weapon>>({});

  const loadWeapons = useCallback(async () => {
    setLoading(true);
    let url = "/api/weapons?";
    if (search.trim()) url += `q=${encodeURIComponent(search)}&`;
    if (filterType) url += `weapon_type=${encodeURIComponent(filterType)}&`;
    const res = await fetch(url);
    if (res.ok) setWeapons(await res.json());
    setLoading(false);
  }, [search, filterType]);

  useEffect(() => {
    loadWeapons();
  }, [loadWeapons]);

  // Load attachments that have been OBSERVED on this weapon in media posts
  useEffect(() => {
    if (!selectedWeapon) {
      setAttachments([]);
      return;
    }
    async function loadObserved() {
      const res = await fetch(
        "/api/weapons/observed-attachments?weapon_name=" +
          encodeURIComponent(selectedWeapon!.name)
      );
      if (res.ok) {
        const data: ObservedAttachment[] = await res.json();
        setAttachments(data);
      }
    }
    loadObserved();
  }, [selectedWeapon]);

  const handleAddWeapon = async () => {
    if (!newWeapon.name.trim()) return;
    const res = await fetch("/api/weapons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newWeapon),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewWeapon({ name: "", weapon_type: "rifle", caliber: "", brand: "", notes: "" });
      loadWeapons();
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedWeapon) return;
    const res = await fetch("/api/weapons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedWeapon.id, ...editData }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedWeapon(updated);
      setEditing(false);
      loadWeapons();
    }
  };

  const handleDeleteWeapon = async () => {
    if (!selectedWeapon) return;
    if (!confirm("Delete this weapon?")) return;
    const res = await fetch(`/api/weapons?id=${selectedWeapon.id}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedWeapon(null);
      loadWeapons();
    }
  };

  // Group observed attachments by slot
  const attachmentsBySlot: Partial<Record<WeaponSlot, ObservedAttachment[]>> = {};
  for (const a of attachments) {
    if (!attachmentsBySlot[a.slot]) attachmentsBySlot[a.slot] = [];
    attachmentsBySlot[a.slot]!.push(a);
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface">
          <div className="flex items-center bg-bg border border-border rounded-sm flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-text-secondary ml-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search weapons..."
              className="w-full bg-transparent px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary/50 outline-none"
            />
          </div>

          {/* Type filters */}
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-text-secondary mr-1" />
            {WEAPON_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(filterType === t ? null : t)}
                className={clsx(
                  "px-2 py-1 text-[10px] font-mono rounded-sm transition-colors border capitalize",
                  filterType === t
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-border text-text-secondary hover:text-text-primary"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-1.5 rounded-sm transition-colors",
                viewMode === "grid" ? "bg-amber-500/10 text-amber-400" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "p-1.5 rounded-sm transition-colors",
                viewMode === "table" ? "bg-amber-500/10 text-amber-400" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-sm hover:bg-amber-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Weapon
          </button>
        </div>

        {/* Weapons list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-xs font-mono text-text-secondary animate-pulse">
              Loading...
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {weapons.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelectedWeapon(selectedWeapon?.id === w.id ? null : w);
                    setEditing(false);
                  }}
                  className={clsx(
                    "text-left bg-surface border rounded-sm p-3 transition-colors",
                    selectedWeapon?.id === w.id
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Crosshair className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-mono text-amber-500/70 uppercase">{w.weapon_type}</span>
                  </div>
                  <div className="text-sm font-mono font-medium text-text-primary mb-0.5">
                    {w.name}
                  </div>
                  {w.brand && (
                    <div className="text-[11px] font-mono text-text-secondary">
                      {w.brand}
                    </div>
                  )}
                  {w.caliber && (
                    <div className="text-[10px] font-mono text-text-secondary/60 mt-1">
                      {w.caliber}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Brand</th>
                  <th className="pb-2 font-medium">Caliber</th>
                </tr>
              </thead>
              <tbody>
                {weapons.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => {
                      setSelectedWeapon(selectedWeapon?.id === w.id ? null : w);
                      setEditing(false);
                    }}
                    className={clsx(
                      "border-b border-border/30 cursor-pointer transition-colors",
                      selectedWeapon?.id === w.id ? "bg-amber-500/5" : "hover:bg-white/5"
                    )}
                  >
                    <td className="py-2 pr-3 text-amber-500 uppercase text-[10px]">{w.weapon_type}</td>
                    <td className="py-2 pr-3 text-text-primary">{w.name}</td>
                    <td className="py-2 pr-3 text-text-secondary">{w.brand || "—"}</td>
                    <td className="py-2 text-text-secondary">{w.caliber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedWeapon && (
        <aside className="w-80 border-l border-border bg-surface flex flex-col shrink-0 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary">
              Weapon Detail
            </span>
            <div className="flex items-center gap-1">
              {!editing && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditData({
                      name: selectedWeapon.name,
                      weapon_type: selectedWeapon.weapon_type,
                      caliber: selectedWeapon.caliber || "",
                      brand: selectedWeapon.brand || "",
                      notes: selectedWeapon.notes || "",
                    });
                  }}
                  className="text-text-secondary hover:text-text-primary p-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => { setSelectedWeapon(null); setEditing(false); }} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 py-3">
            {editing ? (
              <div className="space-y-2">
                <input
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm"
                  value={editData.name || ""}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Name"
                />
                <select
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm"
                  value={editData.weapon_type || "rifle"}
                  onChange={(e) => setEditData({ ...editData, weapon_type: e.target.value })}
                >
                  {WEAPON_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm"
                  value={editData.caliber || ""}
                  onChange={(e) => setEditData({ ...editData, caliber: e.target.value })}
                  placeholder="Caliber"
                />
                <input
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm"
                  value={editData.brand || ""}
                  onChange={(e) => setEditData({ ...editData, brand: e.target.value })}
                  placeholder="Brand"
                />
                <textarea
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm h-16"
                  value={editData.notes || ""}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Notes"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-amber-600 text-white text-xs rounded-sm hover:bg-amber-500">
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-text-secondary border border-border rounded-sm hover:bg-white/5">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Crosshair className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] text-amber-500 uppercase font-mono">{selectedWeapon.weapon_type}</span>
                </div>
                <div className="text-sm font-mono font-medium text-text-primary mb-0.5">
                  {selectedWeapon.name}
                </div>
                {selectedWeapon.brand && (
                  <div className="text-xs font-mono text-text-secondary mb-1">{selectedWeapon.brand}</div>
                )}
                {selectedWeapon.caliber && (
                  <div className="text-xs font-mono text-text-secondary/60 mb-2">{selectedWeapon.caliber}</div>
                )}
                {selectedWeapon.notes && (
                  <div className="text-[11px] font-mono text-text-secondary/70 mb-3 whitespace-pre-wrap">{selectedWeapon.notes}</div>
                )}
                <button
                  onClick={handleDeleteWeapon}
                  className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" /> Delete weapon
                </button>
              </>
            )}
          </div>

          {/* Attachments catalog */}
          <div className="px-3 py-2 border-t border-border">
            <div className="text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-2">
              Observed Attachments ({attachments.length})
            </div>
            {Object.entries(attachmentsBySlot).map(([slot, items]) => (
              <div key={slot} className="mb-2">
                <div className="text-[10px] font-mono text-amber-500/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <ChevronRight className="w-2.5 h-2.5" />
                  {WEAPON_SLOT_LABELS[slot as WeaponSlot]}
                </div>
                {items!.map((a, idx) => (
                  <div key={slot + idx} className="flex items-center gap-1.5 py-0.5 pl-3 text-[11px] font-mono">
                    <span className="text-text-primary">{a.attachment_name}</span>
                    {a.brand && <span className="text-text-secondary/50">({a.brand})</span>}
                    <span className="ml-auto text-[9px] font-mono text-amber-500/60">x{a.count}</span>
                  </div>
                ))}
              </div>
            ))}
            {attachments.length === 0 && (
              <div className="text-[10px] font-mono text-text-secondary/50">
                No attachments observed on this weapon yet.
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Add Weapon Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAdd(false)}>
          <div className="bg-surface border border-border p-5 w-96 rounded-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Add New Weapon</span>
              <button onClick={() => setShowAdd(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text"
                  value={newWeapon.name}
                  onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-amber-500/50"
                  placeholder="e.g., AK-105"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Type</label>
                <select
                  value={newWeapon.weapon_type}
                  onChange={(e) => setNewWeapon({ ...newWeapon, weapon_type: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm"
                >
                  {WEAPON_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Caliber</label>
                <input
                  type="text"
                  value={newWeapon.caliber}
                  onChange={(e) => setNewWeapon({ ...newWeapon, caliber: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none"
                  placeholder="e.g., 5.45x39mm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Brand</label>
                <input
                  type="text"
                  value={newWeapon.brand}
                  onChange={(e) => setNewWeapon({ ...newWeapon, brand: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none"
                  placeholder="e.g., Kalashnikov Concern"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  value={newWeapon.notes}
                  onChange={(e) => setNewWeapon({ ...newWeapon, notes: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none h-16"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-sm hover:bg-white/5">
                Cancel
              </button>
              <button onClick={handleAddWeapon} disabled={!newWeapon.name.trim()} className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-sm hover:bg-amber-500 disabled:opacity-30">
                Add Weapon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
