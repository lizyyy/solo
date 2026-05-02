"""
测试报告导出模块
"""
import os
import sys
import tempfile
import pytest
import csv

# 添加父目录到模块搜索路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chemical_compatibility_checker.rules import (
    Normalizer,
    Severity,
    Violation
)
from chemical_compatibility_checker.placement import (
    AlternativeLocation,
    PlacementItem
)
from chemical_compatibility_checker.reports import (
    export_violations,
    export_placement_plan,
    generate_audit_report
)


class TestExportViolations:
    """测试导出违规详情"""
    
    def test_export_violations_to_csv(self):
        """测试导出违规到CSV"""
        violations = [
            Violation(
                rule_id='CAPACITY-001',
                severity=Severity.HIGH,
                message='库位容量不足',
                request_id='REQ-001',
                chemical_id='CHEM-001',
                location_id='A-01',
                details={'requested_volume': 50.0, 'remaining_capacity': 30.0}
            ),
            Violation(
                rule_id='MIXING-001',
                severity=Severity.CRITICAL,
                message='危险类别冲突',
                request_id='REQ-002',
                chemical_id='CHEM-002',
                location_id='A-01',
                details={}
            )
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            temp_path = f.name
        
        try:
            export_violations(violations, temp_path)
            
            # 读取文件验证
            with open(temp_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)
            
            # 验证表头
            assert rows[0] == [
                '违规ID', '规则编号', '严重程度', '消息',
                '申请ID', '化学品ID', '库位ID', '详细信息'
            ]
            
            # 验证数据行
            assert len(rows) == 3  # 表头 + 2条数据
            
            # 第一条违规
            assert rows[1][1] == 'CAPACITY-001'
            assert rows[1][2] == '高'  # HIGH
            assert '容量不足' in rows[1][3]
            assert rows[1][4] == 'REQ-001'
            assert rows[1][5] == 'CHEM-001'
            assert rows[1][6] == 'A-01'
            
            # 第二条违规
            assert rows[2][1] == 'MIXING-001'
            assert rows[2][2] == '严重'  # CRITICAL
            assert '危险类别冲突' in rows[2][3]
            
        finally:
            os.unlink(temp_path)
    
    def test_export_empty_violations(self):
        """测试导出空的违规列表"""
        violations = []
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            temp_path = f.name
        
        try:
            export_violations(violations, temp_path)
            
            # 读取文件验证
            with open(temp_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)
            
            # 应该只有表头
            assert len(rows) == 1
            assert rows[0][0] == '违规ID'
            
        finally:
            os.unlink(temp_path)


class TestExportPlacementPlan:
    """测试导出生成的放置计划"""
    
    def test_export_placement_plan_to_csv(self):
        """测试导出生成的放置计划到CSV"""
        placement_items = [
            PlacementItem(
                request_id='REQ-001',
                chemical_id='CHEM-001',
                chemical_name='浓硫酸',
                requested_location='A-01',
                final_location='A-01',
                volume=20.0,
                status='approved',
                violations=[],
                alternative_locations=[]
            ),
            PlacementItem(
                request_id='REQ-002',
                chemical_id='CHEM-002',
                chemical_name='氢氧化钠',
                requested_location='A-01',
                final_location=None,
                volume=15.0,
                status='rejected',
                violations=[],
                alternative_locations=[
                    AlternativeLocation(
                        location_id='A-02',
                        location_name='强碱存储区',
                        suitability_score=85.0,
                        remaining_capacity=100.0,
                        reasons=['容量充足', '类别匹配'],
                        warnings=[]
                    ),
                    AlternativeLocation(
                        location_id='MIX-01',
                        location_name='混合存储区',
                        suitability_score=50.0,
                        remaining_capacity=130.0,
                        reasons=['容量充足'],
                        warnings=['需人工确认相容性']
                    )
                ]
            )
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            temp_path = f.name
        
        try:
            export_placement_plan(placement_items, temp_path)
            
            # 读取文件验证
            with open(temp_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)
            
            # 验证表头
            assert rows[0] == [
                '申请ID', '化学品ID', '化学品名称',
                '申请库位', '最终库位', '体积(L)',
                '状态', '违规数量', '推荐替代库位'
            ]
            
            # 验证数据行
            assert len(rows) == 3  # 表头 + 2条数据
            
            # 第一条（通过）
            assert rows[1][0] == 'REQ-001'
            assert rows[1][1] == 'CHEM-001'
            assert rows[1][2] == '浓硫酸'
            assert rows[1][3] == 'A-01'
            assert rows[1][4] == 'A-01'
            assert rows[1][5] == '20.0'
            assert rows[1][6] == '通过'
            assert rows[1][7] == '0'
            assert rows[1][8] == '无'
            
            # 第二条（拒绝，有替代库位）
            assert rows[2][0] == 'REQ-002'
            assert rows[2][1] == 'CHEM-002'
            assert rows[2][2] == '氢氧化钠'
            assert rows[2][3] == 'A-01'
            assert rows[2][4] == '无'  # final_location是None
            assert rows[2][5] == '15.0'
            assert rows[2][6] == '拒绝'
            assert 'A-02' in rows[2][8]  # 应该包含推荐的替代库位
            assert '85分' in rows[2][8]
            
        finally:
            os.unlink(temp_path)


class TestGenerateAuditReport:
    """测试生成审计报告"""
    
    def test_generate_audit_report_basic(self):
        """测试生成基本的审计报告"""
        violations = [
            Violation(
                rule_id='CAPACITY-001',
                severity=Severity.HIGH,
                message='库位A-01容量不足',
                request_id='REQ-001',
                chemical_id='CHEM-001',
                location_id='A-01',
                details={'requested_volume': 50.0, 'remaining_capacity': 30.0}
            ),
            Violation(
                rule_id='MIXING-001',
                severity=Severity.CRITICAL,
                message='强酸与强碱不能混放',
                request_id='REQ-002',
                chemical_id='CHEM-002',
                location_id='A-01',
                details={}
            )
        ]
        
        placement_items = [
            PlacementItem(
                request_id='REQ-001',
                chemical_id='CHEM-001',
                chemical_name='浓硫酸',
                requested_location='A-01',
                final_location='A-02',
                volume=20.0,
                status='needs_review',
                violations=[violations[0]],
                alternative_locations=[
                    AlternativeLocation(
                        location_id='A-02',
                        location_name='强酸存储区',
                        suitability_score=90.0,
                        remaining_capacity=90.0,
                        reasons=['容量充足', '类别匹配'],
                        warnings=[]
                    )
                ]
            ),
            PlacementItem(
                request_id='REQ-002',
                chemical_id='CHEM-002',
                chemical_name='氢氧化钠',
                requested_location='A-01',
                final_location=None,
                volume=15.0,
                status='rejected',
                violations=[violations[1]],
                alternative_locations=[]
            )
        ]
        
        storage_before = {
            'A-01': {
                'name': '混合存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 10.0,
                'current_chemicals': [],
                'remaining_capacity': 90.0
            },
            'A-02': {
                'name': '强酸存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': ['强酸'],
                'forbidden_categories': [],
                'current_usage': 0.0,
                'current_chemicals': [],
                'remaining_capacity': 100.0
            }
        }
        
        storage_after = {
            'A-01': {
                'name': '混合存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 10.0,
                'current_chemicals': [],
                'remaining_capacity': 90.0
            },
            'A-02': {
                'name': '强酸存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': ['强酸'],
                'forbidden_categories': [],
                'current_usage': 20.0,  # 增加了20L
                'current_chemicals': [],
                'remaining_capacity': 80.0
            }
        }
        
        warnings = [
            '库位A-01中存储了不存在的化学品: UNKNOWN-001'
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            temp_path = f.name
        
        try:
            generate_audit_report(
                violations, placement_items,
                storage_before, storage_after,
                warnings, temp_path
            )
            
            # 读取文件验证
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 验证报告包含关键内容
            assert '# 危化品库位相容性预检报告' in content
            assert '## 一、执行摘要' in content
            assert '总申请数' in content
            assert '严重违规' in content
            assert '高优先级违规' in content
            assert '## 二、数据完整性警告' in content
            assert 'UNKNOWN-001' in content  # 警告内容
            assert '## 三、违规详情' in content
            assert 'CAPACITY-001' in content
            assert 'MIXING-001' in content
            assert '## 四、放置计划详情' in content
            assert 'REQ-001' in content
            assert 'REQ-002' in content
            assert '## 五、库位详情' in content
            assert 'A-01' in content
            assert 'A-02' in content
            assert '## 六、建议与注意事项' in content
            
        finally:
            os.unlink(temp_path)
    
    def test_generate_audit_report_empty(self):
        """测试生成空的审计报告（无违规）"""
        violations = []
        placement_items = []
        storage_before = {}
        storage_after = {}
        warnings = []
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            temp_path = f.name
        
        try:
            generate_audit_report(
                violations, placement_items,
                storage_before, storage_after,
                warnings, temp_path
            )
            
            # 读取文件验证
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 验证报告包含基本结构
            assert '# 危化品库位相容性预检报告' in content
            assert '总申请数' in content
            assert '0 项' in content
            assert '未发现任何违规' in content
            
        finally:
            os.unlink(temp_path)
