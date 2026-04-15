"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StatusDot } from "./StatusDot";
import { CategoryBadge } from "./CategoryBadge";
import type { Item } from "@/lib/types";

interface ItemSearchProps {
  onSelect: (item: Item) => void;
  placeholder?: string;
}

export function ItemSearch({ onSelect, placeholder = "Search gear..." }: ItemSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("items")
        .select("*")
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(10);
      setResults(data || []);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center bg-bg border border-border rounded-sm">
        <Search className="w-3.5 h-3.5 text-text-secondary ml-2.5" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary/50 outline-none"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-sm shadow-xl z-40 max-h-48 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
            >
              <StatusDot status={item.status} />
              <span className="text-xs font-mono text-text-primary truncate">
                {item.brand && <span className="text-text-secondary">{item.brand} </span>}
                {item.name}
              </span>
              {item.category && (
                <CategoryBadge category={item.category} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
