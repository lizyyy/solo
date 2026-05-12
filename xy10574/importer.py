import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

from models import (
    Lead, LeadStatus, BlacklistEntry, CallHistory,
    CallResult, CallbackSchedule, TimezoneRule,
    ComplianceRule
)
from storage import Storage


class DataImporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def import_leads_from_file(self, file_path: str) -> Dict[str, Any]:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {file_path}"}
        
        file_name = file_path_obj.name
        
        if self.storage.get_import_session_exists(file_name):
            return {
                "success": True,
                "imported": 0,
                "updated": 0,
                "message": f"文件 {file_name} 已导入过，跳过（幂等保护）"
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"JSON解析失败: {str(e)}"}
        
        imported = 0
        updated = 0
        errors = []
        
        for item in data:
            try:
                lead_id = item.get('id') or str(uuid.uuid4())
                existing = self.storage.get_lead(lead_id)
                
                extra_data = {k: v for k, v in item.items() 
                             if k not in ['id', 'phone', 'name', 'type', 'region', 'timezone', 'created_at']}
                
                lead = Lead(
                    id=lead_id,
                    phone=item.get('phone', ''),
                    name=item.get('name', ''),
                    type=item.get('type', 'sales'),
                    region=item.get('region', ''),
                    timezone=item.get('timezone', 'Asia/Shanghai'),
                    created_at=datetime.now(),
                    status=LeadStatus.IMPORTED,
                    source_file=file_name,
                    extra_data=extra_data
                )
                
                is_new = self.storage.save_lead(lead)
                if is_new:
                    imported += 1
                else:
                    updated += 1
                    
            except Exception as e:
                errors.append(f"第 {len(errors)+1} 条: {str(e)}")
        
        self.storage.record_import_session(
            file_name=file_name,
            file_type="leads",
            record_count=imported + updated,
            status="completed" if not errors else "partial"
        )
        
        return {
            "success": True,
            "imported": imported,
            "updated": updated,
            "errors": errors,
            "file_name": file_name
        }

    def import_blacklist_from_file(self, file_path: str) -> Dict[str, Any]:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {file_path}"}
        
        file_name = file_path_obj.name
        
        if self.storage.get_import_session_exists(file_name):
            return {
                "success": True,
                "imported": 0,
                "message": f"文件 {file_name} 已导入过，跳过（幂等保护）"
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"JSON解析失败: {str(e)}"}
        
        imported = 0
        errors = []
        
        for item in data:
            try:
                entry = BlacklistEntry(
                    id=str(uuid.uuid4()),
                    phone=item.get('phone', ''),
                    reason=item.get('reason', ''),
                    created_at=datetime.now(),
                    source=item.get('source', 'manual')
                )
                self.storage.save_blacklist(entry)
                imported += 1
            except Exception as e:
                errors.append(f"第 {len(errors)+1} 条: {str(e)}")
        
        self.storage.record_import_session(
            file_name=file_name,
            file_type="blacklist",
            record_count=imported,
            status="completed" if not errors else "partial"
        )
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors,
            "file_name": file_name
        }

    def import_call_history_from_file(self, file_path: str) -> Dict[str, Any]:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {file_path}"}
        
        file_name = file_path_obj.name
        
        if self.storage.get_import_session_exists(file_name):
            return {
                "success": True,
                "imported": 0,
                "message": f"文件 {file_name} 已导入过，跳过（幂等保护）"
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"JSON解析失败: {str(e)}"}
        
        imported = 0
        errors = []
        
        for item in data:
            try:
                call_time_str = item.get('call_time')
                call_time = (datetime.fromisoformat(call_time_str) 
                           if call_time_str else datetime.now())
                
                history = CallHistory(
                    id=str(uuid.uuid4()),
                    lead_id=item.get('lead_id', ''),
                    phone=item.get('phone', ''),
                    call_time=call_time,
                    result=CallResult(item.get('result', 'no_answer')),
                    agent=item.get('agent', ''),
                    notes=item.get('notes', '')
                )
                self.storage.save_call_history(history)
                imported += 1
            except Exception as e:
                errors.append(f"第 {len(errors)+1} 条: {str(e)}")
        
        self.storage.record_import_session(
            file_name=file_name,
            file_type="call_history",
            record_count=imported,
            status="completed" if not errors else "partial"
        )
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors,
            "file_name": file_name
        }

    def import_callbacks_from_file(self, file_path: str) -> Dict[str, Any]:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {file_path}"}
        
        file_name = file_path_obj.name
        
        if self.storage.get_import_session_exists(file_name):
            return {
                "success": True,
                "imported": 0,
                "message": f"文件 {file_name} 已导入过，跳过（幂等保护）"
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"JSON解析失败: {str(e)}"}
        
        imported = 0
        errors = []
        
        for item in data:
            try:
                scheduled_time_str = item.get('scheduled_time')
                scheduled_time = (datetime.fromisoformat(scheduled_time_str)
                                if scheduled_time_str else datetime.now())
                
                created_at_str = item.get('created_at')
                created_at = (datetime.fromisoformat(created_at_str)
                            if created_at_str else datetime.now())
                
                callback = CallbackSchedule(
                    id=str(uuid.uuid4()),
                    lead_id=item.get('lead_id', ''),
                    phone=item.get('phone', ''),
                    scheduled_time=scheduled_time,
                    timezone=item.get('timezone', 'Asia/Shanghai'),
                    reason=item.get('reason', ''),
                    created_by=item.get('created_by', 'system'),
                    created_at=created_at,
                    is_done=item.get('is_done', False)
                )
                self.storage.save_callback(callback)
                imported += 1
            except Exception as e:
                errors.append(f"第 {len(errors)+1} 条: {str(e)}")
        
        self.storage.record_import_session(
            file_name=file_name,
            file_type="callback",
            record_count=imported,
            status="completed" if not errors else "partial"
        )
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors,
            "file_name": file_name
        }

    def import_timezone_rules_from_file(self, file_path: str) -> Dict[str, Any]:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {file_path}"}
        
        file_name = file_path_obj.name
        
        if self.storage.get_import_session_exists(file_name):
            return {
                "success": True,
                "imported": 0,
                "message": f"文件 {file_name} 已导入过，跳过（幂等保护）"
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"JSON解析失败: {str(e)}"}
        
        imported = 0
        errors = []
        
        for item in data:
            try:
                rule = TimezoneRule(
                    id=str(uuid.uuid4()),
                    region=item.get('region', ''),
                    timezone=item.get('timezone', 'Asia/Shanghai'),
                    call_window_start=item.get('call_window_start', 9),
                    call_window_end=item.get('call_window_end', 18),
                    is_active=item.get('is_active', True)
                )
                self.storage.save_timezone_rule(rule)
                imported += 1
            except Exception as e:
                errors.append(f"第 {len(errors)+1} 条: {str(e)}")
        
        self.storage.record_import_session(
            file_name=file_name,
            file_type="timezone_rules",
            record_count=imported,
            status="completed" if not errors else "partial"
        )
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors,
            "file_name": file_name
        }

    def import_compliance_rules_from_file(self, file_path: str) -> Dict[str, Any]:
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {file_path}"}
        
        file_name = file_path_obj.name
        
        if self.storage.get_import_session_exists(file_name):
            return {
                "success": True,
                "imported": 0,
                "message": f"文件 {file_name} 已导入过，跳过（幂等保护）"
            }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"JSON解析失败: {str(e)}"}
        
        imported = 0
        errors = []
        
        for item in data:
            try:
                rule = ComplianceRule(
                    id=str(uuid.uuid4()),
                    name=item.get('name', ''),
                    description=item.get('description', ''),
                    is_active=item.get('is_active', True),
                    phone_pattern=item.get('phone_pattern', ''),
                    time_window_start=item.get('time_window_start', 0),
                    time_window_end=item.get('time_window_end', 23)
                )
                self.storage.save_compliance_rule(rule)
                imported += 1
            except Exception as e:
                errors.append(f"第 {len(errors)+1} 条: {str(e)}")
        
        self.storage.record_import_session(
            file_name=file_name,
            file_type="compliance_rules",
            record_count=imported,
            status="completed" if not errors else "partial"
        )
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors,
            "file_name": file_name
        }

    def import_all_examples(self, examples_dir: str = "./examples") -> Dict[str, Any]:
        results = {
            "leads": [],
            "blacklist": None,
            "call_history": None,
            "callbacks": None,
            "timezone_rules": None,
            "compliance_rules": None
        }
        
        leads_files = [
            f"{examples_dir}/sales_leads.json",
            f"{examples_dir}/service_leads.json",
            f"{examples_dir}/renewal_leads.json"
        ]
        
        for f in leads_files:
            r = self.import_leads_from_file(f)
            results["leads"].append(r)
        
        results["blacklist"] = self.import_blacklist_from_file(
            f"{examples_dir}/blacklist.json"
        )
        results["call_history"] = self.import_call_history_from_file(
            f"{examples_dir}/call_history.json"
        )
        results["callbacks"] = self.import_callbacks_from_file(
            f"{examples_dir}/callback_schedule.json"
        )
        results["timezone_rules"] = self.import_timezone_rules_from_file(
            f"{examples_dir}/timezone_rules.json"
        )
        results["compliance_rules"] = self.import_compliance_rules_from_file(
            f"{examples_dir}/compliance_rules.json"
        )
        
        return results
