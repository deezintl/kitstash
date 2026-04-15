"use client";

import { useState, useEffect, useRef } from "react";

interface SearchResult {
  id: string;
  name: string;
  brand?: string | null;
}

interface SearchableInputProps {
  fetchUrl: string;
  placeholder?: string;
  onSelect: (item: SearchResult) => void;
  onCustomSubmit?: (name: string) => void;
  className?: string;
  autoFocus?: boolean;
}

export function SearchableInput({
  fetchUrl,
  placeholder = "Search...",
  onSelect,
  onCustomSubmit,
  className = "",
  autoFocus = false,
}: SearchableInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      // Still fetch defaults when empty
      const controller = new AbortController();
      setLoading(true);
      fetch(fetchUrl, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          setResults(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return () => controller.abort();
    }

    const controller = new AbortController();
    setLoading(true);
    const url = fetchUrl.includes("?")
      ? `${fetchUrl}&q=${encodeURIComponent(query)}`
      : `${fetchUrl}?q=${encodeURIComponent(query)}`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setHighlighted(-1);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => controller.abort();
  }, [query, fetchUrl]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < results.length) {
        onSelect(results[highlighted]);
        setQuery("");
        setOpen(false);
      } else if (query.trim() && onCustomSubmit) {
        onCustomSubmit(query.trim());
        setQuery("");
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-blue-500/50"
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-zinc-900 border border-zinc-700 rounded shadow-xl max-h-48 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-2 py-1.5 text-[10px] text-zinc-500">Loading...</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item);
                setQuery("");
                setOpen(false);
              }}
              className={`w-full text-left px-2 py-1 text-xs flex items-center gap-1.5 transition-colors ${
                i === highlighted
                  ? "bg-blue-600/30 text-white"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <span className="truncate">{item.name}</span>
              {item.brand && (
                <span className="text-[10px] text-zinc-500 flex-shrink-0">({item.brand})</span>
              )}
            </button>
          ))}
          {!loading && results.length === 0 && query.trim() && (
            <div className="px-2 py-1.5 text-[10px] text-zinc-500">
              No matches.{onCustomSubmit && " Press Enter to add custom."}
            </div>
          )}
          {onCustomSubmit && query.trim() && (
            <button
              onClick={() => {
                onCustomSubmit(query.trim());
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:bg-zinc-800 border-t border-zinc-800"
            >
              + Add &quot;{query}&quot; as custom entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
