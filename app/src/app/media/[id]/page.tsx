"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { GearSidebar } from "@/components/GearSidebar";
import { MediaCanvas } from "@/components/MediaCanvas";
import { MediaInfoSidebar } from "@/components/MediaInfoSidebar";
import { Loader2 } from "lucide-react";
import type { Media, Annotation, Kit } from "@/lib/types";

export default function MediaDetailPage() {
  const params = useParams();
  const mediaId = params.id as string;

  const [media, setMedia] = useState<Media | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!mediaId) return;

    const { data: mediaData, error: mediaError } = await supabase
      .from("media")
      .select("*, kit:kits(*)")
      .eq("id", mediaId)
      .single();

    if (mediaError || !mediaData) {
      setError("Media not found");
      setLoading(false);
      return;
    }

    const { data: annData } = await supabase
      .from("annotations")
      .select("*, item:items(*)")
      .eq("media_id", mediaId)
      .neq("status", "rejected")
      .order("created_at");

    setMedia(mediaData as Media);
    setAnnotations((annData as Annotation[]) || []);
    setLoading(false);
  }, [mediaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for AI processing updates
  useEffect(() => {
    if (!media || media.ai_processed) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("media")
        .select("ai_processed")
        .eq("id", mediaId)
        .single();
      if (data?.ai_processed) {
        loadData();
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [media, mediaId, loadData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-danger mb-2">{error || "Media not found"}</p>
          <a href="/" className="text-xs text-accent hover:underline">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <GearSidebar />
      <MediaCanvas
        media={media}
        annotations={annotations}
        onAnnotationsChange={loadData}
      />
      <MediaInfoSidebar media={media} annotations={annotations} />
    </div>
  );
}
