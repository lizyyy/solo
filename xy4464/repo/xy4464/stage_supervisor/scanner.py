import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Dict, Set, Optional, Any, Tuple

from .models import (
    Project, Issue, IssueType, IssueSeverity, Cue, CueType,
    LightScene, AudioFile, ActorSchedule
)


class BaseScanner:
    def scan(self, project: Project) -> List[Issue]:
        raise NotImplementedError("Subclasses must implement scan method")


class CueMissingScanner(BaseScanner):
    DEFAULT_MIN_CHANGE_TIME = 30

    def scan(self, project: Project) -> List[Issue]:
        issues = []
        cues = project.cues

        if not cues:
            return issues

        cue_ids = [cue.cue_id for cue in cues]
        numeric_cues = []

        for cue_id in cue_ids:
            match = re.match(r'^[A-Za-z]?(\d+)$', cue_id.strip())
            if match:
                try:
                    num = int(match.group(1))
                    numeric_cues.append((num, cue_id))
                except ValueError:
                    pass

        if numeric_cues:
            numeric_cues.sort(key=lambda x: x[0])
            nums = [x[0] for x in numeric_cues]
            min_num = min(nums)
            max_num = max(nums)

            for expected in range(min_num, max_num + 1):
                if expected not in nums:
                    issue = Issue(
                        issue_id=f"CM-{expected:04d}",
                        issue_type=IssueType.CUE_MISSING,
                        severity=IssueSeverity.HIGH,
                        title=f"Cue 编号缺失: {expected}",
                        description=f"在 Cue 序列中发现缺失的编号: {expected}。当前 Cue 范围: {min_num} - {max_num}",
                        time_code="N/A",
                        metadata={
                            "expected_cue_num": expected,
                            "cue_range": f"{min_num}-{max_num}",
                            "existing_cues": [x[1] for x in numeric_cues]
                        }
                    )
                    issues.append(issue)

        return issues


class LightSceneNotFoundScanner(BaseScanner):
    def scan(self, project: Project) -> List[Issue]:
        issues = []
        light_scene_ids = {scene.scene_id for scene in project.light_scenes}

        light_cues = [cue for cue in project.cues if cue.cue_type == CueType.LIGHT]

        for i, cue in enumerate(light_cues):
            if cue.light_scene_id:
                if cue.light_scene_id not in light_scene_ids:
                    issue = Issue(
                        issue_id=f"LS-{i:04d}",
                        issue_type=IssueType.LIGHT_SCENE_NOT_FOUND,
                        severity=IssueSeverity.CRITICAL,
                        title=f"灯光场景不存在: {cue.light_scene_id}",
                        description=f"Cue [{cue.cue_id}] 引用的灯光场景 [{cue.light_scene_id}] 在灯光台导出数据中不存在。",
                        related_cue_id=cue.cue_id,
                        time_code=cue.time,
                        metadata={
                            "cue_id": cue.cue_id,
                            "missing_scene_id": cue.light_scene_id,
                            "available_scenes": list(light_scene_ids)
                        }
                    )
                    issues.append(issue)

        return issues


class AudioFileBrokenScanner(BaseScanner):
    def scan(self, project: Project) -> List[Issue]:
        issues = []
        audio_files_by_cue = {
            audio.cue_id: audio for audio in project.audio_files
        }

        audio_cues = [cue for cue in project.cues if cue.cue_type == CueType.AUDIO]

        for i, cue in enumerate(audio_cues):
            if cue.audio_file_id:
                audio_file = audio_files_by_cue.get(cue.audio_file_id)
                if not audio_file:
                    issue = Issue(
                        issue_id=f"AF-{i:04d}",
                        issue_type=IssueType.AUDIO_FILE_BROKEN,
                        severity=IssueSeverity.HIGH,
                        title=f"音频文件未配置: {cue.audio_file_id}",
                        description=f"Cue [{cue.cue_id}] 引用的音频文件 [{cue.audio_file_id}] 在音频清单中未找到。",
                        related_cue_id=cue.cue_id,
                        related_file=cue.audio_file_id,
                        time_code=cue.time,
                        metadata={
                            "cue_id": cue.cue_id,
                            "missing_audio_id": cue.audio_file_id,
                            "available_audio_ids": list(audio_files_by_cue.keys())
                        }
                    )
                    issues.append(issue)
                elif not audio_file.exists:
                    issue = Issue(
                        issue_id=f"AF-{i:04d}",
                        issue_type=IssueType.AUDIO_FILE_BROKEN,
                        severity=IssueSeverity.CRITICAL,
                        title=f"音频文件断链: {audio_file.filename}",
                        description=f"Cue [{cue.cue_id}] 引用的音频文件 [{audio_file.filename}] 在路径 [{audio_file.path}] 中不存在。",
                        related_cue_id=cue.cue_id,
                        related_file=audio_file.path,
                        time_code=cue.time,
                        metadata={
                            "cue_id": cue.cue_id,
                            "audio_filename": audio_file.filename,
                            "audio_path": audio_file.path,
                            "audio_id": cue.audio_file_id
                        }
                    )
                    issues.append(issue)

        return issues


