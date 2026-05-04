import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime

import config
from models import Scheme, Parcel, Facility


class SchemeManager:
    def __init__(self, schemes_dir: str):
        self.schemes_dir = schemes_dir
        os.makedirs(schemes_dir, exist_ok=True)
        self._cache: Dict[str, Scheme] = {}

    def list_schemes(self) -> List[Dict]:
        schemes = []
        for filename in os.listdir(self.schemes_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.schemes_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    schemes.append({
                        'id': data.get('id'),
                        'name': data.get('name'),
                        'description': data.get('description', ''),
                        'created_at': data.get('created_at'),
                        'updated_at': data.get('updated_at'),
                        'base_scheme_id': data.get('base_scheme_id'),
                        'parcel_count': len(data.get('parcels', [])),
                        'facility_count': len(data.get('facilities', []))
                    })
                except Exception:
                    continue
        
        return sorted(schemes, key=lambda x: x['created_at'], reverse=True)

    def get_scheme(self, scheme_id: str) -> Optional[Dict]:
        filepath = os.path.join(self.schemes_dir, f"{scheme_id}.json")
        if not os.path.exists(filepath):
            return None
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None

    def create_scheme(self, name: str, description: str = "", 
                      base_parcels: List[Dict] = None,
                      base_facilities: List[Dict] = None,
                      base_scheme_id: str = None) -> Dict:
        scheme = Scheme.create_new(name, description)
        scheme.base_scheme_id = base_scheme_id
        
        if base_parcels:
            scheme.parcels = base_parcels
        if base_facilities:
            scheme.facilities = base_facilities
        
        return self._save_scheme(scheme)

    def update_scheme(self, scheme_id: str, updates: Dict) -> Optional[Dict]:
        scheme_data = self.get_scheme(scheme_id)
        if not scheme_data:
            return None
        
        for key in ['name', 'description', 'parcels', 'facilities', 'assessments', 'notes']:
            if key in updates:
                scheme_data[key] = updates[key]
        
        scheme_data['updated_at'] = datetime.now().isoformat()
        
        filepath = os.path.join(self.schemes_dir, f"{scheme_id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(scheme_data, f, ensure_ascii=False, indent=2)
        
        return scheme_data

    def delete_scheme(self, scheme_id: str) -> bool:
        filepath = os.path.join(self.schemes_dir, f"{scheme_id}.json")
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    def _save_scheme(self, scheme: Scheme) -> Dict:
        data = scheme.to_dict()
        filepath = os.path.join(self.schemes_dir, f"{scheme.id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return data

    def update_parcel_in_scheme(self, scheme_id: str, parcel_id: str, 
                                 parcel_updates: Dict) -> Optional[Dict]:
        scheme_data = self.get_scheme(scheme_id)
        if not scheme_data:
            return None
        
        parcels = scheme_data.get('parcels', [])
        found = False
        
        for i, parcel in enumerate(parcels):
            if parcel.get('id') == parcel_id:
                parcels[i].update(parcel_updates)
                found = True
                break
        
        if not found:
            return None
        
        scheme_data['parcels'] = parcels
        scheme_data['updated_at'] = datetime.now().isoformat()
        
        filepath = os.path.join(self.schemes_dir, f"{scheme_id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(scheme_data, f, ensure_ascii=False, indent=2)
        
        return scheme_data

    def add_facility_to_scheme(self, scheme_id: str, facility: Dict) -> Optional[Dict]:
        scheme_data = self.get_scheme(scheme_id)
        if not scheme_data:
            return None
        
        if 'facilities' not in scheme_data:
            scheme_data['facilities'] = []
        
        facility['id'] = f"F{len(scheme_data['facilities']) + 1:03d}"
        scheme_data['facilities'].append(facility)
        scheme_data['updated_at'] = datetime.now().isoformat()
        
        filepath = os.path.join(self.schemes_dir, f"{scheme_id}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(scheme_data, f, ensure_ascii=False, indent=2)
        
        return scheme_data

    def compare_schemes(self, scheme_id1: str, scheme_id2: str) -> Optional[Dict]:
        scheme1 = self.get_scheme(scheme_id1)
        scheme2 = self.get_scheme(scheme_id2)
        
        if not scheme1 or not scheme2:
            return None
        
        comparison = {
            'scheme1': {'id': scheme1['id'], 'name': scheme1['name']},
            'scheme2': {'id': scheme2['id'], 'name': scheme2['name']},
            'parcel_changes': [],
            'facility_changes': [],
            'assessment_differences': {}
        }
        
        parcels1 = {p['id']: p for p in scheme1.get('parcels', [])}
        parcels2 = {p['id']: p for p in scheme2.get('parcels', [])}
        
        all_parcel_ids = set(parcels1.keys()) | set(parcels2.keys())
        for pid in all_parcel_ids:
            p1 = parcels1.get(pid)
            p2 = parcels2.get(pid)
            
            if p1 and not p2:
                comparison['parcel_changes'].append({
                    'id': pid,
                    'type': 'removed',
                    'name': p1.get('name')
                })
            elif not p1 and p2:
                comparison['parcel_changes'].append({
                    'id': pid,
                    'type': 'added',
                    'name': p2.get('name')
                })
            else:
                changes = {}
                for key in ['land_use', 'plan_far', 'estimated_population']:
                    val1 = p1.get(key)
                    val2 = p2.get(key)
                    if val1 != val2:
                        changes[key] = {'from': val1, 'to': val2}
                
                if changes:
                    comparison['parcel_changes'].append({
                        'id': pid,
                        'type': 'modified',
                        'name': p1.get('name'),
                        'changes': changes
                    })
        
        facilities1 = {f['id']: f for f in scheme1.get('facilities', [])}
        facilities2 = {f['id']: f for f in scheme2.get('facilities', [])}
        
        all_facility_ids = set(facilities1.keys()) | set(facilities2.keys())
        for fid in all_facility_ids:
            f1 = facilities1.get(fid)
            f2 = facilities2.get(fid)
            
            if f1 and not f2:
                comparison['facility_changes'].append({
                    'id': fid,
                    'type': 'removed',
                    'name': f1.get('name')
                })
            elif not f1 and f2:
                comparison['facility_changes'].append({
                    'id': fid,
                    'type': 'added',
                    'name': f2.get('name')
                })
        
        assess1 = scheme1.get('assessments', {})
        assess2 = scheme2.get('assessments', {})
        
        if assess1 and assess2:
            scores1 = assess1.get('service_scores', {}).get('category_scores', {})
            scores2 = assess2.get('service_scores', {}).get('category_scores', {})
            
            for key in set(list(scores1.keys()) + list(scores2.keys())):
                s1 = scores1.get(key, 0)
                s2 = scores2.get(key, 0)
                if s1 != s2:
                    comparison['assessment_differences'][key] = {
                        'from': s1,
                        'to': s2,
                        'delta': round(s2 - s1, 1)
                    }
            
            total1 = assess1.get('service_scores', {}).get('total_score', 0)
            total2 = assess2.get('service_scores', {}).get('total_score', 0)
            comparison['assessment_differences']['total_score'] = {
                'from': total1,
                'to': total2,
                'delta': round(total2 - total1, 1)
            }
        
        return comparison
