"""
Face Detection and Embedding Service using InsightFace (ArcFace)
"""
import base64
import numpy as np
import cv2
from typing import Optional, Tuple, List
import insightface
from insightface.app import FaceAnalysis


class FaceService:
    def __init__(self):
        """Initialize InsightFace with ArcFace model"""
        # Initialize FaceAnalysis with buffalo_l model (includes ArcFace)
        self.app = FaceAnalysis(
            name='buffalo_s',
            providers=['CPUExecutionProvider']  # Use CPU, change to CUDAExecutionProvider for GPU
        )
        # Prepare the model (det_size controls detection quality)
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        print("✅ FaceService initialized with ArcFace model")
    
    def decode_base64_image(self, image_base64: str) -> np.ndarray:
        """
        Decode base64 image to numpy array (BGR format for OpenCV)
        Handles both with and without data URL prefix
        """
        # Remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_base64)
        
        # Convert to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        
        # Decode image
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Failed to decode image")
        
        return image
    
    def detect_faces(self, image: np.ndarray) -> list:
        """
        Detect faces in image using InsightFace
        Returns list of detected face objects
        """
        faces = self.app.get(image)
        return faces
    
    def get_single_face_embedding(self, image_base64: str) -> Tuple[Optional[List[float]], str]:
        """
        Extract embedding from image containing exactly one face
        
        Returns:
            (embedding, status_message)
            - embedding: 512-dim normalized vector, or None if failed
            - status_message: Success or error message
        """
        try:
            # Decode image
            image = self.decode_base64_image(image_base64)
            print(f"📐 Image decoded: {image.shape[1]}×{image.shape[0]}px (channels: {image.shape[2]})")

            # Debug: Save the received image to verify what the backend is getting
            cv2.imwrite(r"debug_received_image.jpg", image)
            print("📸 Saved debug image to debug_received_image.jpg")
            
            # Pad image to at least 640×640 for reliable detection
            h, w = image.shape[:2]
            target = max(640, h, w)
            if h < target or w < target:
                padded = np.zeros((target, target, 3), dtype=np.uint8)
                y_offset = (target - h) // 2
                x_offset = (target - w) // 2
                padded[y_offset:y_offset+h, x_offset:x_offset+w] = image
                image = padded
                print(f"📐 Padded to: {image.shape[1]}×{image.shape[0]}px")
            
            # Detect faces
            faces = self.detect_faces(image)
            
            # Check face count
            if len(faces) == 0:
                return None, "No face detected in the image"
            
            if len(faces) > 1:
                return None, f"Multiple faces detected ({len(faces)}). Please ensure only one face is visible"
            
            # Get the single face
            face = faces[0]
            
            # Extract embedding (already normalized by InsightFace)
            embedding = face.embedding.tolist()
            
            return embedding, "Success"
            
        except ValueError as e:
            return None, str(e)
    def get_multiple_face_embeddings(self, images_base64: List[str]) -> Tuple[Optional[List[List[float]]], str]:
        """
        Extract embeddings from a list of images.
        All images must contain exactly one face.
        """
        embeddings = []
        for i, img_b64 in enumerate(images_base64):
            emb, status = self.get_single_face_embedding(img_b64)
            if emb is None:
                return None, f"Image {i + 1}: {status}"
            embeddings.append(emb)
        return embeddings, "Success"
    
    def compute_cosine_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Compute cosine similarity between two embeddings
        
        Since ArcFace embeddings are already normalized,
        cosine similarity = dot product
        """
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Normalize just in case
        vec1 = vec1 / np.linalg.norm(vec1)
        vec2 = vec2 / np.linalg.norm(vec2)
        
        # Cosine similarity = dot product of normalized vectors
        similarity = np.dot(vec1, vec2)
        
        return float(similarity)
    
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
            # For backward compatibility if any old records still exist
            if not stored_embeddings and "embedding" in face:
                stored_embeddings = [face["embedding"]]
                
            if not stored_embeddings:
                continue
                
            # Find max similarity across all combinations of query and stored embeddings
            max_score_for_user = -1.0
            for q_emb in query_embeddings:
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
    """Get or create FaceService singleton"""
    global _face_service
    if _face_service is None:
        _face_service = FaceService()
    return _face_service
