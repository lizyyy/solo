import hashlib
import tempfile
from pathlib import Path

import pytest

from field_sync.models import (
    ConflictItem,
    ConflictType,
    FileInfo,
    FileType,
    Manifest,
    OperationType,
    SourceSide,
    SyncOperation,
    SyncPlan,
    compute_sha256,
    generate_timestamp_id,
)


class TestComputeSha256:
    def test_compute_sha256(self, tmp_path):
        test_file = tmp_path / "test.txt"
        test_content = b"Hello, World!"
        test_file.write_bytes(test_content)
        
        expected_hash = hashlib.sha256(test_content).hexdigest()
        actual_hash = compute_sha256(str(test_file))
        
        assert actual_hash == expected_hash


class TestGenerateTimestampId:
    def test_generate_timestamp_id(self):
        timestamp = generate_timestamp_id()
        assert isinstance(timestamp, str)
        assert len(timestamp) > 0


class TestFileInfo:
    def test_creation(self):
        file_info = FileInfo(
            relative_path="test.jpg",
            absolute_path="/tmp/test.jpg",
            size=1024,
            mtime=1234567890.0,
            sha256="abc123",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        assert file_info.relative_path == "test.jpg"
        assert file_info.size == 1024
        assert file_info.sha256 == "abc123"
    
    def test_to_dict_and_from_dict(self):
        original = FileInfo(
            relative_path="test.jpg",
            absolute_path="/tmp/test.jpg",
            size=1024,
            mtime=1234567890.0,
            sha256="abc123",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
            is_symlink=False,
        )
        
        data = original.to_dict()
        restored = FileInfo.from_dict(data)
        
        assert restored.relative_path == original.relative_path
        assert restored.absolute_path == original.absolute_path
        assert restored.size == original.size
        assert restored.mtime == original.mtime
        assert restored.sha256 == original.sha256
        assert restored.file_type == original.file_type
        assert restored.source_side == original.source_side
    
    def test_get_normalized_path(self):
        file_info = FileInfo(
            relative_path="Test/PHOTO.JPG",
            absolute_path="/tmp/Test/PHOTO.JPG",
            size=0,
            mtime=0.0,
            sha256="",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        assert file_info.get_normalized_path() == "test/photo.jpg"


class TestManifest:
    def test_creation(self):
        manifest = Manifest(
            source_side=SourceSide.LEFT,
            root_dir="/tmp/work",
        )
        
        assert manifest.source_side == SourceSide.LEFT
        assert manifest.root_dir == "/tmp/work"
        assert len(manifest) == 0
    
    def test_add_file(self):
        manifest = Manifest(source_side=SourceSide.LEFT)
        
        file_info = FileInfo(
            relative_path="test.jpg",
            absolute_path="/tmp/test.jpg",
            size=0,
            mtime=0.0,
            sha256="abc123",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        manifest.add_file(file_info)
        
        assert len(manifest) == 1
        assert manifest.get_by_path("test.jpg") is not None
    
    def test_get_by_normalized_path(self):
        manifest = Manifest(source_side=SourceSide.LEFT)
        
        file1 = FileInfo(
            relative_path="test/Photo.JPG",
            absolute_path="/tmp/test/Photo.JPG",
            size=0,
            mtime=0.0,
            sha256="hash1",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        file2 = FileInfo(
            relative_path="test/photo.jpg",
            absolute_path="/tmp/test/photo.jpg",
            size=0,
            mtime=0.0,
            sha256="hash2",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        manifest.add_file(file1)
        manifest.add_file(file2)
        
        result = manifest.get_by_normalized_path("test/photo.jpg")
        assert len(result) == 2
    
    def test_get_by_sha256(self):
        manifest = Manifest(source_side=SourceSide.LEFT)
        
        file1 = FileInfo(
            relative_path="file1.jpg",
            absolute_path="/tmp/file1.jpg",
            size=0,
            mtime=0.0,
            sha256="same_hash",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        file2 = FileInfo(
            relative_path="file2.jpg",
            absolute_path="/tmp/file2.jpg",
            size=0,
            mtime=0.0,
            sha256="same_hash",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        manifest.add_file(file1)
        manifest.add_file(file2)
        
        result = manifest.get_by_sha256("same_hash")
        assert len(result) == 2
    
    def test_save_and_load(self, tmp_path):
        manifest_path = tmp_path / "manifest.json"
        
        original = Manifest(
            source_side=SourceSide.LEFT,
            root_dir="/tmp/work",
        )
        
        file_info = FileInfo(
            relative_path="test.jpg",
            absolute_path="/tmp/work/test.jpg",
            size=1024,
            mtime=1234567890.0,
            sha256="abc123",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        original.add_file(file_info)
        
        original.save(str(manifest_path))
        
        loaded = Manifest.load(str(manifest_path))
        
        assert loaded.source_side == original.source_side
        assert loaded.root_dir == original.root_dir
        assert len(loaded) == len(original)


class TestSyncOperation:
    def test_creation(self):
        op = SyncOperation(
            operation_type=OperationType.COPY_LEFT_TO_RIGHT,
            source_path="/tmp/work/test.jpg",
            target_path="/tmp/backup/test.jpg",
            source_side=SourceSide.LEFT,
            target_side=SourceSide.RIGHT,
            source_sha256="abc123",
            size=1024,
            mtime=1234567890.0,
            description="复制 test.jpg",
        )
        
        assert op.operation_type == OperationType.COPY_LEFT_TO_RIGHT
        assert op.source_sha256 == "abc123"
    
    def test_to_dict_and_from_dict(self):
        original = SyncOperation(
            operation_type=OperationType.COPY_LEFT_TO_RIGHT,
            source_path="/tmp/work/test.jpg",
            target_path="/tmp/backup/test.jpg",
            source_side=SourceSide.LEFT,
            target_side=SourceSide.RIGHT,
            source_sha256="abc123",
            size=1024,
            mtime=1234567890.0,
        )
        
        data = original.to_dict()
        restored = SyncOperation.from_dict(data)
        
        assert restored.operation_type == original.operation_type
        assert restored.source_path == original.source_path
        assert restored.target_path == original.target_path
        assert restored.source_sha256 == original.source_sha256


class TestConflictItem:
    def test_creation(self):
        conflict = ConflictItem(
            conflict_type=ConflictType.SAME_PATH_DIFFERENT_CONTENT,
            suggestion="手动处理内容冲突",
        )
        
        assert conflict.conflict_type == ConflictType.SAME_PATH_DIFFERENT_CONTENT
    
    def test_to_dict_and_from_dict(self):
        left_file = FileInfo(
            relative_path="test.jpg",
            absolute_path="/tmp/work/test.jpg",
            size=100,
            mtime=0.0,
            sha256="hash1",
            file_type=FileType.FILE,
            source_side=SourceSide.LEFT,
        )
        
        right_file = FileInfo(
            relative_path="test.jpg",
            absolute_path="/tmp/backup/test.jpg",
            size=200,
            mtime=0.0,
            sha256="hash2",
            file_type=FileType.FILE,
            source_side=SourceSide.RIGHT,
        )
        
        original = ConflictItem(
            conflict_type=ConflictType.SAME_PATH_DIFFERENT_CONTENT,
            left_file=left_file,
            right_file=right_file,
            details={"size_diff": 100},
            suggestion="手动合并",
        )
        
        data = original.to_dict()
        restored = ConflictItem.from_dict(data)
        
        assert restored.conflict_type == original.conflict_type
        assert restored.left_file is not None
        assert restored.right_file is not None
        assert restored.suggestion == original.suggestion


class TestSyncPlan:
    def test_creation(self):
        plan = SyncPlan()
        
        assert len(plan.operations) == 0
        assert len(plan.conflicts) == 0
        assert not plan.has_conflicts()
    
    def test_has_conflicts(self):
        plan = SyncPlan()
        assert not plan.has_conflicts()
        
        conflict = ConflictItem(
            conflict_type=ConflictType.SAME_PATH_DIFFERENT_CONTENT,
        )
        plan.conflicts.append(conflict)
        
        assert plan.has_conflicts()
        assert plan.get_conflict_count() == 1
    
    def test_save_and_load(self, tmp_path):
        plan_path = tmp_path / "plan.json"
        
        original = SyncPlan()
        
        op = SyncOperation(
            operation_type=OperationType.COPY_LEFT_TO_RIGHT,
            source_path="/tmp/work/test.jpg",
            target_path="/tmp/backup/test.jpg",
            source_sha256="abc123",
        )
        original.operations.append(op)
        
        conflict = ConflictItem(
            conflict_type=ConflictType.SAME_PATH_DIFFERENT_CONTENT,
        )
        original.conflicts.append(conflict)
        
        original.save(str(plan_path))
        
        loaded = SyncPlan.load(str(plan_path))
        
        assert len(loaded.operations) == len(original.operations)
        assert len(loaded.conflicts) == len(original.conflicts)
