"""
统一服务入口 - 整合所有功能，提供简单易用的API
"""
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime
from .models import SubscriptionOrder
from .cool_off import CoolOffStateMachine
from .material_validator import MaterialValidator
from .duplicate_guard import DuplicateSubscriptionGuard
from .visit_manager import VisitManager
from .clue_linker import ClueLinker
from .report_exporter import ReportExporter
from .batch_processor import BatchFileProcessor


class PrivateFundService:
    """
    私募销售认购服务 - 统一入口

    核心功能：
    1. 批量处理文件（冷静期、材料、回访三者一起锁住）
    2. 线索串联查询（认购单、材料、冷静期、回访、流水、报告）
    3. 报告导出（带取舍逻辑）
    4. 结果复查（详细错误信息）
    """

    def __init__(self, output_dir: str = "./output", report_dir: str = "./reports"):
        self.output_dir = output_dir
        self.report_dir = report_dir
        self.batch_processor = BatchFileProcessor(output_dir)
        self.cool_off_machine = CoolOffStateMachine()
        self.material_validator = MaterialValidator()
        self.duplicate_guard = DuplicateSubscriptionGuard()
        self.visit_manager = VisitManager()
        self.clue_linker = ClueLinker()
        self.report_exporter = ReportExporter()

    def process_subscription_file(self, file_path: str, operator: str = "system") -> Dict[str, Any]:
        """
        处理认购文件 - 主入口
        批量处理，正常数据和脏数据分开，结果便于复查
        """
        result = self.batch_processor.process_file(file_path, operator)
        if "error" not in result:
            print(self.batch_processor.get_review_summary(result))
        return result

    def lock_subscription(self, order: SubscriptionOrder, operator: str = "") -> Tuple[bool, List[str]]:
        """锁住单个认购单 - 确保冷静期、材料、回访三者一起锁住"""
        return self.cool_off_machine.lock_together(order, operator)

    def check_materials(self, order: SubscriptionOrder) -> Dict[str, Any]:
        """校验材料 - 含过期校验、完整性校验，输出详细结果"""
        return self.material_validator.get_material_summary(order)

    def check_duplicate(self, new_order: SubscriptionOrder,
                        existing_orders: List[SubscriptionOrder]) -> Tuple[bool, List[str], List[SubscriptionOrder]]:
        """检查重复认购"""
        return self.duplicate_guard.check_duplicate(new_order, existing_orders)

    def find_clues(self, orders: List[SubscriptionOrder],
                   keyword: str = "", value: str = "") -> List[Dict[str, Any]]:
        """
        线索串联查询
        支持关键词：认购单、投资者材料、冷静期、回访录音、打款流水、确认报告
        """
        if keyword and value:
            return self.clue_linker.link_by_keyword(orders, keyword, value)
        return self.clue_linker.link_batch(orders)

    def find_by_investor(self, orders: List[SubscriptionOrder],
                         investor_id: str) -> Dict[str, Any]:
        """按投资者串联所有线索"""
        return self.clue_linker.get_investor_clues(orders, investor_id)

    def export_report(self, order: SubscriptionOrder, operator: str,
                      all_orders: Optional[List[SubscriptionOrder]] = None,
                      **options) -> Tuple[Optional[Any], List[str]]:
        """导出确认报告 - 带取舍逻辑，校验不通过的不导出，重复认购不导出"""
        return self.report_exporter.generate_report(order, operator, self.report_dir,
                                                     all_orders=all_orders, **options)

    def batch_export_reports(self, orders: List[SubscriptionOrder],
                             operator: str, **options) -> Dict[str, Any]:
        """批量导出报告"""
        return self.report_exporter.batch_export(orders, operator, self.report_dir, **options)

    def get_cool_off_summary(self, order: SubscriptionOrder) -> Dict[str, Any]:
        """获取冷静期完整信息，用于复查"""
        return self.cool_off_machine.get_cool_off_summary(order)

    def get_visit_summary(self, order: SubscriptionOrder) -> Dict[str, Any]:
        """获取回访完整信息"""
        return self.visit_manager.get_visit_summary(order)

    def run_pressure_tests(self, orders: List[SubscriptionOrder]) -> Dict[str, Any]:
        """
        运行压力测试：冷静期未满、材料过期、同投资者重复认购
        返回详细测试结果，不显示笼统错误
        """
        test_results = {
            "测试时间": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "测试订单数": len(orders),
            "冷静期未满测试": [],
            "材料过期测试": [],
            "重复认购测试": [],
            "总结": {},
        }

        for order in orders:
            if order.cool_off:
                status = order.cool_off.check_status()
                if status.value == "冷静期未满":
                    remaining = order.cool_off.remaining_hours()
                    test_results["冷静期未满测试"].append({
                        "order_no": order.order_no,
                        "investor_name": order.investor_name,
                        "remaining_hours": round(remaining, 2),
                        "end_time": order.cool_off.end_time.strftime('%Y-%m-%d %H:%M:%S') if order.cool_off.end_time else "",
                        "detail": f"还剩{remaining:.2f}小时，结束于{order.cool_off.end_time.strftime('%Y-%m-%d %H:%M:%S')}" if order.cool_off.end_time else "结束时间未知",
                    })

            is_valid, errors, warnings = self.material_validator.validate_order_materials(order)
            if not is_valid:
                test_results["材料过期测试"].append({
                    "order_no": order.order_no,
                    "investor_name": order.investor_name,
                    "errors": errors,
                    "warnings": warnings,
                })

        dup_result = self.duplicate_guard.batch_check(orders)
        test_results["重复认购测试"] = dup_result["duplicate_groups"]

        test_results["总结"] = {
            "冷静期未满足": len(test_results["冷静期未满测试"]),
            "材料有问题": len(test_results["材料过期测试"]),
            "重复认购组数": len(test_results["重复认购测试"]),
        }

        return test_results
