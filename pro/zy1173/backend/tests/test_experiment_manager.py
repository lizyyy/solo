import pytest
import json
from pathlib import Path
from datetime import datetime
from app.core.experiment_manager import (
    ExperimentManager, 
    Experiment, 
    ExperimentType
)


class TestExperiment:
    def test_to_dict(self):
        now = datetime.now()
        experiment = Experiment(
            id="test-123",
            name="Test Experiment",
            type=ExperimentType.INFERENCE,
            created_at=now,
            updated_at=now,
            parameters={"temperature": 0.7},
            results={"generated_tokens": [1, 2, 3]},
            risks=["Test risk"],
            input_data={"text": "Hello"},
            notes="Test notes"
        )
        
        result = experiment.to_dict()
        
        assert result["id"] == "test-123"
        assert result["name"] == "Test Experiment"
        assert result["type"] == "inference"
        assert "created_at" in result
        assert "updated_at" in result
        assert result["parameters"] == {"temperature": 0.7}
        assert result["results"] == {"generated_tokens": [1, 2, 3]}
        assert result["risks"] == ["Test risk"]
        assert result["input_data"] == {"text": "Hello"}
        assert result["notes"] == "Test notes"
    
    def test_from_dict(self):
        now = datetime.now()
        data = {
            "id": "test-456",
            "name": "Another Test",
            "type": "tokenization",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "parameters": {"max_tokens": 100},
            "results": {"token_count": 5},
            "risks": [],
            "input_data": {"text": "Test"},
            "notes": ""
        }
        
        experiment = Experiment.from_dict(data)
        
        assert experiment.id == "test-456"
        assert experiment.name == "Another Test"
        assert experiment.type == ExperimentType.TOKENIZATION
        assert experiment.parameters == {"max_tokens": 100}
        assert experiment.results == {"token_count": 5}
        assert experiment.risks == []


