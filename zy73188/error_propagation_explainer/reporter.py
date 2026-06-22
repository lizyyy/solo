"""输出报告生成器 - 明细/汇总/解释报告/异常队列分离"""

import json
import os
from datetime import datetime
from typing import List, Dict, Any

from .models import (
    CaseRecord,
    CaseStatus,
    ProcessingSummary,
    AnomalyRecord,
    EvidenceStatus,
    CalculationResult,
)
from .formulas import get_formula


class Reporter:
    """报告生成器"""

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_all(
        self,
        cases: List[CaseRecord],
        anomalies: List[AnomalyRecord],
        summary: ProcessingSummary,
        total_files: int,
    ) -> Dict[str, str]:
        """生成所有输出文件

        Returns:
            文件路径字典: {类型: 路径}
        """
        paths = {}
        paths["details_json"] = self._write_json(
            self._build_details(cases), "明细.json"
        )
        paths["details_txt"] = self._write_text(
            self._build_details_text(cases), "明细.txt"
        )
        paths["summary_json"] = self._write_json(
            summary.to_dict(), "汇总.json"
        )
        paths["summary_txt"] = self._write_text(
            self._build_summary_text(summary, total_files), "汇总.txt"
        )
        paths["explanation"] = self._write_text(
            self._build_explanation_report(cases, summary), "解释报告.txt"
        )
        paths["anomalies_json"] = self._write_json(
            [a.to_dict() for a in anomalies], "异常队列.json"
        )
        paths["anomalies_txt"] = self._write_text(
            self._build_anomaly_text(anomalies), "异常队列.txt"
        )
        return paths

    def _write_json(self, data: Any, filename: str) -> str:
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath

    def _write_text(self, content: str, filename: str) -> str:
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath

    def _build_details(self, cases: List[CaseRecord]) -> Dict[str, Any]:
        """构建明细 JSON"""
        return {
            "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "题目总数": len(cases),
            "题目列表": [c.to_dict() for c in cases],
        }

    def _build_details_text(self, cases: List[CaseRecord]) -> str:
        """构建明细 TXT"""
        lines = []
        lines.append("=" * 80)
        lines.append("📋 误差传播分析 - 明细报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"题目总数: {len(cases)}")
        lines.append("")

        for i, case in enumerate(cases, 1):
            status_icon = self._status_icon(case.status)
            lines.append("-" * 80)
            lines.append(f"[{i}] {status_icon} {case.case_id}: {case.title}")
            lines.append(f"    状态: {case.status.value}  |  文件: {case.file_name}")
            lines.append(f"    公式: {case.formula_name_resolved or case.formula_name}")

            if case.warnings:
                for w in case.warnings:
                    lines.append(f"    ⚠️ {w}")

            lines.append(f"    描述: {case.description or '(无)'}")
            lines.append(f"    变量:")

            for var in case.variables:
                ev_tag = ""
                if var.evidence_status == EvidenceStatus.PENDING:
                    ev_tag = " [待确认]"
                elif var.evidence_status == EvidenceStatus.MISSING:
                    ev_tag = " [缺证据]"
                boundary_tag = " [边界]" if var.is_boundary else ""
                dup_tag = " [重复]" if case.is_duplicate and case.status == CaseStatus.MERGED else ""

                ru = var.relative_uncertainty * 100
                ru_str = f"{ru:.1f}%" if ru != float('inf') else "∞"

                lines.append(
                    f"      • {var.name} ({var.symbol}) = {var.value} ± {var.uncertainty} {var.unit}"
                    f"{ev_tag}{boundary_tag}{dup_tag}"
                )
                lines.append(f"        相对不确定度: {ru_str}")
                if var.evidence_source:
                    lines.append(f"        来源: {var.evidence_source}")

            if case.result:
                r = case.result
                lines.append(f"    结果:")
                lines.append(f"      数值 = {r.result_value:.6f} ± {r.result_uncertainty:.6f} {r.result_unit}")
                lines.append(f"      相对不确定度 = {r.relative_uncertainty_pct:.2f}%")
                if r.dominant_contribution:
                    lines.append(f"      主要误差来源: {r.dominant_contribution}")
                lines.append(f"      各变量贡献:")
                for var, pct in sorted(r.uncertainty_contributions.items(), key=lambda x: -x[1]):
                    bar_len = int(pct / 5)
                    bar = "█" * bar_len + "░" * (20 - bar_len)
                    lines.append(f"        {var}: [{bar}] {pct:.1f}%")

            if case.status == CaseStatus.SUSPENDED:
                lines.append(f"    ⏸️ 已挂起: 重复样本数值不一致，需核实后放行")
            elif case.status == CaseStatus.MERGED:
                lines.append(f"    🔀 已合并到: {case.merged_into}")
            elif case.status == CaseStatus.FAILED:
                lines.append(f"    ❌ 失败: {case.error_message}")

            if case.result and case.result.calc_trace:
                lines.append(f"    计算过程:")
                for line in case.result.calc_trace:
                    lines.append(f"      {line}")

            lines.append("")

        return "\n".join(lines)

    def _build_summary_text(self, summary: ProcessingSummary, total_files: int) -> str:
        """构建汇总 TXT - 不含异常详情"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 误差传播分析 - 汇总报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("--- 处理统计 ---")
        lines.append(f"  输入文件总数:   {total_files}")
        lines.append(f"  解析题目总数:   {summary.total_cases}")
        lines.append(f"  成功计算:       {summary.success_count}")
        lines.append(f"  挂起:           {summary.suspended_count}")
        lines.append(f"  失败:           {summary.failed_count}")
        lines.append(f"  合并重复:       {summary.merged_count} 条")
        lines.append(f"  边界样本:       {summary.boundary_count} 个")
        lines.append(f"  异常总数:       {summary.total_anomalies} 条 (详见 异常队列.txt)")
        lines.append("")
        lines.append("--- 证据统计 ---")
        lines.append(f"  已确认证据:     {summary.confirmed_evidence_count} 条")
        lines.append(f"  待确认证据:     {summary.pending_evidence_count} 条")
        lines.append(f"  缺失证据:       {summary.missing_evidence_count} 条")
        lines.append("")
        lines.append("--- 关键发现 ---")
        if summary.key_findings:
            for i, finding in enumerate(summary.key_findings, 1):
                lines.append(f"  {i}. {finding}")
        else:
            lines.append("  (无)")
        lines.append("")
        lines.append("--- 说明 ---")
        lines.append("  异常详情请查看「异常队列.txt」，不与本汇总混在一起。")
        lines.append("  每条题目的计算详情请查看「明细.txt」或「明细.json」。")
        lines.append("  面向非技术评审的说明请查看「解释报告.txt」。")
        lines.append("=" * 80)
        return "\n".join(lines)

    def _build_explanation_report(
        self,
        cases: List[CaseRecord],
        summary: ProcessingSummary,
    ) -> str:
        """构建解释报告 - 面向非技术人员"""
        lines = []
        lines.append("=" * 80)
        lines.append("📖 误差传播图表解释 - 评审会专用报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("━" * 80)
        lines.append("一、这是什么？")
        lines.append("━" * 80)
        lines.append("")
        lines.append("我们在做的事情叫做「误差传播分析」。简单来说：")
        lines.append("")
        lines.append("  1. 我们用尺子、天平等工具测量了一些东西（比如书的长宽高）")
        lines.append("  2. 每次测量都会有一点点不准（这就是「误差」）")
        lines.append("  3. 当我们用这些测量值计算其他东西时（比如面积 = 长 × 宽）")
        lines.append("  4. 每次测量的小误差会「传播」到最终结果中")
        lines.append("  5. 我们要算清楚：最终结果的不准程度有多大？")
        lines.append("")
        lines.append(f"本次共处理了 {summary.total_cases} 道题目，其中：")
        lines.append(f"  ✅ 成功计算 {summary.success_count} 道")
        lines.append(f"  ⏸️ 挂起 {summary.suspended_count} 道（重复样本数值不一致）")
        lines.append(f"  ❌ 失败 {summary.failed_count} 道（解析错误或空集合）")
        lines.append(f"  🔀 合并重复 {summary.merged_count} 条（内容完全一致）")
        lines.append("")

        lines.append("━" * 80)
        lines.append("二、数字从哪来？（每个关键数字的来源）")
        lines.append("━" * 80)
        lines.append("")
        lines.append("以下列出所有参与计算的题目及其数据来源：")
        lines.append("")

        for i, case in enumerate(cases, 1):
            if case.status == CaseStatus.MERGED:
                lines.append(f"  [{i}] 🔀 {case.case_id}: {case.title} (已合并到主记录)")
                continue
            if case.status == CaseStatus.FAILED:
                lines.append(f"  [{i}] ❌ {case.case_id}: {case.title}")
                lines.append(f"      失败原因: {case.error_message}")
                lines.append("")
                continue

            status = "✅" if case.status == CaseStatus.SUCCESS else "⏸️"
            lines.append(f"  [{i}] {status} {case.case_id}: {case.title}")
            lines.append(f"      公式: {case.formula_name_resolved or case.formula_name}")
            lines.append(f"      文件: {case.file_name}")

            if case.warnings:
                for w in case.warnings:
                    lines.append(f"      ⚠️ {w}")

            lines.append(f"      数据来源:")
            for var in case.variables:
                ev_status = ""
                if var.evidence_status == EvidenceStatus.PENDING:
                    ev_status = " (待确认)"
                elif var.evidence_status == EvidenceStatus.MISSING:
                    ev_status = " (缺证据!)"

                boundary = " [边界样本]" if var.is_boundary else ""
                lines.append(
                    f"        • {var.name} = {var.value} ± {var.uncertainty} {var.unit}{ev_status}{boundary}"
                )
                if var.evidence_source:
                    lines.append(f"          ← 来自: {var.evidence_source}")

            if case.result:
                r = case.result
                lines.append(f"      → 结果: {r.result_value:.4f} ± {r.result_uncertainty:.4f} {r.result_unit}")
                lines.append(f"        相对不确定度: {r.relative_uncertainty_pct:.2f}%")
                if r.dominant_contribution:
                    lines.append(f"        最大的误差来源: {r.dominant_contribution}")
            elif case.status == CaseStatus.SUSPENDED:
                lines.append(f"      → ⏸️ 已挂起，暂无计算结果")

            lines.append("")

        lines.append("━" * 80)
        lines.append("三、误差传播怎么算出来的？")
        lines.append("━" * 80)
        lines.append("")
        lines.append("计算分三步：")
        lines.append("")
        lines.append("  第1步 - 算最佳估计值:")
        lines.append("    把测量值代入公式，算出结果。")
        lines.append("    比如面积 S = a × b = 21.0 × 14.8 = 310.8")
        lines.append("")
        lines.append("  第2步 - 算偏导数:")
        lines.append("    对每个变量求偏导，表示该变量变化一点点时结果变化多少。")
        lines.append("    比如 ∂S/∂a = b，表示长度每变 1 单位，面积变 b 单位。")
        lines.append("")
        lines.append("  第3步 - 算合成不确定度:")
        lines.append("    用公式 u_c = √(Σ (∂f/∂x)² × u²(x)) 把所有误差合成。")
        lines.append("    哪个变量的「偏导数 × 误差」最大，它就是主要误差来源。")
        lines.append("")

        success_cases = [c for c in cases if c.status == CaseStatus.SUCCESS and c.result]
        if success_cases:
            lines.append("以下是各题目的计算示例：")
            lines.append("")
            for case in success_cases[:3]:
                r = case.result
                lines.append(f"  📐 {case.case_id} ({case.formula_name_resolved}):")
                lines.append(f"     结果 = {r.result_value:.4f} ± {r.result_uncertainty:.4f} {r.result_unit}")
                lines.append(f"     相对不确定度 = {r.relative_uncertainty_pct:.2f}%")
                if r.dominant_contribution:
                    lines.append(f"     主要误差来源 = {r.dominant_contribution}")
                lines.append("")

        lines.append("━" * 80)
        lines.append("四、哪些证据已确认？")
        lines.append("━" * 80)
        lines.append("")
        confirmed = []
        pending = []
        missing = []

        for case in cases:
            if case.status == CaseStatus.MERGED:
                continue
            for var in case.variables:
                entry = (case, var)
                if var.evidence_status == EvidenceStatus.CONFIRMED:
                    confirmed.append(entry)
                elif var.evidence_status == EvidenceStatus.PENDING:
                    pending.append(entry)
                else:
                    missing.append(entry)

        lines.append(f"✅ 已确认证据 ({len(confirmed)} 条):")
        if confirmed:
            for case, var in confirmed:
                lines.append(f"  • {case.case_id} / {var.name} ({var.symbol})")
                if var.evidence_source:
                    lines.append(f"    来源: {var.evidence_source}")
        else:
            lines.append("  (无)")
        lines.append("")

        lines.append("━" * 80)
        lines.append("五、哪些记录需要补证据？")
        lines.append("━" * 80)
        lines.append("")
        lines.append(f"⏳ 待确认证据 ({len(pending)} 条):")
        if pending:
            for case, var in pending:
                lines.append(f"  • {case.case_id} / {var.name} ({var.symbol})")
                lines.append(f"    值: {var.value} ± {var.uncertainty} {var.unit}")
                if var.evidence_source:
                    lines.append(f"    来源: {var.evidence_source}")
                lines.append(f"    👉 需要相关责任人确认数据有效性")
        else:
            lines.append("  (无)")
        lines.append("")

        lines.append(f"❓ 缺失证据 ({len(missing)} 条):")
        if missing:
            for case, var in missing:
                lines.append(f"  • {case.case_id} / {var.name} ({var.symbol})")
                lines.append(f"    值: {var.value} ± {var.uncertainty} {var.unit}")
                if var.evidence_source:
                    lines.append(f"    来源: {var.evidence_source}")
                lines.append(f"    👉 需要补充测量记录或校准证书")
        else:
            lines.append("  (无)")
        lines.append("")

        lines.append("━" * 80)
        lines.append("六、需要注意的问题")
        lines.append("━" * 80)
        lines.append("")
        if summary.key_findings:
            for i, finding in enumerate(summary.key_findings, 1):
                lines.append(f"  {i}. {finding}")
        else:
            lines.append("  ✅ 未发现需要特别注意的问题")
        lines.append("")

        lines.append("━" * 80)
        lines.append("七、一句话总结")
        lines.append("━" * 80)
        lines.append("")
        if summary.success_count > 0 and summary.suspended_count == 0 and summary.failed_count == 0:
            lines.append(f"  ✅ 全部 {summary.success_count} 道题目计算完成，结果可信。")
        else:
            parts = []
            if summary.success_count > 0:
                parts.append(f"{summary.success_count} 道成功")
            if summary.suspended_count > 0:
                parts.append(f"{summary.suspended_count} 道挂起待核实")
            if summary.failed_count > 0:
                parts.append(f"{summary.failed_count} 道失败需修正")
            lines.append(f"  📊 本次共处理 {summary.total_cases} 道题目：" + "，".join(parts) + "。")
            lines.append(f"     请先处理挂起和失败的题目，再进行最终评审。")
        lines.append("")
        lines.append("=" * 80)
        return "\n".join(lines)

    def _build_anomaly_text(self, anomalies: List[AnomalyRecord]) -> str:
        """构建异常队列 TXT - 独立于汇总"""
        lines = []
        lines.append("=" * 80)
        lines.append("🚨 误差传播分析 - 异常队列 (独立于汇总)")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"异常总数: {len(anomalies)}")
        lines.append("")

        type_counts = {}
        for record in anomalies:
            t = record.anomaly_type.value
            type_counts[t] = type_counts.get(t, 0) + 1

        lines.append("--- 异常分类统计 ---")
        for t, c in sorted(type_counts.items()):
            lines.append(f"  {t}: {c} 条")
        lines.append("")

        lines.append("--- 详细异常记录 ---")
        lines.append("")
        for i, record in enumerate(anomalies, 1):
            icon = self._severity_icon(record.severity)
            lines.append(f"[{i}] {icon} {record.anomaly_type.value.upper()} ({record.severity.value})")
            lines.append(f"    消息: {record.message}")
            if record.case_id:
                lines.append(f"    题目: {record.case_id}")
            if record.file_name:
                lines.append(f"    文件: {record.file_name}")
            if record.details:
                lines.append(f"    详情:")
                for k, v in record.details.items():
                    if isinstance(v, (dict, list)):
                        lines.append(f"      {k}: {json.dumps(v, ensure_ascii=False)}")
                    else:
                        lines.append(f"      {k}: {v}")
            if record.resolution_hint:
                lines.append(f"    建议: {record.resolution_hint}")
            lines.append("")

        lines.append("=" * 80)
        return "\n".join(lines)

    def _status_icon(self, status: CaseStatus) -> str:
        return {
            CaseStatus.SUCCESS: "✅",
            CaseStatus.SUSPENDED: "⏸️",
            CaseStatus.FAILED: "❌",
            CaseStatus.MERGED: "🔀",
            CaseStatus.SKIPPED: "⏭️",
        }.get(status, "?")

    def _severity_icon(self, severity) -> str:
        return {
            "info": "🔵",
            "warning": "🟡",
            "error": "🔴",
            "critical": "💔",
        }.get(severity.value, "?")
