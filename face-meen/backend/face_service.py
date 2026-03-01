"""
Face Detection and Embedding Service using InsightFace (ArcFace)
"""
import base64
import os
import numpy as np
import cv2
from typing import Optional, Tuple, List

_face_app = None

def get_face_app():
    global _face_app
    if _face_app is None:
        # ✅ lazy import: ไม่ import insightface ตอนเริ่มแอป
        from insightface.app import FaceAnalysis

        print("⏳ Lazy loading ArcFace model to memory...")
        _face_app = FaceAnalysis(
            name="buffalo_sc",  # หรือ buffalo_sc ถ้าจะเล็กกว่า
            providers=["CPUExecutionProvider"]
        )
        # ✅ CPU ต้อง ctx_id=-1
        _face_app.prepare(ctx_id=-1, det_size=(320, 320))
        print("✅ FaceService initialized with ArcFace model")
    return _face_app


class FaceService:
    def __init__(self):
        print("✅ FaceService struct initialized (model will be loaded on demand)")

    def decode_base64_image(self, image_base64: str) -> np.ndarray:
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        image_bytes = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Failed to decode image")
        return image

    def detect_faces(self, image: np.ndarray) -> list:
        app = get_face_app()
        return app.get(image)

    def get_single_face_embedding(self, image_base64: str) -> Tuple[Optional[List[float]], str]:
        try:
            image = self.decode_base64_image(image_base64)
            h, w = image.shape[:2]
            print(f"📐 Image decoded: {w}×{h}px")

            # ✅ debug เฉพาะตอนอยากเก็บจริง ๆ
            if os.getenv("SAVE_DEBUG_IMAGE") == "1":
                cv2.imwrite("/tmp/debug_received_image.jpg", image)
                print("Saved debug image to /tmp/debug_received_image.jpg")

            # ✅ pad แค่ให้พอ (ไม่บังคับ 640)
            target = max(320, h, w)
            if h < target or w < target:
                padded = np.zeros((target, target, 3), dtype=np.uint8)
                y_offset = (target - h) // 2
                x_offset = (target - w) // 2
                padded[y_offset:y_offset+h, x_offset:x_offset+w] = image
                image = padded
                print(f"📐 Padded to: {target}×{target}px")

            faces = self.detect_faces(image)

            if len(faces) == 0:
                return None, "No face detected in the image"
            if len(faces) > 1:
                return None, f"Multiple faces detected ({len(faces)}). Please ensure only one face is visible"

            embedding = faces[0].embedding.tolist()
            return embedding, "Success"

        except Exception as e:
            return None, str(e)

    def get_multiple_face_embeddings(self, images_base64: List[str]) -> Tuple[Optional[List[List[float]]], str]:
        embeddings = []
        for i, img_b64 in enumerate(images_base64):
            emb, status = self.get_single_face_embedding(img_b64)
            if emb is None:
                return None, f"Image {i + 1}: {status}"
            embeddings.append(emb)
        return embeddings, "Success"

    def compute_cosine_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        v1 = np.asarray(embedding1, dtype=np.float32)
        v2 = np.asarray(embedding2, dtype=np.float32)
        v1 /= (np.linalg.norm(v1) + 1e-8)
        v2 /= (np.linalg.norm(v2) + 1e-8)
        return float(np.dot(v1, v2))

    def find_best_match(
        self,
        query_embeddings: List[List[float]],
        stored_faces: List[dict],
        threshold: float
    ) -> Tuple[bool, Optional[str], Optional[str], float]:
        """
        Find the best matching face from stored faces by comparing all query embeddings 
        against all stored embeddings for each user.
        
        Returns:
            (matched, user_id, name, score)
        """
        if not stored_faces or not query_embeddings:
            return False, None, None, 0.0
        
        best_overall_match = None
        best_overall_score = -1.0
        
        for face in stored_faces:
            stored_embeddings = face.get("embeddings", [])
            if not stored_embeddings and "embedding" in face:
                stored_embeddings = [face["embedding"]]

            if not stored_embeddings:
                continue
                
            # Find max similarity across all combinations of query and stored embeddings
            max_score_for_user = -1.0
            for q_emb in query_embeddings:
                best_score_for_query = -1.0
                for s_emb in stored_embeddings:
                    score = self.compute_cosine_similarity(q_emb, s_emb)
                    if score > max_score_for_user:
                        max_score_for_user = score
                        
            if max_score_for_user > best_overall_score:
                best_overall_score = max_score_for_user
                best_overall_match = face
        
        if best_overall_score >= threshold and best_overall_match:
            return True, best_overall_match["user_id"], best_overall_match["name"], float(best_overall_score)
        
        return False, None, None, float(best_overall_score)


# Singleton instance
_face_service: Optional[FaceService] = None

def get_face_service() -> FaceService:
    global _face_service
    if _face_service is None:
        _face_service = FaceService()
    return _face_service
