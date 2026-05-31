from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class SourceType(Enum):
    RESULT_FIGURE = "结果图"
    EXPERIMENTAL_DATA = "实验数据"
    CONSTRAINT_SPEC = "约束说明"
    MANUAL_INPUT = "手工录入"


class ChangeType(Enum):
    SUPPLEMENT = "补材料"
    CONCLUSION_CHANGE = "改结论"
    CORRECTION = "修正"
    INITIAL = "初始录入"


@dataclass
class SourceInfo:
    source_type: SourceType
    source_id: str
    description: str
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "source_type": self.source_type.value,
            "source_id": self.source_id,
            "description": self.description,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ChangeRecord:
    change_type: ChangeType
    old_value: Any
    new_value: Any
    source: SourceInfo
    note: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    affects_conclusion: bool = False

    def to_dict(self) -> dict:
        return {
            "change_type": self.change_type.value,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "source": self.source.to_dict(),
            "note": self.note,
            "timestamp": self.timestamp.isoformat(),
            "affects_conclusion": self.affects_conclusion,
        }


@dataclass
class ParamEntry:
    name: str
    value: Any
    unit: str = ""
    source: Optional[SourceInfo] = None
    conclusion: str = ""
    change_history: list[ChangeRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def current_value(self) -> Any:
        return self.value

    @property
    def has_conclusion_changes(self) -> bool:
        return any(
            c.affects_conclusion and c.change_type != ChangeType.INITIAL
            for c in self.change_history
        )

    @property
    def supplement_changes(self) -> list[ChangeRecord]:
        return [c for c in self.change_history if c.change_type == ChangeType.SUPPLEMENT]

    @property
    def conclusion_changes(self) -> list[ChangeRecord]:
        return [
            c
            for c in self.change_history
            if c.affects_conclusion and c.change_type != ChangeType.INITIAL
        ]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "value": self.value,
            "unit": self.unit,
            "source": self.source.to_dict() if self.source else None,
            "conclusion": self.conclusion,
            "change_history": [c.to_dict() for c in self.change_history],
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class DataSource:
    source_id: str
    source_type: SourceType
    description: str
    content: dict
    version: int = 1
    timestamp: datetime = field(default_factory=datetime.now)
    is_current: bool = True

    def to_dict(self) -> dict:
        return {
            "source_id": self.source_id,
            "source_type": self.source_type.value,
            "description": self.description,
            "content": self.content,
            "version": self.version,
            "timestamp": self.timestamp.isoformat(),
            "is_current": self.is_current,
        }


class VersionConflictError(Exception):
    def __init__(self, message: str, conflict_details: dict):
        super().__init__(message)
        self.conflict_details = conflict_details


class ParamTracker:
    def __init__(self, project_name: str = "舆情扩散参数"):
        self.project_name = project_name
        self.params: dict[str, ParamEntry] = {}
        self.data_sources: dict[str, list[DataSource]] = {}
        self.conclusions: dict[str, str] = {}

    def add_param(
        self,
        name: str,
        value: Any,
        unit: str = "",
        source_type: SourceType = SourceType.MANUAL_INPUT,
        source_id: str = "",
        source_description: str = "",
        conclusion: str = "",
    ) -> ParamEntry:
        source = SourceInfo(
            source_type=source_type,
            source_id=source_id,
            description=source_description,
        )
        entry = ParamEntry(
            name=name, value=value, unit=unit, source=source, conclusion=conclusion
        )
        initial_record = ChangeRecord(
            change_type=ChangeType.INITIAL,
            old_value=None,
            new_value=value,
            source=source,
            note="初始录入",
            affects_conclusion=bool(conclusion),
        )
        entry.change_history.append(initial_record)
        self.params[name] = entry
        if conclusion:
            self.conclusions[name] = conclusion
        return entry

    def update_param(
        self,
        name: str,
        new_value: Any,
        source_type: SourceType,
        source_id: str,
        source_description: str = "",
        change_type: ChangeType = ChangeType.SUPPLEMENT,
        note: str = "",
        affects_conclusion: bool = False,
    ) -> ParamEntry:
        if name not in self.params:
            raise KeyError(f"参数 '{name}' 不存在，请先用 add_param 添加")

        entry = self.params[name]
        old_value = entry.value

        source = SourceInfo(
            source_type=source_type,
            source_id=source_id,
            description=source_description,
        )

        record = ChangeRecord(
            change_type=change_type,
            old_value=old_value,
            new_value=new_value,
            source=source,
            note=note,
            affects_conclusion=affects_conclusion,
        )

        entry.change_history.append(record)
        entry.value = new_value
        entry.source = source

        if affects_conclusion:
            entry.conclusion = f"结论因参数变更而更新 ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
            self.conclusions[name] = entry.conclusion

        return entry

    def register_data_source(
        self,
        source_id: str,
        source_type: SourceType,
        description: str,
        content: dict,
        timestamp: Optional[datetime] = None,
    ) -> DataSource:
        new_source = DataSource(
            source_id=source_id,
            source_type=source_type,
            description=description,
            content=content,
        )
        if timestamp:
            new_source.timestamp = timestamp

        if source_id in self.data_sources:
            existing_versions = self.data_sources[source_id]
            latest = existing_versions[-1]

            if new_source.timestamp < latest.timestamp:
                diff = self._compute_diff(latest.content, content)
                new_source.version = latest.version + 1
                for old in existing_versions:
                    old.is_current = False
                new_source.is_current = True
                existing_versions.append(new_source)
                raise VersionConflictError(
                    f"[!] 版本冲突: 数据源 '{source_id}' 补传了更早时间的数据 "
                    f"(新数据时间 {new_source.timestamp.strftime('%Y-%m-%d %H:%M')} < "
                    f"当前最新 {latest.timestamp.strftime('%Y-%m-%d %H:%M')})",
                    {
                        "source_id": source_id,
                        "new_timestamp": new_source.timestamp.isoformat(),
                        "latest_timestamp": latest.timestamp.isoformat(),
                        "diff": diff,
                    },
                )

            new_source.version = latest.version + 1
            for old in existing_versions:
                old.is_current = False
            new_source.is_current = True
            existing_versions.append(new_source)
        else:
            self.data_sources[source_id] = [new_source]

        return new_source

    def register_data_source_safe(
        self,
        source_id: str,
        source_type: SourceType,
        description: str,
        content: dict,
        timestamp: Optional[datetime] = None,
    ) -> tuple[Optional[DataSource], Optional[dict]]:
        try:
            result = self.register_data_source(
                source_id, source_type, description, content, timestamp=timestamp
            )
            return result, None
        except VersionConflictError as e:
            return None, e.conflict_details

    def _compute_diff(self, old_content: dict, new_content: dict) -> dict:
        diff: dict[str, dict] = {}
        all_keys = set(old_content.keys()) | set(new_content.keys())
        for key in all_keys:
            old_val = old_content.get(key, "<缺失>")
            new_val = new_content.get(key, "<缺失>")
            if old_val != new_val:
                diff[key] = {"旧值": old_val, "新值": new_val}
        return diff

    def trace_conclusion(self, name: str) -> dict:
        if name not in self.params:
            raise KeyError(f"参数 '{name}' 不存在")

        entry = self.params[name]
        trace: dict[str, Any] = {
            "参数名": name,
            "当前值": entry.value,
            "单位": entry.unit,
            "当前结论": entry.conclusion,
            "追溯链": [],
        }

        for record in reversed(entry.change_history):
            step: dict[str, Any] = {
                "变更类型": record.change_type.value,
                "旧值": record.old_value,
                "新值": record.new_value,
                "来源类型": record.source.source_type.value,
                "来源ID": record.source.source_id,
                "来源说明": record.source.description,
                "是否影响结论": record.affects_conclusion,
                "备注": record.note,
                "时间": record.timestamp.isoformat(),
            }

            if record.source.source_id and record.source.source_id in self.data_sources:
                versions = self.data_sources[record.source.source_id]
                current = next((v for v in versions if v.is_current), versions[-1])
                step["数据源快照"] = current.content
                step["数据源版本"] = current.version

            trace["追溯链"].append(step)

        return trace

    def trace_all_conclusions(self) -> list[dict]:
        results = []
        for name in self.params:
            if self.params[name].conclusion:
                results.append(self.trace_conclusion(name))
        return results

    def get_conclusion_summary(self) -> dict:
        summary: dict[str, Any] = {
            "项目": self.project_name,
            "参数总数": len(self.params),
            "有结论的参数": [],
            "有结论变更的参数": [],
            "仅为补材料的变更": [],
            "版本冲突数据源": [],
        }

        for name, entry in self.params.items():
            if entry.conclusion:
                summary["有结论的参数"].append(
                    {
                        "参数名": name,
                        "当前值": entry.value,
                        "单位": entry.unit,
                        "结论": entry.conclusion,
                        "变更次数": len(entry.change_history) - 1,
                        "结论被改过": entry.has_conclusion_changes,
                    }
                )

            if entry.has_conclusion_changes:
                summary["有结论变更的参数"].append(
                    {
                        "参数名": name,
                        "结论变更次数": len(entry.conclusion_changes),
                        "最近一次变更": entry.conclusion_changes[-1].to_dict()
                        if entry.conclusion_changes
                        else None,
                    }
                )

            if entry.supplement_changes and not entry.has_conclusion_changes:
                summary["仅为补材料的变更"].append(
                    {
                        "参数名": name,
                        "补材料次数": len(entry.supplement_changes),
                    }
                )

        for source_id, versions in self.data_sources.items():
            for i in range(1, len(versions)):
                if versions[i].timestamp < versions[i - 1].timestamp:
                    summary["版本冲突数据源"].append(
                        {
                            "数据源ID": source_id,
                            "说明": f"版本{versions[i].version}的时间早于版本{versions[i-1].version}",
                        }
                    )

        return summary

    def export_documentation(self, output_path: Optional[str] = None) -> str:
        lines: list[str] = []
        lines.append(f"{'=' * 60}")
        lines.append(f"  {self.project_name} -- 模型说明")
        lines.append(f"  导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"{'=' * 60}")
        lines.append("")

        lines.append("【一、参数总览】")
        lines.append("-" * 40)
        for name, entry in self.params.items():
            change_flag = ""
            if entry.has_conclusion_changes:
                change_flag = " [[结论已变更]]"
            elif entry.supplement_changes:
                change_flag = " [[仅补材料]]"

            lines.append(f"  {name}: {entry.value} {entry.unit}{change_flag}")
            if entry.source:
                lines.append(
                    f"    来源: {entry.source.source_type.value} / {entry.source.source_id}"
                )
            lines.append(f"    结论: {entry.conclusion or '(无)'}")
            lines.append("")

        lines.append("")
        lines.append("【二、变更分类 -- 哪些是补材料，哪些改了结论】")
        lines.append("-" * 40)

        conclusion_changed = []
        supplement_only = []

        for name, entry in self.params.items():
            if len(entry.change_history) <= 1:
                continue
            if entry.has_conclusion_changes:
                conclusion_changed.append(entry)
            elif entry.supplement_changes:
                supplement_only.append(entry)

        lines.append("")
        lines.append("  >> 改了结论的参数:")
        if not conclusion_changed:
            lines.append("    (无)")
        for entry in conclusion_changed:
            lines.append(f"  * {entry.name} ({entry.value} {entry.unit})")
            for c in entry.conclusion_changes:
                lines.append(
                    f"    {c.timestamp.strftime('%m-%d %H:%M')} "
                    f"{c.old_value} -> {c.new_value} "
                    f"[{c.source.source_type.value}] {c.note}"
                )

        lines.append("")
        lines.append("  >> 仅补材料，结论未变:")
        if not supplement_only:
            lines.append("    (无)")
        for entry in supplement_only:
            lines.append(f"  * {entry.name} ({entry.value} {entry.unit})")
            for c in entry.supplement_changes:
                lines.append(
                    f"    {c.timestamp.strftime('%m-%d %H:%M')} "
                    f"补入: {c.new_value} "
                    f"[{c.source.source_type.value}] {c.note}"
                )

        lines.append("")
        lines.append("")
        lines.append("【三、结论追溯 -- 从结论查到依据】")
        lines.append("-" * 40)

        for name, entry in self.params.items():
            if not entry.conclusion:
                continue
            lines.append("")
            lines.append(f"  参数: {name}")
            lines.append(f"  当前结论: {entry.conclusion}")

            trace = self.trace_conclusion(name)
            lines.append("  追溯链 (从最新到最早):")
            for i, step in enumerate(trace["追溯链"]):
                prefix = "    L--" if i == len(trace["追溯链"]) - 1 else "    |--"
                lines.append(
                    f"  {prefix} [{step['变更类型']}] "
                    f"{step['旧值']} -> {step['新值']} "
                    f"| 来源: {step['来源类型']}/{step['来源ID']}"
                )
                if step.get("数据源快照"):
                    lines.append(f"       数据源内容: {json.dumps(step['数据源快照'], ensure_ascii=False)}")
                if step["是否影响结论"] and step["变更类型"] != "初始录入":
                    lines.append(f"       [!] 此步骤影响了结论")
                if step["备注"]:
                    lines.append(f"       备注: {step['备注']}")

        lines.append("")
        lines.append("")
        lines.append("【四、数据源版本 -- 注意时间线异常】")
        lines.append("-" * 40)

        for source_id, versions in self.data_sources.items():
            lines.append("")
            lines.append(f"  数据源: {source_id}")
            lines.append(f"  类型: {versions[0].source_type.value}")
            lines.append(f"  说明: {versions[0].description}")
            lines.append(f"  版本数: {len(versions)}")

            for idx, v in enumerate(versions):
                marker = " <-- 当前" if v.is_current else ""
                time_order = ""
                if idx > 0:
                    prev = versions[idx - 1]
                    if v.timestamp < prev.timestamp:
                        time_order = " [[!! 时间线异常]]"
                lines.append(
                    f"    v{v.version} "
                    f"{v.timestamp.strftime('%Y-%m-%d %H:%M')}"
                    f"{marker}{time_order}"
                )

        lines.append("")
        lines.append("")
        lines.append("【五、下一班注意事项】")
        lines.append("-" * 40)

        summary = self.get_conclusion_summary()

        if summary["有结论变更的参数"]:
            lines.append("")
            lines.append("  [!] 以下参数的结论被改过，请重点复核:")
            for item in summary["有结论变更的参数"]:
                lines.append(f"    - {item['参数名']} (结论变更{item['结论变更次数']}次)")

        if summary["版本冲突数据源"]:
            lines.append("")
            lines.append("  [!] 以下数据源存在时间线异常，补传了更早版本:")
            for item in summary["版本冲突数据源"]:
                lines.append(f"    - {item['数据源ID']}: {item['说明']}")

        if summary["仅为补材料的变更"]:
            lines.append("")
            lines.append("  以下参数仅补了材料，结论未变，可快速略过:")
            for item in summary["仅为补材料的变更"]:
                lines.append(f"    - {item['参数名']} (补材料{item['补材料次数']}次)")

        lines.append("")
        lines.append(f"{'=' * 60}")
        lines.append("  (文档结束 -- 如需查细节，请看上方追溯链，不必翻聊天记录)")
        lines.append(f"{'=' * 60}")

        doc = "\n".join(lines)

        if output_path:
            try:
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(doc)
            except Exception:
                pass

        return doc
