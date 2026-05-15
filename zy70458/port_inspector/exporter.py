import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import pandas as pd
from .models import InspectionSample, InspectionResult, RiskLevel
from .storage import DataStorage


class Exporter:
    def __init__(self, data_dir: Path):
        self.storage = DataStorage(data_dir)
        self.exports_dir = data_dir / "exports"
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def export_anomalies(self, batch_id: str, output_file: Optional[Path] = None,
                        risk_filter: Optional[str] = None) -> Path:
        results = self.storage.get_results_by_batch(batch_id)

        if risk_filter:
            results = [r for r in results if r.risk_level == risk_filter]

        anomaly_results = [r for r in results if r.is_anomaly]

        if not anomaly_results:
            raise ValueError(f"批次 {batch_id} 没有异常样本")

        rows = []
        for result in anomaly_results:
            sample = self.storage.get_sample(result.sample_id)
            if sample:
                rows.append({
                    '样本ID': sample.sample_id,
                    '批次ID': sample.batch_id,
                    '源文件': sample.source_file,
                    '行号': sample.row_number,
                    'IP地址': sample.ip_address,
                    '端口': sample.port,
                    '协议': sample.protocol,
                    '进程名': sample.process_name,
                    '连接数': sample.connection_count,
                    '供应商(原始)': sample.supplier_original,
                    '供应商(修正)': sample.supplier_corrected or '',
                    '部门': sample.department,
                    '业务线': sample.business_line,
                    '巡检时间': sample.inspection_time,
                    '规则版本': result.rule_version,
                    '风险等级': result.risk_level.value,
                    '是否异常': '是' if result.is_anomaly else '否',
                    '结论': result.conclusion,
                    '端口状态': result.port_status,
                    '是否复核': '是' if result.reviewed else '否',
                    '复核人': result.reviewer or '',
                    '复核时间': result.review_time or '',
                    '复核备注': result.review_notes or '',
                })

        df = pd.DataFrame(rows)

        if output_file is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = self.exports_dir / f"anomalies_{batch_id}_{timestamp}.xlsx"

        df.to_excel(output_file, index=False, engine='openpyxl')
        return output_file

    def export_full_report(self, batch_id: str, output_file: Optional[Path] = None) -> Path:
        results = self.storage.get_results_by_batch(batch_id)

        rows = []
        for result in results:
            sample = self.storage.get_sample(result.sample_id)
            if sample:
                rows.append({
                    '样本ID': sample.sample_id,
                    '批次ID': sample.batch_id,
                    '源文件': sample.source_file,
                    '行号': sample.row_number,
                    'IP地址': sample.ip_address,
                    '端口': sample.port,
                    '协议': sample.protocol,
                    '进程名': sample.process_name,
                    '连接数': sample.connection_count,
                    '供应商(原始)': sample.supplier_original,
                    '供应商(修正)': sample.supplier_corrected or '',
                    '部门': sample.department,
                    '业务线': sample.business_line,
                    '巡检时间': sample.inspection_time,
                    '规则版本': result.rule_version,
                    '风险等级': result.risk_level.value,
                    '是否异常': '是' if result.is_anomaly else '否',
                    '结论': result.conclusion,
                    '端口状态': result.port_status,
                    '是否复核': '是' if result.reviewed else '否',
                })

        df = pd.DataFrame(rows)

        if output_file is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = self.exports_dir / f"report_{batch_id}_{timestamp}.xlsx"

        df.to_excel(output_file, index=False, engine='openpyxl')
        return output_file

    def export_by_risk_level(self, risk_level: str, output_file: Optional[Path] = None) -> Path:
        results = self.storage.get_anomalies_by_risk(risk_level)

        if not results:
            raise ValueError(f"没有找到风险等级为 {risk_level} 的异常样本")

        rows = []
        for result in results:
            sample = self.storage.get_sample(result.sample_id)
            if sample:
                rows.append({
                    '样本ID': sample.sample_id,
                    '批次ID': sample.batch_id,
                    '源文件': sample.source_file,
                    '行号': sample.row_number,
                    'IP地址': sample.ip_address,
                    '端口': sample.port,
                    '协议': sample.protocol,
                    '进程名': sample.process_name,
                    '连接数': sample.connection_count,
                    '供应商(原始)': sample.supplier_original,
                    '供应商(修正)': sample.supplier_corrected or '',
                    '部门': sample.department,
                    '业务线': sample.business_line,
                    '巡检时间': sample.inspection_time,
                    '规则版本': result.rule_version,
                    '风险等级': result.risk_level.value,
                    '结论': result.conclusion,
                    '是否复核': '是' if result.reviewed else '否',
                })

        df = pd.DataFrame(rows)

        if output_file is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = self.exports_dir / f"risk_{risk_level}_{timestamp}.xlsx"

        df.to_excel(output_file, index=False, engine='openpyxl')
        return output_file

    def mark_reviewed(self, sample_id: str, reviewer: str, notes: str = "") -> InspectionResult:
        result = self.storage.get_result(sample_id)
        if result is None:
            raise ValueError(f"样本 {sample_id} 不存在")

        result.reviewed = True
        result.reviewer = reviewer
        result.review_time = datetime.now()
        result.review_notes = notes

        self.storage.save_result(result)
        return result
