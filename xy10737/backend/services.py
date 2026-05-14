from typing import List, Dict, Any, Optional
from models import (
    Experiment, ExperimentReport, ReportData, 
    ExperimentStatus, MutexRule, Group
)
from database import db
from datetime import datetime
import uuid
import json
import pandas as pd
from io import BytesIO


def validate_traffic_ratio(groups: List[Group]) -> Dict[str, Any]:
    total_ratio = sum(g.traffic_ratio for g in groups)
    errors = []
    
    if abs(total_ratio - 100.0) > 0.01:
        errors.append(f"流量比例总和为 {total_ratio:.1f}%，应为100%")
    
    for group in groups:
        if group.traffic_ratio < 0 or group.traffic_ratio > 100:
            errors.append(f"分组 '{group.name}' 的流量比例 {group.traffic_ratio}% 超出范围 [0, 100]")
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "total_ratio": total_ratio
    }


def validate_mutex_rules(rules: List[MutexRule]) -> Dict[str, Any]:
    errors = []
    valid_types = ["user_segment", "user_tag", "feature", "device"]
    
    for rule in rules:
        if rule.rule_type not in valid_types:
            errors.append(f"规则 '{rule.name}' 的类型 '{rule.rule_type}' 无效，有效类型: {valid_types}")
        if not rule.conditions:
            errors.append(f"规则 '{rule.name}' 的条件列表不能为空")
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors
    }


def recalculate_report(experiment: Experiment) -> ExperimentReport:
    base_values = {
        "m1": {"control": 45.0, "variance": 5.0},
        "m2": {"control": 12.0, "variance": 2.0},
    }
    
    report_data = []
    total_ratio = sum(g.traffic_ratio for g in experiment.groups)
    
    for group in experiment.groups:
        weight = group.traffic_ratio / total_ratio if total_ratio > 0 else 0
        
        for metric in experiment.metrics:
            base = base_values.get(metric.id, {"control": 50.0, "variance": 10.0})
            
            if group.is_control:
                value = base["control"]
                sample_size = int(1000 * weight)
            else:
                lift = 1.1 + (hash(group.id) % 10) / 100
                value = round(base["control"] * lift, 2)
                sample_size = int(1000 * weight)
            
            report_data.append(ReportData(
                group_id=group.id,
                metric_id=metric.id,
                value=value,
                sample_size=max(100, sample_size)
            ))
    
    return ExperimentReport(
        id=f"report-{uuid.uuid4().hex[:8]}",
        experiment_id=experiment.id,
        generated_at=datetime.now(),
        data=report_data,
        is_valid=True
    )


def create_experiment(data: Dict[str, Any]) -> Experiment:
    exp = Experiment(
        id=f"exp-{uuid.uuid4().hex[:8]}",
        **data
    )
    
    traffic_validation = validate_traffic_ratio(exp.groups)
    mutex_validation = validate_mutex_rules(exp.mutex_rules)
    
    for i, rule in enumerate(exp.mutex_rules):
        rule.is_valid = True
        rule.error_message = None
    
    for error in mutex_validation["errors"]:
        for rule in exp.mutex_rules:
            if rule.name in error:
                rule.is_valid = False
                rule.error_message = error
    
    exp.need_recalculation = not traffic_validation["is_valid"]
    
    if exp.status == ExperimentStatus.RUNNING:
        exp.report = recalculate_report(exp)
    
    return db.create_experiment(exp)


def update_experiment(exp_id: str, data: Dict[str, Any]) -> Optional[Experiment]:
    exp = db.update_experiment(exp_id, data)
    if exp and "groups" in data and data["groups"] is not None:
        traffic_validation = validate_traffic_ratio(exp.groups)
        exp.need_recalculation = not traffic_validation["is_valid"]
        if exp.status == ExperimentStatus.RUNNING:
            exp.report = recalculate_report(exp)
    return exp


