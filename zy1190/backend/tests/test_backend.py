import pytest
import json
import tempfile
import os
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from benchmark_runner import BenchmarkRunner, BenchmarkConfig, BenchmarkResult
from data_manager import DataManager, Experiment, Comparison
from report_generator import ReportGenerator


class TestBenchmarkConfig:
    def test_default_values(self):
        config = BenchmarkConfig(test_name="sequential")
        assert config.test_name == "sequential"
        assert config.array_size == 67108864
        assert config.stride == 1
        assert config.thread_count == 1
        assert config.cache_line_size == 64
        assert config.iterations == 10
        assert config.seed == 42
        assert config.struct_layout == "bad"
        assert config.numa_node == 0

    def test_to_dict(self):
        config = BenchmarkConfig(
            test_name="stride",
            array_size=134217728,
            stride=16
        )
        d = config.to_dict()
        assert d["test_name"] == "stride"
        assert d["array_size"] == 134217728
        assert d["stride"] == 16

    def test_from_dict(self):
        data = {
            "test_name": "random",
            "array_size": 67108864,
            "seed": 12345
        }
        config = BenchmarkConfig.from_dict(data)
        assert config.test_name == "random"
        assert config.array_size == 67108864
        assert config.seed == 12345


class TestBenchmarkRunner:
    def test_is_engine_available_when_not_exists(self):
        runner = BenchmarkRunner("/nonexistent/path")
        assert runner.is_engine_available() == False

    def test_mock_result_sequential(self):
        runner = BenchmarkRunner("/nonexistent/path")
        config = BenchmarkConfig(
            test_name="sequential",
            array_size=67108864,
            iterations=5
        )
        result = runner._generate_mock_result(config, "test_exp_001")
        
        assert result.test_name == "sequential"
        assert result.avg_latency_ns > 0
        assert result.cache_hits >= 0
        assert result.cache_misses >= 0
        assert len(result.latency_timeline) == 5
        assert result.experiment_id == "test_exp_001"

    def test_mock_result_false_sharing_bad(self):
        runner = BenchmarkRunner("/nonexistent/path")
        config = BenchmarkConfig(
            test_name="false_sharing",
            thread_count=4,
            struct_layout="bad",
            iterations=5
        )
        result = runner._generate_mock_result(config, "test_exp_002")
        
        assert result.test_name == "false_sharing"
        assert result.avg_latency_ns > 50
        assert result.metadata.get("layout_analysis") is not None
        assert result.metadata["layout_analysis"]["layout_type"] == "bad"

    def test_mock_result_false_sharing_good(self):
        runner = BenchmarkRunner("/nonexistent/path")
        config = BenchmarkConfig(
            test_name="false_sharing",
            thread_count=4,
            struct_layout="good",
            iterations=5
        )
        result = runner._generate_mock_result(config, "test_exp_003")
        
        assert result.avg_latency_ns < 20
        assert result.metadata["layout_analysis"]["issue"] == "none"

    def test_mock_result_stride_large(self):
        runner = BenchmarkRunner("/nonexistent/path")
        config = BenchmarkConfig(
            test_name="stride",
            array_size=67108864,
            stride=16,
            iterations=5
        )
        result = runner._generate_mock_result(config, "test_exp_004")
        
        assert result.test_name == "stride"
        assert result.avg_latency_ns > 2
        assert len(result.metadata.get("optimization_suggestions", [])) > 0


