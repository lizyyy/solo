import re
from typing import Dict, List, Set, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
from .parser import DomainCheck, ProviderPolicy


class RiskLevel(Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


@dataclass
class Issue:
    domain: str
    rule: str
    description: str
    risk_level: RiskLevel
    selector: Optional[str] = None


class SPFChecker:
    SPF_PREFIX = "v=spf1"
    MAX_LOOKUPS = 10

    @staticmethod
    def extract_spf_mechanisms(spf_record: str) -> List[str]:
        if not spf_record.startswith(SPFChecker.SPF_PREFIX):
            return []
        parts = spf_record[len(SPFChecker.SPF_PREFIX):].strip().split()
        return parts

    @staticmethod
    def count_lookups(spf_record: str, dns_records: Dict[str, Dict[str, List[str]]], visited: Optional[Set[str]] = None, depth: int = 0) -> Tuple[int, List[str], Set[str]]:
        if visited is None:
            visited = set()
        
        mechanisms = SPFChecker.extract_spf_mechanisms(spf_record)
        lookup_count = 0
        includes = []
        loops = set()
        
        for mech in mechanisms:
            if mech.startswith('include:'):
                include_domain = mech[len('include:'):]
                if include_domain in visited:
                    loops.add(include_domain)
                    continue
                visited.add(include_domain)
                includes.append(include_domain)
                lookup_count += 1
                
                if include_domain in dns_records and 'TXT' in dns_records[include_domain]:
                    for txt in dns_records[include_domain]['TXT']:
                        if txt.startswith(SPFChecker.SPF_PREFIX):
                            sub_count, sub_includes, sub_loops = SPFChecker.count_lookups(
                                txt, dns_records, visited.copy(), depth + 1
                            )
                            lookup_count += sub_count
                            includes.extend(sub_includes)
                            loops.update(sub_loops)
                            break
            elif mech.startswith(('a:', 'a/', 'mx:', 'mx/', 'ptr:', 'ptr/', 'exists:', 'exists/')):
                lookup_count += 1
            elif mech in ('a', 'mx', 'ptr'):
                lookup_count += 1
        
        return lookup_count, includes, loops

    @staticmethod
    def check(domain: str, dns_records: Dict[str, Dict[str, List[str]]], policies: List[ProviderPolicy]) -> List[Issue]:
        issues = []
        
        if domain not in dns_records or 'TXT' not in dns_records[domain]:
            issues.append(Issue(
                domain=domain,
                rule="SPF_MISSING",
                description="No SPF TXT record found",
                risk_level=RiskLevel.CRITICAL
            ))
            return issues
        
        spf_records = [r for r in dns_records[domain]['TXT'] if r.startswith(SPFChecker.SPF_PREFIX)]
        
        if len(spf_records) > 1:
            issues.append(Issue(
                domain=domain,
                rule="SPF_MULTIPLE",
                description=f"Multiple SPF records found: {len(spf_records)}",
                risk_level=RiskLevel.CRITICAL
            ))
        
        if len(spf_records) == 0:
            issues.append(Issue(
                domain=domain,
                rule="SPF_MISSING",
                description="No valid SPF TXT record found",
                risk_level=RiskLevel.CRITICAL
            ))
            return issues
        
        spf_record = spf_records[0]
        
        lookup_count, includes, loops = SPFChecker.count_lookups(spf_record, dns_records)
        
        if lookup_count > SPFChecker.MAX_LOOKUPS:
            issues.append(Issue(
                domain=domain,
                rule="SPF_TOO_MANY_LOOKUPS",
                description=f"SPF exceeds {SPFChecker.MAX_LOOKUPS} DNS lookups: {lookup_count}",
                risk_level=RiskLevel.CRITICAL
            ))
        
        if loops:
            issues.append(Issue(
                domain=domain,
                rule="SPF_INCLUDE_LOOP",
                description=f"SPF include loop detected: {', '.join(loops)}",
                risk_level=RiskLevel.CRITICAL
            ))
        
        all_includes = set()
        for policy in policies:
            all_includes.update(policy.spf_includes)
        
        for policy_include in all_includes:
            if policy_include not in includes and f'include:{policy_include}' not in spf_record:
                issues.append(Issue(
                    domain=domain,
                    rule="SPF_MISSING_INCLUDE",
                    description=f"Missing recommended SPF include: {policy_include}",
                    risk_level=RiskLevel.WARNING
                ))
        
        return issues


class DKIMChecker:
    @staticmethod
    def check(domain: str, selectors: List[str], dns_records: Dict[str, Dict[str, List[str]]], policies: List[ProviderPolicy]) -> List[Issue]:
        issues = []
        
        all_selectors = set(selectors)
        for policy in policies:
            all_selectors.update(policy.dkim_selectors)
        
        for selector in all_selectors:
            dkim_domain = f"{selector}._domainkey.{domain}"
            if dkim_domain not in dns_records or 'TXT' not in dns_records[dkim_domain]:
                issues.append(Issue(
                    domain=domain,
                    rule="DKIM_MISSING",
                    description=f"DKIM record missing for selector: {selector}",
                    risk_level=RiskLevel.CRITICAL,
                    selector=selector
                ))
            else:
                dkim_records = dns_records[dkim_domain]['TXT']
                valid_dkim = False
                for record in dkim_records:
                    if 'v=DKIM1' in record or 'k=rsa' in record or 'p=' in record:
                        valid_dkim = True
                        break
                if not valid_dkim:
                    issues.append(Issue(
                        domain=domain,
                        rule="DKIM_INVALID",
                        description=f"Invalid DKIM record for selector: {selector}",
                        risk_level=RiskLevel.CRITICAL,
                        selector=selector
                    ))
        
        return issues


class DMARCChecker:
    @staticmethod
    def extract_org_domain(domain: str) -> str:
        parts = domain.split('.')
        if len(parts) >= 2:
            return '.'.join(parts[-2:])
        return domain

    @staticmethod
    def check(domain: str, dns_records: Dict[str, Dict[str, List[str]]], policies: List[ProviderPolicy]) -> List[Issue]:
        issues = []
        
        dmarc_domain = f"_dmarc.{domain}"
        
        if dmarc_domain not in dns_records or 'TXT' not in dns_records[dmarc_domain]:
            issues.append(Issue(
                domain=domain,
                rule="DMARC_MISSING",
                description="No DMARC TXT record found",
                risk_level=RiskLevel.CRITICAL
            ))
            return issues
        
        dmarc_records = [r for r in dns_records[dmarc_domain]['TXT'] if 'v=DMARC1' in r]
        
        if len(dmarc_records) > 1:
            issues.append(Issue(
                domain=domain,
                rule="DMARC_MULTIPLE",
                description=f"Multiple DMARC records found: {len(dmarc_records)}",
                risk_level=RiskLevel.CRITICAL
            ))
        
        if len(dmarc_records) == 0:
            issues.append(Issue(
                domain=domain,
                rule="DMARC_MISSING",
                description="No valid DMARC TXT record found",
                risk_level=RiskLevel.CRITICAL
            ))
            return issues
        
        dmarc_record = dmarc_records[0]
        
        if 'p=' not in dmarc_record:
            issues.append(Issue(
                domain=domain,
                rule="DMARC_NO_POLICY",
                description="DMARC record missing policy (p=)",
                risk_level=RiskLevel.WARNING
            ))
        else:
            policy_match = re.search(r'p=([^;]+)', dmarc_record)
            if policy_match:
                policy = policy_match.group(1).lower()
                if policy == 'none':
                    issues.append(Issue(
                        domain=domain,
                        rule="DMARC_POLICY_NONE",
                        description="DMARC policy is set to 'none', no enforcement",
                        risk_level=RiskLevel.INFO
                    ))
        
        for policy in policies:
            if policy.dmarc_org_domain:
                org_domain = DMARCChecker.extract_org_domain(domain)
                if org_domain != policy.dmarc_org_domain:
                    issues.append(Issue(
                        domain=domain,
                        rule="DMARC_ALIGNMENT_MISMATCH",
                        description=f"DMARC org domain mismatch: expected {policy.dmarc_org_domain}, got {org_domain}",
                        risk_level=RiskLevel.WARNING
                    ))
        
        return issues


class TXTDuplicateChecker:
    @staticmethod
    def check(domain: str, dns_records: Dict[str, Dict[str, List[str]]]) -> List[Issue]:
        issues = []
        
        if domain in dns_records and 'TXT' in dns_records[domain]:
            txt_records = dns_records[domain]['TXT']
            seen = set()
            duplicates = []
            for record in txt_records:
                if record in seen:
                    duplicates.append(record)
                seen.add(record)
            
            if duplicates:
                issues.append(Issue(
                    domain=domain,
                    rule="TXT_DUPLICATE",
                    description=f"Duplicate TXT records found: {len(duplicates)} duplicates",
                    risk_level=RiskLevel.WARNING
                ))
        
        return issues


class RuleEngine:
    @staticmethod
    def check_domain(domain_check: DomainCheck, dns_records: Dict[str, Dict[str, List[str]]], policies: List[ProviderPolicy]) -> List[Issue]:
        issues = []
        domain = domain_check.domain
        
        issues.extend(SPFChecker.check(domain, dns_records, policies))
        issues.extend(DKIMChecker.check(domain, domain_check.selectors, dns_records, policies))
        issues.extend(DMARCChecker.check(domain, dns_records, policies))
        issues.extend(TXTDuplicateChecker.check(domain, dns_records))
        
        return issues

    @staticmethod
    def check_all(domains: List[DomainCheck], dns_records: Dict[str, Dict[str, List[str]]], policies: List[ProviderPolicy]) -> Dict[str, List[Issue]]:
        results = {}
        for domain_check in domains:
            results[domain_check.domain] = RuleEngine.check_domain(domain_check, dns_records, policies)
        return results
