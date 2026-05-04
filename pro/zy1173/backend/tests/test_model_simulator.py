import pytest
import numpy as np
from app.core.model_simulator import (
    ModelSimulator, 
    KVCache, 
    SamplingType,
    GenerationResult
)


class TestKVCache:
    def test_init(self):
        cache = KVCache()
        
        assert cache.key_states == []
        assert cache.value_states == []
        assert cache.sequence_length == 0
    
    def test_reset(self):
        cache = KVCache()
        cache.key_states = [np.array([[1, 2], [3, 4]])]
        cache.value_states = [np.array([[5, 6], [7, 8]])]
        cache.sequence_length = 2
        
        cache.reset()
        
        assert cache.key_states == []
        assert cache.value_states == []
        assert cache.sequence_length == 0
    
    def test_update_empty(self):
        cache = KVCache()
        new_keys = [np.array([[[1.0, 2.0], [3.0, 4.0]]])]
        new_values = [np.array([[[5.0, 6.0], [7.0, 8.0]]])]
        
        cache.update(new_keys, new_values)
        
        assert len(cache.key_states) == 1
        assert len(cache.value_states) == 1
        assert cache.sequence_length == 2


class TestModelSimulator:
    def test_init(self):
        model = ModelSimulator()
        
        assert model.vocab_size == 50257
        assert model.num_layers == 12
        assert model.num_heads == 12
        assert model.hidden_size == 768
        assert model.kv_cache is not None
    
    def test_init_custom_params(self):
        model = ModelSimulator(
            vocab_size=1000,
            num_layers=6,
            num_heads=8,
            hidden_size=512
        )
        
        assert model.vocab_size == 1000
        assert model.num_layers == 6
        assert model.num_heads == 8
        assert model.hidden_size == 512
    
    def test_generate_basic(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=5
        )
        
        assert isinstance(result, GenerationResult)
        assert result.input_tokens == [1, 2, 3]
        assert len(result.generated_tokens) == 5
        assert len(result.token_probs) == 5
        assert result.latency_ms > 0
        assert result.using_kv_cache == True
    
    def test_generate_without_kv_cache(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            use_kv_cache=False
        )
        
        assert result.using_kv_cache == False
    
    def test_generate_greedy_sampling(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.GREEDY
        )
        
        assert result.parameters["sampling_type"] == "greedy"
    
    def test_generate_temperature_sampling(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TEMPERATURE,
            temperature=0.7
        )
        
        assert result.parameters["sampling_type"] == "temperature"
        assert result.parameters["temperature"] == 0.7
    
    def test_generate_top_p_sampling(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TOP_P,
            top_p=0.9
        )
        
        assert result.parameters["sampling_type"] == "top_p"
        assert result.parameters["top_p"] == 0.9
    
    def test_generate_top_k_sampling(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TOP_K,
            top_k=50
        )
        
        assert result.parameters["sampling_type"] == "top_k"
        assert result.parameters["top_k"] == 50
    
    def test_get_attention_heatmap_data(self):
        model = ModelSimulator()
        
        result = model.get_attention_heatmap_data([1, 2, 3, 4, 5])
        
        assert "input_token_count" in result
        assert result["input_token_count"] == 5
        assert "layers" in result
        assert len(result["layers"]) == model.num_layers
        assert "num_layers" in result
        assert "num_heads" in result
        
        for layer_data in result["layers"]:
            assert "layer" in layer_data
            assert "tokens" in layer_data
            assert "attention_matrix" in layer_data
            assert "max_attention" in layer_data
            assert "min_attention" in layer_data
            
            matrix = layer_data["attention_matrix"]
            assert len(matrix) == 5
            assert len(matrix[0]) == 5


class TestGenerationRisks:
    def test_high_temperature_risk(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TEMPERATURE,
            temperature=2.0
        )
        
        risk_found = any("高温度" in risk for risk in result.risks)
        assert risk_found
    
    def test_low_temperature_risk(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TEMPERATURE,
            temperature=0.05
        )
        
        risk_found = any("低温度" in risk for risk in result.risks)
        assert risk_found
    
    def test_low_top_p_risk(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TOP_P,
            top_p=0.3
        )
        
        risk_found = any("低 top_p" in risk for risk in result.risks)
        assert risk_found
    
    def test_long_generation_risk(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=600
        )
        
        risk_found = any("较长的生成长度" in risk for risk in result.risks)
        assert risk_found
    
    def test_conservative_params_risk(self):
        model = ModelSimulator()
        
        result = model.generate(
            input_ids=[1, 2, 3],
            input_text="Test",
            max_new_tokens=3,
            sampling_type=SamplingType.TEMPERATURE,
            temperature=0.2,
            top_p=0.5
        )
        
        risk_found = any("保守的采样参数" in risk for risk in result.risks)
        assert risk_found


class TestSoftmax:
    def test_softmax_basic(self):
        model = ModelSimulator()
        x = np.array([[1.0, 2.0, 3.0]])
        
        result = model._softmax(x)
        
        assert result.shape == x.shape
        assert np.isclose(np.sum(result), 1.0)
        assert np.all(result >= 0)
        assert np.all(result <= 1)
    
    def test_softmax_zero_values(self):
        model = ModelSimulator()
        x = np.array([[0.0, 0.0, 0.0]])
        
        result = model._softmax(x)
        
        assert np.allclose(result, 1.0 / 3.0)


class TestLayerNorm:
    def test_layer_norm_basic(self):
        model = ModelSimulator()
        x = np.array([[1.0, 2.0, 3.0, 4.0, 5.0]])
        
        result = model._layer_norm(x)
        
        assert result.shape == x.shape
        assert np.isclose(np.mean(result), 0.0, atol=1e-7)
        assert np.isclose(np.var(result), 1.0, atol=1e-7)


class TestGelu:
    def test_gelu_positive(self):
        model = ModelSimulator()
        
        result = model._gelu(np.array([1.0]))
        
        assert result > 0
    
    def test_gelu_negative(self):
        model = ModelSimulator()
        
        result = model._gelu(np.array([-1.0]))
        
        assert result < 0
