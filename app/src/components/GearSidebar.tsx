"use client";

import { useState, useEffect } from "react";
import { Search, Filter, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StatusDot } from "./StatusDot";
import { CategoryBadge } from "./CategoryBadge";
import clsx from "clsx";
import type { Item, Category, ProductionStatus } from "@/lib/types";

interface GearSidebarProps {
  onItemSelect?: (item: Item) => void;
  selectedItemId?: string | null;
}

const categories: Category[] = ["Recon", "Direct Action", "Arrest", "Comp/Exercise"];
const statuses: ProductionStatus[] = ["production", "discontinued"];

export function GearSidebar({ onItemSelect, selectedItemId }: GearSidebarProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProductionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [search, filterCategory, filterStatus]);

  return (
    <aside className="w-72 border-r border-border bg-surface flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-secondary mb-2">
          Gear Database
        </div>
        <div className="flex items-center bg-bg border border-border rounded-sm">
          <Search className="w-3.5 h-3.5 text-text-secondary ml-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full bg-transparent px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary/50 outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1 mb-1.5">
          <Filter className="w-3 h-3 text-text-secondary" />
          <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
            Filters
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={clsx(
                "px-1.5 py-0.5 text-[10px] font-mono rounded-sm transition-colors border",
                filterCategory === cat
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-text-secondary hover:text-text-primary"
              )}
            >
              {cat}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-0.5" />
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(filterStatus === st ? null : st)}
              className={clsx(
                "flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded-sm transition-colors border",
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
      </div>

      {/* Item List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="text-xs font-mono text-text-secondary animate-pulse">
              Loading...
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-text-secondary">
            No items found
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemSelect?.(item)}
              className={clsx(
                "w-full flex items-center gap-2 px-3 py-2 text-left border-b border-border/50 hover:bg-white/5 transition-colors",
                selectedItemId === item.id && "bg-accent/5 border-l-2 border-l-accent"
              )}
            >
              <StatusDot status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-text-primary truncate">
                  {item.name}
                </div>
                {item.brand && (
                  <div className="text-[10px] font-mono text-text-secondary truncate">
                    {item.brand}
                  </div>
                )}
              </div>
              {item.category && <CategoryBadge category={item.category} />}
              {item.purchase_url && (
                <ExternalLink className="w-3 h-3 text-text-secondary/50 shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] font-mono text-text-secondary">
        {items.length} item{items.length !== 1 ? "s" : ""}
      </div>
    </aside>
  );
}
