from typing import List, Dict, Tuple
from collections import defaultdict
from dataclasses import asdict
import json
import os
import uuid

from models import (
    BattleRecord, Unit, SettlementData, DecisionEntry,
    AnomalyType, ConfirmationStatus, BoundaryCrossingAnalysis
)
from boundary_analyzer import BoundaryAnalyzer


class DecisionEngine:
    def __init__(self, records: List[BattleRecord], units: Dict[str, Unit],
                 settlements: List[SettlementData],
                 boundary_analyzer: BoundaryAnalyzer):
        self.records = records
        self.units = units
        self.settlements = settlements
        self.boundary_analyzer = boundary_analyzer
        self.decisions: List[DecisionEntry] = []
        self._record_index: Dict[str, BattleRecord] = {r.record_id: r for r in records}

    def generate_decisions(self) -> List[DecisionEntry]:
        battle_groups = defaultdict(list)
        for record in self.records:
            battle_groups[record.battle_id].append(record)

        for battle_id, battle_records in battle_groups.items():
            round_groups = defaultdict(list)
            for record in battle_records:
                round_groups[record.round_number].append(record)

            for round_num, round_records in sorted(round_groups.items()):
                decision = self._generate_round_decision(battle_id, round_num, round_records)
                self.decisions.append(decision)

        return self.decisions

    def _generate_round_decision(self, battle_id: str, round_num: int,
                                  records: List[BattleRecord]) -> DecisionEntry:
        confirmed_records = []
        pending_records = []
        rejected_records = []
        all_anomalies = set()
        contributing_units = set()

        for record in records:
            for action in record.actions:
                contributing_units.add(action.unit_id)
                if action.target_unit_id:
                    contributing_units.add(action.target_unit_id)

            if record.confirmation_status == ConfirmationStatus.CONFIRMED:
                confirmed_records.append(record)
            elif record.confirmation_status == ConfirmationStatus.PENDING:
                pending_records.append(record)
            else:
                rejected_records.append(record)

            for anomaly in record.anomalies:
                all_anomalies.add(anomaly.anomaly_type)

        settlement = self._find_settlement(battle_id, round_num)
        wind_direction = self._calculate_wind_direction(confirmed_records, settlement)
        conclusion = self._generate_conclusion(
            confirmed_records, pending_records, rejected_records,
            settlement, wind_direction
        )

        confidence = self._calculate_confidence(
            len(confirmed_records), len(pending_records), len(rejected_records),
            len(all_anomalies)
        )

        status = ConfirmationStatus.CONFIRMED
        if pending_records or AnomalyType.BOUNDARY_CROSSING in all_anomalies \
           or AnomalyType.TURN_ORDER_ERROR in all_anomalies \
           or AnomalyType.REPORT_SETTLEMENT_MISMATCH in all_anomalies:
            status = ConfirmationStatus.PENDING

        cross_refs = self._build_cross_refs(records, settlement, contributing_units)

        review_notes = self._generate_review_notes(pending_records, all_anomalies)

        return DecisionEntry(
            entry_id=f"DEC-{battle_id}-R{round_num}",
            battle_id=battle_id,
            round_number=round_num,
            conclusion=conclusion,
            wind_direction=wind_direction,
            confidence_score=confidence,
            confirmation_status=status,
            contributing_records=[r.record_id for r in records],
            contributing_units=sorted(contributing_units),
            anomalies_found=sorted(all_anomalies, key=lambda x: x.value),
            review_notes=review_notes,
            cross_refs=cross_refs
        )

    def _calculate_wind_direction(self, confirmed_records: List[BattleRecord],
                                   settlement: SettlementData) -> str:
        zone_a_count = 0
        zone_b_count = 0

        for record in confirmed_records:
            for action in record.actions:
                start_zone = action.start_pos.zone
                end_zone = action.end_pos.zone
                if 'wind_zone_a' in start_zone or 'wind_zone_a' in end_zone:
                    zone_a_count += 1
                if 'wind_zone_b' in start_zone or 'wind_zone_b' in end_zone:
                    zone_b_count += 1

        if settlement:
            for unit_id in settlement.surviving_units:
                unit = self.units.get(unit_id)
                if unit and unit.faction == 'A':
                    zone_a_count += 2
                elif unit and unit.faction == 'B':
                    zone_b_count += 2

        if zone_a_count > zone_b_count:
            return "A→B（东风）"
        elif zone_b_count > zone_a_count:
            return "B→A（西风）"
        else:
            return "均衡（无主导风向）"

    def _generate_conclusion(self, confirmed: List[BattleRecord],
                              pending: List[BattleRecord],
                              rejected: List[BattleRecord],
                              settlement: SettlementData,
                              wind_direction: str) -> str:
        total_actions = sum(len(r.actions) for r in confirmed)
        total_damage = sum(
            a.damage_dealt or 0
            for r in confirmed for a in r.actions if a.action_type == 'attack'
        )

        parts = []
        parts.append(f"本回合共执行 {total_actions} 个有效行动")
        parts.append(f"造成总伤害 {total_damage}")

        if settlement:
            survivors = sum(settlement.surviving_units.values())
            casualties = sum(settlement.casualties.values())
            parts.append(f"存活 {survivors} 单位，伤亡 {casualties} 单位")

        parts.append(f"判定风向: {wind_direction}")

        if pending:
            parts.append(f"⚠️  有 {len(pending)} 条记录待确认，已标记为PENDING")

        if rejected:
            parts.append(f"已排除 {len(rejected)} 条作废记录")

        return "；".join(parts)

    def _calculate_confidence(self, confirmed_count: int, pending_count: int,
                               rejected_count: int, anomaly_count: int) -> float:
        total = confirmed_count + pending_count + rejected_count
        if total == 0:
            return 0.0

        base_confidence = confirmed_count / total
        anomaly_penalty = min(anomaly_count * 0.1, 0.3)
        pending_penalty = min(pending_count * 0.05, 0.2)

        return max(0.0, round(base_confidence - anomaly_penalty - pending_penalty, 2))

    def _build_cross_refs(self, records: List[BattleRecord],
                           settlement: SettlementData,
                           units: set) -> Dict[str, str]:
        cross_refs = {}

        for record in records:
            link = f"battle_record://{record.record_id}"
            cross_refs[f"记录_{record.record_id}"] = link
            cross_refs[f"原文_{record.record_id}"] = f"file://{record.source_file}#L{record.line_number}"

            for anomaly in record.anomalies:
                if anomaly.anomaly_type == AnomalyType.BOUNDARY_CROSSING:
                    analysis_id = f"{record.record_id}:{anomaly.evidence_refs[-1].split(':')[-1]}" \
                        if anomaly.evidence_refs else record.record_id
                    cross_refs[f"边界复核_{record.record_id}"] = f"boundary_review://{analysis_id}"

        if settlement:
            cross_refs[f"结算_{settlement.settlement_id}"] = f"file://{settlement.source_file}#L{settlement.line_number}"

        for unit_id in sorted(units):
            unit = self.units.get(unit_id)
            if unit:
                cross_refs[f"单位_{unit_id}"] = f"file://{unit.source_file}#L{unit.line_number}"

        return cross_refs

    def _generate_review_notes(self, pending_records: List[BattleRecord],
                                anomalies: set) -> str:
        notes = []

        if AnomalyType.TURN_ORDER_ERROR in anomalies:
            notes.append("存在回合顺序异常，需核对行动时序")

        if AnomalyType.BOUNDARY_CROSSING in anomalies:
            boundary_count = sum(
                1 for r in pending_records
                for a in r.anomalies
                if a.anomaly_type == AnomalyType.BOUNDARY_CROSSING
            )
            notes.append(f"存在 {boundary_count} 处边界穿越可疑记录，需人工复核")

        if AnomalyType.REPORT_SETTLEMENT_MISMATCH in anomalies:
            notes.append("战报与结算数据不一致，需核对伤亡统计")

        if AnomalyType.SUSPECTED_DUPLICATE in anomalies:
            notes.append("存在疑似重复/晚到记录，需确认有效性")

        if not notes:
            notes.append("数据完整，无待复核项")

        return "；".join(notes)

    def _find_settlement(self, battle_id: str, round_num: int) -> SettlementData:
        for s in self.settlements:
            if s.battle_id == battle_id and s.round_number == round_num:
                return s
        return None

    def export_decision_table(self, output_file: str, format: str = 'html'):
        if format == 'html':
            self._export_html_table(output_file)
        elif format == 'json':
            self._export_json(output_file)
        elif format == 'markdown':
            self._export_markdown(output_file)
        else:
            raise ValueError(f"不支持的格式: {format}")

    def _export_html_table(self, output_file: str):
        html = [
            "<!DOCTYPE html>",
            "<html lang='zh-CN'>",
            "<head>",
            "<meta charset='UTF-8'>",
            "<title>峡谷风向决策报告</title>",
            "<style>",
            "body { font-family: 'Microsoft YaHei', sans-serif; margin: 20px; }",
            "table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }",
            "th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }",
            "th { background-color: #f5f5f5; font-weight: bold; }",
            "tr.pending { background-color: #fff8e1; }",
            "tr.confirmed { background-color: #e8f5e9; }",
            ".anomaly-tag { display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 4px; font-size: 12px; }",
            ".tag-turn { background-color: #ffebee; color: #c62828; }",
            ".tag-boundary { background-color: #fff3e0; color: #ef6c00; }",
            ".tag-mismatch { background-color: #fce4ec; color: #ad1457; }",
            ".tag-duplicate { background-color: #f3e5f5; color: #6a1b9a; }",
            "a { color: #1565c0; text-decoration: none; }",
            "a:hover { text-decoration: underline; }",
            ".confidence-bar { height: 8px; background-color: #e0e0e0; border-radius: 4px; }",
            ".confidence-fill { height: 100%; border-radius: 4px; }",
            ".ref-links { font-size: 12px; color: #666; }",
            ".ref-links a { margin-right: 8px; }",
            "</style>",
            "</head>",
            "<body>",
            "<h1>峡谷风向决策报告</h1>",
            f"<p>生成时间: {self._current_time()}</p>",
            self._generate_summary_section(),
            "<h2>决策明细</h2>",
            "<table>",
            "<thead>",
            "<tr>",
            "<th>决策ID</th>",
            "<th>战斗</th>",
            "<th>回合</th>",
            "<th>结论</th>",
            "<th>风向</th>",
            "<th>置信度</th>",
            "<th>状态</th>",
            "<th>异常类型</th>",
            "<th>复核备注</th>",
            "<th>追溯链接</th>",
            "</tr>",
            "</thead>",
            "<tbody>",
        ]

        for decision in self.decisions:
            row_class = 'pending' if decision.confirmation_status == ConfirmationStatus.PENDING else 'confirmed'
            anomaly_tags = self._render_anomaly_tags(decision.anomalies_found)
            confidence_bar = self._render_confidence_bar(decision.confidence_score)
            ref_links = self._render_ref_links(decision.cross_refs)

            html.extend([
                f"<tr class='{row_class}'>",
                f"<td><strong>{decision.entry_id}</strong></td>",
                f"<td>{decision.battle_id}</td>",
                f"<td>{decision.round_number}</td>",
                f"<td>{decision.conclusion}</td>",
                f"<td><strong>{decision.wind_direction}</strong></td>",
                f"<td>{confidence_bar}<br>{decision.confidence_score:.0%}</td>",
                f"<td>{self._render_status(decision.confirmation_status)}</td>",
                f"<td>{anomaly_tags}</td>",
                f"<td><em>{decision.review_notes}</em></td>",
                f"<td class='ref-links'>{ref_links}</td>",
                "</tr>",
            ])

        html.extend([
            "</tbody>",
            "</table>",
            self._generate_boundary_section(),
            "</body>",
            "</html>",
        ])

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(html))

        print(f"决策表已导出到 {output_file}")

    def _generate_summary_section(self) -> str:
        total = len(self.decisions)
        pending = sum(1 for d in self.decisions if d.confirmation_status == ConfirmationStatus.PENDING)
        confirmed = sum(1 for d in self.decisions if d.confirmation_status == ConfirmationStatus.CONFIRMED)
        avg_confidence = sum(d.confidence_score for d in self.decisions) / total if total > 0 else 0

        boundary_summary = self.boundary_analyzer.get_summary()

        html = [
            "<div style='background:#fafafa; padding:15px; border-radius:8px; margin-bottom:20px;'>",
            "<h3>汇总统计</h3>",
            "<div style='display:flex; gap:30px;'>",
            f"<div><strong>总决策数:</strong> {total}</div>",
            f"<div><strong>已确认:</strong> <span style='color:#2e7d32'>{confirmed}</span></div>",
            f"<div><strong>待确认:</strong> <span style='color:#f57f17'>{pending}</span></div>",
            f"<div><strong>平均置信度:</strong> {avg_confidence:.0%}</div>",
            f"<div><strong>边界穿越待复核:</strong> <span style='color:#e65100'>{boundary_summary.get('pending_review', 0)}</span></div>",
            "</div>",
            "</div>",
        ]
        return "\n".join(html)

    def _generate_boundary_section(self) -> str:
        analyses = list(self.boundary_analyzer.analyses.values())
        if not analyses:
            return ""

        html = [
            "<h2>边界穿越待复核明细</h2>",
            "<table>",
            "<thead>",
            "<tr>",
            "<th>分析ID</th>",
            "<th>单位</th>",
            "<th>移动轨迹</th>",
            "<th>判定原因</th>",
            "<th>状态</th>",
            "<th>操作</th>",
            "</tr>",
            "</thead>",
            "<tbody>",
        ]

        for analysis_id, analysis in self.boundary_analyzer.analyses.items():
            unit = self.units.get(analysis.unit_id)
            unit_name = unit.name if unit else analysis.unit_id
            trajectory = f"({analysis.start_pos.x},{analysis.start_pos.y}) → ({analysis.end_pos.x},{analysis.end_pos.y})"

            html.extend([
                "<tr class='pending'>",
                f"<td>{analysis_id}</td>",
                f"<td>{unit_name}</td>",
                f"<td>{trajectory}</td>",
                f"<td>{analysis.review_reason}</td>",
                f"<td>{self._render_status(analysis.confirmation_status)}</td>",
                f"<td><a href='boundary_review://{analysis_id}'>查看复核报告</a></td>",
                "</tr>",
            ])

        html.append("</tbody></table>")
        return "\n".join(html)

    @staticmethod
    def _render_anomaly_tags(anomalies: List[AnomalyType]) -> str:
        tag_map = {
            AnomalyType.TURN_ORDER_ERROR: ('回合顺序', 'tag-turn'),
            AnomalyType.BOUNDARY_CROSSING: ('边界穿越', 'tag-boundary'),
            AnomalyType.REPORT_SETTLEMENT_MISMATCH: ('结算不符', 'tag-mismatch'),
            AnomalyType.SUSPECTED_DUPLICATE: ('重复/晚到', 'tag-duplicate'),
        }
        tags = []
        for anomaly in anomalies:
            text, css = tag_map.get(anomaly, (anomaly.value, ''))
            tags.append(f"<span class='anomaly-tag {css}'>{text}</span>")
        return " ".join(tags) if tags else "-"

    @staticmethod
    def _render_confidence_bar(score: float) -> str:
        if score >= 0.8:
            color = '#4caf50'
        elif score >= 0.5:
            color = '#ff9800'
        else:
            color = '#f44336'
        return f"<div class='confidence-bar'><div class='confidence-fill' style='width:{score*100}%; background:{color}'></div></div>"

    @staticmethod
    def _render_status(status: ConfirmationStatus) -> str:
        if status == ConfirmationStatus.CONFIRMED:
            return "<span style='color:#2e7d32'>✓ 已确认</span>"
        elif status == ConfirmationStatus.PENDING:
            return "<span style='color:#f57f17'>⏳ 待确认</span>"
        else:
            return "<span style='color:#c62828'>✗ 已驳回</span>"

    @staticmethod
    def _render_ref_links(cross_refs: Dict[str, str]) -> str:
        links = []
        for label, ref in list(cross_refs.items())[:5]:
            if ref.startswith('file://'):
                links.append(f"<a href='{ref}' title='{ref}'>{label}</a>")
            elif ref.startswith('boundary_review://'):
                links.append(f"<a href='{ref}' style='color:#ef6c00'>{label}</a>")
            else:
                links.append(f"<a href='{ref}'>{label}</a>")
        if len(cross_refs) > 5:
            links.append(f"<span style='color:#999'>+{len(cross_refs)-5} 更多</span>")
        return " ".join(links)

    def _export_json(self, output_file: str):
        data = []
        for decision in self.decisions:
            d = asdict(decision)
            d['anomalies_found'] = [a.value for a in decision.anomalies_found]
            d['confirmation_status'] = decision.confirmation_status.value
            data.append(d)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

        print(f"JSON决策表已导出到 {output_file}")

    def _export_markdown(self, output_file: str):
        md = [
            "# 峡谷风向决策报告",
            "",
            f"生成时间: {self._current_time()}",
            "",
            "## 决策明细",
            "",
            "| 决策ID | 战斗 | 回合 | 结论 | 风向 | 置信度 | 状态 | 异常 | 追溯 |",
            "|--------|------|------|------|------|--------|------|------|------|",
        ]

        for d in self.decisions:
            anomalies = ", ".join([a.value for a in d.anomalies_found]) or "-"
            status = "待确认" if d.confirmation_status == ConfirmationStatus.PENDING else "已确认"
            refs = " ".join([f"[{k}]({v})" for k, v in list(d.cross_refs.items())[:3]])

            md.append(
                f"| {d.entry_id} | {d.battle_id} | {d.round_number} | "
                f"{d.conclusion} | {d.wind_direction} | {d.confidence_score:.0%} | "
                f"{status} | {anomalies} | {refs} |"
            )

        md.extend([
            "",
            "## 边界穿越待复核",
            "",
            "| 分析ID | 单位 | 轨迹 | 判定原因 |",
            "|--------|------|------|----------|",
        ])

        for aid, analysis in self.boundary_analyzer.analyses.items():
            unit = self.units.get(analysis.unit_id)
            unit_name = unit.name if unit else analysis.unit_id
            traj = f"({analysis.start_pos.x},{analysis.start_pos.y})→({analysis.end_pos.x},{analysis.end_pos.y})"
            md.append(f"| [{aid}](boundary_review://{aid}) | {unit_name} | {traj} | {analysis.review_reason} |")

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(md))

        print(f"Markdown决策表已导出到 {output_file}")

    @staticmethod
    def _current_time() -> str:
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def lookup_decision(self, entry_id: str) -> DecisionEntry:
        for d in self.decisions:
            if d.entry_id == entry_id:
                return d
        return None

    def get_source_records(self, entry_id: str) -> List[BattleRecord]:
        decision = self.lookup_decision(entry_id)
        if not decision:
            return []
        return [self._record_index[rid] for rid in decision.contributing_records
                if rid in self._record_index]

    def get_source_units(self, entry_id: str) -> List[Unit]:
        decision = self.lookup_decision(entry_id)
        if not decision:
            return []
        return [self.units[uid] for uid in decision.contributing_units
                if uid in self.units]
