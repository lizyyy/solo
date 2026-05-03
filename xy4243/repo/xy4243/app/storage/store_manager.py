from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .database import Database
from .actor_store import ActorStore
from .prop_store import PropStore
from .scene_store import SceneStore
from .handover_store import HandoverStore
from .violation_store import ViolationStore
from app.models import Actor, Prop, Scene, HandoverRecord, Violation


@dataclass
class StoreStats:
    actor_count: int = 0
    prop_count: int = 0
    scene_count: int = 0
    handover_count: int = 0
    active_handover_count: int = 0
    violation_count: int = 0
    unresolved_violation_count: int = 0
    dangerous_prop_count: int = 0


class StoreManager:

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            db_path = Path.home() / ".prop_handover" / "data.db"
        
        self.db = Database(db_path)
        self.actors = ActorStore(self.db)
        self.props = PropStore(self.db)
        self.scenes = SceneStore(self.db)
        self.handovers = HandoverStore(self.db)
        self.violations = ViolationStore(self.db)

    def get_stats(self) -> StoreStats:
        return StoreStats(
            actor_count=self.actors.count(),
            prop_count=self.props.count(),
            scene_count=self.scenes.count(),
            handover_count=self.handovers.count(),
            active_handover_count=len(self.handovers.get_active_handovers()),
            violation_count=self.violations.count(include_resolved=True),
            unresolved_violation_count=self.violations.count(include_resolved=False),
            dangerous_prop_count=len(self.props.get_dangerous_props()),
        )

    def import_props(self, props: List[Prop], clear_existing: bool = False) -> int:
        if clear_existing:
            self.props.delete_all()
        count = len(self.props.save_all(props))
        return count

    def import_scenes(self, scenes: List[Scene], clear_existing: bool = False) -> int:
        if clear_existing:
            self.scenes.delete_all()
        count = len(self.scenes.save_all(scenes))
        return count

    def import_handovers(self, handovers: List[HandoverRecord], clear_existing: bool = False) -> int:
        if clear_existing:
            self.handovers.delete_all()
        count = len(self.handovers.save_all(handovers))
        return count

    def clear_all_data(self) -> Dict[str, int]:
        return {
            "actors": self.actors.delete_all(),
            "props": self.props.delete_all(),
            "scenes": self.scenes.delete_all(),
            "handovers": self.handovers.delete_all(),
            "violations": self.violations.delete_all(),
        }

    def export_all_data(self) -> Dict[str, List[Any]]:
        return {
            "actors": self.actors.get_all(),
            "props": self.props.get_all(),
            "scenes": self.scenes.get_all(),
            "handovers": self.handovers.get_all(),
            "violations": self.violations.get_all(include_resolved=True),
        }

    def get_handovers_with_details(self) -> List[Dict[str, Any]]:
        handovers = self.handovers.get_all()
        result = []
        
        for handover in handovers:
            prop = self.props.get_by_id(handover.prop_id)
            scene = self.scenes.get_by_id(handover.scene_id)
            actor = self.actors.get_by_id(handover.actor_id)
            
            result.append({
                "handover": handover,
                "prop": prop,
                "scene": scene,
                "actor": actor,
            })
        
        return result

    def get_violations_with_details(self) -> List[Dict[str, Any]]:
        violations = self.violations.get_unresolved()
        result = []
        
        for violation in violations:
            prop = None
            scene = None
            handover = None
            actor = None
            
            if violation.prop_id:
                prop = self.props.get_by_id(violation.prop_id)
            if violation.scene_id:
                scene = self.scenes.get_by_id(violation.scene_id)
            if violation.handover_id:
                handover = self.handovers.get_by_id(violation.handover_id)
            if violation.actor_id:
                actor = self.actors.get_by_id(violation.actor_id)
            
            result.append({
                "violation": violation,
                "prop": prop,
                "scene": scene,
                "handover": handover,
                "actor": actor,
            })
        
        return result
