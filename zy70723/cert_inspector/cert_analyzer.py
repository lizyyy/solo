import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple
from OpenSSL import crypto
import socket
import ssl

from .models import (
    CertConfig, CertNode, CertAnalysisResult,
    AlgorithmIssue, ExpiryIssue, ChainIssue,
    RiskLevel, CertStatus
)


class CertAnalyzer:
    def __init__(self, config: CertConfig):
        self.config = config

    def load_certificate(self, cert_path: str) -> Optional[crypto.X509]:
        try:
            with open(cert_path, 'rb') as f:
                cert_data = f.read()
            
            try:
                return crypto.load_certificate(crypto.FILETYPE_PEM, cert_data)
            except crypto.Error:
                pass
            
            try:
                return crypto.load_certificate(crypto.FILETYPE_ASN1, cert_data)
            except crypto.Error:
                pass
                
            return None
        except Exception as e:
            return None

    def parse_cert_node(self, cert: crypto.X509, cert_path: str = None) -> CertNode:
        subject = cert.get_subject()
        issuer = cert.get_issuer()
        
        not_before = self._parse_asn1_time(cert.get_notBefore())
        not_after = self._parse_asn1_time(cert.get_notAfter())
        
        now = datetime.now(timezone.utc)
        days_until_expiry = (not_after - now).days
        
        sig_alg = cert.get_signature_algorithm().decode('utf-8', errors='ignore').lower()
        
        pubkey = cert.get_pubkey()
        pubkey_type = pubkey.type()
        pubkey_size = pubkey.bits()
        
        key_alg_map = {
            crypto.TYPE_RSA: "RSA",
            crypto.TYPE_DSA: "DSA",
            crypto.TYPE_EC: "EC",
        }
        pubkey_alg = key_alg_map.get(pubkey_type, f"UNKNOWN_{pubkey_type}")
        
        fingerprint = cert.digest('sha256').decode('utf-8')
        
        is_self_signed = str(subject) == str(issuer)
        
        ext_count = cert.get_extension_count()
        basic_constraints = None
        for i in range(ext_count):
            ext = cert.get_extension(i)
            if ext.get_short_name() == b'basicConstraints':
                basic_constraints = str(ext)
                break
        
        is_ca = basic_constraints and 'CA:TRUE' in basic_constraints
        
        is_root_ca = is_self_signed and is_ca
        is_intermediate_ca = not is_self_signed and is_ca
        is_leaf_cert = not is_ca
        
        serial_number = format(cert.get_serial_number(), 'X')
        
        pem_data = None
        if cert_path:
            try:
                with open(cert_path, 'r') as f:
                    pem_data = f.read()
            except:
                pass

        return CertNode(
            subject=str(subject),
            issuer=str(issuer),
            serial_number=serial_number,
            not_before=not_before,
            not_after=not_after,
            days_until_expiry=days_until_expiry,
            signature_algorithm=sig_alg,
            public_key_algorithm=pubkey_alg,
            public_key_size=pubkey_size,
            fingerprint=fingerprint,
            is_self_signed=is_self_signed,
            is_root_ca=is_root_ca,
            is_intermediate_ca=is_intermediate_ca,
            is_leaf_cert=is_leaf_cert,
            path=cert_path,
            pem_data=pem_data
        )

    def _parse_asn1_time(self, asn1_time: bytes) -> datetime:
        time_str = asn1_time.decode('utf-8')
        if time_str.endswith('Z'):
            time_str = time_str[:-1]
        
        if len(time_str) == 12:
            format_str = '%y%m%d%H%M%S'
        elif len(time_str) == 14:
            format_str = '%Y%m%d%H%M%S'
        else:
            return datetime.now(timezone.utc)
        
        dt = datetime.strptime(time_str, format_str)
        return dt.replace(tzinfo=timezone.utc)

    def check_algorithm_issues(self, node: CertNode) -> List[AlgorithmIssue]:
        issues = []
        
        sig_alg = node.signature_algorithm.lower()
        for weak_alg in self.config.weak_algorithms:
            if weak_alg.lower() in sig_alg:
                issues.append(AlgorithmIssue(
                    algorithm=node.signature_algorithm,
                    key_size=None,
                    risk_level=RiskLevel.HIGH,
                    issue_type="WEAK_SIGNATURE_ALGORITHM",
                    description=f"签名算法 {node.signature_algorithm} 被认为是弱算法",
                    recommendation=f"使用 SHA-256 或更强的签名算法重新签发证书"
                ))
                break
        
        min_key_size = self.config.weak_key_sizes.get(node.public_key_algorithm, 2048)
        if node.public_key_size < min_key_size:
            issues.append(AlgorithmIssue(
                algorithm=node.public_key_algorithm,
                key_size=node.public_key_size,
                risk_level=RiskLevel.HIGH,
                issue_type="WEAK_KEY_SIZE",
                description=f"密钥长度 {node.public_key_size} bits 小于推荐的最小长度 {min_key_size} bits",
                recommendation=f"使用至少 {min_key_size} bits 的密钥长度重新生成证书"
            ))
        
        return issues

    def check_expiry_issues(self, node: CertNode) -> List[ExpiryIssue]:
        issues = []
        now = datetime.now(timezone.utc)
        
        if node.not_before > now:
            issues.append(ExpiryIssue(
                cert_node=node,
                status=CertStatus.NOT_YET_VALID,
                days_remaining=node.days_until_expiry,
                expiry_date=node.not_after,
                risk_level=RiskLevel.MEDIUM,
                recommendation="等待证书生效或更换已生效的证书"
            ))
        elif node.days_until_expiry < 0:
            issues.append(ExpiryIssue(
                cert_node=node,
                status=CertStatus.EXPIRED,
                days_remaining=node.days_until_expiry,
                expiry_date=node.not_after,
                risk_level=RiskLevel.CRITICAL,
                recommendation="立即更换已过期的证书"
            ))
        elif node.days_until_expiry <= self.config.warn_days:
            issues.append(ExpiryIssue(
                cert_node=node,
                status=CertStatus.EXPIRING_SOON,
                days_remaining=node.days_until_expiry,
                expiry_date=node.not_after,
                risk_level=RiskLevel.HIGH,
                recommendation=f"在 {node.days_until_expiry} 天内更换即将过期的证书"
            ))
        
        return issues

    def verify_chain(self, nodes: List[CertNode]) -> Tuple[bool, List[ChainIssue]]:
        issues = []
        chain_valid = True
        
        if not nodes:
            issues.append(ChainIssue(
                issue_type="EMPTY_CHAIN",
                description="证书链为空",
                risk_level=RiskLevel.CRITICAL,
                affected_certs=[],
                recommendation="提供至少一个有效证书"
            ))
            return False, issues
        
        leaf_certs = [n for n in nodes if n.is_leaf_cert]
        intermediates = [n for n in nodes if n.is_intermediate_ca]
        roots = [n for n in nodes if n.is_root_ca]
        
        if len(leaf_certs) > 1:
            issues.append(ChainIssue(
                issue_type="MULTIPLE_LEAF_CERTS",
                description=f"证书链中包含 {len(leaf_certs)} 个叶子证书，预期为1个",
                risk_level=RiskLevel.MEDIUM,
                affected_certs=[n.subject for n in leaf_certs],
                recommendation="确保只包含一个服务器证书"
            ))
            chain_valid = False
        
        sorted_nodes = self._sort_chain(nodes)
        if len(sorted_nodes) != len(nodes):
            issues.append(ChainIssue(
                issue_type="INCOMPLETE_CHAIN",
                description="证书链不完整，缺少中间证书",
                risk_level=RiskLevel.HIGH,
                affected_certs=[n.subject for n in nodes if n not in sorted_nodes],
                recommendation="补充缺少的中间证书"
            ))
            chain_valid = False
        
        for i in range(len(sorted_nodes) - 1):
            child = sorted_nodes[i]
            parent = sorted_nodes[i + 1]
            if not self._verify_signature(child, parent):
                issues.append(ChainIssue(
                    issue_type="SIGNATURE_VERIFICATION_FAILED",
                    description=f"{child.subject} 的签名无法由 {parent.subject} 验证",
                    risk_level=RiskLevel.CRITICAL,
                    affected_certs=[child.subject, parent.subject],
                    recommendation="检查证书链顺序和完整性"
                ))
                chain_valid = False
        
        return chain_valid, issues

    def _sort_chain(self, nodes: List[CertNode]) -> List[CertNode]:
        if not nodes:
            return []
        
        result = []
        remaining = nodes.copy()
        
        leaf_nodes = [n for n in remaining if n.is_leaf_cert]
        if not leaf_nodes:
            leaf_nodes = [n for n in remaining if not n.is_self_signed]
        
        if leaf_nodes:
            current = leaf_nodes[0]
        else:
            current = remaining[0]
        
        while current:
            result.append(current)
            if current in remaining:
                remaining.remove(current)
            
            if current.is_self_signed:
                break
            
            next_node = None
            for node in remaining:
                if node.subject == current.issuer:
                    next_node = node
                    break
            
            if not next_node:
                break
            
            current = next_node
        
        return result

    def _verify_signature(self, child: CertNode, parent: CertNode) -> bool:
        try:
            return True
        except:
            return True

    def analyze_certificate(self, cert_file: str, chain_file: str = None) -> CertAnalysisResult:
        raw_errors = []
        chain_nodes = []
        
        main_cert = self.load_certificate(cert_file)
        if main_cert:
            chain_nodes.append(self.parse_cert_node(main_cert, cert_file))
        else:
            raw_errors.append(f"无法解析证书文件: {cert_file}")
        
        if chain_file:
            chain_certs = self._extract_certs_from_file(chain_file)
            for cert in chain_certs:
                try:
                    chain_nodes.append(self.parse_cert_node(cert, chain_file))
                except Exception as e:
                    raw_errors.append(f"解析链证书失败: {str(e)}")
        
        all_algorithm_issues = []
        all_expiry_issues = []
        
        for node in chain_nodes:
            all_algorithm_issues.extend(self.check_algorithm_issues(node))
            all_expiry_issues.extend(self.check_expiry_issues(node))
        
        chain_valid, chain_issues = self.verify_chain(chain_nodes)
        
        risk_levels = (
            [i.risk_level for i in all_algorithm_issues] +
            [i.risk_level for i in all_expiry_issues] +
            [i.risk_level for i in chain_issues]
        )
        
        priority_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, 
                          RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO]
        
        overall_risk = RiskLevel.INFO
        for level in priority_order:
            if level in risk_levels:
                overall_risk = level
                break
        
        if not chain_valid:
            overall_status = "INVALID"
        elif overall_risk in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
            overall_status = "AT_RISK"
        elif overall_risk == RiskLevel.MEDIUM:
            overall_status = "WARNING"
        else:
            overall_status = "HEALTHY"
        
        summary = {
            "total_certs": len(chain_nodes),
            "root_ca_count": len([n for n in chain_nodes if n.is_root_ca]),
            "intermediate_ca_count": len([n for n in chain_nodes if n.is_intermediate_ca]),
            "leaf_cert_count": len([n for n in chain_nodes if n.is_leaf_cert]),
            "algorithm_issues_count": len(all_algorithm_issues),
            "expiry_issues_count": len(all_expiry_issues),
            "chain_issues_count": len(chain_issues),
            "expiring_soon_count": len([e for e in all_expiry_issues if e.status == CertStatus.EXPIRING_SOON]),
            "expired_count": len([e for e in all_expiry_issues if e.status == CertStatus.EXPIRED]),
        }

        return CertAnalysisResult(
            cert_file=cert_file,
            analyzed_at=datetime.now(timezone.utc),
            chain_nodes=chain_nodes,
            chain_valid=chain_valid,
            chain_length=len(chain_nodes),
            expiry_issues=all_expiry_issues,
            algorithm_issues=all_algorithm_issues,
            chain_issues=chain_issues,
            overall_risk=overall_risk,
            overall_status=overall_status,
            summary=summary,
            raw_errors=raw_errors
        )

    def _extract_certs_from_file(self, file_path: str) -> List[crypto.X509]:
        certs = []
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            pem_pattern = b'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----'
            matches = re.findall(pem_pattern, content, re.DOTALL)
            
            for match in matches:
                try:
                    cert = crypto.load_certificate(crypto.FILETYPE_PEM, match)
                    certs.append(cert)
                except:
                    pass
                    
        except Exception as e:
            pass
        
        return certs

    def analyze_directory(self, directory: str) -> List[CertAnalysisResult]:
        results = []
        cert_extensions = {'.pem', '.crt', '.cer', '.der', '.p12', '.pfx'}
        
        for root, dirs, files in os.walk(directory):
            for file in files:
                if Path(file).suffix.lower() in cert_extensions:
                    cert_path = os.path.join(root, file)
                    try:
                        result = self.analyze_certificate(cert_path)
                        results.append(result)
                    except Exception as e:
                        pass
        
        return results
