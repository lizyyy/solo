"""系统测试 - 验证样本标注返工系统各模块功能"""

import json
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from annotation_rework.storage import AnnotationStore
from annotation_rework.importer import AnnotationImporter, LabelMapper
from annotation_rework.version_diff import VersionDiffer
from annotation_rework.anomaly_detector import AnomalyDetector
from annotation_rework.workflow import AnnotationWorkflow, ReviewAction
from annotation_rework.exporter import AnnotationExporter
from annotation_rework.models import (
    LabelMapping, ExportConfig, SampleStatus, AnomalyType
)


def test_storage():
    """测试存储模块"""
    print("🧪 测试存储模块...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        
        from annotation_rework.models import AnnotationSample, SampleMeta
        sample = AnnotationSample(
            sample_id="test_001",
            content={"text": "测试文本"},
            labels=["positive"],
            status=SampleStatus.ANNOTATED
        )
        
        store.save_sample(sample, "v1")
        loaded = store.get_sample("test_001", "v1")
        assert loaded is not None
        assert loaded.sample_id == "test_001"
        assert loaded.labels == ["positive"]
        print("  ✅ 存储测试通过")


def test_importer():
    """测试导入模块"""
    print("🧪 测试导入模块...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        importer = AnnotationImporter(store)
        
        test_data = [
            {"id": "s001", "text": "好评", "labels": "positive"},
            {"id": "s002", "text": "差评", "labels": "negative"},
        ]
        
        test_file = os.path.join(tmpdir, "test.json")
        with open(test_file, "w") as f:
            json.dump(test_data, f)
        
        v1 = importer.create_version("测试版本")
        count, warnings = importer.import_from_json(test_file, v1, label_field="labels")
        
        assert count == 2
        samples = store.get_all_samples(v1)
        assert len(samples) == 2
        print("  ✅ 导入测试通过")


def test_label_mapper():
    """测试标签映射"""
    print("🧪 测试标签映射...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        importer = AnnotationImporter(store)
        mapper = LabelMapper(store)
        
        test_data = [
            {"id": "s001", "text": "好评", "labels": "正面"},
            {"id": "s002", "text": "差评", "labels": "负面"},
            {"id": "s003", "text": "一般", "labels": "未知标签"},
        ]
        
        test_file = os.path.join(tmpdir, "test.json")
        with open(test_file, "w") as f:
            json.dump(test_data, f)
        
        v1 = importer.create_version("映射测试")
        importer.import_from_json(test_file, v1, label_field="labels")
        
        mapper.add_label_mapping(v1, "正面", "positive")
        mapper.add_label_mapping(v1, "负面", "negative")
        
        updated, warnings = mapper.apply_mappings(v1)
        assert updated == 3
        
        samples = store.get_all_samples(v1)
        label_set = set()
        for s in samples:
            label_set.update(s.labels)
        
        assert "positive" in label_set
        assert "negative" in label_set
        assert len(warnings) == 1
        print("  ✅ 标签映射测试通过")


def test_anomaly_detector():
    """测试异常检测"""
    print("🧪 测试异常检测...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        importer = AnnotationImporter(store)
        detector = AnomalyDetector(store)
        
        test_data = [
            {"id": "s001", "text": "相同文本内容", "labels": ["positive"]},
            {"id": "s002", "text": "相同文本内容", "labels": ["negative"]},
            {"id": "s003", "text": "无标签样本", "labels": []},
            {"id": "s004", "text": "相同文本内容", "labels": ["positive"]},
        ]
        
        test_file = os.path.join(tmpdir, "test.json")
        with open(test_file, "w") as f:
            json.dump(test_data, f)
        
        v1 = importer.create_version("异常测试")
        importer.import_from_json(test_file, v1, label_field="labels")
        
        results = detector.run_all_checks(v1)
        
        assert results["label_missing"] >= 1
        assert results["inconsistent"] >= 1
        assert results["duplicate"] >= 1
        
        summary = detector.get_anomaly_summary(v1)
        assert summary["needs_confirmation_count"] >= 1
        print("  ✅ 异常检测测试通过")


def test_version_diff():
    """测试版本对比"""
    print("🧪 测试版本对比...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        importer = AnnotationImporter(store)
        differ = VersionDiffer(store)
        
        v1_data = [
            {"id": "s001", "text": "文本1", "labels": "positive"},
            {"id": "s002", "text": "文本2", "labels": "negative"},
        ]
        v2_data = [
            {"id": "s001", "text": "文本1", "labels": "negative"},
            {"id": "s003", "text": "文本3", "labels": "neutral"},
        ]
        
        v1_file = os.path.join(tmpdir, "v1.json")
        v2_file = os.path.join(tmpdir, "v2.json")
        with open(v1_file, "w") as f:
            json.dump(v1_data, f)
        with open(v2_file, "w") as f:
            json.dump(v2_data, f)
        
        v1 = importer.create_version("v1")
        v2 = importer.create_version("v2")
        importer.import_from_json(v1_file, v1, label_field="labels")
        importer.import_from_json(v2_file, v2, label_field="labels")
        
        diff = differ.compare_versions(v1, v2)
        assert diff.total_changes >= 3
        assert len(diff.new_samples) == 1
        assert len(diff.removed_samples) == 1
        print("  ✅ 版本对比测试通过")


def test_workflow():
    """测试工作流"""
    print("🧪 测试工作流...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        importer = AnnotationImporter(store)
        workflow = AnnotationWorkflow(store)
        
        test_data = [{"id": "s001", "text": "测试", "labels": "positive"}]
        test_file = os.path.join(tmpdir, "test.json")
        with open(test_file, "w") as f:
            json.dump(test_data, f)
        
        v1 = importer.create_version("工作流测试")
        importer.import_from_json(test_file, v1, label_field="labels")
        
        result = workflow.review_sample(
            v1, "s001", ReviewAction.CONFIRM, reviewer="测试员", comment="确认无误"
        )
        assert result is not None
        assert result.status == SampleStatus.CONFIRMED
        
        history = workflow.get_sample_review_history("s001")
        assert len(history) == 1
        assert history[0]["reviewer"] == "测试员"
        
        summary = workflow.get_workflow_summary(v1)
        assert summary["total_samples"] == 1
        assert summary["confirmed_rate"] == 100.0
        print("  ✅ 工作流测试通过")


def test_exporter():
    """测试导出模块"""
    print("🧪 测试导出模块...")
    with tempfile.TemporaryDirectory() as tmpdir:
        store = AnnotationStore(base_path=tmpdir)
        importer = AnnotationImporter(store)
        exporter = AnnotationExporter(store)
        
        test_data = [
            {"id": "s001", "text": "测试1", "labels": "positive"},
            {"id": "s002", "text": "测试2", "labels": "negative"},
        ]
        test_file = os.path.join(tmpdir, "test.json")
        with open(test_file, "w") as f:
            json.dump(test_data, f)
        
        v1 = importer.create_version("导出测试")
        importer.import_from_json(test_file, v1, label_field="labels")
        
        export_path = os.path.join(tmpdir, "export.json")
        result = exporter.export_samples(v1, export_path, ExportConfig())
        
        assert result.exported_samples == 2
        assert result.total_samples == 2
        assert os.path.exists(export_path)
        
        verify_result = exporter.verify_export_consistency(export_path)
        assert verify_result["valid"] == True
        assert verify_result["sample_count"] == 2
        print("  ✅ 导出模块测试通过")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*60)
    print("  样本标注返工系统 - 单元测试")
    print("="*60 + "\n")
    
    try:
        test_storage()
        test_importer()
        test_label_mapper()
        test_anomaly_detector()
        test_version_diff()
        test_workflow()
        test_exporter()
        
        print("\n" + "="*60)
        print("  ✅ 所有测试通过！")
        print("="*60 + "\n")
        return True
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
