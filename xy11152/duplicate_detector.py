import imagehash
from PIL import Image
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta


class DuplicateDetector:
    def __init__(self, config: Dict):
        self.config = config
        self.hash_method = config.get('duplicate_detection', {}).get('hash_method', 'dhash')
        self.similarity_threshold = config.get('duplicate_detection', {}).get('similarity_threshold', 5)
        self.time_window_hours = config.get('duplicate_detection', {}).get('time_window_hours', 24)
        self.image_hashes = {}

    def compute_hash(self, image_path: str) -> Optional[imagehash.ImageHash]:
        try:
            img = Image.open(image_path)
            if self.hash_method == 'dhash':
                return imagehash.dhash(img)
            elif self.hash_method == 'phash':
                return imagehash.phash(img)
            elif self.hash_method == 'ahash':
                return imagehash.average_hash(img)
            elif self.hash_method == 'whash':
                return imagehash.whash(img)
            else:
                return imagehash.dhash(img)
        except Exception as e:
            return None

    def hash_to_string(self, img_hash: imagehash.ImageHash) -> str:
        return str(img_hash)

    def string_to_hash(self, hash_str: str) -> imagehash.ImageHash:
        return imagehash.hex_to_hash(hash_str)

    def compare_hashes(self, hash1: imagehash.ImageHash, hash2: imagehash.ImageHash) -> int:
        return hash1 - hash2

    def is_similar(self, hash1: imagehash.ImageHash, hash2: imagehash.ImageHash) -> bool:
        return self.compare_hashes(hash1, hash2) <= self.similarity_threshold

    def detect_duplicates(self, photo_records: List[Dict]) -> List[Dict]:
        duplicates = []
        hash_map = {}
        
        sorted_records = sorted(photo_records, key=lambda x: x.get('filename', ''))
        
        for record in sorted_records:
            if record.get('status') != 'success':
                continue
                
            img_hash = record.get('image_hash')
            if not img_hash:
                continue
                
            photo_time = record.get('exif_data', {}).get('parsed_datetime')
            store_id = record.get('store_id')
            
            hash_key = img_hash
            
            if hash_key in hash_map:
                for existing_record in hash_map[hash_key]:
                    existing_time = existing_record.get('exif_data', {}).get('parsed_datetime')
                    existing_store = existing_record.get('store_id')
                    
                    is_time_close = self._is_time_close(photo_time, existing_time)
                    is_same_store = (store_id == existing_store)
                    
                    if is_time_close and (is_same_store or not self.config.get('duplicate_detection', {}).get('same_store_check', True)):
                        duplicates.append({
                            'type': 'duplicate_photo',
                            'severity': 'high',
                            'photo1': existing_record.get('filename'),
                            'photo2': record.get('filename'),
                            'store_id': store_id,
                            'similarity_score': 0,
                            'description': f"照片 {record.get('filename')} 与 {existing_record.get('filename')} 完全重复"
                        })
            
            if hash_key not in hash_map:
                hash_map[hash_key] = []
            hash_map[hash_key].append(record)
        
        return duplicates

    def detect_similar_photos(self, photo_records: List[Dict]) -> List[Dict]:
        similar_photos = []
        
        valid_records = [r for r in photo_records if r.get('status') == 'success' and r.get('image_hash')]
        
        for i, record1 in enumerate(valid_records):
            hash1 = self.string_to_hash(record1['image_hash'])
            time1 = record1.get('exif_data', {}).get('parsed_datetime')
            store1 = record1.get('store_id')
            
            for j, record2 in enumerate(valid_records[i+1:], i+1):
                hash2 = self.string_to_hash(record2['image_hash'])
                distance = self.compare_hashes(hash1, hash2)
                
                if distance <= self.similarity_threshold:
                    time2 = record2.get('exif_data', {}).get('parsed_datetime')
                    store2 = record2.get('store_id')
                    
                    is_time_close = self._is_time_close(time1, time2)
                    is_same_store = (store1 == store2)
                    
                    if is_time_close and (is_same_store or not self.config.get('duplicate_detection', {}).get('same_store_check', True)):
                        similarity = 100 - (distance * 4)
                        similar_photos.append({
                            'type': 'similar_photo',
                            'severity': 'medium',
                            'photo1': record1.get('filename'),
                            'photo2': record2.get('filename'),
                            'store_id': store1 if store1 == store2 else f"{store1}/{store2}",
                            'similarity_score': similarity,
                            'hash_distance': distance,
                            'description': f"照片相似度约 {similarity}%，疑似重复拍摄"
                        })
        
        return similar_photos

    def _is_time_close(self, time1: Optional[datetime], time2: Optional[datetime]) -> bool:
        if not time1 or not time2:
            return True
        delta = abs(time1 - time2)
        return delta <= timedelta(hours=self.time_window_hours)

    def analyze_photo_batch(self, photo_records: List[Dict]) -> Dict:
        results = {
            'total_photos': len(photo_records),
            'valid_photos': len([r for r in photo_records if r.get('status') == 'success']),
            'duplicates': self.detect_duplicates(photo_records),
            'similar_photos': self.detect_similar_photos(photo_records)
        }
        return results
