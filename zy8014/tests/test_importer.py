import os
import pytest
import tempfile
import csv
import json
import yaml

from src.customs_inspector.importer import Importer, ImportError
from src.customs_inspector.models import Manifest, PackingList, DeclarationRule, RiskLevel


class TestImporter:
    
    def test_import_manifest_success(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'voyage_no', 'vessel_name', 'eta', 'etd', 'ticket_no', 'container_no',
                'description', 'hs_code', 'weight', 'weight_unit', 'volume', 'volume_unit',
                'quantity', 'origin_country', 'destination_country', 'is_cancelled'
            ])
            writer.writerow([
                'VOY001', 'Test Vessel', '2024-05-15 08:00:00', '2024-05-10 14:00:00',
                'TKT001', 'MSKU1234567', '测试商品', '3926.9090',
                '1500', 'KG', '25.5', 'CBM', '100', '中国', '美国', 'false'
            ])
            temp_path = f.name
        
        try:
            manifest = Importer.import_manifest(temp_path)
            
            assert isinstance(manifest, Manifest)
            assert manifest.voyage_no == 'VOY001'
            assert manifest.vessel_name == 'Test Vessel'
            assert len(manifest.items) == 1
            
            item = manifest.items[0]
            assert item.ticket_no == 'TKT001'
            assert item.container_no == 'MSKU1234567'
            assert item.description == '测试商品'
            assert item.hs_code == '3926.9090'
            assert item.weight == 1500.0
            assert item.volume == 25.5
            assert item.quantity == 100
            assert item.is_cancelled is False
        finally:
            os.unlink(temp_path)
    
    def test_import_manifest_missing_file(self):
        with pytest.raises(ImportError) as exc_info:
            Importer.import_manifest('/nonexistent/path/manifest.csv')
        
        assert '不存在' in str(exc_info.value)
    
    def test_import_packing_list_success(self):
        data = {
            'ticket_no': 'TKT001',
            'packing_date': '2024-05-08',
            'total_weight': 2300,
            'total_volume': 37.8,
            'items': [
                {
                    'ticket_no': 'TKT001',
                    'container_no': 'MSKU1234567',
                    'description': '塑料零件',
                    'hs_code': '3926.9090',
                    'weight': 1500,
                    'weight_unit': 'KG',
                    'volume': 25.5,
                    'volume_unit': 'CBM',
                    'quantity': 100,
                    'package_type': 'CTN'
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f)
            temp_path = f.name
        
        try:
            packing_list = Importer.import_packing_list(temp_path)
            
            assert isinstance(packing_list, PackingList)
            assert packing_list.ticket_no == 'TKT001'
            assert packing_list.total_weight == 2300
            assert packing_list.total_volume == 37.8
            assert len(packing_list.items) == 1
            
            item = packing_list.items[0]
            assert item.description == '塑料零件'
            assert item.hs_code == '3926.9090'
            assert item.weight == 1500.0
        finally:
            os.unlink(temp_path)
    
    def test_import_rules_success(self):
        rules_data = {
            'rules': [
                {
                    'rule_id': 'TEST_001',
                    'rule_name': '测试规则',
                    'rule_type': 'restricted',
                    'conditions': {
                        'hs_codes': ['84*', '85*'],
                        'keywords': ['机械', '电子']
                    },
                    'required_certificates': ['3C认证', '检测报告'],
                    'risk_level': 'MEDIUM',
                    'description': '测试规则描述',
                    'priority': 100
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            yaml.dump(rules_data, f)
            temp_path = f.name
        
        try:
            rules = Importer.import_rules(temp_path)
            
            assert len(rules) == 1
            rule = rules[0]
            
            assert isinstance(rule, DeclarationRule)
            assert rule.rule_id == 'TEST_001'
            assert rule.rule_name == '测试规则'
            assert rule.rule_type == 'restricted'
            assert rule.risk_level == RiskLevel.MEDIUM
            assert '84*' in rule.conditions['hs_codes']
            assert '3C认证' in rule.required_certificates
        finally:
            os.unlink(temp_path)
