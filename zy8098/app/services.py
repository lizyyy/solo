from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import csv
import json
import yaml
from io import StringIO, TextIOBase
from . import crud, schemas, models, validation


class SampleService:
    @staticmethod
    def register_sample(db: Session, sample_data: schemas.SampleCreate):
        is_valid, msg = validation.validate_box_code_unique(db, sample_data.box_code)
        if not is_valid:
            raise ValueError(msg)
        
        rule = crud.get_fridge_rules(db)
        retention_hours = 48
        if rule:
            retention_hours = rule[0].retention_hours
        
        sample = crud.create_sample(db, sample_data, retention_hours)
        
        event_data = schemas.SampleEventCreate(
            sample_id=sample.id,
            event_type="register",
            event_time=datetime.utcnow(),
            operator=sample_data.registered_by,
            notes="留样登记"
        )
        crud.create_sample_event(db, event_data)
        
        return sample, msg

    @staticmethod
    def scan_in(db: Session, request: schemas.ScanInRequest):
        is_valid, msg = validation.validate_sample_exists(db, request.box_code)
        if not is_valid:
            raise ValueError(msg)
        
        is_valid, fridge_msg = validation.validate_fridge_exists(db, request.fridge_code)
        if not is_valid:
            raise ValueError(fridge_msg)
        
        sample = crud.get_sample_by_box_code(db, request.box_code)
        
        event_time = request.event_time or datetime.utcnow()
        is_valid, order_msg = validation.validate_event_order(db, sample.id, event_time, "scan_in")
        if not is_valid:
            raise ValueError(order_msg)
        
        event_data = schemas.SampleEventCreate(
            sample_id=sample.id,
            event_type="scan_in",
            event_time=event_time,
            fridge_code=request.fridge_code,
            operator=request.operator,
            notes=request.notes or "入柜"
        )
        crud.create_sample_event(db, event_data)
        crud.update_sample_status(db, sample.id, models.SampleStatus.IN_FRIDGE)
        
        crud.reorder_events(db, sample.id)
        
        warnings = []
        if order_msg:
            warnings.append(order_msg)
        
        return sample, warnings

    @staticmethod
    def scan_out(db: Session, request: schemas.ScanOutRequest):
        is_valid, msg = validation.validate_sample_exists(db, request.box_code)
        if not is_valid:
            raise ValueError(msg)
        
        sample = crud.get_sample_by_box_code(db, request.box_code)
        
        event_time = request.event_time or datetime.utcnow()
        is_valid, order_msg = validation.validate_event_order(db, sample.id, event_time, "scan_out")
        if not is_valid:
            raise ValueError(order_msg)
        
        event_data = schemas.SampleEventCreate(
            sample_id=sample.id,
            event_type="scan_out",
            event_time=event_time,
            operator=request.operator,
            notes=request.notes or "取样"
        )
        crud.create_sample_event(db, event_data)
        crud.update_sample_status(db, sample.id, models.SampleStatus.TAKEN_OUT)
        
        crud.reorder_events(db, sample.id)
        
        warnings = []
        if order_msg:
            warnings.append(order_msg)
        
        return sample, warnings


class ImportService:
    @staticmethod
    def import_meals(db: Session, csv_content: str):
        meals = []
        reader = csv.DictReader(StringIO(csv_content))
        for row in reader:
            meal_data = schemas.MealCreate(
                date=row["date"],
                meal_type=row["meal_type"],
                dish_name=row["dish_name"],
                kitchen=row["kitchen"],
                chef=row["chef"],
                ingredients=row["ingredients"]
            )
            meal = crud.create_meal(db, meal_data)
            meals.append(meal)
        return meals

    @staticmethod
    def import_sample_events(db: Session, jsonl_content: str):
        events = []
        for line in jsonl_content.splitlines():
            if line.strip():
                data = json.loads(line)
                sample = crud.get_sample_by_box_code(db, data["box_code"])
                if sample:
                    event_data = schemas.SampleEventCreate(
                        sample_id=sample.id,
                        event_type=data["event_type"],
                        event_time=datetime.fromisoformat(data["event_time"]),
                        fridge_code=data.get("fridge_code"),
                        operator=data["operator"],
                        notes=data.get("notes")
                    )
                    event = crud.create_sample_event(db, event_data)
                    events.append(event)
                    crud.reorder_events(db, sample.id)
        return events

    @staticmethod
    def import_fridge_rules(db: Session, yaml_content: str):
        rules_data = yaml.safe_load(yaml_content)
        rules = []
        if isinstance(rules_data, list):
            for rule_data in rules_data:
                rule_create = schemas.FridgeRuleCreate(**rule_data)
                rule = crud.create_fridge_rule(db, rule_create)
                rules.append(rule)
                
                fridge = crud.get_fridge_by_code(db, rule_data["fridge_code"])
                if not fridge:
                    fridge_create = schemas.FridgeCreate(
                        fridge_code=rule_data["fridge_code"],
                        location=f"冷藏柜 {rule_data['fridge_code']}",
                        temperature_min=rule_data["temperature_min"],
                        temperature_max=rule_data["temperature_max"],
                        retention_hours=rule_data["retention_hours"]
                    )
                    crud.create_fridge(db, fridge_create)
        return rules


