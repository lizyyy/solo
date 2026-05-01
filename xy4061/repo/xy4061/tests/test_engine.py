import os
import tempfile
import pytest
from pathlib import Path

from jumpguard.parsers.account import AccountRecord, AccountParser
from jumpguard.parsers.ldap import LDAPGroup, LDAPParser
from jumpguard.parsers.asset import AssetRecord, AssetParser
from jumpguard.parsers.sudoers import SudoersRule, SudoersParser
from jumpguard.engine import RuleEngine, RuleResult


class TestRuleEngine:
    def setup_method(self):
        self.account_parser = AccountParser()
        self.asset_parser = AssetParser()
        self.sudoers_parser = SudoersParser()
        
    def create_test_data(self):
        accounts = [
            AccountRecord(
                username='zhangsan',
                department='运维部',
                status='active',
                last_login='2026-04-28',
            ),
            AccountRecord(
                username='lisi',
                department='测试部',
                status='active',
                last_login='2026-04-25',
            ),
            AccountRecord(
                username='zhaoliu',
                department='运维部',
                status='terminated',
                last_login='2026-03-15',
            ),
        ]
        
        ldap_groups = [
            LDAPGroup(
                group_name='production_admin',
                members=['zhangsan', 'zhaoliu'],
            ),
            LDAPGroup(
                group_name='test_admin',
                members=['lisi'],
            ),
        ]
        
        assets = [
            AssetRecord(
                hostname='prod-web-01',
                ip_address='192.168.1.10',
                environment='production',
            ),
            AssetRecord(
                hostname='test-web-01',
                ip_address='192.168.2.10',
                environment='test',
            ),
        ]
        
        sudoers_rules = [
            SudoersRule(
                user='lisi',
                host='ALL',
                run_as='root',
                commands=['ALL'],
                nopasswd=True,
            ),
            SudoersRule(
                user='zhaoliu',
                host='prod-web-01',
                run_as='root',
                commands=['/bin/su', '/usr/bin/passwd'],
            ),
            SudoersRule(
                user='zhangsan',
                host='prod-web-01',
                run_as='root',
                commands=['/usr/bin/systemctl'],
            ),
        ]
        
        return accounts, ldap_groups, assets, sudoers_rules
        
    def test_orphan_account_detection(self):
        accounts, ldap_groups, assets, sudoers_rules = self.create_test_data()
        
        engine = RuleEngine(
            accounts=accounts,
            ldap_groups=ldap_groups,
            assets=assets,
            sudoers_rules=sudoers_rules,
            account_parser=self.account_parser,
            asset_parser=self.asset_parser,
            sudoers_parser=self.sudoers_parser,
        )
        
        results = engine.check_orphan_accounts()
        
        assert len(results) == 1
        assert results[0].rule_id == 'orphan_account'
        assert results[0].affected_entity == 'zhaoliu'
        assert results[0].severity == 'critical'
        
    def test_sudo_overreach_detection(self):
        accounts, ldap_groups, assets, sudoers_rules = self.create_test_data()
        
        engine = RuleEngine(
            accounts=accounts,
            ldap_groups=ldap_groups,
            assets=assets,
            sudoers_rules=sudoers_rules,
            account_parser=self.account_parser,
            asset_parser=self.asset_parser,
            sudoers_parser=self.sudoers_parser,
        )
        
        results = engine.check_sudo_overreach()
        
        assert len(results) >= 1
        lisi_rules = [r for r in results if r.affected_entity == 'lisi']
        assert len(lisi_rules) > 0
        
        zhaoliu_rules = [r for r in results if r.affected_entity == 'zhaoliu']
        assert len(zhaoliu_rules) > 0
        
    def test_check_all_rules(self):
        accounts, ldap_groups, assets, sudoers_rules = self.create_test_data()
        
        engine = RuleEngine(
            accounts=accounts,
            ldap_groups=ldap_groups,
            assets=assets,
            sudoers_rules=sudoers_rules,
            account_parser=self.account_parser,
            asset_parser=self.asset_parser,
            sudoers_parser=self.sudoers_parser,
        )
        
        results = engine.check_all()
        
        assert len(results) > 0
        
        rule_types = set(r.rule_id for r in results)
        assert 'orphan_account' in rule_types
        assert 'sudo_overreach' in rule_types
        
    def test_duplicate_account_detection(self):
        accounts = [
            AccountRecord(username='zhangsan', department='运维部', status='active', last_login='2026-04-28'),
            AccountRecord(username='lisi', department='测试部', status='active', last_login='2026-04-25'),
            AccountRecord(username='zhangsan', department='开发部', status='active', last_login='2026-04-20'),
        ]
        
        ldap_groups = [
            LDAPGroup(group_name='production_admin', members=['zhangsan']),
        ]
        
        assets = [
            AssetRecord(hostname='prod-web-01', environment='production'),
        ]
        
        sudoers_rules = [
            SudoersRule(user='zhangsan', host='prod-web-01', run_as='root', commands=['/usr/bin/ls']),
        ]
        
        engine = RuleEngine(
            accounts=accounts,
            ldap_groups=ldap_groups,
            assets=assets,
            sudoers_rules=sudoers_rules,
            account_parser=self.account_parser,
            asset_parser=self.asset_parser,
            sudoers_parser=self.sudoers_parser,
        )
        
        results = engine.check_duplicate_accounts()
        
        assert len(results) == 1
        assert results[0].rule_id == 'duplicate_account'
        assert results[0].affected_entity == 'zhangsan'
        assert results[0].severity == 'medium'
        
    def test_bad_row_detection(self):
        accounts = [
            AccountRecord(username='zhangsan', department='运维部', status='active', last_login='2026-04-28'),
            AccountRecord(username='', department='运维部', status='active', last_login='2026-04-28', is_valid=False, validation_errors=['Username is empty']),
        ]
        
        ldap_groups = [
            LDAPGroup(group_name='production_admin', members=['zhangsan']),
        ]
        
        assets = [
            AssetRecord(hostname='prod-web-01', environment='production'),
        ]
        
        sudoers_rules = [
            SudoersRule(user='zhangsan', host='prod-web-01', run_as='root', commands=['/usr/bin/ls']),
        ]
        
        engine = RuleEngine(
            accounts=accounts,
            ldap_groups=ldap_groups,
            assets=assets,
            sudoers_rules=sudoers_rules,
            account_parser=self.account_parser,
            asset_parser=self.asset_parser,
            sudoers_parser=self.sudoers_parser,
        )
        
        results = engine.check_bad_rows()
        
        assert len(results) == 1
        assert results[0].rule_id == 'bad_row'
        assert results[0].severity == 'low'
