from typing import List
from datetime import datetime

from .models import PaymentRecord, ReviewStatus, IssueType

class ReportGenerator:
    @staticmethod
    def generate_report(record: PaymentRecord) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("    银企直联付款复核报告")
        lines.append("=" * 60)
        lines.append("")
        
        lines.append(f"【付款编号】 {record.id}")
        lines.append(f"【付款日期】 {record.payment_date}")
        lines.append(f"【当前状态】 {record.status.value}")
        lines.append(f"【收款方】 {record.payee}")
        lines.append(f"【金额】 {record.currency} {record.amount:,.2f}")
        lines.append("")

        lines.append("-" * 60)
        lines.append("【审批信息】")
        lines.append("-" * 60)
        lines.append(f"  审批人: {record.approver.name}")
        if record.approver.is_pinyin:
            lines.append(f"  ⚠️  警告: 审批人仅留拼音，需客户经理确认")
            if record.approver.full_name:
                lines.append(f"  推测全名: {record.approver.full_name}")
        else:
            lines.append(f"  全名: {record.approver.full_name or record.approver.name}")
        lines.append("")

        if record.issues:
            lines.append("-" * 60)
            lines.append("【待处理问题】")
            lines.append("-" * 60)
            for i, issue in enumerate(record.issues, 1):
                lines.append(f"  {i}. {issue.value}")
            lines.append("")

        if record.balance_change:
            lines.append("-" * 60)
            lines.append("【余额变化表】")
            lines.append("-" * 60)
            bc = record.balance_change
            lines.append(f"  日期: {bc.date}")
            lines.append(f"  付款前余额: {bc.before_amount:,.2f}")
            lines.append(f"  本次付款: -{bc.change_amount:,.2f}")
            lines.append(f"  付款后余额: {bc.after_amount:,.2f}")
            lines.append("")
            
            if bc.reason:
                lines.append(f"  🔍 说明: {bc.reason}")
            
            if bc.missing_materials:
                lines.append(f"  📋 缺少材料: {', '.join(bc.missing_materials)}")
            
            if bc.next_step:
                lines.append(f"  📌 下一步: {bc.next_step}")
            
            lines.append(f"  {'✅' if bc.has_xr_screenshot else '❌'} 除权日截图: {'已上传' if bc.has_xr_screenshot else '待补录'}")
            lines.append("")

        if record.audit_trail:
            lines.append("-" * 60)
            lines.append("【操作时间线】")
            lines.append("-" * 60)
            for event in record.audit_trail:
                lines.append(f"  {event.timestamp}  {event.actor}  {event.action}")
                if event.detail:
                    lines.append(f"    ↳ {event.detail}")
            lines.append("")

        if record.corrections:
            lines.append("-" * 60)
            lines.append(f"【修正记录】(共{len(record.corrections)}次)")
            lines.append("-" * 60)
            for i, corr in enumerate(record.corrections, 1):
                lines.append(f"  {i}. {corr}")
            lines.append("")

        if record.rerun_count > 0:
            lines.append(f"【重跑次数】 {record.rerun_count} 次")
            lines.append("")

        if record.notes:
            lines.append(f"【备注】 {record.notes}")
            lines.append("")

        lines.append("-" * 60)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        
        return "\n".join(lines)

    @staticmethod
    def generate_summary(records: List[PaymentRecord]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("    银企直联付款复核 - 汇总看板")
        lines.append("=" * 60)
        lines.append("")

        status_counts = {}
        issue_counts = {}
        
        for record in records:
            status_counts[record.status] = status_counts.get(record.status, 0) + 1
            for issue in record.issues:
                issue_counts[issue] = issue_counts.get(issue, 0) + 1

        lines.append("【状态统计】")
        for status in ReviewStatus:
            count = status_counts.get(status, 0)
            lines.append(f"  {status.value}: {count} 条")
        lines.append("")

        if issue_counts:
            lines.append("【问题统计】")
            for issue in IssueType:
                count = issue_counts.get(issue, 0)
                if count > 0:
                    lines.append(f"  {issue.value}: {count} 条")
            lines.append("")

        lines.append(f"总计: {len(records)} 条记录")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)

        return "\n".join(lines)

    @staticmethod
    def generate_demo_walkthrough(records: List[PaymentRecord]) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("  【培训演示】银企直联付款复核流程 - 林姐讲解版")
        lines.append("=" * 70)
        lines.append("")
        lines.append("大家好，我是基金会计林姐，今天带大家走一遍完整的复核流程。")
        lines.append("")
        lines.append("📚 今天的演示数据包含:")
        lines.append("  - 托管确认页导入")
        lines.append("  - 除权日截图补录")
        lines.append("  - 一次人工修正")
        lines.append("  - 一次系统重跑")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【第一步：导入托管确认页】")
        lines.append("-" * 70)
        lines.append("")
        lines.append("首先，我们从托管行导入确认页数据。系统会自动检测:")
        lines.append("  1. 审批人是否只留了拼音")
        lines.append("  2. 是否缺少除权日截图")
        lines.append("  3. 余额计算口径是否正确")
        lines.append("")
        lines.append("💡 重点注意: 审批人拼音问题最容易被当成小备注跳过，")
        lines.append("         但客户经理复查时最先问到的就是这一条！")
        lines.append("         所以我们特意把它标记出来，留给客户经理复核。")
        lines.append("")

        lines.append("-" * 70)
        lines.append("【第二步：基金会计补看除权日截图】")
        lines.append("-" * 70)
        lines.append("")
        lines.append("如果系统标记'缺少除权日截图'，就轮到我来处理了:")
        lines.append("  1. 登录交易系统，找到除权日当天的截图")
        lines.append("  2. 上传截图到系统")
        lines.append("  3. 系统会自动更新余额变化表")
        lines.append("")
        lines.append("✅ 截图上传后，余额变化表会实时更新，")
        lines.append("   状态会从'补录中'变为'客户经理复核'（如果还有拼音问题）")
        lines.append("   或者直接变为'已完成'")
        lines.append("")

        lines.append("-" * 70)
        lines.append("【第三步：余额变化表更新】")
        lines.append("-" * 70)
        lines.append("")
        lines.append("余额变化表是整个报告的核心，里面会清楚地写着:")
        lines.append("  • 这条记录为什么被留下")
        lines.append("  • 还缺什么材料")
        lines.append("  • 下一步该找谁（客户经理还是我）")
        lines.append("")
        lines.append("📋 而不是冷冰冰的系统日志！")
        lines.append("")

        lines.append("-" * 70)
        lines.append("【常见问题处理】")
        lines.append("-" * 70)
        lines.append("")
        lines.append("1️⃣ 错口径: 余额前后对不上")
        lines.append("   → 人工修正金额，系统会记录修正历史")
        lines.append("")
        lines.append("2️⃣ 补录返工: 截图模糊或信息不全")
        lines.append("   → 重新上传，或标记系统重跑")
        lines.append("")
        lines.append("3️⃣ 审批人拼音")
        lines.append("   → 别急着确认，转给客户经理！")
        lines.append("   → 客户经理确认后，我们再补录全名")
        lines.append("")

        lines.append("-" * 70)
        lines.append("【总结】")
        lines.append("-" * 70)
        lines.append("")
        lines.append("记住三步流程:")
        lines.append("  托管确认页导入 → 林姐补看除权日截图 → 余额变化表更新")
        lines.append("")
        lines.append("⚠️  最后强调: 审批人拼音问题，千万别自己归正常！")
        lines.append("         一定要留给客户经理复核。")
        lines.append("")
        lines.append("=" * 70)
        lines.append(f"演示数据: {len(records)} 条 | 生成时间: {datetime.now().strftime('%Y-%m-%d')}")
        lines.append("=" * 70)

        return "\n".join(lines)
