from typing import Dict, List, Set, Tuple
from collections import defaultdict
from datetime import datetime

from models import (
    ShowData, Scene, PropUsage, Cue, Alert, AlertType,
    Actor, Prop, CheckStatus
)


class PropConflictChecker:
    def __init__(self, min_transition_seconds: int = 30):
        self.min_transition_seconds = min_transition_seconds

    def check(self, show_data: ShowData) -> List[Alert]:
        alerts = []
        
        if not show_data.scenes:
            return alerts
            
        scenes_list = sorted(
            show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        prop_to_scenes: Dict[str, List[Tuple[Scene, str]]] = defaultdict(list)
        
        for scene in scenes_list:
            for prop_usage in scene.props:
                prop_to_scenes[prop_usage.prop_id].append((scene, prop_usage.usage_type))
        
        for prop_id, usages in prop_to_scenes.items():
            if len(usages) < 2:
                continue
                
            prop_name = show_data.props.get(prop_id, Prop(id=prop_id, name=prop_id)).name
            
            for i in range(len(usages) - 1):
                scene1, usage_type1 = usages[i]
                scene2, usage_type2 = usages[i + 1]
                
                if (usage_type1 == "上场" and usage_type2 == "上场"):
                    alerts.append(Alert(
                        alert_type=AlertType.PROP_CONFLICT,
                        message=f"道具冲突: '{prop_name}' 在场景 '{scene1.name}' 和 '{scene2.name}' 都需要上场",
                        details={
                            "prop_id": prop_id,
                            "prop_name": prop_name,
                            "scene1_id": scene1.id,
                            "scene1_name": scene1.name,
                            "scene2_id": scene2.id,
                            "scene2_name": scene2.name,
                            "usage_type1": usage_type1,
                            "usage_type2": usage_type2
                        },
                        scene_id=scene2.id,
                        prop_id=prop_id
                    ))
                elif usage_type1 == "撤场" and usage_type2 == "上场":
                    pass
                    
        return alerts


class ActorPresenceChecker:
    def check(self, show_data: ShowData) -> List[Alert]:
        alerts = []
        
        for scene in show_data.scenes.values():
            for cue in scene.cues:
                if cue.actor_id:
                    actor = show_data.actors.get(cue.actor_id)
                    if actor and not actor.is_present:
                        alerts.append(Alert(
                            alert_type=AlertType.ACTOR_MISSING,
                            message=f"演员未到: '{actor.name}' 在场景 '{scene.name}' 有提示词但未到场",
                            details={
                                "actor_id": actor.id,
                                "actor_name": actor.name,
                                "scene_id": scene.id,
                                "scene_name": scene.name,
                                "cue_content": cue.content,
                                "cue_type": cue.cue_type
                            },
                            scene_id=scene.id,
                            actor_id=actor.id
                        ))
                        
            for prop_usage in scene.props:
                if prop_usage.actor_id:
                    actor = show_data.actors.get(prop_usage.actor_id)
                    if actor and not actor.is_present:
                        alerts.append(Alert(
                            alert_type=AlertType.ACTOR_MISSING,
                            message=f"演员未到: '{actor.name}' 负责道具 '{prop_usage.prop_name}' 但未到场",
                            details={
                                "actor_id": actor.id,
                                "actor_name": actor.name,
                                "prop_id": prop_usage.prop_id,
                                "prop_name": prop_usage.prop_name,
                                "scene_id": scene.id,
                                "scene_name": scene.name
                            },
                            scene_id=scene.id,
                            actor_id=actor.id,
                            prop_id=prop_usage.prop_id
                        ))
                        
        return alerts


class PhotoChecker:
    def check(self, show_data: ShowData) -> List[Alert]:
        alerts = []
        
        for prop_id, prop in show_data.props.items():
            if not prop.photo_path:
                in_use = False
                for scene in show_data.scenes.values():
                    for prop_usage in scene.props:
                        if prop_usage.prop_id == prop_id:
                            in_use = True
                            alerts.append(Alert(
                                alert_type=AlertType.PHOTO_MISSING,
                                message=f"照片缺失: 道具 '{prop.name}' 在场景 '{scene.name}' 中使用但没有照片",
                                details={
                                    "prop_id": prop_id,
                                    "prop_name": prop.name,
                                    "scene_id": scene.id,
                                    "scene_name": scene.name
                                },
                                scene_id=scene.id,
                                prop_id=prop_id
                            ))
                            break
                    if in_use:
                        break
                        
        return alerts


class TransitionTimeChecker:
    def __init__(self, min_transition_seconds: int = 60):
        self.min_transition_seconds = min_transition_seconds

    def check(self, show_data: ShowData) -> List[Alert]:
        alerts = []
        
        if not show_data.scenes:
            return alerts
            
        scenes_list = sorted(
            show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        for i in range(len(scenes_list) - 1):
            current_scene = scenes_list[i]
            next_scene = scenes_list[i + 1]
            
            props_to_remove = []
            props_to_add = []
            
            for prop_usage in current_scene.props:
                if prop_usage.usage_type == "上场":
                    props_to_remove.append(prop_usage.prop_name)
                    
            for prop_usage in next_scene.props:
                if prop_usage.usage_type == "上场":
                    props_to_add.append(prop_usage.prop_name)
                    
            transition_complexity = len(props_to_remove) + len(props_to_add)
            
            estimated_time_needed = 30 + (transition_complexity * 15)
            
            if estimated_time_needed > self.min_transition_seconds:
                alerts.append(Alert(
                    alert_type=AlertType.TRANSITION_SHORT,
                    message=f"换场时间可能不足: 从 '{current_scene.name}' 到 '{next_scene.name}' "
                           f"需要处理 {len(props_to_remove)} 个撤场道具和 {len(props_to_add)} 个上场道具",
                    details={
                        "from_scene_id": current_scene.id,
                        "from_scene_name": current_scene.name,
                        "to_scene_id": next_scene.id,
                        "to_scene_name": next_scene.name,
                        "props_to_remove": props_to_remove,
                        "props_to_add": props_to_add,
                        "estimated_time_needed": estimated_time_needed,
                        "min_transition_seconds": self.min_transition_seconds
                    },
                    scene_id=next_scene.id
                ))
                
        return alerts


class RuleEngine:
    def __init__(
        self,
        min_transition_seconds: int = 60,
        prop_conflict_transition_seconds: int = 30
    ):
        self.checkers = [
            PropConflictChecker(prop_conflict_transition_seconds),
            ActorPresenceChecker(),
            PhotoChecker(),
            TransitionTimeChecker(min_transition_seconds)
        ]

    def run_all_checks(self, show_data: ShowData) -> List[Alert]:
        all_alerts = []
        
        for checker in self.checkers:
            alerts = checker.check(show_data)
            all_alerts.extend(alerts)
            
        show_data.alerts = all_alerts
        return all_alerts

    def filter_alerts(
        self,
        alerts: List[Alert],
        alert_types: List[AlertType] = None,
        scene_id: str = None,
        resolved: bool = None,
        check_status: CheckStatus = None
    ) -> List[Alert]:
        filtered = alerts
        
        if alert_types:
            filtered = [a for a in filtered if a.alert_type in alert_types]
            
        if scene_id:
            filtered = [a for a in filtered if a.scene_id == scene_id]
            
        if resolved is not None:
            filtered = [a for a in filtered if a.resolved == resolved]
            
        if check_status:
            filtered = [a for a in filtered if a.check_status == check_status]
            
        return filtered

    def get_alert_stats(self, alerts: List[Alert]) -> Dict:
        stats = {
            "total": len(alerts),
            "by_type": defaultdict(int),
            "by_status": defaultdict(int),
            "resolved": 0,
            "unresolved": 0
        }
        
        for alert in alerts:
            stats["by_type"][alert.alert_type.value] += 1
            stats["by_status"][alert.check_status.value] += 1
            if alert.resolved:
                stats["resolved"] += 1
            else:
                stats["unresolved"] += 1
                
        return dict(stats)
