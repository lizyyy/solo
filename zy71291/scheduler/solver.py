from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pulp

from .models import (
    Assignment,
    ScheduleInput,
    ScheduleResult,
    Violation,
)

logger = logging.getLogger(__name__)


def _input_hash(data: ScheduleInput) -> str:
    raw = json.dumps(data.to_dict(), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _deadline_hours(deadline_str: str, planning_start_date: str) -> float:
    d = datetime.strptime(deadline_str, "%Y-%m-%d")
    s = datetime.strptime(planning_start_date, "%Y-%m-%d")
    return (d - s).total_seconds() / 3600.0


def _shift_global_start(shift_date: str, start_hour: float, planning_start_date: str) -> float:
    d = datetime.strptime(shift_date, "%Y-%m-%d")
    s = datetime.strptime(planning_start_date, "%Y-%m-%d")
    return (d - s).total_seconds() / 3600.0 + start_hour


class IPSolver:
    def __init__(self, data: ScheduleInput, planning_start_date: Optional[str] = None):
        self.data = data
        if planning_start_date is None:
            dates = [s.date for s in data.shifts if s.available]
            if dates:
                self.planning_start = min(dates)
            else:
                self.planning_start = datetime.now().strftime("%Y-%m-%d")
        else:
            self.planning_start = planning_start_date
        self._model = None
        self._x: Dict[Tuple[str, str, str], pulp.LpVariable] = {}
        self._y: Dict[Tuple[str, str], pulp.LpVariable] = {}
        self._t: Dict[str, pulp.LpVariable] = {}
        self._late: Dict[str, pulp.LpVariable] = {}
        self._chg: Dict[Tuple[str, str], pulp.LpVariable] = {}
        self._big_m = 100000.0

    def solve(self, time_limit: int = 300) -> ScheduleResult:
        errors = self.data.validate()
        if errors:
            return self._infeasible_result(
                solver_status="INPUT_INVALID",
                reasons=[f"输入校验失败: {e}" for e in errors],
            )
        try:
            self._build_model()
        except Exception as exc:
            logger.error("构建模型异常: %s", exc)
            return self._infeasible_result(
                solver_status="BUILD_ERROR",
                reasons=[f"构建模型异常: {exc}"],
            )
        self._model.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit))
        status = pulp.LpStatus[self._model.status]
        if status == "Optimal":
            return self._extract_feasible()
        elif status == "Infeasible":
            return self._handle_infeasible()
        else:
            return self._infeasible_result(
                solver_status=status,
                reasons=[f"求解器返回状态: {status}"],
            )

    def _build_model(self):
        self._model = pulp.LpProblem("scheduling", pulp.LpMinimize)
        self._add_variables()
        self._add_assignment_constraints()
        self._add_capacity_constraints()
        self._add_deadline_constraints()
        self._add_shift_bounds_constraints()
        self._add_sequencing_constraints()
        self._add_changeover_constraints()
        self._add_objective()

    def _add_variables(self):
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            for shift in avail:
                key = (order.id, shift.machine_id, shift.id)
                self._x[key] = pulp.LpVariable(
                    f"x_{order.id}_{shift.machine_id}_{shift.id}",
                    cat=pulp.LpBinary,
                )
            self._t[order.id] = pulp.LpVariable(
                f"t_{order.id}", lowBound=0, cat=pulp.LpContinuous
            )
            self._late[order.id] = pulp.LpVariable(
                f"late_{order.id}", lowBound=0, cat=pulp.LpContinuous
            )
        for i_idx, o1 in enumerate(self.data.orders):
            for j_idx, o2 in enumerate(self.data.orders):
                if i_idx >= j_idx:
                    continue
                self._y[(o1.id, o2.id)] = pulp.LpVariable(
                    f"y_{o1.id}_{o2.id}", cat=pulp.LpBinary
                )
                self._chg[(o1.id, o2.id)] = pulp.LpVariable(
                    f"chg_{o1.id}_{o2.id}", lowBound=0, cat=pulp.LpContinuous
                )

    def _add_assignment_constraints(self):
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            if not avail:
                continue
            self._model += (
                pulp.lpSum(
                    self._x.get((order.id, s.machine_id, s.id), 0) for s in avail
                )
                == 1,
                f"assign_{order.id}",
            )

    def _add_capacity_constraints(self):
        machine_shifts: Dict[Tuple[str, str], List] = {}
        for shift in self.data.shifts:
            if not shift.available:
                continue
            key = (shift.machine_id, shift.id)
            machine_shifts.setdefault(key, []).append(shift)
        for (machine_id, shift_id), shifts in machine_shifts.items():
            shift = shifts[0]
            orders_on = [
                o for o in self.data.orders
                if (o.id, machine_id, shift_id) in self._x
            ]
            if not orders_on:
                continue
            machine = self.data.get_machine(machine_id)
            cap = shift.duration if machine is None else min(shift.duration, machine.capacity_per_shift)
            self._model += (
                pulp.lpSum(
                    o.total_processing_time * self._x[(o.id, machine_id, shift_id)]
                    for o in orders_on
                )
                <= cap,
                f"cap_{machine_id}_{shift_id}",
            )

    def _add_deadline_constraints(self):
        for order in self.data.orders:
            deadline_h = _deadline_hours(order.deadline, self.planning_start)
            self._model += (
                self._t[order.id]
                + order.total_processing_time
                - self._late[order.id]
                <= deadline_h,
                f"deadline_{order.id}",
            )

    def _add_shift_bounds_constraints(self):
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            for shift in avail:
                global_start = _shift_global_start(
                    shift.date, shift.start_hour, self.planning_start
                )
                global_end = _shift_global_start(
                    shift.date, shift.end_hour, self.planning_start
                )
                x_var = self._x.get((order.id, shift.machine_id, shift.id))
                if x_var is None:
                    continue
                self._model += (
                    self._t[order.id] >= global_start - self._big_m * (1 - x_var),
                    f"sbound_lo_{order.id}_{shift.id}",
                )
                self._model += (
                    self._t[order.id]
                    + order.total_processing_time
                    <= global_end + self._big_m * (1 - x_var),
                    f"sbound_hi_{order.id}_{shift.id}",
                )

    def _add_sequencing_constraints(self):
        machine_shift_orders: Dict[Tuple[str, str], List] = {}
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            for shift in avail:
                key = (shift.machine_id, shift.id)
                machine_shift_orders.setdefault(key, []).append(order)
        for (machine_id, shift_id), orders in machine_shift_orders.items():
            for i in range(len(orders)):
                for j in range(i + 1, len(orders)):
                    o1, o2 = orders[i], orders[j]
                    x1 = self._x.get((o1.id, machine_id, shift_id))
                    x2 = self._x.get((o2.id, machine_id, shift_id))
                    if x1 is None or x2 is None:
                        continue
                    y_var = self._y.get((o1.id, o2.id))
                    if y_var is None:
                        continue
                    chg_var = self._chg.get((o1.id, o2.id))
                    chg_val = self._get_changeover(o1.mold_id, o2.mold_id)
                    chg_rev = self._get_changeover(o2.mold_id, o1.mold_id)
                    both_assigned = x1 + x2
                    self._model += (
                        self._t[o1.id]
                        + o1.total_processing_time
                        + chg_val * (1 if chg_var is None else chg_var)
                        <= self._t[o2.id]
                        + self._big_m * (1 - y_var)
                        + self._big_m * (2 - both_assigned),
                        f"seq_{machine_id}_{shift_id}_{o1.id}_{o2.id}_fwd",
                    )
                    self._model += (
                        self._t[o2.id]
                        + o2.total_processing_time
                        + chg_rev * (1 if chg_var is None else chg_var)
                        <= self._t[o1.id]
                        + self._big_m * y_var
                        + self._big_m * (2 - both_assigned),
                        f"seq_{machine_id}_{shift_id}_{o1.id}_{o2.id}_rev",
                    )

    def _add_changeover_constraints(self):
        machine_shift_orders: Dict[Tuple[str, str], List] = {}
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            for shift in avail:
                key = (shift.machine_id, shift.id)
                machine_shift_orders.setdefault(key, []).append(order)
        for (machine_id, shift_id), orders in machine_shift_orders.items():
            for i in range(len(orders)):
                for j in range(i + 1, len(orders)):
                    o1, o2 = orders[i], orders[j]
                    chg_var = self._chg.get((o1.id, o2.id))
                    if chg_var is None:
                        continue
                    x1 = self._x.get((o1.id, machine_id, shift_id))
                    x2 = self._x.get((o2.id, machine_id, shift_id))
                    if x1 is None or x2 is None:
                        continue
                    same_mold = 1 if o1.mold_id == o2.mold_id else 0
                    if same_mold:
                        self._model += (
                            chg_var == 0,
                            f"chg_zero_{machine_id}_{shift_id}_{o1.id}_{o2.id}",
                        )
                    else:
                        chg_val = self._get_changeover(o1.mold_id, o2.mold_id)
                        chg_rev = self._get_changeover(o2.mold_id, o1.mold_id)
                        y_var = self._y.get((o1.id, o2.id))
                        if y_var is None:
                            continue
                        both_assigned = x1 + x2
                        self._model += (
                            chg_var
                            >= chg_val * y_var - self._big_m * (2 - both_assigned),
                            f"chg_lb_{machine_id}_{shift_id}_{o1.id}_{o2.id}_fwd",
                        )
                        self._model += (
                            chg_var
                            >= chg_rev * (1 - y_var)
                            - self._big_m * (2 - both_assigned),
                            f"chg_lb_{machine_id}_{shift_id}_{o1.id}_{o2.id}_rev",
                        )

    def _add_objective(self):
        weight_late = 1000.0
        weight_completion = 1.0
        weight_changeover = 10.0
        self._model += (
            pulp.lpSum(
                weight_late * self._late[o.id] * o.priority
                + weight_completion * (self._t[o.id] + o.total_processing_time)
                for o in self.data.orders
            )
            + pulp.lpSum(
                weight_changeover * self._chg[pair]
                for pair in self._chg
            )
        )

    def _get_changeover(self, from_mold_id: str, to_mold_id: str) -> float:
        if from_mold_id == to_mold_id:
            return 0.0
        mold = self.data.get_mold(to_mold_id)
        if mold is None:
            return 0.0
        return mold.changeover_time_from(from_mold_id)

    def _extract_feasible(self) -> ScheduleResult:
        assignments = []
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            assigned = False
            for shift in avail:
                key = (order.id, shift.machine_id, shift.id)
                x_var = self._x.get(key)
                if x_var is not None and x_var.varValue is not None and x_var.varValue > 0.5:
                    t_val = self._t[order.id].varValue or 0.0
                    assignments.append(
                        Assignment(
                            order_id=order.id,
                            machine_id=shift.machine_id,
                            shift_id=shift.id,
                            start_time=round(t_val, 4),
                            end_time=round(t_val + order.total_processing_time, 4),
                            mold_id=order.mold_id,
                            changeover_before=0.0,
                            prev_order_id=None,
                        )
                    )
                    assigned = True
                    break
            if not assigned:
                logger.warning("订单 %s 未被分配", order.id)
        self._fill_changeover_chain(assignments)
        violations = self._post_validate(assignments)
        obj_val = pulp.value(self._model.objective)
        return ScheduleResult(
            run_id=datetime.now().strftime("%Y%m%d_%H%M%S"),
            timestamp=datetime.now().isoformat(),
            feasible=True,
            objective_value=round(obj_val, 4) if obj_val is not None else None,
            assignments=assignments,
            violations=violations,
            input_hash=_input_hash(self.data),
            solver_status="Optimal",
        )

    def _fill_changeover_chain(self, assignments: List[Assignment]):
        machine_shift_map: Dict[Tuple[str, str], List[Assignment]] = {}
        for a in assignments:
            key = (a.machine_id, a.shift_id)
            machine_shift_map.setdefault(key, []).append(a)
        for key, group in machine_shift_map.items():
            group.sort(key=lambda a: a.start_time)
            for i, a in enumerate(group):
                if i == 0:
                    a.changeover_before = 0.0
                    a.prev_order_id = None
                else:
                    prev = group[i - 1]
                    a.prev_order_id = prev.order_id
                    a.changeover_before = self._get_changeover(
                        prev.mold_id, a.mold_id
                    )

    def _post_validate(self, assignments: List[Assignment]) -> List[Violation]:
        violations = []
        violations.extend(self._check_machine_overload(assignments))
        violations.extend(self._check_deadline_inversion(assignments))
        violations.extend(self._check_changeover_missing(assignments))
        return violations

    def _check_machine_overload(self, assignments: List[Assignment]) -> List[Violation]:
        violations = []
        machine_shift_load: Dict[Tuple[str, str], Tuple[float, float]] = {}
        for a in assignments:
            key = (a.machine_id, a.shift_id)
            load, cap = machine_shift_load.get(key, (0.0, 0.0))
            shift = None
            for s in self.data.shifts:
                if s.id == a.shift_id:
                    shift = s
                    break
            if shift:
                machine = self.data.get_machine(a.machine_id)
                cap = min(shift.duration, machine.capacity_per_shift) if machine else shift.duration
            load += a.end_time - a.start_time + a.changeover_before
            machine_shift_load[key] = (load, cap)
        for (machine_id, shift_id), (load, cap) in machine_shift_load.items():
            if load > cap + 1e-6:
                violations.append(
                    Violation(
                        kind="MACHINE_OVERLOAD",
                        severity="CRITICAL",
                        description=f"机器 {machine_id} 班次 {shift_id} 超载: "
                        f"负载 {load:.2f}h > 容量 {cap:.2f}h",
                        details={"machine_id": machine_id, "shift_id": shift_id,
                                 "load": round(load, 4), "capacity": round(cap, 4)},
                    )
                )
        return violations

    def _check_deadline_inversion(self, assignments: List[Assignment]) -> List[Violation]:
        violations = []
        for a in assignments:
            order = None
            for o in self.data.orders:
                if o.id == a.order_id:
                    order = o
                    break
            if order is None:
                continue
            deadline_h = _deadline_hours(order.deadline, self.planning_start)
            if a.end_time > deadline_h + 1e-6:
                late = a.end_time - deadline_h
                violations.append(
                    Violation(
                        kind="DEADLINE_INVERSION",
                        severity="CRITICAL",
                        description=f"订单 {order.id} 交期倒挂: "
                        f"完工 {a.end_time:.2f}h > 交期 {deadline_h:.2f}h, "
                        f"延迟 {late:.2f}h",
                        details={
                            "order_id": order.id,
                            "end_time": round(a.end_time, 4),
                            "deadline": round(deadline_h, 4),
                            "lateness": round(late, 4),
                        },
                    )
                )
        return violations

    def _check_changeover_missing(self, assignments: List[Assignment]) -> List[Violation]:
        violations = []
        machine_shift_map: Dict[Tuple[str, str], List[Assignment]] = {}
        for a in assignments:
            key = (a.machine_id, a.shift_id)
            machine_shift_map.setdefault(key, []).append(a)
        for key, group in machine_shift_map.items():
            group.sort(key=lambda a: a.start_time)
            for i in range(1, len(group)):
                prev = group[i - 1]
                curr = group[i]
                expected_changeover = self._get_changeover(prev.mold_id, curr.mold_id)
                if expected_changeover > 0:
                    gap = curr.start_time - prev.end_time
                    if gap < expected_changeover - 1e-6:
                        violations.append(
                            Violation(
                                kind="CHANGEOVER_MISSING",
                                severity="CRITICAL",
                                description=f"机器 {curr.machine_id} 班次 {curr.shift_id} "
                                f"换模漏算: {prev.order_id}({prev.mold_id})->"
                                f"{curr.order_id}({curr.mold_id}), "
                                f"需要 {expected_changeover:.2f}h 实际间隙 {gap:.2f}h",
                                details={
                                    "machine_id": curr.machine_id,
                                    "shift_id": curr.shift_id,
                                    "prev_order": prev.order_id,
                                    "curr_order": curr.order_id,
                                    "prev_mold": prev.mold_id,
                                    "curr_mold": curr.mold_id,
                                    "required_changeover": expected_changeover,
                                    "actual_gap": round(gap, 4),
                                },
                            )
                        )
        return violations

    def _handle_infeasible(self) -> ScheduleResult:
        reasons = self._diagnose_infeasibility()
        return self._infeasible_result(
            solver_status="Infeasible",
            reasons=reasons,
        )

    def _diagnose_infeasibility(self) -> List[str]:
        reasons = []
        for order in self.data.orders:
            avail = self.data.available_shifts_for_order(order)
            if not avail:
                reasons.append(
                    f"订单 {order.id} (模具 {order.mold_id}) "
                    f"无可用班次 (可能: 无兼容机器 / 材料未到 / 班次不可用)"
                )
        total_demand_by_mold: Dict[str, float] = {}
        total_supply_by_mold: Dict[str, float] = {}
        for order in self.data.orders:
            total_demand_by_mold[order.mold_id] = (
                total_demand_by_mold.get(order.mold_id, 0.0)
                + order.total_processing_time
            )
        for machine in self.data.machines:
            for mold_id in machine.compatible_molds:
                for shift in self.data.shifts:
                    if shift.machine_id == machine.id and shift.available:
                        cap = min(shift.duration, machine.capacity_per_shift)
                        total_supply_by_mold[mold_id] = (
                            total_supply_by_mold.get(mold_id, 0.0) + cap
                        )
        for mold_id, demand in total_demand_by_mold.items():
            supply = total_supply_by_mold.get(mold_id, 0.0)
            if demand > supply + 1e-6:
                reasons.append(
                    f"模具 {mold_id} 总需求 {demand:.2f}h > "
                    f"总供应 {supply:.2f}h (产能不足)"
                )
        tight_deadline_orders = []
        for order in self.data.orders:
            deadline_h = _deadline_hours(order.deadline, self.planning_start)
            if deadline_h < order.total_processing_time:
                tight_deadline_orders.append(order)
        if tight_deadline_orders:
            for order in tight_deadline_orders:
                deadline_h = _deadline_hours(order.deadline, self.planning_start)
                reasons.append(
                    f"订单 {order.id} 交期过紧: "
                    f"加工需 {order.total_processing_time:.2f}h "
                    f"但交期仅 {deadline_h:.2f}h"
                )
        if not reasons:
            reasons.append(
                "模型不可行，但无法自动定位具体原因。"
                "建议: 检查交期是否过紧、产能是否充足、换模时间是否过大"
            )
        return reasons

    def _infeasible_result(
        self, solver_status: str, reasons: List[str]
    ) -> ScheduleResult:
        return ScheduleResult(
            run_id=datetime.now().strftime("%Y%m%d_%H%M%S"),
            timestamp=datetime.now().isoformat(),
            feasible=False,
            infeasibility_reasons=reasons,
            input_hash=_input_hash(self.data),
            solver_status=solver_status,
        )
