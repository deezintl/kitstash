"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MediaCanvas } from "@/components/MediaCanvas";
import { PersonPanel } from "@/components/PersonPanel";
import { ArrowLeft, ChevronLeft, ChevronRight, Tag, Users, MapPin, FileText, Save, Edit3, Trash2, X } from "lucide-react";
import type { Media, Annotation, MediaPerson, Person, MediaTag, Coords } from "@/lib/types";

const TAG_OPTIONS: MediaTag[] = ["Direct Action", "Recon", "Arrest", "Comp/Exercise", "Winter/Snow", "Patches", "Calendar", "Misc"];

interface PersonDotData {
  id: string;
  media_person_id: string;
  person_index: number;
  x: number;
  y: number;
  callsign?: string | null;
}

const tagColors: Record<string, string> = {
  "Direct Action": "bg-red-900/60 text-red-300 border-red-700",
  Recon: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  Arrest: "bg-amber-900/60 text-amber-300 border-amber-700",
  "Comp/Exercise": "bg-violet-900/60 text-violet-300 border-violet-700",
  "Winter/Snow": "bg-sky-900/60 text-sky-300 border-sky-700",
  Patches: "bg-pink-900/60 text-pink-300 border-pink-700",
  Calendar: "bg-teal-900/60 text-teal-300 border-teal-700",
  Misc: "bg-zinc-800/60 text-zinc-300 border-zinc-700",
};

