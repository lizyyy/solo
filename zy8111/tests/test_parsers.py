"""
测试解析校验模块
"""
import os
import tempfile
import pytest
import csv
import json
import yaml

# 添加父目录到模块搜索路径
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chemical_compatibility_checker.parsers import (
    parse_chemicals,
    parse_storage,
    parse_compatibility,
    parse_inbound,
    validate_data_integrity,
    ValidationError
)


class TestParseChemicals:
    """测试化学品解析"""
    
    def test_parse_valid_chemicals(self):
        """测试解析有效的化学品CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['chemical_id', 'name', 'dangerous_categories', 'volume', 'unit'])
            writer.writeheader()
            writer.writerow({
                'chemical_id': 'CHEM-001',
                'name': '浓硫酸',
                'dangerous_categories': '强酸,腐蚀性物质',
                'volume': '500',
                'unit': 'ml'
            })
            writer.writerow({
                'chemical_id': 'CHEM-002',
                'name': '氢氧化钠',
                'dangerous_categories': '强碱',
                'volume': '1000',
                'unit': 'ml'
            })
            temp_path = f.name
        
        try:
            chemicals = parse_chemicals(temp_path)
            
            assert len(chemicals) == 2
            assert 'CHEM-001' in chemicals
            assert 'CHEM-002' in chemicals
            
            # 检查第一个化学品
            chem1 = chemicals['CHEM-001']
            assert chem1['name'] == '浓硫酸'
            assert chem1['dangerous_categories'] == ['强酸', '腐蚀性物质']
            assert chem1['volume'] == 500.0
            assert chem1['unit'] == 'ml'
            
            # 检查第二个化学品
            chem2 = chemicals['CHEM-002']
            assert chem2['name'] == '氢氧化钠'
            assert chem2['dangerous_categories'] == ['强碱']
            assert chem2['volume'] == 1000.0
        finally:
            os.unlink(temp_path)
    
    def test_parse_chemicals_missing_file(self):
        """测试解析不存在的文件"""
        with pytest.raises(ValidationError) as excinfo:
            parse_chemicals('/nonexistent/path/chemicals.csv')
        
        assert '化学品文件不存在' in str(excinfo.value)
    
    def test_parse_chemicals_duplicate_id(self):
        """测试解析重复ID的化学品"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['chemical_id', 'name', 'dangerous_categories', 'volume', 'unit'])
            writer.writeheader()
            writer.writerow({
                'chemical_id': 'CHEM-001',
                'name': '浓硫酸',
                'dangerous_categories': '强酸',
                'volume': '500',
                'unit': 'ml'
            })
            writer.writerow({
                'chemical_id': 'CHEM-001',  # 重复ID
                'name': '盐酸',
                'dangerous_categories': '酸类',
                'volume': '1000',
                'unit': 'ml'
            })
            temp_path = f.name
        
        try:
            with pytest.raises(ValidationError) as excinfo:
                parse_chemicals(temp_path)
            
            assert '重复的化学品ID' in str(excinfo.value)
        finally:
            os.unlink(temp_path)
    
    def test_parse_chemicals_invalid_volume(self):
        """测试解析无效体积的化学品"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['chemical_id', 'name', 'dangerous_categories', 'volume', 'unit'])
            writer.writeheader()
            writer.writerow({
                'chemical_id': 'CHEM-001',
                'name': '浓硫酸',
                'dangerous_categories': '强酸',
                'volume': 'abc',  # 无效体积
                'unit': 'ml'
            })
            temp_path = f.name
        
        try:
            with pytest.raises(ValidationError) as excinfo:
                parse_chemicals(temp_path)
            
            assert '体积格式无效' in str(excinfo.value)
        finally:
            os.unlink(temp_path)


class TestParseStorage:
    """测试库位解析"""
    
    def test_parse_valid_storage(self):
        """测试解析有效的库位YAML"""
        storage_data = {
            'locations': [
                {
                    'id': 'A-01',
                    'name': '强酸存储区',
                    'capacity': 100,
                    'unit': 'L',
                    'allowed_categories': ['强酸', '酸类'],
                    'forbidden_categories': ['强碱'],
                    'current_chemicals': [
                        {'chemical_id': 'CHEM-001', 'volume': 20}
                    ]
                },
                {
                    'id': 'A-02',
                    'name': '强碱存储区',
                    'capacity': 100,
                    'unit': 'L',
                    'allowed_categories': ['强碱'],
                    'current_chemicals': []
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            yaml.dump(storage_data, f, allow_unicode=True)
            temp_path = f.name
        
        try:
            storage = parse_storage(temp_path)
            
            assert len(storage) == 2
            assert 'A-01' in storage
            assert 'A-02' in storage
            
            # 检查第一个库位
            loc1 = storage['A-01']
            assert loc1['name'] == '强酸存储区'
            assert loc1['capacity'] == 100.0
            assert loc1['allowed_categories'] == ['强酸', '酸类']
            assert loc1['forbidden_categories'] == ['强碱']
            assert loc1['current_usage'] == 20.0
            assert loc1['remaining_capacity'] == 80.0
            assert len(loc1['current_chemicals']) == 1
            
            # 检查第二个库位（空）
            loc2 = storage['A-02']
            assert loc2['current_usage'] == 0.0
            assert loc2['remaining_capacity'] == 100.0
        finally:
            os.unlink(temp_path)
    
    def test_parse_storage_missing_file(self):
        """测试解析不存在的库位文件"""
        with pytest.raises(ValidationError) as excinfo:
            parse_storage('/nonexistent/path/storage.yaml')
        
        assert '库位文件不存在' in str(excinfo.value)
    
    def test_parse_storage_missing_locations(self):
        """测试解析缺少locations字段的YAML"""
        invalid_data = {'some_other_field': 'value'}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            yaml.dump(invalid_data, f)
            temp_path = f.name
        
        try:
            with pytest.raises(ValidationError) as excinfo:
                parse_storage(temp_path)
            
            assert "缺少 'locations' 字段" in str(excinfo.value)
        finally:
            os.unlink(temp_path)


class TestParseCompatibility:
    """测试相容性规则解析"""
    
    def test_parse_valid_compatibility(self):
        """测试解析有效的相容性规则"""
        compat_data = {
            'normalization': {
                '强酸': ['酸类', '强酸性物质'],
                '强碱': ['碱类', '强碱性物质']
            },
            'incompatible_pairs': [
                {'category1': '强酸', 'category2': '强碱', 'severity': 'critical'},
                {'category1': '强酸', 'category2': '易燃液体', 'severity': 'high'}
            ],
            'storage_rules': [
                {
                    'category': '强酸',
                    'requirements': ['通风', '防腐蚀'],
                    'notes': '应单独存放'
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(compat_data, f, ensure_ascii=False)
            temp_path = f.name
        
        try:
            compatibility = parse_compatibility(temp_path)
            
            # 检查归一化规则
            assert 'normalization' in compatibility
            assert compatibility['normalization']['强酸'] == ['酸类', '强酸性物质']
            
            # 检查不相容对（应该是双向的）
            assert 'incompatible_pairs' in compatibility
            incompat = compatibility['incompatible_pairs']
            assert '强酸' in incompat
            assert '强碱' in incompat['强酸']
            assert incompat['强酸']['强碱'] == 'critical'
            # 双向检查
            assert '强碱' in incompat
            assert '强酸' in incompat['强碱']
            
            # 检查存储规则
            assert 'storage_rules' in compatibility
            assert '强酸' in compatibility['storage_rules']
            assert compatibility['storage_rules']['强酸']['requirements'] == ['通风', '防腐蚀']
        finally:
            os.unlink(temp_path)
    
    def test_parse_compatibility_missing_fields(self):
        """测试解析缺少可选字段的相容性规则"""
        minimal_data = {}  # 所有字段都是可选的
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(minimal_data, f)
            temp_path = f.name
        
        try:
            compatibility = parse_compatibility(temp_path)
            
            # 应该使用默认空值
            assert compatibility['normalization'] == {}
            assert compatibility['incompatible_pairs'] == {}
            assert compatibility['storage_rules'] == {}
        finally:
            os.unlink(temp_path)


class TestParseInbound:
    """测试入库申请解析"""
    
    def test_parse_valid_inbound(self):
        """测试解析有效的入库申请"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['request_id', 'chemical_id', 'requested_location', 'volume'])
            writer.writeheader()
            writer.writerow({
                'request_id': 'REQ-001',
                'chemical_id': 'CHEM-001',
                'requested_location': 'A-01',
                'volume': '20'
            })
            writer.writerow({
                'request_id': 'REQ-002',
                'chemical_id': 'CHEM-002',
                'requested_location': '',  # 空的库位
                'volume': '15'
            })
            temp_path = f.name
        
        try:
            inbound = parse_inbound(temp_path)
            
            assert len(inbound) == 2
            
            # 检查第一个申请
            req1 = inbound[0]
            assert req1['request_id'] == 'REQ-001'
            assert req1['chemical_id'] == 'CHEM-001'
            assert req1['requested_location'] == 'A-01'
            assert req1['volume'] == 20.0
            assert req1['status'] == 'pending'
            
            # 检查第二个申请（空库位）
            req2 = inbound[1]
            assert req2['requested_location'] == ''
        finally:
            os.unlink(temp_path)