class TestDataManager:
    @pytest.fixture
    def temp_data_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_create_experiment(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        experiment = dm.create_experiment(
            name="Test Experiment",
            description="Test description",
            config={"test_name": "sequential", "array_size": 67108864},
            tags=["test", "sequential"]
        )
        
        assert experiment.id.startswith("exp_")
        assert experiment.name == "Test Experiment"
        assert experiment.description == "Test description"
        assert experiment.config["test_name"] == "sequential"
        assert "test" in experiment.tags
        assert experiment.result is None

    def test_get_experiment(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        created = dm.create_experiment(
            name="Test",
            description="",
            config={"test_name": "random"}
        )
        
        retrieved = dm.get_experiment(created.id)
        
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == "Test"

    def test_get_nonexistent_experiment(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        assert dm.get_experiment("nonexistent") is None

    def test_update_experiment_result(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        experiment = dm.create_experiment(
            name="Test",
            description="",
            config={"test_name": "sequential"}
        )
        
        result_data = {
            "test_name": "sequential",
            "total_time_ms": 100.5,
            "avg_latency_ns": 2.5,
            "cache_hits": 1000000,
            "cache_misses": 100000
        }
        
        success = dm.update_experiment_result(experiment.id, result_data)
        
        assert success == True
        
        updated = dm.get_experiment(experiment.id)
        assert updated.result is not None
        assert updated.result["total_time_ms"] == 100.5

    def test_list_experiments(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        for i in range(3):
            dm.create_experiment(
                name=f"Experiment {i}",
                description="",
                config={"test_name": "sequential"}
            )
        
        experiments = dm.list_experiments()
        
        assert len(experiments) == 3
        assert experiments[0]["name"].startswith("Experiment")

    def test_delete_experiment(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        experiment = dm.create_experiment(
            name="To Delete",
            description="",
            config={"test_name": "sequential"}
        )
        
        assert dm.get_experiment(experiment.id) is not None
        
        success = dm.delete_experiment(experiment.id)
        assert success == True
        
        assert dm.get_experiment(experiment.id) is None

    def test_create_comparison(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        comparison = dm.create_comparison(
            name="Test Comparison",
            experiment_ids=["exp_001", "exp_002"],
            metrics=["total_time_ms", "avg_latency_ns"],
            notes="Test notes"
        )
        
        assert comparison.id.startswith("comp_")
        assert comparison.name == "Test Comparison"
        assert len(comparison.experiment_ids) == 2
        assert len(comparison.metrics) == 2


class TestReportGenerator:
    @pytest.fixture
    def temp_data_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_generate_markdown_report_with_result(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        rg = ReportGenerator(dm)
        
        experiment = dm.create_experiment(
            name="Test Experiment",
            description="This is a test experiment",
            config={
                "test_name": "sequential",
                "array_size": 67108864,
                "stride": 1
            }
        )
        
        result_data = {
            "test_name": "sequential",
            "total_time_ms": 100.5,
            "throughput_mbs": 1024.0,
            "avg_latency_ns": 2.5,
            "cache_hits": 8000000,
            "cache_misses": 100000,
            "latency_timeline": [2.4, 2.5, 2.3, 2.6, 2.4],
            "thread_conflicts": [0, 0, 0, 0],
            "metadata": {
                "optimization_suggestions": [
                    "Consider using larger batch sizes"
                ]
            }
        }
        
        dm.update_experiment_result(experiment.id, result_data)
        
        report = rg.generate_markdown_report(experiment.id)
        
        assert "Test Experiment" in report
        assert "This is a test experiment" in report
        assert "Total Time" in report
        assert "100.50 ms" in report
        assert "Hit Rate" in report
        assert "Optimization Suggestions" in report
        assert "Consider using larger batch sizes" in report

    def test_generate_markdown_report_without_result(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        rg = ReportGenerator(dm)
        
        experiment = dm.create_experiment(
            name="Pending Experiment",
            description="Not run yet",
            config={"test_name": "random"}
        )
        
        report = rg.generate_markdown_report(experiment.id)
        
        assert "Pending Experiment" in report
        assert "Not run yet" in report

    def test_generate_markdown_report_nonexistent(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        rg = ReportGenerator(dm)
        
        report = rg.generate_markdown_report("nonexistent")
        
        assert "Error" in report
        assert "Experiment not found" in report


class TestImportWorkload:
    @pytest.fixture
    def temp_data_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_import_single_workload(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        workload_data = {
            "test_name": "stride",
            "array_size": 134217728,
            "stride": 8,
            "name": "Imported Stride Test"
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(workload_data, f)
            temp_path = f.name
        
        try:
            result = dm.import_workload(temp_path)
            
            assert result["type"] == "workload"
            assert result["imported"] == 1
            assert "experiment_id" in result
            
            experiment = dm.get_experiment(result["experiment_id"])
            assert experiment is not None
            assert experiment.name == "Imported Stride Test"
            assert experiment.config["test_name"] == "stride"
            
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_import_workload_file_not_found(self, temp_data_dir):
        dm = DataManager(temp_data_dir)
        
        result = dm.import_workload("/nonexistent/file.json")
        
        assert "error" in result
        assert result["error"] == "File not found"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
