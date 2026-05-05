import csv
import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from .models import (
    Cue, LightScene, AudioFile, ActorSchedule, CueType
)


class CueListParser:
    DEFAULT_FILENAME = "cue_list.csv"

    @classmethod
    def parse_file(cls, file_path: str) -> List[Cue]:
        cues = []
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"Cue list file not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                cue = cls._parse_row(row)
                if cue:
                    cues.append(cue)

        return cues

    @classmethod
    def _parse_row(cls, row: Dict[str, Any]) -> Optional[Cue]:
        cue_id = row.get('cue_id', '').strip()
        if not cue_id:
            return None

        cue_type_str = row.get('type', row.get('cue_type', 'other')).lower().strip()
        try:
            cue_type = CueType(cue_type_str)
        except ValueError:
            cue_type = CueType.OTHER

        light_scene_id = row.get('light_scene_id', row.get('scene_id', None))
        if light_scene_id:
            light_scene_id = light_scene_id.strip() or None

        audio_file_id = row.get('audio_file_id', row.get('audio_id', None))
        if audio_file_id:
            audio_file_id = audio_file_id.strip() or None

        return Cue(
            cue_id=cue_id,
            description=row.get('description', '').strip(),
            cue_type=cue_type,
            time=row.get('time', '').strip(),
            light_scene_id=light_scene_id,
            audio_file_id=audio_file_id,
            notes=row.get('notes', '').strip() or None
        )


class LightingParser:
    DEFAULT_FILENAME = "lighting_scenes.json"

    @classmethod
    def parse_file(cls, file_path: str) -> List[LightScene]:
        scenes = []
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"Lighting scenes file not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        scenes_data = data.get('scenes', data) if isinstance(data, dict) else data

        if isinstance(scenes_data, list):
            for scene_data in scenes_data:
                scene = cls._parse_scene(scene_data)
                if scene:
                    scenes.append(scene)
        elif isinstance(scenes_data, dict):
            scene = cls._parse_scene(scenes_data)
            if scene:
                scenes.append(scene)

        return scenes

    @classmethod
    def _parse_scene(cls, data: Dict[str, Any]) -> Optional[LightScene]:
        scene_id = data.get('id', data.get('scene_id', '')).strip()
        if not scene_id:
            return None

        channels = data.get('channels', {})
        if isinstance(channels, str):
            try:
                channels = json.loads(channels)
            except:
                channels = {}

        return LightScene(
            scene_id=scene_id,
            name=data.get('name', '').strip(),
            intensity=int(data.get('intensity', 100)),
            color_temperature=int(data.get('color_temperature')) if data.get('color_temperature') else None,
            channels=channels,
            notes=data.get('notes', '').strip() or None
        )


class AudioFilesParser:
    DEFAULT_FILENAME = "audio_files.csv"

    @classmethod
    def parse_file(cls, file_path: str, project_dir: Optional[str] = None) -> List[AudioFile]:
        audio_files = []
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"Audio files list not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                audio_file = cls._parse_row(row, project_dir)
                if audio_file:
                    audio_files.append(audio_file)

        return audio_files

    @classmethod
    def _parse_row(cls, row: Dict[str, Any], project_dir: Optional[str] = None) -> Optional[AudioFile]:
        cue_id = row.get('cue_id', '').strip()
        if not cue_id:
            return None

        filename = row.get('filename', row.get('file', '')).strip()
        file_path = row.get('path', filename).strip()

        exists = True
        if project_dir:
            full_path = os.path.join(project_dir, file_path)
            exists = os.path.exists(full_path)

        duration = row.get('duration', row.get('duration_seconds', None))
        duration_seconds = None
        if duration:
            try:
                duration_seconds = float(duration)
            except:
                pass

        return AudioFile(
            cue_id=cue_id,
            filename=filename,
            path=file_path,
            duration_seconds=duration_seconds,
            format=row.get('format', '').strip() or None,
            exists=exists
        )


class ActorScheduleParser:
    DEFAULT_FILENAME = "actor_schedule.csv"

    @classmethod
    def parse_file(cls, file_path: str) -> List[ActorSchedule]:
        schedules = []
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"Actor schedule file not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                schedule = cls._parse_row(row)
                if schedule:
                    schedules.append(schedule)

        return schedules

    @classmethod
    def _parse_row(cls, row: Dict[str, Any]) -> Optional[ActorSchedule]:
        actor_name = row.get('actor_name', row.get('actor', '')).strip()
        scene_id = row.get('scene_id', row.get('scene', '')).strip()

        if not actor_name or not scene_id:
            return None

        return ActorSchedule(
            actor_name=actor_name,
            scene_id=scene_id,
            enter_time=row.get('enter_time', '').strip(),
            exit_time=row.get('exit_time', '').strip(),
            notes=row.get('notes', '').strip() or None,
            costume=row.get('costume', '').strip() or None,
            entry_direction=row.get('entry_direction', row.get('enter_dir', '')).strip() or None,
            exit_direction=row.get('exit_direction', row.get('exit_dir', '')).strip() or None
        )


class ProjectParser:
    REQUIRED_FILES = [
        CueListParser.DEFAULT_FILENAME,
        LightingParser.DEFAULT_FILENAME,
        AudioFilesParser.DEFAULT_FILENAME,
        ActorScheduleParser.DEFAULT_FILENAME,
    ]

    @classmethod
    def scan_directory(cls, directory: str) -> Tuple[bool, List[str], Dict[str, str]]:
        dir_path = Path(directory)
        if not dir_path.exists() or not dir_path.is_dir():
            return False, [f"Directory not found: {directory}"], {}

        missing_files = []
        found_files = {}

        for filename in cls.REQUIRED_FILES:
            file_path = dir_path / filename
            if file_path.exists():
                found_files[filename] = str(file_path)
            else:
                missing_files.append(filename)

        if missing_files:
            return False, [f"Missing required files: {', '.join(missing_files)}"], found_files

        return True, [], found_files

    @classmethod
    def parse_project(cls, directory: str):
        from .models import Project
        import hashlib
        import time

        dir_path = Path(directory)
        project_name = dir_path.name
        project_id = hashlib.md5(f"{directory}{time.time()}".encode()).hexdigest()[:12]

        project = Project(
            project_id=project_id,
            name=project_name,
            path=str(dir_path)
        )

        cue_list_path = dir_path / CueListParser.DEFAULT_FILENAME
        if cue_list_path.exists():
            project.cues = CueListParser.parse_file(str(cue_list_path))

        lighting_path = dir_path / LightingParser.DEFAULT_FILENAME
        if lighting_path.exists():
            project.light_scenes = LightingParser.parse_file(str(lighting_path))

        audio_path = dir_path / AudioFilesParser.DEFAULT_FILENAME
        if audio_path.exists():
            project.audio_files = AudioFilesParser.parse_file(str(audio_path), str(dir_path))

        schedule_path = dir_path / ActorScheduleParser.DEFAULT_FILENAME
        if schedule_path.exists():
            project.actor_schedules = ActorScheduleParser.parse_file(str(schedule_path))

        return project
