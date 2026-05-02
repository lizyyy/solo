"""修复计划模块 - 生成 dry-run 修复建议"""

import copy
import re
import uuid
from pathlib import Path
from typing import Optional

from .models import (
    ChangeLog,
    ChangeLogEntry,
    FixAction,
    FixPlan,
    FixPlanItem,
    Issue,
    IssueType,
    Language,
    ManifestFile,
    ManifestItem,
    ProjectConfig,
    Quarantine,
    ScriptFile,
    SubtitleEntry,
    SubtitleFile,
    SubtitleFormat,
    Timecode,
)
from .subtitle_parser import SubtitleParser


class FixPlanner:
    def __init__(self, config: ProjectConfig):
        self.config = config

    def generate_fix_plan(
        self,
        quarantine: Quarantine,
        subtitle_files: list[SubtitleFile],
        script_files: list[ScriptFile] = None,
        manifest_file: ManifestFile = None,
    ) -> FixPlan:
        plan_items = []

        plan_items.extend(self._plan_reindex(quarantine, subtitle_files))
        plan_items.extend(self._plan_timecode_adjustments(quarantine, subtitle_files))
        plan_items.extend(self._plan_filename_fixes(quarantine, subtitle_files, manifest_file))
        plan_items.extend(self._plan_missing_translations(quarantine, subtitle_files, script_files))

        return FixPlan(
            items=plan_items,
            is_dry_run=True,
        )

    def _plan_reindex(
        self, quarantine: Quarantine, subtitle_files: list[SubtitleFile]
    ) -> list[FixPlanItem]:
        items = []

        for sub_file in subtitle_files:
            sequence_issues = [
                i for i in quarantine.issues
                if i.issue_type == IssueType.SEQUENCE_GAP
                and i.filename == sub_file.filename
            ]

            if sequence_issues:
                items.append(
                    FixPlanItem(
                        id=str(uuid.uuid4()),
                        action=FixAction.REINDEX,
                        description=f"重新排序 {sub_file.filename} 的字幕序号",
                        language=sub_file.language,
                        episode=sub_file.episode,
                        filename=sub_file.filename,
                        requires_manual=False,
                        issue_ids=[i.id for i in sequence_issues],
                    )
                )

        return items

    def _plan_timecode_adjustments(
        self, quarantine: Quarantine, subtitle_files: list[SubtitleFile]
    ) -> list[FixPlanItem]:
        items = []

        for sub_file in subtitle_files:
            overlap_issues = [
                i for i in quarantine.issues
                if i.issue_type == IssueType.OVERLAP
                and i.filename == sub_file.filename
            ]

            if overlap_issues:
                for issue in overlap_issues:
                    details = issue.details
                    if "overlap_ms" in details:
                        overlap_ms = details["overlap_ms"]
                        min_gap = self.config.min_subtitle_gap_ms

                        if overlap_ms < min_gap + 100:
                            prev_idx = details.get("prev_index")
                            curr_idx = details.get("curr_index")

                            items.append(
                                FixPlanItem(
                                    id=str(uuid.uuid4()),
                                    action=FixAction.ADJUST_TIMECODE,
                                    description=f"调整 {sub_file.filename} 第 {prev_idx} 条与第 {curr_idx} 条的时间间隔 (重叠 {overlap_ms}ms)",
                                    language=sub_file.language,
                                    episode=sub_file.episode,
                                    filename=sub_file.filename,
                                    current_value=f"重叠 {overlap_ms}ms",
                                    proposed_value=f"间隔 {min_gap}ms",
                                    requires_manual=False,
                                    issue_ids=[issue.id],
                                )
                            )

        return items

    def _plan_filename_fixes(
        self,
        quarantine: Quarantine,
        subtitle_files: list[SubtitleFile],
        manifest_file: ManifestFile = None,
    ) -> list[FixPlanItem]:
        items = []

        if not manifest_file:
            return items

        for item in manifest_file.items:
            for sub_file in subtitle_files:
                if sub_file.episode == item.episode:
                    if item.expected_filename and sub_file.filename != item.expected_filename:
                        items.append(
                            FixPlanItem(
                                id=str(uuid.uuid4()),
                                action=FixAction.RENAME_FILE,
                                description=f"将第 {item.episode} 集文件名改为 '{item.expected_filename}'",
                                language=sub_file.language,
                                episode=item.episode,
                                filename=sub_file.filename,
                                current_value=sub_file.filename,
                                proposed_value=item.expected_filename,
                                requires_manual=False,
                                issue_ids=[
                                    i.id for i in quarantine.issues
                                    if i.issue_type == IssueType.FILENAME_MISMATCH
                                    and i.episode == item.episode
                                ],
                            )
                        )

        return items

    def _plan_missing_translations(
        self,
        quarantine: Quarantine,
        subtitle_files: list[SubtitleFile],
        script_files: list[ScriptFile] = None,
    ) -> list[FixPlanItem]:
        items = []

        for issue in quarantine.issues:
            if issue.issue_type == IssueType.MISSING_SEGMENT:
                items.append(
                    FixPlanItem(
                        id=str(uuid.uuid4()),
                        action=FixAction.FLAG_FOR_TRANSLATION,
                        description=f"需要人工检查: {issue.message}",
                        language=issue.language,
                        episode=issue.episode,
                        filename=issue.filename,
                        requires_manual=True,
                        issue_ids=[issue.id],
                    )
                )

        return items

    def apply_fix_plan(
        self,
        fix_plan: FixPlan,
        subtitle_files: list[SubtitleFile],
        manifest_file: ManifestFile = None,
    ) -> tuple[list[SubtitleFile], ChangeLog]:
        change_log = ChangeLog()
        modified_files = copy.deepcopy(subtitle_files)

        for item in fix_plan.items:
            if item.requires_manual:
                continue

            for sub_file in modified_files:
                if item.filename and sub_file.filename != item.filename:
                    continue
                if item.episode and sub_file.episode != item.episode:
                    continue
                if item.language and sub_file.language != item.language:
                    continue

                if item.action == FixAction.REINDEX:
                    self._apply_reindex(sub_file, item, change_log)
                elif item.action == FixAction.ADJUST_TIMECODE:
                    self._apply_timecode_adjustment(sub_file, item, change_log)
                elif item.action == FixAction.RENAME_FILE:
                    self._apply_rename(sub_file, item, change_log)

        return modified_files, change_log

    def _apply_reindex(
        self, sub_file: SubtitleFile, item: FixPlanItem, change_log: ChangeLog
    ):
        for i, entry in enumerate(sub_file.entries):
            old_index = entry.index
            new_index = i + 1
            if old_index != new_index:
                entry.index = new_index
                change_log.entries.append(
                    ChangeLogEntry(
                        id=str(uuid.uuid4()),
                        action="reindex",
                        description=f"序号调整",
                        language=sub_file.language,
                        episode=sub_file.episode,
                        filename=sub_file.filename,
                        before=str(old_index),
                        after=str(new_index),
                    )
                )

    def _apply_timecode_adjustment(
        self, sub_file: SubtitleFile, item: FixPlanItem, change_log: ChangeLog
    ):
        min_gap_seconds = self.config.min_subtitle_gap_ms / 1000

        for i in range(1, len(sub_file.entries)):
            prev_entry = sub_file.entries[i - 1]
            curr_entry = sub_file.entries[i]

            prev_end = prev_entry.end.to_seconds()
            curr_start = curr_entry.start.to_seconds()

            if prev_end > curr_start:
                overlap = prev_end - curr_start
                adjust_amount = overlap + min_gap_seconds / 2

                new_prev_end = prev_end - adjust_amount / 2
                new_curr_start = curr_start + adjust_amount / 2

                old_prev_end = prev_entry.end.to_srt_format()
                old_curr_start = curr_entry.start.to_srt_format()

                prev_entry.end = Timecode.from_seconds(new_prev_end)
                curr_entry.start = Timecode.from_seconds(new_curr_start)

                change_log.entries.append(
                    ChangeLogEntry(
                        id=str(uuid.uuid4()),
                        action="adjust_timecode",
                        description=f"调整第 {prev_entry.index} 条结束时间和第 {curr_entry.index} 条开始时间",
                        language=sub_file.language,
                        episode=sub_file.episode,
                        filename=sub_file.filename,
                        before=f"结束: {old_prev_end}, 开始: {old_curr_start}",
                        after=f"结束: {prev_entry.end.to_srt_format()}, 开始: {curr_entry.start.to_srt_format()}",
                    )
                )

            elif 0 < (curr_start - prev_end) < min_gap_seconds:
                new_prev_end = prev_end - (min_gap_seconds - (curr_start - prev_end)) / 2
                new_curr_start = curr_start + (min_gap_seconds - (curr_start - prev_end)) / 2

                old_prev_end = prev_entry.end.to_srt_format()
                old_curr_start = curr_entry.start.to_srt_format()

                prev_entry.end = Timecode.from_seconds(new_prev_end)
                curr_entry.start = Timecode.from_seconds(new_curr_start)

                change_log.entries.append(
                    ChangeLogEntry(
                        id=str(uuid.uuid4()),
                        action="adjust_timecode",
                        description=f"调整第 {prev_entry.index} 条和第 {curr_entry.index} 条时间间隔",
                        language=sub_file.language,
                        episode=sub_file.episode,
                        filename=sub_file.filename,
                        before=f"间隔: {int((curr_start - prev_end) * 1000)}ms",
                        after=f"间隔: {self.config.min_subtitle_gap_ms}ms",
                    )
                )

    def _apply_rename(
        self, sub_file: SubtitleFile, item: FixPlanItem, change_log: ChangeLog
    ):
        old_filename = sub_file.filename
        if item.proposed_value:
            sub_file.filename = item.proposed_value

            change_log.entries.append(
                ChangeLogEntry(
                    id=str(uuid.uuid4()),
                    action="rename",
                    description=f"重命名文件",
                    language=sub_file.language,
                    episode=sub_file.episode,
                    filename=old_filename,
                    before=old_filename,
                    after=item.proposed_value,
                )
            )

    def write_fixed_subtitles(
        self,
        subtitle_files: list[SubtitleFile],
        output_dir: Path,
    ) -> list[Path]:
        output_paths = []

        for sub_file in subtitle_files:
            output_path = output_dir / sub_file.filename

            if sub_file.format == SubtitleFormat.SRT:
                content = SubtitleParser.to_srt(sub_file.entries)
            else:
                content = SubtitleParser.to_vtt(sub_file.entries)

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)

            output_paths.append(output_path)

        return output_paths
