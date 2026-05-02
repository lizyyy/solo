"""
测试规则引擎模块
"""
import os
import sys
import pytest

# 添加父目录到模块搜索路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chemical_compatibility_checker.rules import (
    Normalizer,
    Severity,
    Violation,
    check_storage_capacity,
    check_dangerous_category_mixing,
    check_missing_labels,
    check_inbound_conflicts,
    run_all_checks
)


class TestNormalizer:
    """测试危险类别归一化器"""
    
    def test_normalize_basic(self):
        """测试基本的归一化功能"""
        normalization_rules = {
            '强酸': ['酸类', '强酸性物质', '腐蚀性酸'],
            '强碱': ['碱类', '强碱性物质', '腐蚀性碱']
        }
        
        normalizer = Normalizer(normalization_rules)
        
        # 测试标准名称
        assert normalizer.normalize('强酸') == '强酸'
        assert normalizer.normalize('强碱') == '强碱'
        
        # 测试别名
        assert normalizer.normalize('酸类') == '强酸'
        assert normalizer.normalize('强酸性物质') == '强酸'
        assert normalizer.normalize('腐蚀性酸') == '强酸'
        assert normalizer.normalize('碱类') == '强碱'
        assert normalizer.normalize('强碱性物质') == '强碱'
        
        # 测试大小写不敏感
        assert normalizer.normalize('强酸') == '强酸'
        assert normalizer.normalize('酸类') == '强酸'
        
        # 测试未知类别（应返回原名称）
        assert normalizer.normalize('未知类别') == '未知类别'
    
    def test_normalize_list(self):
        """测试归一化列表"""
        normalization_rules = {
            '强酸': ['酸类', '强酸性物质'],
            '强碱': ['碱类', '强碱性物质']
        }
        
        normalizer = Normalizer(normalization_rules)
        
        # 测试包含别名的列表
        categories = ['酸类', '强碱性物质', '强酸', '未知类别']
        normalized = normalizer.normalize_list(categories)
        
        # 应该去重
        assert '强酸' in normalized
        assert '强碱' in normalized
        assert '未知类别' in normalized
        assert len(normalized) == 3  # 酸类和强酸都归一化为强酸，所以去重后是3个
    
    def test_are_equivalent(self):
        """测试类别等价性检查"""
        normalization_rules = {
            '强酸': ['酸类', '强酸性物质'],
            '强碱': ['碱类', '强碱性物质']
        }
        
        normalizer = Normalizer(normalization_rules)
        
        # 等价的类别
        assert normalizer.are_equivalent('强酸', '酸类') == True
        assert normalizer.are_equivalent('酸类', '强酸性物质') == True
        assert normalizer.are_equivalent('强碱', '碱类') == True
        
        # 不等价的类别
        assert normalizer.are_equivalent('强酸', '强碱') == False
        assert normalizer.are_equivalent('酸类', '碱类') == False
        assert normalizer.are_equivalent('强酸', '未知类别') == False
    
    def test_has_overlap(self):
        """测试类别列表重叠检查"""
        normalization_rules = {
            '强酸': ['酸类', '强酸性物质'],
            '强碱': ['碱类', '强碱性物质'],
            '氧化剂': ['氧化性物质']
        }
        
        normalizer = Normalizer(normalization_rules)
        
        # 有重叠的情况
        list1 = ['酸类', '腐蚀性物质']
        list2 = ['强酸', '液体']
        assert normalizer.has_overlap(list1, list2) == True
        
        list3 = ['碱类']
        list4 = ['强碱性物质', '氧化剂']
        assert normalizer.has_overlap(list3, list4) == True
        
        # 无重叠的情况
        list5 = ['强酸', '酸类']
        list6 = ['强碱', '碱类']
        assert normalizer.has_overlap(list5, list6) == False
        
        # 空列表
        assert normalizer.has_overlap([], ['强酸']) == False
        assert normalizer.has_overlap(['强酸'], []) == False


