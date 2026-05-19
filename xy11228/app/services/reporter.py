import os
import pandas as pd
from datetime import datetime
from typing import List, Optional

from app.models import FaultClassification, BadRecord
from app.utils.storage import DataStorage


class ReportExporter:
    def __init__(self, storage: DataStorage, output_dir: str = "data/output"):
        self.storage = storage
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def export_faults_to_csv(
        self,
        faults: List[FaultClassification],
        filename: Optional[str] = None,
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"fault_report_{timestamp}.csv"

        file_path = os.path.join(self.output_dir, filename)

        data = []
        for fault in faults:
            data.append(
                {
                    "故障ID": fault.fault_id,
                    "来源类型": fault.source_type,
                    "来源ID": fault.source_id,
                    "换电站ID": fault.station_id,
                    "故障类型": self._translate_fault_type(fault.fault_type),
                    "故障描述": fault.fault_description,
                    "状态": self._translate_status(fault.status),
                    "严重程度": self._translate_severity(fault.severity),
                    "负责人": fault.assignee or "",
                    "仓号": fault.bay_number or "",
                    "发生时间": fault.event_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "置信度": f"{fault.confidence:.1%}",
                    "备注": fault.notes or "",
                    "创建时间": fault.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "更新时间": fault.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

        df = pd.DataFrame(data)
        df.to_csv(file_path, index=False, encoding="utf-8-sig")
        return file_path

    def export_bad_records_to_csv(
        self,
        bad_records: List[BadRecord],
        filename: Optional[str] = None,
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"bad_records_{timestamp}.csv"

        file_path = os.path.join(self.output_dir, filename)

        data = []
        for br in bad_records:
            data.append(
                {
                    "坏记录ID": br.bad_record_id,
                    "数据来源": self._translate_source(br.source),
                    "文件名": br.file_name,
                    "行号": br.row_number or "",
                    "原始数据": br.raw_data,
                    "错误信息": br.error_message,
                    "修改建议": br.suggestion or "",
                    "状态": br.status,
                    "创建时间": br.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

        df = pd.DataFrame(data)
        df.to_csv(file_path, index=False, encoding="utf-8-sig")
        return file_path

    def export_summary_to_excel(
        self,
        faults: List[FaultClassification],
        bad_records: List[BadRecord],
        filename: Optional[str] = None,
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"full_report_{timestamp}.xlsx"

        file_path = os.path.join(self.output_dir, filename)

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            faults_data = []
            for fault in faults:
                faults_data.append(
                    {
                        "故障ID": fault.fault_id,
                        "故障类型": self._translate_fault_type(fault.fault_type),
                        "故障描述": fault.fault_description,
                        "换电站ID": fault.station_id,
                        "状态": self._translate_status(fault.status),
                        "严重程度": self._translate_severity(fault.severity),
                        "负责人": fault.assignee or "",
                        "发生时间": fault.event_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "置信度": f"{fault.confidence:.1%}",
                    }
                )
            df_faults = pd.DataFrame(faults_data)
            df_faults.to_excel(writer, sheet_name="故障清单", index=False)

            bad_data = []
            for br in bad_records:
                bad_data.append(
                    {
                        "坏记录ID": br.bad_record_id,
                        "数据来源": self._translate_source(br.source),
                        "文件名": br.file_name,
                        "错误信息": br.error_message[:200],
                        "修改建议": br.suggestion or "",
                    }
                )
            df_bad = pd.DataFrame(bad_data)
            df_bad.to_excel(writer, sheet_name="异常数据", index=False)

            summary_data = self._generate_summary_data(faults, bad_records)
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name="统计汇总", index=False)

        return file_path

    def _generate_summary_data(
        self, faults: List[FaultClassification], bad_records: List[BadRecord]
    ) -> List[dict]:
        from collections import Counter

        total_faults = len(faults)
        type_counts = Counter(f.fault_type for f in faults)
        status_counts = Counter(f.status for f in faults)

        summary = [
            {"类别": "故障总数", "数值": total_faults},
            {"类别": "待审核", "数值": status_counts.get("pending_review", 0)},
            {"类别": "已确认", "数值": status_counts.get("confirmed", 0)},
            {"类别": "已解决", "数值": status_counts.get("resolved", 0)},
            {"类别": "已驳回", "数值": status_counts.get("dismissed", 0)},
            {"类别": "柜门打不开", "数值": type_counts.get("door_failure", 0)},
            {"类别": "扫码失败", "数值": type_counts.get("scan_failure", 0)},
            {"类别": "空仓误报", "数值": type_counts.get("empty_bay_false_alarm", 0)},
            {"类别": "电池异常", "数值": type_counts.get("battery_issue", 0)},
            {"类别": "网络异常", "数值": type_counts.get("network_issue", 0)},
            {"类别": "其他故障", "数值": type_counts.get("other", 0)},
            {"类别": "坏记录总数", "数值": len(bad_records)},
        ]
        return summary

    def _translate_fault_type(self, fault_type: str) -> str:
        translations = {
            "door_failure": "柜门打不开",
            "scan_failure": "扫码失败",
            "empty_bay_false_alarm": "空仓误报",
            "battery_issue": "电池异常",
            "network_issue": "网络异常",
            "other": "其他",
        }
        return translations.get(fault_type, fault_type)

    def _translate_status(self, status: str) -> str:
        translations = {
            "pending_classification": "待分类",
            "pending_review": "待审核",
            "confirmed": "已确认",
            "resolved": "已解决",
            "dismissed": "已驳回",
        }
        return translations.get(status, status)

    def _translate_severity(self, severity: str) -> str:
        translations = {
            "low": "低",
            "medium": "中",
            "high": "高",
            "critical": "严重",
        }
        return translations.get(severity, severity)

    def _translate_source(self, source: str) -> str:
        translations = {
            "device_event_json": "设备事件JSON",
            "customer_service_csv": "客服工单CSV",
        }
        return translations.get(source, source)
