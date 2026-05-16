#!/usr/bin/env python3
"""SBOM漏洞例外CLI工具"""

import click
import json
import csv
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import re
import logging
from dataclasses import dataclass, asdict, field
from enum import Enum

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RiskLevel(Enum):
    """风险等级"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"

@dataclass
class Vulnerability:
    """漏洞数据结构"""
    id: str
    component_name: str
    component_version: str
    severity: str
    description: str = ""
    cvss_score: Optional[float] = None
    source: str = ""

@dataclass
class ExceptionEntry:
    """例外条目数据结构"""
    vulnerability_id: str
    component_name: str
    component_version: str
    reason: str
    expires_at: str
    reviewer: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    status: str = "active"
    
    def is_expired(self) -> bool:
        """检查是否过期"""
        try:
            expire_date = datetime.fromisoformat(self.expires_at)
            return datetime.now() > expire_date
        except (ValueError, TypeError):
            return True
    
    def days_until_expiry(self) -> Optional[int]:
        """计算距离到期的天数"""
        try:
            expire_date = datetime.fromisoformat(self.expires_at)
            delta = expire_date - datetime.now()
            return delta.days
        except (ValueError, TypeError):
            return None

@dataclass
class ProcessingError:
    """处理错误数据结构"""
    row_number: int
    raw_data: str
    error_message: str
    source_file: str

class SBOMParser:
    """SBOM解析器"""
    
    @staticmethod
    def parse_cyclonedx(file_path: str) -> Tuple[List[Vulnerability], List[ProcessingError]]:
        """解析CycloneDX格式的SBOM文件"""
        vulnerabilities = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 解析漏洞信息
            if "vulnerabilities" in data:
                for idx, vuln in enumerate(data["vulnerabilities"], 1):
                    try:
                        vulnerability = SBOMParser._parse_vulnerability(vuln)
                        vulnerabilities.append(vulnerability)
                    except Exception as e:
                        errors.append(ProcessingError(
                            row_number=idx,
                            raw_data=json.dumps(vuln, ensure_ascii=False),
                            error_message=f"漏洞解析失败: {str(e)}",
                            source_file=file_path
                        ))
            
            # 从组件中推断潜在漏洞（如果SBOM没有直接包含漏洞）
            if "components" in data and not vulnerabilities:
                for idx, comp in enumerate(data["components"], 1):
                    try:
                        if "vulnerabilities" in comp:
                            for vuln in comp["vulnerabilities"]:
                                vulnerability = SBOMParser._parse_vulnerability(vuln, comp)
                                vulnerabilities.append(vulnerability)
                    except Exception as e:
                        errors.append(ProcessingError(
                            row_number=idx,
                            raw_data=json.dumps(comp, ensure_ascii=False),
                            error_message=f"组件漏洞解析失败: {str(e)}",
                            source_file=file_path
                        ))
            
        except json.JSONDecodeError as e:
            errors.append(ProcessingError(
                row_number=0,
                raw_data="",
                error_message=f"JSON解析失败: {str(e)}",
                source_file=file_path
            ))
        except Exception as e:
            errors.append(ProcessingError(
                row_number=0,
                raw_data="",
                error_message=f"文件读取失败: {str(e)}",
                source_file=file_path
            ))
        
        return vulnerabilities, errors
    
    @staticmethod
    def _parse_vulnerability(vuln_data: Dict, component: Optional[Dict] = None) -> Vulnerability:
        """解析单个漏洞"""
        component_name = component.get("name", "") if component else vuln_data.get("component", {}).get("name", "")
        component_version = component.get("version", "") if component else vuln_data.get("component", {}).get("version", "")
        
        if not component_name and "affects" in vuln_data:
            affects = vuln_data["affects"]
            if affects and isinstance(affects, list) and len(affects) > 0:
                component_name = affects[0].get("ref", "").split("@")[0] if "@" in affects[0].get("ref", "") else affects[0].get("ref", "")
        
        ratings = vuln_data.get("ratings", [])
        severity = "unknown"
        cvss_score = None
        
        if ratings:
            rating = ratings[0]
            severity = rating.get("severity", "unknown").lower()
            cvss_score = rating.get("score")
        
        return Vulnerability(
            id=vuln_data.get("id", ""),
            component_name=component_name,
            component_version=component_version,
            severity=severity,
            description=vuln_data.get("description", ""),
            cvss_score=cvss_score,
            source="cyclonedx"
        )

class ExceptionManager:
    """例外管理器"""
    
    def __init__(self, exceptions_file: str = "exceptions.json"):
        self.exceptions_file = exceptions_file
        self.exceptions: List[ExceptionEntry] = []
        self._load_exceptions()
    
    def _load_exceptions(self) -> None:
        """加载例外列表"""
        if not os.path.exists(self.exceptions_file):
            self.exceptions = []
            return
        
        try:
            with open(self.exceptions_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.exceptions = [ExceptionEntry(**item) for item in data]
        except Exception as e:
            logger.warning(f"加载例外文件失败: {e}")
            self.exceptions = []
    
    def _save_exceptions(self) -> None:
        """保存例外列表"""
        try:
            with open(self.exceptions_file, 'w', encoding='utf-8') as f:
                json.dump([asdict(e) for e in self.exceptions], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存例外文件失败: {e}")
    
    def add_exception(self, exception: ExceptionEntry) -> bool:
        """添加例外"""
        self.exceptions.append(exception)
        self._save_exceptions()
        return True
    
    def find_exception(self, vuln_id: str, component_name: str, component_version: str) -> Optional[ExceptionEntry]:
        """查找匹配的例外"""
        for exc in self.exceptions:
            if exc.status != "active":
                continue
            
            # 漏洞ID匹配
            if exc.vulnerability_id and exc.vulnerability_id != "*":
                if exc.vulnerability_id.lower() != vuln_id.lower():
                    continue
            
            # 组件名称匹配（支持通配符）
            if exc.component_name and exc.component_name != "*":
                if not self._wildcard_match(exc.component_name, component_name):
                    continue
            
            # 组件版本匹配（支持通配符）
            if exc.component_version and exc.component_version != "*":
                if not self._wildcard_match(exc.component_version, component_version):
                    continue
            
            return exc
        
        return None
    
    @staticmethod
    def _wildcard_match(pattern: str, text: str) -> bool:
        """通配符匹配"""
        pattern = pattern.replace("*", ".*").replace("?", ".")
        return bool(re.match(f"^{pattern}$", text, re.IGNORECASE))
    
    def get_expiring_exceptions(self, days: int = 7) -> List[ExceptionEntry]:
        """获取即将到期的例外"""
        expiring = []
        for exc in self.exceptions:
            days_left = exc.days_until_expiry()
            if days_left is not None and 0 <= days_left <= days:
                expiring.append(exc)
        return expiring
    
    def get_expired_exceptions(self) -> List[ExceptionEntry]:
        """获取已过期的例外"""
        return [exc for exc in self.exceptions if exc.is_expired()]

class RiskAssessor:
    """风险评估器"""
    
    CVSS_THRESHOLDS = {
        RiskLevel.CRITICAL: 9.0,
        RiskLevel.HIGH: 7.0,
        RiskLevel.MEDIUM: 4.0,
        RiskLevel.LOW: 0.1
    }
    
    @staticmethod
    def get_risk_level(vulnerability: Vulnerability) -> RiskLevel:
        """根据CVSS分数获取风险等级"""
        if vulnerability.cvss_score is not None:
            score = vulnerability.cvss_score
            if score >= 9.0:
                return RiskLevel.CRITICAL
            elif score >= 7.0:
                return RiskLevel.HIGH
            elif score >= 4.0:
                return RiskLevel.MEDIUM
            elif score >= 0.1:
                return RiskLevel.LOW
        
        # 根据severity字符串判断
        severity_map = {
            "critical": RiskLevel.CRITICAL,
            "high": RiskLevel.HIGH,
            "medium": RiskLevel.MEDIUM,
            "moderate": RiskLevel.MEDIUM,
            "low": RiskLevel.LOW
        }
        return severity_map.get(vulnerability.severity.lower(), RiskLevel.UNKNOWN)

class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, vulnerabilities: List[Vulnerability], exceptions: List[ExceptionEntry], 
                 errors: List[ProcessingError], exception_manager: ExceptionManager):
        self.vulnerabilities = vulnerabilities
        self.exceptions = exceptions
        self.errors = errors
        self.exception_manager = exception_manager
        self.matched_vulns: List[Tuple[Vulnerability, Optional[ExceptionEntry]]] = []
        self._match_vulnerabilities()
    
    def _match_vulnerabilities(self) -> None:
        """匹配漏洞和例外"""
        for vuln in self.vulnerabilities:
            exc = self.exception_manager.find_exception(
                vuln.id, vuln.component_name, vuln.component_version
            )
            self.matched_vulns.append((vuln, exc))
    
    def generate_terminal_summary(self) -> str:
        """生成终端摘要"""
        total = len(self.vulnerabilities)
        excepted = sum(1 for _, exc in self.matched_vulns if exc is not None and not exc.is_expired())
        expired_excepted = sum(1 for _, exc in self.matched_vulns if exc is not None and exc.is_expired())
        unexcepted = total - excepted - expired_excepted
        errors = len(self.errors)
        
        expiring = len(self.exception_manager.get_expiring_exceptions(7))
        
        summary = f"""
{'='*60}
                    SBOM漏洞例外报告
{'='*60}

