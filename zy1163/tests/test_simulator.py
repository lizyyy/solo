import pytest

from asyncio_diagnose.importer import DataImporter
from asyncio_diagnose.simulator import Simulator


class TestSimulator:
    def test_reset(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        state = simulator.get_simulated_state()
        assert len(state["tasks"]) == 3
        assert state["trace_count"] == 0

    def test_replay(self, temp_event_trace, sample_cancel_not_working_events):
        file_path = temp_event_trace(sample_cancel_not_working_events)
        
        importer = DataImporter()
        importer.import_event_loop_trace(file_path)
        
        simulator = Simulator(importer)
        events = simulator.replay()
        
        assert len(events) == 5
        for event in events:
            assert "task_id" in event
            assert "event_type" in event

    def test_replay_with_steps(self, temp_event_trace, sample_cancel_not_working_events):
        file_path = temp_event_trace(sample_cancel_not_working_events)
        
        importer = DataImporter()
        importer.import_event_loop_trace(file_path)
        
        simulator = Simulator(importer)
        events = simulator.replay(steps=3)
        
        assert len(events) == 3

    def test_simulate_cancel(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        result = simulator.simulate_cancel("task-002")
        
        assert result["task_id"] == "task-002"
        assert result["action"] == "simulate_cancel"
        assert result["result"] == "Cancellation requested"

    def test_simulate_cancel_invalid_task(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        result = simulator.simulate_cancel("non-existent-task")
        
        assert "error" in result

    def test_simulate_timeout(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        result = simulator.simulate_timeout("task-002", timeout_seconds=10.0)
        
        assert result["task_id"] == "task-002"
        assert result["action"] == "simulate_timeout"
        assert "wait_chain" in result
        assert "affected_tasks" in result

    def test_simulate_timeout_invalid_task(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        result = simulator.simulate_timeout("non-existent-task", timeout_seconds=10.0)
        
        assert "error" in result

    def test_get_simulated_state(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        state = simulator.get_simulated_state()
        
        assert "tasks" in state
        assert "trace_count" in state
        assert len(state["tasks"]) == 3
        
        for task in state["tasks"]:
            assert "task_id" in task
            assert "state" in task
            assert "coro_name" in task

    def test_predict_issues(self, temp_task_dump, sample_leak_tasks):
        file_path = temp_task_dump(sample_leak_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        
        result = simulator.predict_issues()
        
        assert "predicted_issues" in result
        assert "long_pending_count" in result
        assert "task_leak_count" in result
        assert "ineffective_cancel_count" in result
        assert "details" in result

    def test_simulated_state_after_cancel(self, temp_task_dump, sample_tasks):
        file_path = temp_task_dump(sample_tasks)
        
        importer = DataImporter()
        importer.import_task_dump(file_path)
        
        simulator = Simulator(importer)
        simulator.reset()
        simulator.simulate_cancel("task-002")
        
        state = simulator.get_simulated_state()
        cancelled_task = next(
            (t for t in state["tasks"] if t["task_id"] == "task-002"),
            None
        )
        
        assert cancelled_task is not None
        assert cancelled_task["cancel_requested"] is True
