import os
import tempfile
import pytest
from pathlib import Path

from jumpguard.parsers.account import AccountParser, AccountRecord
from jumpguard.parsers.ldap import LDAPParser, LDAPGroup
from jumpguard.parsers.asset import AssetParser, AssetRecord
from jumpguard.parsers.sudoers import SudoersParser, SudoersRule


class TestAccountParser:
    def setup_method(self):
        self.parser = AccountParser()
        
    def test_parse_valid_csv(self):
        csv_content = """username,department,status,last_login,email
zhangsan,运维部,active,2026-04-28,zhangsan@test.com
lisi,测试部,inactive,2026-04-20,lisi@test.com
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
            
        try:
            records = self.parser.parse_file(temp_path)
            
            assert len(records) == 2
            assert records[0].username == 'zhangsan'
            assert records[0].department == '运维部'
            assert records[0].status == 'active'
            assert records[1].status == 'inactive'
        finally:
            os.unlink(temp_path)
            
    def test_status_normalization(self):
        assert self.parser.is_active_status('active') == True
        assert self.parser.is_active_status('enabled') == True
        assert self.parser.is_inactive_status('inactive') == True
        assert self.parser.is_inactive_status('terminated') == True


class TestLDAPParser:
    def setup_method(self):
        self.parser = LDAPParser()
        
    def test_parse_text_list(self):
        txt_content = """# Test LDAP groups
production_admin: 生产管理员组
  zhangsan
  lisi

test_admin: 测试管理员组
  wangwu
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(txt_content)
            temp_path = f.name
            
        try:
            groups = self.parser.parse_file(temp_path, format_type='text_list')
            
            assert len(groups) == 2
            prod_group = [g for g in groups if g.group_name == 'production_admin'][0]
            assert len(prod_group.members) == 2
            assert 'zhangsan' in prod_group.members
            assert 'lisi' in prod_group.members
        finally:
            os.unlink(temp_path)
            
    def test_parse_csv_group_member(self):
        csv_content = """group,member
production_admin,zhangsan
production_admin,lisi
test_admin,wangwu
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
            
        try:
            groups = self.parser.parse_file(temp_path, format_type='csv_group_member')
            
            assert len(groups) == 2
            prod_group = [g for g in groups if g.group_name == 'production_admin'][0]
            assert len(prod_group.members) == 2
        finally:
            os.unlink(temp_path)


class TestAssetParser:
    def setup_method(self):
        self.parser = AssetParser()
        
    def test_parse_assets(self):
        csv_content = """hostname,ip_address,environment,department,owner,status
prod-web-01,192.168.1.10,production,运维部,zhangsan,active
test-web-01,192.168.2.10,test,测试部,lisi,active
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name
            
        try:
            records = self.parser.parse_file(temp_path)
            
            assert len(records) == 2
            assert records[0].hostname == 'prod-web-01'
            assert records[0].environment == 'production'
            assert records[1].environment == 'test'
        finally:
            os.unlink(temp_path)
            
    def test_env_normalization(self):
        assert self.parser.is_production_env('production') == True
        assert self.parser.is_production_env('prod') == True
        assert self.parser.is_production_env('线上') == True
        assert self.parser.is_test_env('test') == True
        assert self.parser.is_test_env('测试') == True


class TestSudoersParser:
    def setup_method(self):
        self.parser = SudoersParser()
        
    def test_parse_sudoers(self):
        sudoers_content = """# Test sudoers
zhangsan ALL=(root) /usr/bin/systemctl
lisi prod-web-01=(root) NOPASSWD: ALL
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='', delete=False) as f:
            f.write(sudoers_content)
            temp_path = f.name
            
        try:
            rules = self.parser.parse_file(temp_path)
            
            assert len(rules) == 2
            assert rules[0].user == 'zhangsan'
            assert rules[0].host == 'ALL'
            assert rules[0].run_as == 'root'
            assert rules[1].nopasswd == True
            assert 'ALL' in rules[1].commands
        finally:
            os.unlink(temp_path)
            
    def test_dangerous_commands(self):
        assert self.parser.is_forbidden_command('/bin/rm -rf /') == True
        assert self.parser.is_forbidden_command('/bin/su') == True
        assert self.parser.has_all_command(['ALL']) == True
        assert self.parser.has_all_command(['/usr/bin/ls']) == False
