#!/usr/bin/env python3
import os

modules = {
    'san_checker/__init__.py': '''__version__ = "1.0.0"
''',

    'san_checker/exceptions.py': '''class SanCheckerError(Exception):
    pass

class ParseError(SanCheckerError):
    def __init__(self, message, file_path=None, line_number=None, raw_content=None):
        super().__init__(message)
        self.file_path = file_path
        self.line_number = line_number
        self.raw_content = raw_content
    
    def __str__(self):
        parts = [super().__str__()]
        if self.file_path:
            parts.append(f"File: {self.file_path}")
        if self.line_number is not None:
            parts.append(f"Line: {self.line_number}")
        if self.raw_content:
            parts.append(f"Raw content: {self.raw_content}")
        return " | ".join(parts)

class CertificateParseError(ParseError):
    pass

class CSRParseError(ParseError):
    pass

class DomainListParseError(ParseError):
    pass
''',

    'san_checker/parser.py': '''import os
import re
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, ec, dsa

from .exceptions import CSRParseError, CertificateParseError, DomainListParseError


def parse_csr(csr_path: str) -> Dict[str, Any]:
    if not os.path.exists(csr_path):
        raise CSRParseError(f"CSR file not found: {csr_path}", file_path=csr_path)
    
    try:
        with open(csr_path, "rb") as f:
            csr_data = f.read()
        
        if b"-----BEGIN CERTIFICATE REQUEST-----" in csr_data:
            csr = x509.load_pem_x509_csr(csr_data, default_backend())
        else:
            csr = x509.load_der_x509_csr(csr_data, default_backend())
        
        common_name = None
        try:
            cn_attrs = csr.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)
            if cn_attrs:
                common_name = cn_attrs[0].value
        except Exception:
            pass
        
        san_list = []
        try:
            san_ext = csr.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            for name in san_ext.value:
                if isinstance(name, x509.DNSName):
                    san_list.append(name.value)
        except x509.ExtensionNotFound:
            pass
        
        public_key = csr.public_key()
        key_type = "Unknown"
        key_size = None
        if isinstance(public_key, rsa.RSAPublicKey):
            key_type = "RSA"
            key_size = public_key.key_size
        elif isinstance(public_key, ec.EllipticCurvePublicKey):
            key_type = "EC"
            key_size = public_key.key_size
        elif isinstance(public_key, dsa.DSAPublicKey):
            key_type = "DSA"
            key_size = public_key.key_size
        
        return {
            "file_path": os.path.abspath(csr_path),
            "file_name": os.path.basename(csr_path),
            "common_name": common_name,
            "san_list": san_list,
            "key_type": key_type,
            "key_size": key_size,
            "signature_algorithm": csr.signature_algorithm_oid._name if hasattr(csr, "signature_algorithm_oid") else "Unknown",
            "is_valid_signature": csr.is_signature_valid,
        }
    except Exception as e:
        raise CSRParseError(
            f"Failed to parse CSR: {str(e)}",
            file_path=csr_path,
            raw_content=str(csr_data[:200]) if len(csr_data) > 200 else str(csr_data)
        ) from e


def parse_certificate(cert_path: str) -> Dict[str, Any]:
    if not os.path.exists(cert_path):
        raise CertificateParseError(f"Certificate file not found: {cert_path}", file_path=cert_path)
    
    try:
        with open(cert_path, "rb") as f:
            cert_data = f.read()
        
        if b"-----BEGIN CERTIFICATE-----" in cert_data:
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())
        else:
            cert = x509.load_der_x509_certificate(cert_data, default_backend())
        
        common_name = None
        try:
            cn_attrs = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)
            if cn_attrs:
                common_name = cn_attrs[0].value
        except Exception:
            pass
        
        issuer_cn = None
        try:
            issuer_attrs = cert.issuer.get_attributes_for_oid(x509.NameOID.COMMON_NAME)
            if issuer_attrs:
                issuer_cn = issuer_attrs[0].value
        except Exception:
            pass
        
        san_list = []
        try:
            san_ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            for name in san_ext.value:
                if isinstance(name, x509.DNSName):
                    san_list.append(name.value)
        except x509.ExtensionNotFound:
            pass
        
        not_before = cert.not_valid_before
        not_after = cert.not_valid_after
        now = datetime.utcnow()
        days_until_expiry = (not_after - now).days
        is_expired = now > not_after
        
        public_key = cert.public_key()
        key_type = "Unknown"
        key_size = None
        if isinstance(public_key, rsa.RSAPublicKey):
            key_type = "RSA"
            key_size = public_key.key_size
        elif isinstance(public_key, ec.EllipticCurvePublicKey):
            key_type = "EC"
            key_size = public_key.key_size
        elif isinstance(public_key, dsa.DSAPublicKey):
            key_type = "DSA"
            key_size = public_key.key_size
        
        serial_number = format(cert.serial_number, "x")
        if len(serial_number) % 2 == 1:
            serial_number = "0" + serial_number
        serial_formatted = ":".join(serial_number[i:i+2] for i in range(0, len(serial_number), 2))
        
        return {
            "file_path": os.path.abspath(cert_path),
            "file_name": os.path.basename(cert_path),
            "common_name": common_name,
            "issuer_cn": issuer_cn,
            "san_list": san_list,
            "not_before": not_before.isoformat(),
            "not_after": not_after.isoformat(),
            "days_until_expiry": days_until_expiry,
            "is_expired": is_expired,
            "key_type": key_type,
            "key_size": key_size,
            "signature_algorithm": cert.signature_algorithm_oid._name if hasattr(cert, "signature_algorithm_oid") else "Unknown",
            "serial_number": serial_formatted,
            "version": f"v{cert.version.value}",
        }
    except Exception as e:
        raise CertificateParseError(
            f"Failed to parse certificate: {str(e)}",
            file_path=cert_path,
            raw_content=str(cert_data[:200]) if len(cert_data) > 200 else str(cert_data)
        ) from e


def parse_domain_list(domain_list_path: str) -> Dict[str, Any]:
    if not os.path.exists(domain_list_path):
        raise DomainListParseError(f"Domain list file not found: {domain_list_path}", file_path=domain_list_path)
    
    domains = []
    errors = []
    line_num = 0
    
    try:
        with open(domain_list_path, "r", encoding="utf-8") as f:
            for line in f:
                line_num += 1
                raw_line = line.rstrip("\\n\\r")
                stripped = raw_line.strip()
                
                if not stripped or stripped.startswith("#"):
                    continue
                
                if " " in stripped or "\\t" in stripped:
                    errors.append({
                        "line_number": line_num,
                        "raw_content": raw_line,
                        "reason": "Contains whitespace"
                    })
                    continue
                
                domain_pattern = r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"
                wildcard_pattern = r"^\\*(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
                
                if not re.match(domain_pattern, stripped) and not re.match(wildcard_pattern, stripped):
                    errors.append({
                        "line_number": line_num,
                        "raw_content": raw_line,
                        "reason": "Invalid domain format"
                    })
                    continue
                
                domains.append({
                    "domain": stripped,
                    "line_number": line_num,
                    "is_wildcard": stripped.startswith("*")
                })
        
        return {
            "file_path": os.path.abspath(domain_list_path),
            "file_name": os.path.basename(domain_list_path),
            "domains": [d["domain"] for d in domains],
            "domain_details": domains,
            "errors": errors,
            "total_count": len(domains),
            "error_count": len(errors)
        }
    except Exception as e:
        raise DomainListParseError(
            f"Failed to parse domain list: {str(e)}",
            file_path=domain_list_path,
            line_number=line_num
        ) from e
''',

    'san_checker/comparer.py': '''import fnmatch
from typing import List, Dict, Any, Set, Tuple
from dataclasses import dataclass


@dataclass
class MatchResult:
    domain: str
    matched_san: str
    is_wildcard_match: bool
    is_exact_match: bool


def matches_wildcard(domain: str, wildcard_pattern: str) -> bool:
    return fnmatch.fnmatch(domain, wildcard_pattern)


def find_matching_san(domain: str, san_list: List[str]) -> Tuple[Optional[str], bool, bool]:
    if domain in san_list:
        return (domain, True, False)
    
    for san in san_list:
        if san.startswith("*."):
            if matches_wildcard(domain, san):
                return (san, False, True)
    
    return (None, False, False)


def compare_domains_with_san(domains: List[str], san_list: List[str]) -> Dict[str, Any]:
    matched: List[MatchResult] = []
    missing: List[str] = []
    matched_domains: Set[str] = set()
    
    for domain in domains:
        matched_san, is_exact, is_wildcard = find_matching_san(domain, san_list)
        if matched_san:
            matched.append(MatchResult(
                domain=domain,
                matched_san=matched_san,
                is_wildcard_match=is_wildcard,
                is_exact_match=is_exact
            ))
            matched_domains.add(domain)
        else:
            missing.append(domain)
    
    extra_san = [san for san in san_list if san not in domains]
    
    return {
        "total_domains": len(domains),
        "total_san": len(san_list),
        "matched_count": len(matched),
        "missing_count": len(missing),
        "extra_san_count": len(extra_san),
        "matched": [
            {
                "domain": m.domain,
                "matched_san": m.matched_san,
                "is_wildcard_match": m.is_wildcard_match,
                "is_exact_match": m.is_exact_match
            }
            for m in matched
        ],
        "missing": missing,
        "extra_san": extra_san,
        "has_missing": len(missing) > 0,
        "match_percentage": round((len(matched) / len(domains) * 100), 2) if domains else 0
    }


def compare_csr_with_cert(csr_data: Dict[str, Any], cert_data: Dict[str, Any]) -> Dict[str, Any]:
    csr_san_set = set(csr_data.get("san_list", []))
    cert_san_set = set(cert_data.get("san_list", []))
    
    san_in_csr_but_not_cert = list(csr_san_set - cert_san_set)
    san_in_cert_but_not_csr = list(cert_san_set - csr_san_set)
    common_san = list(csr_san_set & cert_san_set)
    
    csr_cn = csr_data.get("common_name")
    cert_cn = cert_data.get("common_name")
    
    cn_match = csr_cn == cert_cn if csr_cn and cert_cn else None
    
    key_type_match = (
        csr_data.get("key_type") == cert_data.get("key_type")
        if csr_data.get("key_type") and cert_data.get("key_type")
        else None
    )
    
    return {
        "cn_match": cn_match,
        "csr_cn": csr_cn,
        "cert_cn": cert_cn,
        "key_type_match": key_type_match,
        "csr_key_type": csr_data.get("key_type"),
        "cert_key_type": cert_data.get("key_type"),
        "common_san_count": len(common_san),
        "san_in_csr_but_not_cert": san_in_csr_but_not_cert,
        "san_in_csr_but_not_cert_count": len(san_in_csr_but_not_cert),
        "san_in_cert_but_not_csr": san_in_cert_but_not_csr,
        "san_in_cert_but_not_csr_count": len(san_in_cert_but_not_csr),
        "common_san": common_san,
        "has_discrepancies": len(san_in_csr_but_not_cert) > 0 or len(san_in_cert_but_not_csr) > 0
    }
''',

    'san_checker/reporter.py': '''import os
import json
from datetime import datetime
from typing import Dict, Any, List
from tabulate import tabulate


def generate_terminal_summary(result: Dict[str, Any]) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("证书SAN核对报告")
    lines.append("=" * 60)
    lines.append("")
    
    if "certificate" in result:
        cert = result["certificate"]
        lines.append(f"证书文件: {cert.get('file_name', 'N/A')}")
        lines.append(f"通用名称 (CN): {cert.get('common_name', 'N/A')}")
        lines.append(f"颁发者: {cert.get('issuer_cn', 'N/A')}")
        lines.append(f"有效期至: {cert.get('not_after', 'N/A')}")
        lines.append(f"距离过期: {cert.get('days_until_expiry', 'N/A')} 天")
        if cert.get('is_expired'):
            lines.append("  ⚠️  证书已过期!")
        lines.append(f"SAN条目数: {len(cert.get('san_list', []))}")
        lines.append("")
    
    if "domain_list" in result:
        dl = result["domain_list"]
        lines.append(f"域名列表: {dl.get('file_name', 'N/A')}")
        lines.append(f"有效域名数: {dl.get('total_count', 0)}")
        if dl.get('error_count', 0) > 0:
            lines.append(f"错误格式行数: {dl.get('error_count', 0)}")
        lines.append("")
    
    if "comparison" in result:
        comp = result["comparison"]
        lines.append("-" * 60)
        lines.append("SAN对比结果")
        lines.append("-" * 60)
        lines.append(f"域名总数: {comp.get('total_domains', 0)}")
        lines.append(f"匹配数: {comp.get('matched_count', 0)}")
        lines.append(f"缺失数: {comp.get('missing_count', 0)}")
        lines.append(f"额外SAN: {comp.get('extra_san_count', 0)}")
        lines.append(f"匹配率: {comp.get('match_percentage', 0)}%")
        lines.append("")
        
        if comp.get('missing'):
            lines.append("缺失的域名:")
            for domain in comp['missing'][:10]:
                lines.append(f"  - {domain}")
            if len(comp['missing']) > 10:
                lines.append(f"  ... 还有 {len(comp['missing']) - 10} 个")
            lines.append("")
        
        if comp.get('extra_san'):
            lines.append("证书中额外的SAN:")
            for san in comp['extra_san'][:10]:
                lines.append(f"  - {san}")
            if len(comp['extra_san']) > 10:
                lines.append(f"  ... 还有 {len(comp['extra_san']) - 10} 个")
            lines.append("")
    
    if "parse_errors" in result and result["parse_errors"]:
        lines.append("-" * 60)
        lines.append("解析错误")
        lines.append("-" * 60)
        for err in result["parse_errors"]:
            lines.append(f"  {err}")
        lines.append("")
    
    lines.append("=" * 60)
    return "\\n".join(lines)


def generate_json_report(result: Dict[str, Any], output_path: str) -> None:
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)


def generate_markdown_report(result: Dict[str, Any], output_path: str) -> None:
    lines = []
    lines.append("# 证书SAN核对报告")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    if "certificate" in result:
        cert = result["certificate"]
        lines.append("## 证书信息")
        lines.append("")
        lines.append("| 项目 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 证书文件 | {cert.get('file_name', 'N/A')} |")
        lines.append(f"| 通用名称 (CN) | {cert.get('common_name', 'N/A')} |")
        lines.append(f"| 颁发者 | {cert.get('issuer_cn', 'N/A')} |")
        lines.append(f"| 序列号 | {cert.get('serial_number', 'N/A')} |")
        lines.append(f"| 有效期开始 | {cert.get('not_before', 'N/A')} |")
        lines.append(f"| 有效期结束 | {cert.get('not_after', 'N/A')} |")
        lines.append(f"| 距离过期 | {cert.get('days_until_expiry', 'N/A')} 天 |")
        lines.append(f"| 密钥类型 | {cert.get('key_type', 'N/A')} |")
        lines.append(f"| 密钥长度 | {cert.get('key_size', 'N/A')} 位 |")
        lines.append(f"| SAN条目数 | {len(cert.get('san_list', []))} |")
        lines.append("")
        
        san_list = cert.get('san_list', [])
        if san_list:
            lines.append("### SAN列表")
            lines.append("")
            for san in san_list:
                lines.append(f"- {san}")
            lines.append("")
    
    if "domain_list" in result:
        dl = result["domain_list"]
        lines.append("## 域名列表信息")
        lines.append("")
        lines.append(f"- 文件: {dl.get('file_name', 'N/A')}")
        lines.append(f"- 有效域名数: {dl.get('total_count', 0)}")
        lines.append("")
        
        if dl.get('errors'):
            lines.append("### 格式错误")
            lines.append("")
            lines.append("| 行号 | 内容 | 原因 |")
            lines.append("|------|------|------|")
            for err in dl['errors']:
                lines.append(f"| {err.get('line_number', 'N/A')} | `{err.get('raw_content', '')}` | {err.get('reason', 'N/A')} |")
            lines.append("")
        
        domain_details = dl.get('domain_details', [])
        if domain_details:
            lines.append("### 域名列表")
            lines.append("")
            lines.append("| 行号 | 域名 | 通配符 |")
            lines.append("|------|------|--------|")
            for d in domain_details:
                wc = "是" if d.get('is_wildcard') else "否"
                lines.append(f"| {d.get('line_number', 'N/A')} | {d.get('domain', '')} | {wc} |")
            lines.append("")
    
    if "comparison" in result:
        comp = result["comparison"]
        lines.append("## 对比结果")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 域名总数 | {comp.get('total_domains', 0)} |")
        lines.append(f"| 证书SAN总数 | {comp.get('total_san', 0)} |")
        lines.append(f"| 匹配域名数 | {comp.get('matched_count', 0)} |")
        lines.append(f"| 缺失域名数 | {comp.get('missing_count', 0)} |")
        lines.append(f"| 额外SAN数 | {comp.get('extra_san_count', 0)} |")
        lines.append(f"| 匹配率 | {comp.get('match_percentage', 0)}% |")
        lines.append("")
        
        matched = comp.get('matched', [])
        if matched:
            lines.append("### 匹配的域名")
            lines.append("")
            lines.append("| 域名 | 匹配的SAN | 精确匹配 | 通配符匹配 |")
            lines.append("|------|----------|----------|------------|")
            for m in matched:
                exact = "是" if m.get('is_exact_match') else "否"
                wildcard = "是" if m.get('is_wildcard_match') else "否"
                lines.append(f"| {m.get('domain', '')} | {m.get('matched_san', '')} | {exact} | {wildcard} |")
            lines.append("")
        
        missing = comp.get('missing', [])
        if missing:
            lines.append("### ❌ 缺失的域名（需要补充）")
            lines.append("")
            for domain in missing:
                lines.append(f"- **{domain}**")
            lines.append("")
        
        extra_san = comp.get('extra_san', [])
        if extra_san:
            lines.append("### 证书中额外的SAN")
            lines.append("")
            for san in extra_san:
                lines.append(f"- {san}")
            lines.append("")
    
    if "csr_cert_comparison" in result:
        ccomp = result["csr_cert_comparison"]
        lines.append("## CSR与证书对比")
        lines.append("")
        lines.append(f"- CSR CN: {ccomp.get('csr_cn', 'N/A')}")
        lines.append(f"- 证书 CN: {ccomp.get('cert_cn', 'N/A')}")
        lines.append(f"- CN匹配: {'✅' if ccomp.get('cn_match') else '❌'}")
        lines.append("")
        
        if ccomp.get('has_discrepancies'):
            lines.append("### ⚠️ SAN差异")
            lines.append("")
            if ccomp.get('san_in_csr_but_not_cert'):
                lines.append("#### CSR有但证书没有:")
                for san in ccomp['san_in_csr_but_not_cert']:
                    lines.append(f"- {san}")
                lines.append("")
            if ccomp.get('san_in_cert_but_not_csr'):
                lines.append("#### 证书有但CSR没有:")
                for san in ccomp['san_in_cert_but_not_csr']:
                    lines.append(f"- {san}")
                lines.append("")
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\\n".join(lines))


def generate_reports(result: Dict[str, Any], output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)
    
    json_path = os.path.join(output_dir, "san-check-result.json")
    generate_json_report(result, json_path)
    
    md_path = os.path.join(output_dir, "san-check-report.md")
    generate_markdown_report(result, md_path)
''',

    'san_checker/cli.py': '''#!/usr/bin/env python3
import os
import sys
import click
from datetime import datetime

from .parser import parse_csr, parse_certificate, parse_domain_list
from .comparer import compare_domains_with_san, compare_csr_with_cert
from .reporter import generate_terminal_summary, generate_reports
from .exceptions import SanCheckerError


@click.group()
def cli():
    """证书SAN核对工具 - 批量检查证书SAN是否包含所有需要的域名"""
    pass


@cli.command()
@click.argument('cert_path', type=click.Path(exists=True))
@click.argument('domain_list_path', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='输出报告目录')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，只输出错误')
def check(cert_path, domain_list_path, output, quiet):
    """检查证书SAN与域名列表
    
    CERT_PATH: 证书文件路径 (PEM/DER格式)
    DOMAIN_LIST_PATH: 域名列表文件 (每行一个域名)
    """
    result = {
        "timestamp": datetime.now().isoformat(),
        "parse_errors": []
    }
    
    try:
        cert_data = parse_certificate(cert_path)
        result["certificate"] = cert_data
    except SanCheckerError as e:
        result["parse_errors"].append(str(e))
    
    try:
        domain_data = parse_domain_list(domain_list_path)
        result["domain_list"] = domain_data
    except SanCheckerError as e:
        result["parse_errors"].append(str(e))
    
    if "certificate" in result and "domain_list" in result:
        comparison = compare_domains_with_san(
            domain_data["domains"],
            cert_data["san_list"]
        )
        result["comparison"] = comparison
    
    if not quiet:
        click.echo(generate_terminal_summary(result))
    
    if output:
        generate_reports(result, output)
        if not quiet:
            click.echo(f"报告已保存到: {output}")
    
    if result.get("comparison", {}).get("has_missing", False):
        sys.exit(2)
    if result.get("parse_errors"):
        sys.exit(1)


@cli.command()
@click.argument('csr_path', type=click.Path(exists=True))
@click.argument('cert_path', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='输出报告目录')
@click.option('--quiet', '-q', is_flag=True, help='静默模式')
def compare(csr_path, cert_path, output, quiet):
    """对比CSR和证书
    
    CSR_PATH: CSR文件路径
    CERT_PATH: 证书文件路径
    """
    result = {
        "timestamp": datetime.now().isoformat(),
        "parse_errors": []
    }
    
    try:
        csr_data = parse_csr(csr_path)
        result["csr"] = csr_data
    except SanCheckerError as e:
        result["parse_errors"].append(str(e))
    
    try:
        cert_data = parse_certificate(cert_path)
        result["certificate"] = cert_data
    except SanCheckerError as e:
        result["parse_errors"].append(str(e))
    
    if "csr" in result and "certificate" in result:
        comparison = compare_csr_with_cert(csr_data, cert_data)
        result["csr_cert_comparison"] = comparison
    
    if not quiet:
        click.echo(generate_terminal_summary(result))
    
    if output:
        generate_reports(result, output)
    
    if result.get("csr_cert_comparison", {}).get("has_discrepancies", False):
        sys.exit(2)
    if result.get("parse_errors"):
        sys.exit(1)


@cli.command()
@click.argument('csr_path', type=click.Path(exists=True))
def inspect_csr(csr_path):
    """查看CSR信息"""
    try:
        csr_data = parse_csr(csr_path)
        click.echo("CSR信息:")
        click.echo(f"  文件: {csr_data['file_name']}")
        click.echo(f"  通用名称: {csr_data['common_name']}")
        click.echo(f"  密钥类型: {csr_data['key_type']}")
        click.echo(f"  密钥长度: {csr_data['key_size']} 位")
        click.echo(f"  签名算法: {csr_data['signature_algorithm']}")
        click.echo(f"  签名有效: {csr_data['is_valid_signature']}")
        click.echo(f"  SAN列表 ({len(csr_data['san_list'])}):")
        for san in csr_data['san_list']:
            click.echo(f"    - {san}")
    except SanCheckerError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('cert_path', type=click.Path(exists=True))
def inspect_cert(cert_path):
    """查看证书信息"""
    try:
        cert_data = parse_certificate(cert_path)
        click.echo("证书信息:")
        click.echo(f"  文件: {cert_data['file_name']}")
        click.echo(f"  通用名称: {cert_data['common_name']}")
        click.echo(f"  颁发者: {cert_data['issuer_cn']}")
        click.echo(f"  序列号: {cert_data['serial_number']}")
        click.echo(f"  有效期开始: {cert_data['not_before']}")
        click.echo(f"  有效期结束: {cert_data['not_after']}")
        click.echo(f"  距离过期: {cert_data['days_until_expiry']} 天")
        if cert_data['is_expired']:
            click.echo("  ⚠️  证书已过期!")
        click.echo(f"  密钥类型: {cert_data['key_type']}")
        click.echo(f"  密钥长度: {cert_data['key_size']} 位")
        click.echo(f"  SAN列表 ({len(cert_data['san_list'])}):")
        for san in cert_data['san_list']:
            click.echo(f"    - {san}")
    except SanCheckerError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


def main():
    try:
        cli()
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
'''
}

for path, content in modules.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {path}")

print("\nAll modules generated successfully!")
