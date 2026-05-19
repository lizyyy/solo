import json
from typing import List
from datetime import datetime
from models import Secret, ProcessingStatus
from rules import get_expiry_grade


def generate_machine_readable(secrets: List[Secret], include_details: bool = True) -> dict:
    result = {
        "generated_at": datetime.now().isoformat(),
        "total_secrets": len(secrets),
        "summary": {
            "by_status": {},
            "by_grade": {},
            "by_level": {}
        },
        "secrets": []
    }
    
    for secret in secrets:
        grade, _ = get_expiry_grade(secret)
        
        status_key = secret.status.value
        result["summary"]["by_status"][status_key] = result["summary"]["by_status"].get(status_key, 0) + 1
        
        result["summary"]["by_grade"][grade] = result["summary"]["by_grade"].get(grade, 0) + 1
        
        level_key = secret.level.value
        result["summary"]["by_level"][level_key] = result["summary"]["by_level"].get(level_key, 0) + 1
        
        if include_details:
            secret_dict = {
                "secret_id": secret.secret_id,
                "secret_name": secret.secret_name,
                "usage": secret.usage,
                "system_account": {
                    "account_id": secret.system_account.account_id,
                    "system_name": secret.system_account.system_name,
                    "environment": secret.system_account.environment
                },
                "expire_date": secret.expire_date.isoformat(),
                "days_until_expiry": secret.get_days_until_expiry(),
                "expiry_grade": grade,
                "owner": {
                    "name": secret.owner.name,
                    "email": secret.owner.email,
                    "department": secret.owner.department,
                    "is_on_vacation": secret.owner.is_on_vacation
                },
                "level": secret.level.value,
                "status": secret.status.value,
                "reminder_count": len([r for r in secret.reminder_records if not r.is_duplicate]),
                "duplicate_reminder_count": len([r for r in secret.reminder_records if r.is_duplicate]),
                "transfer_count": len(secret.transfer_history),
                "has_conclusion": secret.conclusion is not None
            }
            if secret.conclusion:
                secret_dict["conclusion"] = {
                    "type": secret.conclusion.conclusion_type.value,
                    "operator": secret.conclusion.operator,
                    "remarks": secret.conclusion.remarks
                }
            result["secrets"].append(secret_dict)
    
    return result


def generate_human_readable_report(secrets: List[Secret], title: str = "密钥到期催办报告") -> str:
    machine_data = generate_machine_readable(secrets, include_details=False)
    
    lines = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"密钥总数: {machine_data['total_secrets']}")
    lines.append("")
    
    lines.append("## 统计摘要")
    lines.append("")
    
    lines.append("### 按状态统计")
    for status, count in machine_data["summary"]["by_status"].items():
        lines.append(f"- {status}: {count}")
    lines.append("")
    
    lines.append("### 按到期等级统计")
    grades_order = ["EXPIRED", "URGENT", "WARNING", "NOTICE", "INFO", "SAFE"]
    for grade in grades_order:
        if grade in machine_data["summary"]["by_grade"]:
            lines.append(f"- {grade}: {machine_data['summary']['by_grade'][grade]}")
    lines.append("")
    
    lines.append("## 密钥详情")
    lines.append("")
    lines.append("| 密钥ID | 密钥名称 | 用途 | 系统 | 到期时间 | 剩余天数 | 等级 | 负责人 | 状态 |")
    lines.append("|--------|----------|------|------|----------|----------|------|--------|------|")
    
    sorted_secrets = sorted(secrets, key=lambda s: s.get_days_until_expiry())
    for secret in sorted_secrets:
        grade, _ = get_expiry_grade(secret)
        days = secret.get_days_until_expiry()
        lines.append(
            f"| {secret.secret_id} | {secret.secret_name} | {secret.usage} | "
            f"{secret.system_account.system_name} | {secret.expire_date} | {days} | {grade} | "
            f"{secret.owner.name} | {secret.status.value} |"
        )
    
    lines.append("")
    lines.append("## 需要立即处理的密钥")
    lines.append("")
    urgent_secrets = [s for s in secrets if get_expiry_grade(s)[0] in ["EXPIRED", "URGENT"] 
                      and s.status not in [ProcessingStatus.RESOLVED, ProcessingStatus.CLOSED]]
    if urgent_secrets:
        for secret in urgent_secrets:
            lines.append(f"### {secret.secret_name} ({secret.secret_id})")
            lines.append(f"- 到期时间: {secret.expire_date}")
            lines.append(f"- 剩余天数: {secret.get_days_until_expiry()}")
            lines.append(f"- 负责人: {secret.owner.name} ({secret.owner.email})")
            lines.append(f"- 负责人休假: {'是' if secret.owner.is_on_vacation else '否'}")
            if secret.owner.is_on_vacation and secret.owner.backup_owner:
                lines.append(f"- 备份负责人: {secret.owner.backup_owner}")
            lines.append("")
    else:
        lines.append("暂无需要立即处理的密钥")
        lines.append("")
    
    return "\n".join(lines)


