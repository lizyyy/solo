from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import numpy as np
import time
import json
from pathlib import Path
from enum import Enum


class SamplingType(str, Enum):
    GREEDY = "greedy"
    TEMPERATURE = "temperature"
    TOP_P = "top_p"
    TOP_K = "top_k"


@dataclass
class GenerationResult:
    input_tokens: List[int]
    input_text: str
    generated_tokens: List[int]
    generated_text: str
    token_probs: List[Dict[str, float]]
    attention_weights: List[List[List[float]]]
    latency_ms: float
    latency_per_token_ms: List[float]
    using_kv_cache: bool
    parameters: Dict[str, Any]
    risks: List[str] = field(default_factory=list)


@dataclass
class KVCache:
    key_states: List[np.ndarray] = field(default_factory=list)
    value_states: List[np.ndarray] = field(default_factory=list)
    sequence_length: int = 0
    
    def reset(self):
        self.key_states = []
        self.value_states = []
        self.sequence_length = 0
    
    def update(self, new_keys: List[np.ndarray], new_values: List[np.ndarray]):
        if len(self.key_states) == 0:
            self.key_states = new_keys
            self.value_states = new_values
        else:
            for i in range(len(self.key_states)):
                self.key_states[i] = np.concatenate([self.key_states[i], new_keys[i]], axis=1)
                self.value_states[i] = np.concatenate([self.value_states[i], new_values[i]], axis=1)
        self.sequence_length = self.key_states[0].shape[1]