class TestExperimentManager:
    def test_init(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        assert manager.data_dir == temp_data_dir
        assert manager._experiments == {}
    
    def test_create_experiment(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        experiment = manager.create_experiment(
            name="Test Create",
            exp_type=ExperimentType.INFERENCE,
            parameters={"temp": 0.7},
            results={"tokens": [1, 2, 3]},
            risks=["Test risk"],
            input_data={"text": "Hello"},
            notes="Test"
        )
        
        assert experiment.id is not None
        assert experiment.name == "Test Create"
        assert experiment.type == ExperimentType.INFERENCE
        assert experiment.parameters == {"temp": 0.7}
        assert experiment.results == {"tokens": [1, 2, 3]}
        assert experiment.risks == ["Test risk"]
        assert experiment.input_data == {"text": "Hello"}
        assert experiment.notes == "Test"
        
        assert experiment.id in manager._experiments
        
        json_file = temp_data_dir / f"{experiment.id}.json"
        assert json_file.exists()
    
    def test_get_experiment(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        created = manager.create_experiment(
            name="Test Get",
            exp_type=ExperimentType.TOKENIZATION,
            parameters={},
            results={}
        )
        
        retrieved = manager.get_experiment(created.id)
        
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == "Test Get"
    
    def test_get_experiment_not_found(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        result = manager.get_experiment("non-existent-id")
        
        assert result is None
    
    def test_list_experiments_empty(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        result = manager.list_experiments()
        
        assert result["total"] == 0
        assert result["experiments"] == []
    
    def test_list_experiments_with_data(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        for i in range(5):
            manager.create_experiment(
                name=f"Test {i}",
                exp_type=ExperimentType.INFERENCE,
                parameters={},
                results={}
            )
        
        result = manager.list_experiments()
        
        assert result["total"] == 5
        assert len(result["experiments"]) == 5
    
    def test_list_experiments_filter_by_type(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        manager.create_experiment(
            name="Tokenization Test",
            exp_type=ExperimentType.TOKENIZATION,
            parameters={},
            results={}
        )
        manager.create_experiment(
            name="Inference Test",
            exp_type=ExperimentType.INFERENCE,
            parameters={},
            results={}
        )
        
        result = manager.list_experiments(exp_type=ExperimentType.TOKENIZATION)
        
        assert result["total"] == 1
        assert result["experiments"][0]["name"] == "Tokenization Test"
    
    def test_list_experiments_pagination(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        for i in range(10):
            manager.create_experiment(
                name=f"Test {i}",
                exp_type=ExperimentType.INFERENCE,
                parameters={},
                results={}
            )
        
        result = manager.list_experiments(limit=3, offset=3)
        
        assert result["total"] == 10
        assert len(result["experiments"]) == 3
        assert result["limit"] == 3
        assert result["offset"] == 3
    
    def test_update_experiment(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        experiment = manager.create_experiment(
            name="Original Name",
            exp_type=ExperimentType.INFERENCE,
            parameters={"temp": 0.7},
            results={"tokens": [1]}
        )
        
        updated = manager.update_experiment(
            experiment.id,
            name="Updated Name",
            parameters={"temp": 0.5, "top_p": 0.9}
        )
        
        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.parameters == {"temp": 0.5, "top_p": 0.9}
        assert updated.updated_at > experiment.created_at
    
    def test_update_experiment_not_found(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        result = manager.update_experiment(
            "non-existent",
            name="Test"
        )
        
        assert result is None
    
    def test_delete_experiment(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        experiment = manager.create_experiment(
            name="To Delete",
            exp_type=ExperimentType.INFERENCE,
            parameters={},
            results={}
        )
        
        experiment_id = experiment.id
        json_file = temp_data_dir / f"{experiment_id}.json"
        
        assert json_file.exists()
        assert experiment_id in manager._experiments
        
        result = manager.delete_experiment(experiment_id)
        
        assert result == True
        assert experiment_id not in manager._experiments
        assert not json_file.exists()
    
    def test_delete_experiment_not_found(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        result = manager.delete_experiment("non-existent")
        
        assert result == False
    
    def test_export_to_markdown(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        experiment = manager.create_experiment(
            name="Markdown Test",
            exp_type=ExperimentType.INFERENCE,
            parameters={"temperature": 0.7},
            results={"generated_tokens": [1, 2, 3]},
            risks=["Test risk"],
            input_data={"text": "Hello world"},
            notes="Test notes"
        )
        
        markdown = manager.export_to_markdown(experiment.id)
        
        assert markdown is not None
        assert "Markdown Test" in markdown
        assert "temperature" in markdown
        assert "generated_tokens" in markdown
        assert "Test risk" in markdown
        assert "Hello world" in markdown
        assert "Test notes" in markdown
    
    def test_export_to_markdown_not_found(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        result = manager.export_to_markdown("non-existent")
        
        assert result is None
    
    def test_export_to_json(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        experiment = manager.create_experiment(
            name="JSON Test",
            exp_type=ExperimentType.TOKENIZATION,
            parameters={"max_tokens": 100},
            results={"token_count": 5},
            risks=[],
            input_data={}
        )
        
        json_str = manager.export_to_json(experiment.id)
        
        assert json_str is not None
        
        parsed = json.loads(json_str)
        assert parsed["id"] == experiment.id
        assert parsed["name"] == "JSON Test"
        assert parsed["parameters"] == {"max_tokens": 100}
    
    def test_export_to_json_pretty(self, temp_data_dir):
        manager = ExperimentManager(temp_data_dir)
        
        experiment = manager.create_experiment(
            name="Pretty JSON",
            exp_type=ExperimentType.INFERENCE,
            parameters={},
            results={}
        )
        
        pretty = manager.export_to_json(experiment.id, pretty=True)
        compact = manager.export_to_json(experiment.id, pretty=False)
        
        assert len(pretty) >= len(compact)
        assert "\n" in pretty
    
    def test_load_existing_experiments(self, temp_data_dir):
        manager1 = ExperimentManager(temp_data_dir)
        
        manager1.create_experiment(
            name="Persisted",
            exp_type=ExperimentType.INFERENCE,
            parameters={},
            results={}
        )
        
        manager2 = ExperimentManager(temp_data_dir)
        
        result = manager2.list_experiments()
        assert result["total"] == 1
        assert result["experiments"][0]["name"] == "Persisted"
