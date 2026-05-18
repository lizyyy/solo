#!/usr/bin/env python3
import argparse
import json
import csv
import os
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class ValidationStatus(Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    ERROR = "ERROR"


@dataclass
class ValidationIssue:
    type: str
    severity: ValidationStatus
    message: str
    record_id: str
    details: Dict[str, Any]


@dataclass
class ValidationResult:
    total_records: int
    passed: int
    warnings: int
    errors: int
    issues: List[ValidationIssue]
    output_file: Optional[str] = None


class DisinfectionValidator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.issues: List[ValidationIssue] = []

    def validate_record(self, record: Dict[str, Any], record_index: int) -> None:
        record_id = record.get("器械编号", f"RECORD_{record_index}")
        
        self._check_sterilizer_offline(record, record_id)
        self._check_cross_department_borrow(record, record_id)
        self._check_disinfection_completeness(record, record_id)
        self._check_timeline_consistency(record, record_id)

    def _check_sterilizer_offline(self, record: Dict[str, Any], record_id: str) -> None:
        sterilizer = record.get("消毒机编号", "")
        sterilize_time = record.get("消毒时间", "")
        offline_sterilizers = self.config.get("offline_sterilizers", [])
        
        if sterilizer in offline_sterilizers:
            self.issues.append(ValidationIssue(
                type="消毒机离线",
                severity=ValidationStatus.ERROR,
                message=f"消毒机 {sterilizer} 处于离线维护状态，不应使用",
                record_id=record_id,
                details={
                    "消毒机编号": sterilizer,
                    "消毒时间": sterilize_time,
                    "预计恢复时间": self.config.get("sterilizer_maintenance", {}).get(sterilizer, "未知")
                }
            ))

    def _check_cross_department_borrow(self, record: Dict[str, Any], record_id: str) -> None:
        owner_dept = record.get("所属科室", "")
        use_dept = record.get("使用科室", "")
        allowed_cross = self.config.get("allowed_cross_departments", {})
        
        if owner_dept != use_dept:
            cross_key = f"{owner_dept}->{use_dept}"
            if cross_key not in allowed_cross:
                self.issues.append(ValidationIssue(
                    type="跨科室借用未审批",
                    severity=ValidationStatus.WARNING,
                    message=f"器械从 {owner_dept} 借到 {use_dept}，未在允许借用列表中",
                    record_id=record_id,
                    details={
                        "所属科室": owner_dept,
                        "使用科室": use_dept,
                        "需要审批": True
                    }
                ))
            else:
                approval_status = record.get("借用审批状态", "")
                if approval_status != "已审批":
                    self.issues.append(ValidationIssue(
                        type="跨科室借用审批缺失",
                        severity=ValidationStatus.ERROR,
                        message=f"器械从 {owner_dept} 借到 {use_dept}，但缺少审批记录",
                        record_id=record_id,
                        details={
                            "所属科室": owner_dept,
                            "使用科室": use_dept,
                            "当前审批状态": approval_status
                        }
                    ))

    def _check_disinfection_completeness(self, record: Dict[str, Any], record_id: str) -> None:
        required_fields = ["消毒前检查", "消毒方式", "消毒时长", "消毒后检测"]
        missing_fields = [f for f in required_fields if not record.get(f)]
        
        if missing_fields:
            self.issues.append(ValidationIssue(
                type="消毒记录不完整",
                severity=ValidationStatus.ERROR,
                message=f"缺少必填消毒字段: {', '.join(missing_fields)}",
                record_id=record_id,
                details={"缺失字段": missing_fields}
            ))

    def _check_timeline_consistency(self, record: Dict[str, Any], record_id: str) -> None:
        receive_time = record.get("回收时间", "")
        sterilize_time = record.get("消毒时间", "")
        issue_time = record.get("发放时间", "")
        
        try:
            if receive_time and sterilize_time:
                receive_dt = datetime.fromisoformat(receive_time)
                sterilize_dt = datetime.fromisoformat(sterilize_time)
                if sterilize_dt < receive_dt:
                    self.issues.append(ValidationIssue(
                        type="时间逻辑错误",
                        severity=ValidationStatus.ERROR,
                        message="消毒时间早于回收时间",
                        record_id=record_id,
                        details={
                            "回收时间": receive_time,
                            "消毒时间": sterilize_time
                        }
                    ))
            
            if sterilize_time and issue_time:
                sterilize_dt = datetime.fromisoformat(sterilize_time)
                issue_dt = datetime.fromisoformat(issue_time)
                if issue_dt < sterilize_dt:
                    self.issues.append(ValidationIssue(
                        type="时间逻辑错误",
                        severity=ValidationStatus.ERROR,
                        message="发放时间早于消毒时间",
                        record_id=record_id,
                        details={
                            "消毒时间": sterilize_time,
                            "发放时间": issue_time
                        }
                    ))
        except ValueError:
            pass


def load_config(config_path: str) -> Dict[str, Any]:
    default_config = {
        "offline_sterilizers": ["DIS-003", "DIS-007"],
        "sterilizer_maintenance": {
            "DIS-003": "2026-06-15",
            "DIS-007": "2026-05-30"
        },
        "allowed_cross_departments": [
            "牙体牙髓科->修复科",
            "正畸科->牙周科",
            "口腔外科->种植科"
        ],
        "required_disinfection_fields": [
            "器械编号", "器械名称", "所属科室", "使用科室",
            "回收时间", "消毒机编号", "消毒时间", "消毒方式",
            "消毒时长", "消毒前检查", "消毒后检测", "发放时间"
        ]
    }
    
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            user_config = json.load(f)
            default_config.update(user_config)
    
    return default_config


def load_input_file(input_path: str) -> List[Dict[str, Any]]:
    if input_path.endswith('.json'):
        with open(input_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    elif input_path.endswith('.csv'):
        with open(input_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            return list(reader)
    else:
        raise ValueError(f"不支持的文件格式: {input_path}")


def generate_output(records: List[Dict[str, Any]], result: ValidationResult, 
                   output_path: str, is_preview: bool) -> None:
    if is_preview:
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base, ext = os.path.splitext(output_path)
    output_path_with_ts = f"{base}_{timestamp}{ext}"
    
    output_data = {
        "run_info": {
            "timestamp": datetime.now().isoformat(),
            "total_records": result.total_records,
            "passed": result.passed,
            "warnings": result.warnings,
            "errors": result.errors
        },
        "validated_records": [],
        "issues": [
            {
                "type": issue.type,
                "severity": issue.severity.value,
                "message": issue.message,
                "record_id": issue.record_id,
                "details": issue.details
            }
            for issue in result.issues
        ]
    }
    
    for idx, record in enumerate(records):
        record_id = record.get("器械编号", f"RECORD_{idx}")
        record_issues = [
            {
                "type": i.type,
                "severity": i.severity.value,
                "message": i.message,
                "record_id": i.record_id,
                "details": i.details
            }
            for i in result.issues if i.record_id == record_id
        ]
        record_status = "PASS"
        if any(i['severity'] == 'ERROR' for i in record_issues):
            record_status = "ERROR"
        elif any(i['severity'] == 'WARNING' for i in record_issues):
            record_status = "WARNING"
            
        output_data["validated_records"].append({
            **record,
            "_validation_status": record_status,
            "_validation_issues": record_issues
        })
    
    with open(output_path_with_ts, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n结果已写入: {output_path_with_ts}")


def print_preview(result: ValidationResult) -> None:
    print("\n" + "="*80)
    print("预览模式 - 消毒台账验收报告")
    print("="*80)
    
    print(f"\n总记录数: {result.total_records}")
    print(f"通过: {result.passed}")
    print(f"警告: {result.warnings}")
    print(f"错误: {result.errors}")
    
    if result.issues:
        print("\n" + "-"*80)
        print("问题详情:")
        print("-"*80)
        
        for idx, issue in enumerate(result.issues, 1):
            status_icon = "❌" if issue.severity == ValidationStatus.ERROR else "⚠️"
            print(f"\n{idx}. {status_icon} [{issue.type}] - 记录 {issue.record_id}")
            print(f"   消息: {issue.message}")
            print(f"   详情: {json.dumps(issue.details, ensure_ascii=False)}")
    
    print("\n" + "="*80)
    if result.errors > 0:
        print("❌ 验收未通过，请修复错误后重新运行")
    elif result.warnings > 0:
        print("⚠️ 验收通过但有警告，建议确认后使用 --正式模式 写入结果")
    else:
        print("✅ 验收通过，可使用 --正式模式 写入结果")
    print("="*80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="牙科器材库器械消毒台账 CLI 验收工具")
    parser.add_argument("输入文件", help="输入的消毒台账文件 (JSON或CSV格式)")
    parser.add_argument("--正式模式", action="store_true", help="正式模式：写入结果文件，默认预览模式")
    parser.add_argument("--配置", default="config.json", help="规则配置文件路径，默认 config.json")
    parser.add_argument("--输出", default="消毒台账验收结果.json", help="输出文件路径")
    
    args = parser.parse_args()
    
    config = load_config(args.配置)
    records = load_input_file(args.输入文件)
    
    validator = DisinfectionValidator(config)
    for idx, record in enumerate(records):
        validator.validate_record(record, idx)
    
    errors = sum(1 for i in validator.issues if i.severity == ValidationStatus.ERROR)
    warnings = sum(1 for i in validator.issues if i.severity == ValidationStatus.WARNING)
    
    result = ValidationResult(
        total_records=len(records),
        passed=len(records) - errors,
        warnings=warnings,
        errors=errors,
        issues=validator.issues
    )
    
    if not args.正式模式:
        print_preview(result)
        if result.errors == 0:
            print("💡 确认无误后，添加 --正式模式 参数运行以写入结果文件")
    else:
        generate_output(records, result, args.输出, is_preview=False)
        print_preview(result)


if __name__ == "__main__":
    main()
