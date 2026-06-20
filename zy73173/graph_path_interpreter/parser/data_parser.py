from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional


class RowStatus(Enum):
    PROCESSED = "processed"
    BAD_ROW = "bad_row"
    SKIPPED = "skipped"
    MISSING_UNIT = "missing_unit"
    RECALLED = "recalled"
    OLD_PARAM_VERSION = "old_param_version"
    VERBAL_NOTE = "verbal_note"


@dataclass
class RowInfo:
    row_index: int
    row_id: str
    status: RowStatus
    data: Dict[str, Any]
    reason: Optional[str] = None
    source_type: str = "data"

    def to_dict(self) -> dict:
        return {
            "row_index": self.row_index,
            "row_id": self.row_id,
            "status": self.status.value,
            "data": self.data,
            "reason": self.reason,
            "source_type": self.source_type,
        }


@dataclass
class ParseResult:
    rows: List[RowInfo] = field(default_factory=list)
    graph_data: Dict[str, Any] = field(default_factory=lambda: {"nodes": [], "edges": []})
    recall_records: List[Dict[str, Any]] = field(default_factory=list)
    verbal_notes: List[Dict[str, Any]] = field(default_factory=list)
    param_versions: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def total_rows(self) -> int:
        return len(self.rows)

    @property
    def processed_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.PROCESSED)

    @property
    def bad_row_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.BAD_ROW)

    @property
    def skipped_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.SKIPPED)

    @property
    def missing_unit_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.MISSING_UNIT)

    @property
    def recalled_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.RECALLED)

    @property
    def old_param_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.OLD_PARAM_VERSION)

    @property
    def verbal_note_count(self) -> int:
        return sum(1 for r in self.rows if r.status == RowStatus.VERBAL_NOTE)

    def get_rows_by_status(self, status: RowStatus) -> List[RowInfo]:
        return [r for r in self.rows if r.status == status]

    def to_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "processed_count": self.processed_count,
            "bad_row_count": self.bad_row_count,
            "skipped_count": self.skipped_count,
            "missing_unit_count": self.missing_unit_count,
            "recalled_count": self.recalled_count,
            "old_param_count": self.old_param_count,
            "verbal_note_count": self.verbal_note_count,
            "graph_data": self.graph_data,
            "recall_records": self.recall_records,
            "verbal_notes": self.verbal_notes,
            "param_versions": self.param_versions,
            "rows": [r.to_dict() for r in self.rows],
        }


class DataParser:
    RECORD_TYPES = {
        "edge": "edge",
        "node": "node",
        "recall": "recall",
        "note": "note",
        "param_version": "param_version",
    }

    @classmethod
    def parse(cls, data: List[Dict[str, Any]]) -> ParseResult:
        result = ParseResult()
        nodes_set = set()
        edges_list = []
        recalled_ids = set()

        for idx, row_data in enumerate(data):
            row_id = row_data.get("id", f"row_{idx}")
            record_type = row_data.get("type", "edge")

            if record_type == "recall":
                recalled_ids.add(row_data.get("original_id", ""))
                recall_row = RowInfo(
                    row_index=idx,
                    row_id=row_id,
                    status=RowStatus.RECALLED,
                    data=row_data,
                    reason=f"撤回记录：{row_data.get('reason', '未说明原因')}",
                    source_type="recall",
                )
                result.rows.append(recall_row)
                result.recall_records.append(row_data)
                continue

            if record_type == "note":
                note_row = RowInfo(
                    row_index=idx,
                    row_id=row_id,
                    status=RowStatus.VERBAL_NOTE,
                    data=row_data,
                    reason="口头备注，不参与计算",
                    source_type="note",
                )
                result.rows.append(note_row)
                result.verbal_notes.append(row_data)
                continue

            if record_type == "param_version":
                is_old = not row_data.get("is_active", False)
                status = RowStatus.OLD_PARAM_VERSION if is_old else RowStatus.PROCESSED
                reason = "旧版参数表，不影响当前计算" if is_old else "当前激活参数版本"
                param_row = RowInfo(
                    row_index=idx,
                    row_id=row_id,
                    status=status,
                    data=row_data,
                    reason=reason,
                    source_type="param",
                )
                result.rows.append(param_row)
                result.param_versions.append(row_data)
                continue

            if not cls._validate_row(row_data):
                bad_row = RowInfo(
                    row_index=idx,
                    row_id=row_id,
                    status=RowStatus.BAD_ROW,
                    data=row_data,
                    reason="行格式不正确，缺少必要字段",
                    source_type=record_type,
                )
                result.rows.append(bad_row)
                continue

            if record_type == "node":
                node_name = row_data.get("name", "")
                if not node_name:
                    bad_row = RowInfo(
                        row_index=idx,
                        row_id=row_id,
                        status=RowStatus.BAD_ROW,
                        data=row_data,
                        reason="节点名称为空",
                        source_type="node",
                    )
                    result.rows.append(bad_row)
                else:
                    nodes_set.add(node_name)
                    processed_row = RowInfo(
                        row_index=idx,
                        row_id=row_id,
                        status=RowStatus.PROCESSED,
                        data=row_data,
                        source_type="node",
                    )
                    result.rows.append(processed_row)
                continue

            if record_type == "edge":
                original_id = row_data.get("original_id", row_id)
                if original_id in recalled_ids:
                    recalled_row = RowInfo(
                        row_index=idx,
                        row_id=row_id,
                        status=RowStatus.RECALLED,
                        data=row_data,
                        reason="该记录已被撤回",
                        source_type="edge",
                    )
                    result.rows.append(recalled_row)
                    continue

                source = row_data.get("source", "")
                target = row_data.get("target", "")
                unit = row_data.get("unit", "")

                if source and target:
                    nodes_set.add(source)
                    nodes_set.add(target)

                if not unit or unit == "":
                    missing_unit_row = RowInfo(
                        row_index=idx,
                        row_id=row_id,
                        status=RowStatus.MISSING_UNIT,
                        data=row_data,
                        reason="单位缺失，单独拎出不参与正常统计",
                        source_type="edge",
                    )
                    result.rows.append(missing_unit_row)
                    continue

                edges_list.append({
                    "source": source,
                    "target": target,
                    "weight": float(row_data.get("weight", 1)),
                    "unit": unit,
                    "row_id": row_id,
                })

                processed_row = RowInfo(
                    row_index=idx,
                    row_id=row_id,
                    status=RowStatus.PROCESSED,
                    data=row_data,
                    source_type="edge",
                )
                result.rows.append(processed_row)
                continue

            skipped_row = RowInfo(
                row_index=idx,
                row_id=row_id,
                status=RowStatus.SKIPPED,
                data=row_data,
                reason=f"未知记录类型: {record_type}",
                source_type=record_type,
            )
            result.rows.append(skipped_row)

        result.graph_data["nodes"] = sorted(list(nodes_set))
        result.graph_data["edges"] = edges_list

        return result

    @classmethod
    def _validate_row(cls, row_data: Dict[str, Any]) -> bool:
        record_type = row_data.get("type", "edge")

        if record_type == "node":
            return "name" in row_data and row_data["name"]
        elif record_type == "edge":
            return (
                "source" in row_data
                and "target" in row_data
                and row_data["source"]
                and row_data["target"]
            )

        return True

    @classmethod
    def parse_from_lines(cls, lines: List[str]) -> ParseResult:
        parsed_data = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                import json
                row = json.loads(line)
                parsed_data.append(row)
            except json.JSONDecodeError:
                parsed_data.append({"type": "bad_format", "raw": line})

        return cls.parse(parsed_data)
