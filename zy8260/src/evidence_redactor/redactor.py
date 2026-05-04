import csv
import json
import re
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from evidence_redactor.models import (
    Participant,
    RedactionMap,
    RedactionRule,
    RedactRulesLoader,
    RoleType,
)


class RedactorEngine:
    DEFAULT_RULES = [
        RedactionRule(
            id="DEFAULT-ID-1",
            rule_type="id_card",
            pattern=r"\b(\d{6})\d{8}(\d{4})\b",
            replacement=r"\1********\2",
            description="身份证号脱敏 - 保留前6后4",
            enabled=True,
            priority=10,
        ),
        RedactionRule(
            id="DEFAULT-ID-2",
            rule_type="id_card",
            pattern=r"\b(\d{6})\d{8}([0-9Xx])\b",
            replacement=r"\1********\2",
            description="15位转18位身份证号",
            enabled=True,
            priority=10,
        ),
        RedactionRule(
            id="DEFAULT-PHONE-1",
            rule_type="phone",
            pattern=r"\b(\d{3})\d{4}(\d{4})\b",
            replacement=r"\1****\2",
            description="手机号脱敏 - 保留前3后4",
            enabled=True,
            priority=9,
        ),
        RedactionRule(
            id="DEFAULT-ADDRESS-1",
            rule_type="address",
            pattern=r"([省市区县乡镇街道]+)[^\s\n]{5,}(路|街|号|弄|园|村|大厦|楼)[^\s\n]{0,10}",
            replacement=r"\1***\2***",
            description="地址敏感信息脱敏",
            enabled=True,
            priority=8,
        ),
    ]

    def __init__(
        self,
        rules: Optional[list[RedactionRule]] = None,
        participants: Optional[list[Participant]] = None,
        role: RoleType = RoleType.JUDGE,
        verbose: bool = False,
    ):
        self.rules = rules or []
        self.participants = participants or []
        self.role = role
        self.verbose = verbose
        self.redaction_maps: list[RedactionMap] = []

        if not self.rules:
            if self.verbose:
                print("使用默认脱敏规则")
            self.rules = self.DEFAULT_RULES

        self._build_dynamic_patterns()

    def _build_dynamic_patterns(self):
        if self.role != RoleType.JUDGE:
            unauthorized_names = [
                p.name for p in self.participants
                if p.is_witness and not p.is_authorized
            ]

            for name in unauthorized_names:
                if len(name) >= 2:
                    if len(name) == 2:
                        replacement = name[0] + "*"
                    else:
                        replacement = name[0] + "*" * (len(name) - 2) + name[-1]

                    self.rules.append(RedactionRule(
                        id=f"DYNAMIC-WITNESS-{name}",
                        rule_type="witness_name",
                        pattern=re.escape(name),
                        replacement=replacement,
                        description=f"未授权证人姓名: {name}",
                        enabled=True,
                        priority=15,
                    ))

        if self.role == RoleType.PLAINTIFF or self.role == RoleType.DEFENDANT:
            other_role = RoleType.DEFENDANT if self.role == RoleType.PLAINTIFF else RoleType.PLAINTIFF
            other_role_names = [
                p.name for p in self.participants
                if p.role == other_role.value
            ]

            for name in other_role_names:
                if len(name) >= 2:
                    if len(name) == 2:
                        replacement = name[0] + "*"
                    else:
                        replacement = name[0] + "*" * (len(name) - 2) + name[-1]

                    self.rules.append(RedactionRule(
                        id=f"DYNAMIC-ROLE-{name}",
                        rule_type="role_name",
                        pattern=re.escape(name),
                        replacement=replacement,
                        description=f"对方当事人姓名: {name}",
                        enabled=True,
                        priority=14,
                    ))

    def redact_text(
        self,
        text: str,
        file_path: str = "",
        line_number: Optional[int] = None,
    ) -> tuple[str, int]:
        if not text:
            return text, 0

        result = text
        total_replacements = 0

        sorted_rules = sorted(
            [r for r in self.rules if r.enabled],
            key=lambda x: (-x.priority, len(x.pattern)),
        )

        for rule in sorted_rules:
            try:
                matches = list(re.finditer(rule.pattern, result))
                if matches:
                    offset = 0
                    for match in matches:
                        start = match.start() + offset
                        end = match.end() + offset
                        original = match.group(0)
                        
                        replacement = rule.replacement
                        if r"\1" in replacement or r"\2" in replacement:
                            replacement = match.expand(replacement)
                        
                        context = self._get_context(result, match.start())
                        
                        if original != replacement:
                            redaction_map = RedactionMap(
                                original=original,
                                redacted=replacement,
                                context=context,
                                rule_id=rule.id,
                                file_path=file_path,
                                line_number=line_number,
                                char_offset=match.start(),
                                timestamp=datetime.now(),
                            )
                            self.redaction_maps.append(redaction_map)
                            
                            result = result[:start] + replacement + result[end:]
                            offset += len(replacement) - len(original)
                            total_replacements += 1

            except re.error as e:
                if self.verbose:
                    print(f"规则 {rule.id} 正则表达式错误: {e}")

        return result, total_replacements

    def _get_context(self, text: str, position: int, context_size: int = 30) -> str:
        start = max(0, position - context_size)
        end = min(len(text), position + context_size)
        context = text[start:end]
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."
        return context

    def redact_file(
        self,
        input_path: Path,
        output_path: Optional[Path] = None,
    ) -> tuple[int, dict[str, Any]]:
        if not input_path.exists():
            raise FileNotFoundError(f"文件不存在: {input_path}")

        ext = input_path.suffix.lower()
        total_replacements = 0
        result_data: dict[str, Any] = {"file_type": ext}

        if ext == ".txt":
            total_replacements = self._redact_txt(input_path, output_path)
        elif ext == ".csv":
            total_replacements = self._redact_csv(input_path, output_path)
        elif ext == ".json":
            total_replacements = self._redact_json(input_path, output_path)
        else:
            if self.verbose:
                print(f"不支持的文件类型，直接复制: {ext}")
            if output_path:
                import shutil
                shutil.copy2(input_path, output_path)

        result_data["replacements"] = total_replacements
        return total_replacements, result_data

    def _redact_txt(self, input_path: Path, output_path: Optional[Path]) -> int:
        total_replacements = 0
        lines = []

        with open(input_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                redacted_line, count = self.redact_text(
                    line, str(input_path), line_num
                )
                lines.append(redacted_line)
                total_replacements += count

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.writelines(lines)

        return total_replacements

    def _redact_csv(self, input_path: Path, output_path: Optional[Path]) -> int:
        total_replacements = 0
        rows: list[list[str]] = []

        with open(input_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            for line_num, row in enumerate(reader, 1):
                redacted_row = []
                for cell in row:
                    redacted_cell, count = self.redact_text(
                        cell, str(input_path), line_num
                    )
                    redacted_row.append(redacted_cell)
                    total_replacements += count
                rows.append(redacted_row)

        if output_path:
            with open(output_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerows(rows)

        return total_replacements

    def _redact_json(self, input_path: Path, output_path: Optional[Path]) -> int:
        total_replacements = 0

        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        def redact_value(value: Any, path: str = "") -> Any:
            nonlocal total_replacements
            if isinstance(value, str):
                redacted, count = self.redact_text(value, str(input_path))
                total_replacements += count
                return redacted
            elif isinstance(value, dict):
                return {k: redact_value(v, f"{path}.{k}") for k, v in value.items()}
            elif isinstance(value, list):
                return [redact_value(v, f"{path}[{i}]") for i, v in enumerate(value)]
            else:
                return value

        data = redact_value(data)

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        return total_replacements

    def get_redaction_mapping(self) -> list[dict[str, Any]]:
        result = []
        for rm in self.redaction_maps:
            d = asdict(rm)
            if isinstance(d.get("timestamp"), datetime):
                d["timestamp"] = d["timestamp"].isoformat()
            result.append(d)
        return result

    def get_statistics(self) -> dict[str, Any]:
        by_rule: dict[str, int] = {}
        by_file: dict[str, int] = {}
        by_type: dict[str, int] = {}

        for rm in self.redaction_maps:
            by_rule[rm.rule_id] = by_rule.get(rm.rule_id, 0) + 1
            by_file[rm.file_path] = by_file.get(rm.file_path, 0) + 1
            
            rule_type = "unknown"
            if "ID" in rm.rule_id:
                rule_type = "id_card"
            elif "PHONE" in rm.rule_id:
                rule_type = "phone"
            elif "ADDRESS" in rm.rule_id:
                rule_type = "address"
            elif "WITNESS" in rm.rule_id:
                rule_type = "witness_name"
            elif "ROLE" in rm.rule_id:
                rule_type = "role_name"
            
            by_type[rule_type] = by_type.get(rule_type, 0) + 1

        return {
            "total": len(self.redaction_maps),
            "by_rule": by_rule,
            "by_file": by_file,
            "by_type": by_type,
        }