class ModelSimulator:
    def __init__(self, vocab_size: int = 50257, num_layers: int = 12, 
                 num_heads: int = 12, hidden_size: int = 768):
        self.vocab_size = vocab_size
        self.num_layers = num_layers
        self.num_heads = num_heads
        self.hidden_size = hidden_size
        self.head_dim = hidden_size // num_heads
        
        np.random.seed(42)
        self._initialize_weights()
        
        self.kv_cache = KVCache()
    
    def _initialize_weights(self):
        self.embedding = np.random.randn(self.vocab_size, self.hidden_size) * 0.02
        self.positional_encoding = np.random.randn(4096, self.hidden_size) * 0.02
        
        self.attention_weights = []
        self.ffn_weights = []
        
        for _ in range(self.num_layers):
            self.attention_weights.append({
                "q_proj": np.random.randn(self.hidden_size, self.hidden_size) * 0.02,
                "k_proj": np.random.randn(self.hidden_size, self.hidden_size) * 0.02,
                "v_proj": np.random.randn(self.hidden_size, self.hidden_size) * 0.02,
                "out_proj": np.random.randn(self.hidden_size, self.hidden_size) * 0.02
            })
            
            self.ffn_weights.append({
                "fc1": np.random.randn(self.hidden_size, self.hidden_size * 4) * 0.02,
                "fc2": np.random.randn(self.hidden_size * 4, self.hidden_size) * 0.02
            })
        
        self.lm_head = np.random.randn(self.hidden_size, self.vocab_size) * 0.02
    
    def _softmax(self, x: np.ndarray, axis: int = -1) -> np.ndarray:
        x_max = np.max(x, axis=axis, keepdims=True)
        exp_x = np.exp(x - x_max)
        return exp_x / np.sum(exp_x, axis=axis, keepdims=True)
    
    def _layer_norm(self, x: np.ndarray, eps: float = 1e-5) -> np.ndarray:
        mean = np.mean(x, axis=-1, keepdims=True)
        var = np.var(x, axis=-1, keepdims=True)
        return (x - mean) / np.sqrt(var + eps)
    
    def _gelu(self, x: np.ndarray) -> np.ndarray:
        return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * np.power(x, 3))))
    
    def _compute_attention(self, hidden_states: np.ndarray, layer_idx: int,
                           use_cache: bool = False, is_prefill: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        batch_size, seq_length, _ = hidden_states.shape
        
        attn_weights = self.attention_weights[layer_idx]
        
        if use_cache and not is_prefill and len(self.kv_cache.key_states) > 0:
            q = hidden_states @ attn_weights["q_proj"]
            k = hidden_states @ attn_weights["k_proj"]
            v = hidden_states @ attn_weights["v_proj"]
            
            q = q.reshape(batch_size, -1, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
            k = k.reshape(batch_size, -1, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
            v = v.reshape(batch_size, -1, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
            
            self.kv_cache.update([k], [v])
            
            k_cached = self.kv_cache.key_states[0]
            v_cached = self.kv_cache.value_states[0]
            
            attn_scores = q @ k_cached.transpose(-2, -1) / np.sqrt(self.head_dim)
            
            mask = np.triu(np.ones((1, 1, seq_length, self.kv_cache.sequence_length)), k=1)
            mask = (mask == 0).astype(float)
            attn_scores = attn_scores * mask + (1 - mask) * (-1e10)
        else:
            q = hidden_states @ attn_weights["q_proj"]
            k = hidden_states @ attn_weights["k_proj"]
            v = hidden_states @ attn_weights["v_proj"]
            
            q = q.reshape(batch_size, seq_length, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
            k = k.reshape(batch_size, seq_length, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
            v = v.reshape(batch_size, seq_length, self.num_heads, self.head_dim).transpose(0, 2, 1, 3)
            
            if use_cache and is_prefill:
                self.kv_cache.update([k], [v])
            
            attn_scores = q @ k.transpose(-2, -1) / np.sqrt(self.head_dim)
            
            mask = np.triu(np.ones((1, 1, seq_length, seq_length)), k=1)
            mask = (mask == 0).astype(float)
            attn_scores = attn_scores * mask + (1 - mask) * (-1e10)
        
        attn_probs = self._softmax(attn_scores, axis=-1)
        attn_output = attn_probs @ v
        
        attn_output = attn_output.transpose(0, 2, 1, 3).reshape(batch_size, seq_length, self.hidden_size)
        attn_output = attn_output @ attn_weights["out_proj"]
        
        return attn_output, attn_probs
    
    def _forward_layer(self, hidden_states: np.ndarray, layer_idx: int,
                       use_cache: bool = False, is_prefill: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        residual = hidden_states
        hidden_states = self._layer_norm(hidden_states)
        
        attn_output, attn_probs = self._compute_attention(
            hidden_states, layer_idx, use_cache, is_prefill
        )
        hidden_states = residual + attn_output
        
        residual = hidden_states
        hidden_states = self._layer_norm(hidden_states)
        
        ffn_weights = self.ffn_weights[layer_idx]
        hidden_states = hidden_states @ ffn_weights["fc1"]
        hidden_states = self._gelu(hidden_states)
        hidden_states = hidden_states @ ffn_weights["fc2"]
        
        hidden_states = residual + hidden_states
        
        return hidden_states, attn_probs
    
    def _forward(self, input_ids: List[int], use_cache: bool = False,
                 is_prefill: bool = True) -> Tuple[np.ndarray, List[np.ndarray]]:
        seq_length = len(input_ids)
        
        input_ids_arr = np.array(input_ids).reshape(1, seq_length)
        
        hidden_states = self.embedding[input_ids_arr] + self.positional_encoding[:seq_length]
        
        all_attention_probs = []
        
        for layer_idx in range(self.num_layers):
            hidden_states, attn_probs = self._forward_layer(
                hidden_states, layer_idx, use_cache, is_prefill
            )
            all_attention_probs.append(attn_probs)
        
        hidden_states = self._layer_norm(hidden_states)
        
        logits = hidden_states @ self.lm_head
        
        return logits, all_attention_probs
    
    def _sample_token(self, logits: np.ndarray, temperature: float = 1.0,
                      top_p: float = 1.0, top_k: int = 0,
                      sampling_type: SamplingType = SamplingType.GREEDY) -> Tuple[int, Dict[str, float]]:
        logits = logits.flatten()
        
        if sampling_type == SamplingType.GREEDY:
            token_id = int(np.argmax(logits))
            probs = self._softmax(logits)
            return token_id, {str(token_id): float(probs[token_id])}
        
        logits = logits / max(temperature, 1e-8)
        
        if sampling_type == SamplingType.TOP_K and top_k > 0:
            top_k = min(top_k, len(logits))
            indices_to_remove = logits < np.sort(logits)[-top_k]
            logits[indices_to_remove] = -float('inf')
        
        if sampling_type in [SamplingType.TOP_P, SamplingType.TEMPERATURE] and top_p < 1.0:
            probs = self._softmax(logits)
            sorted_indices = np.argsort(probs)[::-1]
            sorted_probs = probs[sorted_indices]
            
            cumulative_probs = np.cumsum(sorted_probs)
            indices_to_remove = cumulative_probs > top_p
            indices_to_remove[1:] = indices_to_remove[:-1].copy()
            indices_to_remove[0] = False
            
            logits[sorted_indices[indices_to_remove]] = -float('inf')
        
        probs = self._softmax(logits)
        token_id = int(np.random.choice(len(probs), p=probs))
        
        top_probs = {}
        top_indices = np.argsort(probs)[-5:][::-1]
        for idx in top_indices:
            if probs[idx] > 0.01:
                top_probs[str(int(idx))] = float(probs[idx])
        
        return token_id, top_probs
    
    def generate(self, input_ids: List[int], input_text: str,
                 max_new_tokens: int = 50,
                 temperature: float = 1.0,
                 top_p: float = 1.0,
                 top_k: int = 0,
                 sampling_type: SamplingType = SamplingType.GREEDY,
                 use_kv_cache: bool = True) -> GenerationResult:
        
        start_time = time.time()
        generated_tokens: List[int] = []
        token_probs: List[Dict[str, float]] = []
        all_attention_weights: List[List[List[float]]] = []
        latency_per_token: List[float] = []
        
        self.kv_cache.reset()
        
        _, attention_probs = self._forward(input_ids, use_cache=use_kv_cache, is_prefill=True)
        
        attention_list = []
        for layer_attn in attention_probs:
            layer_attn_np = layer_attn[0].mean(axis=0).tolist()
            attention_list.append(layer_attn_np)
        all_attention_weights.append(attention_list)
        
        current_ids = input_ids.copy()
        
        for step in range(max_new_tokens):
            token_start_time = time.time()
            
            if use_kv_cache and step > 0:
                logits, step_attention = self._forward(
                    [current_ids[-1]], use_cache=True, is_prefill=False
                )
            else:
                logits, step_attention = self._forward(
                    current_ids, use_cache=use_kv_cache, is_prefill=True
                )
            
            next_token_logits = logits[:, -1, :]
            
            next_token_id, next_token_probs = self._sample_token(
                next_token_logits,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                sampling_type=sampling_type
            )
            
            generated_tokens.append(next_token_id)
            token_probs.append(next_token_probs)
            current_ids.append(next_token_id)
            
            token_latency = (time.time() - token_start_time) * 1000
            latency_per_token.append(token_latency)
        
        total_latency = (time.time() - start_time) * 1000
        
        risks = []
        if temperature > 1.5:
            risks.append(f"高温度值 ({temperature}) 可能导致输出随机性过大，产生不连贯内容")
        if temperature < 0.1:
            risks.append(f"低温度值 ({temperature}) 可能导致输出过于确定性，缺乏多样性")
        if top_p < 0.5:
            risks.append(f"低 top_p 值 ({top_p}) 限制了词汇选择范围，可能导致重复输出")
        if max_new_tokens > 500:
            risks.append(f"较长的生成长度 ({max_new_tokens}) 可能导致内容偏离主题或产生幻觉")
        
        if temperature < 0.3 and top_p < 0.7:
            risks.append("保守的采样参数组合可能导致输出过于保守和重复")
        
        return GenerationResult(
            input_tokens=input_ids,
            input_text=input_text,
            generated_tokens=generated_tokens,
            generated_text=f"[模拟生成] {input_text} [继续生成{len(generated_tokens)}个token]",
            token_probs=token_probs,
            attention_weights=all_attention_weights,
            latency_ms=total_latency,
            latency_per_token_ms=latency_per_token,
            using_kv_cache=use_kv_cache,
            parameters={
                "max_new_tokens": max_new_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "top_k": top_k,
                "sampling_type": sampling_type.value
            },
            risks=risks
        )
    
    def get_attention_heatmap_data(self, input_ids: List[int]) -> Dict[str, Any]:
        _, attention_probs = self._forward(input_ids, use_cache=False, is_prefill=True)
        
        layers_data = []
        for layer_idx, layer_attn in enumerate(attention_probs):
            avg_attn = layer_attn[0].mean(axis=0)
            
            tokens = [f"token_{i}" for i in range(len(input_ids))]
            
            layers_data.append({
                "layer": layer_idx,
                "tokens": tokens,
                "attention_matrix": avg_attn.tolist(),
                "max_attention": float(avg_attn.max()),
                "min_attention": float(avg_attn.min())
            })
        
        return {
            "input_token_count": len(input_ids),
            "layers": layers_data,
            "num_layers": self.num_layers,
            "num_heads": self.num_heads
        }


model_simulator = ModelSimulator()