def generate_secret_detail_report(secret: Secret) -> str:
    grade, _ = get_expiry_grade(secret)
    
    lines = []
    lines.append(f"# 密钥详情: {secret.secret_name}")
    lines.append("")
    lines.append(f"密钥ID: {secret.secret_id}")
    lines.append(f"用途: {secret.usage}")
    lines.append(f"到期等级: {grade}")
    lines.append(f"当前状态: {secret.status.value}")
    lines.append("")
    
    lines.append("## 系统账号信息")
    lines.append(f"- 账号ID: {secret.system_account.account_id}")
    lines.append(f"- 系统名称: {secret.system_account.system_name}")
    lines.append(f"- 环境: {secret.system_account.environment}")
    lines.append("")
    
    lines.append("## 负责人信息")
    lines.append(f"- 姓名: {secret.owner.name}")
    lines.append(f"- 邮箱: {secret.owner.email}")
    lines.append(f"- 部门: {secret.owner.department}")
    lines.append(f"- 是否休假: {'是' if secret.owner.is_on_vacation else '否'}")
    if secret.owner.backup_owner:
        lines.append(f"- 备份负责人: {secret.owner.backup_owner}")
    lines.append("")
    
    lines.append("## 催办记录")
    if secret.reminder_records:
        for i, reminder in enumerate(secret.reminder_records, 1):
            lines.append(f"### 记录 {i}")
            lines.append(f"- 时间: {reminder.reminder_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"- 渠道: {reminder.reminder_channel}")
            lines.append(f"- 是否重复: {'是' if reminder.is_duplicate else '否'}")
            lines.append(f"- 内容: {reminder.reminder_content}")
            lines.append("")
    else:
        lines.append("暂无催办记录")
        lines.append("")
    
    lines.append("## 转交历史")
    if secret.transfer_history:
        for i, transfer in enumerate(secret.transfer_history, 1):
            lines.append(f"### 转交 {i}")
            lines.append(f"- 从: {transfer['from_owner']}")
            lines.append(f"- 到: {transfer['to_owner']}")
            lines.append(f"- 时间: {transfer['transfer_time'].strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"- 操作人: {transfer['operator']}")
            lines.append(f"- 原因: {transfer['reason']}")
            lines.append("")
    else:
        lines.append("暂无转交历史")
        lines.append("")
    
    if secret.conclusion:
        lines.append("## 处理结论")
        lines.append(f"- 结论类型: {secret.conclusion.conclusion_type.value}")
        lines.append(f"- 操作人: {secret.conclusion.operator}")
        lines.append(f"- 时间: {secret.conclusion.conclusion_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- 备注: {secret.conclusion.remarks}")
        lines.append("")
    
    return "\n".join(lines)


def export_json(data: dict, filepath: str) -> None:
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def export_markdown(content: str, filepath: str) -> None:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
