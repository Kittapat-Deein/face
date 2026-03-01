"""
Face Recognition API - FastAPI Backend
"""
import os
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from storage import FaceStorage
from face_service import get_face_service

# Load environment variables
load_dotenv()

# Configuration
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.45"))
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
FACES_FILE = os.path.join(DATA_DIR, "faces.json")


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize face service (loads model)
    print("🚀 Starting Face Recognition API...")
    print(f"📁 Faces file: {FACES_FILE}")
    print(f"🎯 Match threshold: {MATCH_THRESHOLD}")
    get_face_service()  # Initialize on startup
    yield
    # Shutdown
    print("👋 Shutting down Face Recognition API...")


# Create FastAPI app
app = FastAPI(
    title="Face Recognition API",
    description="Face Recognition System using ArcFace",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize storage
storage = FaceStorage(FACES_FILE)


# ===== Request/Response Models =====

class RegisterRequest(BaseModel):
    user_id: str
    name: str
    images_base64: List[str]


class RegisterResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None
    name: Optional[str] = None


class VerifyRequest(BaseModel):
    images_base64: List[str]


class VerifyResponse(BaseModel):
    matched: bool
    user_id: Optional[str] = None
    name: Optional[str] = None
    score: float
    message: str
    per_image_scores: Optional[List[float]] = None
    weakest_image: Optional[str] = None


class UserInfo(BaseModel):
    user_id: str
    name: str
    created_at: str


class UsersResponse(BaseModel):
    count: int
    users: List[UserInfo]


class DeleteResponse(BaseModel):
    success: bool
    message: str


# ===== API Endpoints =====

@app.get("/docs")
async def root():
    """API Health check"""
    return {
        "status": "ok",
        "service": "Face Recognition API",
        "model": "ArcFace",
        "threshold": MATCH_THRESHOLD
    }


@app.post("/register", response_model=RegisterResponse)
async def register_face(request: RegisterRequest):
    """
    Register a new face
    
    - Detects exactly one face in the image
    - Extracts 512-dim ArcFace embedding
    - Stores in JSON file
    """
    face_service = get_face_service()
    
    # Validate input
    if not request.user_id.strip():
        raise HTTPException(status_code=400, detail="user_id cannot be empty")
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="name cannot be empty")
    if not request.images_base64 or len(request.images_base64) == 0:
        raise HTTPException(status_code=400, detail="images_base64 cannot be empty")
    
    # Check if user already exists
    existing = storage.get_face_by_id(request.user_id)
    if existing:
        raise HTTPException(
            status_code=409, 
            detail=f"User '{request.user_id}' already registered. Use update endpoint or delete first."
        )
    
    # Extract embeddings for all images
    embeddings, status = face_service.get_multiple_face_embeddings(request.images_base64)
    
    if embeddings is None:
        print(f"❌ Registration failed for user {request.user_id}: {status}")
        raise HTTPException(status_code=400, detail=status)
    
    # Store in JSON
    success = storage.add_face(
        user_id=request.user_id.strip(),
        name=request.name.strip(),
        embeddings=embeddings
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save face data")
    
    return RegisterResponse(
        success=True,
        message="Face registered successfully",
        user_id=request.user_id,
        name=request.name
    )


@app.post("/verify", response_model=VerifyResponse)
async def verify_face(request: VerifyRequest):
    """
    Verify a face against registered faces
    
    - Detects exactly one face in the image
    - Compares with all stored embeddings using cosine similarity
    - Returns best match if above threshold
    """
    face_service = get_face_service()
    
    if not request.images_base64 or len(request.images_base64) == 0:
        raise HTTPException(status_code=400, detail="images_base64 cannot be empty")
    
    # Extract embeddings for all images
    query_embeddings, status = face_service.get_multiple_face_embeddings(request.images_base64)
    
    if query_embeddings is None:
        return VerifyResponse(
            matched=False,
            score=0.0,
            message=status
        )
    
    # Get all stored faces
    stored_faces = storage.get_all_embeddings()
    
    if not stored_faces:
        return VerifyResponse(
            matched=False,
            score=0.0,
            message="No registered faces in the system"
        )
    
    # Find best match using all query embeddings
    matched, user_id, name, score = face_service.find_best_match(
        query_embeddings,
        stored_faces,
        MATCH_THRESHOLD
    )
    
    if matched:
        return VerifyResponse(
            matched=True,
            user_id=user_id,
            name=name,
            score=round(score, 4),
            message=f"Match found with confidence {score:.2%}"
        )
    else:
        return VerifyResponse(
            matched=False,
            score=round(score, 4),
            message=f"No match found. Best score: {score:.2%} (threshold: {MATCH_THRESHOLD:.2%})"
        )


@app.get("/users", response_model=UsersResponse)
async def list_users():
    """List all registered users (without embeddings)"""
    users = storage.get_all_faces()
    return UsersResponse(
        count=len(users),
        users=[UserInfo(**u) for u in users]
    )


@app.delete("/users/{user_id}", response_model=DeleteResponse)
async def delete_user(user_id: str):
    """Delete a registered user"""
    success = storage.delete_face(user_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"User '{user_id}' not found"
        )
    
    return DeleteResponse(
        success=True,
        message=f"User '{user_id}' deleted successfully"
    )


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "registered_faces": storage.count(),
        "threshold": MATCH_THRESHOLD,
        "model": "ArcFace (buffalo_l)"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
