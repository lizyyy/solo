import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from copy import deepcopy

from models import (
    Application, ApplicationType, ApplicationStatus,
    CustomerLevel, FundPool, ConfirmationRule,
    SimulationResult, TradingCalendar, RejectReason
)
from queue_engine import RedemptionQueueEngine, SubscribeEngine
from calendar_utils import CalendarManager
from report_exporter import ReportExporter


class FundRedemptionSimulator:
    def __init__(self, fund_pool: FundPool, rule: ConfirmationRule, calendar: TradingCalendar):
        self.fund_pool = fund_pool
        self.rule = rule
        self.calendar = calendar
        self.calendar_manager = CalendarManager()
        self.report_exporter = ReportExporter()
        self.result: Optional[SimulationResult] = None

    def create_application(
        self,
        customer_id: str,
        customer_name: str,
        customer_level: CustomerLevel,
        app_type: ApplicationType,
        amount: float,
        app_time: datetime,
        shares: float = None
    ) -> Application:
        trading_day = app_time.date()
        
        return Application(
            app_id=f"APP{uuid.uuid4().hex[:8].upper()}",
            customer_id=customer_id,
            customer_name=customer_name,
            customer_level=customer_level,
            app_type=app_type,
            amount=amount,
            shares=shares,
            app_time=app_time,
            trading_day=trading_day
        )

    def validate_date(self, app_date: date) -> tuple[bool, str, date]:
        is_valid, message = self.calendar_manager.validate_application_date(app_date, self.calendar)
        adjusted_date = app_date if is_valid else self.calendar.get_next_trading_day(app_date)
        return is_valid, message, adjusted_date

    def run_simulation(self, simulation_name: str, applications: List[Application], nav: float = 1.0) -> SimulationResult:
        self.result = SimulationResult(
            simulation_id=uuid.uuid4().hex[:8],
            simulation_name=simulation_name,
            start_time=datetime.now(),
            total_applications=len(applications)
        )

        fund_pool_dict = deepcopy(self.fund_pool.__dict__)
        fund_pool_dict["last_update"] = fund_pool_dict["last_update"].isoformat()
        self.result.fund_pool_snapshots.append({
            "timestamp": datetime.now().isoformat(),
            "fund_pool": fund_pool_dict
        })

        redeem_apps = [app for app in applications if app.app_type == ApplicationType.REDEEM]
        subscribe_apps = [app for app in applications if app.app_type == ApplicationType.SUBSCRIBE]

        for app in redeem_apps:
            is_valid, date_msg, adj_date = self.validate_date(app.trading_day)
            if not is_valid:
                app.add_explanation(date_msg)
                app.trading_day = adj_date
                self.result.add_warning("date_validation", date_msg, {"app_id": app.app_id, "original_date": str(app.trading_day)})

        if redeem_apps:
            redemption_engine = RedemptionQueueEngine(self.fund_pool, self.rule)
            for app in redeem_apps:
                redemption_engine.add_application(app)
            
            try:
                processed_redeem = redemption_engine.process(self.result)
                self.result.applications.extend(processed_redeem)
            except Exception as e:
                self.result.add_exception("redemption_process", str(e), {"step": "redemption_engine"})

        if subscribe_apps:
            subscribe_engine = SubscribeEngine(self.fund_pool, self.rule)
            for app in subscribe_apps:
                subscribe_engine.add_application(app)
            
            try:
                processed_sub = subscribe_engine.process(nav, self.result)
                self.result.applications.extend(processed_sub)
            except Exception as e:
                self.result.add_exception("subscribe_process", str(e), {"step": "subscribe_engine"})

        self._update_statistics()
        self.result.end_time = datetime.now()

        return self.result

    def _update_statistics(self):
        if not self.result:
            return
        
        self.result.confirmed_count = sum(
            1 for app in self.result.applications 
            if app.status == ApplicationStatus.CONFIRMED
        )
        self.result.partial_confirmed_count = sum(
            1 for app in self.result.applications 
            if app.status == ApplicationStatus.PARTIAL_CONFIRMED
        )
        self.result.rejected_count = sum(
            1 for app in self.result.applications 
            if app.status == ApplicationStatus.REJECTED
        )
        self.result.queued_count = sum(
            1 for app in self.result.applications 
            if app.status == ApplicationStatus.QUEUED
        )

    def export_reports(self, result: SimulationResult = None) -> Dict[str, str]:
        target = result or self.result
        if not target:
            raise ValueError("No simulation result to export")

        return {
            "json": self.report_exporter.export_to_json(target),
            "csv": self.report_exporter.export_to_csv(target),
            "markdown": self.report_exporter.export_explanation_report(target)
        }