def apply_correction(exp_id: str, corrections: Dict[str, Any], reason: str) -> Dict[str, Any]:
    exp = db.get_experiment(exp_id)
    if not exp:
        return {"success": False, "error": "实验不存在"}
    
    old_data = exp.model_dump()
    
    if "groups" in corrections:
        exp.groups = [Group(**g) for g in corrections["groups"]]
        traffic_validation = validate_traffic_ratio(exp.groups)
        exp.need_recalculation = not traffic_validation["is_valid"]
        if exp.status == ExperimentStatus.RUNNING and traffic_validation["is_valid"]:
            exp.report = recalculate_report(exp)
    
    if "mutex_rules" in corrections:
        exp.mutex_rules = [MutexRule(**r) for r in corrections["mutex_rules"]]
        mutex_validation = validate_mutex_rules(exp.mutex_rules)
        for rule in exp.mutex_rules:
            rule.is_valid = True
            rule.error_message = None
        for error in mutex_validation["errors"]:
            for rule in exp.mutex_rules:
                if rule.name in error:
                    rule.is_valid = False
                    rule.error_message = error
    
    if "status" in corrections:
        exp.status = ExperimentStatus(corrections["status"])
    
    exp.updated_at = datetime.now()
    
    new_data = exp.model_dump()
    
    return {
        "success": True,
        "experiment": exp,
        "old_data": old_data,
        "new_data": new_data,
        "reason": reason
    }


def export_experiment(exp_id: str, format: str = "json", include_report: bool = True) -> Dict[str, Any]:
    exp = db.get_experiment(exp_id)
    if not exp:
        return {"success": False, "error": "实验不存在"}
    
    data = exp.model_dump()
    if not include_report:
        data.pop("report", None)
    
    if format == "json":
        return {
            "success": True,
            "content_type": "application/json",
            "filename": f"{exp_id}.json",
            "content": json.dumps(data, ensure_ascii=False, indent=2, default=str)
        }
    elif format == "excel":
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            exp_df = pd.DataFrame([{
                "ID": exp.id,
                "名称": exp.name,
                "状态": exp.status,
                "创建时间": exp.created_at,
                "更新时间": exp.updated_at
            }])
            exp_df.to_excel(writer, sheet_name="实验信息", index=False)
            
            groups_df = pd.DataFrame([{
                "分组ID": g.id,
                "名称": g.name,
                "流量比例": g.traffic_ratio,
                "是否对照组": g.is_control
            } for g in exp.groups])
            groups_df.to_excel(writer, sheet_name="实验分组", index=False)
            
            if exp.report:
                report_df = pd.DataFrame([{
                    "分组ID": d.group_id,
                    "指标ID": d.metric_id,
                    "数值": d.value,
                    "样本量": d.sample_size
                } for d in exp.report.data])
                report_df.to_excel(writer, sheet_name="效果报表", index=False)
        
        output.seek(0)
        return {
            "success": True,
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "filename": f"{exp_id}.xlsx",
            "content": output.getvalue()
        }
    
    return {"success": False, "error": "不支持的导出格式"}


def get_validation_summary() -> Dict[str, Any]:
    exps = db.get_all_experiments()
    
    total = len(exps)
    running = sum(1 for e in exps if e.status == ExperimentStatus.RUNNING)
    paused = sum(1 for e in exps if e.status == ExperimentStatus.PAUSED)
    need_correction = sum(1 for e in exps if e.need_recalculation or any(not r.is_valid for r in e.mutex_rules))
    
    issues = []
    for exp in exps:
        traffic_validation = validate_traffic_ratio(exp.groups)
        if not traffic_validation["is_valid"]:
            issues.append({
                "experiment_id": exp.id,
                "experiment_name": exp.name,
                "type": "traffic_ratio",
                "issues": traffic_validation["errors"]
            })
        
        invalid_rules = [r for r in exp.mutex_rules if not r.is_valid]
        if invalid_rules:
            issues.append({
                "experiment_id": exp.id,
                "experiment_name": exp.name,
                "type": "mutex_rule",
                "issues": [r.error_message for r in invalid_rules]
            })
    
    return {
        "summary": {
            "total": total,
            "running": running,
            "paused": paused,
            "need_correction": need_correction
        },
        "issues": issues
    }
