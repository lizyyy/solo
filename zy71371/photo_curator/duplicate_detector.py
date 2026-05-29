import os
import uuid
from pathlib import Path
from typing import List, Dict, Optional
from collections import defaultdict

import imagehash
from PIL import Image
from tqdm import tqdm

from .models import PhotoRecord, DuplicateGroup, PhotoMetadata


class DuplicateDetector:
    def __init__(self, hash_size: int = 16, similarity_threshold: int = 5):
        self.hash_size = hash_size
        self.similarity_threshold = similarity_threshold
        self.hash_to_photos: Dict[str, List[PhotoRecord]] = defaultdict(list)
    
    def compute_perceptual_hash(self, image_path: str) -> Optional[str]:
        try:
            with Image.open(image_path) as img:
                img_copy = img.copy()
                phash = imagehash.phash(img_copy, hash_size=self.hash_size)
                return str(phash)
        except Exception as e:
            print(f"计算哈希失败 {image_path}: {e}")
            return None
    
    def _load_image_metadata(self, image_path: str) -> PhotoMetadata:
        stat = os.stat(image_path)
        try:
            with Image.open(image_path) as img:
                width, height = img.size
                exif = img._getexif() if hasattr(img, '_getexif') else None
        except:
            width, height = 0, 0
            exif = None
        
        return PhotoMetadata(
            file_path=image_path,
            file_name=os.path.basename(image_path),
            file_size=stat.st_size,
            width=width,
            height=height,
        )
    
    def load_photos(self, directory: str) -> List[PhotoRecord]:
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
        photo_records = []
        
        image_files = []
        for root, _, files in os.walk(directory):
            for file in files:
                ext = Path(file).suffix.lower()
                if ext in image_extensions:
                    image_files.append(os.path.join(root, file))
        
        print(f"发现 {len(image_files)} 张图片，正在计算感知哈希...")
        
        for img_path in tqdm(image_files, desc="处理图片"):
            metadata = self._load_image_metadata(img_path)
            photo_id = str(uuid.uuid4())
            phash = self.compute_perceptual_hash(img_path)
            
            record = PhotoRecord(
                photo_id=photo_id,
                metadata=metadata,
                perceptual_hash=phash
            )
            
            if phash:
                self.hash_to_photos[phash].append(record)
            
            photo_records.append(record)
        
        return photo_records
    
    def find_duplicates(self, photo_records: List[PhotoRecord]) -> List[DuplicateGroup]:
        hash_groups: Dict[str, List[PhotoRecord]] = defaultdict(list)
        
        for record in photo_records:
            if record.perceptual_hash:
                hash_groups[record.perceptual_hash].append(record)
        
        duplicate_groups = []
        
        for phash, photos in hash_groups.items():
            if len(photos) > 1:
                group_id = f"dup_group_{uuid.uuid4().hex[:8]}"
                group = DuplicateGroup(group_id=group_id, photos=photos)
                duplicate_groups.append(group)
                
                for photo in photos:
                    if photo.duplicate_rank > 0:
                        photo.status = PhotoStatus.REMOVE_DUPLICATE
                        photo.status_reason = f"重复照片，最佳照片为：{group.best_photo.metadata.file_name if group.best_photo else '未知'}"
                    else:
                        photo.status_reason = f"重复组{group_id}中的最佳照片"
        
        return duplicate_groups
    
    def find_similar_by_time(self, photo_records: List[PhotoRecord], time_window_seconds: int = 2) -> List[DuplicateGroup]:
        sorted_photos = sorted(
            [p for p in photo_records if p.metadata.capture_time],
            key=lambda x: x.metadata.capture_time
        )
        
        groups = []
        current_group = []
        
        for photo in sorted_photos:
            if not current_group:
                current_group.append(photo)
            else:
                last_photo = current_group[-1]
                time_diff = (photo.metadata.capture_time - last_photo.metadata.capture_time).total_seconds()
                
                if time_diff <= time_window_seconds:
                    current_group.append(photo)
                else:
                    if len(current_group) > 1:
                        group_id = f"burst_group_{uuid.uuid4().hex[:8]}"
                        group = DuplicateGroup(group_id=group_id, photos=current_group)
                        groups.append(group)
                    current_group = [photo]
        
        if len(current_group) > 1:
            group_id = f"burst_group_{uuid.uuid4().hex[:8]}"
            group = DuplicateGroup(group_id=group_id, photos=current_group)
            groups.append(group)
        
        return groups
