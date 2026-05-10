from typing import Dict, Any, List, Optional
from datetime import datetime, date

from .models import (
    CallSheetVersion, VersionDiff, Scene, Actor, Vehicle
)


class VersionComparator:
    def compare(self, v1: CallSheetVersion, v2: CallSheetVersion) -> VersionDiff:
        diff = VersionDiff(
            version_from=v1.version,
            version_to=v2.version,
            shoot_date=v2.shoot_date
        )
        
        self._compare_scenes(v1.scenes, v2.scenes, diff)
        self._compare_actors(v1.actors, v2.actors, diff)
        self._compare_vehicles(v1.vehicles, v2.vehicles, diff)
        
        return diff

    def _compare_scenes(self, scenes1: List[Scene], scenes2: List[Scene], diff: VersionDiff) -> None:
        scenes1_map = {s.number: s for s in scenes1}
        scenes2_map = {s.number: s for s in scenes2}
        
        all_numbers = set(scenes1_map.keys()) | set(scenes2_map.keys())
        
        for number in all_numbers:
            if number in scenes2_map and number not in scenes1_map:
                diff.scenes_added.append(scenes2_map[number])
            elif number in scenes1_map and number not in scenes2_map:
                diff.scenes_removed.append(scenes1_map[number])
            else:
                scene_diff = self._compare_single_scene(scenes1_map[number], scenes2_map[number])
                if scene_diff:
                    diff.scenes_modified.append(scene_diff)

    def _compare_single_scene(self, s1: Scene, s2: Scene) -> Optional[Dict[str, Any]]:
        changes = {}
        
        if s1.location != s2.location:
            changes["location"] = {"from": s1.location, "to": s2.location}
        if s1.description != s2.description:
            changes["description"] = {"from": s1.description, "to": s2.description}
        if s1.call_time != s2.call_time:
            changes["call_time"] = {
                "from": s1.call_time.isoformat() if s1.call_time else None,
                "to": s2.call_time.isoformat() if s2.call_time else None
            }
        if s1.wrap_time != s2.wrap_time:
            changes["wrap_time"] = {
                "from": s1.wrap_time.isoformat() if s1.wrap_time else None,
                "to": s2.wrap_time.isoformat() if s2.wrap_time else None
            }
        
        actors_added = set(s2.actors) - set(s1.actors)
        actors_removed = set(s1.actors) - set(s2.actors)
        if actors_added or actors_removed:
            changes["actors"] = {
                "added": list(actors_added),
                "removed": list(actors_removed)
            }
        
        vehicles_added = set(s2.vehicles) - set(s1.vehicles)
        vehicles_removed = set(s1.vehicles) - set(s2.vehicles)
        if vehicles_added or vehicles_removed:
            changes["vehicles"] = {
                "added": list(vehicles_added),
                "removed": list(vehicles_removed)
            }
        
        if s1.notes != s2.notes:
            changes["notes"] = {"from": s1.notes, "to": s2.notes}
        
        if changes:
            return {
                "scene_number": s1.number,
                "changes": changes
            }
        return None

    def _compare_actors(self, actors1: List[Actor], actors2: List[Actor], diff: VersionDiff) -> None:
        actors1_map = {a.name: a for a in actors1}
        actors2_map = {a.name: a for a in actors2}
        
        all_names = set(actors1_map.keys()) | set(actors2_map.keys())
        
        for name in all_names:
            if name in actors2_map and name not in actors1_map:
                diff.actors_added.append(actors2_map[name])
            elif name in actors1_map and name not in actors2_map:
                diff.actors_removed.append(actors1_map[name])
            else:
                actor_diff = self._compare_single_actor(actors1_map[name], actors2_map[name])
                if actor_diff:
                    diff.actors_modified.append(actor_diff)

    def _compare_single_actor(self, a1: Actor, a2: Actor) -> Optional[Dict[str, Any]]:
        changes = {}
        
        if a1.role != a2.role:
            changes["role"] = {"from": a1.role, "to": a2.role}
        if a1.call_time != a2.call_time:
            changes["call_time"] = {
                "from": a1.call_time.isoformat() if a1.call_time else None,
                "to": a2.call_time.isoformat() if a2.call_time else None
            }
        if a1.wrap_time != a2.wrap_time:
            changes["wrap_time"] = {
                "from": a1.wrap_time.isoformat() if a1.wrap_time else None,
                "to": a2.wrap_time.isoformat() if a2.wrap_time else None
            }
        
        scenes_added = set(a2.scenes) - set(a1.scenes)
        scenes_removed = set(a1.scenes) - set(a2.scenes)
        if scenes_added or scenes_removed:
            changes["scenes"] = {
                "added": list(scenes_added),
                "removed": list(scenes_removed)
            }
        
        if a1.notes != a2.notes:
            changes["notes"] = {"from": a1.notes, "to": a2.notes}
        
        if changes:
            return {
                "actor_name": a1.name,
                "changes": changes
            }
        return None

    def _compare_vehicles(self, vehicles1: List[Vehicle], vehicles2: List[Vehicle], diff: VersionDiff) -> None:
        vehicles1_map = {v.id: v for v in vehicles1}
        vehicles2_map = {v.id: v for v in vehicles2}
        
        all_ids = set(vehicles1_map.keys()) | set(vehicles2_map.keys())
        
        for vid in all_ids:
            if vid in vehicles2_map and vid not in vehicles1_map:
                diff.vehicles_added.append(vehicles2_map[vid])
            elif vid in vehicles1_map and vid not in vehicles2_map:
                diff.vehicles_removed.append(vehicles1_map[vid])
            else:
                vehicle_diff = self._compare_single_vehicle(vehicles1_map[vid], vehicles2_map[vid])
                if vehicle_diff:
                    diff.vehicles_modified.append(vehicle_diff)

    def _compare_single_vehicle(self, v1: Vehicle, v2: Vehicle) -> Optional[Dict[str, Any]]:
        changes = {}
        
        if v1.type != v2.type:
            changes["type"] = {"from": v1.type, "to": v2.type}
        if v1.driver != v2.driver:
            changes["driver"] = {"from": v1.driver, "to": v2.driver}
        if v1.usage != v2.usage:
            changes["usage"] = {"from": v1.usage, "to": v2.usage}
        if v1.start_time != v2.start_time:
            changes["start_time"] = {
                "from": v1.start_time.isoformat() if v1.start_time else None,
                "to": v2.start_time.isoformat() if v2.start_time else None
            }
        if v1.end_time != v2.end_time:
            changes["end_time"] = {
                "from": v1.end_time.isoformat() if v1.end_time else None,
                "to": v2.end_time.isoformat() if v2.end_time else None
            }
        
        if v1.notes != v2.notes:
            changes["notes"] = {"from": v1.notes, "to": v2.notes}
        
        if changes:
            return {
                "vehicle_id": v1.id,
                "changes": changes
            }
        return None
