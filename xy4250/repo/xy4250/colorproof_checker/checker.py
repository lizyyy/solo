from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal
from dataclasses import dataclass

from colorproof_checker.models import (
    ProofTask, ColorMeasurement, InkFormula, PaperBatch,
    DryingRecord, CustomerTolerance, ProofStatus, RiskLevel
)
from colorproof_checker.store import DataStore, parse_decimal


@dataclass
class CheckResult:
    passed: bool
    risk_level: RiskLevel
    check_type: str
    message: str
    details: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class QualityChecker:
    def __init__(self, store: DataStore):
        self.store = store
    
    def check_proof_task(self, proof: ProofTask) -> Tuple[RiskLevel, List[CheckResult], List[Dict[str, Any]]]:
        all_checks = []
        all_risks = []
        overall_risk = RiskLevel.SAFE
        
        tolerance = self.store.get_customer_tolerance(proof.customer_id)
        if tolerance is None:
            tolerance = CustomerTolerance(
                customer_id=proof.customer_id,
                customer_name=proof.customer_name
            )
        
        if proof.color_measurement_id:
            measurement = self.store.get_color_measurement(proof.color_measurement_id)
            if measurement:
                delta_e_result = self._check_delta_e(measurement, tolerance, proof)
                all_checks.append(delta_e_result)
                if delta_e_result.risk_level.value > overall_risk.value:
                    overall_risk = delta_e_result.risk_level
                if not delta_e_result.passed:
                    all_risks.append(self._check_result_to_risk(delta_e_result))
        
        color_mix_result = self._check_color_mixing(proof)
        all_checks.append(color_mix_result)
        if color_mix_result.risk_level.value > overall_risk.value:
            overall_risk = color_mix_result.risk_level
        if not color_mix_result.passed:
            all_risks.append(self._check_result_to_risk(color_mix_result))
        
        paper_batch = self.store.get_paper_batch_by_number(proof.paper_batch_number)
        if paper_batch:
            batch_result = self._check_paper_expiry(paper_batch, proof)
            all_checks.append(batch_result)
            if batch_result.risk_level.value > overall_risk.value:
                overall_risk = batch_result.risk_level
            if not batch_result.passed:
                all_risks.append(self._check_result_to_risk(batch_result))
        
        if proof.drying_record_id:
            drying_record = self.store.get_drying_record(proof.drying_record_id)
            if drying_record:
                drying_result = self._check_drying_time(drying_record, tolerance, proof)
                all_checks.append(drying_result)
                if drying_result.risk_level.value > overall_risk.value:
                    overall_risk = drying_result.risk_level
                if not drying_result.passed:
                    all_risks.append(self._check_result_to_risk(drying_result))
        
        return overall_risk, all_checks, all_risks
    
    def _check_result_to_risk(self, result: CheckResult) -> Dict[str, Any]:
        return {
            'check_type': result.check_type,
            'risk_level': result.risk_level.value,
            'message': result.message,
            'details': result.details,
            'timestamp': datetime.now().isoformat()
        }
    
    def _check_delta_e(self, measurement: ColorMeasurement, tolerance: CustomerTolerance, 
                       proof: ProofTask) -> CheckResult:
        delta_e = measurement.delta_e
        threshold = tolerance.delta_e_tolerance
        
        if proof.color_code in tolerance.special_tolerances:
            threshold = tolerance.special_tolerances[proof.color_code]
        
        details = {
            'measurement_id': measurement.id,
            'sample_name': measurement.sample_name,
            'delta_e': str(delta_e),
            'threshold': str(threshold),
            'customer_id': tolerance.customer_id,
            'color_code': proof.color_code
        }
        
        if delta_e > threshold:
            excess = delta_e - threshold
            if excess > Decimal("3.0"):
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.CRITICAL,
                    check_type='delta_e',
                    message=f"DeltaE 严重超标! 测得值: {delta_e}, 容差: {threshold}, 超出: {excess}",
                    details=details
                )
            else:
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.WARNING,
                    check_type='delta_e',
                    message=f"DeltaE 超标! 测得值: {delta_e}, 容差: {threshold}, 超出: {excess}",
                    details=details
                )
        
        return CheckResult(
            passed=True,
            risk_level=RiskLevel.SAFE,
            check_type='delta_e',
            message=f"DeltaE 合格: {delta_e} (容差: {threshold})",
            details=details
        )
    
    def _check_color_mixing(self, proof: ProofTask) -> CheckResult:
        all_proofs = self.store.list_proof_tasks()
        
        same_customer_proofs = [
            p for p in all_proofs 
            if p.customer_id == proof.customer_id 
            and p.id != proof.id
            and p.status in [ProofStatus.PENDING, ProofStatus.APPROVED, ProofStatus.RELEASED]
        ]
        
        details = {
            'proof_id': proof.id,
            'task_number': proof.task_number,
            'customer_id': proof.customer_id,
            'color_code': proof.color_code
        }
        
        same_color_proofs = []
        for p in same_customer_proofs:
            if p.color_code == proof.color_code:
                same_color_proofs.append({
                    'id': p.id,
                    'task_number': p.task_number,
                    'status': p.status.value,
                    'paper_batch_number': p.paper_batch_number
                })
        
        if same_color_proofs:
            details['other_proofs'] = same_color_proofs
            paper_batches = set()
            paper_batches.add(proof.paper_batch_number)
            for p in same_color_proofs:
                paper_batches.add(p['paper_batch_number'])
            
            if len(paper_batches) > 1:
                details['paper_batches_used'] = list(paper_batches)
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.CRITICAL,
                    check_type='color_mixing',
                    message=f"风险: 同一客户色号 '{proof.color_code}' 混用了不同纸张批次! 批次: {', '.join(paper_batches)}",
                    details=details
                )
            
            return CheckResult(
                passed=True,
                risk_level=RiskLevel.WARNING,
                check_type='color_mixing',
                message=f"注意: 存在 {len(same_color_proofs)} 个相同色号的其他打样任务",
                details=details
            )
        
        return CheckResult(
            passed=True,
            risk_level=RiskLevel.SAFE,
            check_type='color_mixing',
            message=f"色号 '{proof.color_code}' 无混用风险",
            details=details
        )
    
    def _check_paper_expiry(self, paper_batch: PaperBatch, proof: ProofTask) -> CheckResult:
        today = date.today()
        
        details = {
            'paper_batch_id': paper_batch.id,
            'batch_number': paper_batch.batch_number,
            'paper_name': paper_batch.paper_name,
            'grammage': paper_batch.grammage,
            'manufacture_date': str(paper_batch.manufacture_date) if paper_batch.manufacture_date else None,
            'expiry_date': str(paper_batch.expiry_date) if paper_batch.expiry_date else None,
            'check_date': str(today)
        }
        
        if not paper_batch.expiry_date:
            return CheckResult(
                passed=True,
                risk_level=RiskLevel.WARNING,
                check_type='paper_expiry',
                message=f"注意: 纸张批次 '{paper_batch.batch_number}' 未设置有效期",
                details=details
            )
        
        if paper_batch.expiry_date < today:
            days_expired = (today - paper_batch.expiry_date).days
            details['days_expired'] = days_expired
            
            if days_expired > 30:
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.CRITICAL,
                    check_type='paper_expiry',
                    message=f"纸张批次严重过期! 批次: {paper_batch.batch_number}, 有效期至: {paper_batch.expiry_date}, 已过期 {days_expired} 天",
                    details=details
                )
            else:
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.WARNING,
                    check_type='paper_expiry',
                    message=f"纸张批次已过期! 批次: {paper_batch.batch_number}, 有效期至: {paper_batch.expiry_date}, 已过期 {days_expired} 天",
                    details=details
                )
        
        days_remaining = (paper_batch.expiry_date - today).days
        details['days_remaining'] = days_remaining
        
        if days_remaining < 7:
            return CheckResult(
                passed=True,
                risk_level=RiskLevel.WARNING,
                check_type='paper_expiry',
                message=f"纸张批次即将过期! 批次: {paper_batch.batch_number}, 剩余 {days_remaining} 天",
                details=details
            )
        
        return CheckResult(
            passed=True,
            risk_level=RiskLevel.SAFE,
            check_type='paper_expiry',
            message=f"纸张批次有效: {paper_batch.batch_number}, 有效期至: {paper_batch.expiry_date}, 剩余 {days_remaining} 天",
            details=details
        )
    
    def _check_drying_time(self, drying_record: DryingRecord, tolerance: CustomerTolerance,
                           proof: ProofTask) -> CheckResult:
        now = datetime.now()
        min_drying_hours = tolerance.min_drying_hours
        
        details = {
            'drying_record_id': drying_record.id,
            'proof_id': drying_record.proof_id,
            'print_time': str(drying_record.print_time),
            'drying_start_time': str(drying_record.drying_start_time),
            'drying_end_time': str(drying_record.drying_end_time) if drying_record.drying_end_time else None,
            'drying_method': drying_record.drying_method,
            'min_drying_hours': str(min_drying_hours),
            'check_time': str(now)
        }
        
        if drying_record.drying_end_time:
            drying_duration = drying_record.drying_end_time - drying_record.drying_start_time
            drying_hours = Decimal(str(drying_duration.total_seconds() / 3600))
            details['actual_drying_hours'] = str(drying_hours)
            
            if drying_hours < min_drying_hours:
                deficit = min_drying_hours - drying_hours
                details['deficit_hours'] = str(deficit)
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.WARNING,
                    check_type='drying_time',
                    message=f"干燥时间不足! 实际: {drying_hours:.2f}小时, 要求: {min_drying_hours}小时, 缺少: {deficit:.2f}小时",
                    details=details
                )
            
            if drying_record.touch_check_result is False:
                return CheckResult(
                    passed=False,
                    risk_level=RiskLevel.CRITICAL,
                    check_type='drying_time',
                    message=f"触感检查不合格! 即使干燥时间达标 ({drying_hours:.2f}小时), 仍未干透",
                    details=details
                )
            
            return CheckResult(
                passed=True,
                risk_level=RiskLevel.SAFE,
                check_type='drying_time',
                message=f"干燥时间充足: {drying_hours:.2f}小时 (要求: {min_drying_hours}小时)",
                details=details
            )
        
        elapsed = now - drying_record.drying_start_time
        elapsed_hours = Decimal(str(elapsed.total_seconds() / 3600))
        details['elapsed_hours'] = str(elapsed_hours)
        
        if elapsed_hours < min_drying_hours:
            remaining = min_drying_hours - elapsed_hours
            details['remaining_hours'] = str(remaining)
            return CheckResult(
                passed=False,
                risk_level=RiskLevel.CRITICAL,
                check_type='drying_time',
                message=f"仍在干燥中! 已过 {elapsed_hours:.2f}小时, 还需约 {remaining:.2f}小时, 不能放行!",
                details=details
            )
        
        if drying_record.touch_check_result is None:
            return CheckResult(
                passed=True,
                risk_level=RiskLevel.WARNING,
                check_type='drying_time',
                message=f"干燥时间已达 {elapsed_hours:.2f}小时, 但未做触感检查, 建议确认后放行",
                details=details
            )
        
        if drying_record.touch_check_result is False:
            return CheckResult(
                passed=False,
                risk_level=RiskLevel.CRITICAL,
                check_type='drying_time',
                message=f"触感检查不合格! 虽然已过 {elapsed_hours:.2f}小时, 但仍未干透, 不能放行!",
                details=details
            )
        
        return CheckResult(
            passed=True,
            risk_level=RiskLevel.SAFE,
            check_type='drying_time',
            message=f"干燥完成: 已过 {elapsed_hours:.2f}小时, 触感检查合格",
            details=details
        )
    
    def run_all_checks(self) -> Dict[str, Any]:
        proofs = self.store.list_proof_tasks()
        results = {
            'summary': {
                'total': len(proofs),
                'safe': 0,
                'warning': 0,
                'critical': 0
            },
            'proofs': []
        }
        
        for proof in proofs:
            risk_level, checks, risks = self.check_proof_task(proof)
            
            proof_result = {
                'id': proof.id,
                'task_number': proof.task_number,
                'customer_name': proof.customer_name,
                'color_code': proof.color_code,
                'status': proof.status.value,
                'overall_risk': risk_level.value,
                'checks': [],
                'risks': risks
            }
            
            for check in checks:
                proof_result['checks'].append({
                    'type': check.check_type,
                    'passed': check.passed,
                    'risk_level': check.risk_level.value,
                    'message': check.message
                })
            
            if risk_level == RiskLevel.SAFE:
                results['summary']['safe'] += 1
            elif risk_level == RiskLevel.WARNING:
                results['summary']['warning'] += 1
            else:
                results['summary']['critical'] += 1
            
            results['proofs'].append(proof_result)
        
        return results
