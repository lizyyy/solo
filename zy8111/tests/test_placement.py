"""
测试库位计算模块
"""
import os
import sys
import pytest

# 添加父目录到模块搜索路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chemical_compatibility_checker.rules import (
    Normalizer,
    Severity,
    Violation
)
from chemical_compatibility_checker.placement import (
    AlternativeLocation,
    PlacementItem,
    find_alternative_locations,
    generate_placement_plan,
    calculate_storage_utilization
)


class TestAlternativeLocation:
    """测试替代库位数据类"""
    
    def test_alternative_location_creation(self):
        """测试创建替代库位对象"""
        alt = AlternativeLocation(
            location_id='A-01',
            location_name='强酸存储区',
            suitability_score=85.0,
            remaining_capacity=90.0,
            reasons=['容量充足', '类别匹配'],
            warnings=['需人工确认']
        )
        
        assert alt.location_id == 'A-01'
        assert alt.location_name == '强酸存储区'
        assert alt.suitability_score == 85.0
        assert alt.remaining_capacity == 90.0
        assert alt.reasons == ['容量充足', '类别匹配']
        assert alt.warnings == ['需人工确认']


class TestPlacementItem:
    """测试放置项数据类"""
    
    def test_placement_item_creation(self):
        """测试创建立放置项对象"""
        item = PlacementItem(
            request_id='REQ-001',
            chemical_id='CHEM-001',
            chemical_name='浓硫酸',
            requested_location='A-01',
            final_location='A-02',
            volume=20.0,
            status='needs_review',
            violations=[],
            alternative_locations=[]
        )
        
        assert item.request_id == 'REQ-001'
        assert item.chemical_id == 'CHEM-001'
        assert item.chemical_name == '浓硫酸'
        assert item.requested_location == 'A-01'
        assert item.final_location == 'A-02'
        assert item.volume == 20.0
        assert item.status == 'needs_review'


