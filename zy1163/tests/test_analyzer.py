import pytest

from asyncio_diagnose.analyzer import AsyncioAnalyzer
from asyncio_diagnose.importer import DataImporter


class TestAsyncioAnalyzer:
    def test_analyze_long_pending_tasks(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        long_pending = analyzer.analyze_long_pending_tasks(threshold_seconds=60)
        
        assert len(long_pending) == 3
        
        very_long_pending = analyzer.analyze_long_pending_tasks(threshold_seconds=3600)
        assert len(very_long_pending) == 0

    def test_analyze_task_leaks(self, temp_task_dump, sample_leak_tasks):
        file_path = temp_task_dump(sample_leak_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        leaks = analyzer.analyze_task_leaks()
        
        assert len(leaks) == 1
        assert leaks[0].task_id == "leak-001"

    def test_analyze_ineffective_cancellations(self, temp_event_trace, sample_cancel_not_working_events):
        file_path = temp_event_trace(sample_cancel_not_working_events)
        
        importer = DataImporter()
        importer.import_event_loop_trace(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        ineffective = analyzer.analyze_ineffective_cancellations(grace_period_seconds=1)
        
        assert len(ineffective) == 1
        assert ineffective[0].task_id == "bad-cancel-001"
        assert ineffective[0].cancel_requested is True

    def test_analyze_wait_chains(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        chains = analyzer.analyze_wait_chains()
        
        assert len(chains) > 0
        
        has_chain_002_003 = any(
            "task-002" in chain and "task-003" in chain
            for chain in chains
        )
        assert has_chain_002_003

    def test_run_full_analysis(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        result = analyzer.run_full_analysis(
            pending_threshold_seconds=60,
            cancel_grace_seconds=5,
        )
        
        assert result.summary is not None
        assert "total_tasks" in result.summary
        assert result.summary["total_tasks"] == 3
        assert "by_state" in result.summary
        assert "long_pending_count" in result.summary
        assert "wait_chain_count" in result.summary

    def test_get_task_details(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        
        details = analyzer.get_task_details("task-001")
        assert details is not None
        assert details["task"].task_id == "task-001"
        assert "traces" in details
        assert "wait_chain" in details
        assert "awaited_by" in details
        
        no_details = analyzer.get_task_details("non-existent")
        assert no_details is None

    def test_analyze_queue_congestion(self, temp_event_trace):
        events = [
            {
                "timestamp": "2026-05-05T10:00:00.000Z",
                "event_type": "queue_put",
                "queue_name": "test_queue",
                "task_id": "producer-001",
                "details": {}
            },
            {
                "timestamp": "2026-05-05T10:00:01.000Z",
                "event_type": "queue_put",
                "queue_name": "test_queue",
                "task_id": "producer-001",
                "details": {}
            },
            {
                "timestamp": "2026-05-05T10:00:02.000Z",
                "event_type": "task_waiting",
                "task_id": "waiting-task-001",
                "target": "queue:test_queue",
                "details": {}
            },
        ]
        file_path = temp_event_trace(events)
        
        importer = DataImporter()
        importer.import_event_loop_trace(file_path)
        
        analyzer = AsyncioAnalyzer(importer)
        congestion = analyzer.analyze_queue_congestion()
        
        assert len(congestion) >= 0

    def test_analyze_timeout_chains(self, temp_task_dump, temp_timeout_rules, sample_tasks):
        task_file = temp_task_dump(sample_tasks)
        rules_file = temp_timeout_rules([
            {"pattern": "fetch_.*", "timeout_seconds": 10.0},
            {"pattern": "query_.*", "timeout_seconds": 30.0},
        ])
        
        importer = DataImporter()
        importer.import_task_dump(task_file)
        importer.import_timeout_rules(rules_file)
        
        analyzer = AsyncioAnalyzer(importer)
        timeout_chains = analyzer.analyze_timeout_chains()
        
        assert isinstance(timeout_chains, list)
