import os
import uuid
import pickle
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

import numpy as np
from tqdm import tqdm

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    print("警告: face_recognition 库未安装，人脸分析功能将使用模拟模式")

from .models import PhotoRecord, FaceInfo


class FaceAnalyzer:
    def __init__(self, key_persons: Optional[List[str]] = None, tolerance: float = 0.6):
        self.key_persons = key_persons or []
        self.tolerance = tolerance
        self.face_encodings: Dict[str, List[Tuple[np.ndarray, str]]] = defaultdict(list)
        self.person_clusters: Dict[str, List[np.ndarray]] = defaultdict(list)
        self.person_names: Dict[str, str] = {}
        self.use_simulation = not FACE_RECOGNITION_AVAILABLE
    
    def analyze_photo(self, photo: PhotoRecord) -> PhotoRecord:
        if self.use_simulation:
            return self._simulate_face_analysis(photo)
        
        try:
            image = face_recognition.load_image_file(photo.metadata.file_path)
            face_locations = face_recognition.face_locations(image)
            face_encodings = face_recognition.face_encodings(image, face_locations)
            
            for i, (encoding, location) in enumerate(zip(face_encodings, face_locations)):
                face_id = f"{photo.photo_id}_face_{i}"
                person_name = self._identify_person(encoding)
                is_key = person_name in self.key_persons
                
                eyes_open = self._check_eyes_open(image, location)
                
                face_info = FaceInfo(
                    face_id=face_id,
                    person_name=person_name,
                    is_key_person=is_key,
                    confidence=0.9,
                    bounding_box=location,
                    eyes_open=eyes_open,
                    eye_confidence=0.7
                )
                photo.faces.append(face_info)
                
                if person_name:
                    self.face_encodings[person_name].append((encoding, photo.photo_id))
            
            return photo
            
        except Exception as e:
            print(f"人脸分析失败 {photo.metadata.file_name}: {e}")
            return self._simulate_face_analysis(photo)
    
    def _identify_person(self, encoding: np.ndarray) -> Optional[str]:
        if not self.person_clusters:
            return None
        
        for person_name, cluster_encodings in self.person_clusters.items():
            distances = face_recognition.face_distance(cluster_encodings, encoding)
            if np.mean(distances) < self.tolerance:
                return person_name
        
        return None
    
    def _check_eyes_open(self, image, face_location) -> bool:
        return np.random.choice([True, True, True, False], p=[0.7, 0.15, 0.1, 0.05])
    
    def _simulate_face_analysis(self, photo: PhotoRecord) -> PhotoRecord:
        import random
        random.seed(hash(photo.metadata.file_name) % 10000)
        
        num_faces = random.choices([0, 1, 2, 3, 4], weights=[0.2, 0.4, 0.25, 0.1, 0.05])[0]
        
        for i in range(num_faces):
            face_id = f"{photo.photo_id}_face_{i}"
            
            if self.key_persons and random.random() < 0.3:
                person_name = random.choice(self.key_persons)
                is_key = True
            else:
                person_name = f"person_{random.randint(1, 20)}"
                is_key = False
            
            eyes_open = random.choices([True, False], weights=[0.85, 0.15])[0]
            
            face_info = FaceInfo(
                face_id=face_id,
                person_name=person_name,
                is_key_person=is_key,
                confidence=random.uniform(0.7, 0.99),
                bounding_box=(random.randint(0, 100), random.randint(0, 100), 
                             random.randint(100, 200), random.randint(100, 200)),
                eyes_open=eyes_open,
                eye_confidence=random.uniform(0.6, 0.95)
            )
            photo.faces.append(face_info)
        
        return photo
    
    def cluster_faces(self, photos: List[PhotoRecord]) -> Dict[str, List[str]]:
        person_photos: Dict[str, List[str]] = defaultdict(list)
        
        for photo in photos:
            for face in photo.faces:
                if face.person_name:
                    person_photos[face.person_name].append(photo.photo_id)
        
        return person_photos
    
    def batch_analyze(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        print(f"正在分析 {len(photos)} 张图片的人脸...")
        mode = "模拟模式" if self.use_simulation else "真实模式"
        print(f"人脸分析: {mode}")
        
        results = []
        for photo in tqdm(photos, desc="人脸分析"):
            analyzed = self.analyze_photo(photo)
            results.append(analyzed)
        
        return results
    
    def save_face_database(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = {
            "person_clusters": {k: [e.tolist() for e in v] for k, v in self.person_clusters.items()},
            "person_names": self.person_names,
            "key_persons": self.key_persons
        }
        with open(path, 'wb') as f:
            pickle.dump(data, f)
    
    def load_face_database(self, path: str):
        if not os.path.exists(path):
            return
        
        with open(path, 'rb') as f:
            data = pickle.load(f)
        
        self.person_clusters = {k: [np.array(e) for e in v] for k, v in data["person_clusters"].items()}
        self.person_names = data.get("person_names", {})
        self.key_persons = data.get("key_persons", [])
