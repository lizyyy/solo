#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据存储模块 - 贴片回流生产管理
"""

import json
import hashlib
from pathlib import Path
from datetime import date, datetime
from typing import Dict, List, Optional, Any, TypeVar, Generic
from contextlib import contextmanager

from .models import (
    BOM, PickPlaceData, OvenProfile, 
    SolderPasteBatch, StencilBatch, AOI_Report,
    ReworkRecord, ProductionBatch, Issue,
    generate_id, calculate_hash
)


T = TypeVar('T')


class DataStore:
    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.data_dir = work_dir / 'data'
        self.config_file = work_dir / 'config.json'
        self._ensure_directories()
    
    def _ensure_directories(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / 'boms').mkdir(exist_ok=True)
        (self.data_dir / 'pick_places').mkdir(exist_ok=True)
        (self.data_dir / 'oven_profiles').mkdir(exist_ok=True)
        (self.data_dir / 'solder_pastes').mkdir(exist_ok=True)
        (self.data_dir / 'stencils').mkdir(exist_ok=True)
        (self.data_dir / 'aoi_reports').mkdir(exist_ok=True)
        (self.data_dir / 'reworks').mkdir(exist_ok=True)
        (self.data_dir / 'batches').mkdir(exist_ok=True)
        (self.data_dir / 'issues').mkdir(exist_ok=True)
        (self.data_dir / 'exports').mkdir(exist_ok=True)
        (self.data_dir / 'imports').mkdir(exist_ok=True)
    
    def _get_file_path(self, subdir: str, obj_id: str) -> Path:
        return self.data_dir / subdir / f"{obj_id}.json"
    
    def _save_object(self, subdir: str, obj_id: str, data: Dict[str, Any]):
        file_path = self._get_file_path(subdir, obj_id)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_object(self, subdir: str, obj_id: str) -> Optional[Dict[str, Any]]:
        file_path = self._get_file_path(subdir, obj_id)
        if not file_path.exists():
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _list_objects(self, subdir: str) -> List[str]:
        subdir_path = self.data_dir / subdir
        if not subdir_path.exists():
            return []
        return [f.stem for f in subdir_path.glob('*.json')]
    
    def _delete_object(self, subdir: str, obj_id: str) -> bool:
        file_path = self._get_file_path(subdir, obj_id)
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    
    def calculate_file_hash(self, file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def save_bom(self, bom: BOM):
        bom.updated_at = datetime.now()
        self._save_object('boms', bom.bom_id, bom.to_dict())
    
    def get_bom(self, bom_id: str) -> Optional[BOM]:
        data = self._load_object('boms', bom_id)
        return BOM.from_dict(data) if data else None
    
    def get_bom_by_board(self, board_number: str, board_revision: str = "") -> Optional[BOM]:
        for bom_id in self._list_objects('boms'):
            bom = self.get_bom(bom_id)
            if bom and bom.board_number == board_number:
                if not board_revision or bom.board_revision == board_revision:
                    return bom
        return None
    
    def get_all_boms(self) -> List[BOM]:
        boms = []
        for bid in self._list_objects('boms'):
            bom = self.get_bom(bid)
            if bom:
                boms.append(bom)
        return boms
    
    def save_pick_place(self, pick_place: PickPlaceData):
        pick_place.updated_at = datetime.now()
        self._save_object('pick_places', pick_place.pick_place_id, pick_place.to_dict())
    
    def get_pick_place(self, pick_place_id: str) -> Optional[PickPlaceData]:
        data = self._load_object('pick_places', pick_place_id)
        return PickPlaceData.from_dict(data) if data else None
    
    def get_pick_place_by_board(self, board_number: str, board_revision: str = "") -> Optional[PickPlaceData]:
        for pid in self._list_objects('pick_places'):
            pp = self.get_pick_place(pid)
            if pp and pp.board_number == board_number:
                if not board_revision or pp.board_revision == board_revision:
                    return pp
        return None
    
    def get_all_pick_places(self) -> List[PickPlaceData]:
        pick_places = []
        for pid in self._list_objects('pick_places'):
            pp = self.get_pick_place(pid)
            if pp:
                pick_places.append(pp)
        return pick_places
    
    def save_oven_profile(self, profile: OvenProfile):
        profile.updated_at = datetime.now()
        self._save_object('oven_profiles', profile.profile_id, profile.to_dict())
    
    def get_oven_profile(self, profile_id: str) -> Optional[OvenProfile]:
        data = self._load_object('oven_profiles', profile_id)
        return OvenProfile.from_dict(data) if data else None
    
    def get_oven_profile_by_name(self, name: str) -> Optional[OvenProfile]:
        for pid in self._list_objects('oven_profiles'):
            profile = self.get_oven_profile(pid)
            if profile and profile.name == name:
                return profile
        return None
    
    def get_all_oven_profiles(self) -> List[OvenProfile]:
        profiles = []
        for pid in self._list_objects('oven_profiles'):
            profile = self.get_oven_profile(pid)
            if profile:
                profiles.append(profile)
        return profiles
    
    def save_solder_paste(self, paste: SolderPasteBatch):
        paste.updated_at = datetime.now()
        self._save_object('solder_pastes', paste.batch_id, paste.to_dict())
    
    def get_solder_paste(self, batch_id: str) -> Optional[SolderPasteBatch]:
        data = self._load_object('solder_pastes', batch_id)
        return SolderPasteBatch.from_dict(data) if data else None
    
    def get_solder_paste_by_lot(self, lot_number: str) -> Optional[SolderPasteBatch]:
        for bid in self._list_objects('solder_pastes'):
            paste = self.get_solder_paste(bid)
            if paste and paste.lot_number == lot_number:
                return paste
        return None
    
    def get_all_solder_pastes(self) -> List[SolderPasteBatch]:
        pastes = []
        for bid in self._list_objects('solder_pastes'):
            paste = self.get_solder_paste(bid)
            if paste:
                pastes.append(paste)
        return pastes
    
    def get_active_solder_pastes(self) -> List[SolderPasteBatch]:
        all_pastes = self.get_all_solder_pastes()
        now = datetime.now()
        return [p for p in all_pastes if p.status not in ["已过期", "已废弃"] and not p.is_expired()]
    
    def save_stencil(self, stencil: StencilBatch):
        stencil.updated_at = datetime.now()
        self._save_object('stencils', stencil.batch_id, stencil.to_dict())
    
    def get_stencil(self, batch_id: str) -> Optional[StencilBatch]:
        data = self._load_object('stencils', batch_id)
        return StencilBatch.from_dict(data) if data else None
    
    def get_stencil_by_id(self, stencil_id: str) -> Optional[StencilBatch]:
        for bid in self._list_objects('stencils'):
            stencil = self.get_stencil(bid)
            if stencil and stencil.stencil_id == stencil_id:
                return stencil
        return None
    
    def get_stencils_for_board(self, board_number: str, board_revision: str = "") -> List[StencilBatch]:
        stencils = []
        for bid in self._list_objects('stencils'):
            stencil = self.get_stencil(bid)
            if stencil and stencil.board_number == board_number:
                if not board_revision or stencil.board_revision == board_revision:
                    stencils.append(stencil)
        return stencils
    
    def get_all_stencils(self) -> List[StencilBatch]:
        stencils = []
        for bid in self._list_objects('stencils'):
            stencil = self.get_stencil(bid)
            if stencil:
                stencils.append(stencil)
        return stencils
    
    def save_aoi_report(self, aoi: AOI_Report):
        aoi.updated_at = datetime.now()
        self._save_object('aoi_reports', aoi.aoi_id, aoi.to_dict())
    
    def get_aoi_report(self, aoi_id: str) -> Optional[AOI_Report]:
        data = self._load_object('aoi_reports', aoi_id)
        return AOI_Report.from_dict(data) if data else None
    
    def get_aoi_reports_by_serial(self, serial_number: str) -> List[AOI_Report]:
        reports = []
        for aid in self._list_objects('aoi_reports'):
            aoi = self.get_aoi_report(aid)
            if aoi and aoi.serial_number == serial_number:
                reports.append(aoi)
        reports.sort(key=lambda x: x.inspection_time, reverse=True)
        return reports
    
    def get_aoi_reports_by_board(self, board_number: str, board_revision: str = "") -> List[AOI_Report]:
        reports = []
        for aid in self._list_objects('aoi_reports'):
            aoi = self.get_aoi_report(aid)
            if aoi and aoi.board_number == board_number:
                if not board_revision or aoi.board_revision == board_revision:
                    reports.append(aoi)
        reports.sort(key=lambda x: x.inspection_time, reverse=True)
        return reports
    
    def get_all_aoi_reports(self) -> List[AOI_Report]:
        reports = []
        for aid in self._list_objects('aoi_reports'):
            aoi = self.get_aoi_report(aid)
            if aoi:
                reports.append(aoi)
        return reports
    
    def save_rework_record(self, rework: ReworkRecord):
        self._save_object('reworks', rework.rework_id, rework.to_dict())
    
    def get_rework_record(self, rework_id: str) -> Optional[ReworkRecord]:
        data = self._load_object('reworks', rework_id)
        return ReworkRecord.from_dict(data) if data else None
    
    def get_reworks_by_serial(self, serial_number: str) -> List[ReworkRecord]:
        reworks = []
        for rid in self._list_objects('reworks'):
            rework = self.get_rework_record(rid)
            if rework and rework.serial_number == serial_number:
                reworks.append(rework)
        reworks.sort(key=lambda x: x.rework_time, reverse=True)
        return reworks
    
    def get_reworks_by_board(self, board_number: str, board_revision: str = "") -> List[ReworkRecord]:
        reworks = []
        for rid in self._list_objects('reworks'):
            rework = self.get_rework_record(rid)
            if rework and rework.board_number == board_number:
                if not board_revision or rework.board_revision == board_revision:
                    reworks.append(rework)
        reworks.sort(key=lambda x: x.rework_time, reverse=True)
        return reworks
    
    def get_rework_count_for_serial(self, serial_number: str) -> int:
        return len(self.get_reworks_by_serial(serial_number))
    
    def get_all_reworks(self) -> List[ReworkRecord]:
        reworks = []
        for rid in self._list_objects('reworks'):
            rework = self.get_rework_record(rid)
            if rework:
                reworks.append(rework)
        return reworks
    
    def save_production_batch(self, batch: ProductionBatch):
        batch.updated_at = datetime.now()
        self._save_object('batches', batch.batch_id, batch.to_dict())
    
    def get_production_batch(self, batch_id: str) -> Optional[ProductionBatch]:
        data = self._load_object('batches', batch_id)
        return ProductionBatch.from_dict(data) if data else None
    
    def get_production_batch_by_board(self, board_number: str, board_revision: str = "") -> Optional[ProductionBatch]:
        for bid in self._list_objects('batches'):
            batch = self.get_production_batch(bid)
            if batch and batch.board_number == board_number:
                if not board_revision or batch.board_revision == board_revision:
                    return batch
        return None
    
    def get_production_batches_by_date(self, production_date: date) -> List[ProductionBatch]:
        batches = []
        for bid in self._list_objects('batches'):
            batch = self.get_production_batch(bid)
            if batch and batch.production_date == production_date:
                batches.append(batch)
        batches.sort(key=lambda x: x.start_time or x.created_at)
        return batches
    
    def get_all_production_batches(self) -> List[ProductionBatch]:
        batches = []
        for bid in self._list_objects('batches'):
            batch = self.get_production_batch(bid)
            if batch:
                batches.append(batch)
        return batches
    
    def save_issue(self, issue: Issue):
        self._save_object('issues', issue.issue_id, issue.to_dict())
    
    def get_issue(self, issue_id: str) -> Optional[Issue]:
        data = self._load_object('issues', issue_id)
        return Issue.from_dict(data) if data else None
    
    def get_issues_by_batch(self, batch_id: str) -> List[Issue]:
        issues = []
        for iid in self._list_objects('issues'):
            issue = self.get_issue(iid)
            if issue and issue.batch_id == batch_id:
                issues.append(issue)
        return issues
    
    def get_issues_by_board(self, board_number: str) -> List[Issue]:
        issues = []
        for iid in self._list_objects('issues'):
            issue = self.get_issue(iid)
            if issue and issue.board_number == board_number:
                issues.append(issue)
        return issues
    
    def get_unconfirmed_issues(self) -> List[Issue]:
        issues = []
        for iid in self._list_objects('issues'):
            issue = self.get_issue(iid)
            if issue and not issue.confirmed:
                issues.append(issue)
        return issues
    
    def get_all_issues(self) -> List[Issue]:
        issues = []
        for iid in self._list_objects('issues'):
            issue = self.get_issue(iid)
            if issue:
                issues.append(issue)
        return issues
    
    def get_export_dir(self) -> Path:
        return self.data_dir / 'exports'
    
    def get_import_dir(self) -> Path:
        return self.data_dir / 'imports'
    
    def save_import_record(self, file_hash: str, file_name: str, import_type: str, 
                            records_count: int, board_number: str = "", board_revision: str = ""):
        import_record = {
            "hash": file_hash,
            "file_name": file_name,
            "type": import_type,
            "records_count": records_count,
            "board_number": board_number,
            "board_revision": board_revision,
            "imported_at": datetime.now().isoformat()
        }
        
        import_file = self.data_dir / 'imports' / f"{file_hash}.json"
        with open(import_file, 'w', encoding='utf-8') as f:
            json.dump(import_record, f, ensure_ascii=False, indent=2)
    
    def is_file_imported(self, file_hash: str) -> bool:
        import_file = self.data_dir / 'imports' / f"{file_hash}.json"
        return import_file.exists()
    
    def get_import_records(self) -> List[Dict[str, Any]]:
        records = []
        import_dir = self.data_dir / 'imports'
        if not import_dir.exists():
            return records
        
        for f in import_dir.glob('*.json'):
            with open(f, 'r', encoding='utf-8') as fh:
                records.append(json.load(fh))
        
        records.sort(key=lambda x: x.get('imported_at', ''), reverse=True)
        return records
    
    def get_config(self) -> Dict[str, Any]:
        if not self.config_file.exists():
            default_config = {
                "default_soak_start": 150.0,
                "default_soak_end": 180.0,
                "default_peak_min_lead": 183.0,
                "default_peak_max_lead": 220.0,
                "default_peak_min_lead_free": 235.0,
                "default_peak_max_lead_free": 260.0,
                "default_soak_min_time": 60.0,
                "default_soak_max_time": 120.0,
                "default_ramp_up_rate": 2.0,
                "default_ramp_down_rate": 3.0,
                "default_max_thaw_hours": 8.0,
                "default_max_room_temp_hours": 24.0,
                "max_reworks_allowed": 2
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            return default_config
        
        with open(self.config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def update_config(self, updates: Dict[str, Any]):
        config = self.get_config()
        config.update(updates)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
