import json
import time
import hashlib
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import numpy as np

from models import EvidenceRecord, Pose, PathPoint, GridMap
from curvature_constraints import CurvatureCalculation


class ModuleType(Enum):
    CURVATURE_CONSTRAINT = "curvature_constraint"
    PATH_SEARCH = "path_search"
    TRAJECTORY_SMOOTHER = "trajectory_smoother"
    VALIDATOR = "validator"
    INPUT_PARSER = "input_parser"


class OperationType(Enum):
    CURVATURE_FROM_STEERING = "curvature_from_steering"
    STEERING_FROM_CURVATURE = "steering_from_curvature"
    TURNING_RADIUS_CALC = "turning_radius_calc"
    PATH_CURVATURE_CALC = "path_curvature_calc"
    SPEED_FOR_CURVATURE = "speed_for_curvature"
    ARC_FEASIBILITY_CHECK = "arc_feasibility_check"
    NODE_EXPANSION = "node_expansion"
    HEURISTIC_CALC = "heuristic_calc"
    PATH_RECONSTRUCTION = "path_reconstruction"
    SMOOTHING_ITERATION = "smoothing_iteration"
    COLLISION_CHECK = "collision_check"
    CURVATURE_VALIDATION = "curvature_validation"
    SPEED_VALIDATION = "speed_validation"
    INPUT_NORMALIZATION = "input_normalization"


@dataclass
class ChainLink:
    link_id: str
    module: ModuleType
    operation: OperationType
    timestamp: float
    inputs_hash: str
    outputs_hash: str
    parent_link_ids: List[str]
    human_reasoning: str
    raw_data: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "link_id": self.link_id,
            "module": self.module.value,
            "operation": self.operation.value,
            "timestamp": self.timestamp,
            "inputs_hash": self.inputs_hash,
            "outputs_hash": self.outputs_hash,
            "parent_link_ids": self.parent_link_ids,
            "human_reasoning": self.human_reasoning,
            "raw_data": self._serialize_raw_data(),
        }

    def _to_python_type(self, v: Any) -> Any:
        if isinstance(v, np.ndarray):
            return v.tolist()
        elif isinstance(v, (np.bool_, np.int_, np.int64, np.int32)):
            return bool(v) if isinstance(v, np.bool_) else int(v)
        elif isinstance(v, (np.float_, np.float64, np.float32)):
            return float(v)
        elif isinstance(v, dict):
            return {kk: self._to_python_type(vv) for kk, vv in v.items()}
        elif isinstance(v, (list, tuple)):
            return [self._to_python_type(item) for item in v]
        elif isinstance(v, Pose):
            return {"x": v.x, "y": v.y, "theta": v.theta}
        elif isinstance(v, PathPoint):
            return {
                "pose": {"x": v.pose.x, "y": v.pose.y, "theta": v.pose.theta},
                "curvature": v.curvature,
                "speed": v.speed,
                "timestamp": v.timestamp,
            }
        elif isinstance(v, CurvatureCalculation):
            return {
                "formula": v.formula,
                "inputs": self._to_python_type(v.inputs),
                "intermediate": self._to_python_type(v.intermediate),
                "result": float(v.result),
                "boundary_check": self._to_python_type(v.boundary_check),
                "reasoning": v.reasoning,
            }
        elif isinstance(v, (int, float, str, bool)) or v is None:
            return v
        else:
            return str(v)

    def _serialize_raw_data(self) -> Dict[str, Any]:
        result = {}
        for k, v in self.raw_data.items():
            result[k] = self._to_python_type(v)
        return result


