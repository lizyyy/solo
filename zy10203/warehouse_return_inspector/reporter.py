import os
from datetime import datetime
from .database import Database


class Reporter:
    def __init__(self, db_path=None):
        self.db_path = db_path
        self.db = Database(db_path)

    def close(self):
        if self.db:
            self.db.close()

    def generate_sorting_report(self, output_path=None):
        db = self.db
        orders = db.get_all_orders()
        all_items = []
        for order in orders:
            items = db.get_items_by_order(order["order_no"])
            all_items.extend(items)

        unresolved_exceptions = db.get_unresolved_exceptions()
        all_exceptions = db.get_all_exceptions()

        by_quality = {}
        by_location = {}
        serial_counts = {}
        for item in all_items:
            qr = item["quality_result"] or "未质检"
            if qr not in by_quality:
                by_quality[qr] = []
            by_quality[qr].append(item)

            loc = item["warehouse_location"] or "未分配"
            if loc not in by_location:
                by_location[loc] = []
            by_location[loc].append(item)

            sn = item["serial_number"]
            if sn not in serial_counts:
                serial_counts[sn] = 0
            serial_counts[sn] += 1

        if output_path is None:
            output_path = os.path.join(
                os.getcwd(),
                f"分拣报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("=" * 70 + "\n")
            f.write("                仓库退货质检分拣报告\n")
            f.write("=" * 70 + "\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("-" * 70 + "\n")
            f.write("一、总体概览\n")
            f.write("-" * 70 + "\n")
            f.write(f"退货单总数: {len(orders)}\n")
            f.write(f"退货商品总数: {len(all_items)}\n")
            f.write(f"待处理异常数: {len(unresolved_exceptions)}\n")
            f.write(f"历史异常总数: {len(all_exceptions)}\n\n")

            f.write("-" * 70 + "\n")
            f.write("二、按质检结果分类\n")
            f.write("-" * 70 + "\n")
            for quality, items in sorted(by_quality.items()):
                f.write(f"\n【{quality}】({len(items)}件)\n")
                f.write("-" * 40 + "\n")
                for item in items:
                    f.write(
                        f"  订单: {item['order_no']} | "
                        f"SN: {item['serial_number']} | "
                        f"商品: {item['product_name'] or '未知'} | "
                        f"仓位: {item['warehouse_location'] or '未分配'} | "
                        f"退款: {item['refund_status'] or '未知'}\n"
                    )

            f.write("\n" + "-" * 70 + "\n")
            f.write("三、按仓位分类\n")
            f.write("-" * 70 + "\n")
            for location, items in sorted(by_location.items()):
                if location == "未分配":
                    continue
                f.write(f"\n【仓位 {location}】({len(items)}件)\n")
                f.write("-" * 40 + "\n")
                for item in items:
                    f.write(
                        f"  SN: {item['serial_number']} | "
                        f"订单: {item['order_no']} | "
                        f"质检: {item['quality_result'] or '未质检'}\n"
                    )

            f.write("\n" + "-" * 70 + "\n")
            f.write("四、异常报告 - 待处理\n")
            f.write("-" * 70 + "\n")
            if not unresolved_exceptions:
                f.write("暂无待处理异常 ✓\n")
            else:
                for ex in unresolved_exceptions:
                    f.write(f"\n■ 异常ID: {ex['id']}\n")
                    f.write(f"  类型: {ex['exception_type']}\n")
                    f.write(f"  订单: {ex['order_no']}\n")
                    f.write(f"  序列号: {ex['serial_number']}\n")
                    f.write(f"  问题说明:\n")
                    f.write(f"    {ex['exception_detail']}\n")
                    f.write(f"  发现时间: {ex['created_at']}\n")

            f.write("\n" + "-" * 70 + "\n")
            f.write("五、序列号重复检查\n")
            f.write("-" * 70 + "\n")
            duplicates = {k: v for k, v in serial_counts.items() if v > 1}
            if not duplicates:
                f.write("无序列号重复 ✓\n")
            else:
                f.write(f"发现 {len(duplicates)} 个序列号有重复记录:\n")
                for sn, count in duplicates.items():
                    items = db.get_item_by_serial(sn)
                    f.write(f"\n  SN: {sn} (共 {count} 条记录)\n")
                    for item in items:
                        f.write(
                            f"    - 订单: {item['order_no']} | "
                            f"质检: {item['quality_result'] or '未质检'} | "
                            f"导入批次: {item['import_batch_id'][:8]}...\n"
                        )

        return output_path

    def generate_exception_list(self, output_path=None):
        db = self.db
        all_exceptions = db.get_all_exceptions()

        if output_path is None:
            output_path = os.path.join(
                os.getcwd(),
                f"异常清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("=" * 70 + "\n")
            f.write("                退货异常清单（含人工修正记录）\n")
            f.write("=" * 70 + "\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            if not all_exceptions:
                f.write("暂无异常记录\n")
            else:
                for ex in all_exceptions:
                    status = "已解决" if ex["is_resolved"] else "待处理"
                    f.write(f"\n{'='*70}\n")
                    f.write(f"异常ID: {ex['id']}  状态: [{status}]\n")
                    f.write(f"类型: {ex['exception_type']}\n")
                    f.write(f"订单: {ex['order_no']}  SN: {ex['serial_number']}\n")
                    f.write(f"问题:\n  {ex['exception_detail']}\n")
                    f.write(f"发现时间: {ex['created_at']}\n")
                    if ex["is_resolved"]:
                        f.write(f"解决时间: {ex['resolved_at']}\n")
                        f.write(f"处理说明: {ex['resolution_note']}\n")

        return output_path

    def list_orders(self):
        return self.db.get_all_orders()

    def list_items(self, order_no=None):
        db = self.db
        if order_no:
            return db.get_items_by_order(order_no)
        else:
            items = []
            for order in db.get_all_orders():
                items.extend(db.get_items_by_order(order["order_no"]))
            return items

    def list_exceptions(self, unresolved_only=False):
        db = self.db
        if unresolved_only:
            return db.get_unresolved_exceptions()
        else:
            return db.get_all_exceptions()
