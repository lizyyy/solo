import csv
import os
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

from models import (
    Order, Material, OutboundRecord, ReturnRecord, CompensationRecord,
    BadRecord, MaterialInventory, DamageLevel, CompensationStatus
)
from rules import RuleEngine


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _get_report_filename(self, prefix: str, order_id: str = None) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if order_id:
            filename = f"{prefix}_{order_id}_{timestamp}.csv"
        else:
            filename = f"{prefix}_{timestamp}.csv"
        return os.path.join(self.output_dir, filename)

    def generate_bad_records_report(self, bad_records: List[BadRecord]) -> str:
        filename = self._get_report_filename("bad_records")

        sorted_bad_records = sorted(bad_records, key=lambda x: (x.source.file_path, x.source.row_number))

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['文件路径', '工作表', '行号', '原始内容', '错误类型', '错误信息'])

            for br in sorted_bad_records:
                writer.writerow([
                    br.source.file_path,
                    br.source.sheet_name or '',
                    br.source.row_number,
                    br.source.raw_content,
                    br.error_type,
                    br.error_message
                ])

        return filename

    def generate_inventory_report(self, inventories: List[MaterialInventory],
                                 materials: Dict[str, Material],
                                 orders: Dict[str, Order]) -> str:
        filename = self._get_report_filename("inventory_summary")

        sorted_inventories = sorted(inventories, key=lambda x: (x.order_id, x.material_id))

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['订单ID', '活动名称', '物料ID', '物料名称', '物料类型',
                            '出库数量', '已归还数量', '待归还数量', '丢失数量', '损坏数量'])

            for inv in sorted_inventories:
                material = materials.get(inv.material_id, None)
                order = orders.get(inv.order_id, None)
                writer.writerow([
                    inv.order_id,
                    order.event_name if order else '',
                    inv.material_id,
                    material.name if material else '',
                    material.material_type.value if material else '',
                    inv.outbound_quantity,
                    inv.returned_quantity,
                    inv.pending_quantity,
                    inv.lost_quantity,
                    inv.damaged_quantity
                ])

        return filename

    def generate_pending_returns_report(self, pending: List[MaterialInventory],
                                       materials: Dict[str, Material],
                                       orders: Dict[str, Order]) -> str:
        filename = self._get_report_filename("pending_returns")

        sorted_pending = sorted(pending, key=lambda x: (x.order_id, x.material_id))

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['订单ID', '活动名称', '客户姓名', '物料ID', '物料名称',
                            '出库数量', '已归还数量', '待归还数量'])

            for inv in sorted_pending:
                material = materials.get(inv.material_id, None)
                order = orders.get(inv.order_id, None)
                writer.writerow([
                    inv.order_id,
                    order.event_name if order else '',
                    order.customer_name if order else '',
                    inv.material_id,
                    material.name if material else '',
                    inv.outbound_quantity,
                    inv.returned_quantity,
                    inv.pending_quantity
                ])

        return filename

    def generate_compensation_report(self, compensations: List[CompensationRecord],
                                    materials: Dict[str, Material],
                                    orders: Dict[str, Order]) -> str:
        filename = self._get_report_filename("compensation_summary")

        sorted_compensations = sorted(compensations, key=lambda x: (x.order_id, x.material_id, x.compensation_id))

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['赔付ID', '订单ID', '活动名称', '物料ID', '物料名称',
                            '损坏程度', '赔付金额', '赔付状态', '记录时间', '备注'])

            for comp in sorted_compensations:
                material = materials.get(comp.material_id, None)
                order = orders.get(comp.order_id, None)
                writer.writerow([
                    comp.compensation_id,
                    comp.order_id,
                    order.event_name if order else '',
                    comp.material_id,
                    material.name if material else '',
                    comp.damage_level.value,
                    comp.compensation_amount,
                    comp.status.value,
                    comp.recorded_at,
                    comp.notes
                ])

        return filename

    def generate_damage_report(self, returns: List[ReturnRecord],
                              materials: Dict[str, Material],
                              orders: Dict[str, Order]) -> str:
        filename = self._get_report_filename("damage_summary")

        damaged_returns = [r for r in returns if r.damage_level != DamageLevel.NONE]
        sorted_damaged = sorted(damaged_returns, key=lambda x: (x.order_id, x.material_id, x.return_id))

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['归还ID', '订单ID', '活动名称', '物料ID', '物料名称',
                            '归还数量', '损坏程度', '损坏描述', '归还日期', '检查人'])

            for ret in sorted_damaged:
                material = materials.get(ret.material_id, None)
                order = orders.get(ret.order_id, None)
                writer.writerow([
                    ret.return_id,
                    ret.order_id,
                    order.event_name if order else '',
                    ret.material_id,
                    material.name if material else '',
                    ret.quantity,
                    ret.damage_level.value,
                    ret.damage_description,
                    ret.return_date,
                    ret.checker
                ])

        return filename

    def generate_final_report(self, rule_engine: RuleEngine,
                             orders: Dict[str, Order],
                             materials: Dict[str, Material],
                             compensations: List[CompensationRecord],
                             valid_returns: List[ReturnRecord]) -> str:
        filename = self._get_report_filename("final_settlement")

        loss_summary = rule_engine.get_loss_summary()
        pending_returns = rule_engine.get_pending_returns()

        total_compensation = sum(c.compensation_amount for c in compensations)
        total_completed = sum(1 for c in compensations if c.status == CompensationStatus.COMPLETED)
        total_pending = sum(1 for c in compensations if c.status == CompensationStatus.PENDING)

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)

            writer.writerow(['=== 婚礼物料归还丢损赔付结案报告 ==='])
            writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])

            writer.writerow(['一、汇总统计'])
            writer.writerow(['订单总数', len(orders)])
            writer.writerow(['物料总数', len(materials)])
            writer.writerow(['出库总数量', loss_summary.get('total_outbound', 0)])
            writer.writerow(['已归还总数量', loss_summary.get('total_returned', 0)])
            writer.writerow(['丢失总数量', loss_summary.get('total_lost', 0)])
            writer.writerow(['损坏总数量', loss_summary.get('total_damaged', 0)])
            writer.writerow(['待归还订单数', len(pending_returns)])
            writer.writerow([])

            writer.writerow(['二、赔付统计'])
            writer.writerow(['赔付记录总数', len(compensations)])
            writer.writerow(['赔付总金额', f"{total_compensation:.2f}"])
            writer.writerow(['已完成赔付数', total_completed])
            writer.writerow(['待赔付数', total_pending])
            writer.writerow([])

            writer.writerow(['三、异常记录'])
            writer.writerow(['警告数', len(rule_engine.warnings)])
            writer.writerow(['错误数', len(rule_engine.errors)])
            writer.writerow([])

            if rule_engine.warnings:
                writer.writerow(['警告详情'])
                for w in rule_engine.warnings:
                    writer.writerow([w])
                writer.writerow([])

            if rule_engine.errors:
                writer.writerow(['错误详情'])
                for e in rule_engine.errors:
                    writer.writerow([e])
                writer.writerow([])

        return filename

    def generate_all_reports(self,
                            bad_records: List[BadRecord],
                            inventories: List[MaterialInventory],
                            pending_returns: List[MaterialInventory],
                            compensations: List[CompensationRecord],
                            valid_returns: List[ReturnRecord],
                            orders: List[Order],
                            materials: List[Material],
                            rule_engine: RuleEngine) -> Dict[str, str]:

        orders_dict = {o.order_id: o for o in orders}
        materials_dict = {m.material_id: m for m in materials}

        reports = {}

        if bad_records:
            reports['bad_records'] = self.generate_bad_records_report(bad_records)

        reports['inventory'] = self.generate_inventory_report(inventories, materials_dict, orders_dict)

        if pending_returns:
            reports['pending_returns'] = self.generate_pending_returns_report(pending_returns, materials_dict, orders_dict)

        reports['compensation'] = self.generate_compensation_report(compensations, materials_dict, orders_dict)

        damaged_returns = [r for r in valid_returns if r.damage_level != DamageLevel.NONE]
        if damaged_returns:
            reports['damage'] = self.generate_damage_report(valid_returns, materials_dict, orders_dict)

        reports['final'] = self.generate_final_report(rule_engine, orders_dict, materials_dict, compensations, valid_returns)

        return reports