class EvidenceChain:
    def __init__(self):
        self._links: List[ChainLink] = []
        self._link_index: Dict[str, ChainLink] = {}
        self._current_operation_context: List[str] = []
        self._input_clues: Dict[str, Any] = {}

    def _generate_id(self, data: Dict[str, Any]) -> str:
        content = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _hash_data(self, data: Dict[str, Any]) -> str:
        content = json.dumps(data, sort_keys=True, default=str)
        return hashlib.md5(content.encode()).hexdigest()

    def record_input_clue(self, clue_name: str, clue_value: Any, source: str = "user") -> ChainLink:
        timestamp = time.time()
        inputs = {"clue_name": clue_name, "clue_value": clue_value, "source": source}
        inputs_hash = self._hash_data(inputs)
        outputs = {"normalized": clue_value}
        outputs_hash = self._hash_data(outputs)

        link_id = self._generate_id({"timestamp": timestamp, "inputs": inputs})

        reasoning = f"接收到{source}提供的线索：{clue_name} = {clue_value}"

        link = ChainLink(
            link_id=link_id,
            module=ModuleType.INPUT_PARSER,
            operation=OperationType.INPUT_NORMALIZATION,
            timestamp=timestamp,
            inputs_hash=inputs_hash,
            outputs_hash=outputs_hash,
            parent_link_ids=[],
            human_reasoning=reasoning,
            raw_data={"inputs": inputs, "outputs": outputs},
        )

        self._add_link(link)
        self._input_clues[clue_name] = clue_value
        return link

    def record_curvature_calculation(
        self,
        operation: OperationType,
        calc: CurvatureCalculation,
        parent_link_ids: Optional[List[str]] = None,
    ) -> ChainLink:
        timestamp = time.time()
        inputs = calc.inputs
        inputs_hash = self._hash_data(inputs)
        outputs = {"result": calc.result, "boundary_check": calc.boundary_check}
        outputs_hash = self._hash_data(outputs)

        link_id = self._generate_id({"timestamp": timestamp, "inputs": inputs, "formula": calc.formula})

        parents = parent_link_ids or self._current_operation_context[-1:] if self._current_operation_context else []

        link = ChainLink(
            link_id=link_id,
            module=ModuleType.CURVATURE_CONSTRAINT,
            operation=operation,
            timestamp=timestamp,
            inputs_hash=inputs_hash,
            outputs_hash=outputs_hash,
            parent_link_ids=parents,
            human_reasoning=calc.reasoning,
            raw_data={
                "inputs": inputs,
                "intermediate": calc.intermediate,
                "outputs": outputs,
                "formula": calc.formula,
                "units": calc.units,
                "calculation": calc,
            },
        )

        self._add_link(link)
        return link

    def record_path_search_operation(
        self,
        operation: OperationType,
        inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        reasoning: str,
        parent_link_ids: Optional[List[str]] = None,
    ) -> ChainLink:
        timestamp = time.time()
        inputs_hash = self._hash_data(inputs)
        outputs_hash = self._hash_data(outputs)

        link_id = self._generate_id({"timestamp": timestamp, "inputs": inputs, "operation": operation.value})

        parents = parent_link_ids or self._current_operation_context[-1:] if self._current_operation_context else []

        link = ChainLink(
            link_id=link_id,
            module=ModuleType.PATH_SEARCH,
            operation=operation,
            timestamp=timestamp,
            inputs_hash=inputs_hash,
            outputs_hash=outputs_hash,
            parent_link_ids=parents,
            human_reasoning=reasoning,
            raw_data={"inputs": inputs, "outputs": outputs},
        )

        self._add_link(link)
        return link

    def record_smoothing_operation(
        self,
        iteration: int,
        inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        reasoning: str,
        parent_link_ids: Optional[List[str]] = None,
    ) -> ChainLink:
        timestamp = time.time()
        inputs_hash = self._hash_data(inputs)
        outputs_hash = self._hash_data(outputs)

        link_id = self._generate_id({"timestamp": timestamp, "iteration": iteration, "inputs": inputs})

        parents = parent_link_ids or self._current_operation_context[-1:] if self._current_operation_context else []

        link = ChainLink(
            link_id=link_id,
            module=ModuleType.TRAJECTORY_SMOOTHER,
            operation=OperationType.SMOOTHING_ITERATION,
            timestamp=timestamp,
            inputs_hash=inputs_hash,
            outputs_hash=outputs_hash,
            parent_link_ids=parents,
            human_reasoning=f"第{iteration}次平滑：{reasoning}",
            raw_data={"iteration": iteration, "inputs": inputs, "outputs": outputs},
        )

        self._add_link(link)
        return link

    def record_validation_operation(
        self,
        operation: OperationType,
        inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        reasoning: str,
        parent_link_ids: Optional[List[str]] = None,
    ) -> ChainLink:
        timestamp = time.time()
        inputs_hash = self._hash_data(inputs)
        outputs_hash = self._hash_data(outputs)

        link_id = self._generate_id({"timestamp": timestamp, "inputs": inputs, "operation": operation.value})

        parents = parent_link_ids or self._current_operation_context[-1:] if self._current_operation_context else []

        link = ChainLink(
            link_id=link_id,
            module=ModuleType.VALIDATOR,
            operation=operation,
            timestamp=timestamp,
            inputs_hash=inputs_hash,
            outputs_hash=outputs_hash,
            parent_link_ids=parents,
            human_reasoning=reasoning,
            raw_data={"inputs": inputs, "outputs": outputs},
        )

        self._add_link(link)
        return link

    def _add_link(self, link: ChainLink) -> None:
        self._links.append(link)
        self._link_index[link.link_id] = link
        self._current_operation_context.append(link.link_id)

    def push_context(self, link_id: str) -> None:
        if link_id in self._link_index:
            self._current_operation_context.append(link_id)

    def pop_context(self) -> Optional[str]:
        if self._current_operation_context:
            return self._current_operation_context.pop()
        return None

    def get_chain_summary(self) -> Dict[str, Any]:
        module_counts = {}
        for link in self._links:
            mod = link.module.value
            module_counts[mod] = module_counts.get(mod, 0) + 1

        violation_links = [
            link for link in self._links
            if "超过" in link.human_reasoning or "不可行" in link.human_reasoning
            or "碰撞" in link.human_reasoning or "超限" in link.human_reasoning
        ]

        return {
            "total_links": len(self._links),
            "module_distribution": module_counts,
            "input_clues": self._input_clues,
            "violation_count": len(violation_links),
            "violation_links": [
                {"link_id": l.link_id, "reasoning": l.human_reasoning}
                for l in violation_links
            ],
        }

    def trace_back_from(self, link_id: str, max_depth: int = 50) -> List[ChainLink]:
        chain = []
        visited = set()
        current_ids = [link_id]
        depth = 0

        while current_ids and depth < max_depth:
            next_ids = []
            for cid in current_ids:
                if cid in visited or cid not in self._link_index:
                    continue
                visited.add(cid)
                link = self._link_index[cid]
                chain.append(link)
                next_ids.extend(link.parent_link_ids)
            current_ids = next_ids
            depth += 1

        return chain

    def get_links_by_module(self, module: ModuleType) -> List[ChainLink]:
        return [l for l in self._links if l.module == module]

    def get_links_by_operation(self, operation: OperationType) -> List[ChainLink]:
        return [l for l in self._links if l.operation == operation]

    def get_curvature_violations(self) -> List[ChainLink]:
        return [
            l for l in self._links
            if l.module == ModuleType.CURVATURE_CONSTRAINT
            and l.raw_data.get("outputs", {}).get("boundary_check", {}).get("curvature_within_limit") is False
        ]

    def get_collision_violations(self) -> List[ChainLink]:
        return [
            l for l in self._links
            if l.module == ModuleType.VALIDATOR
            and l.operation == OperationType.COLLISION_CHECK
            and "碰撞" in l.human_reasoning
        ]

    def export_to_json(self, filepath: str) -> None:
        data = {
            "summary": self.get_chain_summary(),
            "links": [link.to_dict() for link in self._links],
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def print_trace_chain(self, link_id: Optional[str] = None) -> None:
        if link_id is None and self._links:
            link_id = self._links[-1].link_id

        if link_id not in self._link_index:
            print(f"未找到链接: {link_id}")
            return

        chain = self.trace_back_from(link_id)

        print("\n" + "=" * 80)
        print("追溯链（从结果回溯到输入）")
        print("=" * 80)

        for i, link in enumerate(reversed(chain)):
            module_icon = {
                "curvature_constraint": "📐",
                "path_search": "🔍",
                "trajectory_smoother": "✨",
                "validator": "✅",
                "input_parser": "📥",
            }.get(link.module.value, "❓")

            print(f"\n{i+1}. {module_icon} [{link.module.value}] {link.operation.value}")
            print(f"   时间: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(link.timestamp))}")
            print(f"   链接ID: {link.link_id}")
            print(f"   💬 {link.human_reasoning}")

            if link.parent_link_ids:
                print(f"   ← 父链接: {', '.join(link.parent_link_ids)}")

        print("\n" + "=" * 80)

    def print_curvature_chain(self) -> None:
        curv_links = self.get_links_by_module(ModuleType.CURVATURE_CONSTRAINT)

        if not curv_links:
            print("暂无曲率计算记录")
            return

        print("\n" + "=" * 80)
        print("曲率约束计算链")
        print("=" * 80)

        for link in curv_links:
            calc = link.raw_data.get("calculation")
            if calc:
                print(f"\n📐 {link.operation.value}")
                print(f"   公式: {calc.formula}")
                print(f"   输入: {calc.inputs}")
                print(f"   中间: {calc.intermediate}")
                print(f"   结果: {calc.result:.6f}")
                print(f"   边界检查: {calc.boundary_check}")
                print(f"   💬 {calc.reasoning}")

        print("\n" + "=" * 80)

    def get_chain_for_handoff(self) -> str:
        summary = self.get_chain_summary()
        lines = []
        lines.append("【机器人路径曲率限制 - 交接单】")
        lines.append("=" * 60)
        lines.append(f"输入线索: {json.dumps(summary['input_clues'], ensure_ascii=False)}")
        lines.append(f"总处理环节: {summary['total_links']}")
        lines.append(f"模块分布: {summary['module_distribution']}")
        lines.append(f"问题/警告数: {summary['violation_count']}")

        if summary["violation_links"]:
            lines.append("\n⚠️  需要关注的问题:")
            for v in summary["violation_links"]:
                lines.append(f"  • {v['reasoning']}")

        lines.append("\n📋  完整环节链:")
        for i, link in enumerate(self._links):
            module_icon = {
                "curvature_constraint": "📐",
                "path_search": "🔍",
                "trajectory_smoother": "✨",
                "validator": "✅",
                "input_parser": "📥",
            }.get(link.module.value, "❓")
            lines.append(f"  {i+1}. {module_icon} {link.human_reasoning}")

        return "\n".join(lines)
