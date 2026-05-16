import json
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple, Set
from dateutil import parser as date_parser
from .models import (
    ContractSubmission, ProcessingResult, FailureRecord,
    ContractStatus, FailureType, LogSamplingConfig, PaymentReceipt
)
from .storage import Storage


class ContractProcessor:
    def __init__(self, storage: Storage = None, config: LogSamplingConfig = None):
        self.storage = storage or Storage()
        self.config = config or LogSamplingConfig()
        self.failure_records: List[FailureRecord] = []
        self.abnormal_samples_path = Path(self.config.abnormal_export_path)
        self.abnormal_samples_path.mkdir(parents=True, exist_ok=True)
    
    def _parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return date_parser.parse(value)
        raise ValueError(f"无法解析时间: {value}")
    
    def _normalize_datetime_str(self, value: Any) -> str:
        if not value:
            return ""
        try:
            dt = self._parse_datetime(value)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except:
            return str(value)
    
    def _compare_dicts(self, d1: Dict[str, Any], d2: Dict[str, Any], keys: Set[str]) -> Tuple[bool, List[str]]:
        differences = []
        for key in keys:
            v1 = d1.get(key)
            v2 = d2.get(key)
            if v1 != v2:
                differences.append(key)
        return len(differences) == 0, differences
    
    def _compare_supplements(self, s1: List[Dict], s2: List[Dict]) -> Tuple[bool, List[str]]:
        differences = []
        if len(s1) != len(s2):
            differences.append(f"补充页数量不一致: {len(s1)} vs {len(s2)}")
            return False, differences
        
        supplement_keys = {'supplement_id', 'supplement_type', 'content', 'operator'}
        
        for i, (sup1, sup2) in enumerate(zip(s1, s2)):
            same, diff = self._compare_dicts(sup1, sup2, supplement_keys)
            if not same:
                differences.append(f"补充页[{i}]差异: {', '.join(diff)}")
        
        return len(differences) == 0, differences
    
    def compare_submission_content(self, new_submission: Dict[str, Any], 
                                  old_submission: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        differences = {}
        
        core_keys = {'contract_name', 'party_a', 'party_b'}
        _, core_diff = self._compare_dicts(new_submission, old_submission, core_keys)
        if core_diff:
            differences['core_info'] = core_diff
        
        time_keys = {'sign_time_a', 'sign_time_b', 'create_time'}
        for key in time_keys:
            new_time = self._normalize_datetime_str(new_submission.get(key, ''))
            old_time = self._normalize_datetime_str(old_submission.get(key, ''))
            if new_time != old_time:
                if 'time_info' not in differences:
                    differences['time_info'] = []
                differences['time_info'].append(key)
        
        new_sups = new_submission.get('supplements', [])
        old_sups = old_submission.get('supplements', [])
        _, sup_diff = self._compare_supplements(new_sups, old_sups)
        if sup_diff:
            differences['supplements'] = sup_diff
        
        if new_submission.get('batch_id') != old_submission.get('batch_id'):
            differences['batch_id'] = [f"{old_submission.get('batch_id')} -> {new_submission.get('batch_id')}"]
        
        is_same = len(differences) == 0
        return is_same, differences
    
    def validate_time_order(self, submission_data: Dict[str, Any]) -> Tuple[bool, str]:
        try:
            sign_time_a = self._parse_datetime(submission_data['sign_time_a'])
            sign_time_b = self._parse_datetime(submission_data['sign_time_b'])
            
            if sign_time_b < sign_time_a:
                error_msg = f"时间顺序错误: 乙方签署时间({sign_time_b})早于甲方签署时间({sign_time_a})"
                return False, error_msg
            return True, ""
        except Exception as e:
            return False, f"时间解析错误: {str(e)}"
    
    def check_duplicate_submission(self, contract_id: str) -> Tuple[bool, Dict[str, Any], Dict[str, Any]]:
        existing_result = self.storage.find_result_by_contract(contract_id)
        if existing_result:
            existing_submission = self.storage.find_existing_contract(contract_id)
            return True, existing_result, existing_submission or {}
        return False, {}, {}
    
    def save_payment_receipts(self, submission_data: Dict[str, Any]):
        for receipt_data in submission_data.get('payment_receipts', []):
            receipt = PaymentReceipt(
                receipt_id=receipt_data['receipt_id'],
                contract_id=receipt_data['contract_id'],
                payment_channel=receipt_data['payment_channel'],
                amount=receipt_data['amount'],
                payment_time=self._parse_datetime(receipt_data['payment_time']),
                manual_remark=receipt_data.get('manual_remark'),
                caller=receipt_data['caller'],
                create_time=self._parse_datetime(receipt_data.get('create_time', datetime.now()))
            )
            self.storage.save_payment_receipt(receipt)
    
    def handle_failure(self, submission_data: Dict[str, Any], failure_type: FailureType, 
                      error_message: str) -> FailureRecord:
        failure = FailureRecord(
            batch_id=submission_data['batch_id'],
            contract_id=submission_data['contract_id'],
            failure_type=failure_type,
            error_message=error_message,
            submission_data=submission_data
        )
        
        failure_path = self.storage.save_failure(failure)
        self.failure_records.append(failure)
        
        if self.config.export_abnormal_samples:
            self._export_abnormal_sample(failure)
        
        return failure
    
    def _export_abnormal_sample(self, failure: FailureRecord):
        sample_file = self.abnormal_samples_path / f"{failure.contract_id}_abnormal.json"
        with open(sample_file, 'w', encoding='utf-8') as f:
            json.dump(failure.dict(), f, ensure_ascii=False, indent=2, default=str)
    
    def should_sample(self, is_failure: bool = False) -> bool:
        if not self.config.enabled:
            return False
        sample_rate = self.config.failure_sample_rate if is_failure else self.config.sample_rate
        return random.random() < sample_rate
    
    def process_submission(self, submission_data: Dict[str, Any]) -> ProcessingResult:
        contract_id = submission_data['contract_id']
        batch_id = submission_data['batch_id']
        
        is_duplicate, existing_result, existing_submission = self.check_duplicate_submission(contract_id)
        if is_duplicate:
            is_content_same, differences = self.compare_submission_content(
                submission_data, existing_submission
            )
            
            if existing_result.get('status') == ContractStatus.VERIFIED:
                if is_content_same:
                    return ProcessingResult(
                        batch_id=batch_id,
                        contract_id=contract_id,
                        status=ContractStatus.VERIFIED,
                        is_reused=True,
                        original_batch_id=existing_result.get('batch_id'),
                        details={
                            "message": "复用之前的校验通过结果，提交内容完全一致",
                            "original_batch_id": existing_result.get('batch_id')
                        }
                    )
                else:
                    return ProcessingResult(
                        batch_id=batch_id,
                        contract_id=contract_id,
                        status=ContractStatus.CONFLICT,
                        failure_type=FailureType.DUPLICATE_SUBMISSION,
                        is_reused=False,
                        original_batch_id=existing_result.get('batch_id'),
                        error_message=f"合同{contract_id}已存在但内容有变更，无法复用旧结论",
                        details={
                            "message": "合同ID相同但提交内容不一致，请核实是否为重传",
                            "content_differences": differences,
                            "original_batch_id": existing_result.get('batch_id'),
                            "original_status": existing_result.get('status')
                        }
                    )
            else:
                return ProcessingResult(
                    batch_id=batch_id,
                    contract_id=contract_id,
                    status=ContractStatus.CONFLICT,
                    failure_type=FailureType.DUPLICATE_SUBMISSION,
                    error_message=f"合同{contract_id}已存在，之前处理结果为{existing_result.get('status')}",
                    original_batch_id=existing_result.get('batch_id'),
                    details={
                        "original_status": existing_result.get('status'),
                        "content_differences": differences if not is_content_same else {}
                    }
                )
        
        self.storage._save_json(
            self.storage.submissions_path / f"{batch_id}_{contract_id}.json",
            submission_data
        )
        
        time_valid, time_error = self.validate_time_order(submission_data)
        if not time_valid:
            self.handle_failure(
                submission_data,
                FailureType.TIME_ORDER_ERROR,
                time_error
            )
            result = ProcessingResult(
                batch_id=batch_id,
                contract_id=contract_id,
                status=ContractStatus.REJECTED,
                failure_type=FailureType.TIME_ORDER_ERROR,
                error_message=time_error
            )
            self.storage.save_result(result)
            self.save_payment_receipts(submission_data)
            return result
        
        self.save_payment_receipts(submission_data)
        
        result = ProcessingResult(
            batch_id=batch_id,
            contract_id=contract_id,
            status=ContractStatus.VERIFIED,
            details={"message": "校验通过"}
        )
        
        self.storage.save_result(result)
        return result
    
    def process_batch(self, submissions: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = []
        success_count = 0
        failure_count = 0
        reused_count = 0
        conflict_count = 0
        
        for submission in submissions:
            result = self.process_submission(submission)
            results.append(result.dict())
            
            if result.status == ContractStatus.VERIFIED:
                if result.is_reused:
                    reused_count += 1
                else:
                    success_count += 1
            elif result.status == ContractStatus.REJECTED:
                failure_count += 1
            elif result.status == ContractStatus.CONFLICT:
                conflict_count += 1
        
        return {
            "total": len(submissions),
            "success": success_count,
            "failure": failure_count,
            "reused": reused_count,
            "conflict": conflict_count,
            "results": results,
            "processed_at": datetime.now().isoformat()
        }
    
    def export_failures_report(self, output_path: str = "output/failures_report.json") -> str:
        failures = self.storage.get_all_failures()
        report = {
            "total_failures": len(failures),
            "failures": failures,
            "exported_at": datetime.now().isoformat()
        }
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        
        return str(output_file)
