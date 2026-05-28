"""
批量文件处理器 - 正常数据和脏数据分开处理，结果方便复查
"""
import os
import json
import pandas as pd
from datetime import datetime, date
from typing import List, Dict, Optional, Any, Tuple
from .models import (
    SubscriptionOrder, InvestorMaterial, CoolOffPeriod,
    VisitRecord, PaymentFlow, MaterialType, MaterialStatus
)
from .cool_off import CoolOffStateMachine
from .material_validator import MaterialValidator
from .duplicate_guard import DuplicateSubscriptionGuard
from .visit_manager import VisitManager


class BatchFileProcessor:
    """批量文件处理器"""

    SUPPORTED_FORMATS = {".xlsx", ".xls", ".csv", ".json"}

    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def process_file(self, file_path: str, operator: str = "system") -> Dict[str, Any]:
        """
        处理单个文件，自动识别格式
        返回处理结果，包含正常数据和脏数据
        """
        if not os.path.exists(file_path):
            return {"error": f"文件不存在: {file_path}"}

        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.SUPPORTED_FORMATS:
            return {"error": f"不支持的文件格式: {ext}，支持: {', '.join(self.SUPPORTED_FORMATS)}"}

        try:
            raw_data = self._read_file(file_path, ext)
            orders = self._parse_orders(raw_data)
            return self.process_orders(orders, operator, file_path)
        except Exception as e:
            return {"error": f"处理文件失败: {str(e)}"}

    def _read_file(self, file_path: str, ext: str) -> List[Dict[str, Any]]:
        """读取文件，转换为统一的字典列表格式"""
        if ext in {".xlsx", ".xls"}:
            df = pd.read_excel(file_path)
            return df.to_dict('records')
        elif ext == ".csv":
            df = pd.read_csv(file_path)
            return df.to_dict('records')
        elif ext == ".json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else [data]
        return []

    def _parse_orders(self, raw_data: List[Dict[str, Any]]) -> List[SubscriptionOrder]:
        """解析原始数据为订单对象"""
        orders = []
        for idx, row in enumerate(raw_data):
            try:
                order = self._parse_single_order(row, idx)
                orders.append(order)
            except Exception as e:
                order = SubscriptionOrder(order_no=f"PARSE_ERROR_{idx}")
                order.error_details.append(f"第{idx+1}行解析失败: {str(e)}")
                orders.append(order)
        return orders

    def _parse_single_order(self, row: Dict[str, Any], row_idx: int) -> SubscriptionOrder:
        """解析单行数据为订单"""
        def get_val(*keys, default=None):
            for k in keys:
                if k in row and row[k] is not None and str(row[k]).strip():
                    return row[k]
            return default

        order = SubscriptionOrder(
            order_no=str(get_val("order_no", "订单号", "认购单号", default=f"AUTO_{row_idx}")),
            investor_id=str(get_val("investor_id", "投资者ID", "客户ID", default="")),
            investor_name=str(get_val("investor_name", "投资者姓名", "客户姓名", default="")),
            product_code=str(get_val("product_code", "产品代码", default="")),
            product_name=str(get_val("product_name", "产品名称", default="")),
            subscription_amount=float(get_val("subscription_amount", "认购金额", "金额", default=0) or 0),
            operator=str(get_val("operator", "操作员", default="")),
        )

        submit_time = get_val("submit_time", "提交时间", "认购时间")
        if submit_time is not None and not pd.isna(submit_time):
            if isinstance(submit_time, pd.Timestamp):
                order.submit_time = submit_time.to_pydatetime()
            elif isinstance(submit_time, datetime):
                order.submit_time = submit_time
            elif isinstance(submit_time, date):
                order.submit_time = datetime.combine(submit_time, datetime.min.time())
            else:
                try:
                    order.submit_time = pd.to_datetime(str(submit_time)).to_pydatetime()
                except:
                    order.error_details.append(f"提交时间格式错误: {submit_time}")

        cool_off_start = get_val("cool_off_start", "冷静期开始时间", "冷静期起算时间")
        if cool_off_start is not None and not pd.isna(cool_off_start):
            cool = CoolOffPeriod(subscription_id=order.subscription_id)
            try:
                if isinstance(cool_off_start, pd.Timestamp):
                    start_dt = cool_off_start.to_pydatetime()
                elif isinstance(cool_off_start, datetime):
                    start_dt = cool_off_start
                elif isinstance(cool_off_start, date):
                    start_dt = datetime.combine(cool_off_start, datetime.min.time())
                else:
                    start_dt = pd.to_datetime(str(cool_off_start)).to_pydatetime()
                cool.start(start_dt)
                order.cool_off = cool
            except Exception as e:
                order.error_details.append(f"冷静期开始时间格式错误: {cool_off_start}, {str(e)}")

        for mat_type in MaterialType:
            file_key = f"mat_{mat_type.name.lower()}_file"
            expire_key = f"mat_{mat_type.name.lower()}_expire"
            mat_file = get_val(file_key, f"{mat_type.value}文件", f"{mat_type.value}路径")
            mat_expire = get_val(expire_key, f"{mat_type.value}过期日期", f"{mat_type.value}有效期")

            if mat_file:
                mat = InvestorMaterial(
                    investor_id=order.investor_id,
                    material_type=mat_type,
                    file_path=str(mat_file),
                )
                if mat_expire is not None and not pd.isna(mat_expire) and str(mat_expire).strip():
                    try:
                        if isinstance(mat_expire, pd.Timestamp):
                            mat.expire_date = mat_expire.date()
                        elif isinstance(mat_expire, date):
                            mat.expire_date = mat_expire
                        else:
                            mat.expire_date = pd.to_datetime(str(mat_expire)).date()
                    except:
                        order.warnings.append(f"{mat_type.value}过期日期格式错误: {mat_expire}")
                order.materials.append(mat)

        visit_file = get_val("visit_record_file", "回访录音", "回访文件")
        if visit_file is not None and not pd.isna(visit_file) and str(visit_file).strip():
            visit = VisitRecord(subscription_id=order.subscription_id, investor_id=order.investor_id)
            visit.record(str(visit_file), str(get_val("visit_operator", "回访人", default=order.operator)))
            visit_confirm = get_val("visit_confirmed", "回访确认", "是否确认")
            if visit_confirm is not None and not pd.isna(visit_confirm) and str(visit_confirm).lower() in {"是", "true", "1", "yes", "y"}:
                visit.confirm(True)
            order.visit = visit

        pay_amount = get_val("payment_amount", "打款金额", "流水金额")
        if pay_amount is not None and not pd.isna(pay_amount) and float(pay_amount or 0) > 0:
            payment = PaymentFlow(
                subscription_id=order.subscription_id,
                amount=float(pay_amount or 0),
                pay_account=str(get_val("payment_account", "付款账户", default="")),
            )
            order.payment = payment

        return order

    def process_orders(self, orders: List[SubscriptionOrder], operator: str = "system",
                       source_file: str = "") -> Dict[str, Any]:
        """
        核心处理流程：解析 -> 去重检查 -> 材料校验 -> 冷静期校验 -> 锁住 -> 分组输出
        """
        result = {
            "source_file": source_file,
            "process_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "operator": operator,
            "total_count": len(orders),
            "clean": [],
            "dirty": [],
            "dirty_reasons": {},
            "duplicates": [],
        }

        parse_errors = [o for o in orders if any("解析失败" in e for e in o.error_details)]
        for o in parse_errors:
            result["dirty"].append(o)
            result["dirty_reasons"][o.order_no] = o.error_details

        valid_orders = [o for o in orders if o not in parse_errors]

        dup_guard = DuplicateSubscriptionGuard()
        dup_result = dup_guard.batch_check(valid_orders)
        for group in dup_result["duplicate_groups"]:
            result["duplicates"].append(group)
            for o_summary in group["orders"]:
                o = next((x for x in valid_orders if x.subscription_id == o_summary["subscription_id"]), None)
                if o and o not in result["dirty"]:
                    o.error_details.extend([f"重复认购: {group['investor_name']}在{group['product_code']}下有{group['count']}单"])

        cool_machine = CoolOffStateMachine()
        lock_result = cool_machine.batch_lock(valid_orders, operator)

        result["clean"] = lock_result["locked"]

        dirty_categories = {
            "冷静期未开始": lock_result["cool_off_pending"],
            "冷静期未满": lock_result["cool_off_not_completed"],
            "材料无效": lock_result["material_invalid"],
            "回访无效": lock_result["visit_invalid"],
            "其他错误": lock_result["failed"],
        }

        for category, order_list in dirty_categories.items():
            for o in order_list:
                if o not in result["dirty"] and o not in result["clean"]:
                    result["dirty"].append(o)
                    result["dirty_reasons"][o.order_no] = [f"【{category}】"] + o.error_details

        self._save_results(result)
        return result

    def _save_results(self, result: Dict[str, Any]) -> None:
        """保存处理结果，方便复查"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        clean_data = self._orders_to_dicts(result["clean"])
        if clean_data:
            clean_path = os.path.join(self.output_dir, f"clean_{timestamp}.xlsx")
            pd.DataFrame(clean_data).to_excel(clean_path, index=False)

        dirty_data = []
        for o in result["dirty"]:
            d = self._order_to_dict(o)
            d["错误原因"] = "; ".join(result["dirty_reasons"].get(o.order_no, o.error_details))
            dirty_data.append(d)
        if dirty_data:
            dirty_path = os.path.join(self.output_dir, f"dirty_{timestamp}.xlsx")
            pd.DataFrame(dirty_data).to_excel(dirty_path, index=False)

        if result["duplicates"]:
            dup_path = os.path.join(self.output_dir, f"duplicates_{timestamp}.json")
            with open(dup_path, "w", encoding="utf-8") as f:
                json.dump(result["duplicates"], f, ensure_ascii=False, indent=2)

        summary = {
            "处理时间": result["process_time"],
            "源文件": result["source_file"],
            "操作员": result["operator"],
            "总计": result["total_count"],
            "正常通过": len(result["clean"]),
            "脏数据": len(result["dirty"]),
            "重复认购组数": len(result["duplicates"]),
        }
        summary_path = os.path.join(self.output_dir, f"summary_{timestamp}.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

    def _orders_to_dicts(self, orders: List[SubscriptionOrder]) -> List[Dict[str, Any]]:
        return [self._order_to_dict(o) for o in orders]

    def _order_to_dict(self, order: SubscriptionOrder) -> Dict[str, Any]:
        d = {
            "订单号": order.order_no,
            "认购单ID": order.subscription_id,
            "投资者ID": order.investor_id,
            "投资者姓名": order.investor_name,
            "产品代码": order.product_code,
            "产品名称": order.product_name,
            "认购金额": order.subscription_amount,
            "提交时间": order.submit_time.strftime('%Y-%m-%d %H:%M:%S') if order.submit_time else "",
            "订单状态": order.status.value,
            "材料数量": len(order.materials),
            "材料状态": "全部有效" if order.materials and all(m.status == MaterialStatus.VALID for m in order.materials) else "存在问题",
            "冷静期状态": order.cool_off.status.value if order.cool_off else "无",
            "冷静期是否锁住": order.cool_off.is_locked if order.cool_off else False,
            "回访状态": order.visit.status.value if order.visit else "无",
        }
        return d

    def get_review_summary(self, result: Dict[str, Any]) -> str:
        """生成复查摘要，便于快速了解处理结果"""
        lines = [
            "=" * 60,
            "批量处理结果复查摘要",
            "=" * 60,
            f"处理时间: {result['process_time']}",
            f"源文件: {result['source_file']}",
            f"操作员: {result['operator']}",
            f"总计: {result['total_count']} 条",
            f"正常通过: {len(result['clean'])} 条",
            f"脏数据: {len(result['dirty'])} 条",
            f"重复认购: {len(result['duplicates'])} 组",
            "",
        ]

        if result["dirty"]:
            lines.extend(["- 脏数据明细:"])
            for o in result["dirty"]:
                reasons = result["dirty_reasons"].get(o.order_no, o.error_details)
                lines.append(f"  * [{o.order_no}] {o.investor_name}: {'; '.join(reasons)[:100]}")
            lines.append("")

        if result["duplicates"]:
            lines.extend(["- 重复认购明细:"])
            for g in result["duplicates"]:
                order_nos = ", ".join([o["order_no"] for o in g["orders"]])
                lines.append(f"  * [{g['investor_name']}] 产品{g['product_code']}: {g['count']}单 ({order_nos})")

        lines.extend([
            "",
            f"详细结果已保存至: {self.output_dir}",
            "=" * 60,
        ])

        return "\n".join(lines)
