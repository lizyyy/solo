import csv
import os
from datetime import datetime
from typing import List, Dict, Any, Tuple

from database.db import Database


class CSVImporter:
    def __init__(self, db: Database):
        self.db = db
        
    def import_samplings(self, csv_path: str) -> Dict[str, Any]:
        if not os.path.exists(csv_path):
            return {"success": False, "error": f"文件不存在: {csv_path}", "stats": {}}
            
        results = {
            "total": 0,
            "added": 0,
            "skipped": 0,
            "errors": [],
            "duplicates": []
        }
        
        seen_samples = set()
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                results["total"] += 1
                sampling_no = row.get('采样编号', row.get('sampling_no', '')).strip()
                
                if not sampling_no:
                    results["errors"].append(f"第{row_num}行: 缺少采样编号")
                    continue
                
                if sampling_no in seen_samples:
                    results["duplicates"].append(f"第{row_num}行: 采样号 {sampling_no} 在本文件中重复")
                    results["skipped"] += 1
                    continue
                seen_samples.add(sampling_no)
                
                success, msg = self.db.add_sampling(
                    sampling_no=sampling_no,
                    resident_name=row.get('姓名', row.get('resident_name', '')).strip(),
                    resident_phone=row.get('电话', row.get('phone', '')).strip(),
                    sampling_date=row.get('采样日期', row.get('sampling_date', '')).strip(),
                    sampling_type=row.get('采样类型', row.get('sampling_type', '')).strip(),
                    sampler=row.get('采样人', row.get('sampler', '')).strip(),
                    status=row.get('状态', row.get('status', 'pending')).strip() or 'pending'
                )
                
                if success:
                    results["added"] += 1
                else:
                    results["skipped"] += 1
                    if "已存在" in msg:
                        results["duplicates"].append(f"采样号 {sampling_no}: {msg}")
                    else:
                        results["errors"].append(f"采样号 {sampling_no}: {msg}")
                        
        results["success"] = len(results["errors"]) == 0
        return results

    def import_test_results(self, csv_path: str) -> Dict[str, Any]:
        if not os.path.exists(csv_path):
            return {"success": False, "error": f"文件不存在: {csv_path}", "stats": {}}
            
        results = {
            "total": 0,
            "added": 0,
            "skipped": 0,
            "errors": [],
            "warnings": [],
            "duplicates": []
        }
        
        seen_samples = set()
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                results["total"] += 1
                sampling_no = row.get('采样编号', row.get('sampling_no', '')).strip()
                
                if not sampling_no:
                    results["errors"].append(f"第{row_num}行: 缺少采样编号")
                    continue
                
                if sampling_no in seen_samples:
                    results["duplicates"].append(f"第{row_num}行: 采样号 {sampling_no} 在本文件中重复")
                    results["skipped"] += 1
                    continue
                seen_samples.add(sampling_no)
                
                sampling = self.db.get_sampling(sampling_no)
                if not sampling:
                    results["errors"].append(f"第{row_num}行: 采样号 {sampling_no} 没有对应的采样记录，请先导入采样数据")
                    continue
                
                status = row.get('状态', row.get('status', 'received')).strip() or 'received'
                has_abnormal = row.get('是否异常', row.get('has_abnormal', '')).strip() == '是'
                
                success, msg, test_id = self.db.add_test_result(
                    sampling_no=sampling_no,
                    test_date=row.get('检验日期', row.get('test_date', '')).strip(),
                    status=status if not has_abnormal else 'abnormal',
                    lab_name=row.get('检验机构', row.get('lab_name', '')).strip()
                )
                
                if not success and test_id == -1:
                    results["errors"].append(f"采样号 {sampling_no}: {msg}")
                    continue
                elif not success:
                    results["skipped"] += 1
                    results["duplicates"].append(f"采样号 {sampling_no}: {msg}")
                    continue
                
                results["added"] += 1
                
                if has_abnormal:
                    abnormal_str = row.get('异常指标', row.get('abnormal_indicators', '')).strip()
                    if abnormal_str:
                        if ';' in abnormal_str:
                            indicators = [i.strip() for i in abnormal_str.split(';') if i.strip()]
                        else:
                            indicators = [i.strip() for i in abnormal_str.split(',') if i.strip()]
                        for ind in indicators:
                            parts = ind.split('|')
                            name = parts[0].strip()
                            if not name:
                                continue
                            value = parts[1].strip() if len(parts) > 1 else ''
                            ref = parts[2].strip() if len(parts) > 2 else ''
                            flag = parts[3].strip() if len(parts) > 3 else '异常'
                            self.db.add_abnormal_indicator(
                                test_result_id=test_id,
                                sampling_no=sampling_no,
                                indicator_name=name,
                                result_value=value,
                                reference_range=ref,
                                abnormal_flag=flag
                            )
                        
        results["success"] = len(results["errors"]) == 0
        return results

    def import_notifications(self, csv_path: str) -> Dict[str, Any]:
        if not os.path.exists(csv_path):
            return {"success": False, "error": f"文件不存在: {csv_path}", "stats": {}}
            
        results = {
            "total": 0,
            "added": 0,
            "skipped": 0,
            "errors": [],
            "warnings": [],
            "duplicates": []
        }
        
        seen_notifications = set()
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                results["total"] += 1
                sampling_no = row.get('采样编号', row.get('sampling_no', '')).strip()
                
                if not sampling_no:
                    results["errors"].append(f"第{row_num}行: 缺少采样编号")
                    continue
                
                notification_date = row.get('通知日期', row.get('notification_date', '')).strip()
                if not notification_date:
                    notification_date = datetime.now().strftime('%Y-%m-%d')
                
                notification_method = row.get('通知方式', row.get('method', '')).strip()
                notifier = row.get('通知人', row.get('notifier', '')).strip()
                contact_result = row.get('联系结果', row.get('contact_result', '')).strip()
                
                dedup_key = (sampling_no, notification_date, notification_method, notifier, contact_result)
                if dedup_key in seen_notifications:
                    results["duplicates"].append(f"第{row_num}行: 采样号 {sampling_no} 通知记录在本文件中重复")
                    results["skipped"] += 1
                    continue
                seen_notifications.add(dedup_key)
                
                test_result = self.db.get_test_result(sampling_no)
                if not test_result:
                    results["warnings"].append(f"第{row_num}行: 采样号 {sampling_no} 暂未收到检验结果")
                
                success, msg = self.db.add_notification(
                    sampling_no=sampling_no,
                    notification_date=notification_date,
                    test_result_id=test_result['id'] if test_result else None,
                    notification_method=notification_method,
                    notifier=notifier,
                    contact_result=contact_result,
                    notes=row.get('备注', row.get('notes', '')).strip()
                )
                
                if success:
                    results["added"] += 1
                else:
                    if "已存在" in msg:
                        results["duplicates"].append(f"采样号 {sampling_no}: {msg}")
                        results["skipped"] += 1
                    else:
                        results["errors"].append(f"采样号 {sampling_no}: {msg}")
                        
        results["success"] = len(results["errors"]) == 0
        return results

    def import_followups(self, csv_path: str) -> Dict[str, Any]:
        if not os.path.exists(csv_path):
            return {"success": False, "error": f"文件不存在: {csv_path}", "stats": {}}
            
        results = {
            "total": 0,
            "added": 0,
            "skipped": 0,
            "errors": [],
            "conflicts": []
        }
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                results["total"] += 1
                sampling_no = row.get('采样编号', row.get('sampling_no', '')).strip()
                appointment_date = row.get('复查日期', row.get('appointment_date', '')).strip()
                
                if not sampling_no or not appointment_date:
                    results["errors"].append(f"第{row_num}行: 缺少采样编号或复查日期")
                    continue
                
                test_result = self.db.get_test_result(sampling_no)
                
                success, msg = self.db.add_followup_appointment(
                    sampling_no=sampling_no,
                    appointment_date=appointment_date,
                    test_result_id=test_result['id'] if test_result else None,
                    appointment_time=row.get('复查时间', row.get('appointment_time', '')).strip(),
                    followup_items=row.get('复查项目', row.get('items', '')).strip(),
                    status=row.get('状态', row.get('status', 'pending')).strip() or 'pending',
                    notes=row.get('备注', row.get('notes', '')).strip()
                )
                
                if success:
                    results["added"] += 1
                else:
                    if "同一天" in msg:
                        results["conflicts"].append(f"采样号 {sampling_no}: {msg}")
                        results["skipped"] += 1
                    else:
                        results["errors"].append(f"采样号 {sampling_no}: {msg}")
                        
        results["success"] = len(results["errors"]) == 0
        return results
