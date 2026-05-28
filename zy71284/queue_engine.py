from typing import List, Tuple, Dict
from datetime import datetime
from collections import defaultdict

from models import (
    Application, ApplicationType, ApplicationStatus,
    CustomerLevel, FundPool, ConfirmationRule, RejectReason,
    SimulationResult
)


class RedemptionQueueEngine:
    def __init__(self, fund_pool: FundPool, rule: ConfirmationRule):
        self.fund_pool = fund_pool
        self.rule = rule
        self.queue_by_level: Dict[CustomerLevel, List[Application]] = defaultdict(list)
        self.processed_applications: List[Application] = []

    def add_application(self, app: Application) -> None:
        if app.app_type != ApplicationType.REDEEM:
            raise ValueError(f"Only REDEEM applications supported, got {app.app_type}")
        self.queue_by_level[app.customer_level].append(app)

    def sort_queue(self) -> List[Application]:
        all_apps = []
        for level, priority in sorted(self.rule.level_priority.items(), key=lambda x: x[1]):
            apps = self.queue_by_level.get(level, [])
            if self.rule.fifo_enabled:
                apps.sort(key=lambda a: a.app_time)
            all_apps.extend(apps)
        return all_apps

    def calculate_total_request(self, applications: List[Application]) -> float:
        return sum(app.amount for app in applications)

    def process_mass_redemption(self, sorted_apps: List[Application], 
                                  total_request: float,
                                  result: SimulationResult) -> List[Application]:
        is_mass = self.fund_pool.is_mass_redemption(total_request)
        result.add_warning(
            "mass_redemption_check",
            f"巨额赎回检测: 总申请={total_request:.2f}, 阈值={self.fund_pool.total_asset * self.fund_pool.mass_redemption_ratio:.2f}, 触发={is_mass}"
        )

        if not is_mass or not self.rule.mass_redemption_enabled:
            return sorted_apps

        available_cash = self.fund_pool.available_cash
        daily_limit = self.fund_pool.daily_redeem_limit
        total_available = min(available_cash, daily_limit)

        result.add_warning(
            "mass_redemption_allocation",
            f"触发巨额赎回比例确认: 可用资金={total_available:.2f}, 总申请={total_request:.2f}, 理论比例={total_available/total_request*100:.2f}%"
        )

        base_ratio = total_available / total_request if total_request > 0 else 0
        base_ratio = max(self.rule.min_confirm_ratio, min(self.rule.max_confirm_ratio, base_ratio))

        level_bonus_ratio = {
            CustomerLevel.INSTITUTION: 0.15,
            CustomerLevel.SVIP: 0.10,
            CustomerLevel.VIP: 0.05,
            CustomerLevel.NORMAL: 0.0
        }

        remaining = total_available
        processed = []

        for idx, app in enumerate(sorted_apps):
            app.queue_position = idx + 1
            
            level_bonus = level_bonus_ratio.get(app.customer_level, 0)
            actual_ratio = min(base_ratio + level_bonus, 1.0)
            confirm_amount = app.amount * actual_ratio

            if remaining >= confirm_amount:
                app.confirmed_amount = confirm_amount
                app.confirm_ratio = actual_ratio
                app.status = ApplicationStatus.PARTIAL_CONFIRMED if actual_ratio < 1.0 else ApplicationStatus.CONFIRMED
                app.add_explanation(
                    f"巨额赎回按比例确认: 基础比例={base_ratio*100:.2f}%, "
                    f"{app.customer_level.value}等级加成={level_bonus*100:.2f}%, "
                    f"实际比例={actual_ratio*100:.2f}%, 确认金额={confirm_amount:.2f}"
                )
                remaining -= confirm_amount
            else:
                app.confirmed_amount = remaining
                app.confirm_ratio = remaining / app.amount if app.amount > 0 else 0
                app.status = ApplicationStatus.PARTIAL_CONFIRMED
                app.add_explanation(f"剩余资金不足，仅确认{remaining:.2f}，确认比例{app.confirm_ratio*100:.2f}%")
                remaining = 0

            if app.confirm_ratio < 1.0:
                app.add_explanation(f"未确认部分{app.amount - app.confirmed_amount:.2f}将顺延至下一交易日或退回")
            
            processed.append(app)

        return processed

    def process_normal_redemption(self, sorted_apps: List[Application],
                                   result: SimulationResult) -> List[Application]:
        remaining_limit = self.fund_pool.get_remaining_redeem_limit()
        available_cash = self.fund_pool.available_cash
        total_available = min(remaining_limit, available_cash)

        processed = []
        for idx, app in enumerate(sorted_apps):
            app.queue_position = idx + 1
            
            if total_available >= app.amount:
                app.confirmed_amount = app.amount
                app.confirm_ratio = 1.0
                app.status = ApplicationStatus.CONFIRMED
                app.add_explanation(f"正常确认: 全额确认{app.amount:.2f}")
                total_available -= app.amount
            elif total_available > 0:
                app.confirmed_amount = total_available
                app.confirm_ratio = total_available / app.amount
                app.status = ApplicationStatus.PARTIAL_CONFIRMED
                app.add_explanation(
                    f"部分确认: 剩余额度{total_available:.2f}, "
                    f"确认比例{app.confirm_ratio*100:.2f}%, "
                    f"未确认{app.amount - total_available:.2f}"
                )
                total_available = 0
            else:
                app.status = ApplicationStatus.REJECTED
                app.reject_reason = RejectReason.INSUFFICIENT_FUND
                app.add_explanation("拒绝: 当日赎回额度已用尽")

            processed.append(app)

        return processed

    def process(self, result: SimulationResult) -> List[Application]:
        sorted_apps = self.sort_queue()
        total_request = self.calculate_total_request(sorted_apps)

        if self.fund_pool.is_mass_redemption(total_request) and self.rule.mass_redemption_enabled:
            result.add_warning(
                "processing_mode",
                f"使用巨额赎回模式处理 {len(sorted_apps)} 笔申请",
                {"total_request": total_request, "fund_asset": self.fund_pool.total_asset}
            )
            return self.process_mass_redemption(sorted_apps, total_request, result)
        else:
            result.add_warning(
                "processing_mode",
                f"使用普通赎回模式处理 {len(sorted_apps)} 笔申请",
                {"total_request": total_request}
            )
            return self.process_normal_redemption(sorted_apps, result)


class SubscribeEngine:
    def __init__(self, fund_pool: FundPool, rule: ConfirmationRule):
        self.fund_pool = fund_pool
        self.rule = rule
        self.applications: List[Application] = []

    def add_application(self, app: Application) -> None:
        if app.app_type != ApplicationType.SUBSCRIBE:
            raise ValueError(f"Only SUBSCRIBE applications supported, got {app.app_type}")
        self.applications.append(app)

    def process(self, nav: float, result: SimulationResult) -> List[Application]:
        processed = []
        for idx, app in enumerate(self.applications):
            try:
                shares = app.amount / nav if nav > 0 else 0
                app.confirmed_amount = app.amount
                app.confirmed_shares = shares
                app.confirm_ratio = 1.0
                app.status = ApplicationStatus.CONFIRMED
                app.queue_position = idx + 1
                app.add_explanation(f"申购确认: 金额={app.amount:.2f}, 净值={nav:.4f}, 份额={shares:.2f}")
                processed.append(app)
            except Exception as e:
                app.status = ApplicationStatus.REJECTED
                app.reject_reason = RejectReason.SYSTEM_ERROR
                app.add_explanation(f"申购处理失败: {str(e)}")
                result.add_exception("subscribe_process", str(e), {"app_id": app.app_id})
                processed.append(app)

        return processed
