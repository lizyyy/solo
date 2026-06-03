from datetime import datetime
from typing import Dict, List, Optional
import uuid

from models import (
    LoanInterestRecord,
    SupplementaryRecord,
    NextHandler,
    RecordStatus,
)


class ReportService:
    def generate_supplementary_record(
        self,
        record: LoanInterestRecord,
        reason_kept: str,
        missing_materials: List[str],
        next_handler: NextHandler,
        notes: str,
        created_by: str
    ) -> SupplementaryRecord:
        supplementary = SupplementaryRecord(
            record_id=str(uuid.uuid4()),
            reason_kept=reason_kept,
            missing_materials=missing_materials,
            next_handler=next_handler,
            notes=notes,
            created_at=datetime.now(),
            created_by=created_by
        )
        record.supplementary = supplementary
        return supplementary

    def review_conflict_record(
        self,
        record: LoanInterestRecord,
        reviewer_decision: str,
        correct_short_name: Optional[str],
        reviewed_by: str
    ):
        old_status = record.status

        if reviewer_decision == "approve_email":
            old_short_name = record.batch_short_name
            record.batch_short_name = record.email_short_name
            record.status = RecordStatus.REVIEWED
            record.add_audit_record(
                "batch_short_name",
                old_short_name,
                record.email_short_name,
                reviewed_by,
                "财务复核：以客户经理补充邮件的机构简称为准"
            )
        elif reviewer_decision == "approve_batch":
            old_short_name = record.email_short_name
            record.email_short_name = record.batch_short_name
            record.status = RecordStatus.REVIEWED
            record.add_audit_record(
                "email_short_name",
                old_short_name,
                record.batch_short_name,
                reviewed_by,
                "财务复核：以清算批次号的机构简称为准"
            )
        elif reviewer_decision == "custom":
            if correct_short_name:
                old_email_short = record.email_short_name
                old_batch_short = record.batch_short_name
                record.email_short_name = correct_short_name
                record.batch_short_name = correct_short_name
                record.status = RecordStatus.REVIEWED
                record.add_audit_record(
                    "email_short_name",
                    old_email_short,
                    correct_short_name,
                    reviewed_by,
                    f"财务复核：手动修正机构简称为{correct_short_name}"
                )
                record.add_audit_record(
                    "batch_short_name",
                    old_batch_short,
                    correct_short_name,
                    reviewed_by,
                    f"财务复核：手动修正机构简称为{correct_short_name}"
                )

        record.add_audit_record(
            "status",
            old_status,
            RecordStatus.REVIEWED,
            reviewed_by,
            "财务复核完成，记录已确认"
        )

    def generate_report(self, record: LoanInterestRecord) -> Dict:
        report = {
            "基本信息": {
                "记录ID": record.record_id,
                "机构全称": record.institution_name,
                "邮件简称": record.email_short_name,
                "清算简称": record.batch_short_name,
                "状态": record.status,
                "版本号": record.version,
                "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "更新时间": record.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            },
            "借款信息": {
                "本金": f"{record.loan_amount:,.2f} 元",
                "年利率": f"{record.interest_rate * 100:.2f}%",
                "计息期间": f"{record.start_date} 至 {record.end_date}",
            },
            "计算结果": {
                "计息天数": record.calculation.days,
                "利息金额": f"{record.calculation.interest:,.2f} 元",
                "计算公式": record.calculation.formula,
            },
            "计算参数说明": [],
            "来源追溯": {},
            "补录记录": None,
            "变更历史": [],
        }

        for param in record.calculation.parameters:
            report["计算参数说明"].append({
                "参数名称": param.parameter_name,
                "参数值": param.value,
                "版本": param.version,
                "取舍理由": param.reason,
                "生效日期": param.effective_date
            })

        if record.supplementary:
            report["补录记录"] = {
                "保留原因": record.supplementary.reason_kept,
                "缺失材料": record.supplementary.missing_materials,
                "下一步处理人": record.supplementary.next_handler,
                "备注说明": record.supplementary.notes,
                "创建人": record.supplementary.created_by,
                "创建时间": record.supplementary.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }

        for audit in record.audit_history:
            report["变更历史"].append({
                "时间": audit.changed_at.strftime("%Y-%m-%d %H:%M:%S"),
                "字段": audit.field_name,
                "修改前": audit.old_value,
                "修改后": audit.new_value,
                "修改人": audit.changed_by,
                "原因": audit.change_reason
            })

        return report

    def generate_summary_report(self, records: List[LoanInterestRecord]) -> Dict:
        total_principal = sum(r.loan_amount for r in records)
        total_interest = sum(r.calculation.interest for r in records)
        conflict_count = len([r for r in records if r.status == RecordStatus.CONFLICT])
        pending_count = len([r for r in records if r.status == RecordStatus.PENDING])
        reviewed_count = len([r for r in records if r.status == RecordStatus.REVIEWED])
        normal_count = len([r for r in records if r.status == RecordStatus.NORMAL])

        summary = {
            "汇总概览": {
                "总记录数": len(records),
                "待复核": pending_count,
                "机构简称不一致": conflict_count,
                "正常": normal_count,
                "已复核": reviewed_count,
            },
            "金额汇总": {
                "本金合计": f"{total_principal:,.2f} 元",
                "利息合计": f"{total_interest:,.2f} 元",
            },
            "详细记录": []
        }

        for record in records:
            summary["详细记录"].append({
                "记录ID": record.record_id,
                "机构": record.institution_name,
                "本金": f"{record.loan_amount:,.2f} 元",
                "利息": f"{record.calculation.interest:,.2f} 元",
                "状态": record.status,
                "备注": record.remark,
                "版本": record.version
            })

        return summary

    def generate_friendly_report(self, record: LoanInterestRecord) -> str:
        report_lines = []
        report_lines.append("=" * 60)
        report_lines.append("        资金池内部借款计息报告")
        report_lines.append("=" * 60)
        report_lines.append("")

        report_lines.append(f"【机构名称】{record.institution_name}")
        report_lines.append(f"【当前状态】{record.status}")

        if record.has_short_name_conflict():
            report_lines.append("")
            report_lines.append("⚠️  注意：机构简称不一致")
            report_lines.append(f"   - 客户经理补充邮件：{record.email_short_name}")
            report_lines.append(f"   - 清算批次号：      {record.batch_short_name}")
            report_lines.append("   请点击查看原始来源数据进行核对")

        report_lines.append("")
        report_lines.append("--- 借款信息 ---")
        report_lines.append(f"借款本金：{record.loan_amount:,.2f} 元")
        report_lines.append(f"年利率：{record.interest_rate * 100:.2f}%")
        report_lines.append(f"计息期间：{record.start_date} 至 {record.end_date}")
        report_lines.append(f"计息天数：{record.calculation.days} 天")

        report_lines.append("")
        report_lines.append("--- 计算结果 ---")
        report_lines.append(f"应付利息：{record.calculation.interest:,.2f} 元")
        report_lines.append(f"计算公式：{record.calculation.formula}")

        report_lines.append("")
        report_lines.append("--- 参数说明（可追溯）---")
        for param in record.calculation.parameters:
            report_lines.append(f"  [{param.version}] {param.parameter_name}: {param.value}")
            report_lines.append(f"      理由：{param.reason}")

        if record.supplementary:
            report_lines.append("")
            report_lines.append("--- 补录说明 ---")
            report_lines.append(f"📌 为什么保留这条记录：{record.supplementary.reason_kept}")
            if record.supplementary.missing_materials:
                report_lines.append(f"📋 还缺少的材料：{', '.join(record.supplementary.missing_materials)}")
            report_lines.append(f"👤 下一步找谁：{record.supplementary.next_handler}")
            if record.supplementary.notes:
                report_lines.append(f"💬 备注：{record.supplementary.notes}")

        if record.remark:
            report_lines.append("")
            report_lines.append(f"【备注】{record.remark}")

        if record.audit_history:
            report_lines.append("")
            report_lines.append("--- 变更历史 ---")
            for audit in record.audit_history:
                report_lines.append(
                    f"  {audit.changed_at.strftime('%m-%d %H:%M')} {audit.changed_by} "
                    f"修改了【{audit.field_name}】"
                )
                report_lines.append(
                    f"      从「{audit.old_value}」改为「{audit.new_value}」"
                )
                report_lines.append(f"      原因：{audit.change_reason}")

        report_lines.append("")
        report_lines.append("--- 来源追溯 ---")
        report_lines.append("  点击可查看原始客户经理补充邮件和清算批次号")

        report_lines.append("")
        report_lines.append("=" * 60)

        return "\n".join(report_lines)