class ActorChangeTimeInspector:
    DEFAULT_MIN_CHANGE_SECONDS = 120

    @staticmethod
    def time_to_seconds(time_str: str) -> Optional[int]:
        if not time_str or not time_str.strip():
            return None

        time_str = time_str.strip()
        match = re.match(r'^(\d+):(\d+)(?::(\d+))?$', time_str)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            seconds = int(match.group(3)) if match.group(3) else 0
            return hours * 3600 + minutes * 60 + seconds

        match = re.match(r'^(\d+)$', time_str)
        if match:
            return int(match.group(1))

        return None

    @staticmethod
    def seconds_to_time(seconds: int) -> str:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"


class ActorChangeTimeScanner(BaseScanner):
    def __init__(self, min_change_seconds: int = 120):
        self.min_change_seconds = min_change_seconds

    def scan(self, project: Project) -> List[Issue]:
        issues = []

        actor_appearances = defaultdict(list)
        for schedule in project.actor_schedules:
            enter_sec = ActorChangeTimeInspector.time_to_seconds(schedule.enter_time)
            exit_sec = ActorChangeTimeInspector.time_to_seconds(schedule.exit_time)

            if enter_sec is not None and exit_sec is not None:
                actor_appearances[schedule.actor_name].append({
                    'scene_id': schedule.scene_id,
                    'enter_sec': enter_sec,
                    'enter_time': schedule.enter_time,
                    'exit_sec': exit_sec,
                    'exit_time': schedule.exit_time,
                    'costume': schedule.costume,
                    'schedule': schedule
                })

        issue_index = 0
        for actor_name, appearances in actor_appearances.items():
            appearances.sort(key=lambda x: x['enter_sec'])

            for i in range(len(appearances) - 1):
                current = appearances[i]
                next_app = appearances[i + 1]

                current_exit = current['exit_sec']
                next_enter = next_app['enter_sec']

                if next_enter >= current_exit:
                    gap_seconds = next_enter - current_exit

                    if gap_seconds < self.min_change_seconds:
                        current_costume = current['costume'] or "未指定"
                        next_costume = next_app['costume'] or "未指定"
                        needs_costume_change = current_costume != next_costume

                        if needs_costume_change or gap_seconds < 30:
                            severity = IssueSeverity.HIGH if needs_costume_change else IssueSeverity.MEDIUM
                            gap_str = ActorChangeTimeInspector.seconds_to_time(gap_seconds)
                            min_str = ActorChangeTimeInspector.seconds_to_time(self.min_change_seconds)

                            issue = Issue(
                                issue_id=f"ACT-{issue_index:04d}",
                                issue_type=IssueType.ACTOR_CHANGE_TIME_INSUFFICIENT,
                                severity=severity,
                                title=f"演员换场时间不足: {actor_name}",
                                description=f"演员 [{actor_name}] 在场景 [{current['scene_id']}] 下场时间 [{current['exit_time']}] 到场景 [{next_app['scene_id']}] 上场时间 [{next_app['enter_time']}] 之间的间隔仅为 [{gap_str}]，小于建议的最小换场时间 [{min_str}]。",
                                related_actor=actor_name,
                                time_code=current['exit_time'],
                                metadata={
                                    "actor_name": actor_name,
                                    "current_scene": current['scene_id'],
                                    "next_scene": next_app['scene_id'],
                                    "exit_time": current['exit_time'],
                                    "enter_time": next_app['enter_time'],
                                    "gap_seconds": gap_seconds,
                                    "gap_time": gap_str,
                                    "min_required_seconds": self.min_change_seconds,
                                    "current_costume": current_costume,
                                    "next_costume": next_costume,
                                    "needs_costume_change": needs_costume_change
                                }
                            )
                            issues.append(issue)
                            issue_index += 1

        return issues


class IssueScanner:
    def __init__(self, min_actor_change_seconds: int = 120):
        self.scanners = [
            CueMissingScanner(),
            LightSceneNotFoundScanner(),
            AudioFileBrokenScanner(),
            ActorChangeTimeScanner(min_actor_change_seconds),
        ]

    def scan_project(self, project: Project) -> List[Issue]:
        all_issues = []

        for scanner in self.scanners:
            issues = scanner.scan(project)
            all_issues.extend(issues)

        for i, issue in enumerate(all_issues):
            if not issue.issue_id or issue.issue_id.startswith("CM-") or issue.issue_id.startswith("LS-") or issue.issue_id.startswith("AF-") or issue.issue_id.startswith("ACT-"):
                pass
            else:
                issue.issue_id = f"ISS-{i:04d}"

        return all_issues

    def scan_and_update_project(self, project: Project) -> Project:
        from datetime import datetime

        issues = self.scan_project(project)
        project.issues = issues
        project.last_scan_at = datetime.now()

        return project

    def get_scan_summary(self, project: Project) -> Dict[str, Any]:
        issues = project.issues

        summary = {
            "total_issues": len(issues),
            "by_type": defaultdict(int),
            "by_severity": defaultdict(int),
            "unresolved": 0,
            "resolved": 0,
        }

        for issue in issues:
            summary["by_type"][issue.issue_type.value] += 1
            summary["by_severity"][issue.severity.value] += 1
            if issue.resolved:
                summary["resolved"] += 1
            else:
                summary["unresolved"] += 1

        summary["by_type"] = dict(summary["by_type"])
        summary["by_severity"] = dict(summary["by_severity"])

        return summary
