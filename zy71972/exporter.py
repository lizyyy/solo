import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from storage import DataStorage


class DataExporter:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def _get_base_call_data(self, call) -> Dict[str, Any]:
        return {
            "呼叫ID": call.call_id,
            "任务ID": call.task_id,
            "任务名称": call.task_name,
            "客户姓名": call.customer_name,
            "电话号码": call.phone_number,
            "呼叫时间": call.call_time.strftime("%Y-%m-%d %H:%M:%S"),
            "通话时长(秒)": call.call_duration,
            "AI识别结果": call.ai_result,
            "AI置信度": call.ai_confidence,
            "人工改判结果": call.manual_result or "",
            "人工改判人": call.manual_operator or "",
            "改判时间": call.manual_judge_time.strftime("%Y-%m-%d %H:%M:%S") if call.manual_judge_time else "",
            "是否灰度数据": "是" if call.is_grayscale else "否",
            "灰度版本": call.grayscale_version or "",
            "数据来源": "系统导出（统一口径）"
        }

    def export_calls_to_csv(
        self,
        output_path: str,
        task_id: Optional[str] = None,
        batch_id: Optional[str] = None,
        include_audit: bool = False
    ) -> Dict[str, Any]:
        if batch_id:
            calls = self.storage.get_calls_by_batch(batch_id)
        elif task_id:
            calls = self.storage.get_calls_by_task(task_id)
        else:
            calls = self.storage.get_all_calls()

        rows = []
        for call in calls:
            row = self._get_base_call_data(call)

            if include_audit:
                audit_logs = self.storage.get_audit_logs(call.call_id)
                change_count = len(audit_logs)
                last_changer = audit_logs[0].operator if audit_logs else ""
                last_change_time = audit_logs[0].operate_time.strftime("%Y-%m-%d %H:%M:%S") if audit_logs else ""

                row["改判次数"] = change_count
                row["最后改判人"] = last_changer
                row["最后改判时间"] = last_change_time

            rows.append(row)

        if not rows:
            return {"success": False, "message": "没有数据可导出"}

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return {
            "success": True,
            "file_path": output_path,
            "record_count": len(rows),
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "data_caliber": "系统统一口径，包含AI结果、人工改判结果及操作痕迹"
        }

    def export_audit_log_to_csv(
        self,
        output_path: str,
        call_id: Optional[str] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        logs = self.storage.get_audit_logs(call_id)

        if operator:
            logs = [log for log in logs if log.operator == operator]

        rows = []
        for log in logs:
            call = self.storage.get_call(log.call_id)
            rows.append({
                "日志ID": log.log_id,
                "呼叫ID": log.call_id,
                "任务名称": call.task_name if call else "",
                "客户姓名": call.customer_name if call else "",
                "修改字段": log.field_name,
                "原值": log.old_value or "",
                "新值": log.new_value or "",
                "操作人": log.operator,
                "操作时间": log.operate_time.strftime("%Y-%m-%d %H:%M:%S"),
                "操作原因": log.reason or "",
                "IP地址": log.ip_address or ""
            })

        if not rows:
            return {"success": False, "message": "没有审计日志可导出"}

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return {
            "success": True,
            "file_path": output_path,
            "record_count": len(rows),
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def export_quality_checks_to_csv(
        self,
        output_path: str,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        checks = self.storage.get_quality_checks()

        if task_id:
            checks = [qc for qc in checks if qc.task_id == task_id]

        rows = []
        for qc in checks:
            call = self.storage.get_call(qc.call_id)
            rows.append({
                "质检ID": qc.check_id,
                "呼叫ID": qc.call_id,
                "任务ID": qc.task_id,
                "客户姓名": call.customer_name if call else "",
                "质检人": qc.checker,
                "质检时间": qc.check_time.strftime("%Y-%m-%d %H:%M:%S"),
                "原始结果": qc.original_result,
                "质检后结果": qc.checked_result,
                "是否修改": "是" if qc.is_modified else "否",
                "质检备注": qc.check_comments or ""
            })

        if not rows:
            return {"success": False, "message": "没有质检记录可导出"}

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return {
            "success": True,
            "file_path": output_path,
            "record_count": len(rows),
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def export_discrepancies_to_csv(
        self,
        output_path: str,
        task_id: Optional[str] = None,
        resolved: Optional[bool] = None
    ) -> Dict[str, Any]:
        discrepancies = self.storage.get_discrepancies(task_id=task_id, resolved=resolved)

        rows = []
        for d in discrepancies:
            call = self.storage.get_call(d.call_id)
            rows.append({
                "差异ID": d.discrepancy_id,
                "呼叫ID": d.call_id,
                "任务ID": d.task_id,
                "客户姓名": call.customer_name if call else "",
                "差异字段": d.field_name,
                "灰度系统值": d.grayscale_value,
                "报表值": d.report_value,
                "差异来源": d.source.value,
                "责任人": d.responsible_person,
                "问题描述": d.description,
                "发现时间": d.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "是否解决": "是" if d.resolved else "否",
                "解决人": d.resolver or "",
                "解决时间": d.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if d.resolved_at else ""
            })

        if not rows:
            return {"success": False, "message": "没有差异记录可导出"}

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return {
            "success": True,
            "file_path": output_path,
            "record_count": len(rows),
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def export_full_review_package(
        self,
        output_dir: str,
        task_id: Optional[str] = None,
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        results = {}

        calls_result = self.export_calls_to_csv(
            f"{output_dir}/呼叫明细_{timestamp}.csv",
            task_id=task_id,
            batch_id=batch_id,
            include_audit=True
        )
        results["calls"] = calls_result

        audit_result = self.export_audit_log_to_csv(
            f"{output_dir}/改判审计日志_{timestamp}.csv"
        )
        results["audit_logs"] = audit_result

        quality_result = self.export_quality_checks_to_csv(
            f"{output_dir}/质检记录_{timestamp}.csv",
            task_id=task_id
        )
        results["quality_checks"] = quality_result

        discrepancy_result = self.export_discrepancies_to_csv(
            f"{output_dir}/差异记录_{timestamp}.csv",
            task_id=task_id
        )
        results["discrepancies"] = discrepancy_result

        summary_path = f"{output_dir}/导出说明_{timestamp}.txt"
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write("智能外呼复盘数据导出包\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"导出范围: {'任务ID: ' + task_id if task_id else '批次ID: ' + batch_id if batch_id else '全部数据'}\n")
            f.write(f"数据口径: 系统统一导出，确保各表数据一致性\n\n")
            f.write("文件清单:\n")
            f.write(f"  1. 呼叫明细_{timestamp}.csv - 外呼呼叫基础数据\n")
            f.write(f"  2. 改判审计日志_{timestamp}.csv - 所有人工改判操作记录\n")
            f.write(f"  3. 质检记录_{timestamp}.csv - 质检操作记录\n")
            f.write(f"  4. 差异记录_{timestamp}.csv - 灰度与报表差异记录\n\n")
            f.write("数据一致性说明:\n")
            f.write("  - 所有数据基于同一时间点导出，口径一致\n")
            f.write("  - 人工改判结果与审计日志可相互印证\n")
            f.write("  - 质检修改会同步更新至呼叫明细的人工改判结果\n")
            f.write("  - 数据来源可追溯，责任人明确\n")

        results["summary"] = {
            "success": True,
            "file_path": summary_path
        }

        return {
            "success": True,
            "output_dir": output_dir,
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "files": results
        }

    def export_to_excel(
        self,
        output_path: str,
        task_id: Optional[str] = None,
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if not PANDAS_AVAILABLE:
            return {"success": False, "message": "请安装 pandas 和 openpyxl 以支持Excel导出"}

        calls = self.storage.get_calls_by_batch(batch_id) if batch_id else \
                self.storage.get_calls_by_task(task_id) if task_id else \
                self.storage.get_all_calls()

        calls_data = [self._get_base_call_data(c) for c in calls]

        audit_data = []
        for log in self.storage.get_audit_logs():
            call = self.storage.get_call(log.call_id)
            audit_data.append({
                "日志ID": log.log_id,
                "呼叫ID": log.call_id,
                "客户姓名": call.customer_name if call else "",
                "修改字段": log.field_name,
                "原值": log.old_value or "",
                "新值": log.new_value or "",
                "操作人": log.operator,
                "操作时间": log.operate_time.strftime("%Y-%m-%d %H:%M:%S"),
                "操作原因": log.reason or ""
            })

        quality_data = []
        for qc in self.storage.get_quality_checks():
            if task_id and qc.task_id != task_id:
                continue
            call = self.storage.get_call(qc.call_id)
            quality_data.append({
                "质检ID": qc.check_id,
                "呼叫ID": qc.call_id,
                "质检人": qc.checker,
                "质检时间": qc.check_time.strftime("%Y-%m-%d %H:%M:%S"),
                "原始结果": qc.original_result,
                "质检后结果": qc.checked_result,
                "是否修改": "是" if qc.is_modified else "否",
                "质检备注": qc.check_comments or ""
            })

        discrepancy_data = []
        for d in self.storage.get_discrepancies(task_id=task_id):
            call = self.storage.get_call(d.call_id)
            discrepancy_data.append({
                "差异ID": d.discrepancy_id,
                "呼叫ID": d.call_id,
                "客户姓名": call.customer_name if call else "",
                "差异字段": d.field_name,
                "灰度值": d.grayscale_value,
                "报表值": d.report_value,
                "差异来源": d.source.value,
                "责任人": d.responsible_person,
                "是否解决": "是" if d.resolved else "否"
            })

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            pd.DataFrame(calls_data).to_excel(writer, sheet_name='呼叫明细', index=False)
            pd.DataFrame(audit_data).to_excel(writer, sheet_name='改判审计', index=False)
            pd.DataFrame(quality_data).to_excel(writer, sheet_name='质检记录', index=False)
            pd.DataFrame(discrepancy_data).to_excel(writer, sheet_name='差异记录', index=False)

        return {
            "success": True,
            "file_path": output_path,
            "sheets": {
                "呼叫明细": len(calls_data),
                "改判审计": len(audit_data),
                "质检记录": len(quality_data),
                "差异记录": len(discrepancy_data)
            }
        }
