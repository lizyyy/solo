"""JSON 审计包导出器"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from narrtool.database.models import (
    CheckResult,
    CheckStatus,
    CheckType,
    Severity,
    Screening,
    Subtitle,
    Narration,
    VolunteerSchedule,
)


class JSONExporter:
    """JSON 审计包导出器"""
    
    def __init__(self, session):
        self.session = session
    
    def export(
        self,
        screening_id: int,
        output_path: str | Path,
        include_source_data: bool = True,
    ) -> Path:
        """导出审计包 JSON"""
        screening = self.session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
        
        if not screening:
            raise ValueError(f"场次不存在: {screening_id}")
        
        results = self.session.query(CheckResult).filter(
            CheckResult.screening_id == screening_id
        ).order_by(CheckResult.created_at).all()
        
        audit_data = {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0",
            "screening": self._serialize_screening(screening),
            "check_results": [self._serialize_result(r) for r in results],
            "statistics": self._calculate_statistics(results),
        }
        
        if include_source_data:
            subtitles = self.session.query(Subtitle).filter(
                Subtitle.screening_id == screening_id
            ).order_by(Subtitle.index).all()
            
            narrations = self.session.query(Narration).filter(
                Narration.screening_id == screening_id
            ).order_by(Narration.index).all()
            
            volunteers = self.session.query(VolunteerSchedule).filter(
                VolunteerSchedule.screening_id == screening_id
            ).all()
            
            audit_data["source_data"] = {
                "subtitles": [self._serialize_subtitle(s) for s in subtitles],
                "narrations": [self._serialize_narration(n) for n in narrations],
                "volunteers": [self._serialize_volunteer(v) for v in volunteers],
            }
        
        output_path = Path(output_path)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def export_all(
        self,
        output_path: str | Path,
        include_source_data: bool = True,
    ) -> Path:
        """导出所有场次的审计包"""
        screenings = self.session.query(Screening).order_by(Screening.screening_time).all()
        
        all_data = {
            "generated_at": datetime.now().isoformat(),
            "version": "1.0",
            "screenings": [],
        }
        
        for screening in screenings:
            results = self.session.query(CheckResult).filter(
                CheckResult.screening_id == screening.id
            ).order_by(CheckResult.created_at).all()
            
            screening_data = {
                "screening": self._serialize_screening(screening),
                "check_results": [self._serialize_result(r) for r in results],
                "statistics": self._calculate_statistics(results),
            }
            
            if include_source_data:
                subtitles = self.session.query(Subtitle).filter(
                    Subtitle.screening_id == screening.id
                ).order_by(Subtitle.index).all()
                
                narrations = self.session.query(Narration).filter(
                    Narration.screening_id == screening.id
                ).order_by(Narration.index).all()
                
                volunteers = self.session.query(VolunteerSchedule).filter(
                    VolunteerSchedule.screening_id == screening.id
                ).all()
                
                screening_data["source_data"] = {
                    "subtitles": [self._serialize_subtitle(s) for s in subtitles],
                    "narrations": [self._serialize_narration(n) for n in narrations],
                    "volunteers": [self._serialize_volunteer(v) for v in volunteers],
                }
            
            all_data["screenings"].append(screening_data)
        
        output_path = Path(output_path)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def _serialize_screening(self, screening: Screening) -> Dict[str, Any]:
        """序列化场次信息"""
        return {
            "id": screening.id,
            "movie_name": screening.movie_name,
            "screening_time": screening.screening_time.isoformat() if screening.screening_time else None,
            "duration_minutes": screening.duration,
            "location": screening.location,
            "created_at": screening.created_at.isoformat() if screening.created_at else None,
            "updated_at": screening.updated_at.isoformat() if screening.updated_at else None,
        }
    
    def _serialize_result(self, result: CheckResult) -> Dict[str, Any]:
        """序列化检查结果"""
        return {
            "id": result.id,
            "screening_id": result.screening_id,
            "check_type": result.check_type.value,
            "severity": result.severity.value,
            "status": result.status.value,
            "description": result.description,
            "related_ids": result.related_ids,
            "time_start": result.time_start,
            "time_end": result.time_end,
            "notes": result.notes,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "updated_at": result.updated_at.isoformat() if result.updated_at else None,
        }
    
    def _serialize_subtitle(self, subtitle: Subtitle) -> Dict[str, Any]:
        """序列化字幕"""
        return {
            "index": subtitle.index,
            "start_time": subtitle.start_time,
            "end_time": subtitle.end_time,
            "text": subtitle.text,
        }
    
    def _serialize_narration(self, narration: Narration) -> Dict[str, Any]:
        """序列化口述稿"""
        return {
            "index": narration.index,
            "start_time": narration.start_time,
            "end_time": narration.end_time,
            "text": narration.text,
            "is_critical": bool(narration.is_critical),
        }
    
    def _serialize_volunteer(self, volunteer: VolunteerSchedule) -> Dict[str, Any]:
        """序列化志愿者排班"""
        return {
            "volunteer_name": volunteer.volunteer_name,
            "movie_name": volunteer.movie_name,
            "role": volunteer.role,
            "start_time": volunteer.start_time.isoformat() if volunteer.start_time else None,
            "end_time": volunteer.end_time.isoformat() if volunteer.end_time else None,
        }
    
    def _calculate_statistics(self, results: List[CheckResult]) -> Dict[str, Any]:
        """计算统计信息"""
        stats = {
            "total": len(results),
            "by_type": {},
            "by_status": {},
            "by_severity": {},
        }
        
        for result in results:
            type_key = result.check_type.value
            status_key = result.status.value
            severity_key = result.severity.value
            
            stats["by_type"][type_key] = stats["by_type"].get(type_key, 0) + 1
            stats["by_status"][status_key] = stats["by_status"].get(status_key, 0) + 1
            stats["by_severity"][severity_key] = stats["by_severity"].get(severity_key, 0) + 1
        
        return stats
