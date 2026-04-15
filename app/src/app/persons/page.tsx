"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Search, User, Image as ImageIcon } from "lucide-react";

interface PersonWithMedia {
  id: string;
  callsign: string;
  real_name: string | null;
  notes: string | null;
  created_at: string;
  media_count: number;
  media_ids: string[];
}

export default function PersonsPage() {
  const [persons, setPersons] = useState<PersonWithMedia[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get all persons
      const { data: personsData } = await supabase
        .from("persons")
        .select("*")
        .order("callsign");

      // Get media_persons to count media per person
      const { data: mpData } = await supabase
        .from("media_persons")
        .select("person_id, media_id");

      const mediaByPerson: Record<string, Set<string>> = {};
      for (const mp of mpData || []) {
        if (!mp.person_id) continue;
        if (!mediaByPerson[mp.person_id]) mediaByPerson[mp.person_id] = new Set();
        mediaByPerson[mp.person_id].add(mp.media_id);
      }

      const enriched = (personsData || []).map((p) => ({
        ...p,
        media_count: mediaByPerson[p.id] ? mediaByPerson[p.id].size : 0,
        media_ids: mediaByPerson[p.id] ? Array.from(mediaByPerson[p.id]) : [],
      }));

      setPersons(enriched);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = persons.filter(
    (p) =>
      p.callsign.toLowerCase().includes(search.toLowerCase()) ||
      (p.real_name && p.real_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Person Directory</h1>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="bg-zinc-900 border border-zinc-700 rounded pl-7 pr-3 py-1.5 text-sm text-zinc-200 w-64"
            placeholder="Search by callsign or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-center py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-500 text-center py-12">
          {search ? "No persons match your search." : "No persons in the database yet. Tag someone in a media file to get started."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-900/40 border border-blue-800 flex items-center justify-center">
                  <User size={18} className="text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-100">{p.callsign}</div>
                  {p.real_name && (
                    <div className="text-xs text-zinc-500">{p.real_name}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                <ImageIcon size={12} />
                <span>{p.media_count} media file{p.media_count !== 1 ? "s" : ""}</span>
              </div>

              {p.notes && (
                <div className="text-xs text-zinc-500 mb-3 line-clamp-2">{p.notes}</div>
              )}

              {p.media_ids.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {p.media_ids.slice(0, 4).map((mid) => (
                    <Link
                      key={mid}
                      href={`/media/${mid}`}
                      className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-700"
                    >
                      View
                    </Link>
                  ))}
                  {p.media_ids.length > 4 && (
                    <span className="text-[10px] text-zinc-600">
                      +{p.media_ids.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
