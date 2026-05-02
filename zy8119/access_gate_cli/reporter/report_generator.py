import csv
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

from access_gate_cli.rules.engine import Violation, ViolationType, ViolationSeverity
from access_gate_cli.issuer.package_generator import DevicePackage, AccessEntry


@dataclass
class AuditReportData:
    generated_at: str
    total_requests: int = 0
    valid_requests: int = 0
    invalid_requests: int = 0
    total_violations: int = 0
    total_warnings: int = 0
    violations: List[Violation] = field(default_factory=list)
    warnings: List[Violation] = field(default_factory=list)
    device_packages: List[DevicePackage] = field(default_factory=list)
    devices_processed: List[str] = field(default_factory=list)
    personnel_count: int = 0
    zones_count: int = 0
    devices_count: int = 0
    summary_by_severity: Dict[str, int] = field(default_factory=dict)
    summary_by_type: Dict[str, int] = field(default_factory=dict)


def _categorize_violations(
    violations: List[Violation]
) -> Dict[str, List[Violation]]:
    categorized = defaultdict(list)
    for v in violations:
        categorized[v.violation_type.value].append(v)
    return dict(categorized)


def _count_by_severity(
    violations: List[Violation]
) -> Dict[str, int]:
    counts = defaultdict(int)
    for v in violations:
        counts[v.severity.value] += 1
    return dict(counts)


def _format_violation_for_md(violation: Violation, index: int) -> str:
    lines = []
    lines.append(f"**{index}. 违规类型: {violation.violation_type.value}**")
    lines.append(f"    - 严重程度: {violation.severity.value.upper()}")
    lines.append(f"    - 描述: {violation.message}")
    if violation.personnel_id:
        lines.append(f"    - 人员ID: {violation.personnel_id}")
    if violation.request_id:
        lines.append(f"    - 申请ID: {violation.request_id}")
    if violation.device_id:
        lines.append(f"    - 设备ID: {violation.device_id}")
    if violation.zone_id:
        lines.append(f"    - 门区ID: {violation.zone_id}")
    if violation.details:
        lines.append(f"    - 详细信息:")
        for key, value in violation.details.items():
            lines.append(f"      - {key}: {value}")
    lines.append("")
    return "\n".join(lines)