class TestCheckStorageCapacity:
    """测试库位容量检查"""
    
    def test_capacity_sufficient(self):
        """测试容量足够的情况"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': 'A-01',
            'volume': 20.0
        }
        
        storage = {
            'A-01': {
                'name': '强酸存储区',
                'capacity': 100.0,
                'remaining_capacity': 90.0,  # 剩余90L
                'current_usage': 10.0
            }
        }
        
        chemicals = {}
        normalizer = Normalizer({})
        
        violation = check_storage_capacity(request, storage, chemicals, normalizer)
        
        # 容量足够，不应有违规
        assert violation is None
    
    def test_capacity_insufficient(self):
        """测试容量不足的情况"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': 'A-01',
            'volume': 50.0  # 申请50L
        }
        
        storage = {
            'A-01': {
                'name': '强酸存储区',
                'capacity': 100.0,
                'remaining_capacity': 30.0,  # 只剩30L
                'current_usage': 70.0
            }
        }
        
        chemicals = {}
        normalizer = Normalizer({})
        
        violation = check_storage_capacity(request, storage, chemicals, normalizer)
        
        # 容量不足，应该有违规
        assert violation is not None
        assert violation.rule_id == 'CAPACITY-001'
        assert violation.severity == Severity.HIGH
        assert '容量不足' in violation.message
        assert violation.details['requested_volume'] == 50.0
        assert violation.details['remaining_capacity'] == 30.0
        assert violation.details['deficit'] == 20.0  # 50-30=20
    
    def test_no_location_specified(self):
        """测试没有指定库位的情况"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': '',  # 空库位
            'volume': 20.0
        }
        
        storage = {'A-01': {'remaining_capacity': 100.0}}
        chemicals = {}
        normalizer = Normalizer({})
        
        violation = check_storage_capacity(request, storage, chemicals, normalizer)
        
        # 没有指定库位，不应有违规
        assert violation is None
    
    def test_nonexistent_location(self):
        """测试申请不存在的库位"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': 'NONEXISTENT',  # 不存在的库位
            'volume': 20.0
        }
        
        storage = {'A-01': {'remaining_capacity': 100.0}}  # 只有A-01
        chemicals = {}
        normalizer = Normalizer({})
        
        violation = check_storage_capacity(request, storage, chemicals, normalizer)
        
        # 库位不存在，不应有容量违规（会在其他地方检查）
        assert violation is None


class TestCheckMissingLabels:
    """测试标签缺失检查"""
    
    def test_chemical_with_labels(self):
        """测试有完整标签的化学品"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001'
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '浓硫酸',
                'dangerous_categories': ['强酸', '腐蚀性物质']
            }
        }
        
        normalizer = Normalizer({})
        
        violation = check_missing_labels(request, chemicals, normalizer)
        
        # 有完整标签，不应有违规
        assert violation is None
    
    def test_chemical_not_exist(self):
        """测试化学品不存在的情况"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'NONEXISTENT'
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '浓硫酸',
                'dangerous_categories': ['强酸']
            }
        }
        
        normalizer = Normalizer({})
        
        violation = check_missing_labels(request, chemicals, normalizer)
        
        # 化学品不存在，应该有违规
        assert violation is not None
        assert violation.rule_id == 'LABEL-001'
        assert violation.severity == Severity.HIGH
        assert '不存在于化学品目录中' in violation.message
    
    def test_chemical_missing_categories(self):
        """测试化学品缺少危险类别标签"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001'
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '未知化学品',
                'dangerous_categories': []  # 空列表
            }
        }
        
        normalizer = Normalizer({})
        
        violation = check_missing_labels(request, chemicals, normalizer)
        
        # 缺少危险类别标签，应该有违规
        assert violation is not None
        assert violation.rule_id == 'LABEL-002'
        assert violation.severity == Severity.CRITICAL
        assert '缺少危险类别标签' in violation.message
    
    def test_chemical_empty_categories(self):
        """测试化学品危险类别包含空字符串"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001'
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '有问题的化学品',
                'dangerous_categories': ['强酸', '', '  ']  # 包含空字符串
            }
        }
        
        normalizer = Normalizer({})
        
        violation = check_missing_labels(request, chemicals, normalizer)
        
        # 包含无效类别值，应该有违规
        assert violation is not None
        assert violation.rule_id == 'LABEL-003'
        assert violation.severity == Severity.MEDIUM
        assert '包含无效值' in violation.message


