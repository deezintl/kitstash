"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MediaCanvas } from "@/components/MediaCanvas";
import { PersonPanel } from "@/components/PersonPanel";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ArrowLeft, Tag, Users } from "lucide-react";
import type { Media, Annotation, MediaPerson, Person, MediaTag } from "@/lib/types";

const TAG_OPTIONS: MediaTag[] = ["Direct Action", "Recon", "Arrest"];

export default function MediaDetailPage() {
  const params = useParams();
  const mediaId = params.id as string;

  const [media, setMedia] = useState<Media | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [mediaPersons, setMediaPersons] = useState<MediaPerson[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [mediaRes, annRes, personsRes] = await Promise.all([
      supabase.from("media").select("*, kit:kits(*)").eq("id", mediaId).single(),
      supabase.from("annotations").select("*, item:items(*)").eq("media_id", mediaId).order("created_at"),
      supabase.from("persons").select("*").order("callsign"),
    ]);

    if (mediaRes.data) setMedia(mediaRes.data as unknown as Media);
    if (annRes.data) setAnnotations(annRes.data as unknown as Annotation[]);
    if (personsRes.data) setAllPersons(personsRes.data as unknown as Person[]);

    // Load media persons with nested gear and weapons
    const mpRes = await fetch(`/api/media-persons?media_id=${mediaId}`);
    if (mpRes.ok) {
      const mpData = await mpRes.json();
      setMediaPersons(mpData);
    }
    setLoading(false);
  }, [mediaId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleTag = async (tag: MediaTag) => {
    if (!media) return;
    const current = media.tags || [];
    const newTags = current.includes(tag)
      ? current.filter((t: string) => t !== tag)
      : [...current, tag];
    const res = await fetch("/api/media/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId, tags: newTags }),
    });
    if (res.ok) {
      setMedia({ ...media, tags: newTags });
    }
  };

  const handleAddPerson = async () => {
    const nextIndex = mediaPersons.length + 1;
    const res = await fetch("/api/media-persons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId, person_index: nextIndex }),
    });
    if (res.ok) loadData();
  };

  const handleRemovePerson = async (mpId: string) => {
    await fetch(`/api/media-persons?id=${mpId}`, { method: "DELETE" });
    loadData();
  };

  const handleAssignPerson = async (mpId: string, personId: string | null) => {
    // Update the person_id on a media_person
    const { error } = await supabase
      .from("media_persons")
      .update({ person_id: personId })
      .eq("id", mpId);
    if (!error) loadData();
  };

  const handleCreatePerson = async (callsign: string): Promise<Person | null> => {
    const res = await fetch("/api/persons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callsign }),
    });
    if (res.ok) {
      const person = await res.json();
      setAllPersons((prev) => [...prev, person]);
      return person;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Media not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-zinc-400 hover:text-white flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="text-zinc-600">|</span>
        <span className="text-sm text-zinc-400">
          {media.type === "image" ? "Image" : "Video"} — {new Date(media.created_at).toLocaleDateString()}
        </span>

        {/* Image-level tags */}
        <div className="ml-auto flex items-center gap-2">
          <Tag size={14} className="text-zinc-500" />
          {TAG_OPTIONS.map((tag) => {
            const active = (media.tags || []).includes(tag);
            return (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                  active
                    ? tag === "Direct Action"
                      ? "bg-red-900/60 text-red-300 border border-red-700"
                      : tag === "Recon"
                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                      : "bg-amber-900/60 text-amber-300 border border-amber-700"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main layout: Image left, Person panels right */}
      <div className="flex h-[calc(100vh-53px)]">
        {/* Left: Image with bounding boxes */}
        <div className="flex-1 overflow-auto p-4">
          <MediaCanvas media={media} annotations={annotations} />
        </div>

        {/* Right: Person hierarchy sidebar */}
        <div className="w-[480px] border-l border-zinc-800 overflow-y-auto">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-zinc-400" />
              <span className="text-sm font-medium">
                Persons ({mediaPersons.length})
              </span>
            </div>
            <button
              onClick={handleAddPerson}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
            >
              + Add Person
            </button>
          </div>

          {mediaPersons.length === 0 && (
            <div className="p-8 text-center text-zinc-600 text-sm">
              No persons tagged yet. Click &quot;Add Person&quot; to start identifying people in this image.
            </div>
          )}

          {mediaPersons.map((mp) => (
            <PersonPanel
              key={mp.id}
              mediaPerson={mp}
              allPersons={allPersons}
              onAssignPerson={handleAssignPerson}
              onCreatePerson={handleCreatePerson}
              onRemove={handleRemovePerson}
              onDataChange={loadData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
