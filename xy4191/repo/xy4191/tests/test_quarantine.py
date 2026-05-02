import json
import shutil
from pathlib import Path

import pytest

from release_validator.quarantine import QuarantineManager, QuarantineEntry


class TestQuarantineManager:
    def test_init(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        qm = QuarantineManager(quarantine_base)
        
        assert qm.quarantine_base == quarantine_base
        assert qm.entries == []
    
    def test_quarantine_file(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        source_file = temp_dir / "test.txt"
        source_file.write_text("test content")
        
        qm = QuarantineManager(quarantine_base)
        quarantined_path = qm.quarantine(
            source_path=source_file,
            reason="Test quarantine",
            category="test",
            original_base=temp_dir,
        )
        
        assert quarantined_path is not None
        assert quarantined_path.exists()
        assert len(qm.entries) == 1
        assert qm.entries[0].reason == "Test quarantine"
        assert qm.entries[0].category == "test"
    
    def test_quarantine_nonexistent_file(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        source_file = temp_dir / "nonexistent.txt"
        
        qm = QuarantineManager(quarantine_base)
        quarantined_path = qm.quarantine(
            source_path=source_file,
            reason="Test",
            category="test",
        )
        
        assert quarantined_path is None
        assert len(qm.entries) == 0
    
    def test_restore_file(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        source_file = temp_dir / "test.txt"
        original_content = "original content"
        source_file.write_text(original_content)
        
        qm = QuarantineManager(quarantine_base)
        qm.quarantine(
            source_path=source_file,
            reason="Test",
            category="test",
        )
        
        source_file.unlink()
        
        entry = qm.entries[0]
        success = qm.restore(entry.id)
        
        assert success is True
        assert source_file.exists()
        assert source_file.read_text() == original_content
    
    def test_remove_file(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        source_file = temp_dir / "test.txt"
        source_file.write_text("content")
        
        qm = QuarantineManager(quarantine_base)
        qm.quarantine(
            source_path=source_file,
            reason="Test",
            category="test",
        )
        
        entry = qm.entries[0]
        quarantined_path = Path(entry.quarantined_path)
        
        success = qm.remove(entry.id)
        
        assert success is True
        assert quarantined_path.exists() is False
        assert len(qm.entries) == 0
    
    def test_list_entries(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        
        file1 = temp_dir / "file1.txt"
        file1.write_text("content1")
        
        file2 = temp_dir / "file2.txt"
        file2.write_text("content2")
        
        qm = QuarantineManager(quarantine_base)
        qm.quarantine(file1, "reason1", "category1")
        qm.quarantine(file2, "reason2", "category2")
        
        assert len(qm.list_entries()) == 2
        assert len(qm.list_entries(category="category1")) == 1
        assert len(qm.list_entries(category="category2")) == 1
    
    def test_get_manifest_path(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        qm = QuarantineManager(quarantine_base)
        
        manifest_path = qm.get_manifest_path()
        
        assert manifest_path == quarantine_base / "manifest.json"
    
    def test_get_summary(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        
        file1 = temp_dir / "file1.txt"
        file1.write_text("content1")
        
        qm = QuarantineManager(quarantine_base)
        qm.quarantine(file1, "reason", "category")
        
        summary = qm.get_summary()
        
        assert summary["total_entries"] == 1
        assert summary["categories"] == {"category": 1}
        assert "quarantine_base" in summary
    
    def test_persist_manifest(self, temp_dir):
        quarantine_base = temp_dir / ".quarantine"
        
        file1 = temp_dir / "file1.txt"
        file1.write_text("content1")
        
        qm1 = QuarantineManager(quarantine_base)
        qm1.quarantine(file1, "reason", "category")
        
        qm2 = QuarantineManager(quarantine_base)
        
        assert len(qm2.entries) == 1
        assert qm2.entries[0].reason == "reason"
