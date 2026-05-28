import os
import pandas as pd
from datetime import datetime
from typing import List, Dict
from pathlib import Path
import logging
from models import SurrenderProcess, SurrenderException


logger = logging.getLogger(__name__)


class ReportExporter:
    def __init__(self, config):
        self.config = config
        self.output_dir = config.paths.get("output_dir", "./data/output")
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    def export_all(self, processes: List[SurrenderProcess], 
                   exceptions: List[SurrenderException],
                   version_info: Dict) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        summary_df = self._generate_summary_report(processes)
        detail_df = self._generate_detail_report(processes)
        exception_df = self._generate_exception_report(exceptions)
        cooling_off_df = self._generate_cooling_off_report(processes)
        refund_df = self._generate_refund_report(processes)
        
        report_path = os.path.join(self.output_dir, f"surrender_batch_{timestamp}.xlsx")
        
        with pd.ExcelWriter(report_path, engine='openpyxl') as writer:
            summary_df.to_excel(writer, sheet_name='批处理汇总', index=False)
            detail_df.to_excel(writer, sheet_name='处理明细', index=False)
            exception_df.to_excel(writer, sheet_name='异常清单', index=False)
            cooling_off_df.to_excel(writer, sheet_name='犹豫期分析', index=False)
            refund_df.to_excel(writer, sheet_name='退费明细', index=False)
            
            self._generate_version_sheet(writer, version_info)
        
        self._export_csv_files(summary_df, detail_df, exception_df, 
                               cooling_off_df, refund_df, timestamp)
        
        self._generate_text_report(processes, exceptions, timestamp)
        
        logger.info(f"报告已导出至: {report_path}")
        return report_path

    def _generate_summary_report(self, processes: List[SurrenderProcess]) -> pd.DataFrame:
        total = len(processes)
        status_counts = {}
        for p in processes:
            status = p.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        total_fees = sum(sum(r.fee_amount for r in p.fee_records) for p in processes)
        total_refund = sum(p.refund.refund_amount for p in processes if p.refund)
        total_deduction = sum(p.refund.deduction_amount for p in processes if p.refund)
        
        data = [
            ["统计项目", "数值", "说明"],
            ["批处理时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ""],
            ["处理申请总数", total, ""],
            ["已通过", status_counts.get("已通过", 0), "数据完整可直接退费"],
            ["审核中", status_counts.get("审核中", 0), "需人工审核确认"],
            ["异常", status_counts.get("异常", 0), "存在严重异常"],
            ["争议", status_counts.get("争议", 0), "存在争议待处理"],
            ["已拒绝", status_counts.get("已拒绝", 0), ""],
            ["已退费", status_counts.get("已退费", 0), ""],
            ["待处理", status_counts.get("待处理", 0), ""],
            ["", "", ""],
            ["已扣费总额", round(total_fees, 2), "元"],
            ["应退费总额", round(total_refund, 2), "元"],
            ["扣费总额", round(total_deduction, 2), "元"],
            ["平均退费比例", round(total_refund/total_fees*100, 2) if total_fees > 0 else 0, "%"]
        ]
        
        return pd.DataFrame(data[1:], columns=data[0])

    def _generate_detail_report(self, processes: List[SurrenderProcess]) -> pd.DataFrame:
        data = []
        for p in processes:
            policy = p.policy
            app = p.application
            sign = p.sign_record
            
            row = {
                "保单号": p.policy_no,
                "申请编号": p.apply_no,
                "投保人": policy.applicant_name if policy else "",
                "险种名称": policy.policy_name if policy else "",
                "保费金额": policy.premium if policy else 0,
                "签收日期": sign.sign_date.strftime("%Y-%m-%d") if sign else "",
                "申请日期": app.apply_date.strftime("%Y-%m-%d") if app else "",
                "犹豫期已用天数": p.cooling_off_days_used or "",
                "是否在犹豫期内": "是" if p.is_within_cooling_off else "否" if p.is_within_cooling_off is False else "未知",
                "已扣费金额": round(sum(r.fee_amount for r in p.fee_records), 2),
                "应退费金额": round(p.refund.refund_amount, 2) if p.refund else "",
                "扣除费用": round(p.refund.deduction_amount, 2) if p.refund else "",
                "回访次数": len(p.visit_records),
                "异常数量": len(p.exceptions),
                "处理状态": p.status.value,
                "处理备注": p.process_notes or ""
            }
            data.append(row)
        
        return pd.DataFrame(data)

    def _generate_exception_report(self, exceptions: List[SurrenderException]) -> pd.DataFrame:
        data = []
        for e in exceptions:
            row = {
                "保单号": e.policy_no,
                "申请编号": e.apply_no or "",
                "异常类型": e.exception_type,
                "异常级别": e.exception_level,
                "异常描述": e.exception_desc,
                "发现时间": e.detect_time.strftime("%Y-%m-%d %H:%M:%S"),
                "建议处理方式": e.suggested_action,
                "处理人": e.handler or "",
                "是否已解决": "是" if e.is_resolved else "否",
                "处理备注": e.resolve_notes or ""
            }
            data.append(row)
        
        df = pd.DataFrame(data)
        if not df.empty:
            df = df.sort_values(by=["异常级别", "发现时间"], ascending=[True, True])
        
        return df

    def _generate_cooling_off_report(self, processes: List[SurrenderProcess]) -> pd.DataFrame:
        data = []
        for p in processes:
            if p.sign_record and p.application:
                sign_date = p.sign_record.sign_date
                apply_date = p.application.apply_date
                days_used = p.cooling_off_days_used or 0
                
                row = {
                    "保单号": p.policy_no,
                    "投保人": p.policy.applicant_name if p.policy else "",
                    "签收日期": sign_date.strftime("%Y-%m-%d"),
                    "申请日期": apply_date.strftime("%Y-%m-%d"),
                    "犹豫期天数": 15,
                    "已用天数": days_used,
                    "剩余天数": max(0, 15 - days_used),
                    "是否超期": "是" if days_used > 15 else "否",
                    "处理状态": p.status.value
                }
                data.append(row)
        
        return pd.DataFrame(data)

    def _generate_refund_report(self, processes: List[SurrenderProcess]) -> pd.DataFrame:
        data = []
        for p in processes:
            if p.refund:
                row = {
                    "保单号": p.policy_no,
                    "申请编号": p.apply_no,
                    "退费编号": p.refund.refund_no,
                    "投保人": p.policy.applicant_name if p.policy else "",
                    "退费类型": "犹豫期内退保" if p.is_within_cooling_off else "犹豫期后退保",
                    "已扣费总额": round(sum(r.fee_amount for r in p.fee_records), 2),
                    "退费金额": p.refund.refund_amount,
                    "扣除金额": p.refund.deduction_amount,
                    "扣费明细": str(p.refund.deduction_detail),
                    "退费渠道": p.refund.refund_channel,
                    "退费状态": p.refund.refund_status,
                    "退费日期": p.refund.refund_date.strftime("%Y-%m-%d")
                }
                data.append(row)
        
        return pd.DataFrame(data)

    def _generate_version_sheet(self, writer, version_info: Dict):
        data = [["数据类型", "最新版本", "源文件", "导入时间", "记录数"]]
        for data_type, info in version_info.items():
            latest_v = info.get("latest_version", 0)
            versions = info.get("versions", {})
            version_data = versions.get(f"v{latest_v}", {})
            data.append([
                data_type,
                f"v{latest_v}",
                version_data.get("source_file", ""),
                version_data.get("import_time", "").strftime("%Y-%m-%d %H:%M:%S") if version_data.get("import_time") else "",
                version_data.get("record_count", 0)
            ])
        
        df = pd.DataFrame(data[1:], columns=data[0])
        df.to_excel(writer, sheet_name='数据版本', index=False)

    def _export_csv_files(self, summary_df, detail_df, exception_df, 
                          cooling_off_df, refund_df, timestamp):
        formats = self.config.export.get("formats", [])
        if "csv" not in formats:
            return
        
        csv_dir = os.path.join(self.output_dir, f"csv_{timestamp}")
        Path(csv_dir).mkdir(parents=True, exist_ok=True)
        
        detail_df.to_csv(os.path.join(csv_dir, "处理明细.csv"), index=False, encoding='utf-8-sig')
        exception_df.to_csv(os.path.join(csv_dir, "异常清单.csv"), index=False, encoding='utf-8-sig')
        cooling_off_df.to_csv(os.path.join(csv_dir, "犹豫期分析.csv"), index=False, encoding='utf-8-sig')
        refund_df.to_csv(os.path.join(csv_dir, "退费明细.csv"), index=False, encoding='utf-8-sig')

    def _generate_text_report(self, processes: List[SurrenderProcess],
                              exceptions: List[SurrenderException], timestamp: str):
        critical_exceptions = [e for e in exceptions if e.exception_level == "严重" and not e.is_resolved]
        
        report_lines = [
            "=" * 60,
            "保险犹豫期退保批处理报告",
            "=" * 60,
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"处理申请数: {len(processes)}",
            f"异常总数: {len(exceptions)}",
            f"严重异常: {len(critical_exceptions)}",
            "",
        ]
        
        if critical_exceptions:
            report_lines.extend([
                "【重要提醒】以下严重异常需优先处理：",
                "-" * 60,
            ])
            for i, e in enumerate(critical_exceptions, 1):
                report_lines.extend([
                    f"\n{i}. 保单号: {e.policy_no}",
                    f"   异常类型: {e.exception_type}",
                    f"   问题描述: {e.exception_desc}",
                    f"   建议操作: {e.suggested_action}",
                ])
        
        report_lines.extend([
            "",
            "=" * 60,
            "说明:",
            "1. 本报告由系统自动生成，请勿手工修改",
            "2. 严重异常单据请于24小时内处理完毕",
            "3. 如有疑问请联系系统管理员",
            "=" * 60,
        ])
        
        report_path = os.path.join(self.output_dir, f"处理说明_{timestamp}.txt")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