export default function MediaDetailPage() {
  const params = useParams();
  const router = useRouter();
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
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mediaIds, setMediaIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const [mediaRes, annRes, personsRes] = await Promise.all([
      supabase.from("media").select("*, kit:kits(*)").eq("id", mediaId).single(),
      supabase.from("annotations").select("*, item:items(*)").eq("media_id", mediaId).order("created_at"),
      supabase.from("persons").select("*").order("callsign"),
    ]);

    if (mediaRes.data) setMedia(mediaRes.data as unknown as Media);
    if (annRes.data) setAnnotations(annRes.data as unknown as Annotation[]);
    if (personsRes.data) setAllPersons(personsRes.data as unknown as Person[]);

    // Fetch ordered media ID list for prev/next navigation
    const idsRes = await supabase
      .from("media")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (idsRes.data) {
      setMediaIds((idsRes.data as { id: string }[]).map((r) => r.id));
    }

    const mpRes = await fetch("/api/media-persons?media_id=" + mediaId);
    if (mpRes.ok) {
      const mpData = await mpRes.json();
      setMediaPersons(mpData);
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

  useEffect(() => { loadData(); }, [loadData]);

  const currentIdx = mediaIds.indexOf(mediaId);
  const prevId = currentIdx > 0 ? mediaIds[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < mediaIds.length - 1 ? mediaIds[currentIdx + 1] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowLeft" && prevId) {
        router.push("/media/" + prevId);
      } else if (e.key === "ArrowRight" && nextId) {
        router.push("/media/" + nextId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevId, nextId, router]);

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
    if (res.ok) setMedia({ ...media, tags: newTags });
  };

  const handleRemoveTag = async (tag: string) => {
    if (!media) return;
    const newTags = (media.tags || []).filter((t: string) => t !== tag);
    const res = await fetch("/api/media/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId, tags: newTags }),
    });
    if (res.ok) setMedia({ ...media, tags: newTags });
  };

  const handleDeleteMedia = async () => {
    setDeleting(true);
    const res = await fetch("/api/media/delete?id=" + mediaId, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
      setPlacingDotFor(mp.id);
      loadData();
    }
  };

  const handleRemovePerson = async (mpId: string) => {
    await fetch("/api/media-persons?id=" + mpId, { method: "DELETE" });
    loadData();
  };

  const handleAssignPerson = async (mpId: string, personId: string | null) => {
    await supabase.from("media_persons").update({ person_id: personId }).eq("id", mpId);
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
    await supabase.from("media_persons").update({ dot_x: x, dot_y: y }).eq("id", mpId);
    setPlacingDotFor(null);
    loadData();
  };

  const handlePersonDotClick = (personIndex: number) => {
    setActivePersonIndex(activePersonIndex === personIndex ? null : personIndex);
    const el = document.getElementById("person-panel-" + personIndex);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRequestAnnotation = (gearId: string, gearName: string, personIndex: number) => {
    setGearAnnotationMode({ gearId, gearName, personIndex });
  };

  const handleGearAnnotationComplete = async (gearId: string, coords: Coords) => {
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

  const handleSaveNotes = async () => {
    if (!media) return;
    setSavingNotes(true);
    const res = await fetch("/api/media/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId, notes: notesText.trim() || null }),
    });
    if (res.ok) {
      setMedia({ ...media, notes: notesText.trim() || null });
      setEditingNotes(false);
    }
    setSavingNotes(false);
  };

  const handleNotesTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setNotesText(text);
    setEditingNotes(true);
    e.target.value = "";
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
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-zinc-400 hover:text-white flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="text-zinc-600">|</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => prevId && router.push("/media/" + prevId)}
            disabled={!prevId}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous image (←)"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-mono text-zinc-500 min-w-[60px] text-center">
            {currentIdx >= 0 ? `${currentIdx + 1} / ${mediaIds.length}` : ""}
          </span>
          <button
            onClick={() => nextId && router.push("/media/" + nextId)}
            disabled={!nextId}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next image (→)"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="text-zinc-600">|</span>
        <span className="text-sm text-zinc-400">
          {media.type === "image" ? "Image" : "Video"} &mdash; {new Date(media.created_at).toLocaleDateString()}
        </span>

        {/* Active tags with X to remove */}
        {media.tags && media.tags.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            {media.tags.map((tag) => (
              <span
                key={tag}
                className={"inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border " + (tagColors[tag] || "bg-zinc-800 text-zinc-400 border-zinc-700")}
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-white ml-0.5"
                  title="Remove tag"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Tag size={14} className="text-zinc-500" />
          {TAG_OPTIONS.map((tag) => {
            const active = (media.tags || []).includes(tag);
            if (active) return null;
            return (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className="px-2 py-0.5 rounded text-xs font-medium border transition bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-500"
              >
                + {tag}
              </button>
            );
          })}

          <span className="text-zinc-700 mx-1">|</span>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
              title="Delete image"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Delete this image?</span>
              <button
                onClick={handleDeleteMedia}
                disabled={deleting}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
              >
                {deleting ? "Deleting..." : "Confirm"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded"
              >
                Cancel
              </button>
            </div>
          )}
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
              id={"person-panel-" + mp.person_index}
              className={activePersonIndex === mp.person_index ? "ring-1 ring-blue-500/30" : ""}
            >
              <div className="flex items-center justify-end px-3 pt-1 gap-1">
                {!personDots.find((d) => d.media_person_id === mp.id) && (
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

          {/* Notes section */}
          <div className="border-t border-zinc-800">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-zinc-400" />
                <span className="text-sm font-medium">Notes</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-blue-400 cursor-pointer">
                  <FileText size={10} />
                  .txt
                  <input type="file" accept=".txt" className="hidden" onChange={handleNotesTxtUpload} />
                </label>
                {!editingNotes ? (
                  <button
                    onClick={() => { setNotesText(media?.notes || ""); setEditingNotes(true); }}
                    className="text-zinc-500 hover:text-blue-400 p-1"
                    title="Edit notes"
                  >
                    <Edit3 size={12} />
                  </button>
                ) : (
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="text-blue-400 hover:text-blue-300 p-1"
                    title="Save notes"
                  >
                    <Save size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="p-3">
              {editingNotes ? (
                <div>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-blue-500/50 h-32 resize-y"
                    placeholder="Enter notes about this image..."
                    autoFocus
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                    >
                      {savingNotes ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : media?.notes ? (
                <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">{media.notes}</div>
              ) : (
                <div className="text-xs text-zinc-600 font-mono">
                  No notes yet. Click the edit button to add notes.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}