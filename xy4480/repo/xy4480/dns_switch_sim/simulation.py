from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict
import uuid

from .models import (
    SwitchPlan, SwitchStep, SwitchPhase, Region,
    DNSRecord, VendorExport, ProbeLog, CheckResult,
    CheckResultType, ReviewItem, ReviewStatus, SimulationResult,
    CDNVendor
)


class RegionPropagationConfig:
    REGION_TTL_FACTORS: Dict[Region, float] = {
        Region.CN_MAIN: 1.0,
        Region.CN_HK: 1.2,
        Region.CN_TW: 1.3,
        Region.APAC: 1.5,
        Region.NA: 2.0,
        Region.EU: 2.2,
        Region.SA: 2.5,
        Region.AF: 2.8,
        Region.GLOBAL: 1.0,
    }

    @classmethod
    def get_propagation_time(cls, region: Region, base_ttl: int) -> int:
        factor = cls.REGION_TTL_FACTORS.get(region, 1.0)
        return int(base_ttl * factor)


class SimulationEngine:
    def __init__(
        self,
        switch_plan: SwitchPlan,
        dns_records: List[DNSRecord],
        vendor_exports: List[VendorExport],
        probe_logs: List[ProbeLog],
    ):
        self.switch_plan = switch_plan
        self.dns_records = dns_records
        self.vendor_exports = vendor_exports
        self.probe_logs = probe_logs
        
        self.vendor_by_cname: Dict[str, CDNVendor] = {}
        for export in vendor_exports:
            if export.cname_target:
                self.vendor_by_cname[export.cname_target.lower()] = export.vendor

        self._simulation_id = str(uuid.uuid4())[:8]

    def get_current_phase(self, simulated_time: datetime) -> Optional[SwitchPhase]:
        if not self.switch_plan.steps:
            return None
        
        steps_sorted = sorted(self.switch_plan.steps, key=lambda s: s.start_time)
        
        for step in steps_sorted:
            step_end = step.start_time + timedelta(minutes=step.duration_minutes)
            if step.start_time <= simulated_time <= step_end:
                return step.phase
        
        if simulated_time > steps_sorted[-1].start_time + timedelta(minutes=steps_sorted[-1].duration_minutes):
            return SwitchPhase.COMPLETE
        
        return None

    def get_effective_regions(self, simulated_time: datetime) -> Dict[Region, bool]:
        effective: Dict[Region, bool] = defaultdict(bool)
        
        for step in self.switch_plan.steps:
            base_ttl = self._get_base_ttl_for_step(step)
            propagation_time = RegionPropagationConfig.get_propagation_time(
                step.region, base_ttl
            )
            
            effective_time = step.start_time + timedelta(seconds=propagation_time)
            if simulated_time >= effective_time:
                effective[step.region] = True
            else:
                if step.region not in effective:
                    effective[step.region] = False
        
        return dict(effective)

    def _get_base_ttl_for_step(self, step: SwitchStep) -> int:
        for record in self.dns_records:
            if record.domain == self.switch_plan.domain:
                if record.region == step.region or record.region == Region.GLOBAL:
                    return record.ttl
        return 300

    def calculate_rollback_window(self, simulated_time: datetime) -> Optional[int]:
        steps_sorted = sorted(self.switch_plan.steps, key=lambda s: s.start_time)
        
        for i, step in enumerate(steps_sorted):
            if step.phase == SwitchPhase.ROLLBACK:
                base_ttl = self._get_base_ttl_for_step(step)
                propagation_time = RegionPropagationConfig.get_propagation_time(
                    step.region, base_ttl
                )
                
                rollback_start = step.start_time
                rollback_end = step.start_time + timedelta(
                    minutes=step.duration_minutes + (propagation_time // 60)
                )
                
                if rollback_start <= simulated_time <= rollback_end:
                    remaining = rollback_end - simulated_time
                    return int(remaining.total_seconds() // 60)
        
        return None

    def check_ttl_not_lowered(self, simulated_time: datetime) -> List[CheckResult]:
        results = []
        check_id = f"ttl_check_{self._simulation_id}"
        
        for record in self.dns_records:
            if record.domain != self.switch_plan.domain:
                continue
            
            for step in self.switch_plan.steps:
                if step.phase == SwitchPhase.TTL_LOWER:
                    if record.region == step.region or record.region == Region.GLOBAL:
                        if step.start_time <= simulated_time:
                            if record.ttl > 60:
                                result = CheckResult(
                                    check_id=f"{check_id}_{record.region.value}",
                                    check_type="ttl_not_lowered",
                                    description=f"TTL 未降低检查 - {record.region.value}",
                                    result=CheckResultType.WARNING,
                                    message=f"区域 {record.region.value} 的 TTL 仍为 {record.ttl} 秒，建议降低到 60 秒以下",
                                    region=record.region,
                                    domain=record.domain,
                                    timestamp=simulated_time,
                                    details={
                                        "current_ttl": record.ttl,
                                        "recommended_ttl": 60,
                                        "step_phase": step.phase.value,
                                    }
                                )
                                results.append(result)
                            else:
                                result = CheckResult(
                                    check_id=f"{check_id}_{record.region.value}",
                                    check_type="ttl_not_lowered",
                                    description=f"TTL 已降低检查 - {record.region.value}",
                                    result=CheckResultType.PASS,
                                    message=f"区域 {record.region.value} 的 TTL 已降低到 {record.ttl} 秒",
                                    region=record.region,
                                    domain=record.domain,
                                    timestamp=simulated_time,
                                    details={"current_ttl": record.ttl}
                                )
                                results.append(result)
        
        return results

    def check_cname_drift(self, simulated_time: datetime) -> List[CheckResult]:
        results = []
        check_id = f"cname_drift_{self._simulation_id}"
        
        vendor_records = defaultdict(list)
        for export in self.vendor_exports:
            if export.domain == self.switch_plan.domain:
                vendor_records[export.vendor].append(export)
        
        effective_regions = self.get_effective_regions(simulated_time)
        current_phase = self.get_current_phase(simulated_time)
        
        for record in self.dns_records:
            if record.domain != self.switch_plan.domain:
                continue
            if record.record_type.value != "CNAME":
                continue
            
            current_vendor = self.vendor_by_cname.get(record.value.lower())
            is_effective = effective_regions.get(record.region, False)
            
            expected_vendor = self.switch_plan.original_vendor
            if is_effective and current_phase in [SwitchPhase.TRAFFIC_SHIFT, SwitchPhase.STABILIZATION, SwitchPhase.COMPLETE]:
                for step in self.switch_plan.steps:
                    if step.region == record.region and step.phase in [SwitchPhase.TRAFFIC_SHIFT, SwitchPhase.STABILIZATION]:
                        expected_vendor = step.target_vendor
                        break
            
            if current_phase == SwitchPhase.ROLLBACK:
                for step in self.switch_plan.steps:
                    if step.phase == SwitchPhase.ROLLBACK and step.region == record.region:
                        expected_vendor = step.target_vendor
                        break
            
            if current_vendor and current_vendor != expected_vendor:
                result = CheckResult(
                    check_id=f"{check_id}_{record.region.value}",
                    check_type="cname_drift",
                    description=f"CNAME 漂移检查 - {record.region.value}",
                    result=CheckResultType.FAIL,
                    message=f"区域 {record.region.value} 的 CNAME 指向 {current_vendor.value}，但预期应为 {expected_vendor.value}",
                    region=record.region,
                    domain=record.domain,
                    timestamp=simulated_time,
                    details={
                        "current_cname": record.value,
                        "current_vendor": current_vendor.value,
                        "expected_vendor": expected_vendor.value,
                        "is_effective": is_effective,
                        "phase": current_phase.value if current_phase else None,
                    }
                )
                results.append(result)
            else:
                result = CheckResult(
                    check_id=f"{check_id}_{record.region.value}",
                    check_type="cname_drift",
                    description=f"CNAME 正常检查 - {record.region.value}",
                    result=CheckResultType.PASS,
                    message=f"区域 {record.region.value} 的 CNAME 指向正确: {current_vendor.value if current_vendor else record.value}",
                    region=record.region,
                    domain=record.domain,
                    timestamp=simulated_time,
                    details={
                        "current_vendor": current_vendor.value if current_vendor else None,
                        "expected_vendor": expected_vendor.value,
                    }
                )
                results.append(result)
        
        return results

    def check_probe_failures(self, simulated_time: datetime, time_window_minutes: int = 30) -> List[CheckResult]:
        results = []
        check_id = f"probe_check_{self._simulation_id}"
        
        window_start = simulated_time - timedelta(minutes=time_window_minutes)
        
        region_probes: Dict[Region, List[ProbeLog]] = defaultdict(list)
        for log in self.probe_logs:
            if log.domain == self.switch_plan.domain:
                if window_start <= log.timestamp <= simulated_time:
                    region_probes[log.region].append(log)
        
        for region, probes in region_probes.items():
            if not probes:
                continue
            
            total = len(probes)
            failures = sum(1 for p in probes if not p.success)
            failure_rate = failures / total if total > 0 else 0
            
            http_failures = sum(1 for p in probes if p.http_status and p.http_status >= 400)
            
            if failure_rate > 0.1:
                result = CheckResult(
                    check_id=f"{check_id}_{region.value}",
                    check_type="probe_failure",
                    description=f"探测失败检查 - {region.value}",
                    result=CheckResultType.FAIL,
                    message=f"区域 {region.value} 探测失败率 {failure_rate:.1%}，超过 10% 阈值",
                    region=region,
                    domain=self.switch_plan.domain,
                    timestamp=simulated_time,
                    details={
                        "total_probes": total,
                        "failures": failures,
                        "failure_rate": failure_rate,
                        "http_failures": http_failures,
                        "time_window_minutes": time_window_minutes,
                    }
                )
                results.append(result)
            elif failures > 0:
                result = CheckResult(
                    check_id=f"{check_id}_{region.value}",
                    check_type="probe_failure",
                    description=f"探测警告检查 - {region.value}",
                    result=CheckResultType.WARNING,
                    message=f"区域 {region.value} 存在 {failures} 次探测失败，失败率 {failure_rate:.1%}",
                    region=region,
                    domain=self.switch_plan.domain,
                    timestamp=simulated_time,
                    details={
                        "total_probes": total,
                        "failures": failures,
                        "failure_rate": failure_rate,
                    }
                )
                results.append(result)
            else:
                result = CheckResult(
                    check_id=f"{check_id}_{region.value}",
                    check_type="probe_failure",
                    description=f"探测正常检查 - {region.value}",
                    result=CheckResultType.PASS,
                    message=f"区域 {region.value} 全部 {total} 次探测成功",
                    region=region,
                    domain=self.switch_plan.domain,
                    timestamp=simulated_time,
                    details={"total_probes": total}
                )
                results.append(result)
        
        return results

    def check_rollback_window(self, simulated_time: datetime) -> List[CheckResult]:
        results = []
        check_id = f"rollback_window_{self._simulation_id}"
        
        rollback_steps = [s for s in self.switch_plan.steps if s.phase == SwitchPhase.ROLLBACK]
        
        if not rollback_steps:
            result = CheckResult(
                check_id=f"{check_id}_no_plan",
                check_type="rollback_window",
                description="回滚计划检查",
                result=CheckResultType.WARNING,
                message="切换计划中未定义回滚步骤",
                domain=self.switch_plan.domain,
                timestamp=simulated_time,
                details={}
            )
            results.append(result)
            return results
        
        remaining_window = self.calculate_rollback_window(simulated_time)
        current_phase = self.get_current_phase(simulated_time)
        
        if current_phase == SwitchPhase.ROLLBACK:
            if remaining_window is not None and remaining_window < 5:
                result = CheckResult(
                    check_id=f"{check_id}_critical",
                    check_type="rollback_window",
                    description="回滚窗口检查 - 紧急",
                    result=CheckResultType.FAIL,
                    message=f"回滚窗口仅剩 {remaining_window} 分钟，即将超时！",
                    domain=self.switch_plan.domain,
                    timestamp=simulated_time,
                    details={
                        "remaining_minutes": remaining_window,
                        "threshold_minutes": 5,
                    }
                )
                results.append(result)
            elif remaining_window is not None:
                result = CheckResult(
                    check_id=f"{check_id}_active",
                    check_type="rollback_window",
                    description="回滚窗口检查 - 进行中",
                    result=CheckResultType.INFO,
                    message=f"回滚进行中，剩余窗口 {remaining_window} 分钟",
                    domain=self.switch_plan.domain,
                    timestamp=simulated_time,
                    details={"remaining_minutes": remaining_window}
                )
                results.append(result)
        else:
            for step in rollback_steps:
                result = CheckResult(
                    check_id=f"{check_id}_planned_{step.region.value}",
                    check_type="rollback_window",
                    description=f"回滚计划检查 - {step.region.value}",
                    result=CheckResultType.INFO,
                    message=f"区域 {step.region.value} 回滚计划已准备，预计持续 {step.duration_minutes} 分钟",
                    region=step.region,
                    domain=self.switch_plan.domain,
                    timestamp=simulated_time,
                    details={
                        "rollback_start": step.start_time.isoformat(),
                        "duration_minutes": step.duration_minutes,
                    }
                )
                results.append(result)
        
        return results

    def run_all_checks(self, simulated_time: datetime) -> List[CheckResult]:
        all_results: List[CheckResult] = []
        
        all_results.extend(self.check_ttl_not_lowered(simulated_time))
        all_results.extend(self.check_cname_drift(simulated_time))
        all_results.extend(self.check_probe_failures(simulated_time))
        all_results.extend(self.check_rollback_window(simulated_time))
        
        return all_results

    def generate_review_items(self, check_results: List[CheckResult]) -> List[ReviewItem]:
        review_items = []
        
        for result in check_results:
            if result.result in [CheckResultType.FAIL, CheckResultType.WARNING]:
                status = ReviewStatus.NEEDS_REVIEW
            else:
                status = ReviewStatus.PENDING
            
            item = ReviewItem(
                item_id=f"review_{result.check_id}",
                check_result_id=result.check_id,
                status=status,
            )
            review_items.append(item)
        
        return review_items

    def simulate(self, simulated_time: Optional[datetime] = None) -> SimulationResult:
        if simulated_time is None:
            simulated_time = datetime.now()
        
        check_results = self.run_all_checks(simulated_time)
        review_items = self.generate_review_items(check_results)
        effective_regions = self.get_effective_regions(simulated_time)
        rollback_window = self.calculate_rollback_window(simulated_time)
        
        current_phase = self.get_current_phase(simulated_time)
        rollback_available = (
            current_phase in [SwitchPhase.TRAFFIC_SHIFT, SwitchPhase.STABILIZATION] or
            current_phase == SwitchPhase.ROLLBACK
        )
        
        return SimulationResult(
            simulation_id=self._simulation_id,
            plan_id=self.switch_plan.plan_id,
            domain=self.switch_plan.domain,
            simulated_time=simulated_time,
            check_results=check_results,
            review_items=review_items,
            effective_regions=effective_regions,
            rollback_available=rollback_available,
            rollback_window_minutes=rollback_window,
        )
