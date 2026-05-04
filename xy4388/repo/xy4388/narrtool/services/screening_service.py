"""场次数据导入服务"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from narrtool.database.models import (
    Screening,
    Subtitle,
    Narration,
    VolunteerSchedule,
)
from narrtool.importers import (
    SRTImporter,
    ScriptImporter,
    VolunteerImporter,
)


class ScreeningService:
    """场次数据导入服务"""
    
    def __init__(self, session):
        self.session = session
    
    def create_screening(
        self,
        movie_name: str,
        screening_time,
        duration: float,
        location: Optional[str] = None,
    ) -> Screening:
        """创建新场次"""
        screening = Screening(
            movie_name=movie_name,
            screening_time=screening_time,
            duration=duration,
            location=location,
        )
        self.session.add(screening)
        self.session.flush()
        return screening
    
    def get_screening(self, screening_id: int) -> Optional[Screening]:
        """获取场次"""
        return self.session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
    
    def get_all_screenings(self) -> List[Screening]:
        """获取所有场次"""
        return self.session.query(Screening).order_by(Screening.screening_time).all()
    
    def delete_screening(self, screening_id: int) -> bool:
        """删除场次"""
        screening = self.get_screening(screening_id)
        if screening:
            self.session.delete(screening)
            return True
        return False
    
    def import_subtitles(self, screening_id: int, srt_path: str | Path) -> int:
        """导入 SRT 字幕"""
        screening = self.get_screening(screening_id)
        if not screening:
            raise ValueError(f"场次不存在: {screening_id}")
        
        self.session.query(Subtitle).filter(
            Subtitle.screening_id == screening_id
        ).delete()
        
        importer = SRTImporter(srt_path)
        subtitles_data = importer.data
        
        count = 0
        for data in subtitles_data:
            subtitle = Subtitle(
                screening_id=screening_id,
                index=data["index"],
                start_time=data["start_time"],
                end_time=data["end_time"],
                text=data["text"],
            )
            self.session.add(subtitle)
            count += 1
        
        self.session.flush()
        return count
    
    def import_script(self, screening_id: int, json_path: str | Path) -> int:
        """导入口述稿 JSON"""
        screening = self.get_screening(screening_id)
        if not screening:
            raise ValueError(f"场次不存在: {screening_id}")
        
        self.session.query(Narration).filter(
            Narration.screening_id == screening_id
        ).delete()
        
        importer = ScriptImporter(json_path)
        narrations_data = importer.data
        
        count = 0
        for data in narrations_data:
            narration = Narration(
                screening_id=screening_id,
                index=data["index"],
                start_time=data["start_time"],
                end_time=data["end_time"],
                text=data["text"],
                is_critical=data["is_critical"],
            )
            self.session.add(narration)
            count += 1
        
        self.session.flush()
        return count
    
    def import_volunteers(self, screening_id: int, csv_path: str | Path) -> int:
        """导入志愿者排班"""
        screening = self.get_screening(screening_id)
        if not screening:
            raise ValueError(f"场次不存在: {screening_id}")
        
        self.session.query(VolunteerSchedule).filter(
            VolunteerSchedule.screening_id == screening_id
        ).delete()
        
        importer = VolunteerImporter(csv_path)
        schedules_data = importer.data
        
        count = 0
        for data in schedules_data:
            schedule = VolunteerSchedule(
                screening_id=screening_id,
                volunteer_name=data["volunteer_name"],
                movie_name=data["movie_name"],
                role=data["role"],
                start_time=data["start_time"],
                end_time=data["end_time"],
            )
            self.session.add(schedule)
            count += 1
        
        self.session.flush()
        return count
    
    def import_all(
        self,
        movie_name: str,
        screening_time,
        duration: float,
        location: Optional[str] = None,
        srt_path: Optional[str | Path] = None,
        script_path: Optional[str | Path] = None,
        volunteer_path: Optional[str | Path] = None,
    ) -> Tuple[Screening, Dict[str, int]]:
        """
        一次性导入所有数据
        返回: (screening对象, 导入统计字典)
        """
        screening = self.create_screening(
            movie_name=movie_name,
            screening_time=screening_time,
            duration=duration,
            location=location,
        )
        
        stats = {
            "subtitles": 0,
            "narrations": 0,
            "volunteers": 0,
        }
        
        if srt_path:
            stats["subtitles"] = self.import_subtitles(screening.id, srt_path)
        
        if script_path:
            stats["narrations"] = self.import_script(screening.id, script_path)
        
        if volunteer_path:
            stats["volunteers"] = self.import_volunteers(screening.id, volunteer_path)
        
        return screening, stats
