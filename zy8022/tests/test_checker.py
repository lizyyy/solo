import pytest
import os
import tempfile
from email_dns_checker.parser import DomainCSVParser, DNSRecordsParser, ProviderPolicyParser
from email_dns_checker.rule_engine import RuleEngine, SPFChecker, RiskLevel, Issue
from email_dns_checker.parser import DomainCheck, ProviderPolicy


class TestDomainCSVParser:
    def test_parse_csv(self):
        csv_content = """domain,selectors
example.com,selector1,selector2
test.com,default
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_name = f.name
        
        try:
            domains = DomainCSVParser.parse(temp_name)
            assert len(domains) == 2
            assert domains[0].domain == 'example.com'
            assert domains[0].selectors == ['selector1', 'selector2']
            assert domains[1].domain == 'test.com'
            assert domains[1].selectors == ['default']
        finally:
            os.unlink(temp_name)


class TestDNSRecordsParser:
    def test_parse_json(self):
        json_content = """{
            "example.com": {
                "TXT": ["v=spf1 include:_spf.google.com -all"]
            }
        }"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write(json_content)
            temp_name = f.name
        
        try:
            records = DNSRecordsParser.parse(temp_name)
            assert 'example.com' in records
            assert 'TXT' in records['example.com']
            assert len(records['example.com']['TXT']) == 1
        finally:
            os.unlink(temp_name)


class TestProviderPolicyParser:
    def test_parse_yaml(self):
        yaml_content = """providers:
  - name: google
    spf_includes:
      - _spf.google.com
    dkim_selectors:
      - google
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write(yaml_content)
            temp_name = f.name
        
        try:
            policies = ProviderPolicyParser.parse(temp_name)
            assert len(policies) == 1
            assert policies[0].name == 'google'
            assert policies[0].spf_includes == ['_spf.google.com']
            assert policies[0].dkim_selectors == ['google']
        finally:
            os.unlink(temp_name)


class TestSPFChecker:
    def test_spf_multiple_records(self):
        dns_records = {
            'example.com': {
                'TXT': [
                    'v=spf1 include:a.com -all',
                    'v=spf1 include:b.com -all'
                ]
            }
        }
        issues = SPFChecker.check('example.com', dns_records, [])
        assert any(i.rule == 'SPF_MULTIPLE' for i in issues)
        assert any(i.risk_level == RiskLevel.CRITICAL for i in issues)
    
    def test_spf_include_loop(self):
        dns_records = {
            'example.com': {
                'TXT': ['v=spf1 include:loop-a.com -all']
            },
            'loop-a.com': {
                'TXT': ['v=spf1 include:loop-b.com ~all']
            },
            'loop-b.com': {
                'TXT': ['v=spf1 include:loop-a.com ~all']
            }
        }
        issues = SPFChecker.check('example.com', dns_records, [])
        assert any(i.rule == 'SPF_INCLUDE_LOOP' for i in issues)
    
    def test_spf_no_records(self):
        dns_records = {}
        issues = SPFChecker.check('example.com', dns_records, [])
        assert any(i.rule == 'SPF_MISSING' for i in issues)


class TestRuleEngine:
    def test_check_all(self):
        domain_check = DomainCheck(domain='example.com', selectors=['sel1'])
        dns_records = {
            'example.com': {
                'TXT': ['v=spf1 -all']
            },
            'sel1._domainkey.example.com': {
                'TXT': ['v=DKIM1; k=rsa; p=test']
            },
            '_dmarc.example.com': {
                'TXT': ['v=DMARC1; p=reject']
            }
        }
        policies = [
            ProviderPolicy(name='test', spf_includes=[], dkim_selectors=[])
        ]
        
        results = RuleEngine.check_all([domain_check], dns_records, policies)
        assert 'example.com' in results


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
