import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from ..models.models import CalculationResult, DataGap, NoteSupplement


class ReportGenerator:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_full_report(
        self,
        results: List[CalculationResult],
        session_data: Dict,
        gaps: List[Dict],
        unit_issues: List[Dict],
        threshold_chain: List[Dict],
        supplements: List[Dict],
        audit_log: List[Dict],
    ) -> str:
        sections = []
        sections.append(self._header(session_data))
        sections.append(self._threshold_section(threshold_chain))
        sections.append(self._data_quality_section(gaps, unit_issues))
        sections.append(self._results_table(results))
        sections.append(self._violations_detail(results))
        sections.append(self._supplements_section(supplements))
        sections.append(self._audit_trail(audit_log))

        report_text = "\n\n".join(sections)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{ts}.txt"
        path = self.output_dir / filename
        with open(path, "w", encoding="utf-8") as f:
            f.write(report_text)
        return str(path)

    def generate_charts_data(self, results: List[CalculationResult]) -> Dict:
        aoa_cl = [(r.angle_of_attack, r.cl) for r in results]
        aoa_cd = [(r.angle_of_attack, r.cd) for r in results]
        aoa_ld = [(r.angle_of_attack, r.ld_ratio) for r in results]
        cl_cd = [(r.cl, r.cd) for r in results]

        violations = [r for r in results if r.exceeds_threshold]
        v_aoa_cl = [(r.angle_of_attack, r.cl) for r in violations]
        v_aoa_cd = [(r.angle_of_attack, r.cd) for r in violations]

        sorted_by_aoa = sorted(results, key=lambda r: r.angle_of_attack)
        aoa_cl_sorted = [(r.angle_of_attack, r.cl) for r in sorted_by_aoa]
        aoa_cd_sorted = [(r.angle_of_attack, r.cd) for r in sorted_by_aoa]
        aoa_ld_sorted = [(r.angle_of_attack, r.ld_ratio) for r in sorted_by_aoa]

        return {
            "cl_vs_aoa": aoa_cl_sorted,
            "cd_vs_aoa": aoa_cd_sorted,
            "ld_vs_aoa": aoa_ld_sorted,
            "cl_vs_cd_curve": sorted(cl_cd, key=lambda p: p[0]),
            "violation_cl": v_aoa_cl,
            "violation_cd": v_aoa_cd,
        }

    def save_charts_data(self, results: List[CalculationResult]) -> str:
        data = self.generate_charts_data(results)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"charts_data_{ts}.json"
        path = self.output_dir / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(path)

    def _header(self, session: Dict) -> str:
        return (
            "=" * 60 + "\n" +
            "Wind Tunnel Airfoil Lift-Drag Trial Calculation Report\n" +
            "=" * 60 + "\n" +
            f"Batch:    {session.get('batch_label', 'N/A')}\n" +
            f"Session:  {session.get('session_id', 'N/A')}\n" +
            f"Start:    {session.get('started_at', 'N/A')}\n" +
            f"Finish:   {session.get('finished_at', 'N/A')}\n" +
            f"Sources:  {', '.join(session.get('source_files', []))}\n" +
            f"Active Threshold: {session.get('active_threshold_id', 'N/A')}"
        )

    def _threshold_section(self, chain: List[Dict]) -> str:
        lines = ["─" * 40, "阈值配置版本链", "─" * 40]
        for i, c in enumerate(chain):
            lines.append(
                f"  [{i+1}] ID={c.get('config_id','?')[:6]} | "
                f"创建者={c.get('created_by','?')} | "
                f"原因={c.get('reason','?')} | "
                f"时间={c.get('created_at','?')}"
            )
            vals = c.get("values", c)
            lines.append(
                f"       Cl=[{vals.get('cl_min','?')}, {vals.get('cl_max','?')}]  "
                f"Cd=[{vals.get('cd_min','?')}, {vals.get('cd_max','?')}]  "
                f"L/D=[{vals.get('ld_ratio_min','?')}, {vals.get('ld_ratio_max','?')}]  "
                f"压力上限={vals.get('pressure_max_kpa','?')}kPa  "
                f"风速上限={vals.get('wind_speed_max_mps','?')}m/s"
            )
        return "\n".join(lines)

    def _data_quality_section(self, gaps: List[Dict], issues: List[Dict]) -> str:
        lines = ["─" * 40, "数据质量报告", "─" * 40]
        lines.append(f"\n  采样缺口: {len(gaps)} 处")
        for g in gaps:
            lines.append(
                f"    缺口 {g.get('gap_id','?')}: {g.get('start','?')} ~ {g.get('end','?')} "
                f"(实际间隔 {g.get('actual_sec',0):.1f}s, 缺 {g.get('missing_samples',0)} 样本)"
            )

        lines.append(f"\n  单位混写: {len(issues)} 处")
        for ui in issues:
            lines.append(
                f"    记录 {ui.get('record_id','?')}.{ui.get('field','?')}: "
                f"{ui.get('original','?')} -> {ui.get('converted','?')} "
                f"(系数={ui.get('factor','?')})"
            )
        return "\n".join(lines)

    def _results_table(self, results: List[CalculationResult]) -> str:
        lines = ["─" * 40, "升阻试算结果明细", "─" * 40]
        lines.append(
            f"{'记录ID':<20} {'攻角':>6} {'Cl':>8} {'Cd':>8} {'L/D':>8} "
            f"{'超阈值':>6} {'阈值版本':<18} {'原始备注'}"
        )
        lines.append("-" * 100)
        for r in sorted(results, key=lambda x: x.angle_of_attack):
            flag = "!!!" if r.exceeds_threshold else ""
            lines.append(
                f"{r.record_id:<20} {r.angle_of_attack:>6.1f} {r.cl:>8.4f} {r.cd:>8.4f} "
                f"{r.ld_ratio:>8.2f} {flag:>6} {r.threshold_version:<18} {r.raw_annotation_preserved}"
            )
        return "\n".join(lines)

    def _violations_detail(self, results: List[CalculationResult]) -> str:
        violations = [r for r in results if r.exceeds_threshold]
        lines = ["─" * 40, f"超阈值记录明细 ({len(violations)} 条)", "─" * 40]
        for v in violations:
            lines.append(f"  记录: {v.record_id}")
            lines.append(f"    攻角={v.angle_of_attack:.1f}°  Cl={v.cl:.4f}  Cd={v.cd:.4f}  L/D={v.ld_ratio:.2f}")
            lines.append(f"    超阈值详情: {v.threshold_violation_detail}")
            lines.append(f"    阈值版本: {v.threshold_version}")
            lines.append(f"    缺口影响: {'是' if v.data_gap_ids else '否'}")
            lines.append(f"    单位换算: {'是' if v.unit_issue_ids else '否'}")
            lines.append(f"    原始备注: {v.raw_annotation_preserved or '(无)'}")
            lines.append(f"    数据来源: {v.source_file}")
            lines.append(f"    处理时间: {v.processing_time.isoformat()}")
            lines.append("")
        return "\n".join(lines)

    def _supplements_section(self, supplements: List[Dict]) -> str:
        lines = ["─" * 40, f"补录备注记录 ({len(supplements)} 条)", "─" * 40]
        for s in supplements:
            lines.append(f"  补录ID: {s.get('supplement_id', '?')}")
            lines.append(f"    作者: {s.get('author', '?')}")
            lines.append(f"    时间: {s.get('timestamp', '?')}")
            lines.append(f"    备注: {s.get('note_text', '?')}")
            lines.append(f"    影响记录: {s.get('affected_record_ids', [])}")
            lines.append(f"    差异: {s.get('diff_description', '无')}")
            lines.append("")
        return "\n".join(lines)

    def _audit_trail(self, audit: List[Dict]) -> str:
        lines = ["─" * 40, "审计轨迹", "─" * 40]
        for a in audit:
            lines.append(
                f"  [{a.get('timestamp','?')}] {a.get('action','?')} "
                f"by={a.get('actor','?')} | {a.get('details','?')}"
            )
            if a.get("before_value"):
                lines.append(f"    变更前: {a['before_value']}")
            if a.get("after_value"):
                lines.append(f"    变更后: {a['after_value']}")
        return "\n".join(lines)
