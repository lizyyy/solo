import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

from config import config


class ArchiveStatus(Enum):
    PENDING = "pending"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ArchiveItem:
    item_type: str
    source_path: str
    target_path: str
    hole_number: str
    box_number: Optional[int] = None
    depth_start: Optional[float] = None
    depth_end: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
    copied: bool = False
    copy_time: Optional[str] = None


@dataclass
class ArchivePlan:
    plan_id: str
    created_time: str
    source_directory: str
    target_directory: str
    status: ArchiveStatus
    items: List[ArchiveItem]
    summary: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['status'] = self.status.value
        result['items'] = [asdict(item) for item in self.items]
        return result


class ArchiveManager:
    """归档管理器 - 建立归档计划、执行归档、生成manifest"""
    
    def __init__(self, 
                 validated_photos: List[Dict[str, Any]],
                 csv_records: List[Dict[str, Any]],
                 ocr_notes: List[Dict[str, Any]],
                 gpx_files: List[Dict[str, Any]],
                 target_root: Optional[str] = None):
        self.validated_photos = validated_photos
        self.csv_records = csv_records
        self.ocr_notes = ocr_notes
        self.gpx_files = gpx_files
        
        self.target_root = Path(target_root) if target_root else Path(config.ARCHIVE_ROOT)
        self.plan_id = str(uuid.uuid4())[:8]
        self.archive_plan: Optional[ArchivePlan] = None
        self.rollback_log: List[Dict[str, Any]] = []
    
    def build_archive_plan(self, source_directory: str) -> ArchivePlan:
        """建立归档计划"""
        items: List[ArchiveItem] = []
        
        hole_box_structure = self._build_hole_box_structure()
        
        for hole_number, box_data in hole_box_structure.items():
            for box_number, box_content in box_data.items():
                target_box_dir = self._get_target_directory(hole_number, box_number)
                
                for photo in box_content.get('photos', []):
                    item = self._create_photo_archive_item(photo, target_box_dir)
                    if item:
                        items.append(item)
                
                csv_item = self._create_csv_archive_item(
                    hole_number, box_number, 
                    box_content.get('csv_records', []),
                    target_box_dir
                )
                if csv_item:
                    items.append(csv_item)
                
                for note in box_content.get('notes', []):
                    note_item = self._create_note_archive_item(note, target_box_dir)
                    if note_item:
                        items.append(note_item)
        
        for gpx_file in self.gpx_files:
            gpx_item = self._create_gpx_archive_item(gpx_file)
            if gpx_item:
                items.append(gpx_item)
        
        summary = self._generate_plan_summary(items)
        
        self.archive_plan = ArchivePlan(
            plan_id=self.plan_id,
            created_time=datetime.now().isoformat(),
            source_directory=source_directory,
            target_directory=str(self.target_root),
            status=ArchiveStatus.READY,
            items=items,
            summary=summary
        )
        
        return self.archive_plan
    
    def _build_hole_box_structure(self) -> Dict[str, Dict[int, Dict[str, List[Any]]]]:
        """构建孔号-箱号结构"""
        structure: Dict[str, Dict[int, Dict[str, List[Any]]]] = {}
        
        for photo in self.validated_photos:
            hole = photo.get('hole_number', 'unknown')
            box = photo.get('box_number') or 0
            
            if hole not in structure:
                structure[hole] = {}
            if box not in structure[hole]:
                structure[hole][box] = {'photos': [], 'csv_records': [], 'notes': []}
            
            structure[hole][box]['photos'].append(photo)
        
        for record in self.csv_records:
            hole = record.get('hole_number', 'unknown')
            box = record.get('box_number') or 0
            
            if hole not in structure:
                structure[hole] = {}
            if box not in structure[hole]:
                structure[hole][box] = {'photos': [], 'csv_records': [], 'notes': []}
            
            structure[hole][box]['csv_records'].append(record)
        
        for note in self.ocr_notes:
            hole = note.get('hole_number', 'unknown')
            box = note.get('box_number') or 0
            
            if hole not in structure:
                structure[hole] = {}
            if box not in structure[hole]:
                structure[hole][box] = {'photos': [], 'csv_records': [], 'notes': []}
            
            structure[hole][box]['notes'].append(note)
        
        return structure
    
    def _get_target_directory(self, hole_number: str, box_number: int) -> Path:
        """获取目标目录路径"""
        if box_number > 0:
            return self.target_root / hole_number / f"箱号{box_number}"
        else:
            return self.target_root / hole_number
    
    def _create_photo_archive_item(self, photo: Dict[str, Any], 
                                     target_dir: Path) -> Optional[ArchiveItem]:
        """创建照片归档项"""
        source_path = Path(photo['path'])
        hole = photo.get('hole_number', 'unknown')
        box = photo.get('box_number')
        
        new_filename = self._generate_photo_filename(photo, source_path.suffix)
        target_path = target_dir / 'photos' / new_filename
        
        return ArchiveItem(
            item_type='photo',
            source_path=str(source_path),
            target_path=str(target_path),
            hole_number=hole,
            box_number=box,
            depth_start=photo.get('depth_start'),
            depth_end=photo.get('depth_end'),
            metadata={
                'original_name': photo['name'],
                'size': photo.get('size'),
                'created_time': photo.get('created_time'),
                'gps_latitude': photo.get('gps_latitude'),
                'gps_longitude': photo.get('gps_longitude'),
                'validation_status': photo.get('validation_status')
            }
        )
    
    def _generate_photo_filename(self, photo: Dict[str, Any], extension: str) -> str:
        """生成规范的照片文件名"""
        hole = photo.get('hole_number', 'unknown')
        box = photo.get('box_number') or 0
        depth_start = photo.get('depth_start')
        depth_end = photo.get('depth_end')
        
        parts = [hole]
        if box > 0:
            parts.append(f"箱{box}")
        if depth_start is not None and depth_end is not None:
            parts.append(f"{depth_start:.2f}-{depth_end:.2f}m")
        
        timestamp = datetime.now().strftime('%H%M%S')
        parts.append(timestamp)
        
        return '_'.join(parts) + extension.lower()
    
    def _create_csv_archive_item(self, hole_number: str, box_number: int,
                                   records: List[Dict[str, Any]],
                                   target_dir: Path) -> Optional[ArchiveItem]:
        """创建CSV归档项"""
        if not records:
            return None
        
        filename = f"{hole_number}_箱{box_number}_取样记录.csv" if box_number > 0 else f"{hole_number}_取样记录.csv"
        target_path = target_dir / filename
        
        return ArchiveItem(
            item_type='csv',
            source_path='',
            target_path=str(target_path),
            hole_number=hole_number,
            box_number=box_number if box_number > 0 else None,
            metadata={
                'record_count': len(records),
                'records': records
            }
        )
    
    def _create_note_archive_item(self, note: Dict[str, Any], 
                                    target_dir: Path) -> Optional[ArchiveItem]:
        """创建备注归档项"""
        note_id = note.get('note_id') or f"note_{note.get('paragraph_number', 'unknown')}"
        hole = note.get('hole_number', 'unknown')
        box = note.get('box_number')
        
        filename = f"{hole}_箱{box}_备注_{note_id}.txt" if box else f"{hole}_备注_{note_id}.txt"
        target_path = target_dir / 'notes' / filename
        
        return ArchiveItem(
            item_type='note',
            source_path='',
            target_path=str(target_path),
            hole_number=hole,
            box_number=box,
            depth_start=note.get('depth_start'),
            depth_end=note.get('depth_end'),
            metadata={
                'note_id': note_id,
                'content': note.get('content'),
                'paragraph_number': note.get('paragraph_number')
            }
        )
    
    def _create_gpx_archive_item(self, gpx_file: Dict[str, Any]) -> Optional[ArchiveItem]:
        """创建GPX归档项"""
        source_path = Path(gpx_file['path'])
        target_path = self.target_root / 'gps_traces' / source_path.name
        
        return ArchiveItem(
            item_type='gpx',
            source_path=str(source_path),
            target_path=str(target_path),
            hole_number='all',
            metadata={
                'original_name': gpx_file['name'],
                'size': gpx_file.get('size')
            }
        )
    
    def _generate_plan_summary(self, items: List[ArchiveItem]) -> Dict[str, Any]:
        """生成计划摘要"""
        summary = {
            'total_items': len(items),
            'by_type': {},
            'by_hole': {}
        }
        
        for item in items:
            item_type = item.item_type
            hole = item.hole_number
            
            summary['by_type'][item_type] = summary['by_type'].get(item_type, 0) + 1
            summary['by_hole'][hole] = summary['by_hole'].get(hole, 0) + 1
        
        return summary
    
    def execute_archive(self) -> Dict[str, Any]:
        """执行归档"""
        if not self.archive_plan:
            raise ValueError("归档计划未建立，请先调用 build_archive_plan()")
        
        if self.archive_plan.status != ArchiveStatus.READY:
            raise ValueError(f"归档计划状态不正确: {self.archive_plan.status}")
        
        self.archive_plan.status = ArchiveStatus.IN_PROGRESS
        self.rollback_log = []
        
        results = {
            'plan_id': self.plan_id,
            'start_time': datetime.now().isoformat(),
            'success_count': 0,
            'failed_count': 0,
            'failed_items': [],
            'rollback_operations': []
        }
        
        for item in self.archive_plan.items:
            try:
                success = self._copy_archive_item(item)
                if success:
                    results['success_count'] += 1
                    item.copied = True
                    item.copy_time = datetime.now().isoformat()
                    
                    self.rollback_log.append({
                        'operation': 'copy',
                        'item_type': item.item_type,
                        'source_path': item.source_path,
                        'target_path': item.target_path,
                        'copied': True
                    })
                else:
                    results['failed_count'] += 1
                    results['failed_items'].append({
                        'item_type': item.item_type,
                        'source_path': item.source_path,
                        'error': '复制失败'
                    })
            except Exception as e:
                results['failed_count'] += 1
                results['failed_items'].append({
                    'item_type': item.item_type,
                    'source_path': item.source_path,
                    'error': str(e)
                })
        
        self._generate_manifest()
        self._save_rollback_log()
        
        results['end_time'] = datetime.now().isoformat()
        results['total_count'] = len(self.archive_plan.items)
        
        if results['failed_count'] == 0:
            self.archive_plan.status = ArchiveStatus.COMPLETED
        else:
            self.archive_plan.status = ArchiveStatus.FAILED
        
        return results
    
    def _copy_archive_item(self, item: ArchiveItem) -> bool:
        """复制单个归档项"""
        target_path = Path(item.target_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        if item.item_type == 'photo' or item.item_type == 'gpx':
            source_path = Path(item.source_path)
            if source_path.exists():
                shutil.copy2(source_path, target_path)
                return True
            return False
        
        elif item.item_type == 'csv':
            return self._write_csv_archive(item)
        
        elif item.item_type == 'note':
            return self._write_note_archive(item)
        
        return False
    
    def _write_csv_archive(self, item: ArchiveItem) -> bool:
        """写入CSV归档文件"""
        import csv
        
        records = item.metadata.get('records', []) if item.metadata else []
        if not records:
            return False
        
        target_path = Path(item.target_path)
        
        fieldnames = ['孔号', '箱号', '深度起始', '深度结束', '取样编号', '样品类型', '描述']
        
        with open(target_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for record in records:
                row = {
                    '孔号': record.get('hole_number', ''),
                    '箱号': record.get('box_number', ''),
                    '深度起始': record.get('depth_start', ''),
                    '深度结束': record.get('depth_end', ''),
                    '取样编号': record.get('sample_id', ''),
                    '样品类型': record.get('sample_type', ''),
                    '描述': record.get('description', '')
                }
                writer.writerow(row)
        
        return True
    
    def _write_note_archive(self, item: ArchiveItem) -> bool:
        """写入备注归档文件"""
        content = item.metadata.get('content', '') if item.metadata else ''
        if not content:
            return False
        
        target_path = Path(item.target_path)
        
        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(f"孔号: {item.hole_number}\n")
            if item.box_number:
                f.write(f"箱号: {item.box_number}\n")
            if item.depth_start is not None and item.depth_end is not None:
                f.write(f"深度区间: {item.depth_start} - {item.depth_end}m\n")
            f.write("=" * 50 + "\n\n")
            f.write(content)
        
        return True
    
    def _generate_manifest(self):
        """生成manifest文件"""
        manifest = {
            'manifest_version': '1.0',
            'plan_id': self.plan_id,
            'created_time': datetime.now().isoformat(),
            'source_directory': self.archive_plan.source_directory if self.archive_plan else '',
            'total_items': len(self.archive_plan.items) if self.archive_plan else 0,
            'items': []
        }
        
        if self.archive_plan:
            for item in self.archive_plan.items:
                manifest['items'].append({
                    'item_type': item.item_type,
                    'source_path': item.source_path,
                    'target_path': item.target_path,
                    'hole_number': item.hole_number,
                    'box_number': item.box_number,
                    'depth_start': item.depth_start,
                    'depth_end': item.depth_end,
                    'copied': item.copied,
                    'copy_time': item.copy_time
                })
        
        manifest_path = self.target_root / config.MANIFEST_FILE
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2, default=str)
    
    def _save_rollback_log(self):
        """保存回滚日志"""
        log_data = {
            'plan_id': self.plan_id,
            'archive_time': datetime.now().isoformat(),
            'operations': self.rollback_log
        }
        
        log_path = self.target_root / config.ROLLBACK_LOG
        existing_logs = []
        
        if log_path.exists():
            try:
                with open(log_path, 'r', encoding='utf-8') as f:
                    existing_logs = json.load(f)
                    if not isinstance(existing_logs, list):
                        existing_logs = [existing_logs]
            except json.JSONDecodeError:
                existing_logs = []
        
        existing_logs.append(log_data)
        
        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump(existing_logs, f, ensure_ascii=False, indent=2, default=str)
    
    def get_plan_summary(self) -> Dict[str, Any]:
        """获取计划摘要"""
        if not self.archive_plan:
            return {}
        
        return {
            'plan_id': self.archive_plan.plan_id,
            'status': self.archive_plan.status.value,
            'created_time': self.archive_plan.created_time,
            'source_directory': self.archive_plan.source_directory,
            'target_directory': self.archive_plan.target_directory,
            'summary': self.archive_plan.summary
        }
