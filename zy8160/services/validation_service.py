from typing import List, Dict, Any, Optional, Tuple
from datetime import date, time, datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import and_

import database as db
import schemas
from config import settings


class ValidationService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def validate_day_plans(self, target_date: date) -> schemas.ValidationResult:
        conflicts: List[schemas.ValidationSuggestion] = []
        
        day_plans = self.db.query(db.ShootingPlan).filter(
            db.ShootingPlan.date == target_date
        ).order_by(db.ShootingPlan.start_time).all()

        if not day_plans:
            return schemas.ValidationResult(
                date=target_date,
                total_conflicts=0,
                critical_count=0,
                warning_count=0,
                info_count=0,
                conflicts=[],
                is_valid=True
            )

        conflicts.extend(self._check_actor_schedule_conflicts(day_plans, target_date))
        conflicts.extend(self._check_transfer_time(day_plans))
        conflicts.extend(self._check_weather_issues(day_plans, target_date))
        conflicts.extend(self._check_night_shift_hours(day_plans))
        conflicts.extend(self._check_cross_group_overlap(day_plans, target_date))

        critical_count = sum(1 for c in conflicts if c.severity == schemas.ConflictSeverity.CRITICAL)
        warning_count = sum(1 for c in conflicts if c.severity == schemas.ConflictSeverity.WARNING)
        info_count = sum(1 for c in conflicts if c.severity == schemas.ConflictSeverity.INFO)

        return schemas.ValidationResult(
            date=target_date,
            total_conflicts=len(conflicts),
            critical_count=critical_count,
            warning_count=warning_count,
            info_count=info_count,
            conflicts=conflicts,
            is_valid=critical_count == 0
        )

    def _check_actor_schedule_conflicts(
        self, 
        day_plans: List[db.ShootingPlan], 
        target_date: date
    ) -> List[schemas.ValidationSuggestion]:
        conflicts = []
        
        actor_time_slots: Dict[str, List[Tuple[time, time, str]]] = defaultdict(list)
        
        for plan in day_plans:
            scene = plan.scene
            if scene and scene.cast:
                actors = [a.strip() for a in scene.cast.split(',') if a.strip()]
                for actor in actors:
                    actor_time_slots[actor].append(
                        (plan.start_time, plan.end_time, scene.scene_number)
                    )

        for actor, slots in actor_time_slots.items():
            slots.sort()
            for i in range(len(slots) - 1):
                current_end = slots[i][1]
                next_start = slots[i + 1][0]
                
                if self._time_to_minutes(next_start) < self._time_to_minutes(current_end):
                    conflicts.append(schemas.ValidationSuggestion(
                        conflict_type=schemas.ConflictType.ACTOR_SCHEDULE,
                        severity=schemas.ConflictSeverity.CRITICAL,
                        message=f"演员 {actor} 在场景 {slots[i][2]} 和 {slots[i+1][2]} 之间存在档期重叠",
                        suggestion=f"建议调整其中一个场景的时间，或确认演员是否可以分身。两个场景分别为 {slots[i][0]}-{slots[i][1]} 和 {slots[i+1][0]}-{slots[i+1][1]}",
                        affected_elements=[actor, slots[i][2], slots[i+1][2]]
                    ))

        return conflicts

    def _check_transfer_time(
        self, 
        day_plans: List[db.ShootingPlan]
    ) -> List[schemas.ValidationSuggestion]:
        conflicts = []
        min_transfer = settings.MIN_TRANSFER_MINUTES
        
        for i in range(len(day_plans) - 1):
            current = day_plans[i]
            next_plan = day_plans[i + 1]
            
            current_scene = current.scene
            next_scene = next_plan.scene
            
            current_loc = current_scene.location if current_scene else None
            next_loc = next_scene.location if next_scene else None
            
            current_end = self._time_to_minutes(current.end_time)
            next_start = self._time_to_minutes(next_plan.start_time)
            
            gap_minutes = next_start - current_end
            
            same_location = (
                current_loc and next_loc and 
                current_loc.id == next_loc.id
            )
            
            if not same_location and gap_minutes < min_transfer:
                conflicts.append(schemas.ValidationSuggestion(
                    conflict_type=schemas.ConflictType.TRANSFER_TIME,
                    severity=schemas.ConflictSeverity.WARNING,
                    message=f"转场时间不足。从场景 {current_scene.scene_number if current_scene else '未知'} 到 {next_scene.scene_number if next_scene else '未知'} 的转场时间只有 {gap_minutes} 分钟",
                    suggestion=f"建议至少预留 {min_transfer} 分钟转场时间。当前位置：{current_loc.name if current_loc else '未知'} -> {next_loc.name if next_loc else '未知'}",
                    affected_elements=[
                        current_scene.scene_number if current_scene else '未知',
                        next_scene.scene_number if next_scene else '未知'
                    ]
                ))

        return conflicts

    def _check_weather_issues(
        self, 
        day_plans: List[db.ShootingPlan], 
        target_date: date
    ) -> List[schemas.ValidationSuggestion]:
        conflicts = []
        
        for plan in day_plans:
            scene = plan.scene
            if not scene:
                continue
            
            location = scene.location
            if not location:
                continue
            
            if not location.is_exterior:
                continue
            
            weather = self.db.query(db.Weather).filter(
                and_(
                    db.Weather.location_id == location.id,
                    db.Weather.date == target_date
                )
            ).first()
            
            if weather and weather.is_rainy:
                sound_stages = self.db.query(db.Location).filter(
                    db.Location.is_sound_stage == True
                ).all()
                
                suggestion_text = f"建议改到棚内拍摄。"
                if sound_stages:
                    stage_names = ', '.join([s.name for s in sound_stages[:3]])
                    suggestion_text += f"可用棚拍场地：{stage_names}"
                else:
                    suggestion_text += "建议查看是否有可用的室内场地，或改期拍摄。"
                
                conflicts.append(schemas.ValidationSuggestion(
                    conflict_type=schemas.ConflictType.WEATHER_ISSUE,
                    severity=schemas.ConflictSeverity.CRITICAL,
                    message=f"外景 {location.name} 在 {target_date} 有雨，场景 {scene.scene_number} 无法拍摄",
                    suggestion=suggestion_text,
                    affected_elements=[scene.scene_number, location.name]
                ))
            elif weather and weather.precipitation_probability > 0.5:
                conflicts.append(schemas.ValidationSuggestion(
                    conflict_type=schemas.ConflictType.WEATHER_ISSUE,
                    severity=schemas.ConflictSeverity.WARNING,
                    message=f"外景 {location.name} 在 {target_date} 降雨概率 {weather.precipitation_probability*100:.0f}%，场景 {scene.scene_number} 可能受影响",
                    suggestion="建议准备防雨设备，或考虑备选方案",
                    affected_elements=[scene.scene_number, location.name]
                ))

        return conflicts

    def _check_night_shift_hours(
        self, 
        day_plans: List[db.ShootingPlan]
    ) -> List[schemas.ValidationSuggestion]:
        conflicts = []
        max_hours = settings.MAX_NIGHT_SHIFT_HOURS
        
        night_scenes = []
        for plan in day_plans:
            scene = plan.scene
            if scene and scene.is_night:
                night_scenes.append((plan, scene))
        
        if not night_scenes:
            return conflicts
        
        night_start = self._time_to_minutes(time(18, 0))
        night_end = self._time_to_minutes(time(6, 0))
        
        total_night_minutes = 0
        involved_actors: set = set()
        
        for plan, scene in night_scenes:
            start = self._time_to_minutes(plan.start_time)
            end = self._time_to_minutes(plan.end_time)
            
            if start >= night_start or end <= night_end:
                overlap_start = max(start, night_start) if start >= night_start else start
                overlap_end = min(end, night_end) if end <= night_end else end
                
                if overlap_end < overlap_start:
                    overlap_end += 24 * 60
                
                total_night_minutes += (overlap_end - overlap_start)
            
            if scene.cast:
                actors = [a.strip() for a in scene.cast.split(',') if a.strip()]
                involved_actors.update(actors)
        
        total_hours = total_night_minutes / 60
        
        if total_hours > max_hours:
            conflicts.append(schemas.ValidationSuggestion(
                conflict_type=schemas.ConflictType.NIGHT_SHIFT_HOURS,
                severity=schemas.ConflictSeverity.WARNING,
                message=f"当日夜戏总时长 {total_hours:.1f} 小时，超过建议上限 {max_hours} 小时",
                suggestion=f"建议将部分夜戏改期，或减少当日拍摄量。涉及演员：{', '.join(list(involved_actors)[:5])}{'...' if len(involved_actors) > 5 else ''}",
                affected_elements=list(involved_actors)
            ))

        return conflicts

    def _check_cross_group_overlap(
        self, 
        day_plans: List[db.ShootingPlan], 
        target_date: date
    ) -> List[schemas.ValidationSuggestion]:
        conflicts = []
        
        actor_group_slots: Dict[str, Dict[str, List[Tuple[time, time, str]]]] = defaultdict(lambda: defaultdict(list))
        
        for plan in day_plans:
            scene = plan.scene
            crew = plan.assigned_crew
            
            group_name = crew.group_name if crew else "默认组"
            
            if scene and scene.cast:
                actors = [a.strip() for a in scene.cast.split(',') if a.strip()]
                for actor in actors:
                    actor_group_slots[actor][group_name].append(
                        (plan.start_time, plan.end_time, scene.scene_number)
                    )

        for actor, groups in actor_group_slots.items():
            if len(groups) < 2:
                continue
            
            all_slots = []
            for group_name, slots in groups.items():
                for slot in slots:
                    all_slots.append((slot[0], slot[1], group_name, slot[2]))
            
            all_slots.sort()
            
            for i in range(len(all_slots) - 1):
                current_end = self._time_to_minutes(all_slots[i][1])
                next_start = self._time_to_minutes(all_slots[i + 1][0])
                
                current_group = all_slots[i][2]
                next_group = all_slots[i + 1][2]
                
                if current_group != next_group and next_start < current_end:
                    conflicts.append(schemas.ValidationSuggestion(
                        conflict_type=schemas.ConflictType.CROSS_GROUP_OVERLAP,
                        severity=schemas.ConflictSeverity.CRITICAL,
                        message=f"演员 {actor} 跨组重叠：在 {current_group} 组的场景 {all_slots[i][3]} ({all_slots[i][0]}-{all_slots[i][1]}) 与 {next_group} 组的场景 {all_slots[i+1][3]} ({all_slots[i+1][0]}-{all_slots[i+1][1]}) 时间重叠",
                        suggestion=f"演员无法同时在两个组拍摄。建议协调两组的拍摄时间，或考虑使用替身。",
                        affected_elements=[actor, current_group, next_group, all_slots[i][3], all_slots[i+1][3]]
                    ))

        return conflicts

    def _time_to_minutes(self, t: time) -> int:
        return t.hour * 60 + t.minute
