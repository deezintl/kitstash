"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { StatusDot } from "@/components/StatusDot";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SignatureModal } from "@/components/SignatureModal";
import {
  Search,
  Filter,
  Plus,
  Grid3X3,
  List,
  ExternalLink,
  X,
  Image as ImageIcon,
} from "lucide-react";
import clsx from "clsx";
import type { Item, Category, ProductionStatus, Media } from "@/lib/types";

const categories: Category[] = ["Recon", "Direct Action", "Arrest"];
const statuses: ProductionStatus[] = ["production", "discontinued"];

export default function GearPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProductionStatus | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemMedia, setItemMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  // Add item state
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    brand: "",
    category: "" as Category | "",
    status: "production" as ProductionStatus,
    purchase_url: "",
  });
  const [signatureOpen, setSignatureOpen] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("items").select("*").order("name");
    if (filterCategory) query = query.eq("category", filterCategory);
    if (filterStatus) query = query.eq("status", filterStatus);
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);
    }
    const { data } = await query;
    setItems(data || []);
    setLoading(false);
  }, [search, filterCategory, filterStatus]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Load media for selected item
  useEffect(() => {
    if (!selectedItem) {
      setItemMedia([]);
      return;
    }
    async function loadMedia() {
      const { data: annotations } = await supabase
        .from("annotations")
        .select("media_id")
        .eq("item_id", selectedItem!.id)
        .eq("status", "confirmed");

      if (!annotations || annotations.length === 0) {
        setItemMedia([]);
        return;
      }

      const mediaIds = [...new Set(annotations.map((a) => a.media_id))];
      const { data } = await supabase
        .from("media")
        .select("*")
        .in("id", mediaIds);
      setItemMedia(data || []);
    }
    loadMedia();
  }, [selectedItem]);

  const handleAddItem = useCallback(
    async (signatureName: string) => {
      setSignatureOpen(false);
      const { error } = await supabase.from("items").insert({
        name: newItem.name,
        brand: newItem.brand || null,
        category: newItem.category || null,
        status: newItem.status,
        purchase_url: newItem.purchase_url || null,
      });
      if (!error) {
        setShowAdd(false);
        setNewItem({ name: "", brand: "", category: "", status: "production", purchase_url: "" });
        loadItems();
      }
    },
    [newItem, loadItems]
  );

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
              placeholder="Search gear catalog..."
              className="w-full bg-transparent px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary/50 outline-none"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-text-secondary mr-1" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={clsx(
                  "px-2 py-1 text-[10px] font-mono rounded-sm transition-colors border",
                  filterCategory === cat
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:text-text-primary"
                )}
              >
                {cat}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-1" />
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(filterStatus === st ? null : st)}
                className={clsx(
                  "flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded-sm transition-colors border",
                  filterStatus === st
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:text-text-primary"
                )}
              >
                <StatusDot status={st} />
                {st === "production" ? "Prod" : "Disc"}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-1.5 rounded-sm transition-colors",
                viewMode === "grid" ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "p-1.5 rounded-sm transition-colors",
                viewMode === "table" ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-xs font-mono text-text-secondary animate-pulse">
              Loading...
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  className={clsx(
                    "text-left bg-surface border rounded-sm p-3 transition-colors",
                    selectedItem?.id === item.id
                      ? "border-accent/40 bg-accent/5"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <StatusDot status={item.status} />
                    {item.category && <CategoryBadge category={item.category} />}
                  </div>
                  <div className="text-sm font-mono font-medium text-text-primary mb-0.5">
                    {item.name}
                  </div>
                  {item.brand && (
                    <div className="text-[11px] font-mono text-text-secondary">
                      {item.brand}
                    </div>
                  )}
                  {item.purchase_url && (
                    <a
                      href={item.purchase_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-2 text-[10px] text-accent hover:underline"
                    >
                      Purchase <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Brand</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    className={clsx(
                      "border-b border-border/30 cursor-pointer transition-colors",
                      selectedItem?.id === item.id
                        ? "bg-accent/5"
                        : "hover:bg-white/5"
                    )}
                  >
                    <td className="py-2 pr-3">
                      <StatusDot status={item.status} />
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{item.name}</td>
                    <td className="py-2 pr-3 text-text-secondary">{item.brand || "—"}</td>
                    <td className="py-2 pr-3">
                      {item.category ? <CategoryBadge category={item.category} /> : "—"}
                    </td>
                    <td className="py-2">
                      {item.purchase_url ? (
                        <a
                          href={item.purchase_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-accent hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <aside className="w-72 border-l border-border bg-surface flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary">
              Item Detail
            </span>
            <button onClick={() => setSelectedItem(null)} className="text-text-secondary hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <StatusDot status={selectedItem.status} />
              <span className="text-xs text-text-secondary capitalize">{selectedItem.status}</span>
            </div>
            <div className="text-sm font-mono font-medium text-text-primary mb-0.5">
              {selectedItem.name}
            </div>
            {selectedItem.brand && (
              <div className="text-xs font-mono text-text-secondary mb-2">
                {selectedItem.brand}
              </div>
            )}
            {selectedItem.category && (
              <div className="mb-3">
                <CategoryBadge category={selectedItem.category} />
              </div>
            )}
            {selectedItem.purchase_url && (
              <a
                href={selectedItem.purchase_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline mb-3"
              >
                Purchase Link <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Media appearances */}
          <div className="px-3 py-2 border-t border-border">
            <div className="text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-2">
              Appears In ({itemMedia.length})
            </div>
            {itemMedia.length === 0 ? (
              <div className="text-[10px] font-mono text-text-secondary/50">
                No media tagged with this item
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {itemMedia.map((m) => (
                  <a
                    key={m.id}
                    href={`/media/${m.id}`}
                    className="aspect-video bg-bg border border-border rounded-sm overflow-hidden hover:border-accent/30 transition-colors"
                  >
                    {m.thumbnail_url || m.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.thumbnail_url || m.storage_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-text-secondary/30" />
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Add Item Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-surface border border-border p-5 w-96 rounded-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Add New Gear Item</span>
              <button onClick={() => setShowAdd(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
                  placeholder="e.g., JPC 2.0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  value={newItem.brand}
                  onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
                  placeholder="e.g., Crye Precision"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value as Category })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={newItem.status}
                  onChange={(e) => setNewItem({ ...newItem, status: e.target.value as ProductionStatus })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
                >
                  <option value="production">In Production</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                  Purchase URL
                </label>
                <input
                  type="url"
                  value={newItem.purchase_url}
                  onChange={(e) => setNewItem({ ...newItem, purchase_url: e.target.value })}
                  className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary rounded-sm outline-none focus:border-accent/50"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => setSignatureOpen(true)}
                disabled={!newItem.name.trim()}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-accent text-bg rounded-sm hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      <SignatureModal
        open={signatureOpen}
        onConfirm={handleAddItem}
        onCancel={() => setSignatureOpen(false)}
        actionLabel="Sign & Add"
      />
    </div>
  );
}
