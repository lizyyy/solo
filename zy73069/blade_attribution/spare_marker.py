"""备件型号替换标记：夹在正常材料里也能识别，导出后标记不丢"""
import re
from typing import List, Dict, Optional, Tuple

from .models import SparePart


def parse_replacement_rules(raw_rules: List[str]) -> List[Tuple[str, str]]:
    """从配置解析型号替换规则 A -> B"""
    rules = []
    for rule in raw_rules:
        match = re.match(r"\s*(\S+)\s*->\s*(\S+)\s*", rule)
        if match:
            rules.append((match.group(1), match.group(2)))
    return rules


class SparePartMarker:
    def __init__(self, replacement_rules: Optional[List[str]] = None):
        self.rules: List[Tuple[str, str]] = parse_replacement_rules(replacement_rules or [])

    def add_rule(self, original: str, replacement: str):
        self.rules.append((original, replacement))

    def detect_replacement(self, part: SparePart) -> Tuple[bool, Optional[str]]:
        """检测一件备件是否是替换型号，返回(是否替换, 原始型号)"""
        for orig, repl in self.rules:
            if part.part_code.strip() == repl.strip():
                return True, orig
            if part.original_code and part.original_code.strip() == orig.strip():
                return True, orig
        if part.is_replacement and part.original_code:
            return True, part.original_code
        return False, None

    def mark_parts(self, parts: List[SparePart]) -> List[Dict]:
        """给一批备件打替换标记，包含在正常材料清单中也能识别"""
        marked = []
        for idx, p in enumerate(parts):
            is_repl, orig_code = self.detect_replacement(p)
            if is_repl:
                p.is_replacement = True
                if orig_code and not p.original_code:
                    p.original_code = orig_code
            marked.append({
                "index": idx,
                "part_code": p.part_code,
                "part_name": p.part_name,
                "is_replacement": is_repl,
                "original_code": orig_code or p.original_code or "",
                "replacement_marker": "[型号替换]" if is_repl else "[正常]",
                "marker_text": (f"[型号替换] {p.part_code}(替代 {orig_code or p.original_code or '未知'})"
                                 if is_repl else f"[正常] {p.part_code}"),
                "_part_ref": p
            })
        return marked

    def filter_with_markers(self, parts: List[SparePart],
                            include_normal: bool = True,
                            include_replacement: bool = True) -> List[Dict]:
        """筛选备件，结果中带标记列"""
        marked = self.mark_parts(parts)
        result = []
        for m in marked:
            if m["is_replacement"] and include_replacement:
                result.append(m)
            elif not m["is_replacement"] and include_normal:
                result.append(m)
        return result

    def export_columns(self) -> List[str]:
        """导出时需保留的列（含标记列，确保不丢）"""
        return [
            "part_code", "part_name", "quantity",
            "required_date", "arrival_date",
            "is_replacement", "original_code",
            "replacement_marker", "marker_text"
        ]

    def to_export_rows(self, parts: List[SparePart]) -> List[Dict]:
        """生成导出行，标记列在其中，不会丢失"""
        marked = self.mark_parts(parts)
        rows = []
        for m in marked:
            p: SparePart = m["_part_ref"]
            rows.append({
                "part_code": p.part_code,
                "part_name": p.part_name,
                "quantity": p.quantity,
                "required_date": p.required_date,
                "arrival_date": p.arrival_date,
                "is_replacement": m["is_replacement"],
                "original_code": m["original_code"],
                "replacement_marker": m["replacement_marker"],
                "marker_text": m["marker_text"],
                "lead_time_days": p.lead_time_days,
                "arrival_delay_days": p.arrival_delay_days,
                "is_late": p.is_late
            })
        return rows