📊 概览统计:
   总漏洞数:        {total}
   已例外（有效）:   {excepted}
   已例外（过期）:   {expired_excepted}
   需处理漏洞:      {unexcepted}
   处理错误数:      {errors}

⚠️  即将到期例外 (7天内): {expiring}

🔍 漏洞分布 (按严重程度):
"""
        # 统计未例外漏洞的分布
        risk_counts = {}
        for vuln, exc in self.matched_vulns:
            if exc is None or exc.is_expired():
                risk = RiskAssessor.get_risk_level(vuln)
                risk_counts[risk] = risk_counts.get(risk, 0) + 1
        
        for risk in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.UNKNOWN]:
            count = risk_counts.get(risk, 0)
            summary += f"   {risk.value.upper():10} {count}\n"
        
        if self.errors:
            summary += f"\n❌ 处理错误 ({errors}项):\n"
            for err in self.errors[:5]:
                summary += f"   - [{err.source_file}:{err.row_number}] {err.error_message}\n"
            if len(self.errors) > 5:
                summary += f"   ... 还有 {len(self.errors) - 5} 个错误\n"
        
        summary += f"\n{'='*60}\n"
        return summary
    
    def generate_json_report(self, output_file: str) -> None:
        """生成JSON报告"""
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_vulnerabilities": len(self.vulnerabilities),
                "excepted_active": sum(1 for _, exc in self.matched_vulns if exc is not None and not exc.is_expired()),
                "excepted_expired": sum(1 for _, exc in self.matched_vulns if exc is not None and exc.is_expired()),
                "unexcepted": sum(1 for _, exc in self.matched_vulns if exc is None),
                "errors": len(self.errors)
            },
            "vulnerabilities": [],
            "exceptions": [asdict(e) for e in self.exceptions],
            "expiring_exceptions": [asdict(e) for e in self.exception_manager.get_expiring_exceptions(7)],
            "errors": [asdict(e) for e in self.errors]
        }
        
        for vuln, exc in self.matched_vulns:
            vuln_dict = asdict(vuln)
            vuln_dict["exception"] = asdict(exc) if exc else None
            vuln_dict["exception_expired"] = exc.is_expired() if exc else None
            vuln_dict["risk_level"] = RiskAssessor.get_risk_level(vuln).value
            report["vulnerabilities"].append(vuln_dict)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    def generate_markdown_report(self, output_file: str) -> None:
        """生成Markdown报告（适合发给同事）"""
        total = len(self.vulnerabilities)
        excepted = sum(1 for _, exc in self.matched_vulns if exc is not None and not exc.is_expired())
        unexcepted = total - excepted
        
        md = f"""# SBOM漏洞例外报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 📊 概览

