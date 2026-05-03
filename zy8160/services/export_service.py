from typing import List, Optional
from datetime import date, time, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

import database as db
import schemas


class ExportService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def export_call_sheet(
        self, 
        target_date: date,
        include_validation_notes: bool = True
    ) -> schemas.CallSheetExport:
        day_plans = self.db.query(db.ShootingPlan).filter(
            db.ShootingPlan.date == target_date
        ).order_by(db.ShootingPlan.start_time).all()

        call_sheet_scenes: List[schemas.CallSheetScene] = []
        all_actors: set = set()
        weather_notes_list: List[str] = []
        special_instructions: List[str] = []

        locations_with_weather = set()

        for plan in day_plans:
            scene = plan.scene
            if not scene:
                continue

            location = scene.location
            location_name = location.name if location else "未知地点"

            if location and location.is_exterior and location.id not in locations_with_weather:
                locations_with_weather.add(location.id)
                weather = self.db.query(db.Weather).filter(
                    and_(
                        db.Weather.location_id == location.id,
                        db.Weather.date == target_date
                    )
                ).first()
                if weather:
                    weather_note = f"{location_name}: {weather.condition}"
                    if weather.temperature:
                        weather_note += f", {weather.temperature}°C"
                    if weather.is_rainy:
                        weather_note += " ⚠️有雨"
                        special_instructions.append(f"注意：外景 {location_name} 有雨，请准备防雨设备或考虑改棚拍")
                    weather_notes_list.append(weather_note)

            start_str = plan.start_time.strftime("%H:%M") if plan.start_time else "未知"
            end_str = plan.end_time.strftime("%H:%M") if plan.end_time else "未知"
            
            duration_minutes = scene.estimated_duration_minutes
            duration_str = f"{duration_minutes // 60}小时"
            if duration_minutes % 60 > 0:
                duration_str += f"{duration_minutes % 60}分钟"

            night_label = " [夜戏]" if scene.is_night else ""
            
            call_sheet_scenes.append(schemas.CallSheetScene(
                scene_number=scene.scene_number,
                description=scene.description or "",
                location=location_name,
                time=f"{start_str} - {end_str}{night_label}",
                duration=duration_str,
                cast=scene.cast or "",
                is_night=scene.is_night
            ))

            if scene.cast:
                actors = [a.strip() for a in scene.cast.split(',') if a.strip()]
                all_actors.update(actors)

        weather_notes = "；".join(weather_notes_list) if weather_notes_list else "无特殊天气信息"

        markdown_content = self._generate_markdown(
            target_date=target_date,
            scenes=call_sheet_scenes,
            weather_notes=weather_notes,
            special_instructions=special_instructions,
            all_actors=list(all_actors)
        )

        return schemas.CallSheetExport(
            date=target_date,
            scenes=call_sheet_scenes,
            weather_notes=weather_notes,
            special_instructions=special_instructions,
            markdown_content=markdown_content
        )

    def _generate_markdown(
        self,
        target_date: date,
        scenes: List[schemas.CallSheetScene],
        weather_notes: str,
        special_instructions: List[str],
        all_actors: List[str]
    ) -> str:
        today_str = target_date.strftime("%Y年%m月%d日")
        weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][target_date.weekday()]

        markdown = f"""# 拍摄通告单

## 基本信息

| 项目 | 内容 |
|------|------|
| 日期 | {today_str} ({weekday}) |
| 天气 | {weather_notes} |
| 生成时间 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |

"""

        if special_instructions:
            markdown += """## ⚠️ 特别注意事项

"""
            for instruction in special_instructions:
                markdown += f"- {instruction}\n"
            markdown += "\n"

        markdown += """## 今日拍摄安排

"""

        if not scenes:
            markdown += "> 今日无拍摄安排\n\n"
        else:
            markdown += """| 序号 | 场景号 | 描述 | 地点 | 时间 | 时长 | 演员 | 夜戏 |
|------|--------|------|------|------|------|------|------|
"""
            for idx, scene in enumerate(scenes, 1):
                night_mark = "✓" if scene.is_night else ""
                markdown += f"| {idx} | {scene.scene_number} | {scene.description} | {scene.location} | {scene.time} | {scene.duration} | {scene.cast} | {night_mark} |\n"

            markdown += "\n"

        if all_actors:
            markdown += """## 今日到场演员

"""
            for actor in sorted(all_actors):
                markdown += f"- {actor}\n"
            markdown += "\n"

        markdown += """---

*此通告单由系统自动生成，请在拍摄前确认所有安排。如有冲突，请及时调整。*
"""

        return markdown
