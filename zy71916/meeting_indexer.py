#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
会议录音索引系统 - 播客剪辑工作流自动化
"""

import os
import json
import hashlib
from pathlib import Path
from datetime import datetime
from collections import defaultdict


class RecordingStatus:
    PENDING = "待处理"
    DRAFT_REVIEW = "字幕草稿待审核"
    NEEDS_GUEST_LIST = "缺嘉宾名单"
    DUPLICATE_CLIPS = "有重复剪辑点"
    READY_FOR_CUT = "可进入剪辑"
    COMPLETED = "已上线"
    BLOCKED = "阻塞"


class FileChecker:
    REQUIRED_FILES = {
        "subtitle_draft": "字幕草稿",
        "recording": "录音文件",
        "clip_points": "剪辑点清单",
        "guest_list": "嘉宾名单",
    }

    @staticmethod
    def check_directory(dir_path):
        result = {
            "exists": True,
            "missing_files": [],
            "file_details": {},
        }
        for key, desc in FileChecker.REQUIRED_FILES.items():
            pattern = f"*{key}*" if key != "recording" else "*recording*"
            matches = list(Path(dir_path).glob(pattern))
            if key == "guest_list":
                matches = list(Path(dir_path).glob("*guest*")) + list(
                    Path(dir_path).glob("*嘉宾*")
                )
            if key == "clip_points":
                matches = list(Path(dir_path).glob("*clip*")) + list(
                    Path(dir_path).glob("*剪辑点*")
                )
            if key == "subtitle_draft":
                matches = list(Path(dir_path).glob("*subtitle*")) + list(
                    Path(dir_path).glob("*字幕*")
                )
            if key == "recording":
                matches = (
                    list(Path(dir_path).glob("*.wav"))
                    + list(Path(dir_path).glob("*.mp3"))
                    + list(Path(dir_path).glob("*.m4a"))
                )

            if not matches:
                result["missing_files"].append(desc)
            else:
                result["file_details"][key] = {
                    "path": str(matches[0]),
                    "mtime": os.path.getmtime(str(matches[0])),
                    "size": os.path.getsize(str(matches[0])),
                }
        return result


class ChangeDetector:
    @staticmethod
    def file_hash(filepath):
        if not os.path.exists(filepath):
            return None
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def detect_subtitle_changes(current_files, history_record):
        changes = []
        if not history_record:
            changes.append(
                {"type": "首次处理", "reason": "该会议录音是第一次进入索引系统"}
            )
            return changes

        hist_files = history_record.get("file_details", {})
        curr_files = current_files.get("file_details", {})

        if "subtitle_draft" in curr_files and "subtitle_draft" in hist_files:
            curr_hash = ChangeDetector.file_hash(
                curr_files["subtitle_draft"]["path"]
            )
            hist_hash = (
                hist_files["subtitle_draft"].get("hash")
                if isinstance(hist_files["subtitle_draft"], dict)
                else None
            )
            if hist_hash and curr_hash != hist_hash:
                changes.append(
                    {
                        "type": "字幕草稿已修改",
                        "reason": "字幕草稿文件哈希值与上次记录不同，说明有人编辑过",
                        "modified_at": datetime.fromtimestamp(
                            curr_files["subtitle_draft"]["mtime"]
                        ).strftime("%Y-%m-%d %H:%M:%S"),
                    }
                )
            elif not hist_hash:
                changes.append(
                    {"type": "历史记录不完整", "reason": "缺少上次的文件哈希，无法准确比对"}
                )
            else:
                changes.append({"type": "字幕未修改", "reason": "字幕草稿内容与上次记录一致"})

        for key in ["clip_points", "guest_list"]:
            if key in curr_files and key in hist_files:
                curr_mtime = curr_files[key]["mtime"]
                hist_mtime = (
                    hist_files[key].get("mtime")
                    if isinstance(hist_files[key], dict)
                    else None
                )
                if hist_mtime and abs(curr_mtime - hist_mtime) > 1:
                    changes.append(
                        {
                            "type": f"{FileChecker.REQUIRED_FILES[key]}已更新",
                            "reason": f"{FileChecker.REQUIRED_FILES[key]}修改时间有变化",
                            "modified_at": datetime.fromtimestamp(curr_mtime).strftime(
                                "%Y-%m-%d %H:%M:%S"
                            ),
                        }
                    )

        return changes


class ClipPointChecker:
    @staticmethod
    def check_duplicates(clip_points_path):
        if not clip_points_path or not os.path.exists(clip_points_path):
            return {"has_duplicates": False, "details": "无剪辑点文件"}

        duplicates = []
        try:
            with open(clip_points_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]

            seen = defaultdict(list)
            for i, line in enumerate(lines, 1):
                key = line.split(",")[0].strip() if "," in line else line.strip()
                if key and not key.startswith("#"):
                    seen[key].append(i)

            for key, line_nums in seen.items():
                if len(line_nums) > 1:
                    duplicates.append(
                        {"clip_key": key, "line_numbers": line_nums, "count": len(line_nums)}
                    )

        except Exception as e:
            return {"has_duplicates": False, "details": f"读取剪辑点文件失败: {str(e)}"}

        return {
            "has_duplicates": len(duplicates) > 0,
            "count": len(duplicates),
            "details": duplicates,
        }


class StatusJudge:
    @staticmethod
    def judge(file_check_result, changes, clip_check_result, history_record, force=False):
        reasons = []
        next_steps = []
        status = RecordingStatus.PENDING

        if file_check_result["missing_files"]:
            missing = file_check_result["missing_files"]
            reasons.append(f"缺少必要文件: {', '.join(missing)}")
            if "嘉宾名单" in missing:
                status = RecordingStatus.NEEDS_GUEST_LIST
                next_steps.append("联系上一班或制作人获取嘉宾名单")
            if "剪辑点清单" in missing:
                next_steps.append("确认剪辑点清单是否已整理")
            if "字幕草稿" in missing:
                next_steps.append("检查字幕草稿是否在其他目录")
            if "录音文件" in missing:
                status = RecordingStatus.BLOCKED
                next_steps.append("必须找到原始录音文件才能继续")

        if clip_check_result.get("has_duplicates"):
            status = RecordingStatus.DUPLICATE_CLIPS
            reasons.append(
                f"发现 {clip_check_result['count']} 处重复剪辑点，需要核对"
            )
            for dup in clip_check_result["details"]:
                reasons.append(
                    f"  - 剪辑点「{dup['clip_key']}」在第 {dup['line_numbers']} 行重复出现 {dup['count']} 次"
                )
            next_steps.append("去重：与制作人确认保留哪个版本")
            next_steps.append("标记删除重复的剪辑点条目")

        subtitle_modified = any(
            c["type"] == "字幕草稿已修改" for c in changes
        )
        if subtitle_modified:
            status = RecordingStatus.DRAFT_REVIEW
            reasons.append("字幕草稿有新改动，需要审核修改内容")
            for c in changes:
                if c["type"] == "字幕草稿已修改":
                    reasons.append(f"  - 修改时间: {c['modified_at']}")
            next_steps.append("打开字幕草稿逐段核对修改内容")
            next_steps.append("确认修改是修正还是新增内容")

        if (
            not file_check_result["missing_files"]
            and not clip_check_result.get("has_duplicates")
            and not subtitle_modified
        ):
            prev_status = history_record.get("status") if history_record else None
            if prev_status == RecordingStatus.COMPLETED and not force:
                status = RecordingStatus.COMPLETED
                reasons.append("该会议录音已完成上线，无需重复处理")
                next_steps.append("确认无需重新剪辑，直接跳过")
            elif history_record and prev_status == RecordingStatus.READY_FOR_CUT:
                status = RecordingStatus.READY_FOR_CUT
                reasons.append("材料齐全且无变化，保持可剪辑状态")
                next_steps.append("按顺序进入剪辑环节")
            else:
                status = RecordingStatus.READY_FOR_CUT
                reasons.append("材料齐全，无重复剪辑点，字幕无改动，可以进入剪辑")
                next_steps.append("安排剪辑时间")
                next_steps.append("导出上线清单备用")

        if not reasons:
            reasons.append("状态待确认，需要人工检查")
            next_steps.append("人工复核所有材料")

        return {
            "status": status,
            "reasons": reasons,
            "next_steps": next_steps,
        }


class HistoryManager:
    def __init__(self, history_file=".meeting_history.json"):
        self.history_file = history_file
        self.history = self._load()

    def _load(self):
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save(self):
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)

    def get_recording_id(self, dir_path):
        abs_path = os.path.abspath(dir_path)
        dir_name = os.path.basename(abs_path)
        return hashlib.md5(abs_path.encode()).hexdigest()[:12] + "_" + dir_name

    def get_history(self, recording_id):
        return self.history.get(recording_id, {})

    def is_already_completed(self, recording_id):
        rec = self.history.get(recording_id, {})
        return rec.get("status") == RecordingStatus.COMPLETED

    def update_record(self, recording_id, data, is_reprocess=False):
        existing = self.history.get(recording_id, {})
        prev_runs = existing.get("run_history", [])

        current_run = {
            "run_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "is_reprocess": is_reprocess,
            "status_before": existing.get("status", "首次处理"),
            "status_after": data.get("status"),
        }

        if data.get("status") == RecordingStatus.COMPLETED and existing.get(
            "status"
        ) == RecordingStatus.COMPLETED:
            existing["last_checked"] = current_run["run_time"]
            if "skip_count" not in existing:
                existing["skip_count"] = 0
            existing["skip_count"] += 1
        else:
            existing.update(data)
            existing["last_updated"] = current_run["run_time"]
            existing["first_processed"] = existing.get(
                "first_processed", current_run["run_time"]
            )

        prev_runs.append(current_run)
        existing["run_history"] = prev_runs[-20:]

        for key in ["subtitle_draft", "clip_points", "guest_list", "recording"]:
            if key in data.get("file_details", {}):
                fp = data["file_details"][key]["path"]
                data["file_details"][key]["hash"] = ChangeDetector.file_hash(fp)

        self.history[recording_id] = existing
        self.save()
        return existing


class ReportGenerator:
    @staticmethod
    def generate_report(recording_id, judgment, file_check, changes, clip_check, history):
        lines = []
        lines.append("=" * 60)
        lines.append(f"会议录音索引报告 - {recording_id}")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")

        lines.append(f"【当前状态】{judgment['status']}")
        lines.append("")

        lines.append("--- 判断理由 ---")
        for i, reason in enumerate(judgment["reasons"], 1):
            lines.append(f"{i}. {reason}")
        lines.append("")

        lines.append("--- 下一步操作 ---")
        for i, step in enumerate(judgment["next_steps"], 1):
            lines.append(f"{i}. {step}")
        lines.append("")

        lines.append("--- 文件检查 ---")
        if file_check["missing_files"]:
            lines.append("缺失文件:")
            for f in file_check["missing_files"]:
                lines.append(f"  ❌ {f}")
        else:
            lines.append("✅ 所有必要文件齐全")
            for key, info in file_check["file_details"].items():
                desc = FileChecker.REQUIRED_FILES[key]
                mtime = datetime.fromtimestamp(info["mtime"]).strftime("%Y-%m-%d %H:%M")
                lines.append(f"  - {desc}: {os.path.basename(info['path'])} ({mtime})")
        lines.append("")

        lines.append("--- 变更检测 ---")
        if changes:
            for c in changes:
                icon = "⚠️ " if "修改" in c["type"] or "更新" in c["type"] else "ℹ️ "
                lines.append(f"{icon}{c['type']}: {c['reason']}")
        else:
            lines.append("ℹ️ 无变更记录")
        lines.append("")

        if clip_check.get("has_duplicates"):
            lines.append("--- 重复剪辑点警告 ---")
            lines.append(f"❌ 发现 {clip_check['count']} 处重复:")
            for dup in clip_check["details"]:
                lines.append(
                    f"  - 「{dup['clip_key']}」出现 {dup['count']} 次 (行: {dup['line_numbers']})"
                )
            lines.append("")

        if history:
            lines.append("--- 历史记录 ---")
            lines.append(f"首次处理: {history.get('first_processed', 'N/A')}")
            lines.append(f"上次更新: {history.get('last_updated', 'N/A')}")
            if "skip_count" in history:
                lines.append(f"重复跳过次数: {history['skip_count']}")
            lines.append(f"历史状态: {history.get('status', '无')}")
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def generate_deployment_list(all_results, output_file="上线清单.txt"):
        lines = []
        lines.append("=" * 60)
        lines.append("播客上线清单")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")

        by_status = defaultdict(list)
        for result in all_results:
            by_status[result["status"]].append(result)

        lines.append(f"【可进入剪辑】共 {len(by_status[RecordingStatus.READY_FOR_CUT])} 条")
        lines.append("-" * 40)
        for r in by_status[RecordingStatus.READY_FOR_CUT]:
            lines.append(f"  □ {r['recording_id']}")
            lines.append(f"     说明: {r['reasons'][0] if r['reasons'] else '待确认'}")
        lines.append("")

        lines.append(f"【阻塞中】共 {len(by_status[RecordingStatus.BLOCKED])} 条")
        lines.append("-" * 40)
        for r in by_status[RecordingStatus.BLOCKED]:
            lines.append(f"  ⚠️  {r['recording_id']}")
            lines.append(f"     原因: {r['reasons'][0] if r['reasons'] else '未知'}")
            lines.append(f"     下一步: {r['next_steps'][0] if r['next_steps'] else ''}")
        lines.append("")

        lines.append(f"【待处理】共 {len(by_status[RecordingStatus.PENDING])} 条")
        lines.append("-" * 40)
        for r in by_status[RecordingStatus.PENDING]:
            lines.append(f"  ⏳ {r['recording_id']}")
            lines.append(f"     说明: {r['reasons'][0] if r['reasons'] else '待确认'}")
        lines.append("")

        other = [
            s
            for s in by_status
            if s
            not in [
                RecordingStatus.READY_FOR_CUT,
                RecordingStatus.BLOCKED,
                RecordingStatus.PENDING,
            ]
        ]
        for status in other:
            lines.append(f"【{status}】共 {len(by_status[status])} 条")
            lines.append("-" * 40)
            for r in by_status[status]:
                lines.append(f"  {r['recording_id']}")
                lines.append(f"     原因: {r['reasons'][0] if r['reasons'] else ''}")
            lines.append("")

        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return "\n".join(lines)


class MeetingIndexer:
    def __init__(self, history_file=".meeting_history.json"):
        self.history_manager = HistoryManager(history_file)
        self.results = []

    def process_directory(self, dir_path, force=False):
        recording_id = self.history_manager.get_recording_id(dir_path)
        history = self.history_manager.get_history(recording_id)

        if not force and self.history_manager.is_already_completed(recording_id):
            file_check = FileChecker.check_directory(dir_path)
            judgment = {
                "status": RecordingStatus.COMPLETED,
                "reasons": ["该会议录音已完成上线，重复导入自动跳过"],
                "next_steps": ["无需操作，确认后标记为已处理即可"],
            }
            changes = []
            clip_check = {"has_duplicates": False}
            record_data = {
                "status": RecordingStatus.COMPLETED,
                "reasons": judgment["reasons"],
                "next_steps": judgment["next_steps"],
                "file_check": file_check,
                "file_details": file_check["file_details"],
            }
            history = self.history_manager.update_record(
                recording_id, record_data, is_reprocess=True
            )
        else:
            file_check = FileChecker.check_directory(dir_path)

            subtitle_path = None
            if "subtitle_draft" in file_check["file_details"]:
                subtitle_path = file_check["file_details"]["subtitle_draft"]["path"]

            clip_path = None
            if "clip_points" in file_check["file_details"]:
                clip_path = file_check["file_details"]["clip_points"]["path"]

            changes = ChangeDetector.detect_subtitle_changes(file_check, history)

            clip_check = ClipPointChecker.check_duplicates(clip_path)

            is_reprocess = bool(history)
            judgment = StatusJudge.judge(
                file_check, changes, clip_check, history, force=force
            )

            record_data = {
                "status": judgment["status"],
                "reasons": judgment["reasons"],
                "next_steps": judgment["next_steps"],
                "file_check": file_check,
                "file_details": file_check["file_details"],
                "changes": changes,
                "clip_check": clip_check,
            }

            history = self.history_manager.update_record(
                recording_id, record_data, is_reprocess=is_reprocess
            )

        report = ReportGenerator.generate_report(
            recording_id, judgment, file_check, changes, clip_check, history
        )

        result = {
            "recording_id": recording_id,
            "dir_path": dir_path,
            "status": judgment["status"],
            "reasons": judgment["reasons"],
            "next_steps": judgment["next_steps"],
            "report": report,
        }
        self.results.append(result)
        return result

    def process_batch(self, directories, force=False):
        self.results = []
        for d in directories:
            result = self.process_directory(d, force=force)
            print(result["report"])
            print("\n")
        return self.results

    def export_deployment_list(self, output_file="上线清单.txt"):
        return ReportGenerator.generate_deployment_list(self.results, output_file)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="会议录音索引系统")
    parser.add_argument("directories", nargs="+", help="会议录音目录路径")
    parser.add_argument(
        "--force", action="store_true", help="强制重新处理已完成的录音"
    )
    parser.add_argument("--output", default="上线清单.txt", help="上线清单输出路径")
    parser.add_argument(
        "--history", default=".meeting_history.json", help="历史记录文件路径"
    )
    args = parser.parse_args()

    indexer = MeetingIndexer(history_file=args.history)
    indexer.process_batch(args.directories, force=args.force)
    print(indexer.export_deployment_list(args.output))
    print(f"\n\n上线清单已导出到: {os.path.abspath(args.output)}")


if __name__ == "__main__":
    main()
