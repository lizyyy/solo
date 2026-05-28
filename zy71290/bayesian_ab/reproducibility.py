"""可复算性管理 - 确保相同输入产生相同输出"""

import hashlib
import json
import random
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime
from .data_models import ExperimentInput


class ReproducibilityManager:
    """可复算性管理器
    
    负责：
    1. 计算输入哈希，用于唯一标识试验输入
    2. 基于输入哈希生成固定随机种子
    3. 管理全局随机状态
    4. 记录计算轨迹，用于审计和复算
    """

    SEED_SALT = "bayesian_ab_test_2024_v1"

    def __init__(self):
        self._computation_trace: List[Dict[str, Any]] = []
        self._current_seed: Optional[int] = None
        self._input_hash: Optional[str] = None

    def compute_input_hash(self, experiment_input: ExperimentInput) -> str:
        """计算输入的哈希值，确保相同输入得到相同哈希
        
        注意：只哈希对结果有影响的字段，排除时间戳等动态字段
        """
        input_dict = experiment_input.to_dict()
        
        hashable_fields = self._get_hashable_fields(input_dict)
        hashable_json = json.dumps(
            hashable_fields,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False
        )
        
        full_hash = hashlib.sha256(
            (hashable_json + self.SEED_SALT).encode("utf-8")
        ).hexdigest()
        
        self._input_hash = full_hash
        return full_hash

    def _get_hashable_fields(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """提取对计算结果有影响的字段"""
        return {
            "experiment_id": input_dict.get("experiment_id"),
            "control": input_dict.get("control"),
            "treatment": input_dict.get("treatment"),
            "prior": input_dict.get("prior"),
            "observation_window_days": input_dict.get("observation_window_days"),
            "planned_sample_size": input_dict.get("planned_sample_size"),
            "current_day": input_dict.get("current_day"),
            "stopping_threshold": input_dict.get("stopping_threshold"),
            "metrics": input_dict.get("metrics"),
        }

    def generate_seed(self, input_hash: str) -> int:
        """基于输入哈希生成随机种子
        
        使用SHA256的前8字节转换为整数，确保范围在0到2^32-1之间
        """
        seed = int(input_hash[:16], 16) % (2**32)
        self._current_seed = seed
        return seed

    def set_random_state(self, seed: int) -> None:
        """设置全局随机状态"""
        self._current_seed = seed
        random.seed(seed)
        np.random.seed(seed)

    def reset_random_state(self) -> None:
        """重置随机状态为当前种子"""
        if self._current_seed is not None:
            random.seed(self._current_seed)
            np.random.seed(self._current_seed)

    def trace_step(self, step_name: str, inputs: Dict[str, Any], outputs: Dict[str, Any]) -> None:
        """记录计算步骤的输入输出，用于审计和复算"""
        trace_entry = {
            "step": step_name,
            "timestamp": datetime.now().isoformat(),
            "inputs": self._sanitize_for_trace(inputs),
            "outputs": self._sanitize_for_trace(outputs),
            "seed": self._current_seed,
        }
        self._computation_trace.append(trace_entry)

    def _sanitize_for_trace(self, data: Any) -> Any:
        """清理数据以便在轨迹中存储（截断大数组等）"""
        if isinstance(data, dict):
            return {k: self._sanitize_for_trace(v) for k, v in data.items()}
        elif isinstance(data, list):
            if len(data) > 100:
                return [
                    *[self._sanitize_for_trace(item) for item in data[:50]],
                    f"... [truncated, total {len(data)} items]",
                    *[self._sanitize_for_trace(item) for item in data[-50:]],
                ]
            return [self._sanitize_for_trace(item) for item in data]
        elif isinstance(data, np.ndarray):
            if data.size > 100:
                return f"ndarray(shape={data.shape}, dtype={data.dtype}) [truncated for trace]"
            return data.tolist()
        elif isinstance(data, (int, float, str, bool, type(None))):
            return data
        else:
            return str(data)

    def get_trace(self) -> List[Dict[str, Any]]:
        """获取完整计算轨迹"""
        return list(self._computation_trace)

    def get_input_hash(self) -> Optional[str]:
        """获取当前输入哈希"""
        return self._input_hash

    def get_seed(self) -> Optional[int]:
        """获取当前随机种子"""
        return self._current_seed

    def verify_reproducibility(self, other_trace: List[Dict[str, Any]]) -> bool:
        """验证两条计算轨迹是否一致（用于复算验证）"""
        if len(self._computation_trace) != len(other_trace):
            return False
        
        for i, (mine, theirs) in enumerate(zip(self._computation_trace, other_trace)):
            if mine["step"] != theirs["step"]:
                return False
            if mine["seed"] != theirs["seed"]:
                return False
            if mine["inputs"] != theirs["inputs"]:
                return False
            if mine["outputs"] != theirs["outputs"]:
                return False
        
        return True

    def clear_trace(self) -> None:
        """清空计算轨迹"""
        self._computation_trace = []
