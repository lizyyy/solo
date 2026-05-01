import pytest

from src.customs_inspector.reconciler import Reconciler
from src.customs_inspector.models import (
    Manifest, ManifestItem, PackingList, PackingItem,
    ValidationErrorType, RiskLevel
)


class TestReconciler:
    
    def test_multi_ticket_container(self):
        reconciler = Reconciler()
        
        manifest = Manifest(
            voyage_no='VOY001',
            vessel_name='Test',
            items=[
                ManifestItem(
                    ticket_no='TKT001',
                    container_no='MSKU1234567',
                    description='商品A',
                    hs_code='3926.9090',
                    weight=1000.0,
                    volume=10.0
                ),
                ManifestItem(
                    ticket_no='TKT002',
                    container_no='MSKU1234567',
                    description='商品B',
                    hs_code='8517.62',
                    weight=500.0,
                    volume=5.0
                )
            ]
        )
        
        packing_lists = [
            PackingList(
                ticket_no='TKT001',
                items=[
                    PackingItem(
                        ticket_no='TKT001',
                        container_no='MSKU1234567',
                        description='商品A',
                        hs_code='3926.9090',
                        weight=1000.0,
                        volume=10.0
                    )
                ]
            ),
            PackingList(
                ticket_no='TKT002',
                items=[
                    PackingItem(
                        ticket_no='TKT002',
                        container_no='MSKU1234567',
                        description='商品B',
                        hs_code='8517.62',
                        weight=500.0,
                        volume=5.0
                    )
                ]
            )
        ]
        
        reconciliations = reconciler.reconcile(manifest, packing_lists)
        
        assert len(reconciliations) == 1
        rec = reconciliations[0]
        
        assert rec.container_no == 'MSKU1234567'
        assert rec.is_multi_ticket is True
        assert len(rec.ticket_numbers) == 2
        
        multi_ticket_issues = [i for i in rec.issues if i.error_type == ValidationErrorType.MULTI_TICKET_CONTAINER]
        assert len(multi_ticket_issues) == 1
    
    def test_weight_mismatch(self):
        reconciler = Reconciler(tolerance_percent=5.0)
        
        manifest = Manifest(
            voyage_no='VOY001',
            vessel_name='Test',
            items=[
                ManifestItem(
                    ticket_no='TKT001',
                    container_no='MSKU1234567',
                    description='商品A',
                    hs_code='3926.9090',
                    weight=1000.0,
                    volume=10.0
                )
            ]
        )
        
        packing_lists = [
            PackingList(
                ticket_no='TKT001',
                items=[
                    PackingItem(
                        ticket_no='TKT001',
                        container_no='MSKU1234567',
                        description='商品A',
                        hs_code='3926.9090',
                        weight=1200.0,
                        volume=10.0
                    )
                ]
            )
        ]
        
        reconciliations = reconciler.reconcile(manifest, packing_lists)
        
        rec = reconciliations[0]
        weight_mismatch_issues = [i for i in rec.issues if i.error_type == ValidationErrorType.WEIGHT_VOLUME_MISMATCH]
        
        assert len(weight_mismatch_issues) == 1
        assert weight_mismatch_issues[0].risk_level == RiskLevel.HIGH
    
    def test_cancelled_declaration(self):
        reconciler = Reconciler()
        
        manifest = Manifest(
            voyage_no='VOY001',
            vessel_name='Test',
            items=[
                ManifestItem(
                    ticket_no='TKT001',
                    container_no='MSKU1234567',
                    description='商品A',
                    hs_code='3926.9090',
                    weight=1000.0,
                    volume=10.0,
                    is_cancelled=True
                )
            ]
        )
        
        packing_lists = []
        
        reconciler.reconcile(manifest, packing_lists)
        errors = reconciler.get_errors()
        
        cancelled_errors = [e for e in errors if e.error_type == ValidationErrorType.CANCELLED_DECLARATION]
        assert len(cancelled_errors) == 1
        assert cancelled_errors[0].risk_level == RiskLevel.CRITICAL
    
    def test_duplicate_declaration(self):
        reconciler = Reconciler()
        
        manifest = Manifest(
            voyage_no='VOY001',
            vessel_name='Test',
            items=[
                ManifestItem(
                    ticket_no='TKT001',
                    container_no='MSKU1234567',
                    description='商品A',
                    hs_code='3926.9090',
                    weight=1000.0,
                    volume=10.0
                ),
                ManifestItem(
                    ticket_no='TKT001',
                    container_no='MSKU7654321',
                    description='商品B',
                    hs_code='8517.62',
                    weight=500.0,
                    volume=5.0
                )
            ]
        )
        
        packing_lists = []
        
        reconciler.reconcile(manifest, packing_lists)
        errors = reconciler.get_errors()
        
        duplicate_errors = [e for e in errors if e.error_type == ValidationErrorType.DUPLICATE_DECLARATION]
        assert len(duplicate_errors) == 1
