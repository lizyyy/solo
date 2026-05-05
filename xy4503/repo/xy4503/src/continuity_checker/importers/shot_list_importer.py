from dataclasses import dataclass
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from .base import BaseImporter, ImportResult
from ..models.shot import Shot, ShotList, ShotStatus


@dataclass
class ShotListImporter(BaseImporter[ShotList]):
    
    def __init__(self):
        super().__init__()
        self.existing_shots: Dict[str, Shot] = {}
    
    def set_existing_shots(self, shots: Dict[str, Shot]):
        self.existing_shots = shots
    
    def import_from_dict(self, data: Dict[str, Any]) -> ImportResult[ShotList]:
        result = ImportResult[ShotList]()
        
        try:
            shot_list = ShotList()
            
            if "rows" in data:
                for idx, row in enumerate(data["rows"]):
                    shot = self._parse_row(row, idx + 2, result)
                    if shot:
                        merged = self._merge_shot(shot, result)
                        shot_list.shots.append(merged)
            
            elif "shots" in data:
                for idx, shot_data in enumerate(data["shots"]):
                    shot = Shot.from_dict(shot_data)
                    merged = self._merge_shot(shot, result)
                    shot_list.shots.append(merged)
            
            result.data = shot_list
            return result
        
        except Exception as e:
            result.add_error(f"导入失败: {str(e)}")
            return result
    
    def _parse_row(self, row: Dict[str, str], line_num: int, result: ImportResult) -> Optional[Shot]:
        try:
            scene_number = row.get("场景号", row.get("scene_number", row.get("scene", ""))).strip()
            shot_number = row.get("镜头号", row.get("shot_number", row.get("shot", ""))).strip()
            
            shot_id = row.get("镜头ID", row.get("shot_id", ""))
            if not shot_id and scene_number and shot_number:
                shot_id = f"{scene_number}_{shot_number}"
            elif not shot_id:
                shot_id = f"shot_{uuid.uuid4().hex[:8]}"
            
            description = row.get("描述", row.get("description", row.get("内容", ""))).strip()
            location = row.get("地点", row.get("location", row.get("场地", ""))).strip()
            setup = row.get("机位", row.get("setup", row.get("镜头设置", ""))).strip()
            
            actors = self._parse_list(row.get("演员", row.get("actors", row.get("参演演员", ""))))
            wardrobe = self._parse_list(row.get("服装", row.get("wardrobe", "")))
            props = self._parse_list(row.get("道具", row.get("props", "")))
            
            status_str = row.get("状态", row.get("status", "planned")).strip().lower()
            try:
                status = ShotStatus(status_str)
            except ValueError:
                status = ShotStatus.PLANNED
                result.add_warning(f"行 {line_num}: 无效的状态 '{status_str}'，使用默认值 'planned'")
            
            planned_date = self._parse_date(row.get("计划日期", row.get("planned_date", row.get("拍摄日期", ""))))
            actual_date = self._parse_date(row.get("实际日期", row.get("actual_date", "")))
            start_time = self._parse_time(row.get("开始时间", row.get("start_time", "")))
            end_time = self._parse_time(row.get("结束时间", row.get("end_time", "")))
            
            duration_str = row.get("时长", row.get("duration", row.get("预计时长", ""))).strip()
            duration = None
            if duration_str:
                try:
                    duration = int(duration_str)
                except ValueError:
                    result.add_warning(f"行 {line_num}: 无效的时长 '{duration_str}'")
            
            notes = row.get("备注", row.get("notes", row.get("说明", ""))).strip()
            
            return Shot(
                shot_id=shot_id,
                scene_number=scene_number,
                shot_number=shot_number,
                description=description,
                location=location,
                setup=setup,
                actors=actors,
                wardrobe=wardrobe,
                props=props,
                status=status,
                planned_date=planned_date,
                actual_date=actual_date,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                notes=notes
            )
        
        except Exception as e:
            result.add_error(f"行 {line_num}: 解析失败 - {str(e)}")
            return None
    
    def _merge_shot(self, new_shot: Shot, result: ImportResult) -> Shot:
        if new_shot.shot_id not in self.existing_shots:
            return new_shot
        
        old_shot = self.existing_shots[new_shot.shot_id]
        result.add_warning(f"镜头 {new_shot.shot_id} 已存在，合并数据")
        
        merged_shot = Shot(
            shot_id=new_shot.shot_id,
            scene_number=self._merge_values(old_shot.scene_number, new_shot.scene_number),
            shot_number=self._merge_values(old_shot.shot_number, new_shot.shot_number),
            description=self._merge_values(old_shot.description, new_shot.description),
            location=self._merge_values(old_shot.location, new_shot.location),
            setup=self._merge_values(old_shot.setup, new_shot.setup),
            actors=self._merge_values(old_shot.actors, new_shot.actors, keep_old_if_empty=False),
            wardrobe=self._merge_values(old_shot.wardrobe, new_shot.wardrobe, keep_old_if_empty=False),
            props=self._merge_values(old_shot.props, new_shot.props, keep_old_if_empty=False),
            status=new_shot.status if new_shot.status != ShotStatus.PLANNED else old_shot.status,
            planned_date=self._merge_values(old_shot.planned_date, new_shot.planned_date),
            actual_date=self._merge_values(old_shot.actual_date, new_shot.actual_date),
            start_time=self._merge_values(old_shot.start_time, new_shot.start_time),
            end_time=self._merge_values(old_shot.end_time, new_shot.end_time),
            duration=self._merge_values(old_shot.duration, new_shot.duration),
            notes=self._merge_values(old_shot.notes, new_shot.notes),
            created_at=old_shot.created_at,
            updated_at=datetime.now()
        )
        
        return merged_shot
