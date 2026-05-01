#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
脱敏器模块
按配置对敏感信息进行脱敏处理，不修改原始证据
"""

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .config import CaseConfig, EvidenceRecord, EvidenceType, RedactionRule
from .hasher import Hasher


class Redactor:
    """敏感信息脱敏器"""

    def __init__(self, config: CaseConfig):
        self.config = config
        self._redaction_log: List[Dict] = []

    def _get_active_rules(self) -> List[RedactionRule]:
        """获取启用的脱敏规则"""
        rules = [r for r in self.config.redaction_rules if r.enabled]

        for keyword in self.config.custom_redaction_keywords:
            rules.append(RedactionRule(
                name=f"自定义关键词: {keyword}",
                pattern=re.escape(keyword),
                replacement="[REDACTED]",
                enabled=True,
            ))

        return rules

    def redact_text(self, text: str) -> Tuple[str, List[Dict]]:
        """
        对文本进行脱敏

        Args:
            text: 原始文本

        Returns:
            (脱敏后文本, 脱敏记录列表) 元组
        """
        redacted_text = text
        redaction_records = []

        rules = self._get_active_rules()

        for rule in rules:
            try:
                pattern = re.compile(rule.pattern)
                matches = list(pattern.finditer(redacted_text))

                for match in reversed(matches):
                    original = match.group(0)
                    start = match.start()
                    end = match.end()

                    redacted_text = (
                        redacted_text[:start] +
                        rule.replacement +
                        redacted_text[end:]
                    )

                    redaction_records.append({
                        "rule_name": rule.name,
                        "original": original,
                        "replacement": rule.replacement,
                        "position": {"start": start, "end": end},
                    })

            except re.error as e:
                redaction_records.append({
                    "rule_name": rule.name,
                    "error": f"正则表达式错误: {str(e)}",
                    "skipped": True,
                })

        return redacted_text, redaction_records

    def redact_file(
        self,
        source_path: str,
        output_path: str,
    ) -> Dict:
        """
        对单个文件进行脱敏

        Args:
            source_path: 源文件路径
            output_path: 输出文件路径

        Returns:
            脱敏结果字典
        """
        source = Path(source_path)
        if not source.exists():
            return {
                "success": False,
                "error": f"源文件不存在: {source_path}",
            }

        result = {
            "source_path": source_path,
            "output_path": output_path,
            "original_hash": Hasher.compute_file_hash(source_path),
            "redaction_count": 0,
            "redactions": [],
            "success": True,
        }

        ext = source.suffix.lower()

        if ext in [".txt", ".html", ".htm", ".har", ".json", ".mhtml", ".mht"]:
            try:
                with open(source, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                redacted_content, redactions = self.redact_text(content)

                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(redacted_content)

                result["redaction_count"] = len(redactions)
                result["redactions"] = redactions
                result["redacted_hash"] = Hasher.compute_file_hash(output_path)

            except Exception as e:
                result["success"] = False
                result["error"] = str(e)

        elif ext in [".png", ".jpg", ".jpeg", ".pdf"]:
            try:
                shutil.copy2(source_path, output_path)
                result["warning"] = "二进制文件（图片/PDF）无法自动脱敏，已原样复制"
                result["redacted_hash"] = result["original_hash"]
            except Exception as e:
                result["success"] = False
                result["error"] = str(e)

        else:
            try:
                shutil.copy2(source_path, output_path)
                result["warning"] = f"不支持的文件类型 '{ext}'，已原样复制"
                result["redacted_hash"] = result["original_hash"]
            except Exception as e:
                result["success"] = False
                result["error"] = str(e)

        if result["success"]:
            self._redaction_log.append({
                "timestamp": datetime.now().isoformat(),
                "source": source_path,
                "output": output_path,
                "redaction_count": result["redaction_count"],
                "original_hash": result["original_hash"],
            })

        return result

    def redact_evidence(
        self,
        evidence_records: List[EvidenceRecord],
        output_dir: str,
    ) -> Dict:
        """
        对证据记录列表进行脱敏

        Args:
            evidence_records: 证据记录列表
            output_dir: 输出目录

        Returns:
            脱敏结果汇总
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        results = {
            "total_files": len(evidence_records),
            "success_count": 0,
            "error_count": 0,
            "total_redactions": 0,
            "files_with_redactions": 0,
            "details": [],
            "output_dir": str(output_path.absolute()),
        }

        for record in evidence_records:
            source_file = Path(record.file_path)

            relative_path = source_file.name
            if record.stored_filename:
                relative_path = record.stored_filename

            dest_path = output_path / relative_path

            result = self.redact_file(
                str(source_file.absolute()),
                str(dest_path.absolute()),
            )

            result["evidence_id"] = record.evidence_id
            result["original_filename"] = record.original_filename
            results["details"].append(result)

            if result["success"]:
                results["success_count"] += 1
                results["total_redactions"] += result.get("redaction_count", 0)
                if result.get("redaction_count", 0) > 0:
                    results["files_with_redactions"] += 1
            else:
                results["error_count"] += 1

        return results

    def save_redaction_log(self, output_path: str) -> None:
        """
        保存脱敏日志

        Args:
            output_path: 输出文件路径
        """
        log = {
            "generated_at": datetime.now().isoformat(),
            "total_operations": len(self._redaction_log),
            "operations": self._redaction_log,
        }

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(log, f, ensure_ascii=False, indent=2)

    def get_redaction_summary(self) -> Dict:
        """
        获取脱敏操作摘要

        Returns:
            摘要信息字典
        """
        rules = self._get_active_rules()

        return {
            "active_rules_count": len(rules),
            "active_rules": [
                {
                    "name": r.name,
                    "pattern": r.pattern,
                    "replacement": r.replacement,
                }
                for r in rules
            ],
            "total_operations": len(self._redaction_log),
            "operations": self._redaction_log[-10:] if len(self._redaction_log) > 10 else self._redaction_log,
        }
