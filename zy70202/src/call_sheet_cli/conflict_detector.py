from typing import List, Dict, Any, Optional
from datetime import datetime
from itertools import combinations

from .models import (
    CallSheetVersion, Conflict, ConflictType,
    Actor, Vehicle, Scene
)


class ConflictDetector:
    def detect(self, version: CallSheetVersion, previous_version: Optional[CallSheetVersion] = None) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        conflicts.extend(self._detect_actor_time_conflicts(version))
        conflicts.extend(self._detect_vehicle_time_conflicts(version))
        conflicts.extend(self._detect_scene_location_conflicts(version))
        
        if previous_version:
            conflicts.extend(self._detect_version_changes(version, previous_version))
        
        return conflicts

    def _detect_actor_time_conflicts(self, version: CallSheetVersion) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        actor_schedules: Dict[str, List[Dict[str, Any]]] = {}
        
        for actor in version.actors:
            if actor.call_time and actor.wrap_time:
                if actor.name not in actor_schedules:
                    actor_schedules[actor.name] = []
                actor_schedules[actor.name].append({
                    "start": actor.call_time,
                    "end": actor.wrap_time,
                    "source": f"演员 {actor.name} 的通告时间",
                    "scenes": actor.scenes
                })
        
        for scene in version.scenes:
            for actor_name in scene.actors:
                if scene.call_time and scene.wrap_time:
                    if actor_name not in actor_schedules:
                        actor_schedules[actor_name] = []
                    actor_schedules[actor_name].append({
                        "start": scene.call_time,
                        "end": scene.wrap_time,
                        "source": f"场景 {scene.number} ({scene.location})",
                        "scenes": [scene.number]
                    })
        
        for actor_name, schedules in actor_schedules.items():
            if len(schedules) < 2:
                continue
            
            for s1, s2 in combinations(schedules, 2):
                if self._times_overlap(s1["start"], s1["end"], s2["start"], s2["end"]):
                    conflicts.append(Conflict(
                        conflict_type=ConflictType.ACTOR_TIME_CONFLICT,
                        description=f"演员 {actor_name} 时间冲突",
                        affected_items=[actor_name],
                        details={
                            "conflict_1": {
                                "source": s1["source"],
                                "start": s1["start"].isoformat(),
                                "end": s1["end"].isoformat()
                            },
                            "conflict_2": {
                                "source": s2["source"],
                                "start": s2["start"].isoformat(),
                                "end": s2["end"].isoformat()
                            }
                        }
                    ))
        
        return conflicts

    def _detect_vehicle_time_conflicts(self, version: CallSheetVersion) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        vehicle_schedules: Dict[str, List[Dict[str, Any]]] = {}
        
        for vehicle in version.vehicles:
            if vehicle.start_time and vehicle.end_time:
                if vehicle.id not in vehicle_schedules:
                    vehicle_schedules[vehicle.id] = []
                vehicle_schedules[vehicle.id].append({
                    "start": vehicle.start_time,
                    "end": vehicle.end_time,
                    "source": f"车辆 {vehicle.id} ({vehicle.type}) 的调度时间",
                    "usage": vehicle.usage
                })
        
        for scene in version.scenes:
            for vehicle_id in scene.vehicles:
                if scene.call_time and scene.wrap_time:
                    if vehicle_id not in vehicle_schedules:
                        vehicle_schedules[vehicle_id] = []
                    vehicle_schedules[vehicle_id].append({
                        "start": scene.call_time,
                        "end": scene.wrap_time,
                        "source": f"场景 {scene.number} ({scene.location})",
                        "usage": f"场景 {scene.number} 用车"
                    })
        
        for vehicle_id, schedules in vehicle_schedules.items():
            if len(schedules) < 2:
                continue
            
            for s1, s2 in combinations(schedules, 2):
                if self._times_overlap(s1["start"], s1["end"], s2["start"], s2["end"]):
                    conflicts.append(Conflict(
                        conflict_type=ConflictType.VEHICLE_TIME_CONFLICT,
                        description=f"车辆 {vehicle_id} 时间冲突",
                        affected_items=[vehicle_id],
                        details={
                            "conflict_1": {
                                "source": s1["source"],
                                "start": s1["start"].isoformat(),
                                "end": s1["end"].isoformat(),
                                "usage": s1.get("usage", "")
                            },
                            "conflict_2": {
                                "source": s2["source"],
                                "start": s2["start"].isoformat(),
                                "end": s2["end"].isoformat(),
                                "usage": s2.get("usage", "")
                            }
                        }
                    ))
        
        return conflicts

    def _detect_scene_location_conflicts(self, version: CallSheetVersion) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        location_schedules: Dict[str, List[Dict[str, Any]]] = {}
        
        for scene in version.scenes:
            if scene.call_time and scene.wrap_time:
                location = scene.location
                if location not in location_schedules:
                    location_schedules[location] = []
                location_schedules[location].append({
                    "scene": scene,
                    "start": scene.call_time,
                    "end": scene.wrap_time
                })
        
        for location, schedules in location_schedules.items():
            if len(schedules) < 2:
                continue
            
            for s1, s2 in combinations(schedules, 2):
                if self._times_overlap(s1["start"], s1["end"], s2["start"], s2["end"]):
                    conflicts.append(Conflict(
                        conflict_type=ConflictType.SCENE_LOCATION_CONFLICT,
                        description=f"地点 {location} 时间冲突",
                        affected_items=[s1["scene"].number, s2["scene"].number],
                        details={
                            "location": location,
                            "scene_1": {
                                "number": s1["scene"].number,
                                "start": s1["start"].isoformat(),
                                "end": s1["end"].isoformat()
                            },
                            "scene_2": {
                                "number": s2["scene"].number,
                                "start": s2["start"].isoformat(),
                                "end": s2["end"].isoformat()
                            }
                        }
                    ))
        
        return conflicts

    def _detect_version_changes(self, current: CallSheetVersion, previous: CallSheetVersion) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        prev_scenes = {s.number: s for s in previous.scenes}
        curr_scenes = {s.number: s for s in current.scenes}
        
        for num in curr_scenes:
            if num in prev_scenes:
                old = prev_scenes[num]
                new = curr_scenes[num]
                if old.location != new.location:
                    conflicts.append(Conflict(
                        conflict_type=ConflictType.VERSION_CHANGE,
                        description=f"场景 {num} 地点变更",
                        affected_items=[num],
                        version_from=previous.version,
                        version_to=current.version,
                        details={
                            "change_type": "location",
                            "from": old.location,
                            "to": new.location
                        }
                    ))
                if old.call_time != new.call_time or old.wrap_time != new.wrap_time:
                    conflicts.append(Conflict(
                        conflict_type=ConflictType.VERSION_CHANGE,
                        description=f"场景 {num} 时间变更",
                        affected_items=[num],
                        version_from=previous.version,
                        version_to=current.version,
                        details={
                            "change_type": "time",
                            "from_call": old.call_time.isoformat() if old.call_time else None,
                            "from_wrap": old.wrap_time.isoformat() if old.wrap_time else None,
                            "to_call": new.call_time.isoformat() if new.call_time else None,
                            "to_wrap": new.wrap_time.isoformat() if new.wrap_time else None
                        }
                    ))

        prev_actors = {a.name: a for a in previous.actors}
        curr_actors = {a.name: a for a in current.actors}
        
        for name in curr_actors:
            if name in prev_actors:
                old = prev_actors[name]
                new = curr_actors[name]
                if old.call_time != new.call_time or old.wrap_time != new.wrap_time:
                    conflicts.append(Conflict(
                        conflict_type=ConflictType.VERSION_CHANGE,
                        description=f"演员 {name} 时间变更",
                        affected_items=[name],
                        version_from=previous.version,
                        version_to=current.version,
                        details={
                            "change_type": "actor_time",
                            "from_call": old.call_time.isoformat() if old.call_time else None,
                            "from_wrap": old.wrap_time.isoformat() if old.wrap_time else None,
                            "to_call": new.call_time.isoformat() if new.call_time else None,
                            "to_wrap": new.wrap_time.isoformat() if new.wrap_time else None
                        }
                    ))

        return conflicts

    def _times_overlap(self, start1: datetime, end1: datetime, 
                       start2: datetime, end2: datetime) -> bool:
        return start1 < end2 and start2 < end1
