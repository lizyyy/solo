import pytest
import json
import csv
from datetime import date, datetime
from supplier_reconciliation.exporter import ReportExporter
from supplier_reconciliation.history import HistoryManager
from supplier_reconciliation.reconciler import Reconciler
from supplier_reconciliation.models import Document, DocumentType, ReconciliationRun, ReconciliationItem, ReconciliationStatus


class TestReportExporter:
    def test_export_json(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        exporter = ReportExporter(output_dir=str(temp_dir))
        path = exporter.export_json(run)
        
        assert path.endswith(".json")
        
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        assert data["run_id"] == run.run_id
        assert data["period"] == run.period
        assert len(data["documents"]) == len(run.documents)
        assert len(data["results"]) == len(run.results)
    
    def test_export_csv(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        exporter = ReportExporter(output_dir=str(temp_dir))
        path = exporter.export_csv(run)
        
        assert path.endswith(".csv")
        
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        assert len(rows) == len(run.results) + 1
        headers = rows[0]
        assert "凭证类型" in headers
        assert "凭证号" in headers
        assert "状态" in headers
    
    def test_export_summary(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        exporter = ReportExporter(output_dir=str(temp_dir))
        path = exporter.export_summary(run)
        
        assert path.endswith(".txt")
        
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        assert run.run_id in content
        assert "总体统计" in content
        assert "匹配率" in content
    
    def test_export_all(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        exporter = ReportExporter(output_dir=str(temp_dir))
        files = exporter.export_all(run)
        
        assert "json" in files
        assert "csv" in files
        assert "summary" in files
        
        for path in files.values():
            assert temp_dir / path.split("/")[-1] == path or path.startswith(str(temp_dir))


class TestHistoryManager:
    def test_save_and_get_run(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        history = HistoryManager(history_dir=str(temp_dir))
        run_id = history.save_run(run)
        
        assert run_id == run.run_id
        
        retrieved = history.get_run(run_id)
        assert retrieved is not None
        assert retrieved["run_id"] == run.run_id
        assert len(retrieved["documents"]) == len(run.documents)
    
    def test_list_runs(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run1 = reconciler.reconcile(sample_documents)
        run2 = reconciler.reconcile(sample_documents)
        
        history = HistoryManager(history_dir=str(temp_dir))
        history.save_run(run1)
        history.save_run(run2)
        
        runs = history.list_runs(limit=10)
        assert len(runs) == 2
    
    def test_delete_run(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        history = HistoryManager(history_dir=str(temp_dir))
        history.save_run(run)
        
        assert history.get_run(run.run_id) is not None
        
        history.delete_run(run.run_id)
        assert history.get_run(run.run_id) is None
        
        runs = history.list_runs()
        assert len(runs) == 0
    
    def test_get_document_keys(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        history = HistoryManager(history_dir=str(temp_dir))
        history.save_run(run)
        
        keys = history.get_document_keys(run.run_id)
        assert len(keys) == len(sample_documents)
        assert all(":" in k for k in keys)
    
    def test_get_previous_run(self, temp_dir, sample_documents):
        reconciler = Reconciler()
        run = reconciler.reconcile(sample_documents)
        
        history = HistoryManager(history_dir=str(temp_dir))
        assert history.get_previous_run() is None
        
        history.save_run(run)
        previous = history.get_previous_run()
        assert previous is not None
        assert previous["run_id"] == run.run_id
