import json
import os
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from dataclasses import asdict

from core.models import VolatilitySurface, VolatilityPoint, DataSource, RecordStatus, DataSourceType


class SurfaceStorage:
    def __init__(self, storage_dir: str = None, base_path: str = None):
        if base_path is not None:
            storage_dir = base_path
        if storage_dir is None:
            storage_dir = os.path.join(os.path.dirname(__file__), '..', 'storage')
        self.storage_dir = os.path.abspath(storage_dir)
        os.makedirs(self.storage_dir, exist_ok=True)
        self.surfaces_file = os.path.join(self.storage_dir, 'surfaces.json')
        self._init_storage()

    def _init_storage(self):
        if not os.path.exists(self.surfaces_file):
            with open(self.surfaces_file, 'w', encoding='utf-8') as f:
                json.dump({}, f, ensure_ascii=False, indent=2)

    def _load_all(self) -> Dict[str, Any]:
        os.makedirs(os.path.dirname(self.surfaces_file), exist_ok=True)
        if not os.path.exists(self.surfaces_file):
            self._init_storage()
        with open(self.surfaces_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_all(self, data: Dict[str, Any]):
        os.makedirs(os.path.dirname(self.surfaces_file), exist_ok=True)
        with open(self.surfaces_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_surface(self, surface: VolatilitySurface) -> str:
        data = self._load_all()
        surface_dict = surface.to_dict()
        surface_dict['updated_at'] = datetime.now().isoformat()
        data[surface.surface_id] = surface_dict
        self._save_all(data)
        return surface.surface_id

    def get_surface(self, surface_id: str) -> Optional[Dict[str, Any]]:
        data = self._load_all()
        return data.get(surface_id)

    def list_surfaces(self) -> List[Dict[str, Any]]:
        data = self._load_all()
        return [
            {
                'surface_id': sid,
                'underlying': s['underlying'],
                'trade_date': s['trade_date'],
                'status': s['status'],
                'points_count': len(s['points']),
                'created_at': s['created_at'],
                'updated_at': s['updated_at']
            }
            for sid, s in data.items()
        ]

    def merge_surface(self, existing_id: str, new_points: List[VolatilityPoint],
                      new_data_sources: List[DataSource] = None) -> str:
        existing = self.get_surface(existing_id)
        if not existing:
            raise ValueError(f"Surface {existing_id} not found")

        existing_point_ids = {p['point_id'] for p in existing['points']}
        existing_strike_maturity = {(p['strike'], p['maturity']) for p in existing['points']}

        for new_point in new_points:
            key = (new_point.strike, new_point.maturity)
            if new_point.point_id in existing_point_ids:
                continue
            if key in existing_strike_maturity:
                for i, ep in enumerate(existing['points']):
                    if (ep['strike'], ep['maturity']) == key:
                        existing['points'][i] = new_point.to_dict()
                        break
            else:
                existing['points'].append(new_point.to_dict())

        if new_data_sources:
            existing_source_names = {ds['source_name'] for ds in existing['data_sources']}
            for ds in new_data_sources:
                if ds.source_name not in existing_source_names:
                    existing['data_sources'].append(ds.to_dict())

        existing['updated_at'] = datetime.now().isoformat()

        data = self._load_all()
        data[existing_id] = existing
        self._save_all(data)
        return existing_id

    def update_status(self, surface_id: str, status: RecordStatus, comments: str = ""):
        data = self._load_all()
        if surface_id in data:
            data[surface_id]['status'] = status.value
            if comments:
                data[surface_id]['comments'] = comments
            data[surface_id]['updated_at'] = datetime.now().isoformat()
            self._save_all(data)

    def delete_surface(self, surface_id: str) -> bool:
        data = self._load_all()
        if surface_id in data:
            del data[surface_id]
            self._save_all(data)
            return True
        return False

    def save_raw_surface(self, surface: VolatilitySurface) -> str:
        return self.save_surface(surface)

    def save_cleaned_surface(self, surface: VolatilitySurface) -> str:
        return self.save_surface(surface)

    def save_clean_result(self, result: Any) -> str:
        data = self._load_all()
        result_id = f"result_{result.surface.surface_id}"
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else str(result)
        if 'clean_results' not in data:
            data['clean_results'] = {}
        data['clean_results'][result_id] = result_dict
        self._save_all(data)
        return result_id

    def get_incremental_state(self, surface_id: str) -> Dict[str, Any]:
        existing = self.get_surface(surface_id)
        if not existing:
            return {
                'exists': False,
                'last_status': None,
                'last_processed': None,
                'existing_points': [],
                'existing_sources': []
            }
        return {
            'exists': True,
            'last_status': existing.get('status'),
            'last_processed': existing.get('updated_at'),
            'existing_points': existing.get('points', []),
            'existing_sources': existing.get('data_sources', [])
        }

    def _dict_to_surface(self, d: Dict[str, Any]) -> VolatilitySurface:
        points = []
        for p in d.get('points', []):
            points.append(VolatilityPoint(
                strike=p['strike'],
                maturity=p['maturity'],
                implied_vol=p['implied_vol'],
                tenor=p.get('tenor', ''),
                option_type=p.get('option_type', 'call'),
                raw_value=p.get('raw_value'),
                data_source_id=p.get('data_source_id', ''),
                point_id=p.get('point_id'),
                is_outlier=p.get('is_outlier', False),
                outlier_reason=p.get('outlier_reason', ''),
                is_interpolated=p.get('is_interpolated', False),
                interpolated_from=p.get('interpolated_from', []),
                confidence=p.get('confidence', 1.0),
                tags=p.get('tags', []),
                review_comment=p.get('review_comment', '')
            ))

        data_sources = []
        for ds in d.get('data_sources', []):
            st = ds['source_type']
            if isinstance(st, str):
                st = DataSourceType(st)
            data_sources.append(DataSource(
                source_type=st,
                source_name=ds['source_name'],
                source_path=ds.get('source_path'),
                import_time=datetime.fromisoformat(ds['import_time']) if ds.get('import_time') else datetime.now(),
                field_mapping=ds.get('field_mapping', {}),
                raw_data_hash=ds.get('raw_data_hash', '')
            ))

        return VolatilitySurface(
            surface_id=d['surface_id'],
            underlying=d['underlying'],
            trade_date=datetime.fromisoformat(d['trade_date']),
            points=points,
            data_sources=data_sources,
            created_at=datetime.fromisoformat(d.get('created_at', datetime.now().isoformat())),
            updated_at=datetime.fromisoformat(d.get('updated_at', datetime.now().isoformat())),
            status=RecordStatus(d.get('status', 'pending_review')),
            comments=d.get('comments', ''),
            metadata=d.get('metadata', {})
        )

    def merge_incremental_points(self, existing: Union[str, VolatilitySurface],
                                new_points: List[VolatilityPoint],
                                new_data_sources: List[DataSource] = None) -> VolatilitySurface:
        if isinstance(existing, VolatilitySurface):
            existing_id = existing.surface_id
        else:
            existing_id = existing

        self.merge_surface(existing_id, new_points, new_data_sources)
        updated_dict = self.get_surface(existing_id)
        return self._dict_to_surface(updated_dict)

    def clear_all(self):
        self._save_all({})