def generate_audit_report(
    report_data: AuditReportData,
    output_path: str
):
    lines = []
    
    lines.append("# 门禁权限包签发审计报告")
    lines.append("=" * 80)
    lines.append("")
    
    lines.append(f"**生成时间**: {report_data.generated_at}")
    lines.append("")
    
    lines.append("## 执行摘要")
    lines.append("-" * 60)
    lines.append("")
    
    lines.append("### 统计概览")
    lines.append("")
    lines.append(f"- **总申请数**: {report_data.total_requests}")
    lines.append(f"- **有效申请**: {report_data.valid_requests}")
    lines.append(f"- **无效申请**: {report_data.invalid_requests}")
    lines.append(f"- **总违规数**: {report_data.total_violations}")
    lines.append(f"- **警告数**: {report_data.total_warnings}")
    lines.append("")
    
    lines.append("### 资源统计")
    lines.append("")
    lines.append(f"- **处理人员数**: {report_data.personnel_count}")
    lines.append(f"- **涉及门区数**: {report_data.zones_count}")
    lines.append(f"- **涉及设备数**: {report_data.devices_count}")
    lines.append(f"- **生成权限包**: {len(report_data.device_packages)}")
    lines.append("")
    
    if report_data.summary_by_severity:
        lines.append("### 违规严重程度分布")
        lines.append("")
        for severity, count in sorted(report_data.summary_by_severity.items()):
            lines.append(f"- **{severity.upper()}**: {count}")
        lines.append("")
    
    if report_data.devices_processed:
        lines.append("## 设备处理详情")
        lines.append("-" * 60)
        lines.append("")
        
        for pkg in report_data.device_packages:
            lines.append(f"### 设备: {pkg.device_id}")
            lines.append("")
            lines.append(f"- **版本**: {pkg.version}")
            lines.append(f"- **生成时间**: {pkg.generated_at}")
            lines.append(f"- **权限条目数**: {len(pkg.access_entries)}")
            lines.append(f"- **包哈希**: {pkg.package_hash[:16]}...")
            lines.append(f"- **HMAC 签名**: {pkg.hmac_signature[:16]}...")
            lines.append("")
            
            if pkg.access_entries:
                lines.append("#### 权限条目详情")
                lines.append("")
                lines.append("| 序号 | 人员ID | 姓名 | 角色 | 门区 | 类型 | 开始时间 | 结束时间 |")
                lines.append("|------|--------|------|------|------|------|----------|----------|")
                for idx, entry in enumerate(pkg.access_entries, 1):
                    lines.append(
                        f"| {idx} | {entry.personnel_id} | {entry.name} | {entry.role} | "
                        f"{entry.zone_id} | {entry.access_type.value} | {entry.start_time} | {entry.end_time} |"
                    )
                lines.append("")
    
    if report_data.violations:
        lines.append("## 违规详情 (BLOCKING)")
        lines.append("-" * 60)
        lines.append("")
        lines.append(f"> 以下违规导致申请被拒绝或存在高风险：")
        lines.append("")
        
        violations_by_severity = defaultdict(list)
        for v in report_data.violations:
            violations_by_severity[v.severity.value].append(v)
        
        for severity in ['critical', 'high', 'medium', 'low']:
            if severity in violations_by_severity:
                lines.append(f"### {severity.upper()} 级别违规")
                lines.append("")
                for idx, v in enumerate(violations_by_severity[severity], 1):
                    lines.append(_format_violation_for_md(v, idx))
    
    if report_data.warnings:
        lines.append("## 警告详情 (NON-BLOCKING)")
        lines.append("-" * 60)
        lines.append("")
        lines.append("> 以下警告不阻止申请处理，但需要关注：")
        lines.append("")
        
        for idx, w in enumerate(report_data.warnings, 1):
            lines.append(_format_violation_for_md(w, idx))
    
    lines.append("## 说明")
    lines.append("-" * 60)
    lines.append("")
    lines.append("### HMAC 签名验证")
    lines.append("")
    lines.append("> 每个权限包都包含 HMAC-SHA256 签名，用于确保数据完整性和真实性。")
    lines.append("")
    lines.append("验证方式：")
    lines.append("1. 首先计算除签名和哈希字段的 JSON 字符串的 SHA256 哈希值")
    lines.append("2. 使用设备专属密钥对哈希进行 HMAC 签名")
    lines.append("3. 门禁控制器在加载权限包时验证签名")
    lines.append("")
    
    lines.append("### 权限包格式")
    lines.append("")
    lines.append("每个设备权限包包含以下字段：")
    lines.append("- `version`: 权限包版本号")
    lines.append("- `device_id`: 目标设备 ID")
    lines.append("- `generated_at`: 生成时间戳")
    lines.append("- `access_entries`: 权限条目列表")
    lines.append("- `package_hash`: 内容完整性校验哈希")
    lines.append("- `hmac_signature`: HMAC 签名")
    lines.append("")
    
    content = "\n".join(lines)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)


def generate_violations_csv(
    violations: List[Violation],
    output_path: str
):
    fieldnames = [
        'violation_type',
        'severity',
        'personnel_id',
        'request_id',
        'device_id',
        'zone_id',
        'message',
        'details'
    ]
    
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for v in violations:
            writer.writerow({
                'violation_type': v.violation_type.value,
                'severity': v.severity.value,
                'personnel_id': v.personnel_id or '',
                'request_id': v.request_id or '',
                'device_id': v.device_id or '',
                'zone_id': v.zone_id or '',
                'message': v.message,
                'details': str(v.details) if v.details else ''
            })
