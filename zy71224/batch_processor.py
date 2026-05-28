import logging
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from config import Config
from data_loader import DataLoader
from models import (
    SurrenderProcess, SurrenderStatus, SurrenderReview, RefundRecord,
    Policy, SignRecord, VisitRecord, FeeRecord, SurrenderApplication,
    RefundStatus
)
from calculator import CoolingOffCalculator, RefundCalculator, IdempotencyChecker
from exception_detector import ExceptionDetector, ExceptionLevel
from report_exporter import ReportExporter


logger = logging.getLogger(__name__)


class BatchProcessor:
    def __init__(self, config: Config):
        self.config = config
        self.data_loader = DataLoader(config)
        self.cooling_off_calc = CoolingOffCalculator(
            cooling_off_days=config.surrender.get("cooling_off_days", 15)
        )
        self.refund_calc = RefundCalculator(
            initial_fee_rate=config.surrender.get("fee_deduction_rates", {}).get("initial_fee", 0.10),
            management_fee_rate=config.surrender.get("fee_deduction_rates", {}).get("management_fee", 0.05)
        )
        self.idempotency_checker = IdempotencyChecker()
        self.exception_detector = ExceptionDetector()
        self.report_exporter = ReportExporter(config)
        
        self.processes: Dict[str, SurrenderProcess] = {}
        self.all_exceptions = []

    def run_batch(self) -> Dict:
        logger.info("=" * 60)
        logger.info("开始执行保险犹豫期退保批处理")
        logger.info("=" * 60)
        
        start_time = datetime.now()
        
        data = self.data_loader.load_all_data()
        
        self._build_processes(data)
        
        self._process_all()
        
        self._detect_exceptions()
        
        report_path = self._generate_reports()
        
        duration = (datetime.now() - start_time).total_seconds()
        
        summary = self._generate_summary(duration, report_path)
        
        self._print_summary(summary)
        
        return summary

    def _build_processes(self, data: Dict):
        logger.info("构建处理流程...")
        
        policies = {p.policy_no: p for p in data["policies"]}
        sign_records = defaultdict(list)
        for r in data["sign_records"]:
            sign_records[r.policy_no].append(r)
        
        visit_records = defaultdict(list)
        for r in data["visit_records"]:
            visit_records[r.policy_no].append(r)
        
        fee_records = defaultdict(list)
        for r in data["fee_records"]:
            fee_records[r.policy_no].append(r)
        
        surrender_apps = defaultdict(list)
        for app in data["surrender_apps"]:
            surrender_apps[app.policy_no].append(app)
        
        for policy_no, apps in surrender_apps.items():
            if len(apps) == 0:
                continue
            
            latest_app = max(apps, key=lambda x: x.apply_date)
            
            process = SurrenderProcess(
                policy_no=policy_no,
                apply_no=latest_app.apply_no,
                policy=policies.get(policy_no),
                sign_record=sign_records[policy_no][0] if sign_records[policy_no] else None,
                visit_records=visit_records[policy_no],
                fee_records=fee_records[policy_no],
                application=latest_app,
                reviews=[],
                refund=None,
                exceptions=[],
                all_sign_records=sign_records[policy_no],
                all_applications=apps,
                status=SurrenderStatus.PENDING
            )
            
            self.processes[f"{policy_no}_{latest_app.apply_no}"] = process
        
        logger.info(f"共构建 {len(self.processes)} 个退保处理流程")

    def _process_all(self):
        logger.info("开始处理所有退保申请...")
        
        success_count = 0
        fail_count = 0
        
        for key, process in self.processes.items():
            try:
                self._process_single(process)
                success_count += 1
            except Exception as e:
                logger.error(f"处理失败 {key}: {e}")
                process.status = SurrenderStatus.EXCEPTION
                process.process_notes = f"处理异常: {str(e)}"
                fail_count += 1
        
        logger.info(f"处理完成: 成功{success_count}个, 失败{fail_count}个")

    def _process_single(self, process: SurrenderProcess):
        is_duplicate, existing_version = self.idempotency_checker.check_duplicate_application(
            process.apply_no, process.policy_no
        )
        if is_duplicate:
            logger.warning(f"重复申请: {process.policy_no} - {process.apply_no}, 已处理版本: {existing_version}")
            process.status = SurrenderStatus.REVIEWING
            process.process_notes = f"检测到重复申请，上一版本为{existing_version}，请人工确认"
            return
        
        self.idempotency_checker.register_application(
            process.apply_no, process.policy_no
        )
        
        if process.sign_record and process.application:
            cooling_off_info = self.cooling_off_calc.get_cooling_off_status(
                process.sign_record.sign_date,
                process.application.apply_date
            )
            process.is_within_cooling_off = cooling_off_info["is_within_cooling_off"]
            process.cooling_off_days_used = cooling_off_info["days_used"]
        
        total_fees = sum(r.fee_amount for r in process.fee_records)
        if total_fees > 0 and process.is_within_cooling_off is not None:
            refund_info = self.refund_calc.calculate_refund(
                total_fees_paid=total_fees,
                is_within_cooling_off=process.is_within_cooling_off,
                days_used=process.cooling_off_days_used or 0,
                cooling_off_days=self.config.surrender.get("cooling_off_days", 15)
            )
            
            process.refund = RefundRecord(
                policy_no=process.policy_no,
                apply_no=process.apply_no,
                refund_no=f"RF{process.apply_no}",
                refund_date=date.today(),
                refund_amount=refund_info["refund_amount"],
                deduction_amount=refund_info["deduction_amount"],
                deduction_detail=refund_info["deduction_detail"],
                refund_channel="原路返回",
                refund_status=RefundStatus.PENDING
            )
        
        if process.is_within_cooling_off:
            process.status = SurrenderStatus.APPROVED
        elif process.is_within_cooling_off is False:
            process.status = SurrenderStatus.REVIEWING
            process.process_notes = "犹豫期已过，需人工审核确认"
        else:
            process.status = SurrenderStatus.REVIEWING
            process.process_notes = "数据不完整，需人工审核"

    def _detect_exceptions(self):
        logger.info("开始异常检测...")
        self.exception_detector.reset()
        
        for process in self.processes.values():
            exceptions = self.exception_detector.detect_all(process)
            process.exceptions = exceptions
            self.all_exceptions.extend(exceptions)
            
            if exceptions:
                critical_exceptions = [e for e in exceptions if e.exception_level == ExceptionLevel.CRITICAL]
                if critical_exceptions:
                    process.status = SurrenderStatus.EXCEPTION
                elif process.status == SurrenderStatus.PENDING:
                    process.status = SurrenderStatus.DISPUTE
        
        exception_summary = self.exception_detector.get_exception_summary()
        logger.info(f"异常检测完成: 共发现{exception_summary['total_exceptions']}个异常, "
                   f"严重{exception_summary['by_level'].get('严重', 0)}个, "
                   f"高{exception_summary['by_level'].get('高', 0)}个")

    def _generate_reports(self) -> str:
        logger.info("生成处理报告...")
        
        report_path = self.report_exporter.export_all(
            processes=list(self.processes.values()),
            exceptions=self.all_exceptions,
            version_info=self.data_loader.get_version_info()
        )
        
        return report_path

    def _generate_summary(self, duration: float, report_path: str) -> Dict:
        status_counts = defaultdict(int)
        for process in self.processes.values():
            status_counts[process.status.value] += 1
        
        exception_summary = self.exception_detector.get_exception_summary()
        
        total_fees = 0
        total_refund = 0
        for process in self.processes.values():
            total_fees += sum(r.fee_amount for r in process.fee_records)
            if process.refund:
                total_refund += process.refund.refund_amount
        
        return {
            "batch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "duration_seconds": round(duration, 2),
            "total_applications": len(self.processes),
            "status_distribution": dict(status_counts),
            "exception_summary": exception_summary,
            "financial_summary": {
                "total_fees_collected": round(total_fees, 2),
                "total_refund_amount": round(total_refund, 2),
                "avg_refund_rate": round(total_refund / total_fees * 100, 2) if total_fees > 0 else 0
            },
            "report_path": report_path,
            "critical_exceptions": [
                {
                    "policy_no": e.policy_no,
                    "apply_no": e.apply_no,
                    "exception_type": e.exception_type,
                    "exception_desc": e.exception_desc,
                    "suggested_action": e.suggested_action
                }
                for e in self.all_exceptions
                if e.exception_level == ExceptionLevel.CRITICAL and not e.is_resolved
            ]
        }

    def _print_summary(self, summary: Dict):
        print("\n" + "=" * 60)
        print("保险犹豫期退保批处理执行报告")
        print("=" * 60)
        print(f"执行时间: {summary['batch_time']}")
        print(f"耗时: {summary['duration_seconds']}秒")
        print(f"处理申请数: {summary['total_applications']}")
        print("\n状态分布:")
        for status, count in summary['status_distribution'].items():
            print(f"  - {status}: {count}")
        
        print("\n异常统计:")
        print(f"  总异常数: {summary['exception_summary']['total_exceptions']}")
        for level, count in summary['exception_summary']['by_level'].items():
            print(f"  - {level}: {count}")
        
        print("\n财务汇总:")
        print(f"  已扣费总额: {summary['financial_summary']['total_fees_collected']}元")
        print(f"  应退费总额: {summary['financial_summary']['total_refund_amount']}元")
        print(f"  平均退费比例: {summary['financial_summary']['avg_refund_rate']}%")
        
        critical = summary['critical_exceptions']
        if critical:
            print(f"\n\033[91m【重要提醒】发现{len(critical)}个严重异常，需优先处理：\033[0m")
            for i, exc in enumerate(critical, 1):
                print(f"\n  {i}. 保单号: {exc['policy_no']}")
                print(f"     异常类型: {exc['exception_type']}")
                print(f"     问题描述: {exc['exception_desc']}")
                print(f"     \033[93m建议操作: {exc['suggested_action']}\033[0m")
        
        print(f"\n详细报告已导出至: {summary['report_path']}")
        print("=" * 60 + "\n")