class TestCheckDangerousCategoryMixing:
    """测试危险类别禁混检查"""
    
    def setup_method(self):
        """每个测试前的设置"""
        self.normalization_rules = {
            '强酸': ['酸类', '强酸性物质'],
            '强碱': ['碱类', '强碱性物质'],
            '易燃液体': ['有机溶剂']
        }
        
        self.compatibility = {
            'normalization': self.normalization_rules,
            'incompatible_pairs': {
                '强酸': {'强碱': 'critical', '易燃液体': 'high'},
                '强碱': {'强酸': 'critical', '易燃液体': 'medium'},
                '易燃液体': {'强酸': 'high', '强碱': 'medium'}
            },
            'storage_rules': {}
        }
    
    def test_forbidden_category(self):
        """测试化学品类别在库位禁止列表中"""
        normalizer = Normalizer(self.normalization_rules)
        
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': 'A-02'  # 强碱存储区
        }
        
        storage = {
            'A-02': {
                'name': '强碱存储区',
                'allowed_categories': ['强碱'],
                'forbidden_categories': ['强酸', '酸类'],  # 禁止强酸
                'current_chemicals': []
            }
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '浓硫酸',
                'dangerous_categories': ['强酸']
            }
        }
        
        violations = check_dangerous_category_mixing(
            request, storage, chemicals, self.compatibility, normalizer
        )
        
        # 强酸在强碱存储区的禁止列表中，应该有违规
        assert len(violations) >= 1
        forbidden_violations = [v for v in violations if v.rule_id == 'MIXING-001']
        assert len(forbidden_violations) == 1
        assert forbidden_violations[0].severity == Severity.CRITICAL
    
    def test_allowed_category_mismatch(self):
        """测试化学品类别不在库位允许列表中"""
        normalizer = Normalizer(self.normalization_rules)
        
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': 'A-01'  # 强酸存储区
        }
        
        storage = {
            'A-01': {
                'name': '强酸存储区',
                'allowed_categories': ['强酸', '酸类'],  # 只允许强酸
                'forbidden_categories': [],
                'current_chemicals': []
            }
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '氢氧化钠',
                'dangerous_categories': ['强碱']  # 强碱
            }
        }
        
        violations = check_dangerous_category_mixing(
            request, storage, chemicals, self.compatibility, normalizer
        )
        
        # 强碱不在强酸存储区的允许列表中，应该有违规
        allowed_violations = [v for v in violations if v.rule_id == 'MIXING-002']
        assert len(allowed_violations) == 1
        assert allowed_violations[0].severity == Severity.HIGH
    
    def test_incompatible_with_existing(self):
        """测试与库位中现有化学品不相容"""
        normalizer = Normalizer(self.normalization_rules)
        
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-002',  # 强碱
            'requested_location': 'MIX-01'
        }
        
        storage = {
            'MIX-01': {
                'name': '混合存储区',
                'allowed_categories': [],  # 没有限制
                'forbidden_categories': [],
                'current_chemicals': [
                    {'chemical_id': 'CHEM-001', 'volume': 20.0}  # 强酸
                ]
            }
        }
        
        chemicals = {
            'CHEM-001': {
                'name': '浓硫酸',
                'dangerous_categories': ['强酸']
            },
            'CHEM-002': {
                'name': '氢氧化钠',
                'dangerous_categories': ['强碱']
            }
        }
        
        violations = check_dangerous_category_mixing(
            request, storage, chemicals, self.compatibility, normalizer
        )
        
        # 强酸和强碱不相容，应该有违规
        incompat_violations = [v for v in violations if v.rule_id == 'MIXING-003']
        assert len(incompat_violations) == 1
        assert incompat_violations[0].severity == Severity.CRITICAL  # 强酸+强碱是critical
    
    def test_normalization_alias(self):
        """测试使用别名时的归一化"""
        normalizer = Normalizer(self.normalization_rules)
        
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-002',  # 使用别名"碱类"
            'requested_location': 'A-01'
        }
        
        storage = {
            'A-01': {
                'name': '强酸存储区',
                'allowed_categories': ['强酸'],
                'forbidden_categories': ['强碱'],  # 禁止强碱
                'current_chemicals': []
            }
        }
        
        chemicals = {
            'CHEM-002': {
                'name': '氢氧化钠',
                'dangerous_categories': ['碱类']  # 使用别名
            }
        }
        
        violations = check_dangerous_category_mixing(
            request, storage, chemicals, self.compatibility, normalizer
        )
        
        # 碱类应该归一化为强碱，被禁止
        forbidden_violations = [v for v in violations if v.rule_id == 'MIXING-001']
        assert len(forbidden_violations) == 1


