from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional


@dataclass
class Mold:
    id: str
    name: str
    changeover_to: Dict[str, float] = field(default_factory=dict)

    def changeover_time_from(self, from_mold_id: str) -> float:
        if from_mold_id == self.id:
            return 0.0
        return self.changeover_to.get(from_mold_id, 0.0)


@dataclass
class Machine:
    id: str
    name: str
    compatible_molds: List[str] = field(default_factory=list)
    capacity_per_shift: float = 8.0


@dataclass
class Shift:
    id: str
    machine_id: str
    date: str
    start_hour: float = 0.0
    end_hour: float = 8.0
    available: bool = True

    @property
    def duration(self) -> float:
        return self.end_hour - self.start_hour

    @property
    def shift_key(self) -> str:
        return f"{self.machine_id}_{self.date}_{self.start_hour}-{self.end_hour}"


@dataclass
class Order:
    id: str
    product: str
    quantity: int
    time_per_unit: float
    mold_id: str
    deadline: str
    priority: int = 1
    material_arrival: Optional[str] = None

    @property
    def total_processing_time(self) -> float:
        return self.quantity * self.time_per_unit

    def is_material_available(self, on_date: str) -> bool:
        if self.material_arrival is None:
            return True
        return on_date >= self.material_arrival


@dataclass
class ScheduleInput:
    orders: List[Order] = field(default_factory=list)
    machines: List[Machine] = field(default_factory=list)
    molds: List[Mold] = field(default_factory=list)
    shifts: List[Shift] = field(default_factory=list)

    def validate(self) -> List[str]:
        errors: List[str] = []
        order_ids = set()
        for o in self.orders:
            if o.id in order_ids:
                errors.append(f"重复订单号: {o.id}")
            order_ids.add(o.id)
            if o.quantity <= 0:
                errors.append(f"订单 {o.id} 数量<=0")
            if o.time_per_unit < 0:
                errors.append(f"订单 {o.id} 单件工时<0")
            if o.total_processing_time <= 0:
                errors.append(f"订单 {o.id} 总工时<=0")
        machine_ids = set()
        for m in self.machines:
            if m.id in machine_ids:
                errors.append(f"重复机器号: {m.id}")
            machine_ids.add(m.id)
        mold_ids = set()
        for m in self.molds:
            if m.id in mold_ids:
                errors.append(f"重复模具号: {m.id}")
            mold_ids.add(m.id)
        for o in self.orders:
            if o.mold_id not in mold_ids:
                errors.append(f"订单 {o.id} 引用不存在模具: {o.mold_id}")
        for s in self.shifts:
            if s.machine_id not in machine_ids:
                errors.append(f"班次 {s.id} 引用不存在机器: {s.machine_id}")
            if s.duration <= 0:
                errors.append(f"班次 {s.id} 时长<=0")
        for m in self.machines:
            for mold_id in m.compatible_molds:
                if mold_id not in mold_ids:
                    errors.append(f"机器 {m.id} 兼容列表引用不存在模具: {mold_id}")
        for o in self.orders:
            assigned_machines = [
                m for m in self.machines if o.mold_id in m.compatible_molds
            ]
            if not assigned_machines:
                errors.append(
                    f"订单 {o.id} 所需模具 {o.mold_id} 无可用机器"
                )
        return errors

    def get_mold(self, mold_id: str) -> Optional[Mold]:
        for m in self.molds:
            if m.id == mold_id:
                return m
        return None

    def get_machine(self, machine_id: str) -> Optional[Machine]:
        for m in self.machines:
            if m.id == machine_id:
                return m
        return None

    def get_orders_for_machine(self, machine_id: str) -> List[Order]:
        machine = self.get_machine(machine_id)
        if not machine:
            return []
        return [o for o in self.orders if o.mold_id in machine.compatible_molds]

    def available_shifts_for_order(self, order: Order) -> List[Shift]:
        result = []
        for s in self.shifts:
            if not s.available:
                continue
            machine = self.get_machine(s.machine_id)
            if not machine:
                continue
            if order.mold_id in machine.compatible_molds:
                if order.is_material_available(s.date):
                    result.append(s)
        return result

    def supplement(self, extra: ScheduleInput) -> ScheduleInput:
        existing_order_ids = {o.id for o in self.orders}
        existing_machine_ids = {m.id for m in self.machines}
        existing_mold_ids = {m.id for m in self.molds}
        existing_shift_ids = {s.id for s in self.shifts}
        merged = ScheduleInput(
            orders=list(self.orders),
            machines=list(self.machines),
            molds=list(self.molds),
            shifts=list(self.shifts),
        )
        for o in extra.orders:
            if o.id in existing_order_ids:
                for i, existing in enumerate(merged.orders):
                    if existing.id == o.id:
                        merged.orders[i] = o
                        break
            else:
                merged.orders.append(o)
        for m in extra.machines:
            if m.id in existing_machine_ids:
                for i, existing in enumerate(merged.machines):
                    if existing.id == m.id:
                        merged.machines[i] = m
                        break
            else:
                merged.machines.append(m)
        for m in extra.molds:
            if m.id in existing_mold_ids:
                for i, existing in enumerate(merged.molds):
                    if existing.id == m.id:
                        merged.molds[i] = m
                        break
            else:
                merged.molds.append(m)
        for s in extra.shifts:
            if s.id in existing_shift_ids:
                for i, existing in enumerate(merged.shifts):
                    if existing.id == s.id:
                        merged.shifts[i] = s
                        break
            else:
                merged.shifts.append(s)
        return merged

    def to_dict(self) -> Dict[str, Any]:
        return {
            "orders": [asdict(o) for o in self.orders],
            "machines": [asdict(m) for m in self.machines],
            "molds": [asdict(m) for m in self.molds],
            "shifts": [asdict(s) for s in self.shifts],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ScheduleInput:
        return cls(
            orders=[Order(**o) for o in data.get("orders", [])],
            machines=[Machine(**m) for m in data.get("machines", [])],
            molds=[Mold(**m) for m in data.get("molds", [])],
            shifts=[Shift(**s) for s in data.get("shifts", [])],
        )

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> ScheduleInput:
        return cls.from_dict(json.loads(json_str))

    @classmethod
    def load(cls, path: str) -> ScheduleInput:
        with open(path, "r", encoding="utf-8") as f:
            return cls.from_dict(json.load(f))


@dataclass
class Assignment:
    order_id: str
    machine_id: str
    shift_id: str
    start_time: float
    end_time: float
    changeover_before: float = 0.0
    prev_order_id: Optional[str] = None
    mold_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Assignment:
        return cls(**data)


@dataclass
class Violation:
    kind: str
    severity: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Violation:
        return cls(**data)


@dataclass
class ScheduleResult:
    run_id: str
    timestamp: str
    feasible: bool
    objective_value: Optional[float] = None
    assignments: List[Assignment] = field(default_factory=list)
    violations: List[Violation] = field(default_factory=list)
    infeasibility_reasons: List[str] = field(default_factory=list)
    input_hash: str = ""
    solver_status: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "feasible": self.feasible,
            "objective_value": self.objective_value,
            "assignments": [a.to_dict() for a in self.assignments],
            "violations": [v.to_dict() for v in self.violations],
            "infeasibility_reasons": self.infeasibility_reasons,
            "input_hash": self.input_hash,
            "solver_status": self.solver_status,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ScheduleResult:
        return cls(
            run_id=data["run_id"],
            timestamp=data["timestamp"],
            feasible=data["feasible"],
            objective_value=data.get("objective_value"),
            assignments=[Assignment.from_dict(a) for a in data.get("assignments", [])],
            violations=[Violation.from_dict(v) for v in data.get("violations", [])],
            infeasibility_reasons=data.get("infeasibility_reasons", []),
            input_hash=data.get("input_hash", ""),
            solver_status=data.get("solver_status", ""),
        )

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> ScheduleResult:
        return cls.from_dict(json.loads(json_str))
