import math
from typing import Dict, List, Optional, Tuple
from datetime import datetime


class StoreValidator:
    def __init__(self, config: Dict):
        self.config = config
        self.stores = config.get('stores', [])
        self.gps_tolerance_meters = config.get('store_relocation', {}).get('gps_tolerance_meters', 500)

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371000
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi / 2) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

    def get_store_by_id(self, store_id: str) -> Optional[Dict]:
        for store in self.stores:
            if store.get('store_id') == store_id:
                return store
        return None

    def infer_store_from_gps(self, lat: float, lng: float) -> Optional[Dict]:
        closest_store = None
        min_distance = float('inf')
        
        for store in self.stores:
            expected_gps = store.get('expected_gps', {})
            if expected_gps:
                store_lat = expected_gps.get('lat')
                store_lng = expected_gps.get('lng')
                if store_lat and store_lng:
                    distance = self._haversine_distance(lat, lng, store_lat, store_lng)
                    if distance < min_distance:
                        min_distance = distance
                        closest_store = store
        
        if closest_store and min_distance <= self.gps_tolerance_meters:
            return closest_store
        return None

    def validate_store_location(self, photo_record: Dict) -> Dict:
        result = {
            'is_valid': True,
            'warnings': [],
            'store_match': None,
            'distance_meters': None,
            'relocation_detected': False
        }
        
        gps_data = photo_record.get('exif_data', {}).get('GPS', {})
        if not gps_data or 'latitude' not in gps_data or 'longitude' not in gps_data:
            result['is_valid'] = False
            result['warnings'].append("无法验证门店位置：缺少GPS数据")
            return result
        
        photo_lat = gps_data['latitude']
        photo_lng = gps_data['longitude']
        
        store_id = photo_record.get('store_id')
        if store_id:
            store = self.get_store_by_id(store_id)
            if store:
                expected_gps = store.get('expected_gps', {})
                expected_lat = expected_gps.get('lat')
                expected_lng = expected_gps.get('lng')
                
                if expected_lat and expected_lng:
                    distance = self._haversine_distance(photo_lat, photo_lng, expected_lat, expected_lng)
                    result['distance_meters'] = round(distance, 2)
                    
                    if distance > self.gps_tolerance_meters:
                        result['is_valid'] = False
                        result['relocation_detected'] = True
                        result['warnings'].append(
                            f"门店迁址检测：照片GPS位置与门店 {store_id} 预期位置距离 {round(distance)} 米，超出容差 {self.gps_tolerance_meters} 米"
                        )
                    result['store_match'] = store
            else:
                result['warnings'].append(f"未找到门店ID: {store_id}")
        
        else:
            inferred_store = self.infer_store_from_gps(photo_lat, photo_lng)
            if inferred_store:
                result['store_match'] = inferred_store
                result['warnings'].append(f"根据GPS推断门店为: {inferred_store.get('store_id')} - {inferred_store.get('name')}")
            else:
                result['warnings'].append("无法根据GPS推断门店，照片可能不在已知门店范围内")
        
        return result

    def check_time_consistency(self, photo_records: List[Dict]) -> List[Dict]:
        issues = []
        
        store_photos = {}
        for record in photo_records:
            if record.get('status') != 'success':
                continue
                
            store_id = record.get('store_id', 'unknown')
            if store_id not in store_photos:
                store_photos[store_id] = []
            store_photos[store_id].append(record)
        
        for store_id, records in store_photos.items():
            if len(records) < 2:
                continue
                
            sorted_records = sorted(
                records,
                key=lambda x: x.get('exif_data', {}).get('parsed_datetime') or datetime.min
            )
            
            for i in range(1, len(sorted_records)):
                prev_time = sorted_records[i-1].get('exif_data', {}).get('parsed_datetime')
                curr_time = sorted_records[i].get('exif_data', {}).get('parsed_datetime')
                
                if prev_time and curr_time:
                    delta = curr_time - prev_time
                    if delta.total_seconds() < 60:
                        issues.append({
                            'type': 'time_too_close',
                            'severity': 'low',
                            'store_id': store_id,
                            'photo1': sorted_records[i-1].get('filename'),
                            'photo2': sorted_records[i].get('filename'),
                            'description': f"照片拍摄时间间隔过短（{delta.total_seconds():.1f}秒），可能为连拍"
                        })
        
        return issues

    def batch_validate_stores(self, photo_records: List[Dict]) -> Dict:
        results = {
            'location_validations': [],
            'time_issues': self.check_time_consistency(photo_records),
            'relocation_count': 0
        }
        
        for record in photo_records:
            if record.get('status') != 'success':
                continue
                
            validation = self.validate_store_location(record)
            validation['filename'] = record.get('filename')
            validation['store_id'] = record.get('store_id')
            results['location_validations'].append(validation)
            
            if validation.get('relocation_detected'):
                results['relocation_count'] += 1
        
        return results
