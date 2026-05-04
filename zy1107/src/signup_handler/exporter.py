import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal

from .models import (
    MergedRecord,
    Group,
    PaymentRecord,
    RulesConfig,
    ValidationIssue,
    ProcessingResult,
)


class Exporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_all(
        self,
        result: ProcessingResult,
    ) -> Dict[str, Path]:
        exported_paths = {}
        
        exported_paths['cleaned_csv'] = self.export_cleaned_csv(
            [r for r in result.merged_records if not r.is_waitlist]
        )
        
        exported_paths['waitlist_csv'] = self.export_waitlist_csv(
            result.waitlist
        )
        
        exported_paths['grouping_json'] = self.export_grouping_json(
            result.groups,
            result.merged_records,
            result.rules
        )
        
        exported_paths['notification_txt'] = self.export_notification_txt(
            result.groups,
            result.merged_records,
            result.rules
        )
        
        exported_paths['report_md'] = self.export_report_md(result)
        
        exported_paths['report_html'] = self.export_report_html(result)
        
        return exported_paths

    def export_cleaned_csv(self, records: List[MergedRecord]) -> Path:
        filepath = self.output_dir / "cleaned.csv"
        
        if not records:
            filepath.write_text("没有已确认的报名记录\n", encoding='utf-8')
            return filepath
        
        headers = [
            "序号", "ID", "姓名", "手机号", "总人数", "成人", "儿童",
            "时段", "分组", "付款状态", "应付金额", "实付金额",
            "忌口", "备注", "警告", "状态"
        ]
        
        rows = []
        for idx, record in enumerate(records, 1):
            row = [
                idx,
                record.merged_id,
                record.display_name,
                record.effective_phone or "",
                record.effective_total_people,
                record.effective_adult_count,
                record.effective_child_count,
                record.assigned_time_slot or "",
                record.assigned_group or "",
                record.payment_status.value,
                str(record.expected_payment),
                str(record.actual_payment),
                ", ".join(record.primary_record.dietary_restrictions),
                " | ".join(record.primary_record.notes),
                " | ".join(record.warnings),
                record.status.value,
            ]
            rows.append(row)
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        
        return filepath

    def export_waitlist_csv(self, waitlist: List[MergedRecord]) -> Path:
        filepath = self.output_dir / "waitlist.csv"
        
        if not waitlist:
            filepath.write_text("没有候补记录\n", encoding='utf-8')
            return filepath
        
        headers = [
            "候补序号", "ID", "姓名", "手机号", "总人数", "成人", "儿童",
            "原选时段", "付款状态", "应付金额", "实付金额", "候补原因"
        ]
        
        rows = []
        for idx, record in enumerate(waitlist, 1):
            reasons = []
            if record.warnings:
                reasons.extend(record.warnings)
            if not reasons:
                reasons.append("容量限制")
            
            row = [
                idx,
                record.merged_id,
                record.display_name,
                record.effective_phone or "",
                record.effective_total_people,
                record.effective_adult_count,
                record.effective_child_count,
                ", ".join(record.effective_time_slots),
                record.payment_status.value,
                str(record.expected_payment),
                str(record.actual_payment),
                " | ".join(reasons),
            ]
            rows.append(row)
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        
        return filepath

    def export_grouping_json(
        self,
        groups: Dict[str, List[Group]],
        all_records: List[MergedRecord],
        rules: RulesConfig,
    ) -> Path:
        filepath = self.output_dir / "grouping.json"
        
        grouping_data = {
            "generated_at": datetime.now().isoformat(),
            "group_size": rules.group_size,
            "slots": {},
            "summary": {
                "total_confirmed": len([r for r in all_records if not r.is_waitlist]),
                "total_waitlist": len([r for r in all_records if r.is_waitlist]),
                "total_groups": sum(len(gs) for gs in groups.values()),
            }
        }
        
        for slot_name, slot_groups in groups.items():
            slot_data = {
                "groups": [],
                "summary": {
                    "total_people": sum(g.current_size for g in slot_groups),
                    "total_groups": len(slot_groups),
                }
            }
            
            for group in slot_groups:
                group_data = {
                    "group_name": group.group_name,
                    "time_slot": group.time_slot,
                    "total_people": group.current_size,
                    "adults": group.adult_count,
                    "children": group.child_count,
                    "child_ratio": f"{group.child_ratio*100:.1f}%",
                    "members": []
                }
                
                for member in group.members:
                    member_data = {
                        "name": member.display_name,
                        "phone": member.effective_phone,
                        "total_people": member.effective_total_people,
                        "adults": member.effective_adult_count,
                        "children": member.effective_child_count,
                        "payment_status": member.payment_status.value,
                        "dietary_restrictions": member.primary_record.dietary_restrictions,
                    }
                    group_data["members"].append(member_data)
                
                slot_data["groups"].append(group_data)
            
            grouping_data["slots"][slot_name] = slot_data
        
        filepath.write_text(
            json.dumps(grouping_data, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        
        return filepath

    def export_notification_txt(
        self,
        groups: Dict[str, List[Group]],
        all_records: List[MergedRecord],
        rules: RulesConfig,
    ) -> Path:
        filepath = self.output_dir / "notification.txt"
        
        confirmed_records = [r for r in all_records if not r.is_waitlist]
        waitlist_records = [r for r in all_records if r.is_waitlist]
        
        lines = []
        lines.append("=" * 60)
        lines.append("【活动报名确认通知】")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        total_confirmed = sum(r.effective_total_people for r in confirmed_records)
        total_waitlist = sum(r.effective_total_people for r in waitlist_records)
        
        lines.append(f"📋 报名统计:")
        lines.append(f"   - 已确认: {len(confirmed_records)} 个家庭/个人，共 {total_confirmed} 人")
        lines.append(f"   - 候补名单: {len(waitlist_records)} 个家庭/个人，共 {total_waitlist} 人")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("【已确认报名名单】")
        lines.append("-" * 60)
        lines.append("")
        
        for slot_name, slot_groups in groups.items():
            if not slot_groups:
                continue
            
            slot_people = sum(g.current_size for g in slot_groups)
            lines.append(f"📍 {slot_name} (共 {slot_people} 人)")
            lines.append("")
            
            for group in slot_groups:
                lines.append(f"  👥 {group.group_name} ({group.current_size}人: {group.adult_count}大{group.child_count}小)")
                lines.append("")
                
                for member in group.members:
                    status_icon = "✅" if member.payment_status.value == "已付款" else "⚠️"
                    dietary = ""
                    if member.primary_record.dietary_restrictions:
                        dietary = f" 【忌口: {', '.join(member.primary_record.dietary_restrictions)}】"
                    
                    lines.append(
                        f"    {status_icon} {member.display_name} "
                        f"({member.effective_total_people}人: {member.effective_adult_count}大{member.effective_child_count}小) "
                        f"{member.effective_phone or ''}"
                        f"{dietary}"
                    )
                
                lines.append("")
        
        if waitlist_records:
            lines.append("-" * 60)
            lines.append("【候补名单】(按优先级排序)")
            lines.append("-" * 60)
            lines.append("")
            
            for idx, record in enumerate(waitlist_records, 1):
                status_icon = "✅" if record.payment_status.value == "已付款" else "⚠️"
                lines.append(
                    f"  {idx}. {status_icon} {record.display_name} "
                    f"({record.effective_total_people}人) "
                    f"原选时段: {', '.join(record.effective_time_slots)}"
                )
            
            lines.append("")
        
        lines.append("=" * 60)
        lines.append("【付款情况】")
        lines.append("=" * 60)
        lines.append("")
        
        paid_count = len([r for r in confirmed_records if r.payment_status.value == "已付款"])
        unpaid_count = len([r for r in confirmed_records if r.payment_status.value == "未付款"])
        overpaid_count = len([r for r in confirmed_records if r.payment_status.value == "疑似多付"])
        underpaid_count = len([r for r in confirmed_records if r.payment_status.value == "疑似少付"])
        
        total_expected = sum(r.expected_payment for r in confirmed_records)
        total_actual = sum(r.actual_payment for r in confirmed_records)
        
        lines.append(f"   - 已付款: {paid_count} 人")
        lines.append(f"   - 未付款: {unpaid_count} 人")
        lines.append(f"   - 疑似多付: {overpaid_count} 人")
        lines.append(f"   - 疑似少付: {underpaid_count} 人")
        lines.append("")
        lines.append(f"   - 应付总金额: {total_expected} 元")
        lines.append(f"   - 实付总金额: {total_actual} 元")
        lines.append(f"   - 差额: {total_actual - total_expected} 元")
        lines.append("")
        
        if overpaid_count > 0 or underpaid_count > 0:
            lines.append("⚠️ 注意事项:")
            if overpaid_count > 0:
                lines.append("   - 有多付记录，请核对是否为多人合并付款")
            if underpaid_count > 0:
                lines.append("   - 有少付记录，请及时联系相关人员补款")
            lines.append("")
        
        lines.append("=" * 60)
        lines.append("【通知模板 - 可直接复制到群里】")
        lines.append("=" * 60)
        lines.append("")
        lines.append("各位家长好！")
        lines.append("")
        lines.append("活动报名已确认，现将名单和分组公布如下：")
        lines.append("")
        
        for slot_name, slot_groups in groups.items():
            if not slot_groups:
                continue
            
            slot_people = sum(g.current_size for g in slot_groups)
            lines.append(f"📍 {slot_name} ({slot_people}人)")
            lines.append("")
            
            for group in slot_groups:
                lines.append(f"【{group.group_name}】")
                names = [m.display_name for m in group.members]
                lines.append("、".join(names))
                lines.append("")
        
        lines.append("✅ 已付款名单：")
        paid_names = [r.display_name for r in confirmed_records if r.payment_status.value == "已付款"]
        if paid_names:
            lines.append("、".join(paid_names))
        else:
            lines.append("（无）")
        lines.append("")
        
        if unpaid_count > 0:
            lines.append("⚠️ 请以下人员尽快付款：")
            unpaid_names = [r.display_name for r in confirmed_records if r.payment_status.value == "未付款"]
            lines.append("、".join(unpaid_names))
            lines.append("")
        
        lines.append("如有问题请及时联系组织者，谢谢大家！")
        lines.append("")
        lines.append("=" * 60)
        
        filepath.write_text("\n".join(lines), encoding='utf-8')
        
        return filepath

    def export_report_md(self, result: ProcessingResult) -> Path:
        filepath = self.output_dir / "report.md"
        
        lines = []
        lines.append("# 活动报名处理报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 一、整体统计")
        lines.append("")
        
        confirmed_records = [r for r in result.merged_records if not r.is_waitlist]
        waitlist_records = result.waitlist
        
        total_confirmed_people = sum(r.effective_total_people for r in confirmed_records)
        total_waitlist_people = sum(r.effective_total_people for r in waitlist_records)
        
        paid_count = len([r for r in confirmed_records if r.payment_status.value == "已付款"])
        total_expected = sum(r.expected_payment for r in confirmed_records)
        total_actual = sum(r.actual_payment for r in confirmed_records)
        
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 原始报名条数 | {len(result.raw_registrations)} |")
        lines.append(f"| 去重后记录数 | {len(result.merged_records)} |")
        lines.append(f"| 已确认家庭数 | {len(confirmed_records)} |")
        lines.append(f"| 已确认总人数 | {total_confirmed_people} |")
        lines.append(f"| 候补家庭数 | {len(waitlist_records)} |")
        lines.append(f"| 候补总人数 | {total_waitlist_people} |")
        lines.append(f"| 已付款家庭数 | {paid_count} |")
        lines.append(f"| 应付总金额 | {total_expected} 元 |")
        lines.append(f"| 实付总金额 | {total_actual} 元 |")
        lines.append("")
        
        lines.append("## 二、时段分布")
        lines.append("")
        
        for slot_name, slot_groups in result.groups.items():
            slot_people = sum(g.current_size for g in slot_groups)
            slot_rule = None
            for sr in result.rules.time_slots:
                if sr.name == slot_name:
                    slot_rule = sr
                    break
            
            lines.append(f"### {slot_name}")
            lines.append("")
            lines.append(f"- 容量上限: {slot_rule.max_capacity if slot_rule else '不限'} 人")
            lines.append(f"- 实际报名: {slot_people} 人")
            lines.append(f"- 剩余名额: {slot_rule.max_capacity - slot_people if slot_rule else '不限'} 人")
            lines.append(f"- 分组数: {len(slot_groups)} 组")
            lines.append("")
        
        lines.append("## 三、验证问题")
        lines.append("")
        
        if result.validation_issues:
            severity_order = {"error": 0, "warning": 1, "info": 2}
            sorted_issues = sorted(result.validation_issues, key=lambda x: severity_order.get(x.severity, 99))
            
            for issue in sorted_issues:
                severity_icon = "🔴" if issue.severity == "error" else "🟡" if issue.severity == "warning" else "🔵"
                lines.append(f"{severity_icon} **[{issue.category}]** {issue.message}")
                if issue.line_number:
                    lines.append(f"   - 行号: {issue.line_number}")
                if issue.suggestion:
                    lines.append(f"   - 建议: {issue.suggestion}")
                lines.append("")
        else:
            lines.append("✅ 无验证问题")
            lines.append("")
        
        lines.append("## 四、详细名单")
        lines.append("")
        
        lines.append("### 已确认名单")
        lines.append("")
        
        if confirmed_records:
            lines.append("| 序号 | 姓名 | 手机号 | 人数(大/小) | 时段 | 分组 | 付款状态 | 应付 | 实付 | 忌口 |")
            lines.append("|------|------|--------|-------------|------|------|----------|------|------|------|")
            
            for idx, r in enumerate(confirmed_records, 1):
                lines.append(
                    f"| {idx} | {r.display_name} | {r.effective_phone or ''} | "
                    f"{r.effective_total_people}({r.effective_adult_count}/{r.effective_child_count}) | "
                    f"{r.assigned_time_slot or ''} | {r.assigned_group or ''} | "
                    f"{r.payment_status.value} | {r.expected_payment} | {r.actual_payment} | "
                    f"{', '.join(r.primary_record.dietary_restrictions) or '-'} |"
                )
        else:
            lines.append("无已确认名单")
        lines.append("")
        
        if waitlist_records:
            lines.append("### 候补名单")
            lines.append("")
            
            lines.append("| 序号 | 姓名 | 手机号 | 人数 | 原选时段 | 付款状态 | 候补原因 |")
            lines.append("|------|------|--------|------|----------|----------|----------|")
            
            for idx, r in enumerate(waitlist_records, 1):
                reasons = r.warnings if r.warnings else ["容量限制"]
                lines.append(
                    f"| {idx} | {r.display_name} | {r.effective_phone or ''} | "
                    f"{r.effective_total_people} | {', '.join(r.effective_time_slots)} | "
                    f"{r.payment_status.value} | {' | '.join(reasons)} |"
                )
            lines.append("")
        
        lines.append("## 五、分组详情")
        lines.append("")
        
        for slot_name, slot_groups in result.groups.items():
            if not slot_groups:
                continue
            
            lines.append(f"### {slot_name}")
            lines.append("")
            
            for group in slot_groups:
                lines.append(f"#### {group.group_name} ({group.current_size}人: {group.adult_count}大{group.child_count}小)")
                lines.append("")
                
                for member in group.members:
                    dietary = f" (忌口: {', '.join(member.primary_record.dietary_restrictions)})" if member.primary_record.dietary_restrictions else ""
                    paid_icon = "✅" if member.payment_status.value == "已付款" else "⚠️"
                    lines.append(f"- {paid_icon} {member.display_name} ({member.effective_total_people}人){dietary}")
                lines.append("")
        
        filepath.write_text("\n".join(lines), encoding='utf-8')
        
        return filepath

    def export_report_html(self, result: ProcessingResult) -> Path:
        filepath = self.output_dir / "report.html"
        
        confirmed_records = [r for r in result.merged_records if not r.is_waitlist]
        waitlist_records = result.waitlist
        
        total_confirmed_people = sum(r.effective_total_people for r in confirmed_records)
        total_waitlist_people = sum(r.effective_total_people for r in waitlist_records)
        
        paid_count = len([r for r in confirmed_records if r.payment_status.value == "已付款"])
        total_expected = sum(r.expected_payment for r in confirmed_records)
        total_actual = sum(r.actual_payment for r in confirmed_records)
        
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>活动报名处理报告</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }}
        h2 {{ color: #2980b9; margin-top: 30px; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #3498db; }}
        h3 {{ color: #34495e; margin-top: 20px; margin-bottom: 10px; }}
        h4 {{ color: #5d6d7e; margin-top: 15px; margin-bottom: 8px; }}
        .meta-info {{ color: #7f8c8d; font-size: 14px; margin-bottom: 20px; }}
        
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background: #3498db; color: white; font-weight: 600; }}
        tr:nth-child(even) {{ background: #f8f9fa; }}
        tr:hover {{ background: #e8f4fc; }}
        
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .stat-card {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }}
        .stat-card:nth-child(2) {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }}
        .stat-card:nth-child(3) {{ background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }}
        .stat-card:nth-child(4) {{ background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }}
        .stat-number {{ font-size: 32px; font-weight: bold; }}
        .stat-label {{ font-size: 14px; opacity: 0.9; margin-top: 5px; }}
        
        .issue {{ margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid; }}
        .issue-error {{ background: #fef5f5; border-color: #e53e3e; }}
        .issue-warning {{ background: #fffbeb; border-color: #d69e2e; }}
        .issue-info {{ background: #ebf8ff; border-color: #3182ce; }}
        .issue-title {{ font-weight: bold; margin-bottom: 5px; }}
        .issue-suggestion {{ font-size: 14px; color: #666; margin-top: 5px; }}
        
        .group-section {{ margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }}
        .group-card {{ background: white; padding: 15px; margin: 10px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        .group-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }}
        .group-name {{ font-weight: bold; font-size: 16px; color: #2c3e50; }}
        .group-stats {{ color: #7f8c8d; font-size: 14px; }}
        .member-list {{ list-style: none; }}
        .member-item {{ display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }}
        .member-item:last-child {{ border-bottom: none; }}
        .member-info {{ display: flex; align-items: center; gap: 10px; }}
        .paid-badge {{ background: #48bb78; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }}
        .unpaid-badge {{ background: #ed8936; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }}
        .dietary-tag {{ background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 5px; }}
        
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 活动报名处理报告</h1>
        <div class="meta-info">
            生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>

        <h2>一、整体统计</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">{len(result.merged_records)}</div>
                <div class="stat-label">有效报名数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{total_confirmed_people}</div>
                <div class="stat-label">已确认人数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{total_waitlist_people}</div>
                <div class="stat-label">候补人数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{total_actual}</div>
                <div class="stat-label">实付金额(元)</div>
            </div>
        </div>

        <table>
            <tr>
                <th>指标</th>
                <th>数值</th>
            </tr>
            <tr><td>原始报名条数</td><td>{len(result.raw_registrations)}</td></tr>
            <tr><td>去重后记录数</td><td>{len(result.merged_records)}</td></tr>
            <tr><td>已确认家庭数</td><td>{len(confirmed_records)}</td></tr>
            <tr><td>已确认总人数</td><td>{total_confirmed_people}</td></tr>
            <tr><td>候补家庭数</td><td>{len(waitlist_records)}</td></tr>
            <tr><td>候补总人数</td><td>{total_waitlist_people}</td></tr>
            <tr><td>已付款家庭数</td><td>{paid_count}</td></tr>
            <tr><td>应付总金额</td><td>{total_expected} 元</td></tr>
            <tr><td>实付总金额</td><td>{total_actual} 元</td></tr>
            <tr><td>差额</td><td>{total_actual - total_expected} 元</td></tr>
        </table>

        <h2>二、验证问题</h2>
"""
        
        if result.validation_issues:
            severity_order = {"error": 0, "warning": 1, "info": 2}
            sorted_issues = sorted(result.validation_issues, key=lambda x: severity_order.get(x.severity, 99))
            
            for issue in sorted_issues:
                severity_class = "issue-error" if issue.severity == "error" else "issue-warning" if issue.severity == "warning" else "issue-info"
                severity_icon = "🔴" if issue.severity == "error" else "🟡" if issue.severity == "warning" else "🔵"
                
                html_content += f"""
        <div class="issue {severity_class}">
            <div class="issue-title">{severity_icon} [{issue.category}] {issue.message}</div>
"""
                if issue.line_number:
                    html_content += f"            <div>行号: {issue.line_number}</div>\n"
                if issue.suggestion:
                    html_content += f"            <div class=\"issue-suggestion\">💡 建议: {issue.suggestion}</div>\n"
                html_content += "        </div>\n"
        else:
            html_content += """
        <div class="issue issue-info">
            <div class="issue-title">✅ 无验证问题</div>
        </div>
"""
        
        html_content += f"""
        <h2>三、已确认名单</h2>
"""
        
        if confirmed_records:
            html_content += """
        <table>
            <tr>
                <th>序号</th>
                <th>姓名</th>
                <th>手机号</th>
                <th>人数</th>
                <th>成人</th>
                <th>儿童</th>
                <th>时段</th>
                <th>分组</th>
                <th>付款状态</th>
                <th>应付</th>
                <th>实付</th>
            </tr>
"""
            for idx, r in enumerate(confirmed_records, 1):
                html_content += f"""
            <tr>
                <td>{idx}</td>
                <td>{r.display_name}</td>
                <td>{r.effective_phone or '-'}</td>
                <td>{r.effective_total_people}</td>
                <td>{r.effective_adult_count}</td>
                <td>{r.effective_child_count}</td>
                <td>{r.assigned_time_slot or '-'}</td>
                <td>{r.assigned_group or '-'}</td>
                <td>{r.payment_status.value}</td>
                <td>{r.expected_payment}</td>
                <td>{r.actual_payment}</td>
            </tr>
"""
            html_content += "        </table>\n"
        else:
            html_content += "        <p>无已确认名单</p>\n"
        
        if waitlist_records:
            html_content += f"""
        <h2>四、候补名单</h2>
        <table>
            <tr>
                <th>序号</th>
                <th>姓名</th>
                <th>手机号</th>
                <th>人数</th>
                <th>原选时段</th>
                <th>付款状态</th>
                <th>候补原因</th>
            </tr>
"""
            for idx, r in enumerate(waitlist_records, 1):
                reasons = " | ".join(r.warnings) if r.warnings else "容量限制"
                html_content += f"""
            <tr>
                <td>{idx}</td>
                <td>{r.display_name}</td>
                <td>{r.effective_phone or '-'}</td>
                <td>{r.effective_total_people}</td>
                <td>{', '.join(r.effective_time_slots)}</td>
                <td>{r.payment_status.value}</td>
                <td>{reasons}</td>
            </tr>
"""
            html_content += "        </table>\n"
        
        html_content += f"""
        <h2>五、分组详情</h2>
"""
        
        for slot_name, slot_groups in result.groups.items():
            if not slot_groups:
                continue
            
            slot_people = sum(g.current_size for g in slot_groups)
            html_content += f"""
        <div class="group-section">
            <h3>📍 {slot_name} (共 {slot_people} 人)</h3>
"""
            
            for group in slot_groups:
                html_content += f"""
            <div class="group-card">
                <div class="group-header">
                    <span class="group-name">👥 {group.group_name}</span>
                    <span class="group-stats">{group.current_size}人 ({group.adult_count}大{group.child_count}小)</span>
                </div>
                <ul class="member-list">
"""
                
                for member in group.members:
                    paid_badge = "<span class=\"paid-badge\">已付款</span>" if member.payment_status.value == "已付款" else "<span class=\"unpaid-badge\">未付款</span>"
                    dietary_tags = "".join([f"<span class=\"dietary-tag\">{d}</span>" for d in member.primary_record.dietary_restrictions])
                    
                    html_content += f"""
                    <li class="member-item">
                        <div class="member-info">
                            {paid_badge}
                            <strong>{member.display_name}</strong>
                            <span>({member.effective_total_people}人: {member.effective_adult_count}大{member.effective_child_count}小)</span>
                            {dietary_tags}
                        </div>
                        <span>{member.effective_phone or '-'}</span>
                    </li>
"""
                
                html_content += """
                </ul>
            </div>
"""
            
            html_content += "        </div>\n"
        
        html_content += f"""
        <div class="footer">
            <p>本报告由接龙报名处理工具自动生成</p>
            <p>如有疑问，请核对原始数据或联系技术支持</p>
        </div>
    </div>
</body>
</html>
"""
        
        filepath.write_text(html_content, encoding='utf-8')
        
        return filepath
