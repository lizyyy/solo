import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from models import (
    ShowData, Scene, Actor, Prop, PropUsage, Cue, Transition, Alert,
    AlertType, CheckStatus
)


class ShowDataEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, CheckStatus):
            return obj.value
        if isinstance(obj, AlertType):
            return obj.value
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        return super().default(obj)


class ShowDataDecoder:
    @staticmethod
    def decode_show_data(data: Dict) -> ShowData:
        show_data = ShowData()
        
        show_data.show_name = data.get('show_name', '')
        
        if data.get('show_date'):
            show_data.show_date = datetime.fromisoformat(data['show_date'])
            
        show_data.actors = ShowDataDecoder._decode_actors(data.get('actors', {}))
        show_data.props = ShowDataDecoder._decode_props(data.get('props', {}))
        show_data.scenes = ShowDataDecoder._decode_scenes(data.get('scenes', {}))
        show_data.transitions = ShowDataDecoder._decode_transitions(data.get('transitions', []))
        show_data.alerts = ShowDataDecoder._decode_alerts(data.get('alerts', []))
        show_data.prop_photos_dir = data.get('prop_photos_dir')
        
        if data.get('last_updated'):
            show_data.last_updated = datetime.fromisoformat(data['last_updated'])
            
        return show_data

    @staticmethod
    def _decode_actors(data: Dict) -> Dict[str, Actor]:
        actors = {}
        for actor_id, actor_data in data.items():
            actors[actor_id] = Actor(
                id=actor_data.get('id', actor_id),
                name=actor_data.get('name', ''),
                is_present=actor_data.get('is_present', True),
                notes=actor_data.get('notes', '')
            )
        return actors

    @staticmethod
    def _decode_props(data: Dict) -> Dict[str, Prop]:
        props = {}
        for prop_id, prop_data in data.items():
            props[prop_id] = Prop(
                id=prop_data.get('id', prop_id),
                name=prop_data.get('name', ''),
                photo_path=prop_data.get('photo_path'),
                notes=prop_data.get('notes', '')
            )
        return props

    @staticmethod
    def _decode_scenes(data: Dict) -> Dict[str, Scene]:
        scenes = {}
        for scene_id, scene_data in data.items():
            scene = Scene(
                id=scene_data.get('id', scene_id),
                name=scene_data.get('name', ''),
                act=scene_data.get('act', 1),
                scene_number=scene_data.get('scene_number', 1),
                duration=scene_data.get('duration', 0),
                notes=scene_data.get('notes', '')
            )
            
            if scene_data.get('start_time'):
                scene.start_time = datetime.fromisoformat(scene_data['start_time'])
                
            scene.props = ShowDataDecoder._decode_prop_usages(scene_data.get('props', []))
            scene.cues = ShowDataDecoder._decode_cues(scene_data.get('cues', []))
            
            scenes[scene_id] = scene
        return scenes

    @staticmethod
    def _decode_prop_usages(data: List) -> List[PropUsage]:
        usages = []
        for usage_data in data:
            check_status = CheckStatus.PENDING
            if usage_data.get('check_status'):
                try:
                    check_status = CheckStatus(usage_data['check_status'])
                except ValueError:
                    pass
                    
            usage = PropUsage(
                prop_id=usage_data.get('prop_id', ''),
                prop_name=usage_data.get('prop_name', ''),
                usage_type=usage_data.get('usage_type', '上场'),
                scene_id=usage_data.get('scene_id', ''),
                scene_name=usage_data.get('scene_name', ''),
                time_offset=usage_data.get('time_offset', 0),
                actor_id=usage_data.get('actor_id'),
                actor_name=usage_data.get('actor_name'),
                notes=usage_data.get('notes', ''),
                check_status=check_status
            )
            usages.append(usage)
        return usages

    @staticmethod
    def _decode_cues(data: List) -> List[Cue]:
        cues = []
        for cue_data in data:
            cue = Cue(
                id=cue_data.get('id', ''),
                scene_id=cue_data.get('scene_id', ''),
                cue_type=cue_data.get('cue_type', '其他'),
                content=cue_data.get('content', ''),
                time_offset=cue_data.get('time_offset', 0),
                actor_id=cue_data.get('actor_id'),
                actor_name=cue_data.get('actor_name'),
                notes=cue_data.get('notes', '')
            )
            cues.append(cue)
        return cues

    @staticmethod
    def _decode_transitions(data: List) -> List[Transition]:
        transitions = []
        for trans_data in data:
            transition = Transition(
                from_scene_id=trans_data.get('from_scene_id', ''),
                to_scene_id=trans_data.get('to_scene_id', ''),
                transition_time=trans_data.get('transition_time', 0),
                props_to_remove=trans_data.get('props_to_remove', []),
                props_to_add=trans_data.get('props_to_add', [])
            )
            transitions.append(transition)
        return transitions

    @staticmethod
    def _decode_alerts(data: List) -> List[Alert]:
        alerts = []
        for alert_data in data:
            alert_type = AlertType.PROP_CONFLICT
            if alert_data.get('alert_type'):
                try:
                    alert_type = AlertType(alert_data['alert_type'])
                except ValueError:
                    pass
                    
            check_status = CheckStatus.PENDING
            if alert_data.get('check_status'):
                try:
                    check_status = CheckStatus(alert_data['check_status'])
                except ValueError:
                    pass
                    
            alert = Alert(
                alert_type=alert_type,
                message=alert_data.get('message', ''),
                details=alert_data.get('details', {}),
                scene_id=alert_data.get('scene_id'),
                prop_id=alert_data.get('prop_id'),
                actor_id=alert_data.get('actor_id'),
                check_status=check_status,
                resolved=alert_data.get('resolved', False)
            )
            alerts.append(alert)
        return alerts


