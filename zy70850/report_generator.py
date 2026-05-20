import csv
import io
from datetime import datetime
from typing import List
from models import ReconciliationResult, ReconciliationSummary, ClaimStatus


class ReportGenerator:
    def generate_detail_report_text(self, result: ReconciliationResult) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("                    理赔对账明细报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append(f"【基本信息】")
        lines.append(f"  报案号: {result.claim_number}")
        lines.append(f"  保单号: {result.policy_number}")
        lines.append(f"  被保险人: {result.applicant_name}")
        lines.append(f"  当前状态: {result.status.value}")
        lines.append("")
        lines.append(f"【金额信息】")
        lines.append(f"  申报金额: {result.total_claimed_amount:,.2f} 元")
        lines.append(f"  系统计算金额: {result.system_calculated_amount:,.2f} 元")
        if result.final_approved_amount is not None:
            lines.append(f"  最终赔付金额: {result.final_approved_amount:,.2f} 元")
            diff = result.total_claimed_amount - result.final_approved_amount
            if diff > 0.01:
                lines.append(f"  核减金额: {diff:,.2f} 元")
        lines.append("")
        
        if result.issues:
            lines.append(f"【问题清单】 ({len(result.issues)} 项)")
            lines.append("-" * 70)
            for idx, issue in enumerate(result.issues, 1):
                severity_mark = "❌" if issue.severity == "error" else "⚠️"
                lines.append(f"{severity_mark} {idx}. {issue.issue_type.value}")
                lines.append(f"   {issue.message}")
                if issue.evidence:
                    lines.append(f"   证据: {self._format_evidence(issue.evidence)}")
                if issue.suggestion:
                    lines.append(f"   建议: {issue.suggestion}")
                lines.append("")
        else:
            lines.append(f"【问题清单】")
            lines.append("  未发现问题 ✓")
            lines.append("")
        
        if result.reviewed_by:
            lines.append(f"【复核信息】")
            lines.append(f"  复核人: {result.reviewed_by}")
            lines.append(f"  复核时间: {result.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if result.reviewer_notes:
                lines.append(f"  复核备注: {result.reviewer_notes}")
            lines.append("")
        
        lines.append(f"【处理说明】")
        if result.status == ClaimStatus.APPROVED:
            lines.append("  该理赔申请已通过审核，将按最终赔付金额进行赔付。")
        elif result.status == ClaimStatus.REJECTED:
            lines.append("  该理赔申请已被退回，原因请参考问题清单。")
        elif result.status == ClaimStatus.SUPPLEMENT:
            lines.append("  需要客户补充相关材料后继续审核。")
        else:
            lines.append("  待人工复核确认。")
        
        lines.append("")
        lines.append("=" * 70)
        lines.append("报告结束")
        
        return "\n".join(lines)

    def _format_evidence(self, evidence: dict) -> str:
        parts = []
        for key, value in evidence.items():
            if isinstance(value, float):
                parts.append(f"{key}={value:,.2f}")
            elif isinstance(value, list):
                parts.append(f"{key}={len(value)}项")
            else:
                parts.append(f"{key}={value}")
        return "; ".join(parts[:3])

    def generate_summary_report_text(self, summary: ReconciliationSummary) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("                    理赔对账汇总报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append(f"【统计概览】")
        lines.append(f"  理赔总数: {summary.total_claims} 件")
        lines.append(f"  待复核: {summary.pending_count} 件")
        lines.append(f"  已通过: {summary.approved_count} 件")
        lines.append(f"  已退回: {summary.rejected_count} 件")
        lines.append(f"  待补材料: {summary.supplement_count} 件")
        lines.append("")
        lines.append(f"【金额统计】")
        lines.append(f"  申报总金额: {summary.total_claimed_amount:,.2f} 元")
        lines.append(f"  赔付总金额: {summary.total_approved_amount:,.2f} 元")
        if summary.total_claimed_amount > 0:
            ratio = summary.total_approved_amount / summary.total_claimed_amount * 100
            lines.append(f"  赔付率: {ratio:.1f}%")
        lines.append("")
        
        if summary.issue_distribution:
            lines.append(f"【问题分布】")
            total_issues = sum(summary.issue_distribution.values())
            for issue_type, count in sorted(summary.issue_distribution.items(), 
                                             key=lambda x: x[1], reverse=True):
                percentage = count / total_issues * 100 if total_issues > 0 else 0
                lines.append(f"  {issue_type}: {count} 次 ({percentage:.1f}%)")
            lines.append("")
        
        if summary.issue_details:
            lines.append(f"【问题明细】")
            lines.append("-" * 70)
            for issue in summary.issue_details[:20]:
                severity_mark = "❌" if issue['severity'] == "error" else "⚠️"
                lines.append(f"{severity_mark} [{issue['claim_number']}] {issue['issue_type']}: {issue['message'][:50]}...")
            if len(summary.issue_details) > 20:
                lines.append(f"  ... 还有 {len(summary.issue_details) - 20} 条记录")
            lines.append("")
        
        lines.append("=" * 70)
        lines.append("报告结束")
        
        return "\n".join(lines)

    def generate_detail_csv(self, results: List[ReconciliationResult]) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            '报案号', '保单号', '被保险人', '状态',
            '申报金额', '系统计算金额', '最终赔付金额',
            '问题数量', '问题类型', '复核人', '复核时间', '生成时间'
        ])
        
        for result in results:
            issue_types = ";".join([i.issue_type.value for i in result.issues])
            writer.writerow([
                result.claim_number,
                result.policy_number,
                result.applicant_name,
                result.status.value,
                f"{result.total_claimed_amount:.2f}",
                f"{result.system_calculated_amount:.2f}",
                f"{result.final_approved_amount:.2f}" if result.final_approved_amount is not None else "",
                len(result.issues),
                issue_types,
                result.reviewed_by or "",
                result.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if result.reviewed_at else "",
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        return output.getvalue().encode('utf-8-sig')

    def generate_issues_csv(self, results: List[ReconciliationResult]) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            '报案号', '被保险人', '问题类型', '严重程度',
            '问题描述', '建议', '金额影响'
        ])
        
        for result in results:
            for issue in result.issues:
                financial_impact = 0
                if issue.issue_type.value == '金额超限' and issue.evidence:
                    financial_impact = issue.evidence.get('exceeded_amount', 0)
                elif issue.issue_type.value == '缺发票' and issue.evidence:
                    financial_impact = issue.evidence.get('total_missing_amount', 0)
                
                writer.writerow([
                    result.claim_number,
                    result.applicant_name,
                    issue.issue_type.value,
                    issue.severity,
                    issue.message,
                    issue.suggestion or "",
                    f"{financial_impact:.2f}"
                ])
        
        return output.getvalue().encode('utf-8-sig')

    def generate_justification_for_claim(self, result: ReconciliationResult) -> str:
        lines = []
        lines.append("理赔处理说明")
        lines.append("=" * 40)
        lines.append(f"报案号: {result.claim_number}")
        lines.append(f"被保险人: {result.applicant_name}")
        lines.append("")
        
        if result.status == ClaimStatus.APPROVED:
            lines.append("处理结果: 通过")
            if result.final_approved_amount is not None:
                lines.append(f"赔付金额: {result.final_approved_amount:,.2f} 元")
        elif result.status == ClaimStatus.REJECTED:
            lines.append("处理结果: 退回")
        elif result.status == ClaimStatus.SUPPLEMENT:
            lines.append("处理结果: 待补材料")
        else:
            lines.append("处理结果: 待复核")
        
        lines.append("")
        
        if result.issues:
            lines.append("问题说明:")
            for issue in result.issues:
                lines.append(f"- {issue.issue_type.value}: {issue.message}")
                if issue.suggestion:
                    lines.append(f"  处理建议: {issue.suggestion}")
        else:
            lines.append("经审核，材料齐全，金额符合保单约定。")
        
        return "\n".join(lines)
