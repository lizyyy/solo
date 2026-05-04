from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum
from app.core.model_simulator import model_simulator, SamplingType
from app.core.tokenizer_service import tokenizer_service

router = APIRouter()


class SamplingTypeEnum(str, Enum):
    greedy = "greedy"
    temperature = "temperature"
    top_p = "top_p"
    top_k = "top_k"


class GenerateRequest(BaseModel):
    text: str
    max_new_tokens: int = 50
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 0
    sampling_type: SamplingTypeEnum = SamplingTypeEnum.greedy
    use_kv_cache: bool = True


class AttentionHeatmapRequest(BaseModel):
    text: str


class KVCacheComparisonRequest(BaseModel):
    text: str
    max_new_tokens: int = 20
    iterations: int = 3


@router.post("/generate")
def generate(request: GenerateRequest):
    try:
        tokenized = tokenizer_service.tokenize(request.text, use_hf=True)
        input_ids = tokenized["token_ids"]
        
        if len(input_ids) == 0:
            raise HTTPException(status_code=400, detail="Input text is empty after tokenization")
        
        sampling_type_map = {
            SamplingTypeEnum.greedy: SamplingType.GREEDY,
            SamplingTypeEnum.temperature: SamplingType.TEMPERATURE,
            SamplingTypeEnum.top_p: SamplingType.TOP_P,
            SamplingTypeEnum.top_k: SamplingType.TOP_K,
        }
        
        result = model_simulator.generate(
            input_ids=input_ids,
            input_text=request.text,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            sampling_type=sampling_type_map[request.sampling_type],
            use_kv_cache=request.use_kv_cache
        )
        
        return {
            "success": True,
            "data": {
                "input_text": result.input_text,
                "input_tokens": result.input_tokens,
                "generated_tokens": result.generated_tokens,
                "generated_text": result.generated_text,
                "token_probs": result.token_probs,
                "latency_ms": result.latency_ms,
                "latency_per_token_ms": result.latency_per_token_ms,
                "using_kv_cache": result.using_kv_cache,
                "parameters": result.parameters,
                "risks": result.risks
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/attention-heatmap")
def get_attention_heatmap(request: AttentionHeatmapRequest):
    try:
        tokenized = tokenizer_service.tokenize(request.text, use_hf=True)
        input_ids = tokenized["token_ids"]
        tokens = [t["token"] for t in tokenized["tokens"]]
        
        if len(input_ids) == 0:
            raise HTTPException(status_code=400, detail="Input text is empty after tokenization")
        
        heatmap_data = model_simulator.get_attention_heatmap_data(input_ids)
        
        for layer_data in heatmap_data["layers"]:
            layer_data["tokens"] = tokens
        
        return {
            "success": True,
            "data": {
                **heatmap_data,
                "token_info": tokenized
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get attention heatmap: {str(e)}")


@router.post("/kv-cache-comparison")
def compare_kv_cache(request: KVCacheComparisonRequest):
    try:
        tokenized = tokenizer_service.tokenize(request.text, use_hf=True)
        input_ids = tokenized["token_ids"]
        
        if len(input_ids) == 0:
            raise HTTPException(status_code=400, detail="Input text is empty after tokenization")
        
        results_with_cache = []
        results_without_cache = []
        
        for i in range(request.iterations):
            result_with = model_simulator.generate(
                input_ids=input_ids.copy(),
                input_text=request.text,
                max_new_tokens=request.max_new_tokens,
                temperature=1.0,
                top_p=1.0,
                top_k=0,
                sampling_type=SamplingType.GREEDY,
                use_kv_cache=True
            )
            results_with_cache.append(result_with.latency_ms)
            
            result_without = model_simulator.generate(
                input_ids=input_ids.copy(),
                input_text=request.text,
                max_new_tokens=request.max_new_tokens,
                temperature=1.0,
                top_p=1.0,
                top_k=0,
                sampling_type=SamplingType.GREEDY,
                use_kv_cache=False
            )
            results_without_cache.append(result_without.latency_ms)
        
        import numpy as np
        
        stats_with_cache = {
            "latencies_ms": results_with_cache,
            "mean_ms": float(np.mean(results_with_cache)),
            "std_ms": float(np.std(results_with_cache)),
            "min_ms": float(np.min(results_with_cache)),
            "max_ms": float(np.max(results_with_cache))
        }
        
        stats_without_cache = {
            "latencies_ms": results_without_cache,
            "mean_ms": float(np.mean(results_without_cache)),
            "std_ms": float(np.std(results_without_cache)),
            "min_ms": float(np.min(results_without_cache)),
            "max_ms": float(np.max(results_without_cache))
        }
        
        speedup = stats_without_cache["mean_ms"] / stats_with_cache["mean_ms"]
        
        return {
            "success": True,
            "data": {
                "input_text": request.text,
                "max_new_tokens": request.max_new_tokens,
                "iterations": request.iterations,
                "with_kv_cache": stats_with_cache,
                "without_kv_cache": stats_without_cache,
                "speedup_ratio": float(speedup),
                "explanation": f"KV Cache 加速了 {speedup:.2f} 倍。原理：首次推理时缓存 Key/Value 状态，后续 token 生成时只需计算当前 token 的注意力，无需重新计算整个序列。"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KV Cache comparison failed: {str(e)}")


@router.post("/sampling-comparison")
def compare_sampling_methods(text: str, max_new_tokens: int = 10):
    try:
        tokenized = tokenizer_service.tokenize(text, use_hf=True)
        input_ids = tokenized["token_ids"]
        
        if len(input_ids) == 0:
            raise HTTPException(status_code=400, detail="Input text is empty after tokenization")
        
        comparisons = []
        
        sampling_configs = [
            {"name": "Greedy Search", "type": SamplingType.GREEDY, "temp": 1.0, "top_p": 1.0, "top_k": 0},
            {"name": "Temperature (0.3)", "type": SamplingType.TEMPERATURE, "temp": 0.3, "top_p": 1.0, "top_k": 0},
            {"name": "Temperature (0.7)", "type": SamplingType.TEMPERATURE, "temp": 0.7, "top_p": 1.0, "top_k": 0},
            {"name": "Temperature (1.5)", "type": SamplingType.TEMPERATURE, "temp": 1.5, "top_p": 1.0, "top_k": 0},
            {"name": "Top-P (0.5)", "type": SamplingType.TOP_P, "temp": 1.0, "top_p": 0.5, "top_k": 0},
            {"name": "Top-P (0.9)", "type": SamplingType.TOP_P, "temp": 1.0, "top_p": 0.9, "top_k": 0},
            {"name": "Top-K (5)", "type": SamplingType.TOP_K, "temp": 1.0, "top_p": 1.0, "top_k": 5},
            {"name": "Top-K (50)", "type": SamplingType.TOP_K, "temp": 1.0, "top_p": 1.0, "top_k": 50},
        ]
        
        for config in sampling_configs:
            result = model_simulator.generate(
                input_ids=input_ids.copy(),
                input_text=text,
                max_new_tokens=max_new_tokens,
                temperature=config["temp"],
                top_p=config["top_p"],
                top_k=config["top_k"],
                sampling_type=config["type"],
                use_kv_cache=True
            )
            
            comparisons.append({
                "method": config["name"],
                "parameters": {
                    "sampling_type": config["type"].value,
                    "temperature": config["temp"],
                    "top_p": config["top_p"],
                    "top_k": config["top_k"]
                },
                "generated_tokens": result.generated_tokens,
                "token_probs": result.token_probs,
                "risks": result.risks,
                "latency_ms": result.latency_ms
            })
        
        return {
            "success": True,
            "data": {
                "input_text": text,
                "max_new_tokens": max_new_tokens,
                "comparisons": comparisons
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sampling comparison failed: {str(e)}")