class StorageManager:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = os.path.join(str(Path.home()), '.stage_manager')
        self.data_dir = data_dir
        self.projects_dir = os.path.join(data_dir, 'projects')
        
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.projects_dir, exist_ok=True)

    def save_project(self, show_data: ShowData, project_name: Optional[str] = None) -> str:
        if project_name is None:
            if show_data.show_name:
                project_name = show_data.show_name
            else:
                project_name = f"project_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                
        safe_name = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in project_name)
        project_path = os.path.join(self.projects_dir, f"{safe_name}.json")
        
        show_data.last_updated = datetime.now()
        
        with open(project_path, 'w', encoding='utf-8') as f:
            json.dump(show_data, f, cls=ShowDataEncoder, ensure_ascii=False, indent=2)
            
        return project_path

    def load_project(self, project_path: str) -> ShowData:
        if not os.path.exists(project_path):
            raise FileNotFoundError(f"项目文件不存在: {project_path}")
            
        with open(project_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        return ShowDataDecoder.decode_show_data(data)

    def list_projects(self) -> List[Dict]:
        projects = []
        
        if not os.path.exists(self.projects_dir):
            return projects
            
        for filename in os.listdir(self.projects_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.projects_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        
                    project_info = {
                        'name': data.get('show_name', filename[:-5]),
                        'path': filepath,
                        'last_updated': data.get('last_updated', ''),
                        'scene_count': len(data.get('scenes', {})),
                        'prop_count': len(data.get('props', {})),
                        'actor_count': len(data.get('actors', {}))
                    }
                    projects.append(project_info)
                except Exception:
                    pass
                    
        return sorted(projects, key=lambda x: x.get('last_updated', ''), reverse=True)

    def delete_project(self, project_path: str) -> bool:
        if os.path.exists(project_path):
            os.remove(project_path)
            return True
        return False


class StatusManager:
    def update_prop_check_status(
        self,
        show_data: ShowData,
        scene_id: str,
        prop_id: str,
        usage_type: str,
        status: CheckStatus
    ) -> bool:
        if scene_id not in show_data.scenes:
            return False
            
        scene = show_data.scenes[scene_id]
        
        for prop_usage in scene.props:
            if prop_usage.prop_id == prop_id and prop_usage.usage_type == usage_type:
                prop_usage.check_status = status
                return True
                
        return False

    def update_alert_status(
        self,
        show_data: ShowData,
        alert_index: int,
        status: CheckStatus,
        resolved: bool = False
    ) -> bool:
        if alert_index < 0 or alert_index >= len(show_data.alerts):
            return False
            
        alert = show_data.alerts[alert_index]
        alert.check_status = status
        alert.resolved = resolved
        return True

    def mark_all_props_checked(self, show_data: ShowData, scene_id: Optional[str] = None) -> int:
        count = 0
        
        scenes_to_check = []
        if scene_id and scene_id in show_data.scenes:
            scenes_to_check = [show_data.scenes[scene_id]]
        else:
            scenes_to_check = list(show_data.scenes.values())
            
        for scene in scenes_to_check:
            for prop_usage in scene.props:
                prop_usage.check_status = CheckStatus.CHECKED
                count += 1
                
        return count

    def mark_all_alerts_resolved(self, show_data: ShowData) -> int:
        count = 0
        for alert in show_data.alerts:
            alert.resolved = True
            alert.check_status = CheckStatus.CHECKED
            count += 1
        return count