class AlertService:
    @staticmethod
    def get_expiry_alerts(db: Session, hours_threshold: float = 2.0):
        samples = crud.get_expiring_samples(db, hours_threshold)
        alerts = []
        now = datetime.utcnow()
        
        for sample in samples:
            meal = crud.get_meal(db, sample.meal_id)
            hours_left = (sample.expiry_time - now).total_seconds() / 3600
            
            alert = schemas.ExpiryAlert(
                sample_id=sample.id,
                box_code=sample.box_code,
                dish_name=meal.dish_name if meal else "未知",
                expiry_time=sample.expiry_time,
                hours_left=round(hours_left, 2),
                status=sample.status
            )
            alerts.append(alert)
        
        return alerts


class TraceService:
    @staticmethod
    def trace_complaint(db: Session, request: schemas.ComplaintTraceRequest):
        meals = crud.get_meals_by_filters(db, request.date, request.meal_type, request.dish_name)
        
        results = []
        for meal in meals:
            samples = meal.samples
            for sample in samples:
                events = crud.get_sample_events_by_sample(db, sample.id)
                results.append({
                    "meal": meal,
                    "sample": sample,
                    "events": events
                })
        
        return results

    @staticmethod
    def generate_trace_report(db: Session, sample_id: Optional[int] = None, 
                             box_code: Optional[str] = None):
        if box_code:
            sample = crud.get_sample_by_box_code(db, box_code)
        elif sample_id:
            sample = crud.get_sample(db, sample_id)
        else:
            raise ValueError("需要提供 sample_id 或 box_code")
        
        if not sample:
            raise ValueError("未找到留样记录")
        
        meal = crud.get_meal(db, sample.meal_id)
        events = crud.get_sample_events_by_sample(db, sample.id)
        
        summary = f"留样盒 {sample.box_code} 追溯报告\n"
        summary += f"菜品: {meal.dish_name if meal else '未知'}\n"
        summary += f"留样时间: {sample.registered_at}\n"
        summary += f"当前状态: {sample.status}\n"
        summary += f"事件数量: {len(events)}\n"
        
        report = schemas.TraceReport(
            sample=sample,
            meal=meal,
            events=events,
            summary=summary
        )
        
        return report

    @staticmethod
    def export_report_md(db: Session, sample_id: Optional[int] = None,
                        box_code: Optional[str] = None):
        report = TraceService.generate_trace_report(db, sample_id, box_code)
        
        md_content = f"# 留样追溯报告\n\n"
        md_content += f"## 基本信息\n\n"
        md_content += f"- **留样盒码**: {report.sample.box_code}\n"
        md_content += f"- **菜品名称**: {report.meal.dish_name}\n"
        md_content += f"- **餐次类型**: {report.meal.meal_type}\n"
        md_content += f"- **日期**: {report.meal.date}\n"
        md_content += f"- **厨房**: {report.meal.kitchen}\n"
        md_content += f"- **厨师**: {report.meal.chef}\n"
        md_content += f"- **原料**: {report.meal.ingredients}\n"
        md_content += f"- **留样重量**: {report.sample.weight}g\n"
        md_content += f"- **登记人**: {report.sample.registered_by}\n"
        md_content += f"- **登记时间**: {report.sample.registered_at}\n"
        md_content += f"- **过期时间**: {report.sample.expiry_time}\n"
        md_content += f"- **当前状态**: {report.sample.status}\n\n"
        
        md_content += f"## 事件时间线\n\n"
        for event in report.events:
            md_content += f"### {event.sequence_number}. {event.event_type}\n"
            md_content += f"- **时间**: {event.event_time}\n"
            md_content += f"- **操作人**: {event.operator}\n"
            if event.fridge_code:
                md_content += f"- **冷藏柜**: {event.fridge_code}\n"
            if event.notes:
                md_content += f"- **备注**: {event.notes}\n"
            md_content += "\n"
        
        return md_content
