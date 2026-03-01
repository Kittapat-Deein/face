"""
JSON Storage Utility for Face Embeddings
With thread-based locking to prevent concurrent write corruption
"""
import json
import os
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path


class FaceStorage:
    def __init__(self, file_path: str = "faces.json"):
        self.file_path = Path(file_path)
        self._lock = threading.Lock()
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """Create the JSON file if it doesn't exist"""
        if not self.file_path.exists():
            self._write_data({
                "version": "1.0",
                "model": "arcface",
                "items": []
            })
    
    def _read_data(self) -> Dict[str, Any]:
        """Read data from JSON file (thread-safe)"""
        with self._lock:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        return data
    
    def _write_data(self, data: Dict[str, Any]):
        """Write data to JSON file (thread-safe, atomic write)"""
        with self._lock:
            temp_path = self.file_path.with_suffix('.tmp')
            
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            # Atomic replace
            os.replace(temp_path, self.file_path)
    
    def add_face(self, user_id: str, name: str, embeddings: List[List[float]]) -> bool:
        """
        Add a new face to storage
        Returns False if user_id already exists
        """
        data = self._read_data()
        
        # Check if user_id already exists
        for item in data["items"]:
            if item["user_id"] == user_id:
                return False
        
        # Add new entry
        data["items"].append({
            "user_id": user_id,
            "name": name,
            "embeddings": embeddings,
            "created_at": datetime.now().astimezone().isoformat()
        })
        
        self._write_data(data)
        return True
    
    def update_face(self, user_id: str, name: str, embeddings: List[List[float]]) -> bool:
        """
        Update an existing face in storage
        Returns False if user_id doesn't exist
        """
        data = self._read_data()
        
        for item in data["items"]:
            if item["user_id"] == user_id:
                item["name"] = name
                item["embeddings"] = embeddings
                item["updated_at"] = datetime.now().astimezone().isoformat()
                self._write_data(data)
                return True
        
        return False
    
    def get_all_faces(self) -> List[Dict[str, Any]]:
        """Get all registered faces (without embeddings for security)"""
        data = self._read_data()
        return [
            {
                "user_id": item["user_id"],
                "name": item["name"],
                "created_at": item["created_at"]
            }
            for item in data["items"]
        ]
    
    def get_all_embeddings(self) -> List[Dict[str, Any]]:
        """Get all faces with embeddings for matching"""
        data = self._read_data()
        return data["items"]
    
    def get_face_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific face by user_id"""
        data = self._read_data()
        for item in data["items"]:
            if item["user_id"] == user_id:
                return item
        return None
    
    def delete_face(self, user_id: str) -> bool:
        """
        Delete a face from storage
        Returns False if user_id doesn't exist
        """
        data = self._read_data()
        
        for i, item in enumerate(data["items"]):
            if item["user_id"] == user_id:
                del data["items"][i]
                self._write_data(data)
                return True
        
        return False
    
    def count(self) -> int:
        """Get total number of registered faces"""
        data = self._read_data()
        return len(data["items"])
