"""业务逻辑层 - 导入、复核、修正、历史追溯、导出"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json
import os
import csv
from pathlib import Path

from .models import (
    Project, AdSpot, RawAudioTrack, AudioSlice,
    HistoryRecord, SilenceIssue, generate_id
)
from .engine import AudioSlicingEngine, SliceCalculator


class DataImporter:
    """数据导入器"""

    @staticmethod
    def import_ad_spots_from_csv(file_path: str) -> List[AdSpot]:
        """从CSV导入广告口播表"""
        ads = []
        if not os.path.exists(file_path):
            return ads

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                start = SliceCalculator.parse_time(row.get('start_time', row.get('开始时间', '0')))
                end = SliceCalculator.parse_time(row.get('end_time', row.get('结束时间', '0')))
                ad = AdSpot(
                    name=row.get('name', row.get('名称', '')),
                    start_time=start,
                    end_time=end,
                    content=row.get('content', row.get('内容', '')),
                    speaker=row.get('speaker', row.get('主讲人', '')),
                    source_file=file_path,
                    notes=row.get('notes', row.get('备注', ''))
                )
                ads.append(ad)
        return ads

    @staticmethod
    def import_ad_spots_from_dict(data: List[Dict[str, Any]]) -> List[AdSpot]:
        """从字典列表导入广告口播表"""
        ads = []
        for row in data:
            start = SliceCalculator.parse_time(str(row.get('start_time', row.get('开始时间', 0))))
            end = SliceCalculator.parse_time(str(row.get('end_time', row.get('结束时间', 0))))
            ad = AdSpot(
                name=row.get('name', row.get('名称', '')),
                start_time=start,
                end_time=end,
                content=row.get('content', row.get('内容', '')),
                speaker=row.get('speaker', row.get('主讲人', '')),
                source_file=row.get('source_file', ''),
                notes=row.get('notes', row.get('备注', ''))
            )
            ads.append(ad)
        return ads

    @staticmethod
    def import_raw_tracks_from_csv(file_path: str) -> List[RawAudioTrack]:
        """从CSV导入原始音轨"""
        tracks = []
        if not os.path.exists(file_path):
            return tracks

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                start = SliceCalculator.parse_time(row.get('start_time', row.get('开始时间', '0')))
                end = SliceCalculator.parse_time(row.get('end_time', row.get('结束时间', '0')))
                is_silence = str(row.get('is_silence', row.get('是否静音', 'false'))).lower() in ('true', '1', 'yes', '是')
                track = RawAudioTrack(
                    name=row.get('name', row.get('名称', '')),
                    start_time=start,
                    end_time=end,
                    content=row.get('content', row.get('内容', '')),
                    transcript=row.get('transcript', row.get('字幕', '')),
                    speaker=row.get('speaker', row.get('主讲人', '')),
                    source_file=file_path,
                    is_silence=is_silence,
                    silence_confidence=float(row.get('silence_confidence', row.get('静音置信度', 0))),
                    notes=row.get('notes', row.get('备注', ''))
                )
                tracks.append(track)
        return tracks

    @staticmethod
    def import_raw_tracks_from_dict(data: List[Dict[str, Any]]) -> List[RawAudioTrack]:
        """从字典列表导入原始音轨"""
        tracks = []
        for row in data:
            start = SliceCalculator.parse_time(str(row.get('start_time', row.get('开始时间', 0))))
            end = SliceCalculator.parse_time(str(row.get('end_time', row.get('结束时间', 0))))
            is_silence = str(row.get('is_silence', row.get('是否静音', 'false'))).lower() in ('true', '1', 'yes', '是')
            track = RawAudioTrack(
                name=row.get('name', row.get('名称', '')),
                start_time=start,
                end_time=end,
                content=row.get('content', row.get('内容', '')),
                transcript=row.get('transcript', row.get('字幕', '')),
                speaker=row.get('speaker', row.get('主讲人', '')),
                source_file=row.get('source_file', ''),
                is_silence=is_silence,
                silence_confidence=float(row.get('silence_confidence', row.get('静音置信度', 0))),
                notes=row.get('notes', row.get('备注', ''))
            )
            tracks.append(track)
        return tracks


class HistoryManager:
    """历史记录管理器 - 记录所有变更，支持追溯"""

    def __init__(self, project: Project):
        self.project = project

    def record_change(
        self,
        operation: str,
        operator: str,
        target_type: str,
        target_id: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        reason: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> HistoryRecord:
        """记录一次变更"""
        old_str = str(old_value) if old_value is not None else ""
        new_str = str(new_value) if new_value is not None else ""

        diff_summary = self._generate_diff_summary(field_name, old_str, new_str)

        record = HistoryRecord(
            operation=operation,
            operator=operator,
            target_type=target_type,
            target_id=target_id,
            field_name=field_name,
            old_value=old_str,
            new_value=new_str,
            diff_summary=diff_summary,
            reason=reason,
            metadata=metadata or {}
        )

        self.project.history.append(record)
        self.project.updated_at = datetime.now()
        return record

    def _generate_diff_summary(self, field_name: str, old_val: str, new_val: str) -> str:
        """生成变更摘要"""
        if field_name in ('subtitle_draft', 'subtitle_final', 'content'):
            old_len = len(old_val)
            new_len = len(new_val)
            if old_len == 0:
                return f"新增内容 {new_len} 字"
            elif new_len == 0:
                return f"删除内容 {old_len} 字"
            else:
                return f"内容变更: {old_len}字 → {new_len}字"
        elif field_name in ('start_time', 'end_time', 'duration'):
            try:
                old_f = SliceCalculator.format_time(float(old_val)) if old_val else "未设置"
                new_f = SliceCalculator.format_time(float(new_val)) if new_val else "未设置"
                return f"{field_name}: {old_f} → {new_f}"
            except (ValueError, TypeError):
                return f"{field_name}: {old_val} → {new_val}"
        else:
            return f"{field_name}: {old_val} → {new_val}"

    def get_history_for_target(self, target_type: str, target_id: str) -> List[HistoryRecord]:
        """获取指定目标的历史记录"""
        return [
            h for h in self.project.history
            if h.target_type == target_type and h.target_id == target_id
        ]

    def get_history_for_slice(self, slice_id: str) -> List[Dict[str, Any]]:
        """获取切片的完整历史，包括字幕变更等"""
        records = self.get_history_for_target('slice', slice_id)
        return [r.to_dict() for r in records]

    def compare_versions(
        self, target_type: str, target_id: str, version_idx1: int, version_idx2: int
    ) -> Dict[str, Any]:
        """比较两个版本的差异"""
        records = self.get_history_for_target(target_type, target_id)
        if not records or version_idx1 >= len(records) or version_idx2 >= len(records):
            return {"error": "版本索引超出范围"}

        r1 = records[version_idx1]
        r2 = records[version_idx2]

        return {
            "earlier": {
                "timestamp": r1.timestamp.isoformat(),
                "operator": r1.operator,
                "field": r1.field_name,
                "value": r1.old_value,
                "reason": r1.reason
            },
            "later": {
                "timestamp": r2.timestamp.isoformat(),
                "operator": r2.operator,
                "field": r2.field_name,
                "value": r2.new_value,
                "reason": r2.reason
            },
            "diff": f"{r1.diff_summary} → {r2.diff_summary}"
        }


class ReviewManager:
    """复核管理器"""

    def __init__(self, project: Project, history_manager: HistoryManager):
        self.project = project
        self.history = history_manager

    def review_slice(
        self,
        slice_id: str,
        reviewer: str,
        approved: bool,
        comments: str = "",
        corrections: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[AudioSlice], List[str]]:
        """复核单个切片"""
        slice_obj = self._find_slice(slice_id)
        if not slice_obj:
            return None, [f"未找到切片 {slice_id}"]

        warnings = []

        slice_obj.reviewed = True
        slice_obj.reviewed_by = reviewer
        slice_obj.reviewed_at = datetime.now()
        slice_obj.status = "approved" if approved else "rejected"

        self.history.record_change(
            operation="review",
            operator=reviewer,
            target_type="slice",
            target_id=slice_id,
            field_name="status",
            old_value=slice_obj.status,
            new_value="approved" if approved else "rejected",
            reason=f"复核{'通过' if approved else '拒绝'}: {comments}" if comments else f"复核{'通过' if approved else '拒绝'}",
            metadata={"comments": comments}
        )

        if corrections:
            warnings.extend(self.apply_corrections(slice_id, corrections, reviewer, "复核修正"))

        self.project.updated_at = datetime.now()
        return slice_obj, warnings

    def apply_corrections(
        self,
        slice_id: str,
        corrections: Dict[str, Any],
        operator: str,
        reason: str = "手动修正"
    ) -> List[str]:
        """应用修正到切片"""
        slice_obj = self._find_slice(slice_id)
        if not slice_obj:
            return [f"未找到切片 {slice_id}"]

        warnings = []
        allowed_fields = {
            'name', 'start_time', 'end_time', 'content', 'subtitle_draft',
            'subtitle_final', 'status', 'notes', 'export_filename'
        }

        for field, new_value in corrections.items():
            if field not in allowed_fields:
                warnings.append(f"不允许修改字段: {field}")
                continue

            old_value = getattr(slice_obj, field)

            if field in ('start_time', 'end_time'):
                try:
                    new_value = float(new_value)
                except (ValueError, TypeError):
                    warnings.append(f"时间格式错误: {field}={new_value}")
                    continue

            if old_value != new_value:
                setattr(slice_obj, field, new_value)

                self.history.record_change(
                    operation="correct",
                    operator=operator,
                    target_type="slice",
                    target_id=slice_id,
                    field_name=field,
                    old_value=old_value,
                    new_value=new_value,
                    reason=reason
                )

                if field in ('start_time', 'end_time'):
                    slice_obj.duration = round(slice_obj.end_time - slice_obj.start_time, 3)

        self.project.updated_at = datetime.now()
        return warnings

    def update_subtitle(
        self,
        slice_id: str,
        new_subtitle: str,
        is_final: bool,
        operator: str,
        reason: str = "字幕编辑"
    ) -> List[str]:
        """更新字幕（草稿或最终版），自动记录历史"""
        slice_obj = self._find_slice(slice_id)
        if not slice_obj:
            return [f"未找到切片 {slice_id}"]

        field_name = "subtitle_final" if is_final else "subtitle_draft"
        old_value = getattr(slice_obj, field_name)

        if old_value == new_subtitle:
            return []

        setattr(slice_obj, field_name, new_subtitle)

        self.history.record_change(
            operation="subtitle_edit",
            operator=operator,
            target_type="slice",
            target_id=slice_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_subtitle,
            reason=reason,
            metadata={"is_final": is_final}
        )

        self.project.updated_at = datetime.now()
        return []

    def _find_slice(self, slice_id: str) -> Optional[AudioSlice]:
        for s in self.project.slices:
            if s.id == slice_id:
                return s
        return None

    def get_unreviewed_slices(self) -> List[AudioSlice]:
        """获取待复核的切片"""
        return [s for s in self.project.slices if not s.reviewed]

    def get_review_summary(self) -> Dict[str, Any]:
        """获取复核统计摘要"""
        total = len(self.project.slices)
        reviewed = sum(1 for s in self.project.slices if s.reviewed)
        approved = sum(1 for s in self.project.slices if s.status == "approved")
        rejected = sum(1 for s in self.project.slices if s.status == "rejected")
        pending = total - reviewed
        has_warnings = sum(1 for s in self.project.slices if s.warnings)
        has_issues = sum(1 for s in self.project.slices if s.issues)

        return {
            "total": total,
            "reviewed": reviewed,
            "approved": approved,
            "rejected": rejected,
            "pending": pending,
            "progress": round(reviewed / total * 100, 1) if total > 0 else 0,
            "has_warnings": has_warnings,
            "has_issues": has_issues,
            "silence_issues_open": sum(1 for si in self.project.silence_issues if si.status == "open")
        }


class SourceTracer:
    """源数据追溯器 - 从切片回溯到广告口播表或原始音轨"""

    def __init__(self, project: Project):
        self.project = project

    def trace_slice_source(self, slice_id: str) -> Dict[str, Any]:
        """追溯切片的来源"""
        slice_obj = None
        for s in self.project.slices:
            if s.id == slice_id:
                slice_obj = s
                break

        if not slice_obj:
            return {"error": f"未找到切片 {slice_id}"}

        result = {
            "slice": slice_obj.to_dict(),
            "source_ref": slice_obj.source_ref,
            "source_type": slice_obj.source_type,
            "sources": []
        }

        if slice_obj.source_type == "ad_spot" or slice_obj.source_type == "":
            for ad in self.project.ad_spots:
                if ad.id == slice_obj.source_id:
                    result["sources"].append({
                        "type": "ad_spot",
                        "name": "广告口播表",
                        "data": ad.to_dict(),
                        "link": f"#ad-spot-{ad.id}"
                    })
                    break

        if slice_obj.source_type == "raw_track" or "原始音轨" in slice_obj.source_ref:
            for track in self.project.raw_tracks:
                if track.id == slice_obj.source_id:
                    result["sources"].append({
                        "type": "raw_track",
                        "name": "原始音轨",
                        "data": track.to_dict(),
                        "link": f"#raw-track-{track.id}"
                    })
                    break

        if "双源匹配" in slice_obj.source_ref:
            for ad in self.project.ad_spots:
                overlap = SliceCalculator.time_overlap(
                    ad.start_time, ad.end_time,
                    slice_obj.start_time, slice_obj.end_time
                )
                if overlap > 0.1:
                    result["sources"].append({
                        "type": "ad_spot",
                        "name": "广告口播表",
                        "data": ad.to_dict(),
                        "overlap_seconds": round(overlap, 3),
                        "link": f"#ad-spot-{ad.id}"
                    })
                    break

            for track in self.project.raw_tracks:
                overlap = SliceCalculator.time_overlap(
                    track.start_time, track.end_time,
                    slice_obj.start_time, slice_obj.end_time
                )
                if overlap > 0.1:
                    result["sources"].append({
                        "type": "raw_track",
                        "name": "原始音轨",
                        "data": track.to_dict(),
                        "overlap_seconds": round(overlap, 3),
                        "link": f"#raw-track-{track.id}"
                    })
                    break

        return result

    def get_silence_issue_details(self, issue_id: str) -> Dict[str, Any]:
        """获取静音段问题的详细信息，包括来源追溯"""
        issue = None
        for si in self.project.silence_issues:
            if si.id == issue_id:
                issue = si
                break

        if not issue:
            return {"error": f"未找到静音段问题 {issue_id}"}

        result = {
            "issue": issue.to_dict(),
            "source_details": None,
            "related_slice": None
        }

        if issue.source_type == "ad_spot":
            for ad in self.project.ad_spots:
                if ad.id == issue.source_id:
                    result["source_details"] = {
                        "type": "广告口播表",
                        "data": ad.to_dict()
                    }
                    break
        elif issue.source_type == "raw_track":
            for track in self.project.raw_tracks:
                if track.id == issue.source_id:
                    result["source_details"] = {
                        "type": "原始音轨",
                        "data": track.to_dict()
                    }
                    break

        if issue.slice_id:
            for s in self.project.slices:
                if s.id == issue.slice_id:
                    result["related_slice"] = s.to_dict()
                    break

        return result


class Exporter:
    """数据导出器"""

    def __init__(self, project: Project):
        self.project = project

    def export_slices_to_csv(self, output_path: str, only_approved: bool = False) -> str:
        """导出切片清单到CSV"""
        slices = self.project.slices
        if only_approved:
            slices = [s for s in slices if s.status == "approved"]

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '序号', '切片名称', '开始时间', '结束时间', '时长(秒)',
                '类型', '状态', '来源', '字幕草稿', '字幕最终版',
                '导出文件名', '备注', '切片ID'
            ])

            for idx, s in enumerate(sorted(slices, key=lambda x: x.start_time), 1):
                writer.writerow([
                    idx,
                    s.name,
                    SliceCalculator.format_time(s.start_time),
                    SliceCalculator.format_time(s.end_time),
                    round(s.duration, 3),
                    s.slice_type,
                    s.status,
                    s.source_ref,
                    s.subtitle_draft,
                    s.subtitle_final,
                    s.export_filename,
                    s.notes,
                    s.id
                ])

        return output_path

    def export_silence_issues_to_csv(self, output_path: str, only_open: bool = True) -> str:
        """导出静音段问题清单"""
        issues = self.project.silence_issues
        if only_open:
            issues = [i for i in issues if i.status == "open"]

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '序号', '开始时间', '结束时间', '时长(秒)',
                '来源类型', '来源引用', '检测方式', '建议处理方式',
                '联系人', '状态', '备注', '问题ID'
            ])

            for idx, issue in enumerate(issues, 1):
                writer.writerow([
                    idx,
                    SliceCalculator.format_time(issue.start_time),
                    SliceCalculator.format_time(issue.end_time),
                    round(issue.duration, 3),
                    issue.source_type,
                    issue.source_ref,
                    issue.detected_from,
                    issue.action_suggested,
                    issue.contact_person,
                    issue.status,
                    issue.notes,
                    issue.id
                ])

        return output_path

    def export_manifest_json(self, output_path: str) -> str:
        """导出上线清单JSON（包含明细和汇总）"""
        approved_slices = [s for s in self.project.slices if s.status == "approved"]
        approved_slices.sort(key=lambda x: x.start_time)

        total_duration = sum(s.duration for s in approved_slices)
        ad_count = sum(1 for s in approved_slices if s.slice_type == "ad")
        content_count = sum(1 for s in approved_slices if s.slice_type == "content")

        manifest = {
            "project_id": self.project.id,
            "project_name": self.project.name,
            "export_time": datetime.now().isoformat(),
            "summary": {
                "total_slices": len(approved_slices),
                "ad_slices": ad_count,
                "content_slices": content_count,
                "total_duration_seconds": round(total_duration, 3),
                "total_duration_formatted": SliceCalculator.format_time(total_duration),
                "pending_silence_issues": sum(1 for si in self.project.silence_issues if si.status == "open")
            },
            "slices": [s.to_dict() for s in approved_slices],
            "open_silence_issues": [si.to_dict() for si in self.project.silence_issues if si.status == "open"]
        }

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        return output_path

    def export_project_json(self, output_path: str) -> str:
        """导出完整项目JSON"""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(self.project.to_json())
        return output_path

    def export_history_to_csv(self, output_path: str) -> str:
        """导出历史记录"""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '时间', '操作人', '操作类型', '目标类型', '目标ID',
                '字段', '原值', '新值', '变更摘要', '原因', '记录ID'
            ])

            for h in sorted(self.project.history, key=lambda x: x.timestamp):
                writer.writerow([
                    h.timestamp.isoformat(),
                    h.operator,
                    h.operation,
                    h.target_type,
                    h.target_id,
                    h.field_name,
                    h.old_value,
                    h.new_value,
                    h.diff_summary,
                    h.reason,
                    h.id
                ])

        return output_path


class AudioSlicerWorkflow:
    """完整工作流控制器"""

    def __init__(self, project_name: str = "课程音频切片项目"):
        self.project = Project(name=project_name)
        self.engine = AudioSlicingEngine()
        self.importer = DataImporter()
        self.history = HistoryManager(self.project)
        self.reviewer = ReviewManager(self.project, self.history)
        self.tracer = SourceTracer(self.project)
        self.exporter = Exporter(self.project)

    def run_full_workflow(
        self,
        ad_data: List[Dict[str, Any]],
        track_data: List[Dict[str, Any]],
        operator: str = "system"
    ) -> Dict[str, Any]:
        """执行完整的切片工作流"""
        ads = self.importer.import_ad_spots_from_dict(ad_data)
        tracks = self.importer.import_raw_tracks_from_dict(track_data)

        self.project.ad_spots = ads
        self.project.raw_tracks = tracks

        ad_slices, ad_warnings, drift = self.engine.create_slices_from_ads(ads)
        track_slices = self.engine.create_slices_from_tracks(tracks)

        merged_slices, merge_warnings = self.engine.merge_slices(ad_slices, track_slices)
        self.project.slices = merged_slices

        silence_issues = self.engine.detect_all_silence_issues(merged_slices, ads, tracks)
        self.project.silence_issues = silence_issues

        self.history.record_change(
            operation="import",
            operator=operator,
            target_type="project",
            target_id=self.project.id,
            field_name="slices",
            old_value="",
            new_value=f"生成{len(merged_slices)}个切片",
            reason=f"导入数据并生成切片，广告口播{len(ads)}条，原始音轨{len(tracks)}条",
            metadata={
                "ad_count": len(ads),
                "track_count": len(tracks),
                "slice_count": len(merged_slices),
                "drift_correction": drift,
                "silence_issues": len(silence_issues)
            }
        )

        self.project.updated_at = datetime.now()

        return {
            "slice_count": len(merged_slices),
            "ad_count": len(ads),
            "track_count": len(tracks),
            "drift_correction_seconds": drift,
            "silence_issues_count": len(silence_issues),
            "warnings": ad_warnings + merge_warnings
        }

    def save_project(self, file_path: str) -> str:
        """保存项目到文件"""
        return self.exporter.export_project_json(file_path)

    def load_project(self, file_path: str) -> bool:
        """从文件加载项目"""
        if not os.path.exists(file_path):
            return False

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.project.id = data.get('id', self.project.id)
        self.project.name = data.get('name', self.project.name)
        self.project.created_at = datetime.fromisoformat(data.get('created_at', datetime.now().isoformat()))
        self.project.updated_at = datetime.fromisoformat(data.get('updated_at', datetime.now().isoformat()))
        self.project.metadata = data.get('metadata', {})

        self.project.ad_spots = [AdSpot(**a) for a in data.get('ad_spots', [])]
        self.project.raw_tracks = [RawAudioTrack(**t) for t in data.get('raw_tracks', [])]

        slices_data = data.get('slices', [])
        for s in slices_data:
            if 'reviewed_at' in s and s['reviewed_at']:
                s['reviewed_at'] = datetime.fromisoformat(s['reviewed_at'])
        self.project.slices = [AudioSlice(**s) for s in slices_data]

        history_data = data.get('history', [])
        for h in history_data:
            h['timestamp'] = datetime.fromisoformat(h['timestamp'])
        self.project.history = [HistoryRecord(**h) for h in history_data]

        self.project.silence_issues = [SilenceIssue(**si) for si in data.get('silence_issues', [])]

        self.history = HistoryManager(self.project)
        self.reviewer = ReviewManager(self.project, self.history)
        self.tracer = SourceTracer(self.project)
        self.exporter = Exporter(self.project)

        return True
