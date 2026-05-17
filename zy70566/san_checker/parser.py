import os
import re
from datetime import datetime
from typing import List, Dict, Any
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import ExtensionOID, NameOID

from .exceptions import CSRParseError, CertificateParseError, DomainListParseError


def parse_csr(csr_path: str) -> Dict[str, Any]:
    if not os.path.exists(csr_path):
        raise CSRParseError(f"CSR file not found: {csr_path}", file_path=csr_path)
    
    try:
        with open(csr_path, 'rb') as f:
            csr_data = f.read()
        
        csr = x509.load_pem_x509_csr(csr_data, default_backend())
        
        common_name = None
        for attr in csr.subject:
            if attr.oid == NameOID.COMMON_NAME:
                common_name = attr.value
                break
        
        san_list: List[str] = []
        try:
            san_ext = csr.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
            for name in san_ext.value:
                if isinstance(name, x509.DNSName):
                    san_list.append(name.value)
        except x509.ExtensionNotFound:
            pass
        
        return {
            "file_path": os.path.abspath(csr_path),
            "file_name": os.path.basename(csr_path),
            "common_name": common_name,
            "san_list": san_list,
            "parsed_at": datetime.now().isoformat()
        }
    
    except CSRParseError:
        raise
    except Exception as e:
        raise CSRParseError(f"Failed to parse CSR: {str(e)}", file_path=csr_path)


def parse_certificate(cert_path: str) -> Dict[str, Any]:
    if not os.path.exists(cert_path):
        raise CertificateParseError(f"Certificate file not found: {cert_path}", file_path=cert_path)
    
    try:
        with open(cert_path, 'rb') as f:
            cert_data = f.read()
        
        cert = x509.load_pem_x509_certificate(cert_data, default_backend())
        
        common_name = None
        for attr in cert.subject:
            if attr.oid == NameOID.COMMON_NAME:
                common_name = attr.value
                break
        
        issuer_cn = None
        for attr in cert.issuer:
            if attr.oid == NameOID.COMMON_NAME:
                issuer_cn = attr.value
                break
        
        san_list: List[str] = []
        try:
            san_ext = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
            for name in san_ext.value:
                if isinstance(name, x509.DNSName):
                    san_list.append(name.value)
        except x509.ExtensionNotFound:
            pass
        
        not_before = cert.not_valid_before
        not_after = cert.not_valid_after
        now = datetime.utcnow()
        days_remaining = (not_after - now).days
        is_expired = now > not_after
        
        return {
            "file_path": os.path.abspath(cert_path),
            "file_name": os.path.basename(cert_path),
            "common_name": common_name,
            "san_list": san_list,
            "issuer": issuer_cn,
            "not_before": not_before.isoformat(),
            "not_after": not_after.isoformat(),
            "days_remaining": days_remaining,
            "is_expired": is_expired,
            "parsed_at": datetime.now().isoformat()
        }
    
    except CertificateParseError:
        raise
    except Exception as e:
        raise CertificateParseError(f"Failed to parse certificate: {str(e)}", file_path=cert_path)


def parse_domain_list(domain_list_path: str) -> Dict[str, Any]:
    if not os.path.exists(domain_list_path):
        raise DomainListParseError(f"Domain list file not found: {domain_list_path}", file_path=domain_list_path)
    
    domains: List[str] = []
    bad_lines: List[Dict[str, Any]] = []
    line_count = 0
    
    domain_pattern = re.compile(
        r'^(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
    )
    
    try:
        with open(domain_list_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line_count += 1
                raw_line = line.rstrip('\n')
                cleaned = raw_line.strip()
                
                if not cleaned or cleaned.startswith('#'):
                    continue
                
                if ' ' in cleaned or '\t' in cleaned:
                    bad_lines.append({
                        "line_number": line_num,
                        "raw_content": raw_line,
                        "reason": "Contains whitespace"
                    })
                    continue
                
                if not domain_pattern.match(cleaned):
                    bad_lines.append({
                        "line_number": line_num,
                        "raw_content": raw_line,
                        "reason": "Invalid domain format"
                    })
                    continue
                
                domains.append(cleaned)
    
    except Exception as e:
        raise DomainListParseError(f"Failed to read domain list: {str(e)}", file_path=domain_list_path)
    
    return {
        "file_path": os.path.abspath(domain_list_path),
        "file_name": os.path.basename(domain_list_path),
        "domains": domains,
        "domain_count": len(domains),
        "line_count": line_count,
        "bad_lines": bad_lines,
        "bad_line_count": len(bad_lines),
        "parsed_at": datetime.now().isoformat()
    }
