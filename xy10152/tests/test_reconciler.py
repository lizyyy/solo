import pytest
from datetime import date
from supplier_reconciliation.reconciler import Reconciler
from supplier_reconciliation.deduplicator import Deduplicator
from supplier_reconciliation.models import Document, DocumentType, ReconciliationStatus


class TestDeduplicator:
    def test_find_duplicates_exact_match(self):
        docs = [
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
        ]
        
        deduplicator = Deduplicator()
        unique, duplicates = deduplicator.find_duplicates(docs)
        
        assert len(unique) == 1
        assert len(duplicates) == 1
    
    def test_no_duplicates_different_supplier(self):
        docs = [
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-001",
                supplier_id="SUP001",
                supplier_name="测试1",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-001",
                supplier_id="SUP002",
                supplier_name="测试2",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
        ]
        
        deduplicator = Deduplicator()
        unique, duplicates = deduplicator.find_duplicates(docs)
        
        assert len(unique) == 2
        assert len(duplicates) == 0
    
    def test_mark_duplicates(self):
        docs = [
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
        ]
        
        deduplicator = Deduplicator()
        marked = deduplicator.mark_duplicates(docs)
        
        assert marked[0].metadata.get("is_duplicate") is False
        assert marked[1].metadata.get("is_duplicate") is True


class TestReconciler:
    def test_reconcile_exact_match(self, sample_invoice, sample_payment):
        reconciler = Reconciler()
        run = reconciler.reconcile([sample_invoice, sample_payment])
        
        assert run.summary["total_documents"] == 2
        assert run.summary["matched_amount"] == 20000.00
        assert run.summary["match_rate"] == 1.0
        
        matched = [r for r in run.results if r.status == ReconciliationStatus.MATCHED]
        assert len(matched) == 2
    
    def test_reconcile_partial_match(self):
        docs = [
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-PART-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
            Document(
                doc_type=DocumentType.PAYMENT,
                doc_number="PAY-PART-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=6000.00,
                doc_date=date(2025, 4, 10)
            ),
        ]
        
        reconciler = Reconciler()
        run = reconciler.reconcile(docs)
        
        partial = [r for r in run.results if r.status == ReconciliationStatus.PARTIAL]
        assert len(partial) >= 1
    
    def test_reconcile_unmatched(self):
        docs = [
            Document(
                doc_type=DocumentType.INVOICE,
                doc_number="INV-UNMATCH-001",
                supplier_id="SUP001",
                supplier_name="测试",
                amount=10000.00,
                doc_date=date(2025, 3, 15)
            ),
            Document(
                doc_type=DocumentType.PAYMENT,
                doc_number="PAY-UNMATCH-001",
                supplier_id="SUP002",
                supplier_name="其他",
                amount=10000.00,
                doc_date=date(2025, 4, 10)
            ),
        ]
        
        reconciler = Reconciler()
        run = reconciler.reconcile(docs)
        
        unmatched = [r for r in run.results if r.status == ReconciliationStatus.UNMATCHED]
        assert len(unmatched) == 2
    
    def test_summary_by_type(self, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        by_type = run.summary["by_type"]
        assert by_type["invoice"]["count"] == 2
        assert by_type["payment"]["count"] == 2
    
    def test_summary_by_supplier(self, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        by_supplier = run.summary["by_supplier"]
        assert "SUP001" in by_supplier
        assert "SUP002" in by_supplier
    
    def test_period_assignment(self):
        doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-PERIOD-001",
            supplier_id="SUP001",
            supplier_name="测试",
            amount=10000.00,
            doc_date=date(2025, 3, 15)
        )
        
        reconciler = Reconciler()
        run = reconciler.reconcile([doc], period_type="month")
        
        result = run.results[0]
        assert result.period == "2025-03"
    
    def test_aging_days_calculation(self):
        doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-AGING-001",
            supplier_id="SUP001",
            supplier_name="测试",
            amount=10000.00,
            doc_date=date(2025, 1, 1),
            due_date=date(2025, 2, 1)
        )
        
        reconciler = Reconciler()
        run = reconciler.reconcile([doc], as_of_date=date(2025, 5, 1))
        
        result = run.results[0]
        assert result.aging_days == 89
    
    def test_invalid_document_status(self):
        invalid_doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="",
            supplier_id="",
            supplier_name="",
            amount=-100.00,
            doc_date=date(2025, 3, 15)
        )
        invalid_doc.validate()
        
        valid_doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-VALID",
            supplier_id="SUP001",
            supplier_name="测试",
            amount=10000.00,
            doc_date=date(2025, 3, 15)
        )
        
        reconciler = Reconciler()
        run = reconciler.reconcile([invalid_doc, valid_doc])
        
        invalid_result = [r for r in run.results if r.status == ReconciliationStatus.INVALID]
        assert len(invalid_result) == 1
