class Validator:
    def __init__(self, db):
        self.db = db

    def validate_item(
        self,
        item_id,
        serial_number,
        order_no,
        quality_result,
        missing_parts_note,
        refund_status,
        warehouse_location,
        repair_responsibility,
    ):
        exceptions = []

        dup_ex = self.check_duplicate_serial(item_id, serial_number, order_no)
        if dup_ex:
            exceptions.append(dup_ex)

        refund_ex = self.check_refund_before_quality(
            item_id, serial_number, order_no, quality_result, refund_status
        )
        if refund_ex:
            exceptions.append(refund_ex)

        scrap_ex = self.check_scrap_with_location(
            item_id, serial_number, order_no, quality_result, warehouse_location
        )
        if scrap_ex:
            exceptions.append(scrap_ex)

        repair_ex = self.check_repair_responsibility(
            item_id, serial_number, order_no, quality_result, repair_responsibility
        )
        if repair_ex:
            exceptions.append(repair_ex)

        for ex in exceptions:
            self.db.add_exception(
                item_id,
                serial_number,
                order_no,
                ex["exception_type"],
                ex["exception_detail"],
            )

        return exceptions

    def check_duplicate_serial(self, item_id, serial_number, order_no):
        existing = self.db.get_item_by_serial(serial_number)
        if len(existing) > 1:
            other_orders = [
                row["order_no"] for row in existing if row["id"] != item_id
            ]
            return {
                "item_id": item_id,
                "serial_number": serial_number,
                "order_no": order_no,
                "exception_type": "序列号重复",
                "exception_detail": (
                    f"该序列号已在订单 {', '.join(other_orders)} 中出现过。"
                    f"请检查是否是同一商品重复导入、序列号录入错误，"
                    f"还是同一商品在不同退货单中出现。"
                ),
            }
        return None

    def check_refund_before_quality(
        self, item_id, serial_number, order_no, quality_result, refund_status
    ):
        refund_done = refund_status in ["已退款", "已批准"]
        no_quality = quality_result is None

        if refund_done and no_quality:
            return {
                "item_id": item_id,
                "serial_number": serial_number,
                "order_no": order_no,
                "exception_type": "未质检先退款",
                "exception_detail": (
                    f"当前退款状态为【{refund_status}】，"
                    f"但质检结果未填写。"
                    f"根据流程，必须先完成质检才能批准退款。"
                    f"请补充质检结果后再处理退款。"
                ),
            }
        return None

    def check_scrap_with_location(
        self, item_id, serial_number, order_no, quality_result, warehouse_location
    ):
        is_scrap = quality_result == "报废"
        has_location = warehouse_location is not None and warehouse_location.strip() != ""

        if is_scrap and has_location:
            return {
                "item_id": item_id,
                "serial_number": serial_number,
                "order_no": order_no,
                "exception_type": "报废品回补库存",
                "exception_detail": (
                    f"质检结果为【报废】，但填写了仓位【{warehouse_location}】。"
                    f"报废商品不应进入可用库存仓位。"
                    f"请确认商品状态：如果确实报废，请清空仓位；"
                    f"如果商品可回用，请将质检结果改为【合格】或【需返修】。"
                ),
            }
        return None

    def check_repair_responsibility(
        self, item_id, serial_number, order_no, quality_result, repair_responsibility
    ):
        needs_repair = quality_result == "需返修"
        no_responsibility = (
            repair_responsibility is None or repair_responsibility.strip() == ""
        )

        if needs_repair and no_responsibility:
            return {
                "item_id": item_id,
                "serial_number": serial_number,
                "order_no": order_no,
                "exception_type": "返修件缺少责任说明",
                "exception_detail": (
                    f"质检结果为【需返修】，但未填写返修责任说明。"
                    f"请补充责任归属信息，例如："
                    f"厂方责任（质量问题）、物流责任（运输损坏）、"
                    f"用户责任（人为损坏）等，以便后续追责。"
                ),
            }
        return None
