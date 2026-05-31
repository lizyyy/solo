#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import hashlib
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum


class ChangeType(Enum):
    NORMAL = "正常"
    MATERIAL_SUPPLEMENT = "补材料"
    DUPLICATE_EXECUTION = "重复执行"
    REPORT_INCONSISTENT = "报告文件不一致"
    PATH_WITH_SPACE = "路径含空格"
    MANUAL_CHANGE = "手工改动"
    PENDING_CONFIRM = "待确认"


@dataclass
class ConfigRecord:
    file_path: str
    file_name: str
    content_hash: str
    modify_time: datetime
    file_size: int
    source: str = ""
    change_order_id: str = ""

    def to_dict(self) -> Dict:
        data = asdict(self)
        data["modify_time"] = self.modify_time.isoformat()
        return data


@dataclass
class DriftResult:
    file_path: str
    change_type: ChangeType
    reason: str
    next_step: str
    is_controversial: bool = False
    evidence: Dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict:
        data = asdict(self)
        data["change_type"] = self.change_type.value
        data["timestamp"] = self.timestamp.isoformat()
        return data


class ConfigDriftScanner:
    def __init__(self, baseline_path: Optional[str] = None):
        self.baseline: Dict[str, ConfigRecord] = {}
        self.execution_history: List[Dict] = []
        self.baseline_path = baseline_path or "config_baseline.json"
        self.history_path = "execution_history.json"
        self._load_baseline()
        self._load_history()

    def _load_baseline(self):
        if os.path.exists(self.baseline_path):
            try:
                with open(self.baseline_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for path, record in data.items():
                        self.baseline[path] = ConfigRecord(
                            file_path=record["file_path"],
                            file_name=record["file_name"],
                            content_hash=record["content_hash"],
                            modify_time=datetime.fromisoformat(record["modify_time"]),
                            file_size=record["file_size"],
                            source=record.get("source", ""),
                            change_order_id=record.get("change_order_id", "")
                        )
            except Exception as e:
                print(f"加载基线失败: {e}")

    def _save_baseline(self):
        data = {path: record.to_dict() for path, record in self.baseline.items()}
        with open(self.baseline_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_history(self):
        if os.path.exists(self.history_path):
            try:
                with open(self.history_path, 'r', encoding='utf-8') as f:
                    self.execution_history = json.load(f)
            except Exception as e:
                print(f"加载执行历史失败: {e}")

    def _save_history(self):
        with open(self.history_path, 'w', encoding='utf-8') as f:
            json.dump(self.execution_history, f, ensure_ascii=False, indent=2)

    @staticmethod
    def _calculate_file_hash(file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _has_path_with_space(self, file_path: str) -> bool:
        return ' ' in file_path

    @staticmethod
    def _normalize_path(path: str) -> str:
        return os.path.normpath(path)
    
    def _is_duplicate_execution(self, file_path: str, current_hash: str) -> Tuple[bool, Dict]:
        normalized_path = self._normalize_path(file_path)
        for exec_record in self.execution_history[-5:]:
            if self._normalize_path(exec_record.get("file_path", "")) == normalized_path:
                if exec_record.get("content_hash") != current_hash:
                    return True, {
                        "previous_hash": exec_record.get("content_hash"),
                        "current_hash": current_hash,
                        "previous_time": exec_record.get("timestamp")
                    }
        return False, {}

    def _check_report_consistency(self, file_path: str, current_record: ConfigRecord) -> Tuple[bool, Dict]:
        report_file = None
        report_dir = os.path.dirname(file_path)
        for f in os.listdir(report_dir) if os.path.exists(report_dir) else []:
            if f.endswith(('.report', '.log', '.txt')) and 'report' in f.lower():
                report_file = os.path.join(report_dir, f)
                break
        
        if report_file and os.path.exists(report_file):
            try:
                with open(report_file, 'r', encoding='utf-8', errors='ignore') as f:
                    report_content = f.read()
                    if current_record.file_name not in report_content:
                        return True, {
                            "report_file": report_file,
                            "issue": "报告中未提及此配置文件"
                        }
            except:
                pass
        return False, {}

    def _detect_change_type(self, current_record: ConfigRecord, baseline_record: Optional[ConfigRecord]) -> DriftResult:
        file_path = current_record.file_path
        
        if self._has_path_with_space(file_path):
            return DriftResult(
                file_path=file_path,
                change_type=ChangeType.PATH_WITH_SPACE,
                reason=f"文件路径包含空格: {file_path}，可能导致脚本执行异常",
                next_step="请确认路径正确性，考虑重命名文件夹或使用引号包裹路径",
                is_controversial=False,
                evidence={"path": file_path, "has_space": True}
            )

        report_inconsistent, report_evidence = self._check_report_consistency(file_path, current_record)
        if report_inconsistent:
            return DriftResult(
                file_path=file_path,
                change_type=ChangeType.REPORT_INCONSISTENT,
                reason=f"配置报告与真实文件不一致: {report_evidence.get('issue', '未知原因')}",
                next_step="请人工核对配置文件和变更报告内容是否一致",
                is_controversial=True,
                evidence=report_evidence
            )

        is_duplicate, dup_evidence = self._is_duplicate_execution(file_path, current_record.content_hash)
        if is_duplicate:
            return DriftResult(
                file_path=file_path,
                change_type=ChangeType.DUPLICATE_EXECUTION,
                reason="重复执行导致内容变更，本次执行结果与上次记录不一致",
                next_step="立即标记为待确认，联系研发确认是否需要回滚",
                is_controversial=True,
                evidence=dup_evidence
            )

        if baseline_record is None:
            return DriftResult(
                file_path=file_path,
                change_type=ChangeType.MATERIAL_SUPPLEMENT,
                reason="这是新出现的配置文件，可能是凌晨补材料",
                next_step="核对变更单，确认此文件是否在计划变更范围内",
                is_controversial=False,
                evidence={"status": "new_file"}
            )

        time_diff = (current_record.modify_time - baseline_record.modify_time).total_seconds()
        
        if time_diff < 0:
            return DriftResult(
                file_path=file_path,
                change_type=ChangeType.MATERIAL_SUPPLEMENT,
                reason="配置文件修改时间早于基线记录，属于补材料（文件早到）",
                next_step="确认是否为历史文件误提交，无需处理请标记为正常",
                is_controversial=False,
                evidence={
                    "baseline_time": baseline_record.modify_time.isoformat(),
                    "current_time": current_record.modify_time.isoformat(),
                    "time_diff_seconds": time_diff
                }
            )

        if current_record.content_hash != baseline_record.content_hash:
            if time_diff > 3600:
                return DriftResult(
                    file_path=file_path,
                    change_type=ChangeType.MANUAL_CHANGE,
                    reason=f"内容哈希值不一致，且修改时间间隔{int(time_diff/3600)}小时，疑似手工改动",
                    next_step="请对照变更单确认此变更是否经过审批",
                    is_controversial=True,
                    evidence={
                        "baseline_hash": baseline_record.content_hash,
                        "current_hash": current_record.content_hash,
                        "time_diff_hours": int(time_diff/3600)
                    }
                )
            else:
                return DriftResult(
                    file_path=file_path,
                    change_type=ChangeType.PENDING_CONFIRM,
                    reason="内容发生变更但时间在1小时内，无法确定是正常变更还是误操作",
                    next_step="请值班人员人工确认变更内容是否符合预期",
                    is_controversial=True,
                    evidence={
                        "baseline_hash": baseline_record.content_hash,
                        "current_hash": current_record.content_hash,
                        "time_diff_seconds": time_diff
                    }
                )

        return DriftResult(
            file_path=file_path,
            change_type=ChangeType.NORMAL,
            reason="配置文件与基线一致，无异常",
            next_step="无需处理",
            is_controversial=False,
            evidence={"status": "matched"}
        )

    def scan_directory(self, directory: str, file_extensions: List[str] = None) -> List[DriftResult]:
        if file_extensions is None:
            file_extensions = ['.conf', '.yaml', '.yml', '.json', '.properties', '.ini']
        
        results = []
        scanned_files = []

        for root, _, files in os.walk(directory):
            for file in files:
                if any(file.endswith(ext) for ext in file_extensions):
                    file_path = os.path.join(root, file)
                    try:
                        stat = os.stat(file_path)
                        current_record = ConfigRecord(
                            file_path=file_path,
                            file_name=file,
                            content_hash=self._calculate_file_hash(file_path),
                            modify_time=datetime.fromtimestamp(stat.st_mtime),
                            file_size=stat.st_size
                        )
                        scanned_files.append(file_path)
                        
                        baseline_record = self.baseline.get(file_path)
                        result = self._detect_change_type(current_record, baseline_record)
                        results.append(result)
                        
                        self.baseline[file_path] = current_record
                        
                    except Exception as e:
                        results.append(DriftResult(
                            file_path=file_path,
                            change_type=ChangeType.PENDING_CONFIRM,
                            reason=f"扫描文件时出错: {str(e)}",
                            next_step="请检查文件权限或文件是否损坏",
                            is_controversial=True,
                            evidence={"error": str(e)}
                        ))

        for path in list(self.baseline.keys()):
            if path not in scanned_files and os.path.exists(path):
                pass

        self._save_baseline()
        return results

    def record_execution(self, file_path: str, content_hash: str):
        self.execution_history.append({
            "file_path": file_path,
            "content_hash": content_hash,
            "timestamp": datetime.now().isoformat()
        })
        self._save_history()

    def generate_report(self, results: List[DriftResult], output_file: str = "drift_report.md") -> str:
        normal_count = sum(1 for r in results if r.change_type == ChangeType.NORMAL)
        supplement_count = sum(1 for r in results if r.change_type == ChangeType.MATERIAL_SUPPLEMENT)
        duplicate_count = sum(1 for r in results if r.change_type == ChangeType.DUPLICATE_EXECUTION)
        inconsistent_count = sum(1 for r in results if r.change_type == ChangeType.REPORT_INCONSISTENT)
        path_space_count = sum(1 for r in results if r.change_type == ChangeType.PATH_WITH_SPACE)
        manual_count = sum(1 for r in results if r.change_type == ChangeType.MANUAL_CHANGE)
        pending_count = sum(1 for r in results if r.change_type == ChangeType.PENDING_CONFIRM)
        controversial_count = sum(1 for r in results if r.is_controversial)

        report_lines = [
            "# 配置漂移扫描报告",
            "",
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 概览统计",
            "",
            "| 类型 | 数量 |",
            "|------|------|",
            f"| 正常 | {normal_count} |",
            f"| 补材料 | {supplement_count} |",
            f"| 重复执行 | {duplicate_count} |",
            f"| 报告不一致 | {inconsistent_count} |",
            f"| 路径含空格 | {path_space_count} |",
            f"| 手工改动 | {manual_count} |",
            f"| **待确认（需重点关注）** | **{pending_count}** |",
            f"| **有争议记录** | **{controversial_count}** |",
            "",
            "## 异常详情",
            ""
        ]

        abnormal_results = [r for r in results if r.change_type != ChangeType.NORMAL]
        
        for result in sorted(abnormal_results, key=lambda x: x.is_controversial, reverse=True):
            report_lines.extend([
                f"### {'⚠️ 有争议 - ' if result.is_controversial else ''}{result.change_type.value}",
                "",
                f"**文件路径**: `{result.file_path}`",
                "",
                f"**判定原因**: {result.reason}",
                "",
                f"**下一步操作**: {result.next_step}",
                "",
                "**复核证据**:",
                "```json",
                json.dumps(result.evidence, ensure_ascii=False, indent=2),
                "```",
                ""
            ])

        if controversial_count > 0:
            report_lines.extend([
                "## 值班提醒",
                "",
                "⚠️ **重要**: 以上标记为「有争议」的记录，请务必人工复核后再决定是否放行！",
                "特别是「重复执行改坏结果」和「报告与真实文件不一致」的情况，",
                "请联系研发人员和变更申请人双确认。",
                ""
            ])

        report_content = "\n".join(report_lines)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return report_content
