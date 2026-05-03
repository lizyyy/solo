import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..rules import RulesEngine
from ..timeline import Batch, CleaningRecord, ProductionTimeline


class ReportGenerator:
    """报告生成器"""

    def __init__(
        self,
        rules_engine: RulesEngine,
        output_dir: Path,
    ):
        self.rules_engine = rules_engine
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_release_report(
        self,
        timelines: Dict[str, ProductionTimeline],
        analysis_results: Dict[str, Any],
    ) -> str:
        """生成放行报告 (release_report.md)"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        report_lines = [
            "# 过敏原清线放行复核报告",
            "",
            f"**生成时间**: {now}",
            "",
            "---",
            "",
            "## 1. 执行摘要",
            "",
        ]

        summary = analysis_results.get("summary", {})
        total_transitions = summary.get("total_transitions", 0)
        pass_count = summary.get("pass_count", 0)
        fail_count = summary.get("fail_count", 0)
        warning_count = summary.get("warning_count", 0)

        status_emoji = "✅" if fail_count == 0 and warning_count == 0 else (
            "⚠️" if fail_count == 0 else "❌"
        )
        overall_status = "通过" if fail_count == 0 and warning_count == 0 else (
            "有警告" if fail_count == 0 else "未通过"
        )

        report_lines.extend([
            f"**整体状态**: {status_emoji} {overall_status}",
            "",
            f"- 总换产次数: {total_transitions}",
            f"- 通过: {pass_count}",
            f"- 警告: {warning_count}",
            f"- 未通过: {fail_count}",
            "",
            "---",
            "",
            "## 2. 各产线详情",
            "",
        ])

        for line_name, line_data in analysis_results.get("lines", {}).items():
            timeline = timelines.get(line_name)
            if not timeline:
                continue

            line_status = line_data.get("status", "UNKNOWN")
            status_icon = "✅" if line_status == "PASS" else (
                "⚠️" if line_status == "WARNING" else "❌"
            )

            report_lines.extend([
                f"### 产线: {line_name} {status_icon}",
                "",
            ])

            batches = timeline.batches
            if batches:
                report_lines.append("**批次列表**:")
                report_lines.append("")
                report_lines.append("| 批次号 | 产品 | 过敏原 | 开始时间 | 结束时间 | 跨午夜 |")
                report_lines.append("|--------|------|--------|----------|----------|--------|")
                
                for batch in batches:
                    allergens = ", ".join(batch.product_info.allergens) or "无"
                    crosses_midnight = "是" if batch.crosses_midnight() else "否"
                    report_lines.append(
                        f"| {batch.batch_id} | {batch.product_info.product_name} | "
                        f"{allergens} | {batch.start_time} | {batch.end_time} | "
                        f"{crosses_midnight} |"
                    )
                report_lines.append("")

            transitions = line_data.get("transitions", [])
            if transitions:
                report_lines.append("**换产评估**:")
                report_lines.append("")
                report_lines.append(
                    "| 上一批 | 当前批 | 状态 | 过敏原风险 | 清洁状态 | 标签状态 |"
                )
                report_lines.append(
                    "|--------|--------|------|------------|----------|----------|"
                )

                for transition in transitions:
                    result = transition.get("result", {})
                    status = result.get("overall_status", "UNKNOWN")
                    status_icon = "✅" if status == "PASS" else (
                        "⚠️" if status == "WARNING" else "❌"
                    )
                    
                    allergen_status = "是" if result.get("allergen_risk") else "否"
                    cleaning_status = "通过" if result.get("cleaning_ok") else "未通过"
                    label_status = "通过" if result.get("label_ok") else "未通过"

                    report_lines.append(
                        f"| {result.get('prev_batch')} | {result.get('next_batch')} | "
                        f"{status_icon} {status} | {allergen_status} | "
                        f"{cleaning_status} | {label_status} |"
                    )
                report_lines.append("")

            risks = line_data.get("risks", [])
            if risks:
                report_lines.append("**风险详情**:")
                report_lines.append("")
                for i, risk in enumerate(risks, 1):
                    report_lines.append(f"{i}. **{risk.get('type', '未知风险')}**")
                    report_lines.append(f"   - {risk.get('message', '')}")
                    if risk.get("recommendation"):
                        report_lines.append(f"   - 建议: {risk.get('recommendation')}")
                    report_lines.append("")

            report_lines.append("---")
            report_lines.append("")

        special_issues = analysis_results.get("special_issues", {})
        
        midnight_transitions = special_issues.get("midnight_transitions", [])
        if midnight_transitions:
            report_lines.append("## 3. 特殊情况: 跨午夜批次")
            report_lines.append("")
            report_lines.append("以下批次跨越午夜运行，需特别关注:")
            report_lines.append("")
            report_lines.append(
                "| 产线 | 批次号 | 产品 | 开始时间 | 结束时间 | 午夜后运行时长 |"
            )
            report_lines.append(
                "|------|--------|------|----------|----------|----------------|"
            )
            
            for mt in midnight_transitions:
                report_lines.append(
                    f"| {mt.get('production_line')} | {mt.get('batch_id')} | "
                    f"{mt.get('product_name')} | {mt.get('start_time')} | "
                    f"{mt.get('end_time')} | {mt.get('hours_after_midnight')} 小时 |"
                )
            report_lines.append("")
            report_lines.append("> ⚠️ 跨午夜批次可能涉及换班交接，需确认清洁验证记录完整性。")
            report_lines.append("")

        equipment_conflicts = special_issues.get("equipment_conflicts", [])
        if equipment_conflicts:
            report_lines.append("## 4. 设备冲突警告")
            report_lines.append("")
            report_lines.append("**检测到设备占用冲突，需立即处理**:")
            report_lines.append("")
            report_lines.append(
                "| 设备 | 批次A | 批次B | 重叠时长 | 状态 |"
            )
            report_lines.append(
                "|------|-------|-------|----------|------|"
            )
            
            for conflict in equipment_conflicts:
                report_lines.append(
                    f"| {conflict.get('equipment')} | {conflict.get('batch_a')} | "
                    f"{conflict.get('batch_b')} | {conflict.get('overlap_minutes')} 分钟 | "
                    f"❌ 冲突 |"
                )
            report_lines.append("")
            report_lines.append("> ❌ 设备冲突表示同一设备被多个批次同时占用，存在严重生产排程错误。")
            report_lines.append("")

        missing_swabs = special_issues.get("missing_swab_points", [])
        if missing_swabs:
            report_lines.append("## 5. 缺失 Swab 检测点")
            report_lines.append("")
            report_lines.append("以下换产点缺少必要的 swab 检测记录:")
            report_lines.append("")
            for item in missing_swabs:
                report_lines.append(f"- **产线**: {item.get('production_line')}")
                report_lines.append(f"  - 换产: {item.get('prev_batch')} → {item.get('next_batch')}")
                report_lines.append(f"  - 缺失点位: {', '.join(item.get('missing_points', []))}")
                report_lines.append("")

        report_lines.extend([
            "---",
            "",
            "## 6. 放行建议",
            "",
        ])

        if fail_count > 0:
            report_lines.append(
                "❌ **不建议放行**: 存在未通过的风险项，需先完成整改。"
            )
            report_lines.append("")
            report_lines.append("### 必须完成的整改项:")
            for line_data in analysis_results.get("lines", {}).values():
                for transition in line_data.get("transitions", []):
                    result = transition.get("result", {})
                    if result.get("overall_status") in ["FAIL", "WARNING"]:
                        if result.get("risks"):
                            for risk in result["risks"]:
                                report_lines.append(f"- [ ] {risk}")
                        if result.get("warnings"):
                            for warning in result["warnings"]:
                                report_lines.append(f"- [ ] {warning}")
        elif warning_count > 0:
            report_lines.append(
                "⚠️ **条件放行**: 存在警告项，建议确认后放行。"
            )
            report_lines.append("")
            report_lines.append("### 需要确认的事项:")
            for line_data in analysis_results.get("lines", {}).values():
                for transition in line_data.get("transitions", []):
                    result = transition.get("result", {})
                    if result.get("warnings"):
                        for warning in result["warnings"]:
                            report_lines.append(f"- [ ] {warning}")
        else:
            report_lines.append(
                "✅ **建议放行**: 所有换产点均通过风险评估。"
            )

        report_lines.extend([
            "",
            "---",
            "",
            "## 7. 附录",
            "",
            f"- 规则配置: {self.rules_engine.allergen_rules.rules}",
            f"- 报告生成时间: {now}",
            "",
        ])

        report_content = "\n".join(report_lines)
        report_path = self.output_dir / "release_report.md"
        report_path.write_text(report_content, encoding="utf-8")
        
        return report_content

    def generate_risks_csv(
        self,
        analysis_results: Dict[str, Any],
    ) -> str:
        """生成风险清单 (risks.csv)"""
        risks = []

        for line_name, line_data in analysis_results.get("lines", {}).items():
            for transition in line_data.get("transitions", []):
                result = transition.get("result", {})
                prev_batch = result.get("prev_batch", "")
                next_batch = result.get("next_batch", "")
                status = result.get("overall_status", "UNKNOWN")

                if status != "PASS":
                    for risk in result.get("risks", []):
                        risks.append({
                            "production_line": line_name,
                            "prev_batch": prev_batch,
                            "next_batch": next_batch,
                            "risk_type": "allergen",
                            "severity": "high",
                            "message": risk,
                            "recommendation": "完成清洁验证并确认 swab 检测",
                        })
                    
                    for warning in result.get("warnings", []):
                        risks.append({
                            "production_line": line_name,
                            "prev_batch": prev_batch,
                            "next_batch": next_batch,
                            "risk_type": "warning",
                            "severity": "medium",
                            "message": warning,
                            "recommendation": "核实相关记录",
                        })

        special_issues = analysis_results.get("special_issues", {})
        
        for conflict in special_issues.get("equipment_conflicts", []):
            risks.append({
                "production_line": conflict.get("production_line", "unknown"),
                "prev_batch": conflict.get("batch_a", ""),
                "next_batch": conflict.get("batch_b", ""),
                "risk_type": "equipment_conflict",
                "severity": "critical",
                "message": conflict.get("message", "设备占用冲突"),
                "recommendation": "立即修正生产排程",
            })

        for mt in special_issues.get("midnight_transitions", []):
            risks.append({
                "production_line": mt.get("production_line", "unknown"),
                "prev_batch": mt.get("batch_id", ""),
                "next_batch": "",
                "risk_type": "midnight_transition",
                "severity": "low",
                "message": mt.get("message", "跨午夜批次"),
                "recommendation": "确认换班交接时的清洁记录完整性",
            })

        for item in special_issues.get("missing_swab_points", []):
            for point in item.get("missing_points", []):
                risks.append({
                    "production_line": item.get("production_line", "unknown"),
                    "prev_batch": item.get("prev_batch", ""),
                    "next_batch": item.get("next_batch", ""),
                    "risk_type": "missing_swab",
                    "severity": "high",
                    "message": f"缺少 swab 检测点位: {point}",
                    "recommendation": "补充完成该点位的 swab 检测",
                })

        if risks:
            fieldnames = [
                "production_line",
                "prev_batch",
                "next_batch",
                "risk_type",
                "severity",
                "message",
                "recommendation",
            ]
            
            csv_path = self.output_dir / "risks.csv"
            with open(csv_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for risk in risks:
                    writer.writerow(risk)

        return str(self.output_dir / "risks.csv")


def analyze_timelines(
    timelines: Dict[str, ProductionTimeline],
    rules_engine: RulesEngine,
) -> Dict[str, Any]:
    """分析所有时间线，返回综合结果"""
    results = {
        "summary": {
            "total_transitions": 0,
            "pass_count": 0,
            "fail_count": 0,
            "warning_count": 0,
        },
        "lines": {},
        "special_issues": {
            "midnight_transitions": [],
            "equipment_conflicts": [],
            "missing_swab_points": [],
        },
    }

    for line_name, timeline in timelines.items():
        line_results = {
            "status": "PASS",
            "transitions": [],
            "risks": [],
        }

        transitions = timeline.get_transitions()
        
        for transition in transitions:
            prev_batch = transition["prev_batch"]
            next_batch = transition["next_batch"]
            
            cleaning_records = timeline.get_cleaning_records_in_range(
                prev_batch.end_time,
                next_batch.start_time,
            )

            label_switch_time = next_batch.label_switch_time

            evaluation = rules_engine.evaluate_transition(
                prev_batch,
                next_batch,
                cleaning_records,
                label_switch_time,
            )

            transition_result = {
                "prev_batch_id": prev_batch.batch_id,
                "next_batch_id": next_batch.batch_id,
                "result": evaluation,
            }
            line_results["transitions"].append(transition_result)

            if evaluation["overall_status"] == "FAIL":
                line_results["status"] = "FAIL"
                for risk in evaluation["risks"]:
                    line_results["risks"].append({
                        "type": "allergen_risk",
                        "message": risk,
                        "recommendation": "完成清洁验证",
                    })
            elif evaluation["overall_status"] == "WARNING" and line_results["status"] == "PASS":
                line_results["status"] = "WARNING"
                for warning in evaluation["warnings"]:
                    line_results["risks"].append({
                        "type": "warning",
                        "message": warning,
                        "recommendation": "核实相关记录",
                    })

        midnight_transitions = timeline.get_midnight_transitions()
        for mt in midnight_transitions:
            mt["production_line"] = line_name
            results["special_issues"]["midnight_transitions"].append(mt)

        equipment_conflicts = timeline.check_equipment_conflicts()
        for conflict in equipment_conflicts:
            conflict["production_line"] = line_name
            conflict["message"] = (
                f"设备 '{conflict['equipment']}' 冲突: 批次 {conflict['batch_a']} "
                f"与批次 {conflict['batch_b']} 重叠 {conflict['overlap_minutes']} 分钟"
            )
            results["special_issues"]["equipment_conflicts"].append(conflict)
            line_results["risks"].append({
                "type": "equipment_conflict",
                "message": conflict["message"],
                "recommendation": "修正生产排程",
            })

        results["lines"][line_name] = line_results

        results["summary"]["total_transitions"] += len(transitions)
        for transition in line_results["transitions"]:
            status = transition["result"]["overall_status"]
            if status == "PASS":
                results["summary"]["pass_count"] += 1
            elif status == "FAIL":
                results["summary"]["fail_count"] += 1
            elif status == "WARNING":
                results["summary"]["warning_count"] += 1

    return results
