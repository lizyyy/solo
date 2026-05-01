import csv
import json
import yaml
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class DomainCheck:
    domain: str
    selectors: List[str]


@dataclass
class ProviderPolicy:
    name: str
    spf_includes: List[str]
    dkim_selectors: List[str]
    dmarc_org_domain: Optional[str] = None


@dataclass
class DNSRecord:
    domain: str
    record_type: str
    value: str
    ttl: int = 300


class DomainCSVParser:
    @staticmethod
    def parse(file_path: str) -> List[DomainCheck]:
        domains = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                domain = row.get('domain', '').strip()
                selectors_str = row.get('selectors', '').strip()
                selectors = [s.strip() for s in selectors_str.split(',') if s.strip()] if selectors_str else []
                if domain:
                    domains.append(DomainCheck(domain=domain, selectors=selectors))
        return domains


class DNSRecordsParser:
    @staticmethod
    def parse(file_path: str) -> Dict[str, Dict[str, List[str]]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        result = {}
        for domain, records in data.items():
            result[domain] = {}
            for record_type, values in records.items():
                result[domain][record_type.upper()] = values if isinstance(values, list) else [values]
        return result


class ProviderPolicyParser:
    @staticmethod
    def parse(file_path: str) -> List[ProviderPolicy]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        policies = []
        for provider in data.get('providers', []):
            policies.append(ProviderPolicy(
                name=provider.get('name', ''),
                spf_includes=provider.get('spf_includes', []),
                dkim_selectors=provider.get('dkim_selectors', []),
                dmarc_org_domain=provider.get('dmarc_org_domain')
            ))
        return policies


class Parsers:
    @staticmethod
    def parse_all(domains_csv: str, dns_json: str, policy_yaml: str) -> tuple[List[DomainCheck], Dict[str, Dict[str, List[str]]], List[ProviderPolicy]]:
        domains = DomainCSVParser.parse(domains_csv)
        dns_records = DNSRecordsParser.parse(dns_json)
        policies = ProviderPolicyParser.parse(policy_yaml)
        return domains, dns_records, policies
