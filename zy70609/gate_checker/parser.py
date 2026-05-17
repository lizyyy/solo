import pandas as pd
from datetime import datetime
from typing import List, Dict, Tuple, Any
from pathlib import Path

from .models import (
    PersonProfile, GateEvent, VisitorApplication, TrainingRecord, BlacklistRecord,
    BadRecord, SourceInfo, PersonType, EventType, TrainingStatus
)


def parse_datetime(value: Any) -> datetime:
    if pd.isna(value):
        raise ValueError("空日期值")
    if isinstance(value, datetime):
        return value
    return pd.to_datetime(value)


def parse_date(value: Any):
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    return pd.to_datetime(value).date()


def safe_str(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


class DataParser:
    def __init__(self):
        self.bad_records: List[BadRecord] = []

    def _create_source_info(self, file_path: str, sheet_name: str, row_idx: int, row: pd.Series) -> SourceInfo:
        return SourceInfo(
            file_path=file_path,
            sheet_name=sheet_name,
            row_number=row_idx + 2,
            raw_content=str(row.to_dict())
        )

    def _add_bad_record(self, source_info: SourceInfo, error_type: str, error_msg: str):
        self.bad_records.append(BadRecord(
            source_info=source_info,
            error_type=error_type,
            error_message=error_msg
        ))

    def parse_person_profile(self, file_path: str, sheet_name: str = "人员档案") -> List[PersonProfile]:
        persons: List[PersonProfile] = []
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        for idx, row in df.iterrows():
            source_info = self._create_source_info(file_path, sheet_name, idx, row)
            try:
                person_type_str = safe_str(row.get("人员类型", "employee")).lower()
                if "访客" in person_type_str:
                    person_type = PersonType.VISITOR
                elif "承包" in person_type_str or "外包" in person_type_str:
                    person_type = PersonType.CONTRACTOR
                else:
                    person_type = PersonType.EMPLOYEE

                person = PersonProfile(
                    person_id=safe_str(row.get("人员ID", row.get("工号", ""))),
                    name=safe_str(row.get("姓名", "")),
                    id_card=safe_str(row.get("身份证号", row.get("证件号", ""))),
                    person_type=person_type,
                    department=safe_str(row.get("部门", row.get("所属单位", ""))),
                    phone=safe_str(row.get("电话", row.get("手机号", ""))),
                    source_info=source_info
                )
                
                if not person.person_id or not person.name:
                    raise ValueError("人员ID或姓名为空")
                
                persons.append(person)
            except Exception as e:
                self._add_bad_record(source_info, "人员档案解析错误", str(e))
        
        return persons

    def parse_gate_events(self, file_path: str, sheet_name: str = "闸机记录") -> List[GateEvent]:
        events: List[GateEvent] = []
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        for idx, row in df.iterrows():
            source_info = self._create_source_info(file_path, sheet_name, idx, row)
            try:
                event_type_str = safe_str(row.get("事件类型", "entry")).lower()
                if "出" in event_type_str or "exit" in event_type_str:
                    event_type = EventType.EXIT
                else:
                    event_type = EventType.ENTRY

                event = GateEvent(
                    event_id=safe_str(row.get("事件ID", f"evt_{idx}")),
                    person_id=safe_str(row.get("人员ID", row.get("工号", ""))),
                    name=safe_str(row.get("姓名", "")),
                    event_time=parse_datetime(row.get("事件时间", row.get("通行时间"))),
                    gate_name=safe_str(row.get("闸机名称", row.get("闸机编号", ""))),
                    event_type=event_type,
                    source_info=source_info
                )
                
                if not event.person_id:
                    raise ValueError("人员ID为空")
                
                events.append(event)
            except Exception as e:
                self._add_bad_record(source_info, "闸机记录解析错误", str(e))
        
        return events

    def parse_visitor_applications(self, file_path: str, sheet_name: str = "访客申请") -> List[VisitorApplication]:
        apps: List[VisitorApplication] = []
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        for idx, row in df.iterrows():
            source_info = self._create_source_info(file_path, sheet_name, idx, row)
            try:
                approved_val = row.get("是否批准", row.get("审核状态", True))
                if isinstance(approved_val, str):
                    approved = "通过" in approved_val or "同意" in approved_val or "是" in approved_val
                else:
                    approved = bool(approved_val)

                app = VisitorApplication(
                    application_id=safe_str(row.get("申请ID", f"app_{idx}")),
                    person_id=safe_str(row.get("人员ID", row.get("访客ID", ""))),
                    name=safe_str(row.get("姓名", row.get("访客姓名", ""))),
                    visitor_company=safe_str(row.get("来访单位", row.get("公司名称", ""))),
                    start_time=parse_datetime(row.get("开始时间", row.get("访问开始时间"))),
                    end_time=parse_datetime(row.get("结束时间", row.get("访问结束时间"))),
                    approved=approved,
                    source_info=source_info
                )
                
                if not app.person_id:
                    raise ValueError("人员ID为空")
                
                apps.append(app)
            except Exception as e:
                self._add_bad_record(source_info, "访客申请解析错误", str(e))
        
        return apps

    def parse_training_records(self, file_path: str, sheet_name: str = "培训状态") -> List[TrainingRecord]:
        records: List[TrainingRecord] = []
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        for idx, row in df.iterrows():
            source_info = self._create_source_info(file_path, sheet_name, idx, row)
            try:
                status_str = safe_str(row.get("培训状态", "passed")).lower()
                if "未开始" in status_str or "未培训" in status_str:
                    status = TrainingStatus.NOT_STARTED
                elif "进行" in status_str or "培训中" in status_str:
                    status = TrainingStatus.IN_PROGRESS
                elif "过期" in status_str or "失效" in status_str:
                    status = TrainingStatus.EXPIRED
                else:
                    status = TrainingStatus.PASSED

                record = TrainingRecord(
                    record_id=safe_str(row.get("记录ID", f"train_{idx}")),
                    person_id=safe_str(row.get("人员ID", row.get("工号", ""))),
                    name=safe_str(row.get("姓名", "")),
                    training_name=safe_str(row.get("培训名称", row.get("培训项目", "安全培训"))),
                    status=status,
                    valid_until=parse_date(row.get("有效期至", row.get("有效截止日期"))),
                    source_info=source_info
                )
                
                if not record.person_id:
                    raise ValueError("人员ID为空")
                
                records.append(record)
            except Exception as e:
                self._add_bad_record(source_info, "培训状态解析错误", str(e))
        
        return records

    def parse_blacklist(self, file_path: str, sheet_name: str = "黑名单") -> List[BlacklistRecord]:
        records: List[BlacklistRecord] = []
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        for idx, row in df.iterrows():
            source_info = self._create_source_info(file_path, sheet_name, idx, row)
            try:
                is_active_val = row.get("是否有效", row.get("是否激活", True))
                if isinstance(is_active_val, str):
                    is_active = "是" in is_active_val or "有效" in is_active_val or "激活" in is_active_val
                else:
                    is_active = bool(is_active_val)

                record = BlacklistRecord(
                    blacklist_id=safe_str(row.get("记录ID", f"black_{idx}")),
                    person_id=safe_str(row.get("人员ID", row.get("工号", ""))),
                    name=safe_str(row.get("姓名", "")),
                    reason=safe_str(row.get("原因", row.get("列入原因", ""))),
                    added_time=parse_datetime(row.get("添加时间", row.get("列入时间", datetime.now()))),
                    is_active=is_active,
                    source_info=source_info
                )
                
                if not record.person_id:
                    raise ValueError("人员ID为空")
                
                records.append(record)
            except Exception as e:
                self._add_bad_record(source_info, "黑名单解析错误", str(e))
        
        return records

    def parse_all(self, file_path: str) -> Dict[str, List]:
        excel_file = pd.ExcelFile(file_path)
        sheet_names = excel_file.sheet_names
        
        result = {
            "persons": [],
            "events": [],
            "visitor_apps": [],
            "training_records": [],
            "blacklist_records": [],
            "bad_records": []
        }

        sheet_mapping = {
            "人员档案": ("persons", self.parse_person_profile),
            "闸机记录": ("events", self.parse_gate_events),
            "访客申请": ("visitor_apps", self.parse_visitor_applications),
            "培训状态": ("training_records", self.parse_training_records),
            "黑名单": ("blacklist_records", self.parse_blacklist)
        }

        for sheet_key, (result_key, parser_func) in sheet_mapping.items():
            for sheet_name in sheet_names:
                if sheet_key in sheet_name:
                    result[result_key].extend(parser_func(file_path, sheet_name))
                    break

        result["bad_records"] = self.bad_records
        return result
