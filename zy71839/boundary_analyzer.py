from typing import List, Dict, Optional
from dataclasses import asdict
import json

from models import (
    BoundaryCrossingAnalysis, BattleRecord, Unit, Position,
    ConfirmationStatus, AnomalyMark
)
from anomaly_detector import CanyonMap


class BoundaryAnalyzer:
    def __init__(self, canyon_map: CanyonMap, units: Dict[str, Unit]):
        self.canyon_map = canyon_map
        self.units = units
        self.analyses: Dict[str, BoundaryCrossingAnalysis] = {}

    def analyze_record(self, record: BattleRecord) -> List[BoundaryCrossingAnalysis]:
        record_analyses = []
        for action in record.actions:
            if action.action_type != 'move':
                continue

            unit = self.units.get(action.unit_id)
            if not unit:
                continue

            analysis = self._analyze_single_action(record, action, unit)
            if analysis:
                self.analyses[f"{record.record_id}:{action.action_id}"] = analysis
                record_analyses.append(analysis)

        return record_analyses

    def _analyze_single_action(self, record: BattleRecord, action, unit: Unit) -> Optional[BoundaryCrossingAnalysis]:
        start_zones = self.canyon_map.get_zone(action.start_pos)
        end_zones = self.canyon_map.get_zone(action.end_pos)

        crossed_zones = self._get_crossed_zones(start_zones, end_zones)
        distance = self.canyon_map.calculate_distance(action.start_pos, action.end_pos)
        exceeds_move = distance > unit.move_range
        crosses_impassable = self._check_path_impassable(action.start_pos, action.end_pos)

        has_issue = len(crossed_zones) > 0 or exceeds_move or crosses_impassable
        if not has_issue:
            return None

        all_zones = list(set(start_zones + end_zones))
        review_reason = self._generate_review_reason(
            action.start_pos, action.end_pos, crossed_zones,
            distance, unit.move_range, exceeds_move, crosses_impassable, unit
        )

        evidence = self._generate_evidence(
            record, action, unit, start_zones, end_zones,
            crossed_zones, distance, exceeds_move, crosses_impassable
        )

        return BoundaryCrossingAnalysis(
            record_id=record.record_id,
            action_id=action.action_id,
            unit_id=action.unit_id,
            start_pos=action.start_pos,
            end_pos=action.end_pos,
            boundary_zones=all_zones,
            crossing_detected=len(crossed_zones) > 0,
            review_reason=review_reason,
            evidence=evidence,
            map_data_ref="canyon_map_v2",
            unit_move_ref=f"file://{unit.source_file}#L{unit.line_number}",
            confirmation_status=ConfirmationStatus.PENDING
        )

    def _get_crossed_zones(self, start_zones: List[str], end_zones: List[str]) -> List[str]:
        crossed = []
        for z in start_zones:
            if z not in end_zones:
                crossed.append(z)
        for z in end_zones:
            if z not in start_zones and z not in crossed:
                crossed.append(z)
        return crossed

    def _generate_review_reason(self, start: Position, end: Position,
                                 crossed_zones: List[str], distance: float,
                                 move_range: int, exceeds_move: bool,
                                 crosses_impassable: bool, unit: Unit) -> str:
        reasons = []

        if crossed_zones:
            zone_desc = "、".join([self._translate_zone_name(z) for z in crossed_zones])
            reasons.append(f"穿越边界区域【{zone_desc}】")

        if exceeds_move:
            reasons.append(
                f"移动距离{distance:.1f}格超过【{unit.name}】移动力上限{move_range}格"
            )

        if crosses_impassable:
            reasons.append("移动路径经过【不可通行断崖】区域")

        reasons.append(f"轨迹: ({start.x},{start.y})→({end.x},{end.y})")

        return "；".join(reasons)

    @staticmethod
    def _translate_zone_name(zone: str) -> str:
        translations = {
            'left_edge': '西部边界',
            'right_edge': '东部边界',
            'top_edge': '北部边界',
            'bottom_edge': '南部边界',
            'canyon_pass': '峡谷通道',
            'wind_zone_a': 'A风区',
            'wind_zone_b': 'B风区'
        }
        return translations.get(zone, zone)

    def _generate_evidence(self, record: BattleRecord, action, unit: Unit,
                            start_zones: List[str], end_zones: List[str],
                            crossed_zones: List[str], distance: float,
                            exceeds_move: bool, crosses_impassable: bool) -> List[str]:
        evidence = []

        evidence.append(f"[地图坐标] 起点({action.start_pos.x},{action.start_pos.y}) ∈ {start_zones}")
        evidence.append(f"[地图坐标] 终点({action.end_pos.x},{action.end_pos.y}) ∈ {end_zones}")

        if crossed_zones:
            evidence.append(f"[区域穿越] 跨越区域: {crossed_zones}")
            for zone in crossed_zones:
                zone_coords = sorted(self.canyon_map.boundary_zones.get(zone, set()))
                if zone_coords:
                    sample = zone_coords[:3]
                    evidence.append(f"[地图数据] {zone}区域坐标示例: {sample}")

        if exceeds_move:
            evidence.append(f"[移动校验] 欧氏距离=√{int((action.end_pos.x - action.start_pos.x)**2 + (action.end_pos.y - action.start_pos.y)**2)}={distance:.2f}")
            evidence.append(f"[单位数据] {unit.name}(ID:{unit.unit_id}) 移动力={unit.move_range}")
            evidence.append(f"[单位来源] file://{unit.source_file}#L{unit.line_number}")

        if crosses_impassable:
            path_coords = self._get_path_coords(action.start_pos, action.end_pos)
            impassable_hits = [c for c in path_coords if self.canyon_map.is_impassable(Position(x=c[0], y=c[1]))]
            evidence.append(f"[地形阻挡] 路径经过不可通行坐标: {impassable_hits}")

        evidence.append(f"[战报来源] file://{record.source_file}#L{record.line_number}")
        evidence.append(f"[行动ID] {action.action_id}")

        return evidence

    def _get_path_coords(self, start: Position, end: Position) -> List[tuple]:
        coords = []
        x0, y0 = start.x, start.y
        x1, y1 = end.x, end.y

        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy

        while True:
            coords.append((x0, y0))
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy

        return coords

    def _check_path_impassable(self, start: Position, end: Position) -> bool:
        path = self._get_path_coords(start, end)
        for x, y in path:
            if self.canyon_map.is_impassable(Position(x=x, y=y)):
                return True
        return False

    def get_analysis_report(self, analysis_id: str) -> Optional[str]:
        analysis = self.analyses.get(analysis_id)
        if not analysis:
            return None

        unit = self.units.get(analysis.unit_id)
        unit_name = unit.name if unit else analysis.unit_id

        report = [
            "=" * 60,
            f"边界穿越复核报告 - {analysis_id}",
            "=" * 60,
            f"记录ID: {analysis.record_id}",
            f"行动ID: {analysis.action_id}",
            f"单位: {unit_name} ({analysis.unit_id})",
            f"移动轨迹: ({analysis.start_pos.x},{analysis.start_pos.y}) → ({analysis.end_pos.x},{analysis.end_pos.y})",
            f"涉及区域: {', '.join(analysis.boundary_zones)}",
            f"是否穿越: {'是' if analysis.crossing_detected else '否'}",
            "",
            f"判定原因: {analysis.review_reason}",
            "",
            "证据链:",
        ]

        for i, ev in enumerate(analysis.evidence, 1):
            report.append(f"  {i}. {ev}")

        report.extend([
            "",
            f"地图版本: {analysis.map_data_ref}",
            f"单位数据表: {analysis.unit_move_ref}",
            f"确认状态: {analysis.confirmation_status.value}",
            "",
            "复核指引:",
            "  1. 点击单位数据表链接确认移动力参数",
            "  2. 查看战报来源确认行动记录原文",
            "  3. 对照地图坐标检查区域划分是否正确",
            "  4. 如判定有误请标记为 CONFIRMED 并备注原因",
        ])

        return "\n".join(report)

    def export_analyses_for_review(self, output_file: str):
        export_data = []
        for analysis_id, analysis in self.analyses.items():
            data = asdict(analysis)
            data['analysis_id'] = analysis_id
            data['review_link'] = f"boundary_review://{analysis_id}"
            export_data.append(data)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)

        print(f"已导出 {len(export_data)} 条边界穿越记录到 {output_file}")
        print(f"可通过 boundary_review://<analysis_id> 查看单条复核报告")

    def get_summary(self) -> Dict:
        total = len(self.analyses)
        by_zone = {}
        by_status = {}

        for analysis in self.analyses.values():
            status = analysis.confirmation_status.value
            by_status[status] = by_status.get(status, 0) + 1
            for zone in analysis.boundary_zones:
                by_zone[zone] = by_zone.get(zone, 0) + 1

        return {
            'total_boundary_issues': total,
            'by_zone': by_zone,
            'by_status': by_status,
            'pending_review': by_status.get('pending', 0)
        }
