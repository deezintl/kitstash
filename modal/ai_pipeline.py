"""
KitStash — AI Pipeline (Modal.com)
CLIP + Grounding DINO + SAM for gear detection in images and videos.

Deploy:  modal deploy ai_pipeline.py
Test:    modal run ai_pipeline.py::stub.process_media_endpoint --media-id <uuid> --storage-url <url> --type image
"""

import modal
import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Modal app & container image
# ---------------------------------------------------------------------------
app = modal.App("kitstash-ai-pipeline")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "ffmpeg")
    .pip_install(
        "torch==2.1.2",
        "torchvision==0.16.2",
        "transformers==4.36.2",
        "segment-anything @ git+https://github.com/facebookresearch/segment-anything.git",
        "groundingdino-py==0.4.0",
        "opencv-python-headless==4.9.0.80",
        "Pillow==10.2.0",
        "requests==2.31.0",
        "supabase==2.3.4",
        "numpy==1.26.3",
        "open-clip-torch==2.24.0",
    )
)

# Supabase config — set these as Modal secrets
secret = modal.Secret.from_name("kitstash-supabase")

# ---------------------------------------------------------------------------
# Model loader (cached across warm containers)
# ---------------------------------------------------------------------------
@app.cls(
    image=image,
    secrets=[secret],
    gpu="T4",
    timeout=600,
    container_idle_timeout=120,
)
class GearDetector:
    @modal.enter()
    def load_models(self):
        """Load CLIP, Grounding DINO, and SAM once per container."""
        import open_clip
        import torch
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
        from segment_anything import sam_model_registry, SamPredictor

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # --- CLIP (ViT-B/32 via open_clip) ---
        self.clip_model, _, self.clip_preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="laion2b_s34b_b79k"
        )
        self.clip_model = self.clip_model.to(self.device).eval()
        self.clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")

        # --- Grounding DINO ---
        self.dino_processor = AutoProcessor.from_pretrained(
            "IDEA-Research/grounding-dino-tiny"
        )
        self.dino_model = AutoModelForZeroShotObjectDetection.from_pretrained(
            "IDEA-Research/grounding-dino-tiny"
        ).to(self.device).eval()

        # --- SAM (vit_b for speed on T4) ---
        sam_checkpoint = "/tmp/sam_vit_b.pth"
        if not os.path.exists(sam_checkpoint):
            import requests as req
            url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
            r = req.get(url, stream=True)
            with open(sam_checkpoint, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        sam = sam_model_registry["vit_b"](checkpoint=sam_checkpoint)
        sam.to(self.device)
        self.sam_predictor = SamPredictor(sam)

        # --- Supabase client ---
        from supabase import create_client
        self.supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )

        logger.info("All models loaded successfully.")

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------
    def _fetch_item_keywords(self) -> list[dict]:
        """Pull current items table to build dynamic DINO prompts."""
        resp = self.supabase.table("items").select("id, name, brand, category").execute()
        return resp.data or []

    def _build_dino_prompt(self, items: list[dict]) -> str:
        """Build a period-separated prompt for Grounding DINO."""
        keywords = set()
        for item in items:
            keywords.add(item["name"].lower())
            if item.get("brand"):
                keywords.add(f"{item['brand'].lower()} {item['name'].lower()}")
        # Add generic gear terms
        keywords.update([
            "plate carrier", "chest rig", "helmet", "holster",
            "radio", "night vision", "goggles", "magazine pouch",
            "backpack", "belt", "gloves", "boots", "suppressor",
            "rifle", "pistol", "optic", "flashlight", "knife",
        ])
        return " . ".join(keywords) + " ."

    def _classify_kit_category(self, pil_image) -> str:
        """Use CLIP to classify the image into a kit category."""
        import torch
        import open_clip

        prompts = [
            "A photo of a Recon kit with surveillance and observation gear",
            "A photo of a Direct Action kit with assault and combat gear",
            "A photo of an Arrest kit with law enforcement and tactical gear",
        ]
        categories = ["Recon", "Direct Action", "Arrest"]

        image_tensor = self.clip_preprocess(pil_image).unsqueeze(0).to(self.device)
        text_tokens = self.clip_tokenizer(prompts).to(self.device)

        with torch.no_grad():
            image_features = self.clip_model.encode_image(image_tensor)
            text_features = self.clip_model.encode_text(text_tokens)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            similarity = (image_features @ text_features.T).squeeze(0)

        best_idx = similarity.argmax().item()
        return categories[best_idx]

    def _detect_objects(self, pil_image, text_prompt: str) -> list[dict]:
        """Run Grounding DINO to get bounding boxes."""
        import torch

        inputs = self.dino_processor(
            images=pil_image, text=text_prompt, return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            outputs = self.dino_model(**inputs)

        results = self.dino_processor.post_process_grounded_object_detection(
            outputs,
            inputs["input_ids"],
            box_threshold=0.25,
            text_threshold=0.20,
            target_sizes=[pil_image.size[::-1]],
        )[0]

        w, h = pil_image.size
        detections = []
        for box, score, label in zip(
            results["boxes"], results["scores"], results["labels"]
        ):
            x1, y1, x2, y2 = box.cpu().tolist()
            detections.append({
                "label": label,
                "confidence": round(score.item(), 3),
                "coords": {
                    "x": round((x1 / w) * 100, 2),
                    "y": round((y1 / h) * 100, 2),
                    "width": round(((x2 - x1) / w) * 100, 2),
                    "height": round(((y2 - y1) / h) * 100, 2),
                },
                "box_px": [int(x1), int(y1), int(x2), int(y2)],
            })
        return detections

    def _refine_with_sam(self, pil_image, detections: list[dict]) -> list[dict]:
        """Refine DINO boxes with SAM segmentation masks → tighter bboxes."""
        import numpy as np
        import torch

        img_array = np.array(pil_image)
        self.sam_predictor.set_image(img_array)
        w, h = pil_image.size

        for det in detections:
            box = np.array(det["box_px"])
            masks, scores, _ = self.sam_predictor.predict(
                box=box, multimask_output=True
            )
            best_mask = masks[scores.argmax()]

            # Get tight bbox from mask
            ys, xs = np.where(best_mask)
            if len(xs) > 0 and len(ys) > 0:
                x1, x2 = xs.min(), xs.max()
                y1, y2 = ys.min(), ys.max()
                det["coords"] = {
                    "x": round((x1 / w) * 100, 2),
                    "y": round((y1 / h) * 100, 2),
                    "width": round(((x2 - x1) / w) * 100, 2),
                    "height": round(((y2 - y1) / h) * 100, 2),
                }

        return detections

    def _match_detection_to_item(self, label: str, items: list[dict]) -> Optional[str]:
        """Fuzzy match a detection label to an item ID."""
        label_lower = label.lower().strip()
        best_match = None
        best_score = 0

        for item in items:
            name_lower = item["name"].lower()
            brand_lower = (item.get("brand") or "").lower()

            # Exact substring match
            if name_lower in label_lower or label_lower in name_lower:
                score = len(name_lower)
                if score > best_score:
                    best_score = score
                    best_match = item["id"]

            # Brand + name match
            full = f"{brand_lower} {name_lower}"
            if full in label_lower or label_lower in full:
                score = len(full) + 10
                if score > best_score:
                    best_score = score
                    best_match = item["id"]

        return best_match

    # -----------------------------------------------------------------------
    # Image processing
    # -----------------------------------------------------------------------
    def _process_image(self, media_id: str, storage_url: str):
        """Full pipeline for a single image."""
        import requests as req
        from PIL import Image
        from io import BytesIO

        resp = req.get(storage_url)
        resp.raise_for_status()
        pil_image = Image.open(BytesIO(resp.content)).convert("RGB")

        items = self._fetch_item_keywords()
        dino_prompt = self._build_dino_prompt(items)

        # Step 1: CLIP classification
        suggested_category = self._classify_kit_category(pil_image)
        logger.info(f"CLIP category: {suggested_category}")

        # Step 2: DINO detection
        detections = self._detect_objects(pil_image, dino_prompt)
        logger.info(f"DINO found {len(detections)} objects")

        # Step 3: SAM refinement
        if detections:
            detections = self._refine_with_sam(pil_image, detections)

        # Step 4: Match detections to items and insert annotations
        annotations = []
        for det in detections:
            item_id = self._match_detection_to_item(det["label"], items)
            annotations.append({
                "media_id": media_id,
                "item_id": item_id,
                "timestamp_sec": None,
                "coords": det["coords"],
                "confidence": det["confidence"],
                "status": "suggested",
                "signature_name": "KitStash AI",
            })

        if annotations:
            self.supabase.table("annotations").insert(annotations).execute()

        # Update media record
        self.supabase.table("media").update({
            "ai_processed": True,
            "ai_processed_at": "now()",
        }).eq("id", media_id).execute()

        return {
            "media_id": media_id,
            "suggested_category": suggested_category,
            "detections": len(detections),
            "annotations_created": len(annotations),
        }

    # -----------------------------------------------------------------------
    # Video processing
    # -----------------------------------------------------------------------
    def _process_video(self, media_id: str, storage_url: str):
        """Sample video at 1fps, run pipeline per frame, deduplicate."""
        import requests as req
        import cv2
        import numpy as np
        import tempfile
        from PIL import Image

        # Download video
        resp = req.get(storage_url, stream=True)
        resp.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()

        cap = cv2.VideoCapture(tmp.name)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        frame_interval = max(1, int(fps))  # 1 sample per second

        items = self._fetch_item_keywords()
        dino_prompt = self._build_dino_prompt(items)

        # Track: item_id → { first_sec, last_sec, best_coords, best_confidence }
        item_tracks: dict[str, dict] = {}
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                timestamp_sec = round(frame_idx / fps, 2)
                pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

                detections = self._detect_objects(pil_image, dino_prompt)
                if detections:
                    detections = self._refine_with_sam(pil_image, detections)

                for det in detections:
                    item_id = self._match_detection_to_item(det["label"], items)
                    track_key = item_id or det["label"]

                    if track_key in item_tracks:
                        track = item_tracks[track_key]
                        track["last_sec"] = timestamp_sec
                        if det["confidence"] > track["best_confidence"]:
                            track["best_confidence"] = det["confidence"]
                            track["best_coords"] = det["coords"]
                    else:
                        item_tracks[track_key] = {
                            "item_id": item_id,
                            "first_sec": timestamp_sec,
                            "last_sec": timestamp_sec,
                            "best_coords": det["coords"],
                            "best_confidence": det["confidence"],
                        }

            frame_idx += 1

        cap.release()
        os.unlink(tmp.name)

        # Insert deduplicated annotations
        annotations = []
        for track_key, track in item_tracks.items():
            annotations.append({
                "media_id": media_id,
                "item_id": track["item_id"],
                "timestamp_sec": track["first_sec"],
                "timestamp_end": track["last_sec"],
                "coords": track["best_coords"],
                "confidence": track["best_confidence"],
                "status": "suggested",
                "signature_name": "KitStash AI",
            })

        if annotations:
            self.supabase.table("annotations").insert(annotations).execute()

        self.supabase.table("media").update({
            "ai_processed": True,
            "ai_processed_at": "now()",
        }).eq("id", media_id).execute()

        return {
            "media_id": media_id,
            "frames_sampled": frame_idx // frame_interval,
            "unique_items_tracked": len(item_tracks),
            "annotations_created": len(annotations),
        }

    # -----------------------------------------------------------------------
    # Web endpoint
    # -----------------------------------------------------------------------
    @modal.web_endpoint(method="POST")
    def process_media_endpoint(self, payload: dict):
        """
        POST { media_id, storage_url, type }
        Called by the Next.js upload handler after media is stored.
        """
        media_id = payload.get("media_id")
        storage_url = payload.get("storage_url")
        media_type = payload.get("type", "image")

        if not media_id or not storage_url:
            return {"error": "media_id and storage_url are required"}, 400

        try:
            if media_type == "video":
                result = self._process_video(media_id, storage_url)
            else:
                result = self._process_image(media_id, storage_url)

            return {"status": "success", **result}

        except Exception as e:
            logger.error(f"AI pipeline error for {media_id}: {e}")

            # Mark as processed even on failure to avoid retry loops
            try:
                self.supabase.table("media").update({
                    "ai_processed": True,
                    "ai_processed_at": "now()",
                }).eq("id", media_id).execute()
            except Exception:
                pass

            # Log the error in audit_log
            try:
                self.supabase.table("audit_log").insert({
                    "table_name": "media",
                    "record_id": media_id,
                    "action": "update",
                    "signature_name": "KitStash AI",
                    "changes": {"error": str(e), "pipeline": "ai_detection"},
                }).execute()
            except Exception:
                pass

            return {"status": "error", "media_id": media_id, "error": str(e)}