class TestValidateDataIntegrity:
    """测试数据完整性验证"""
    
    def test_validate_valid_data(self):
        """测试验证有效数据"""
        chemicals = {
            'CHEM-001': {'name': '浓硫酸', 'dangerous_categories': ['强酸'], 'volume': 500, 'unit': 'ml'},
            'CHEM-002': {'name': '氢氧化钠', 'dangerous_categories': ['强碱'], 'volume': 1000, 'unit': 'ml'}
        }
        
        storage = {
            'A-01': {
                'name': '强酸存储区',
                'capacity': 100,
                'unit': 'L',
                'allowed_categories': ['强酸'],
                'forbidden_categories': [],
                'current_usage': 10,
                'current_chemicals': [{'chemical_id': 'CHEM-001', 'volume': 10}],
                'remaining_capacity': 90
            }
        }
        
        inbound = [
            {'request_id': 'REQ-001', 'chemical_id': 'CHEM-001', 'requested_location': 'A-01', 'volume': 20, 'status': 'pending'},
            {'request_id': 'REQ-002', 'chemical_id': 'CHEM-002', 'requested_location': '', 'volume': 15, 'status': 'pending'}
        ]
        
        warnings = validate_data_integrity(chemicals, storage, inbound)
        
        assert len(warnings) == 0  # 没有警告
    
    def test_validate_missing_chemical_in_inbound(self):
        """测试验证入库申请中引用不存在的化学品"""
        chemicals = {
            'CHEM-001': {'name': '浓硫酸', 'dangerous_categories': ['强酸'], 'volume': 500, 'unit': 'ml'}
        }
        
        storage = {'A-01': {'current_chemicals': []}}  # 简化
        
        inbound = [
            {'request_id': 'REQ-001', 'chemical_id': 'NONEXISTENT', 'requested_location': 'A-01', 'volume': 20, 'status': 'pending'}
        ]
        
        warnings = validate_data_integrity(chemicals, storage, inbound)
        
        assert len(warnings) == 1
        assert '引用了不存在的化学品' in warnings[0]
    
    def test_validate_missing_location_in_inbound(self):
        """测试验证入库申请中引用不存在的库位"""
        chemicals = {
            'CHEM-001': {'name': '浓硫酸', 'dangerous_categories': ['强酸'], 'volume': 500, 'unit': 'ml'}
        }
        
        storage = {'A-01': {'current_chemicals': []}}
        
        inbound = [
            {'request_id': 'REQ-001', 'chemical_id': 'CHEM-001', 'requested_location': 'NONEXISTENT', 'volume': 20, 'status': 'pending'}
        ]
        
        warnings = validate_data_integrity(chemicals, storage, inbound)
        
        assert len(warnings) == 1
        assert '引用了不存在的库位' in warnings[0]
    
    def test_validate_missing_chemical_in_storage(self):
        """测试验证库位中存储不存在的化学品"""
        chemicals = {
            'CHEM-001': {'name': '浓硫酸', 'dangerous_categories': ['强酸'], 'volume': 500, 'unit': 'ml'}
        }
        
        storage = {
            'A-01': {
                'current_chemicals': [
                    {'chemical_id': 'NONEXISTENT', 'volume': 10}
                ]
            }
        }
        
        inbound = []
        
        warnings = validate_data_integrity(chemicals, storage, inbound)
        
        assert len(warnings) == 1
        assert '存储了不存在的化学品' in warnings[0]
