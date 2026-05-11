"""报告导出模块"""

import csv
from datetime import datetime
from typing import List

from .models import CancellationRecord
from .datastore import DataStore


class ReportExporter:
    def __init__(self, store: DataStore):
        self.store = store

    def export_summary_csv(self, file_path: str):
        records = self.store.get_all_cancellations()
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "记录ID", "订舱号", "客户编号", "取消类型", "取消时间",
                "状态", "原始费用", "实际费用", "减免原因",
                "是否重复导入", "异常信息", "处理状态"
            ])
            
            for r in records:
                writer.writerow([
                    r.id, r.booking_no, r.customer_id, r.cancellation_type.value,
                    r.cancellation_time.strftime("%Y-%m-%d %H:%M:%S"),
                    r.status.value, f"{r.original_fee:.2f}", f"{r.charged_fee:.2f}",
                    r.waiver_reason or "",
                    "是" if r.is_repeat_import else "否",
                    "; ".join(r.exceptions),
                    "已处理" if r.processed else "未处理"
                ])

    def export_detail_report(self, file_path: str, booking_no: str = None):
        if booking_no:
            records = self.store.get_cancellations_by_booking(booking_no)
        else:
            records = self.store.get_all_cancellations()

        with open(file_path, 'w', encoding='utf-8-sig') as f:
            f.write("=" * 80 + "\n")
            f.write("货代舱位取消费用明细报告\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")

            total_original = 0.0
            total_charged = 0.0
            total_waivers = 0.0
            exceptions_count = 0

            for r in records:
                total_original += r.original_fee
                total_charged += r.charged_fee
                total_waivers += (r.original_fee - r.charged_fee)
                if r.exceptions:
                    exceptions_count += 1

                f.write(f"--- 记录ID: {r.id} ---\n")
                f.write(f"订舱号: {r.booking_no}\n")
                f.write(f"客户编号: {r.customer_id}\n")
                f.write(f"取消类型: {r.cancellation_type.value}\n")
                f.write(f"取消时间: {r.cancellation_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"状态: {r.status.value}\n")
                f.write(f"原始费用: ¥{r.original_fee:.2f}\n")
                f.write(f"实际费用: ¥{r.charged_fee:.2f}\n")
                f.write(f"减免金额: ¥{r.original_fee - r.charged_fee:.2f}\n")
                
                if r.waiver_reason:
                    f.write(f"减免原因: {r.waiver_reason}\n")
                    f.write(f"操作人: {r.waiver_operator}\n")
                if r.exceptions:
                    f.write(f"异常: {'; '.join(r.exceptions)}\n")
                f.write("\n")

            f.write("=" * 80 + "\n")
            f.write("统计汇总:\n")
            f.write(f"  总记录数: {len(records)}\n")
            f.write(f"  异常记录数: {exceptions_count}\n")
            f.write(f"  原始费用总额: ¥{total_original:.2f}\n")
            f.write(f"  减免金额总额: ¥{total_waivers:.2f}\n")
            f.write(f"  实际收费总额: ¥{total_charged:.2f}\n")
            f.write("=" * 80 + "\n")
