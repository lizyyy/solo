import pytest
import tempfile
import shutil
from pathlib import Path
from supplier_reconciliation.importer import FileImporter
from supplier_reconciliation.validator import DataValidator
from supplier_reconciliation.models import DocumentType


class TestFileImporter:
    def test_import_csv_valid(self, sample_csv_file):
        importer = FileImporter(DataValidator())
        docs = importer.import_file(str(sample_csv_file), DocumentType.INVOICE)
        
        assert len(docs) == 3
        assert all(d.is_valid for d in docs)
        assert len(importer.import_errors) == 0
    
    def test_import_csv_columns_normalization(self, temp_dir):
        csv_path = temp_dir / "chinese_cols.csv"
        content = """凭证号,供应商ID,供应商名称,金额,凭证日期,到期日
INV-CH-001,SUP001,中文供应商,5000.00,2025-03-15,2025-04-14
"""
        csv_path.write_text(content, encoding="utf-8")
        
        importer = FileImporter(DataValidator())
        docs = importer.import_file(str(csv_path), DocumentType.INVOICE)
        
        assert len(docs) == 1
        assert docs[0].doc_number == "INV-CH-001"
        assert docs[0].supplier_name == "中文供应商"
        assert docs[0].amount == 5000.00
    
    def test_import_with_errors(self, temp_dir):
        csv_path = temp_dir / "with_errors.csv"
        content = """doc_number,supplier_id,supplier_name,amount,doc_date
INV-ERR-001,,缺少供应商ID,1000.00,2025-03-15
INV-ERR-002,SUP002,缺少金额,abc,2025-03-15
INV-ERR-003,SUP003,无效日期,1000.00,invalid
"""
        csv_path.write_text(content, encoding="utf-8")
        
        importer = FileImporter(DataValidator())
        docs = importer.import_file(str(csv_path), DocumentType.INVOICE)
        
        assert len(docs) == 3
        assert len(importer.import_errors) >= 2
    
    def test_import_file_not_found(self):
        importer = FileImporter()
        with pytest.raises(FileNotFoundError):
            importer.import_file("/nonexistent/file.csv", DocumentType.INVOICE)
    
    def test_import_unsupported_format(self, temp_dir):
        txt_path = temp_dir / "test.txt"
        txt_path.write_text("content")
        
        importer = FileImporter()
        with pytest.raises(ValueError):
            importer.import_file(str(txt_path), DocumentType.INVOICE)
