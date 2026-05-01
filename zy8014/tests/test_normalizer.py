import pytest

from src.customs_inspector.normalizer import Normalizer
from src.customs_inspector.models import (
    Manifest, ManifestItem, PackingList, PackingItem,
    ValidationErrorType, RiskLevel
)


class TestNormalizer:
    
    def test_normalize_hs_code(self):
        normalizer = Normalizer()
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code='3926.9090'
        )
        
        manifest = Manifest(voyage_no='VOY001', vessel_name='Test', items=[item])
        normalized = normalizer.normalize_manifest(manifest)
        
        assert normalized.items[0].hs_code == '3926 90 90'
    
    def test_normalize_hs_code_short(self):
        normalizer = Normalizer()
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code='851762'
        )
        
        manifest = Manifest(voyage_no='VOY001', vessel_name='Test', items=[item])
        normalized = normalizer.normalize_manifest(manifest)
        
        assert normalized.items[0].hs_code == '8517 62'
    
    def test_normalize_weight_conversion(self):
        normalizer = Normalizer()
        
        item = PackingItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code='3926.9090',
            weight=100,
            weight_unit='LB'
        )
        
        packing = PackingList(ticket_no='TKT001', items=[item])
        normalized = normalizer.normalize_packing_list(packing)
        
        assert normalized.items[0].weight_unit == 'KG'
        assert abs(normalized.items[0].weight - 45.359) < 0.01
    
    def test_normalize_country(self):
        normalizer = Normalizer()
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code='3926.9090',
            origin_country='中国',
            destination_country='美国'
        )
        
        manifest = Manifest(voyage_no='VOY001', vessel_name='Test', items=[item])
        normalized = normalizer.normalize_manifest(manifest)
        
        assert normalized.items[0].origin_country == 'CN'
        assert normalized.items[0].destination_country == 'US'
    
    def test_normalize_container_no(self):
        normalizer = Normalizer()
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU-123-4567',
            description='测试商品',
            hs_code='3926.9090'
        )
        
        manifest = Manifest(voyage_no='VOY001', vessel_name='Test', items=[item])
        normalized = normalizer.normalize_manifest(manifest)
        
        assert normalized.items[0].container_no == 'MSKU1234567'
    
    def test_invalid_hs_code_error(self):
        normalizer = Normalizer()
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code='123'
        )
        
        manifest = Manifest(voyage_no='VOY001', vessel_name='Test', items=[item])
        normalizer.normalize_manifest(manifest)
        
        errors = normalizer.get_errors()
        assert len(errors) == 1
        assert errors[0].error_type == ValidationErrorType.INVALID_HS_CODE
        assert errors[0].risk_level == RiskLevel.HIGH
