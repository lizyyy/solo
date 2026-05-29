from datetime import datetime, date, timedelta
from typing import List, Tuple, Dict, Any, Optional
from .models import (
    DataStore, FabricSample, Garment, ArrivalReminder, ArrivalStatus,
    InspectionStatus, OperationType
)
from .storage import StorageManager


class ArrivalManager:
    def __init__(self, storage: StorageManager):
        self.storage = storage
        self.warning_days_before = 7
        self.delay_warning_threshold = 3
        self.status_transition_rules = {
            InspectionStatus.PENDING: [InspectionStatus.IN_PROGRESS, InspectionStatus.REVOKED],
            InspectionStatus.IN_PROGRESS: [InspectionStatus.PASSED, InspectionStatus.FAILED, InspectionStatus.REINSPECT, InspectionStatus.REVOKED],
            InspectionStatus.FAILED: [InspectionStatus.REINSPECT, InspectionStatus.REVOKED],
            InspectionStatus.REINSPECT: [InspectionStatus.PASSED, InspectionStatus.FAILED, InspectionStatus.REVOKED],
            InspectionStatus.PASSED: [InspectionStatus.REVOKED],
            InspectionStatus.REVOKED: [InspectionStatus.PENDING],
        }

    def check_arrivals(self, store: DataStore, reference_date: Optional[date] = None) -> Tuple[List[ArrivalReminder], List[str], DataStore]:
        if reference_date is None:
            reference_date = date.today()

        calc_traces = []
        reminders = []

        calc_traces.append("=" * 60)
        calc_traces.append("到货与检验状态检查")
        calc_traces.append(f"参考日期: {reference_date.isoformat()}")
        calc_traces.append(f"预警阈值: 提前{self.warning_days_before}天提醒，逾期{self.delay_warning_threshold}天警告")
        calc_traces.append("=" * 60)
        calc_traces.append("")

        for sample in store.samples.values():
            if sample.is_missing:
                calc_traces.append(f"跳过样卡 {sample.sample_id}: 样卡已标记缺失")
                continue

            reminder, traces, store = self._analyze_sample_arrival(sample, store, reference_date)
            calc_traces.extend(traces)

            if reminder:
                reminders.append(reminder)
                store.reminders[reminder.reminder_id] = reminder

        calc_traces.append("")
        calc_traces.append(f"检查完成: 生成 {len(reminders)} 条到货提醒")

        return reminders, calc_traces, store

    def _analyze_sample_arrival(
        self, sample: FabricSample, store: DataStore, reference_date: date
    ) -> Tuple[Optional[ArrivalReminder], List[str], DataStore]:
        calc_traces = []
        calc_process = {}

        calc_traces.append(f"--- 样卡 {sample.sample_id} ({sample.fabric_name}) ---")
        calc_traces.append(f"  预计到货: {sample.expected_arrival.isoformat() if sample.expected_arrival else '未设置'}")
        calc_traces.append(f"  实际到货: {sample.arrival_date.isoformat() if sample.arrival_date else '未到货'}")
        calc_traces.append(f"  检验截止: {sample.inspection_deadline.isoformat() if sample.inspection_deadline else '未设置'}")
        calc_traces.append(f"  当前状态: {sample.inspection_status.value}")

        if not sample.expected_arrival:
            calc_traces.append("  跳过: 未设置预计到货日期")
            return None, calc_traces, store

        calc_process['reference_date'] = reference_date.isoformat()
        calc_process['expected_arrival'] = sample.expected_arrival.isoformat()
        calc_process['actual_arrival'] = sample.arrival_date.isoformat() if sample.arrival_date else None
        calc_process['inspection_deadline'] = sample.inspection_deadline.isoformat() if sample.inspection_deadline else None

        arrival_status = ArrivalStatus.UNKNOWN
        days_overdue = 0
        days_before_deadline = None

        if sample.arrival_date:
            days_diff = (sample.arrival_date - sample.expected_arrival).days
            calc_process['arrival_days_diff'] = days_diff
            calc_traces.append(f"  到货偏差: {days_diff:+d} 天")

            if days_diff > 0:
                arrival_status = ArrivalStatus.DELAYED
                days_overdue = days_diff
                calc_traces.append(f"  判定: 到货逾期 {days_overdue} 天")
                if days_overdue >= self.delay_warning_threshold:
                    error = self.storage.create_error_record(
                        error_type="到货管理",
                        error_code="ARRIVAL-001",
                        message=f"样卡 {sample.sample_id} 到货逾期 {days_overdue} 天 (预计{sample.expected_arrival}, 实际{sample.arrival_date})",
                        sample_id=sample.sample_id,
                        severity="error" if days_overdue > 7 else "warning",
                        calculation_detail={
                            **calc_process,
                            "threshold": self.delay_warning_threshold
                        }
                    )
                    store = self.storage.add_error(error, store)
            elif days_diff < 0:
                arrival_status = ArrivalStatus.EARLY
                calc_traces.append(f"  判定: 提前到货 {-days_diff} 天")
            else:
                arrival_status = ArrivalStatus.ON_TIME
                calc_traces.append(f"  判定: 准时到货")
        else:
            days_diff = (reference_date - sample.expected_arrival).days
            calc_process['days_since_expected'] = days_diff

            if days_diff > 0:
                arrival_status = ArrivalStatus.DELAYED
                days_overdue = days_diff
                calc_traces.append(f"  判定: 已逾期 {days_overdue} 天未到货")
                error = self.storage.create_error_record(
                    error_type="到货管理",
                    error_code="ARRIVAL-002",
                    message=f"样卡 {sample.sample_id} 已逾期 {days_overdue} 天未到货 (预计{sample.expected_arrival})",
                    sample_id=sample.sample_id,
                    severity="error" if days_overdue > 7 else "warning",
                    calculation_detail={
                        **calc_process,
                        "threshold": self.delay_warning_threshold
                    }
                )
                store = self.storage.add_error(error, store)
            else:
                arrival_status = ArrivalStatus.NOT_ARRIVED
                calc_traces.append(f"  判定: 未到货 (距离预计还有 {-days_diff} 天)")

        if sample.inspection_deadline:
            days_before_deadline = (sample.inspection_deadline - reference_date).days
            calc_process['days_before_deadline'] = days_before_deadline
            calc_traces.append(f"  距检验截止: {days_before_deadline:+d} 天")

            if days_before_deadline <= self.warning_days_before and days_before_deadline > 0:
                calc_traces.append(f"  提醒: 检验即将截止 (剩余 {days_before_deadline} 天)")
                error = self.storage.create_error_record(
                    error_type="检验提醒",
                    error_code="INSPECT-001",
                    message=f"样卡 {sample.sample_id} 检验还有 {days_before_deadline} 天截止",
                    sample_id=sample.sample_id,
                    severity="info",
                    calculation_detail={**calc_process}
                )
                store = self.storage.add_error(error, store)
            elif days_before_deadline <= 0:
                calc_traces.append(f"  警告: 检验已逾期 {-days_before_deadline} 天")

        status_chain = self._get_status_transition_chain(sample, store)
        calc_process['status_chain'] = status_chain
        calc_traces.append(f"  状态流转链: {' → '.join(status_chain)}")

        if sample.arrival_date and sample.inspection_deadline:
            if sample.arrival_date > sample.inspection_deadline:
                days_after_deadline = (sample.arrival_date - sample.inspection_deadline).days
                calc_process['arrival_after_deadline_days'] = days_after_deadline
                calc_traces.append(f"  ⚠ 关键校验: 到货日期 {sample.arrival_date} 晚于检验截止 {sample.inspection_deadline}")
                calc_traces.append(f"    逾期天数: {days_after_deadline} 天")
                calc_traces.append(f"    状态流转可靠性验证: 需要检查检验状态是否在到货前已流转")

                if sample.inspection_status in [InspectionStatus.PASSED, InspectionStatus.FAILED, InspectionStatus.IN_PROGRESS]:
                    calc_traces.append(f"    ❌ 状态流转异常: 检验状态为 {sample.inspection_status.value}，但到货晚于检验截止")
                    error = self.storage.create_error_record(
                        error_type="状态流转",
                        error_code="FLOW-001",
                        message=f"样卡 {sample.sample_id} 状态流转异常: 检验状态({sample.inspection_status.value})早于实际到货({sample.arrival_date})，检验截止{sample.inspection_deadline}",
                        sample_id=sample.sample_id,
                        severity="error",
                        calculation_detail={
                            **calc_process,
                            "current_status": sample.inspection_status.value,
                            "anomaly": "检验状态流转早于到货日期"
                        }
                    )
                    store = self.storage.add_error(error, store)
                else:
                    calc_traces.append(f"    ✓ 状态流转正常: 当前状态为 {sample.inspection_status.value}")

        reminder = ArrivalReminder(
            reminder_id=self.storage.generate_id("REM"),
            sample_id=sample.sample_id,
            garment_id=self._get_garment_id_for_sample(sample.sample_id, store),
            arrival_status=arrival_status,
            expected_arrival=sample.expected_arrival,
            actual_arrival=sample.arrival_date,
            inspection_deadline=sample.inspection_deadline,
            days_overdue=days_overdue,
            days_before_deadline=days_before_deadline,
            status_transition_chain=status_chain,
            calculation_process=calc_process
        )

        calc_traces.append(f"  生成提醒: {arrival_status.value}")
        calc_traces.append("")

        return reminder, calc_traces, store

    def _get_garment_id_for_sample(self, sample_id: str, store: DataStore) -> Optional[str]:
        for match in store.matches.values():
            if match.sample_id == sample_id:
                return match.garment_id
        return None

    def _get_status_transition_chain(self, sample: FabricSample, store: DataStore) -> List[str]:
        chain = [InspectionStatus.PENDING.value]

        sample_history = [
            h for h in store.history.values()
            if h.entity_type == "sample" and h.entity_id == sample.sample_id
        ]
        sample_history.sort(key=lambda h: h.operation_time)

        for h in sample_history:
            if h.operation_type in [OperationType.UPDATE, OperationType.AMEND]:
                before = h.before_data or {}
                after = h.after_data or {}
                before_status = before.get('inspection_status')
                after_status = after.get('inspection_status')
                if before_status and after_status and before_status != after_status:
                    if before_status not in chain:
                        chain.append(before_status)
                    chain.append(after_status)

        if sample.inspection_status.value not in chain:
            chain.append(sample.inspection_status.value)

        return chain

    def transition_status(
        self, sample_id: str, new_status: InspectionStatus, store: DataStore,
        operator: Optional[str] = None, reason: Optional[str] = None
    ) -> Tuple[Optional[FabricSample], List[str], DataStore]:
        calc_traces = []

        if sample_id not in store.samples:
            error = self.storage.create_error_record(
                error_type="状态流转",
                error_code="FLOW-002",
                message=f"样卡 {sample_id} 不存在",
                sample_id=sample_id,
                severity="error"
            )
            store = self.storage.add_error(error, store)
            calc_traces.append(f"错误: 样卡 {sample_id} 不存在")
            return None, calc_traces, store

        sample = store.samples[sample_id]
        current_status = sample.inspection_status

        calc_traces.append(f"状态流转: {sample_id}")
        calc_traces.append(f"  当前状态: {current_status.value}")
        calc_traces.append(f"  目标状态: {new_status.value}")

        allowed_transitions = self.status_transition_rules.get(current_status, [])
        if new_status not in allowed_transitions:
            allowed = ', '.join([s.value for s in allowed_transitions])
            error = self.storage.create_error_record(
                error_type="状态流转",
                error_code="FLOW-003",
                message=f"状态流转不允许: 从 {current_status.value} 不能直接转为 {new_status.value}，允许的状态: {allowed}",
                sample_id=sample_id,
                severity="error",
                calculation_detail={
                    "current_status": current_status.value,
                    "new_status": new_status.value,
                    "allowed_transitions": [s.value for s in allowed_transitions]
                }
            )
            store = self.storage.add_error(error, store)
            calc_traces.append(f"  ✗ 流转不允许: 允许转为 {allowed}")
            return None, calc_traces, store

        hist_before = sample.model_dump(mode='json')
        sample.inspection_status = new_status
        sample.updated_at = datetime.now()
        hist_after = sample.model_dump(mode='json')

        op_type = OperationType.UPDATE
        if new_status == InspectionStatus.REVOKED:
            op_type = OperationType.REVOKE

        hist_record = self.storage.create_history_record(
            operation_type=op_type,
            entity_type="sample",
            entity_id=sample_id,
            before_data=hist_before,
            after_data=hist_after,
            change_reason=reason or f"状态流转: {current_status.value} → {new_status.value}",
            operator=operator,
            calculation_trace=calc_traces
        )
        store = self.storage.add_history(hist_record, store)

        calc_traces.append(f"  ✓ 流转成功: {current_status.value} → {new_status.value}")
        return sample, calc_traces, store

    def amend_sample(
        self, sample_id: str, updates: Dict[str, Any], store: DataStore,
        operator: Optional[str] = None, reason: Optional[str] = None
    ) -> Tuple[Optional[FabricSample], List[str], DataStore]:
        calc_traces = []

        if sample_id not in store.samples:
            error = self.storage.create_error_record(
                error_type="补录管理",
                error_code="AMEND-001",
                message=f"样卡 {sample_id} 不存在",
                sample_id=sample_id,
                severity="error"
            )
            store = self.storage.add_error(error, store)
            calc_traces.append(f"错误: 样卡 {sample_id} 不存在")
            return None, calc_traces, store

        sample = store.samples[sample_id]
        hist_before = sample.model_dump(mode='json')

        calc_traces.append(f"样卡补录: {sample_id}")
        calc_traces.append(f"  操作人: {operator or '未指定'}")
        calc_traces.append(f"  原因: {reason or '未说明'}")
        calc_traces.append(f"  更新字段: {', '.join(updates.keys())}")

        for key, value in updates.items():
            if hasattr(sample, key):
                old_value = getattr(sample, key)
                setattr(sample, key, value)
                calc_traces.append(f"    {key}: {old_value} → {value}")

        sample.updated_at = datetime.now()
        hist_after = sample.model_dump(mode='json')

        hist_record = self.storage.create_history_record(
            operation_type=OperationType.AMEND,
            entity_type="sample",
            entity_id=sample_id,
            before_data=hist_before,
            after_data=hist_after,
            change_reason=reason or "补录信息",
            operator=operator,
            calculation_trace=calc_traces
        )
        store = self.storage.add_history(hist_record, store)

        calc_traces.append(f"  ✓ 补录完成")
        return sample, calc_traces, store

    def revoke_sample(
        self, sample_id: str, store: DataStore,
        operator: Optional[str] = None, reason: Optional[str] = None
    ) -> Tuple[Optional[FabricSample], List[str], DataStore]:
        calc_traces = []

        sample, traces, store = self.transition_status(
            sample_id, InspectionStatus.REVOKED, store, operator,
            reason or "撤回样卡"
        )
        calc_traces.extend(traces)

        if sample and sample.sample_id in store.samples:
            related_matches = [
                m for m in store.matches.values()
                if m.sample_id == sample_id
            ]
            for match in related_matches:
                if match.garment_id in store.garments:
                    garment = store.garments[match.garment_id]
                    hist_before = garment.model_dump(mode='json')
                    garment.sample_id = None
                    garment.supplier_id = None
                    hist_after = garment.model_dump(mode='json')

                    hist_record = self.storage.create_history_record(
                        operation_type=OperationType.REVOKE,
                        entity_type="garment",
                        entity_id=match.garment_id,
                        before_data=hist_before,
                        after_data=hist_after,
                        change_reason=f"样卡 {sample_id} 已撤回，解除关联",
                        operator=operator,
                        calculation_trace=[f"解除与样卡 {sample_id} 的关联"]
                    )
                    store = self.storage.add_history(hist_record, store)
                    calc_traces.append(f"  已解除与成衣 {match.garment_id} 的关联")

                del store.matches[match.match_id]
                calc_traces.append(f"  已删除匹配记录 {match.match_id}")

        return sample, calc_traces, store