class TestFindAlternativeLocations:
    """测试寻找替代库位功能"""
    
    def setup_method(self):
        """每个测试前的设置"""
        self.normalization_rules = {
            '强酸': ['酸类', '强酸性物质'],
            '强碱': ['碱类', '强碱性物质'],
            '氧化剂': ['氧化性物质'],
            '易燃液体': ['有机溶剂']
        }
        
        self.normalizer = Normalizer(self.normalization_rules)
        
        self.compatibility = {
            'normalization': self.normalization_rules,
            'incompatible_pairs': {
                '强酸': {'强碱': 'critical', '易燃液体': 'high', '氧化剂': 'medium'},
                '强碱': {'强酸': 'critical', '易燃液体': 'medium'},
                '氧化剂': {'强酸': 'medium', '强碱': 'low', '易燃液体': 'critical'},
                '易燃液体': {'强酸': 'high', '强碱': 'medium', '氧化剂': 'critical'}
            },
            'storage_rules': {}
        }
        
        self.storage = {
            'A-01': {
                'name': '强酸存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': ['强酸', '酸类'],
                'forbidden_categories': ['强碱', '易燃液体'],
                'current_usage': 10.0,
                'current_chemicals': [
                    {'chemical_id': 'EXIST-001', 'volume': 10.0}
                ],
                'remaining_capacity': 90.0
            },
            'A-02': {
                'name': '强碱存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': ['强碱', '碱类'],
                'forbidden_categories': ['强酸', '酸类'],
                'current_usage': 0.0,
                'current_chemicals': [],
                'remaining_capacity': 100.0
            },
            'B-01': {
                'name': '易燃液体存储区',
                'capacity': 200.0,
                'unit': 'L',
                'allowed_categories': ['易燃液体'],
                'forbidden_categories': ['氧化剂', '强酸'],
                'current_usage': 50.0,
                'current_chemicals': [
                    {'chemical_id': 'EXIST-002', 'volume': 50.0}
                ],
                'remaining_capacity': 150.0
            },
            'C-01': {
                'name': '小容量存储区',
                'capacity': 10.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 0.0,
                'current_chemicals': [],
                'remaining_capacity': 10.0
            },
            'MIX-01': {
                'name': '混合存储区',
                'capacity': 150.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 20.0,
                'current_chemicals': [
                    {'chemical_id': 'EXIST-003', 'volume': 20.0}
                ],
                'remaining_capacity': 130.0
            }
        }
        
        self.chemicals = {
            'CHEM-001': {
                'name': '浓硫酸',
                'dangerous_categories': ['强酸'],
                'volume': 500,
                'unit': 'ml'
            },
            'CHEM-002': {
                'name': '氢氧化钠',
                'dangerous_categories': ['强碱'],
                'volume': 1000,
                'unit': 'ml'
            },
            'CHEM-003': {
                'name': '乙醇',
                'dangerous_categories': ['易燃液体'],
                'volume': 2000,
                'unit': 'ml'
            },
            'EXIST-001': {
                'name': '盐酸',
                'dangerous_categories': ['酸类'],  # 别名，应归一化为强酸
                'volume': 1000,
                'unit': 'ml'
            },
            'EXIST-002': {
                'name': '丙酮',
                'dangerous_categories': ['有机溶剂'],  # 别名，应归一化为易燃液体
                'volume': 1000,
                'unit': 'ml'
            },
            'EXIST-003': {
                'name': '过氧化氢',
                'dangerous_categories': ['氧化剂'],
                'volume': 500,
                'unit': 'ml'
            }
        }
    
    def test_find_alternatives_for_strong_acid(self):
        """测试为强酸寻找替代库位"""
        # 模拟：强酸申请了强碱存储区（会被拒绝），需要寻找替代库位
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',  # 强酸
            'requested_location': 'A-02',  # 错误地申请了强碱存储区
            'volume': 20.0
        }
        
        alternatives = find_alternative_locations(
            request, self.storage, self.chemicals,
            self.compatibility, self.normalizer
        )
        
        # 应该找到替代库位
        assert len(alternatives) > 0
        
        # A-01（强酸存储区）应该是最佳选择
        # 因为：容量足够、允许类别匹配、已有相同类别化学品、名称匹配
        a01_alt = next((a for a in alternatives if a.location_id == 'A-01'), None)
        assert a01_alt is not None
        assert a01_alt.suitability_score > 0
        
        # A-02（强碱存储区）不应该在列表中，因为：
        # 1. 它是原申请的库位，会被跳过
        # 2. 强酸是强碱存储区的禁止类别
        
        # MIX-01（混合存储区）应该在列表中，但分数较低
        # 因为有氧化剂，和强酸是medium级不相容
    
    def test_find_alternatives_capacity_filter(self):
        """测试容量过滤"""
        # 申请一个体积超过所有库位的化学品
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',
            'requested_location': 'NONEXISTENT',
            'volume': 200.0  # 超过所有库位的剩余容量
        }
        
        alternatives = find_alternative_locations(
            request, self.storage, self.chemicals,
            self.compatibility, self.normalizer
        )
        
        # 不应该找到任何替代库位，因为容量都不够
        assert len(alternatives) == 0
    
    def test_find_alternatives_forbidden_category(self):
        """测试禁止类别过滤"""
        # 易燃液体申请存储
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-003',  # 易燃液体
            'requested_location': 'NONEXISTENT',
            'volume': 30.0
        }
        
        alternatives = find_alternative_locations(
            request, self.storage, self.chemicals,
            self.compatibility, self.normalizer
        )
        
        # A-01（强酸存储区）禁止易燃液体，不应该在列表中
        a01_alt = next((a for a in alternatives if a.location_id == 'A-01'), None)
        assert a01_alt is None
        
        # B-01（易燃液体存储区）应该是最佳选择
        b01_alt = next((a for a in alternatives if a.location_id == 'B-01'), None)
        assert b01_alt is not None
        
        # MIX-01中有氧化剂，氧化剂和易燃液体是critical级不相容
        # 所以MIX-01不应该在列表中
        mix01_alt = next((a for a in alternatives if a.location_id == 'MIX-01'), None)
        assert mix01_alt is None
    
    def test_alternative_location_sorting(self):
        """测试替代库位按分数排序"""
        request = {
            'request_id': 'REQ-001',
            'chemical_id': 'CHEM-001',  # 强酸
            'requested_location': 'NONEXISTENT',
            'volume': 20.0
        }
        
        alternatives = find_alternative_locations(
            request, self.storage, self.chemicals,
            self.compatibility, self.normalizer
        )
        
        # 应该按分数从高到低排序
        if len(alternatives) > 1:
            for i in range(len(alternatives) - 1):
                assert alternatives[i].suitability_score >= alternatives[i + 1].suitability_score


