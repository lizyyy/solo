"""报告生成器 - 评审解释文档和复核人报告"""

import os
import json
from typing import List, Dict, Any
from datetime import datetime

from .models import (
    MeasurementVariable,
    PropagationResult,
    AnalysisSummary,
    ReviewerReport,
    EvidenceStatus,
)
from .exceptions import AnomalyQueue, AnomalyRecord, AnomalyType


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_review_explanation(
        self,
        variables: List[MeasurementVariable],
        results: List[PropagationResult],
        summary: AnalysisSummary,
        anomaly_queue: AnomalyQueue,
    ) -> str:
        """生成面向非技术人员的评审解释文档
        
        这是给不看代码的人看的，要讲清楚：
        - 我们在做什么
        - 数字从哪来（要有线索）
        - 结果是什么
        - 有什么问题需要注意
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        lines = []
        lines.append("=" * 80)
        lines.append("📊 误差传播图表解释 - 评审会专用")
        lines.append("=" * 80)
        lines.append(f"生成时间: {timestamp}")
        lines.append("")
        
        lines.append("---")
        lines.append("📖 这是什么？")
        lines.append("---")
        lines.append("")
        lines.append("我们在做的事情叫做「误差传播分析」。简单来说：")
        lines.append("")
        lines.append("  1. 我们用尺子、天平等工具测量了一些东西（比如书的长宽高）")
        lines.append("  2. 每次测量都会有一点点不准（这就是「误差」）")
        lines.append("  3. 当我们用这些测量值计算其他东西时（比如面积 = 长 × 宽）")
        lines.append("  4. 每次测量的小误差会「传播」到最终结果中")
        lines.append("  5. 我们要算清楚：最终结果的不准程度有多大？")
        lines.append("")
        
        lines.append("---")
        lines.append("🔍 数字从哪来？")
        lines.append("---")
        lines.append("")
        lines.append("所有测量值都有明确来源，可追溯：")
        lines.append("")
        
        for i, var in enumerate(variables, 1):
            status_icon = "✅" if var.evidence_status == EvidenceStatus.CONFIRMED else "⏳" if var.evidence_status == EvidenceStatus.PENDING else "❓"
            lines.append(f"  {status_icon} [{i}] {var.name} = {var.value} ± {var.uncertainty} {var.unit}")
            lines.append(f"      符号: {var.symbol}")
            lines.append(f"      测量方式: {var.description or '未说明'}")
            if var.evidence_source:
                lines.append(f"      证据来源: {var.evidence_source}")
            if var.evidence_notes:
                lines.append(f"      备注: {var.evidence_notes}")
            lines.append(f"      样本编号: {var.sample_id}")
            lines.append("")
        
        lines.append("---")
        lines.append("📐 我们用了哪些公式？")
        lines.append("---")
        lines.append("")
        
        formulas_used = set()
        for result in results:
            if result.formula.name not in formulas_used:
                formulas_used.add(result.formula.name)
                lines.append(f"  • {result.formula.name}: {result.formula.expression}")
                lines.append(f"    {result.formula.description}")
                lines.append("")
        
        lines.append("---")
        lines.append("📈 计算结果")
        lines.append("---")
        lines.append("")
        
        for result in results:
            if result.suspended:
                lines.append(f"  ⏸️ {result.formula.name}: [已挂起] {result.suspension_reason}")
                lines.append("")
                continue
            
            ru = result.relative_uncertainty * 100
            lines.append(f"  🎯 {result.formula.name}:")
            lines.append(f"     结果 = {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}")
            lines.append(f"     相对不确定度: {ru:.2f}%")
            lines.append(f"     主要误差来源: {result.dominant_contribution}")
            
            if result.uncertainty_contributions:
                lines.append(f"     各变量贡献:")
                for var, pct in sorted(result.uncertainty_contributions.items(), key=lambda x: -x[1]):
                    bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
                    lines.append(f"       {var}: {bar} {pct:.1f}%")
            lines.append("")
        
        lines.append("---")
        lines.append("⚠️ 需要注意的问题")
        lines.append("---")
        lines.append("")
        
        anomalies = anomaly_queue.get_all()
        if anomalies:
            for i, record in enumerate(anomalies, 1):
                severity_icon = "🔵" if record.severity.value == "info" else "🟡" if record.severity.value == "warning" else "🔴" if record.severity.value == "error" else "💔"
                lines.append(f"  {severity_icon} [{i}] {record.message}")
                if record.resolution_hint:
                    lines.append(f"      建议: {record.resolution_hint}")
                lines.append("")
        else:
            lines.append("  ✅ 未发现异常")
            lines.append("")
        
        lines.append("---")
        lines.append("📋 一句话总结")
        lines.append("---")
        lines.append("")
        
        if summary.key_findings:
            for finding in summary.key_findings:
                lines.append(f"  • {finding}")
        else:
            lines.append("  • 计算完成，结果可信。")
        lines.append("")
        
        lines.append("=" * 80)
        lines.append("📎 附录：完整计算过程")
        lines.append("=" * 80)
        lines.append("")
        
        for result in results:
            for line in result.calculation_trace:
                lines.append(f"  {line}")
            lines.append("")
        
        content = "\n".join(lines)
        
        filename = f"评审解释文档_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
    
    def generate_reviewer_report(
        self,
        reviewer_report: ReviewerReport,
        variables: List[MeasurementVariable],
        results: List[PropagationResult],
    ) -> str:
        """生成复核人视角的报告
        
        把「已确认」和「待补证据」说清楚
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        lines = []
        lines.append("=" * 80)
        lines.append("🔍 误差传播分析 - 复核人报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {timestamp}")
        lines.append("")
        
        lines.append("---")
        lines.append("✅ 已确认的证据")
        lines.append("---")
        lines.append("")
        
        if reviewer_report.confirmed_evidence:
            lines.append(f"共 {len(reviewer_report.confirmed_evidence)} 项证据已确认：")
            lines.append("")
            for item in reviewer_report.confirmed_evidence:
                status = "[边界]" if item.get("is_boundary") else "[重复]" if item.get("is_duplicate") else "[正常]"
                lines.append(f"  ✅ {status} {item['name']} ({item['symbol']})")
                lines.append(f"     数值: {item['value']} ± {item['uncertainty']} {item['unit']}")
                lines.append(f"     来源: {item.get('evidence_source', '未指定')}")
                if item.get("evidence_notes"):
                    lines.append(f"     备注: {item['evidence_notes']}")
                lines.append(f"     样本ID: {item['sample_id']}")
                lines.append("")
        else:
            lines.append("  （无）")
            lines.append("")
        
        lines.append("---")
        lines.append("⏳ 待确认的证据")
        lines.append("---")
        lines.append("")
        
        if reviewer_report.pending_evidence:
            lines.append(f"共 {len(reviewer_report.pending_evidence)} 项证据待确认：")
            lines.append("")
            for item in reviewer_report.pending_evidence:
                status = "[边界]" if item.get("is_boundary") else "[重复]" if item.get("is_duplicate") else "[正常]"
                lines.append(f"  ⏳ {status} {item['name']} ({item['symbol']})")
                lines.append(f"     数值: {item['value']} ± {item['uncertainty']} {item['unit']}")
                lines.append(f"     来源: {item.get('evidence_source', '未指定')}")
                if item.get("evidence_notes"):
                    lines.append(f"     备注: {item['evidence_notes']}")
                lines.append(f"     样本ID: {item['sample_id']}")
                lines.append(f"     👉 需要: 请相关责任人确认数据有效性")
                lines.append("")
        else:
            lines.append("  （无）")
            lines.append("")
        
        lines.append("---")
        lines.append("❓ 缺失的证据")
        lines.append("---")
        lines.append("")
        
        if reviewer_report.missing_evidence:
            lines.append(f"共 {len(reviewer_report.missing_evidence)} 项证据缺失：")
            lines.append("")
            for item in reviewer_report.missing_evidence:
                status = "[边界]" if item.get("is_boundary") else "[重复]" if item.get("is_duplicate") else "[正常]"
                lines.append(f"  ❓ {status} {item['name']} ({item['symbol']})")
                lines.append(f"     数值: {item['value']} ± {item['uncertainty']} {item['unit']}")
                lines.append(f"     来源: {item.get('evidence_source', '未指定')}")
                if item.get("evidence_notes"):
                    lines.append(f"     备注: {item['evidence_notes']}")
                lines.append(f"     样本ID: {item['sample_id']}")
                lines.append(f"     👉 需要: 补充测量记录或校准证书")
                lines.append("")
        else:
            lines.append("  （无）")
            lines.append("")
        
        lines.append("---")
        lines.append("💡 复核建议")
        lines.append("---")
        lines.append("")
        
        for i, rec in enumerate(reviewer_report.recommendations, 1):
            lines.append(f"  {i}. {rec}")
        lines.append("")
        
        lines.append("---")
        lines.append("📊 计算结果复核")
        lines.append("---")
        lines.append("")
        
        for result in results:
            if result.suspended:
                lines.append(f"  ⏸️ {result.formula.name}: [已挂起] {result.suspension_reason}")
                lines.append(f"     复核状态: ❌ 待处理重复样本后复核")
            else:
                ru = result.relative_uncertainty * 100
                lines.append(f"  ✅ {result.formula.name}:")
                lines.append(f"     结果: {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}")
                lines.append(f"     相对不确定度: {ru:.2f}%")
                lines.append(f"     复核状态: ⚪ 待复核人签字确认")
            lines.append("")
        
        lines.append("---")
        lines.append("✍️ 复核人签字")
        lines.append("---")
        lines.append("")
        lines.append("  复核人: _______________________")
        lines.append("  日  期: _______________________")
        lines.append("  意  见: □ 同意   □ 需修改   □ 驳回")
        lines.append("")
        
        content = "\n".join(lines)
        
        filename = f"复核人报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
    
    def generate_anomaly_report(
        self,
        anomaly_queue: AnomalyQueue,
    ) -> str:
        """生成独立的异常队列报告（与终端摘要分离）"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        lines = []
        lines.append("=" * 80)
        lines.append("🚨 误差传播分析 - 异常队列报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {timestamp}")
        lines.append(f"异常总数: {len(anomaly_queue)}")
        lines.append(f"挂起样本: {len(anomaly_queue.get_suspended_samples())}")
        lines.append("")
        
        lines.append("---")
        lines.append("📋 异常分类统计")
        lines.append("---")
        lines.append("")
        
        type_counts = {}
        for record in anomaly_queue:
            atype = record.anomaly_type.value
            type_counts[atype] = type_counts.get(atype, 0) + 1
        
        for atype, count in sorted(type_counts.items()):
            lines.append(f"  {atype}: {count} 条")
        lines.append("")
        
        lines.append("---")
        lines.append("📝 详细异常记录")
        lines.append("---")
        lines.append("")
        
        for i, record in enumerate(anomaly_queue, 1):
            severity_icon = "🔵" if record.severity.value == "info" else "🟡" if record.severity.value == "warning" else "🔴" if record.severity.value == "error" else "💔"
            
            lines.append(f"[{i}] {severity_icon} {record.anomaly_type.value.upper()}")
            lines.append(f"    严重程度: {record.severity.value}")
            lines.append(f"    消息: {record.message}")
            if record.sample_id:
                lines.append(f"    关联样本: {record.sample_id}")
            if record.details:
                lines.append(f"    详细信息:")
                for k, v in record.details.items():
                    lines.append(f"      {k}: {v}")
            if record.resolution_hint:
                lines.append(f"    解决建议: {record.resolution_hint}")
            lines.append(f"    时间戳: {datetime.fromtimestamp(record.timestamp).strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
        
        suspended = anomaly_queue.get_suspended_samples()
        if suspended:
            lines.append("---")
            lines.append("⏸️ 挂起的样本")
            lines.append("---")
            lines.append("")
            for sid in suspended:
                lines.append(f"  • {sid}")
            lines.append("")
        
        content = "\n".join(lines)
        
        filename = f"异常队列报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
    
    def save_json_report(
        self,
        data: Dict[str, Any],
        filename: str,
    ) -> str:
        """保存JSON格式报告"""
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath
