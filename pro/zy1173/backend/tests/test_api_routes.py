import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


class TestHealthCheck:
    def test_health_check(self):
        response = client.get("/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "message" in data


class TestTokenizerRoutes:
    def test_tokenize_valid_text(self):
        response = client.post(
            "/api/tokenizer/tokenize",
            json={"text": "Hello world", "use_hf": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "text" in data["data"]
        assert "tokens" in data["data"]
        assert "token_ids" in data["data"]
        assert "token_count" in data["data"]
        assert "char_count" in data["data"]
        assert data["data"]["text"] == "Hello world"
    
    def test_tokenize_empty_text(self):
        response = client.post(
            "/api/tokenizer/tokenize",
            json={"text": "", "use_hf": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["token_count"] == 0
    
    def test_encode(self):
        response = client.post(
            "/api/tokenizer/encode",
            json={"text": "Hello", "use_hf": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "token_ids" in data["data"]
        assert "token_count" in data["data"]
    
    def test_truncate_needs_truncation(self):
        response = client.post(
            "/api/tokenizer/truncate",
            json={
                "text": "This is a long sentence that needs truncation",
                "max_tokens": 5,
                "truncation_side": "right"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "max_tokens" in data["data"]
    
    def test_get_vocab_size(self):
        response = client.get("/api/tokenizer/vocab-size")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "vocab_size" in data["data"]
        assert "tokenizer_available" in data["data"]


class TestInferenceRoutes:
    def test_generate_basic(self):
        response = client.post(
            "/api/inference/generate",
            json={
                "text": "Hello",
                "max_new_tokens": 3,
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 0,
                "sampling_type": "greedy",
                "use_kv_cache": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "input_text" in data["data"]
        assert "generated_tokens" in data["data"]
        assert "latency_ms" in data["data"]
        assert "parameters" in data["data"]
        assert len(data["data"]["generated_tokens"]) == 3
    
    def test_generate_invalid_sampling_type(self):
        response = client.post(
            "/api/inference/generate",
            json={
                "text": "Hello",
                "max_new_tokens": 3,
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 0,
                "sampling_type": "invalid_type",
                "use_kv_cache": True
            }
        )
        
        assert response.status_code == 422
    
    def test_attention_heatmap(self):
        response = client.post(
            "/api/inference/attention-heatmap",
            json={"text": "Hello world"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "input_token_count" in data["data"]
        assert "layers" in data["data"]
        assert "num_layers" in data["data"]
        assert "num_heads" in data["data"]
    
    def test_attention_heatmap_empty_text(self):
        response = client.post(
            "/api/inference/attention-heatmap",
            json={"text": ""}
        )
        
        assert response.status_code == 400
    
    def test_kv_cache_comparison(self):
        response = client.post(
            "/api/inference/kv-cache-comparison",
            json={
                "text": "This is a test",
                "max_new_tokens": 5,
                "iterations": 2
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "with_kv_cache" in data["data"]
        assert "without_kv_cache" in data["data"]
        assert "speedup_ratio" in data["data"]
        assert "explanation" in data["data"]


class TestExperimentRoutes:
    def test_create_experiment(self):
        response = client.post(
            "/api/experiment/",
            json={
                "name": "API Test Experiment",
                "type": "inference",
                "parameters": {"temperature": 0.7},
                "results": {"tokens": [1, 2, 3]},
                "risks": ["Test risk"],
                "input_data": {"text": "Hello"},
                "notes": "Test notes"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data["data"]
        assert data["data"]["name"] == "API Test Experiment"
        assert data["data"]["type"] == "inference"
        assert data["data"]["parameters"] == {"temperature": 0.7}
        assert data["data"]["results"] == {"tokens": [1, 2, 3]}
        assert data["data"]["risks"] == ["Test risk"]
        assert data["data"]["notes"] == "Test notes"
        
        return data["data"]["id"]
    
    def test_list_experiments(self):
        self.test_create_experiment()
        
        response = client.get("/api/experiment/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "total" in data["data"]
        assert "experiments" in data["data"]
        assert data["data"]["total"] >= 1
    
    def test_get_experiment(self):
        exp_id = self.test_create_experiment()
        
        response = client.get(f"/api/experiment/{exp_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["id"] == exp_id
    
    def test_get_experiment_not_found(self):
        response = client.get("/api/experiment/non-existent-id")
        
        assert response.status_code == 404
    
    def test_update_experiment(self):
        exp_id = self.test_create_experiment()
        
        response = client.put(
            f"/api/experiment/{exp_id}",
            json={"name": "Updated Name"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["name"] == "Updated Name"
    
    def test_delete_experiment(self):
        exp_id = self.test_create_experiment()
        
        response = client.delete(f"/api/experiment/{exp_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        check_response = client.get(f"/api/experiment/{exp_id}")
        assert check_response.status_code == 404
    
    def test_export_markdown(self):
        exp_id = self.test_create_experiment()
        
        response = client.get(f"/api/experiment/{exp_id}/export/markdown")
        
        assert response.status_code == 200
        assert "text/markdown" in response.headers.get("content-type", "")
        assert "API Test Experiment" in response.text
    
    def test_export_json(self):
        exp_id = self.test_create_experiment()
        
        response = client.get(f"/api/experiment/{exp_id}/export/json")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data["data"]


class TestDataRoutes:
    def test_get_all_seed_data(self):
        response = client.get("/api/data/seed/all")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "corpus" in data["data"]
        assert "finetune" in data["data"]
        assert "inference" in data["data"]
        assert "edge_cases" in data["data"]
    
    def test_get_seed_corpus(self):
        response = client.get("/api/data/seed/corpus")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 5
    
    def test_get_seed_finetune(self):
        response = client.get("/api/data/seed/finetune")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 3
    
    def test_get_seed_inference(self):
        response = client.get("/api/data/seed/inference")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 2
    
    def test_get_edge_cases(self):
        response = client.get("/api/data/seed/edge-cases")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 6
        
        edge_case_ids = [item["id"] for item in data["data"]]
        assert "edge-empty" in edge_case_ids
        assert "edge-whitespace" in edge_case_ids
        assert "edge-special" in edge_case_ids
        assert "edge-long" in edge_case_ids
        assert "edge-unicode" in edge_case_ids
        assert "edge-numeric" in edge_case_ids
