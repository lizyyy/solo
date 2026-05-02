"""
数据存储模块
提供烧成记录的本地持久化功能
"""

import json
import os
import shutil
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from pathlib import Path

from ..models import (
    FiringRecord, TemperaturePoint, FiringPlan, FiringSegment,
    GlazeBatch, WorkPiece, Observation, Risk, TimelineEvent,
    RiskLevel, RiskType, ReviewStatus
)


class DataStore:
    """数据存储类"""
    
    def __init__(self, data_dir: Optional[str] = None):
        """
        初始化数据存储
        
        Args:
            data_dir: 数据存储目录，默认为用户目录下的 .kiln_review
        """
        if data_dir is None:
            home = Path.home()
            self.data_dir = home / ".kiln_review" / "data"
        else:
            self.data_dir = Path(data_dir)
        
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.records_dir = self.data_dir / "records"
        self.records_dir.mkdir(exist_ok=True)
        self.backups_dir = self.data_dir / "backups"
        self.backups_dir.mkdir(exist_ok=True)
        
        self.index_file = self.data_dir / "index.json"
    
    def save_record(self, record: FiringRecord) -> str:
        """
        保存烧成记录
        
        Args:
            record: 烧成记录
            
        Returns:
            保存的文件路径
        """
        record.updated_at = datetime.now()
        
        record_data = self._record_to_dict(record)
        
        record_file = self.records_dir / f"{record.record_id}.json"
        
        with open(record_file, 'w', encoding='utf-8') as f:
            json.dump(record_data, f, ensure_ascii=False, indent=2, default=str)
        
        self._update_index(record)
        
        return str(record_file)
    
    def load_record(self, record_id: str) -> Optional[FiringRecord]:
        """
        加载烧成记录
        
        Args:
            record_id: 记录ID
            
        Returns:
            烧成记录，如果不存在则返回None
        """
        record_file = self.records_dir / f"{record_id}.json"
        
        if not record_file.exists():
            return None
        
        try:
            with open(record_file, 'r', encoding='utf-8') as f:
                record_data = json.load(f)
            
            return self._dict_to_record(record_data)
        
        except Exception as e:
            print(f"加载记录失败: {e}")
            return None
    
    def delete_record(self, record_id: str) -> bool:
        """
        删除烧成记录
        
        Args:
            record_id: 记录ID
            
        Returns:
            是否删除成功
        """
        record_file = self.records_dir / f"{record_id}.json"
        
        if not record_file.exists():
            return False
        
        try:
            self._backup_record(record_id)
            record_file.unlink()
            self._remove_from_index(record_id)
            return True
        except Exception as e:
            print(f"删除记录失败: {e}")
            return False
    
    def list_records(self) -> List[Dict[str, Any]]:
        """
        列出所有记录的摘要信息
        
        Returns:
            记录摘要列表
        """
        if not self.index_file.exists():
            return []
        
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                index = json.load(f)
            return index.get('records', [])
        except Exception:
            return []
    
    def get_record_summary(self, record_id: str) -> Optional[Dict[str, Any]]:
        """
        获取记录摘要
        
        Args:
            record_id: 记录ID
            
        Returns:
            记录摘要
        """
        records = self.list_records()
        for record in records:
            if record.get('record_id') == record_id:
                return record
        return None
    
    def create_backup(self, record_id: str, backup_name: Optional[str] = None) -> Optional[str]:
        """
        创建记录备份
        
        Args:
            record_id: 记录ID
            backup_name: 备份名称，默认为时间戳
            
        Returns:
            备份文件路径
        """
        record_file = self.records_dir / f"{record_id}.json"
        
        if not record_file.exists():
            return None
        
        if backup_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{record_id}_{timestamp}"
        
        backup_file = self.backups_dir / f"{backup_name}.json"
        
        try:
            shutil.copy2(record_file, backup_file)
            return str(backup_file)
        except Exception as e:
            print(f"创建备份失败: {e}")
            return None
    
    def _backup_record(self, record_id: str):
        """在删除前自动备份"""
        self.create_backup(record_id, f"{record_id}_deleted_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    
    def _update_index(self, record: FiringRecord):
        """更新记录索引"""
        index = {'records': []}
        
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    index = json.load(f)
            except Exception:
                pass
        
        summary = {
            'record_id': record.record_id,
            'name': record.name,
            'created_at': record.created_at.isoformat() if record.created_at else None,
            'updated_at': record.updated_at.isoformat() if record.updated_at else None,
            'start_time': record.start_time.isoformat() if record.start_time else None,
            'end_time': record.end_time.isoformat() if record.end_time else None,
            'max_temperature': record.max_temperature,
            'risk_count': len(record.risks),
            'work_count': len(record.work_pieces),
            'pending_risks': len(record.get_pending_risks())
        }
        
        existing = None
        for i, rec in enumerate(index.get('records', [])):
            if rec.get('record_id') == record.record_id:
                existing = i
                break
        
        if existing is not None:
            index['records'][existing] = summary
        else:
            index['records'].append(summary)
        
        index['records'].sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
    
    def _remove_from_index(self, record_id: str):
        """从索引中移除记录"""
        if not self.index_file.exists():
            return
        
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                index = json.load(f)
            
            index['records'] = [r for r in index.get('records', []) if r.get('record_id') != record_id]
            
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(index, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def _record_to_dict(self, record: FiringRecord) -> Dict[str, Any]:
        """将烧成记录转换为字典"""
        return {
            'record_id': record.record_id,
            'name': record.name,
            'created_at': record.created_at.isoformat() if record.created_at else None,
            'updated_at': record.updated_at.isoformat() if record.updated_at else None,
            'temperature_data': [self._temp_point_to_dict(p) for p in record.temperature_data],
            'firing_plan': self._firing_plan_to_dict(record.firing_plan) if record.firing_plan else None,
            'glaze_batches': [self._glaze_batch_to_dict(b) for b in record.glaze_batches],
            'work_pieces': [self._work_piece_to_dict(w) for w in record.work_pieces],
            'observations': [self._observation_to_dict(o) for o in record.observations],
            'risks': [self._risk_to_dict(r) for r in record.risks],
            'timeline': [self._timeline_event_to_dict(e) for e in record.timeline],
            'review_notes': record.review_notes,
            'reviewed_by': record.reviewed_by,
            'reviewed_at': record.reviewed_at.isoformat() if record.reviewed_at else None
        }
    
    def _dict_to_record(self, data: Dict[str, Any]) -> FiringRecord:
        """将字典转换为烧成记录"""
        record = FiringRecord(
            record_id=data.get('record_id', ''),
            name=data.get('name', '未命名记录')
        )
        
        created_at = data.get('created_at')
        if created_at:
            record.created_at = datetime.fromisoformat(created_at)
        
        updated_at = data.get('updated_at')
        if updated_at:
            record.updated_at = datetime.fromisoformat(updated_at)
        
        record.temperature_data = [self._dict_to_temp_point(p) for p in data.get('temperature_data', [])]
        record.firing_plan = self._dict_to_firing_plan(data.get('firing_plan'))
        record.glaze_batches = [self._dict_to_glaze_batch(b) for b in data.get('glaze_batches', [])]
        record.work_pieces = [self._dict_to_work_piece(w) for w in data.get('work_pieces', [])]
        record.observations = [self._dict_to_observation(o) for o in data.get('observations', [])]
        record.risks = [self._dict_to_risk(r) for r in data.get('risks', [])]
        record.timeline = [self._dict_to_timeline_event(e) for e in data.get('timeline', [])]
        
        record.review_notes = data.get('review_notes')
        record.reviewed_by = data.get('reviewed_by')
        
        reviewed_at = data.get('reviewed_at')
        if reviewed_at:
            record.reviewed_at = datetime.fromisoformat(reviewed_at)
        
        return record
    
    def _temp_point_to_dict(self, point: TemperaturePoint) -> Dict[str, Any]:
        return {
            'timestamp': point.timestamp.isoformat(),
            'temperatures': point.temperatures,
            'note': point.note
        }
    
    def _dict_to_temp_point(self, data: Dict[str, Any]) -> TemperaturePoint:
        return TemperaturePoint(
            timestamp=datetime.fromisoformat(data['timestamp']),
            temperatures=data.get('temperatures', {}),
            note=data.get('note')
        )
    
    def _firing_plan_to_dict(self, plan: FiringPlan) -> Dict[str, Any]:
        return {
            'plan_id': plan.plan_id,
            'name': plan.name,
            'description': plan.description,
            'segments': [self._segment_to_dict(s) for s in plan.segments],
            'created_at': plan.created_at.isoformat() if plan.created_at else None
        }
    
    def _dict_to_firing_plan(self, data: Optional[Dict[str, Any]]) -> Optional[FiringPlan]:
        if not data:
            return None
        
        plan = FiringPlan(
            plan_id=data.get('plan_id', ''),
            name=data.get('name', '未命名计划'),
            description=data.get('description'),
            segments=[self._dict_to_segment(s) for s in data.get('segments', [])]
        )
        
        created_at = data.get('created_at')
        if created_at:
            plan.created_at = datetime.fromisoformat(created_at)
        
        return plan
    
    def _segment_to_dict(self, segment: FiringSegment) -> Dict[str, Any]:
        return {
            'segment_id': segment.segment_id,
            'name': segment.name,
            'start_temperature': segment.start_temperature,
            'end_temperature': segment.end_temperature,
            'rate': segment.rate,
            'hold_time_minutes': segment.hold_time.total_seconds() / 60 if segment.hold_time else 0,
            'description': segment.description
        }
    
    def _dict_to_segment(self, data: Dict[str, Any]) -> FiringSegment:
        hold_time = None
        hold_time_minutes = data.get('hold_time_minutes')
        if hold_time_minutes and hold_time_minutes > 0:
            hold_time = timedelta(minutes=hold_time_minutes)
        
        return FiringSegment(
            segment_id=data.get('segment_id', ''),
            name=data.get('name', '未命名段'),
            start_temperature=data.get('start_temperature', 0.0),
            end_temperature=data.get('end_temperature', 0.0),
            rate=data.get('rate', 0.0),
            hold_time=hold_time,
            description=data.get('description')
        )
    
    def _glaze_batch_to_dict(self, batch: GlazeBatch) -> Dict[str, Any]:
        return {
            'batch_id': batch.batch_id,
            'glaze_name': batch.glaze_name,
            'formula': batch.formula,
            'quantity': batch.quantity,
            'unit': batch.unit,
            'created_date': batch.created_date.isoformat() if batch.created_date else None,
            'expiration_date': batch.expiration_date.isoformat() if batch.expiration_date else None,
            'notes': batch.notes,
            'status': batch.status
        }
    
    def _dict_to_glaze_batch(self, data: Dict[str, Any]) -> GlazeBatch:
        batch = GlazeBatch(
            batch_id=data.get('batch_id', ''),
            glaze_name=data.get('glaze_name', ''),
            formula=data.get('formula'),
            quantity=data.get('quantity'),
            unit=data.get('unit', 'g'),
            notes=data.get('notes'),
            status=data.get('status', '可用')
        )
        
        created_date = data.get('created_date')
        if created_date:
            batch.created_date = datetime.fromisoformat(created_date)
        
        expiration_date = data.get('expiration_date')
        if expiration_date:
            batch.expiration_date = datetime.fromisoformat(expiration_date)
        
        return batch
    
    def _work_piece_to_dict(self, work: WorkPiece) -> Dict[str, Any]:
        return {
            'work_id': work.work_id,
            'title': work.title,
            'artist': work.artist,
            'glaze_batch_id': work.glaze_batch_id,
            'shelf_layer': work.shelf_layer,
            'notes': work.notes,
            'status': work.status
        }
    
    def _dict_to_work_piece(self, data: Dict[str, Any]) -> WorkPiece:
        return WorkPiece(
            work_id=data.get('work_id', ''),
            title=data.get('title'),
            artist=data.get('artist'),
            glaze_batch_id=data.get('glaze_batch_id'),
            shelf_layer=data.get('shelf_layer'),
            notes=data.get('notes'),
            status=data.get('status', '待烧成')
        )
    
    def _observation_to_dict(self, obs: Observation) -> Dict[str, Any]:
        return {
            'observation_id': obs.observation_id,
            'timestamp': obs.timestamp.isoformat(),
            'content': obs.content,
            'author': obs.author,
            'category': obs.category,
            'related_work_ids': obs.related_work_ids
        }
    
    def _dict_to_observation(self, data: Dict[str, Any]) -> Observation:
        return Observation(
            observation_id=data.get('observation_id', ''),
            timestamp=datetime.fromisoformat(data['timestamp']),
            content=data.get('content', ''),
            author=data.get('author'),
            category=data.get('category'),
            related_work_ids=data.get('related_work_ids', [])
        )
    
    def _risk_to_dict(self, risk: Risk) -> Dict[str, Any]:
        return {
            'risk_id': risk.risk_id,
            'risk_type': risk.risk_type.value,
            'level': risk.level.value,
            'title': risk.title,
            'description': risk.description,
            'timestamp': risk.timestamp.isoformat() if risk.timestamp else None,
            'related_data': risk.related_data,
            'review_status': risk.review_status.value,
            'review_notes': risk.review_notes,
            'reviewed_by': risk.reviewed_by,
            'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None
        }
    
    def _dict_to_risk(self, data: Dict[str, Any]) -> Risk:
        risk = Risk(
            risk_id=data.get('risk_id', ''),
            risk_type=self._parse_enum(RiskType, data.get('risk_type', ''), RiskType.OTHER),
            level=self._parse_enum(RiskLevel, data.get('level', ''), RiskLevel.LOW),
            title=data.get('title', ''),
            description=data.get('description', ''),
            related_data=data.get('related_data', {}),
            review_status=self._parse_enum(ReviewStatus, data.get('review_status', ''), ReviewStatus.PENDING),
            review_notes=data.get('review_notes'),
            reviewed_by=data.get('reviewed_by')
        )
        
        timestamp = data.get('timestamp')
        if timestamp:
            risk.timestamp = datetime.fromisoformat(timestamp)
        
        reviewed_at = data.get('reviewed_at')
        if reviewed_at:
            risk.reviewed_at = datetime.fromisoformat(reviewed_at)
        
        return risk
    
    def _timeline_event_to_dict(self, event: TimelineEvent) -> Dict[str, Any]:
        return {
            'event_id': event.event_id,
            'timestamp': event.timestamp.isoformat(),
            'event_type': event.event_type,
            'title': event.title,
            'description': event.description,
            'related_objects': event.related_objects,
            'metadata': event.metadata
        }
    
    def _dict_to_timeline_event(self, data: Dict[str, Any]) -> TimelineEvent:
        return TimelineEvent(
            event_id=data.get('event_id', ''),
            timestamp=datetime.fromisoformat(data['timestamp']),
            event_type=data.get('event_type', ''),
            title=data.get('title', ''),
            description=data.get('description'),
            related_objects=data.get('related_objects', {}),
            metadata=data.get('metadata', {})
        )
    
    def _parse_enum(self, enum_class, value: str, default):
        """解析枚举值"""
        for member in enum_class:
            if member.value == value:
                return member
        return default