| 指标 | 数量 |
|------|------|
| 总漏洞数 | {total} |
| 已例外（有效） | {excepted} |
| 需处理漏洞 | {unexcepted} |

## ⚠️  需处理漏洞详情

"""
        
        # 按风险等级分组显示未例外漏洞
        unexcepted_by_risk = {}
        for vuln, exc in self.matched_vulns:
            if exc is None or exc.is_expired():
                risk = RiskAssessor.get_risk_level(vuln)
                if risk not in unexcepted_by_risk:
                    unexcepted_by_risk[risk] = []
                unexcepted_by_risk[risk].append((vuln, exc))
        
        for risk in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.UNKNOWN]:
            vulns = unexcepted_by_risk.get(risk, [])
            if not vulns:
                continue
            
            md += f"### {risk.value.upper()} ({len(vulns)}个)\n\n"
            md += "| 漏洞ID | 组件 | 版本 | 描述 | 例外状态 |\n"
            md += "|--------|------|------|------|----------|\n"
            
            for vuln, exc in vulns:
                status = "无例外" if exc is None else f"例外已过期 ({exc.expires_at})"
                desc = (vuln.description[:50] + "...") if len(vuln.description) > 50 else vuln.description
                md += f"| {vuln.id} | {vuln.component_name} | {vuln.component_version} | {desc} | {status} |\n"
            md += "\n"
        
        # 即将到期的例外
        expiring = self.exception_manager.get_expiring_exceptions(7)
        if expiring:
            md += f"## ⏰ 即将到期例外（7天内）\n\n"
            md += "| 漏洞ID | 组件 | 版本 | 到期时间 | 剩余天数 | 复核人 |\n"
            md += "|--------|------|------|----------|----------|--------|\n"
            
            for exc in expiring:
                days = exc.days_until_expiry()
                md += f"| {exc.vulnerability_id} | {exc.component_name} | {exc.component_version} | {exc.expires_at} | {days}天 | {exc.reviewer} |\n"
            md += "\n"
        
        # 错误详情
        if self.errors:
            md += f"## ❌ 处理错误\n\n"
            md += "| 源文件 | 行号 | 错误信息 | 原始数据 |\n"
            md += "|--------|------|----------|----------|\n"
            
            for err in self.errors:
                raw = (err.raw_data[:50] + "...") if len(err.raw_data) > 50 else err.raw_data
                md += f"| {err.source_file} | {err.row_number} | {err.error_message} | {raw} |\n"
            md += "\n"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(md)

@click.group()
def cli():
    """SBOM漏洞例外管理工具"""
    pass

@cli.command()
@click.argument('sbom_path', type=click.Path(exists=True))
@click.option('--exceptions', '-e', default='exceptions.json', help='例外文件路径')
@click.option('--output-json', '-j', default='report.json', help='JSON报告输出路径')
@click.option('--output-md', '-m', default='report.md', help='Markdown报告输出路径')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不输出终端摘要')
def scan(sbom_path: str, exceptions: str, output_json: str, output_md: str, quiet: bool):
    """扫描SBOM文件并匹配例外"""
    all_vulnerabilities = []
    all_errors = []
    exception_manager = ExceptionManager(exceptions)
    
    # 处理单个文件或目录
    path = Path(sbom_path)
    if path.is_file():
        files = [path]
    else:
        files = list(path.rglob("*.json")) + list(path.rglob("*.xml"))
    
    for file_path in files:
        if not quiet:
            click.echo(f"处理文件: {file_path}")
        
        vulns, errors = SBOMParser.parse_cyclonedx(str(file_path))
        all_vulnerabilities.extend(vulns)
        all_errors.extend(errors)
    
    # 生成报告
    report_gen = ReportGenerator(all_vulnerabilities, exception_manager.exceptions, all_errors, exception_manager)
    
    if not quiet:
        click.echo(report_gen.generate_terminal_summary())
    
    report_gen.generate_json_report(output_json)
    report_gen.generate_markdown_report(output_md)
    
    if not quiet:
        click.echo(f"JSON报告已保存至: {output_json}")
        click.echo(f"Markdown报告已保存至: {output_md}")
    
    # 如果有错误，返回非零退出码
    if all_errors:
        sys.exit(1)
    sys.exit(0)

@cli.command()
@click.option('--vuln-id', required=True, help='漏洞ID（支持*通配符）')
@click.option('--component', required=True, help='组件名称（支持*通配符）')
@click.option('--version', required=True, help='组件版本（支持*通配符）')
@click.option('--reason', required=True, help='例外理由')
@click.option('--expires', required=True, help='到期时间（ISO格式，如2024-12-31）')
@click.option('--reviewer', required=True, help='复核人')
@click.option('--exceptions', '-e', default='exceptions.json', help='例外文件路径')
def add(vuln_id: str, component: str, version: str, reason: str, expires: str, reviewer: str, exceptions: str):
    """添加新的例外"""
    exception_manager = ExceptionManager(exceptions)
    
    # 验证日期格式
    try:
        datetime.fromisoformat(expires)
    except ValueError:
        click.echo(f"错误: 日期格式无效，请使用ISO格式（如2024-12-31）", err=True)
        sys.exit(1)
    
    exception = ExceptionEntry(
        vulnerability_id=vuln_id,
        component_name=component,
        component_version=version,
        reason=reason,
        expires_at=expires,
        reviewer=reviewer
    )
    
    exception_manager.add_exception(exception)
    click.echo(f"✅ 例外已添加成功!")
    click.echo(f"   漏洞ID: {vuln_id}")
    click.echo(f"   组件: {component}@{version}")
    click.echo(f"   到期时间: {expires}")
    click.echo(f"   复核人: {reviewer}")

@cli.command()
@click.option('--days', '-d', default=7, type=int, help='检查未来N天内到期的例外')
@click.option('--exceptions', '-e', default='exceptions.json', help='例外文件路径')
def check_expiry(days: int, exceptions: str):
    """检查即将到期的例外"""
    exception_manager = ExceptionManager(exceptions)
    
    expiring = exception_manager.get_expiring_exceptions(days)
    expired = exception_manager.get_expired_exceptions()
    
    if expired:
        click.echo(f"\n❌ 已过期例外 ({len(expired)}个):")
        for exc in expired:
            click.echo(f"   - {exc.vulnerability_id} ({exc.component_name}@{exc.component_version}) - 于 {exc.expires_at} 过期")
    
    if expiring:
        click.echo(f"\n⚠️  {days}天内即将到期例外 ({len(expiring)}个):")
        for exc in expiring:
            days_left = exc.days_until_expiry()
            click.echo(f"   - {exc.vulnerability_id} ({exc.component_name}@{exc.component_version}) - {days_left}天后到期 ({exc.expires_at})")
    
    if not expired and not expiring:
        click.echo(f"✅ 没有即将到期或已过期的例外")
    
    if expired:
        sys.exit(1)
    sys.exit(0)

@cli.command()
@click.option('--exceptions', '-e', default='exceptions.json', help='例外文件路径')
def list(exceptions: str):
    """列出所有例外"""
    exception_manager = ExceptionManager(exceptions)
    
    if not exception_manager.exceptions:
        click.echo("当前没有例外记录")
        return
    
    click.echo(f"\n共有 {len(exception_manager.exceptions)} 条例外:\n")
    for i, exc in enumerate(exception_manager.exceptions, 1):
        status = "✅ 有效" if not exc.is_expired() else "❌ 已过期"
        days_left = exc.days_until_expiry()
        days_str = f"（剩余{days_left}天）" if days_left is not None and days_left >= 0 else ""
        
        click.echo(f"{i}. [{status}] {exc.vulnerability_id}")
        click.echo(f"   组件: {exc.component_name}@{exc.component_version}")
        click.echo(f"   理由: {exc.reason}")
        click.echo(f"   到期: {exc.expires_at}{days_str}")
        click.echo(f"   复核人: {exc.reviewer}\n")

if __name__ == '__main__':
    cli()