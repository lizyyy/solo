import pytest
import hashlib
from pathlib import Path
from litigation_precheck.scanner import FileScanner, FileInfo, Manifest, ManifestManager


class TestScanner:
    def test_calculate_file_hash(self, tmp_path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("test content")
        
        hash_result = FileScanner.calculate_file_hash(test_file)
        
        expected = hashlib.sha256(b"test content").hexdigest()
        assert hash_result == expected
    
    def test_extract_evidence_number(self):
        scanner = FileScanner({})
        
        assert scanner._extract_evidence_number("证据01-合同.pdf") == 1
        assert scanner._extract_evidence_number("证据2_转账.pdf") == 2
        assert scanner._extract_evidence_number("证据123_凭证.pdf") == 123
        assert scanner._extract_evidence_number("01-合同.pdf") == 1
        assert scanner._extract_evidence_number("起诉状.pdf") is None
    
    def test_extract_evidence_number_chinese(self):
        scanner = FileScanner({})
        
        assert scanner._extract_evidence_number("证据一合同.pdf") == 1
        assert scanner._extract_evidence_number("证据二_转账.pdf") == 2
        assert scanner._extract_evidence_number("证据十_凭证.pdf") == 10
        assert scanner._extract_evidence_number("证据十二_说明.pdf") == 12
    
    def test_detect_material_type(self):
        scanner = FileScanner({})
        
        assert scanner._detect_material_type("起诉状.pdf") == "COMPLAINT"
        assert scanner._detect_material_type("授权委托书.pdf") == "POA"
        assert scanner._detect_material_type("证据目录.csv") == "EVIDENCE_LIST"
        assert scanner._detect_material_type("证据01-合同.pdf") == "EVIDENCE"
        assert scanner._detect_material_type("送达地址确认书.pdf") == "ADDRESS_CONFIRM"
        assert scanner._detect_material_type("身份证.pdf") == "IDENTITY"
        assert scanner._detect_material_type("unknown.txt") is None
    
    def test_scan_directory(self, tmp_path):
        materials_dir = tmp_path / "materials"
        materials_dir.mkdir()
        
        (materials_dir / "起诉状.pdf").write_text("test")
        (materials_dir / "证据01-合同.pdf").write_text("test")
        (materials_dir / "证据目录.csv").write_text("test")
        
        scanner = FileScanner({
            "allowed_extensions": [".pdf", ".PDF", ".csv", ".CSV"],
            "ignore_patterns": [".DS_Store"],
            "recursive": True
        })
        
        manifest = scanner.scan_directory(materials_dir)
        
        assert manifest.total_files == 3
        assert manifest.total_size > 0
        
        file_names = {f.file_name for f in manifest.files}
        assert "起诉状.pdf" in file_names
        assert "证据01-合同.pdf" in file_names
        assert "证据目录.csv" in file_names
    
    def test_manifest_save_load(self, tmp_path):
        manifest = Manifest(
            scan_time="2024-01-01T00:00:00",
            total_files=2,
            total_size=100,
            files=[
                FileInfo(
                    file_path="test1.pdf",
                    file_name="test1.pdf",
                    extension=".pdf",
                    file_size=50,
                    created_time="2024-01-01",
                    modified_time="2024-01-01",
                    file_hash="abc123"
                ),
                FileInfo(
                    file_path="test2.pdf",
                    file_name="test2.pdf",
                    extension=".pdf",
                    file_size=50,
                    created_time="2024-01-01",
                    modified_time="2024-01-01",
                    file_hash="def456"
                )
            ],
            directories=["subdir"],
            scan_config={"recursive": True}
        )
        
        manifest_path = tmp_path / "manifest.json"
        ManifestManager.save_manifest(manifest, manifest_path)
        
        loaded = ManifestManager.load_manifest(manifest_path)
        
        assert loaded.total_files == 2
        assert len(loaded.files) == 2
        assert loaded.files[0].file_name == "test1.pdf"
        assert loaded.files[1].file_hash == "def456"
