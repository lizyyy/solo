import json
import math
from typing import List, Tuple, Optional, Dict, Any
from .data_models import (
    Charge,
    FieldLine,
    Arrow,
    ChargeSign,
    StudentSubmission,
    SourceInfo,
    Issue,
    IssueType,
)


class DataLoader:
    def __init__(self):
        self.issues: List[Issue] = []

    def load_submission(self, filepath: str) -> Tuple[Optional[StudentSubmission], List[Issue]]:
        self.issues = []
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                raw_lines = f.readlines()
                f.seek(0)
                data = json.load(f)
        except json.JSONDecodeError as e:
            issue = Issue(
                issue_type=IssueType.BAD_DATA,
                description=f"JSON解析失败: {str(e)}",
                business_explanation="输入文件格式不是有效的JSON，无法读取学生提交内容。请检查文件是否损坏或格式错误。",
                severity="critical",
                source=SourceInfo(
                    source_file=filepath,
                    line_number=e.lineno if hasattr(e, "lineno") else None,
                    raw_content=raw_lines[e.lineno - 1].strip() if hasattr(e, "lineno") and e.lineno <= len(raw_lines) else None,
                ),
            )
            self.issues.append(issue)
            return None, self.issues
        except FileNotFoundError:
            issue = Issue(
                issue_type=IssueType.BAD_DATA,
                description=f"文件不存在: {filepath}",
                business_explanation="找不到指定的输入文件，请确认文件路径是否正确。",
                severity="critical",
                source=SourceInfo(source_file=filepath),
            )
            self.issues.append(issue)
            return None, self.issues
        except Exception as e:
            issue = Issue(
                issue_type=IssueType.BAD_DATA,
                description=f"文件读取失败: {str(e)}",
                business_explanation="读取文件时发生未知错误，请检查文件权限和内容。",
                severity="critical",
                source=SourceInfo(source_file=filepath),
            )
            self.issues.append(issue)
            return None, self.issues

        submission_id = data.get("submission_id", "unknown")

        raw_charges = data.get("charges", [])
        raw_field_lines = data.get("field_lines", [])

        if not raw_charges:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description="缺少电荷数据",
                business_explanation="输入中没有包含任何电荷信息，无法进行电场线检查。至少需要提供一个电荷的位置和符号。",
                severity="error",
                source=SourceInfo(
                    source_file=filepath,
                    raw_content=json.dumps({"charges": raw_charges}, ensure_ascii=False),
                ),
                evidence={"missing_field": "charges"},
            )

        if not raw_field_lines:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description="缺少电场线数据",
                business_explanation="输入中没有包含任何电场线信息，无法进行检查。需要提供学生绘制的电场线坐标点。",
                severity="error",
                source=SourceInfo(
                    source_file=filepath,
                    raw_content=json.dumps({"field_lines": raw_field_lines}, ensure_ascii=False),
                ),
                evidence={"missing_field": "field_lines"},
            )

        charges = []
        for idx, raw_charge in enumerate(raw_charges):
            charge = self._parse_charge(raw_charge, filepath, idx + 1)
            if charge is not None:
                charges.append(charge)

        field_lines = []
        for idx, raw_line in enumerate(raw_field_lines):
            line = self._parse_field_line(raw_line, filepath, idx + 1)
            if line is not None:
                field_lines.append(line)

        submission = StudentSubmission(
            charges=charges,
            field_lines=field_lines,
            submission_id=submission_id,
            source_file=filepath,
        )

        return submission, self.issues

    def _parse_charge(
        self, raw: Dict[str, Any], filepath: str, entry_index: int
    ) -> Optional[Charge]:
        source = SourceInfo(
            source_file=filepath,
            raw_content=json.dumps(raw, ensure_ascii=False),
        )

        pos = raw.get("position")
        if pos is None:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 缺少 position 字段",
                business_explanation="每个电荷必须提供(x, y)坐标位置。请补充该电荷的位置信息。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "missing_field": "position"},
            )
            return None

        if not isinstance(pos, (list, tuple)) or len(pos) != 2:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 的 position 格式错误，应为 [x, y]",
                business_explanation="电荷位置必须是包含两个数值的数组 [x, y]。请检查坐标格式。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "invalid_value": pos},
            )
            return None

        try:
            x, y = float(pos[0]), float(pos[1])
        except (ValueError, TypeError):
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 的 position 包含非数值",
                business_explanation="电荷位置坐标必须是有效的数字。请检查x、y值是否为数字。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "invalid_value": pos},
            )
            return None

        if math.isnan(x) or math.isnan(y) or math.isinf(x) or math.isinf(y):
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 的 position 包含无效数值 (NaN 或 Inf)",
                business_explanation="电荷位置不能是无穷大或非数字值。请检查数据输入。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "invalid_value": pos},
            )
            return None

        sign_raw = raw.get("sign")
        if sign_raw is None:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 缺少 sign 字段",
                business_explanation="每个电荷必须标明正负符号（positive/negative）。请补充符号信息。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "missing_field": "sign"},
            )
            return None

        sign_map = {
            "positive": ChargeSign.POSITIVE,
            "negative": ChargeSign.NEGATIVE,
            "+": ChargeSign.POSITIVE,
            "-": ChargeSign.NEGATIVE,
            "1": ChargeSign.POSITIVE,
            "-1": ChargeSign.NEGATIVE,
            1: ChargeSign.POSITIVE,
            -1: ChargeSign.NEGATIVE,
        }

        if isinstance(sign_raw, str):
            sign_key = sign_raw.lower()
        else:
            sign_key = sign_raw

        if sign_key not in sign_map:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 的 sign 值无效: {sign_raw}",
                business_explanation="电荷符号只能是 positive(+) 或 negative(-)。请修正符号标记。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "invalid_value": sign_raw},
            )
            return None

        sign = sign_map[sign_key]

        magnitude = raw.get("magnitude", 1.0)
        try:
            magnitude = float(magnitude)
        except (ValueError, TypeError):
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电荷 #{entry_index} 的 magnitude 不是有效数字",
                business_explanation="电荷量值必须是数字。如不确定，可留空使用默认值1.0。",
                severity="warning",
                source=source,
                evidence={"entry_index": entry_index, "invalid_value": magnitude},
            )
            magnitude = 1.0

        if magnitude <= 0:
            self._record_issue(
                issue_type=IssueType.DATA_CONFLICT,
                description=f"电荷 #{entry_index} 的 magnitude 为非正数: {magnitude}",
                business_explanation="电荷量大小应为正数，符号由sign字段单独表示。这里不会自动修正，保持原始数据供后续参考。",
                severity="warning",
                source=source,
                evidence={"entry_index": entry_index, "conflict_value": magnitude},
                related_objects=[f"charge_{entry_index}"],
            )

        charge_id = raw.get("charge_id", f"charge_{entry_index}")

        return Charge(
            position=(x, y),
            sign=sign,
            magnitude=magnitude,
            source=source,
            charge_id=charge_id,
        )

    def _parse_field_line(
        self, raw: Dict[str, Any], filepath: str, entry_index: int
    ) -> Optional[FieldLine]:
        source = SourceInfo(
            source_file=filepath,
            raw_content=json.dumps(raw, ensure_ascii=False),
        )

        points = raw.get("points")
        if points is None:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{entry_index} 缺少 points 字段",
                business_explanation="每条电场线必须提供一系列坐标点来描述其路径。请补充点坐标数据。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "missing_field": "points"},
            )
            return None

        if not isinstance(points, (list, tuple)) or len(points) < 2:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{entry_index} 的 points 无效，至少需要2个点",
                business_explanation="一条电场线至少需要起点和终点两个坐标点才能确定走向。请补充足够的点。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "point_count": len(points) if isinstance(points, (list, tuple)) else 0},
            )
            return None

        parsed_points = []
        for pt_idx, pt in enumerate(points):
            if not isinstance(pt, (list, tuple)) or len(pt) != 2:
                self._record_issue(
                    issue_type=IssueType.BAD_DATA,
                    description=f"电场线 #{entry_index} 第 {pt_idx + 1} 个点格式错误",
                    business_explanation="电场线上的每个点都必须是 [x, y] 格式的数值数组。请修正该点的格式。",
                    severity="error",
                    source=source,
                    evidence={"entry_index": entry_index, "point_index": pt_idx, "invalid_value": pt},
                )
                continue

            try:
                px, py = float(pt[0]), float(pt[1])
            except (ValueError, TypeError):
                self._record_issue(
                    issue_type=IssueType.BAD_DATA,
                    description=f"电场线 #{entry_index} 第 {pt_idx + 1} 个点包含非数值",
                    business_explanation="电场线坐标必须是有效的数字。请检查该点的x、y值。",
                    severity="error",
                    source=source,
                    evidence={"entry_index": entry_index, "point_index": pt_idx, "invalid_value": pt},
                )
                continue

            if math.isnan(px) or math.isnan(py) or math.isinf(px) or math.isinf(py):
                self._record_issue(
                    issue_type=IssueType.BAD_DATA,
                    description=f"电场线 #{entry_index} 第 {pt_idx + 1} 个点包含无效数值",
                    business_explanation="电场线坐标不能是无穷大或非数字值。请检查数据输入。",
                    severity="error",
                    source=source,
                    evidence={"entry_index": entry_index, "point_index": pt_idx, "invalid_value": pt},
                )
                continue

            parsed_points.append((px, py))

        if len(parsed_points) < 2:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{entry_index} 有效点不足2个，无法构成线条",
                business_explanation="剔除无效点后，可用的有效坐标点不足2个，无法分析该电场线。",
                severity="error",
                source=source,
                evidence={"entry_index": entry_index, "valid_point_count": len(parsed_points)},
            )
            return None

        arrows = []
        raw_arrows = raw.get("arrows", [])
        for arrow_idx, raw_arrow in enumerate(raw_arrows):
            arrow = self._parse_arrow(raw_arrow, filepath, entry_index, arrow_idx + 1)
            if arrow is not None:
                arrows.append(arrow)

        line_id = raw.get("line_id", f"line_{entry_index}")

        return FieldLine(
            points=parsed_points,
            arrows=arrows,
            source=source,
            line_id=line_id,
        )

    def _parse_arrow(
        self,
        raw: Dict[str, Any],
        filepath: str,
        line_index: int,
        arrow_index: int,
    ) -> Optional[Arrow]:
        source = SourceInfo(
            source_file=filepath,
            raw_content=json.dumps(raw, ensure_ascii=False),
        )

        pos = raw.get("position")
        direction = raw.get("direction")

        if pos is None:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{line_index} 的箭头 #{arrow_index} 缺少 position",
                business_explanation="每个方向箭头必须标注其在图中的位置坐标。请补充箭头位置。",
                severity="warning",
                source=source,
                evidence={"line_index": line_index, "arrow_index": arrow_index, "missing_field": "position"},
            )
            return None

        if direction is None:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{line_index} 的箭头 #{arrow_index} 缺少 direction",
                business_explanation="每个方向箭头必须提供方向向量 (dx, dy)。请补充方向信息。",
                severity="warning",
                source=source,
                evidence={"line_index": line_index, "arrow_index": arrow_index, "missing_field": "direction"},
            )
            return None

        try:
            if not isinstance(pos, (list, tuple)) or len(pos) != 2:
                raise ValueError("位置格式错误")
            px, py = float(pos[0]), float(pos[1])

            if not isinstance(direction, (list, tuple)) or len(direction) != 2:
                raise ValueError("方向格式错误")
            dx, dy = float(direction[0]), float(direction[1])
        except (ValueError, TypeError):
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{line_index} 的箭头 #{arrow_index} 格式错误",
                business_explanation="箭头的位置和方向都必须是包含两个数值的数组。请修正格式。",
                severity="warning",
                source=source,
                evidence={"line_index": line_index, "arrow_index": arrow_index},
            )
            return None

        mag = math.sqrt(dx * dx + dy * dy)
        if mag < 1e-10:
            self._record_issue(
                issue_type=IssueType.BAD_DATA,
                description=f"电场线 #{line_index} 的箭头 #{arrow_index} 方向向量为零向量",
                business_explanation="箭头方向不能是 (0, 0)，这样无法指示电场方向。请提供有效的方向向量。",
                severity="warning",
                source=source,
                evidence={"line_index": line_index, "arrow_index": arrow_index, "direction": direction},
            )
            return None

        arrow_id = raw.get("arrow_id", f"arrow_{line_index}_{arrow_index}")

        return Arrow(
            position=(px, py),
            direction=(dx, dy),
            source=source,
            arrow_id=arrow_id,
        )

    def _record_issue(
        self,
        issue_type: IssueType,
        description: str,
        business_explanation: str,
        severity: str,
        source: SourceInfo,
        evidence: Optional[Dict[str, Any]] = None,
        related_objects: Optional[List[str]] = None,
    ):
        issue = Issue(
            issue_type=issue_type,
            description=description,
            business_explanation=business_explanation,
            severity=severity,
            source=source,
            evidence=evidence or {},
            related_objects=related_objects or [],
        )
        self.issues.append(issue)
