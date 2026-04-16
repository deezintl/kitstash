"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Plus,
  ExternalLink,
  X,
  Trash2,
  Edit3,
  Save,
} from "lucide-react";
import clsx from "clsx";
import type { AttachmentCatalog, WeaponSlot } from "@/lib/types";
import { WEAPON_SLOT_LABELS } from "@/lib/types";

const WEAPON_SLOTS: WeaponSlot[] = [
  "muzzle_device", "handguard", "foregrip", "flashlight",
  "laser", "optic_rail", "optic", "stock", "magazine", "suppressor", "other",
];

export default function AttachmentsPage() {
  const [attachments, setAttachments] = useState<AttachmentCatalog[]>([]);
  const [search, setSearch] = useState("");
  const [filterSlot, setFilterSlot] = useState<WeaponSlot | null>(null);
  const [selected, setSelected] = useState<AttachmentCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newAtt, setNewAtt] = useState({
    name: "",
    slot: "optic" as WeaponSlot,
    brand: "",
    purchase_url: "",
    notes: "",
  });

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<AttachmentCatalog>>({});

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/attachments");
    if (res.ok) {
      const all: AttachmentCatalog[] = await res.json();
      setAttachments(all);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  const filtered = attachments.filter((a) => {
    if (filterSlot && a.slot !== filterSlot) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!a.name.toLowerCase().includes(s) && !(a.brand || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  // Group by slot
  const bySlot: Partial<Record<WeaponSlot, AttachmentCatalog[]>> = {};
  for (const a of filtered) {
    if (!bySlot[a.slot]) bySlot[a.slot] = [];
    bySlot[a.slot]!.push(a);
  }

  const handleAdd = async () => {
    if (!newAtt.name.trim()) return;
    const res = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAtt),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewAtt({ name: "", slot: "optic", brand: "", purchase_url: "", notes: "" });
      loadAttachments();
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    const res = await fetch("/api/attachments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, ...editData }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
      setEditing(false);
      loadAttachments();
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm("Delete this attachment?")) return;
    const res = await fetch(`/api/attachments?id=${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      setSelected(null);
      loadAttachments();
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface">
          <div className="flex items-center bg-bg border border-border rounded-sm flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-text-secondary ml-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attachments..."
              className="w-full bg-transparent px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary/50 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-text-secondary mr-1" />
            {WEAPON_SLOTS.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSlot(filterSlot === s ? null : s)}
                className={clsx(
                  "px-2 py-1 text-[10px] font-mono rounded-sm transition-colors border",
                  filterSlot === s
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-border text-text-secondary hover:text-text-primary"
                )}
              >
                {WEAPON_SLOT_LABELS[s]}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-sm hover:bg-amber-500 transition-colors ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Attachment
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-xs font-mono text-text-secondary animate-pulse">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-text-secondary">No attachments found.</div>
          ) : (
            Object.entries(bySlot).map(([slot, items]) => (
              <div key={slot} className="mb-5">
                <div className="text-[10px] font-mono text-amber-500/70 uppercase tracking-wider mb-2">
                  {WEAPON_SLOT_LABELS[slot as WeaponSlot]} ({items!.length})
                </div>
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                  {items!.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { setSelected(selected?.id === a.id ? null : a); setEditing(false); }}
                      className={clsx(
                        "text-left bg-surface border rounded-sm p-2.5 transition-colors",
                        selected?.id === a.id ? "border-amber-500/40 bg-amber-500/5" : "border-border hover:border-border/80"
                      )}
                    >
                      <div className="text-xs font-mono font-medium text-text-primary truncate">{a.name}</div>
                      {a.brand && <div className="text-[10px] font-mono text-text-secondary truncate">{a.brand}</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <aside className="w-80 border-l border-border bg-surface flex flex-col shrink-0 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary">
              Attachment Detail
            </span>
            <div className="flex items-center gap-1">
              {!editing && (
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditData({
                      name: selected.name,
                      slot: selected.slot,
                      brand: selected.brand || "",
                      purchase_url: selected.purchase_url || "",
                      notes: selected.notes || "",
                    });
                  }}
                  className="text-text-secondary hover:text-text-primary p-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => { setSelected(null); setEditing(false); }} className="text-text-secondary hover:text-text-primary p-1">
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
                  value={editData.slot || "optic"}
                  onChange={(e) => setEditData({ ...editData, slot: e.target.value as WeaponSlot })}
                >
                  {WEAPON_SLOTS.map((s) => (
                    <option key={s} value={s}>{WEAPON_SLOT_LABELS[s]}</option>
                  ))}
                </select>
                <input
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm"
                  value={editData.brand || ""}
                  onChange={(e) => setEditData({ ...editData, brand: e.target.value })}
                  placeholder="Brand"
                />
                <input
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm"
                  value={editData.purchase_url || ""}
                  onChange={(e) => setEditData({ ...editData, purchase_url: e.target.value })}
                  placeholder="Purchase URL"
                />
                <textarea
                  className="w-full bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary rounded-sm h-16"
                  value={editData.notes || ""}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Notes"
                />
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-amber-600 text-white text-xs rounded-sm hover:bg-amber-500">
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-text-secondary border border-border rounded-sm hover:bg-white/5">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-[10px] text-amber-500/70 uppercase font-mono mb-1">
                  {WEAPON_SLOT_LABELS[selected.slot]}
                </div>
                <div className="text-sm font-mono font-medium text-text-primary mb-0.5">{selected.name}</div>
                {selected.brand && <div className="text-xs font-mono text-text-secondary mb-1">{selected.brand}</div>}
                {selected.purchase_url && (
                  <a href={selected.purchase_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-400 mb-2">
                    <ExternalLink className="w-3 h-3" /> Purchase link
                  </a>
                )}
                {selected.notes && (
                  <div className="text-[11px] font-mono text-text-secondary/70 mb-3 whitespace-pre-wrap">{selected.notes}</div>
                )}
                <button onClick={handleDelete} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300">
                  <Trash2 className="w-3 h-3" /> Delete attachment
                </button>
              </>
            )}
          </div>
        </aside>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAdd(false)}>
          <div className="bg-surface border border-border p-5 w-96 rounded-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Add Attachment</span>
              <button onClick={() => setShowAdd(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text"
                  value={newAtt.name}
                  onChange={(e) => setNewAtt({ ...newAtt, name: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-amber-500/50"
                  placeholder="e.g., Aimpoint CompM4"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Slot</label>
                <select
                  value={newAtt.slot}
                  onChange={(e) => setNewAtt({ ...newAtt, slot: e.target.value as WeaponSlot })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm"
                >
                  {WEAPON_SLOTS.map((s) => (
                    <option key={s} value={s}>{WEAPON_SLOT_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Brand</label>
                <input
                  type="text"
                  value={newAtt.brand}
                  onChange={(e) => setNewAtt({ ...newAtt, brand: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Purchase URL</label>
                <input
                  type="text"
                  value={newAtt.purchase_url}
                  onChange={(e) => setNewAtt({ ...newAtt, purchase_url: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">Notes</label>
                <textarea
                  value={newAtt.notes}
                  onChange={(e) => setNewAtt({ ...newAtt, notes: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none h-16"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-sm hover:bg-white/5">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={!newAtt.name.trim()} className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-sm hover:bg-amber-500 disabled:opacity-30">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