class ScenarioSimulator:
    def __init__(self):
        self.calendar_manager = CalendarManager()

    def create_mass_redemption_scenario(self) -> Dict[str, Any]:
        fund_pool = FundPool(
            fund_id="F001",
            fund_name="稳健成长混合",
            total_shares=10_000_000,
            available_cash=15_000_000,
            total_asset=100_000_000,
            daily_redeem_limit=20_000_000,
            mass_redemption_ratio=0.10
        )

        rule = ConfirmationRule(
            rule_id="R001",
            rule_name="标准巨额赎回规则"
        )

        calendar = self.calendar_manager.get_calendar(2026)

        simulator = FundRedemptionSimulator(fund_pool, rule, calendar)

        applications = []
        now = datetime(2026, 5, 29, 9, 30, 0)

        applications.append(simulator.create_application(
            "C001", "机构客户A", CustomerLevel.INSTITUTION,
            ApplicationType.REDEEM, 5_000_000.0,
            now
        ))

        applications.append(simulator.create_application(
            "C002", "高净值客户B", CustomerLevel.SVIP,
            ApplicationType.REDEEM, 800_000.0,
            now + timedelta(minutes=5)
        ))

        applications.append(simulator.create_application(
            "C003", "VIP客户C", CustomerLevel.VIP,
            ApplicationType.REDEEM, 500_000.0,
            now + timedelta(minutes=10)
        ))

        for i in range(1, 11):
            applications.append(simulator.create_application(
                f"C{100+i}", f"普通客户{i}", CustomerLevel.NORMAL,
                ApplicationType.REDEEM, 100_000.0,
                now + timedelta(minutes=15 + i)
            ))

        return {
            "simulator": simulator,
            "applications": applications,
            "description": "巨额赎回场景：总申请1500万，触发10%巨额赎回阈值"
        }

    def create_holiday_missing_scenario(self) -> Dict[str, Any]:
        fund_pool = FundPool(
            fund_id="F002",
            fund_name="节假日测试基金",
            total_shares=1_000_000,
            available_cash=5_000_000,
            total_asset=50_000_000,
            daily_redeem_limit=10_000_000,
            mass_redemption_ratio=0.10
        )

        rule = ConfirmationRule(
            rule_id="R002",
            rule_name="节假日测试规则"
        )

        correct_calendar = self.calendar_manager.get_calendar(2026)
        
        wrong_calendar = TradingCalendar(
            calendar_id="CN_2026_WRONG",
            year=2026,
            holidays=set(),
            special_trading_days=set()
        )

        simulator = FundRedemptionSimulator(fund_pool, rule, correct_calendar)
        
        applications = []

        test_date = datetime(2026, 5, 1, 10, 0, 0)
        
        for i in range(1, 6):
            applications.append(simulator.create_application(
                f"H{100+i}", f"节假日测试客户{i}", CustomerLevel.NORMAL,
                ApplicationType.REDEEM, 200_000.0,
                test_date + timedelta(days=i-1)
            ))

        return {
            "simulator": simulator,
            "applications": applications,
            "correct_calendar": correct_calendar,
            "wrong_calendar": wrong_calendar,
            "description": "节假日漏算场景：5月1日-5日是劳动节假期，错误日历未包含这些节假日"
        }

    def create_ratio_calculation_error_scenario(self) -> Dict[str, Any]:
        fund_pool = FundPool(
            fund_id="F003",
            fund_name="比例确认测试基金",
            total_shares=5_000_000,
            available_cash=8_000_000,
            total_asset=80_000_000,
            daily_redeem_limit=15_000_000,
            mass_redemption_ratio=0.10
        )

        correct_rule = ConfirmationRule(
            rule_id="R003",
            rule_name="正确比例规则"
        )

        wrong_rule = ConfirmationRule(
            rule_id="R003_WRONG",
            rule_name="错误比例规则",
            min_confirm_ratio=0.5,
            max_confirm_ratio=0.5
        )

        calendar = self.calendar_manager.get_calendar(2026)

        simulator = FundRedemptionSimulator(fund_pool, correct_rule, calendar)

        applications = []
        now = datetime(2026, 6, 1, 9, 0, 0)

        applications.append(simulator.create_application(
            "R001", "比例测试机构", CustomerLevel.INSTITUTION,
            ApplicationType.REDEEM, 4_000_000.0,
            now
        ))

        applications.append(simulator.create_application(
            "R002", "比例测试SVIP", CustomerLevel.SVIP,
            ApplicationType.REDEEM, 2_000_000.0,
            now + timedelta(minutes=10)
        ))

        applications.append(simulator.create_application(
            "R003", "比例测试VIP", CustomerLevel.VIP,
            ApplicationType.REDEEM, 1_000_000.0,
            now + timedelta(minutes=20)
        ))

        applications.append(simulator.create_application(
            "R004", "比例测试普通", CustomerLevel.NORMAL,
            ApplicationType.REDEEM, 1_000_000.0,
            now + timedelta(minutes=30)
        ))

        return {
            "simulator": simulator,
            "applications": applications,
            "correct_rule": correct_rule,
            "wrong_rule": wrong_rule,
            "description": "比例确认错误场景：演示正确比例 vs 错误固定50%比例"
        }

    def create_customer_level_abuse_scenario(self) -> Dict[str, Any]:
        fund_pool = FundPool(
            fund_id="F004",
            fund_name="客户等级测试基金",
            total_shares=2_000_000,
            available_cash=3_000_000,
            total_asset=30_000_000,
            daily_redeem_limit=5_000_000,
            mass_redemption_ratio=0.10
        )

        correct_rule = ConfirmationRule(
            rule_id="R004",
            rule_name="正确等级规则",
            level_priority={
                CustomerLevel.INSTITUTION: 1,
                CustomerLevel.SVIP: 2,
                CustomerLevel.VIP: 3,
                CustomerLevel.NORMAL: 4
            }
        )

        wrong_rule = ConfirmationRule(
            rule_id="R004_WRONG",
            rule_name="越权等级规则",
            level_priority={
                CustomerLevel.INSTITUTION: 4,
                CustomerLevel.SVIP: 3,
                CustomerLevel.VIP: 2,
                CustomerLevel.NORMAL: 1
            }
        )

        calendar = self.calendar_manager.get_calendar(2026)

        simulator = FundRedemptionSimulator(fund_pool, correct_rule, calendar)

        applications = []
        now = datetime(2026, 6, 15, 9, 0, 0)

        applications.append(simulator.create_application(
            "L004", "普通客户晚提交", CustomerLevel.NORMAL,
            ApplicationType.REDEEM, 500_000.0,
            now
        ))

        applications.append(simulator.create_application(
            "L003", "VIP客户晚提交", CustomerLevel.VIP,
            ApplicationType.REDEEM, 500_000.0,
            now + timedelta(minutes=5)
        ))

        applications.append(simulator.create_application(
            "L002", "SVIP客户晚提交", CustomerLevel.SVIP,
            ApplicationType.REDEEM, 500_000.0,
            now + timedelta(minutes=10)
        ))

        applications.append(simulator.create_application(
            "L001", "机构客户早提交", CustomerLevel.INSTITUTION,
            ApplicationType.REDEEM, 500_000.0,
            now + timedelta(minutes=15)
        ))

        return {
            "simulator": simulator,
            "applications": applications,
            "correct_rule": correct_rule,
            "wrong_rule": wrong_rule,
            "description": "客户等级越权场景：普通客户先提交 vs 正确优先级对比"
        }

    def run_scenario_comparison(self, scenario_creator, scenario_name: str) -> Dict[str, Any]:
        scenario = scenario_creator()
        simulator = scenario["simulator"]

        result1 = simulator.run_simulation(f"{scenario_name}_正确配置", scenario["applications"])
        reports1 = simulator.export_reports(result1)

        if "wrong_calendar" in scenario:
            wrong_simulator = FundRedemptionSimulator(
                simulator.fund_pool, simulator.rule, scenario["wrong_calendar"]
            )
            result2 = wrong_simulator.run_simulation(f"{scenario_name}_错误配置", scenario["applications"])
            reports2 = wrong_simulator.export_reports(result2)
            
            return {
                "scenario_description": scenario["description"],
                "correct_result": result1,
                "correct_reports": reports1,
                "wrong_result": result2,
                "wrong_reports": reports2,
                "comparison": self._compare_results(result1, result2)
            }

        if "wrong_rule" in scenario:
            wrong_simulator = FundRedemptionSimulator(
                simulator.fund_pool, scenario["wrong_rule"], simulator.calendar
            )
            result2 = wrong_simulator.run_simulation(f"{scenario_name}_错误配置", scenario["applications"])
            reports2 = wrong_simulator.export_reports(result2)
            
            return {
                "scenario_description": scenario["description"],
                "correct_result": result1,
                "correct_reports": reports1,
                "wrong_result": result2,
                "wrong_reports": reports2,
                "comparison": self._compare_results(result1, result2)
            }

        return {
            "scenario_description": scenario["description"],
            "result": result1,
            "reports": reports1
        }

    def _compare_results(self, result1: SimulationResult, result2: SimulationResult) -> Dict[str, Any]:
        differences = []
        
        for app1, app2 in zip(result1.applications, result2.applications):
            if app1.customer_name == app2.customer_name:
                if app1.confirm_ratio != app2.confirm_ratio:
                    differences.append({
                        "customer": app1.customer_name,
                        "correct_ratio": f"{app1.confirm_ratio*100:.2f}%",
                        "wrong_ratio": f"{app2.confirm_ratio*100:.2f}%",
                        "correct_queue": app1.queue_position,
                        "wrong_queue": app2.queue_position,
                        "correct_explanation": app1.explanation,
                        "wrong_explanation": app2.explanation
                    })

        return {
            "total_differences": len(differences),
            "details": differences,
            "replay_steps": [
                "1. 对比每笔申请的确认比例差异",
                "2. 检查队列排序差异",
                "3. 分析解释说明差异",
                "4. 总结异常原因并修正配置"
            ]
        }