class TestGeneratePlacementPlan:
    """测试生成放置计划"""
    
    def setup_method(self):
        """每个测试前的设置"""
        self.normalization_rules = {
            '强酸': ['酸类'],
            '强碱': ['碱类']
        }
        
        self.normalizer = Normalizer(self.normalization_rules)
        
        self.compatibility = {
            'normalization': self.normalization_rules,
            'incompatible_pairs': {
                '强酸': {'强碱': 'critical'},
                '强碱': {'强酸': 'critical'}
            },
            'storage_rules': {}
        }
        
        self.storage = {
            'A-01': {
                'name': '强酸存储区',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': ['强酸'],
                'forbidden_categories': ['强碱'],
                'current_usage': 10.0,
                'current_chemicals': [
                    {'chemical_id': 'EXIST-001', 'volume': 10.0}
                ],
                'remaining_capacity': 90.0
            },
            'A-02': {
                'name': '通用存储区',
                'capacity': 200.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 0.0,
                'current_chemicals': [],
                'remaining_capacity': 200.0
            }
        }
        
        self.chemicals = {
            'CHEM-001': {
                'name': '浓硫酸',
                'dangerous_categories': ['强酸'],
                'volume': 500,
                'unit': 'ml'
            },
            'EXIST-001': {
                'name': '盐酸',
                'dangerous_categories': ['酸类'],
                'volume': 1000,
                'unit': 'ml'
            }
        }
    
    def test_generate_plan_approved(self):
        """测试生成通过的放置计划"""
        inbound = [
            {
                'request_id': 'REQ-001',
                'chemical_id': 'CHEM-001',  # 强酸
                'requested_location': 'A-01',  # 强酸存储区
                'volume': 20.0,
                'status': 'pending'
            }
        ]
        
        # 没有违规
        violations = []
        
        placement_items, updated_storage = generate_placement_plan(
            inbound, self.storage, self.chemicals,
            self.compatibility, self.normalizer, violations
        )
        
        assert len(placement_items) == 1
        
        item = placement_items[0]
        assert item.request_id == 'REQ-001'
        assert item.status == 'approved'
        assert item.final_location == 'A-01'
        
        # 检查库位状态是否更新
        assert updated_storage['A-01']['remaining_capacity'] == 70.0  # 90-20=70
        assert updated_storage['A-01']['current_usage'] == 30.0  # 10+20=30
    
    def test_generate_plan_rejected(self):
        """测试生成被拒绝的放置计划"""
        inbound = [
            {
                'request_id': 'REQ-001',
                'chemical_id': 'CHEM-001',
                'requested_location': 'A-01',
                'volume': 20.0,
                'status': 'pending'
            }
        ]
        
        # 有严重违规
        violations = [
            Violation(
                rule_id='MIXING-001',
                severity=Severity.CRITICAL,
                message='严重违规',
                request_id='REQ-001',
                chemical_id='CHEM-001',
                location_id='A-01'
            )
        ]
        
        placement_items, updated_storage = generate_placement_plan(
            inbound, self.storage, self.chemicals,
            self.compatibility, self.normalizer, violations
        )
        
        assert len(placement_items) == 1
        
        item = placement_items[0]
        assert item.status == 'rejected'
        assert item.final_location is None  # 没有最终库位
        assert len(item.violations) == 1
        assert len(item.alternative_locations) > 0  # 应该有替代库位建议
        
        # 库位状态不应该更新，因为申请被拒绝
        assert updated_storage['A-01']['remaining_capacity'] == 90.0  # 保持不变


class TestCalculateStorageUtilization:
    """测试库位利用率计算"""
    
    def test_calculate_utilization(self):
        """测试计算库位利用率"""
        storage = {
            'A-01': {
                'name': '存储区A',
                'capacity': 100.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 30.0,
                'current_chemicals': [],
                'remaining_capacity': 70.0
            },
            'A-02': {
                'name': '存储区B',
                'capacity': 200.0,
                'unit': 'L',
                'allowed_categories': [],
                'forbidden_categories': [],
                'current_usage': 50.0,
                'current_chemicals': [],
                'remaining_capacity': 150.0
            }
        }
        
        utilization = calculate_storage_utilization(storage)
        
        # 检查总统计
        assert utilization['total_capacity'] == 300.0  # 100+200
        assert utilization['total_used'] == 80.0  # 30+50
        assert utilization['total_remaining'] == 220.0  # 300-80
        assert utilization['overall_utilization_percent'] == 26.67  # (80/300)*100 = 26.67
        
        # 检查各库位详情
        assert len(utilization['location_details']) == 2
        
        a01_detail = next((d for d in utilization['location_details'] if d['location_id'] == 'A-01'), None)
        assert a01_detail is not None
        assert a01_detail['utilization_percent'] == 30.0  # 30/100*100
        
        a02_detail = next((d for d in utilization['location_details'] if d['location_id'] == 'A-02'), None)
        assert a02_detail is not None
        assert a02_detail['utilization_percent'] == 25.0  # 50/200*100
    
    def test_calculate_utilization_empty(self):
        """测试空库位的利用率计算"""
        storage = {}
        
        utilization = calculate_storage_utilization(storage)
        
        assert utilization['total_capacity'] == 0.0
        assert utilization['total_used'] == 0.0
        assert utilization['total_remaining'] == 0.0
        assert utilization['overall_utilization_percent'] == 0.0
        assert len(utilization['location_details']) == 0
