from __future__ import annotations

import csv
import json
from datetime import datetime, date
from io import StringIO
from typing import List, Tuple, Dict, Any
import pandas as pd

from .models import Package, SmsRecord, ReturnRule, PackageStatus, SmsType


class DataImporter:
    @staticmethod
    def parse_date(date_str: str) -> date:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except (ValueError, AttributeError):
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    @staticmethod
    def parse_datetime(dt_str: str) -> datetime:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M"):
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间: {dt_str}")

    @staticmethod
    def import_packages_csv(csv_content: str) -> Tuple[List[Package], List[str]]:
        errors = []
        packages = []
        reader = csv.DictReader(StringIO(csv_content))

        required_fields = {"package_id", "tracking_no", "recipient_name",
                          "recipient_phone", "pickup_code", "arrival_date", "status"}
        missing = required_fields - set(reader.fieldnames or set())
        if missing:
            errors.append(f"CSV缺少必要字段: {missing}")
            return [], errors

        for idx, row in enumerate(reader, start=2):
            try:
                status = PackageStatus(row.get("status", "pending").lower())
                pkg = Package(
                    package_id=row["package_id"].strip(),
                    tracking_no=row["tracking_no"].strip(),
                    recipient_name=row["recipient_name"].strip(),
                    recipient_phone=row["recipient_phone"].strip(),
                    pickup_code=row["pickup_code"].strip(),
                    arrival_date=DataImporter.parse_date(row["arrival_date"]),
                    status=status,
                    pickup_date=DataImporter.parse_date(row["pickup_date"]) if row.get("pickup_date") else None,
                    shelf_location=row.get("shelf_location", "").strip() or None,
                    courier_company=row.get("courier_company", "").strip() or None,
                    weight=float(row["weight"]) if row.get("weight") else None,
                )
                packages.append(pkg)
            except Exception as e:
                errors.append(f"第{idx}行解析失败: {str(e)}")

        return packages, errors

    @staticmethod
    def import_sms_json(json_content: str) -> Tuple[List[SmsRecord], List[str]]:
        errors = []
        records = []
        try:
            data = json.loads(json_content)
        except json.JSONDecodeError as e:
            errors.append(f"JSON解析失败: {str(e)}")
            return [], errors

        if not isinstance(data, list):
            data = [data]

        for idx, item in enumerate(data):
            try:
                sms_type = SmsType(item.get("sms_type", "arrival"))
                record = SmsRecord(
                    sms_id=item["sms_id"],
                    package_id=item["package_id"],
                    sms_type=sms_type,
                    send_time=DataImporter.parse_datetime(item["send_time"]),
                    content=item.get("content", ""),
                    recipient_phone=item.get("recipient_phone", ""),
                    delivery_status=item.get("delivery_status", "delivered"),
                )
                records.append(record)
            except Exception as e:
                errors.append(f"第{idx}条短信解析失败: {str(e)}")

        return records, errors

    @staticmethod
    def import_rules_json(json_content: str) -> Tuple[List[ReturnRule], List[str]]:
        errors = []
        rules = []
        try:
            data = json.loads(json_content)
        except json.JSONDecodeError as e:
            errors.append(f"JSON解析失败: {str(e)}")
            return [], errors

        if not isinstance(data, list):
            data = [data]

        for idx, item in enumerate(data):
            try:
                rule = ReturnRule(
                    rule_id=item["rule_id"],
                    rule_name=item["rule_name"],
                    overdue_days=int(item["overdue_days"]),
                    priority=int(item.get("priority", 1)),
                    description=item.get("description", ""),
                    enabled=bool(item.get("enabled", True)),
                )
                rules.append(rule)
            except Exception as e:
                errors.append(f"第{idx}条规则解析失败: {str(e)}")

        return rules, errors

    @staticmethod
    def import_packages_pandas(file_path: str) -> Tuple[List[Package], List[str]]:
        errors = []
        packages = []
        try:
            df = pd.read_csv(file_path)
        except Exception as e:
            errors.append(f"读取CSV失败: {str(e)}")
            return [], errors

        for _, row in df.iterrows():
            try:
                pkg = Package(
                    package_id=str(row["package_id"]),
                    tracking_no=str(row["tracking_no"]),
                    recipient_name=str(row["recipient_name"]),
                    recipient_phone=str(row["recipient_phone"]),
                    pickup_code=str(row["pickup_code"]),
                    arrival_date=pd.to_datetime(row["arrival_date"]).date(),
                    status=PackageStatus(str(row["status"]).lower()),
                    pickup_date=pd.to_datetime(row["pickup_date"]).date() if pd.notna(row.get("pickup_date")) else None,
                    shelf_location=str(row.get("shelf_location")) if pd.notna(row.get("shelf_location")) else None,
                    courier_company=str(row.get("courier_company")) if pd.notna(row.get("courier_company")) else None,
                    weight=float(row["weight"]) if pd.notna(row.get("weight")) else None,
                )
                packages.append(pkg)
            except Exception as e:
                errors.append(f"行解析失败: {str(e)}")

        return packages, errors