class TestCheckInboundConflicts:
    """测试入库申请冲突检查"""
    
    def setup_method(self):
        """每个测试前的设置"""
        self.normalization_rules = {
            '强酸': ['酸类'],
            '强碱': ['碱类']
        }
        
        self.normalizer = Normalizer(self.normalization_rules)
        
        self.storage = {
            'A-01': {
                'name': '存储区A',
                'capacity': 100.0,
                'remaining_capacity': 50.0,  # 剩余50L
                'current_usage': 50.0,
                'current_chemicals': []
            }
        }
        
        self.chemicals = {
            'CHEM-001': {'name': '化学品1', 'dangerous_categories': ['强酸']},
            'CHEM-002': {'name': '化学品2', 'dangerous_categories': ['强碱']},
            'CHEM-003': {'name': '化学品3', 'dangerous_categories': ['强酸']}
        }
    
    def test_multiple_requests_capacity_conflict(self):
        """测试多个申请同一库位总容量不足"""
        # 两个申请都申请A-01，总需求60L，但只剩50L
        all_requests = [
            {
                'request_id': 'REQ-001',
                'chemical_id': 'CHEM-001',
                'requested_location': 'A-01',
                'volume': 30.0
            },
            {
                'request_id': 'REQ-002',
                'chemical_id': 'CHEM-003',
                'requested_location': 'A-01',
                'volume': 30.0  # 30+30=60 > 50
            }
        ]
        
        violations = check_inbound_conflicts(
            all_requests, self.storage, self.chemicals, self.normalizer
        )
        
        # 总容量不足，应该有违规
        capacity_conflicts = [v for v in violations if v.rule_id == 'CONFLICT-001']
        assert len(capacity_conflicts) == 1
        assert capacity_conflicts[0].severity == Severity.HIGH
        assert capacity_conflicts[0].details['total_requested_volume'] == 60.0
        assert capacity_conflicts[0].details['remaining_capacity'] == 50.0
    
    def test_different_categories_same_location(self):
        """测试同一库位中不同类别的化学品"""
        all_requests = [
            {
                'request_id': 'REQ-001',
                'chemical_id': 'CHEM-001',  # 强酸
                'requested_location': 'A-01',
                'volume': 20.0
            },
            {
                'request_id': 'REQ-002',
                'chemical_id': 'CHEM-002',  # 强碱
                'requested_location': 'A-01',
                'volume': 20.0
            }
        ]
        
        violations = check_inbound_conflicts(
            all_requests, self.storage, self.chemicals, self.normalizer
        )
        
        # 不同类别，应该有潜在冲突警告
        category_conflicts = [v for v in violations if v.rule_id == 'CONFLICT-002']
        assert len(category_conflicts) == 1
        assert category_conflicts[0].severity == Severity.MEDIUM
    
    def test_duplicate_chemical_reference(self):
        """测试同一化学品被多次申请"""
        all_requests = [
            {
                'request_id': 'REQ-001',
                'chemical_id': 'CHEM-001',  # 同一化学品
                'requested_location': 'A-01',
                'volume': 20.0
            },
            {
                'request_id': 'REQ-002',
                'chemical_id': 'CHEM-001',  # 同一化学品
                'requested_location': 'A-01',
                'volume': 10.0
            }
        ]
        
        violations = check_inbound_conflicts(
            all_requests, self.storage, self.chemicals, self.normalizer
        )
        
        # 同一化学品被多次引用，应该有低优先级警告
        duplicate_conflicts = [v for v in violations if v.rule_id == 'CONFLICT-003']
        assert len(duplicate_conflicts) == 1
        assert duplicate_conflicts[0].severity == Severity.LOW
