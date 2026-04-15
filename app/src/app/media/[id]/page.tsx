"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MediaCanvas } from "@/components/MediaCanvas";
import { PersonPanel } from "@/components/PersonPanel";
import { ArrowLeft, Tag, Users, MapPin } from "lucide-react";
import type { Media, Annotation, MediaPerson, Person, MediaTag, Coords } from "@/lib/types";

const TAG_OPTIONS: MediaTag[] = ["Direct Action", "Recon", "Arrest"];

interface PersonDotData {
  id: string;
  media_person_id: string;
  person_index: number;
  x: number;
  y: number;
  callsign?: string | null;
}

export default function MediaDetailPage() {
  const params = useParams();
  const mediaId = params.id as string;

  const [media, setMedia] = useState<Media | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [mediaPersons, setMediaPersons] = useState<MediaPerson[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [personDots, setPersonDots] = useState<PersonDotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePersonIndex, setActivePersonIndex] = useState<number | null>(null);
  const [placingDotFor, setPlacingDotFor] = useState<string | null>(null);
  const [gearAnnotationMode, setGearAnnotationMode] = useState<{
    gearId: string;
    gearName: string;
    personIndex: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    const [mediaRes, annRes, personsRes] = await Promise.all([
      supabase.from("media").select("*, kit:kits(*)").eq("id", mediaId).single(),
      supabase.from("annotations").select("*, item:items(*)").eq("media_id", mediaId).order("created_at"),
      supabase.from("persons").select("*").order("callsign"),
    ]);

    if (mediaRes.data) setMedia(mediaRes.data as unknown as Media);
    if (annRes.data) setAnnotations(annRes.data as unknown as Annotation[]);
    if (personsRes.data) setAllPersons(personsRes.data as unknown as Person[]);

    const mpRes = await fetch("/api/media-persons?media_id=" + mediaId);
    if (mpRes.ok) {
      const mpData = await mpRes.json();
      setMediaPersons(mpData);

      // Build person dots from media_persons that have dot_x/dot_y stored
      const dots: PersonDotData[] = [];
      for (const mp of mpData) {
        if (mp.dot_x != null && mp.dot_y != null) {
          dots.push({
            id: mp.id,
            media_person_id: mp.id,
            person_index: mp.person_index,
            x: mp.dot_x,
            y: mp.dot_y,
            callsign: mp.person?.callsign || null,
          });
        }
      }
      setPersonDots(dots);
    }
    setLoading(false);
  }, [mediaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    if (res.ok) {
      const mp = await res.json();
      // Immediately start placing dot for this person
      setPlacingDotFor(mp.id);
      loadData();
    }
  };

  const handleRemovePerson = async (mpId: string) => {
    await fetch("/api/media-persons?id=" + mpId, { method: "DELETE" });
    loadData();
  };

  const handleAssignPerson = async (mpId: string, personId: string | null) => {
    await supabase
      .from("media_persons")
      .update({ person_id: personId })
      .eq("id", mpId);
    loadData();
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

  const handlePlacePersonDot = async (mpId: string, x: number, y: number) => {
    await supabase
      .from("media_persons")
      .update({ dot_x: x, dot_y: y })
      .eq("id", mpId);
    setPlacingDotFor(null);
    loadData();
  };

  const handlePersonDotClick = (personIndex: number) => {
    setActivePersonIndex(activePersonIndex === personIndex ? null : personIndex);
    // Scroll to that person panel
    const el = document.getElementById(`person-panel-${personIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRequestAnnotation = (gearId: string, gearName: string, personIndex: number) => {
    setGearAnnotationMode({ gearId, gearName, personIndex });
  };

  const handleGearAnnotationComplete = async (gearId: string, coords: Coords) => {
    // Create an annotation linked to this gear item
    await supabase.from("annotations").insert({
      media_id: mediaId,
      item_id: null,
      coords,
      status: "confirmed",
      confidence: null,
    });
    setGearAnnotationMode(null);
    loadData();
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

  const tagColors: Record<string, string> = {
    "Direct Action": "bg-red-900/60 text-red-300 border-red-700",
    "Recon": "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    "Arrest": "bg-amber-900/60 text-amber-300 border-amber-700",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-zinc-400 hover:text-white flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="text-zinc-600">|</span>
        <span className="text-sm text-zinc-400">
          {media.type === "image" ? "Image" : "Video"} &mdash; {new Date(media.created_at).toLocaleDateString()}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Tag size={14} className="text-zinc-500" />
          {TAG_OPTIONS.map((tag) => {
            const active = (media.tags || []).includes(tag);
            return (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className={"px-2 py-0.5 rounded text-xs font-medium border transition " +
                  (active
                    ? tagColors[tag]
                    : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-500")}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex h-[calc(100vh-53px)]">
        <div className="flex-1 overflow-auto p-4">
          <MediaCanvas
            media={media}
            annotations={annotations}
            onAnnotationsChange={loadData}
            personDots={personDots}
            activePersonIndex={activePersonIndex}
            onPersonDotClick={handlePersonDotClick}
            onPlacePersonDot={handlePlacePersonDot}
            placingDotForPerson={placingDotFor}
            gearAnnotationMode={gearAnnotationMode}
            onGearAnnotationComplete={handleGearAnnotationComplete}
            onCancelGearAnnotation={() => setGearAnnotationMode(null)}
          />
        </div>
        <div className="w-[480px] border-l border-zinc-800 overflow-y-auto">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-zinc-400" />
              <span className="text-sm font-medium">Persons ({mediaPersons.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {placingDotFor && (
                <button
                  onClick={() => setPlacingDotFor(null)}
                  className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded"
                >
                  Cancel Dot
                </button>
              )}
              <button
                onClick={handleAddPerson}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
              >
                + Add Person
              </button>
            </div>
          </div>
          {mediaPersons.length === 0 && (
            <div className="p-8 text-center text-zinc-600 text-sm">
              No persons tagged yet. Click &quot;Add Person&quot; to start.
            </div>
          )}
          {mediaPersons.map((mp) => (
            <div
              key={mp.id}
              id={`person-panel-${mp.person_index}`}
              className={activePersonIndex === mp.person_index ? "ring-1 ring-blue-500/30" : ""}
            >
              <div className="flex items-center justify-end px-3 pt-1 gap-1">
                {(!personDots.find((d) => d.media_person_id === mp.id)) && (
                  <button
                    onClick={() => setPlacingDotFor(mp.id)}
                    className="text-[10px] text-zinc-600 hover:text-blue-400 flex items-center gap-0.5"
                    title="Place dot on image"
                  >
                    <MapPin size={10} /> Place dot
                  </button>
                )}
              </div>
              <PersonPanel
                mediaPerson={mp}
                allPersons={allPersons}
                onAssignPerson={handleAssignPerson}
                onCreatePerson={handleCreatePerson}
                onRemove={handleRemovePerson}
                onDataChange={loadData}
                onRequestAnnotation={handleRequestAnnotation}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
