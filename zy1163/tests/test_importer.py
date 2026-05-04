import pytest

from asyncio_diagnose.importer import DataImporter
from asyncio_diagnose.models import TaskState


class TestDataImporter:
    def test_import_task_dump(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        tasks = importer.import_task_dump(file_path)
        
        assert len(tasks) == 3
        assert "task-001" in tasks
        assert tasks["task-001"].task_id == "task-001"
        assert tasks["task-001"].coro_name == "asyncio_main"
        assert tasks["task-001"].state == TaskState.RUNNING

    def test_import_task_dump_pending_state(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        tasks = importer.import_task_dump(file_path)
        
        assert tasks["task-002"].state == TaskState.PENDING
        assert tasks["task-002"].waiting_on == "task-003"

    def test_import_event_trace(self, temp_event_trace, sample_cancel_not_working_events):
        file_path = temp_event_trace(sample_cancel_not_working_events)
        
        importer = DataImporter()
        traces = importer.import_event_loop_trace(file_path)
        
        assert len(traces) == 5
        assert "bad-cancel-001" in importer.tasks
        
        task = importer.tasks["bad-cancel-001"]
        assert task.cancel_requested is True
        assert task.state == TaskState.RUNNING

    def test_import_await_graph(self, temp_await_graph):
        edges = [
            {
                "from": "task-001",
                "to": "task-002",
                "await_time": "2026-05-05T10:00:00Z"
            },
            {
                "from": "task-002",
                "to": "task-003",
                "await_time": "2026-05-05T10:00:05Z"
            }
        ]
        file_path = temp_await_graph(edges)
        
        importer = DataImporter()
        imported_edges = importer.import_await_graph(file_path)
        
        assert len(imported_edges) == 2
        assert imported_edges[0].from_task == "task-001"
        assert imported_edges[0].to_task == "task-002"

    def test_import_timeout_rules(self, temp_timeout_rules):
        rules = [
            {
                "pattern": "fetch_.*",
                "timeout_seconds": 10.0,
                "description": "API requests"
            },
            {
                "pattern": "query_.*",
                "timeout_seconds": 30.0,
                "description": "DB queries"
            }
        ]
        file_path = temp_timeout_rules(rules)
        
        importer = DataImporter()
        imported_rules = importer.import_timeout_rules(file_path)
        
        assert len(imported_rules) == 2
        assert imported_rules[0].task_pattern == "fetch_.*"
        assert imported_rules[0].timeout_seconds == 10.0

    def test_import_all(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_all(task_dump=file_path)
        
        assert len(importer.tasks) == 3
        assert len(importer.get_all_tasks()) == 3

    def test_get_task(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        task = importer.get_task("task-001")
        assert task is not None
        assert task.task_id == "task-001"
        
        assert importer.get_task("non-existent") is None

    def test_get_all_tasks(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        tasks = importer.get_all_tasks()
        assert len(tasks) == 3
        task_ids = {t.task_id for t in tasks}
        assert "task-001" in task_ids
        assert "task-002" in task_ids
        assert "task-003" in task_ids

    def test_parse_task_state(self):
        importer = DataImporter()
        
        assert importer.parse_task_state("pending") == TaskState.PENDING
        assert importer.parse_task_state("running") == TaskState.RUNNING
        assert importer.parse_task_state("done") == TaskState.DONE
        assert importer.parse_task_state("cancelled") == TaskState.CANCELLED
        assert importer.parse_task_state("cancel_pending") == TaskState.CANCEL_PENDING
        assert importer.parse_task_state("unknown") == TaskState.PENDING

    def test_get_traces_by_task(self, temp_event_trace, sample_cancel_not_working_events):
        file_path = temp_event_trace(sample_cancel_not_working_events)
        
        importer = DataImporter()
        importer.import_event_loop_trace(file_path)
        
        traces = importer.get_traces_by_task("bad-cancel-001")
        assert len(traces) == 5
        
        no_traces = importer.get_traces_by_task("non-existent")
        assert len(no_traces) == 0
