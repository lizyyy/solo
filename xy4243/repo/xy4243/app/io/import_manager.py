from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from app.parsers import (
    BaseParser, ParseResult,
    PropParser, SceneParser, ActorScheduleParser
)
from app.models import Prop, Scene, HandoverRecord, Actor


@dataclass
class ImportResult:
    success: bool = False
    props: List[Prop] = field(default_factory=list)
    scenes: List[Scene] = field(default_factory=list)
    handovers: List[HandoverRecord] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ImportManager:

    def __init__(self):
        self.prop_parser = PropParser()
        self.scene_parser = SceneParser()

    def import_props(self, file_path: Path) -> Tuple[List[Prop], List[str], List[str]]:
        result = self.prop_parser.parse_file(file_path)
        return result.records, result.errors, result.warnings

    def import_scenes(self, file_path: Path) -> Tuple[List[Scene], List[str], List[str]]:
        result = self.scene_parser.parse_file(file_path)
        return result.records, result.errors, result.warnings

    def import_handovers(
        self,
        file_path: Path,
        existing_props: Optional[List[Prop]] = None,
        existing_scenes: Optional[List[Scene]] = None,
    ) -> Tuple[List[HandoverRecord], List[str], List[str]]:
        parser = ActorScheduleParser(
            props=existing_props,
            scenes=existing_scenes,
        )
        result = parser.parse_file(file_path)
        return result.records, result.errors, result.warnings

    def import_all(
        self,
        props_file: Optional[Path] = None,
        scenes_file: Optional[Path] = None,
        handovers_file: Optional[Path] = None,
    ) -> ImportResult:
        all_props: List[Prop] = []
        all_scenes: List[Scene] = []
        all_handovers: List[HandoverRecord] = []
        all_errors: List[str] = []
        all_warnings: List[str] = []

        if props_file:
            props, errors, warnings = self.import_props(props_file)
            all_props.extend(props)
            all_errors.extend([f"[道具表] {e}" for e in errors])
            all_warnings.extend([f"[道具表] {w}" for w in warnings])

        if scenes_file:
            scenes, errors, warnings = self.import_scenes(scenes_file)
            all_scenes.extend(scenes)
            all_errors.extend([f"[场次表] {e}" for e in errors])
            all_warnings.extend([f"[场次表] {w}" for w in warnings])

        if handovers_file:
            handovers, errors, warnings = self.import_handovers(
                handovers_file,
                existing_props=all_props,
                existing_scenes=all_scenes,
            )
            all_handovers.extend(handovers)
            all_errors.extend([f"[演员表] {e}" for e in errors])
            all_warnings.extend([f"[演员表] {w}" for w in warnings])

        success = len(all_errors) == 0

        return ImportResult(
            success=success,
            props=all_props,
            scenes=all_scenes,
            handovers=all_handovers,
            errors=all_errors,
            warnings=all_warnings,
            metadata={
                "props_count": len(all_props),
                "scenes_count": len(all_scenes),
                "handovers_count": len(all_handovers),
            }
        )

    @staticmethod
    def get_expected_headers(file_type: str) -> Tuple[List[str], List[str]]:
        if file_type == "props":
            parser = PropParser()
            return parser.get_required_columns(), parser.get_optional_columns()
        elif file_type == "scenes":
            parser = SceneParser()
            return parser.get_required_columns(), parser.get_optional_columns()
        elif file_type == "handovers":
            parser = ActorScheduleParser()
            return parser.get_required_columns(), parser.get_optional_columns()
        else:
            return [], []
