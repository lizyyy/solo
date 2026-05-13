"""API 访问密钥风控 CLI"""

import argparse
import sys
from datetime import datetime, timedelta
from typing import List
import uuid

from .data_loader import DataStore
from .risk_engine import RiskRuleEngine
from .limit_suggester import LimitSuggester
from .report_generator import ReportGenerator
from .models import SafetyMark, RiskLevel


class RiskCLI:
    """API 访问密钥风控 CLI"""

    def __init__(self, data_dir: str = "./data"):
        self.data_store = DataStore(data_dir)
        self.data_store.load_all()
        self.risk_engine = RiskRuleEngine()
        self.limit_suggester = LimitSuggester()
        self.report_generator = ReportGenerator()

    def cmd_analyze(self, args):
        if args.key_id:
            self._analyze_key(args.key_id, args.detailed)
        elif args.customer_id:
            self._analyze_customer(args.customer_id, args.detailed)
        else:
            self._analyze_all(args.detailed)

    def _analyze_key(self, key_id: str, detailed: bool):
        api_key = self.data_store.get_api_key(key_id)
        if not api_key:
            print(f"错误: 未找到密钥 {key_id}")
            return

        customer = self.data_store.get_customer(api_key.customer_id)
        if not customer:
            print(f"错误: 未找到客户 {api_key.customer_id}")
            return

        logs = self.data_store.get_access_logs(key_id=key_id)
        baseline = self.data_store.get_region_baseline(
            api_key.customer_id, api_key.key_id
        )
        safety_marks = self.data_store.get_safety_marks(key_id=key_id)

        assessment = self.risk_engine.analyze(
            logs, customer, api_key, baseline, safety_marks
        )

        self._print_assessment(assessment, detailed)

    def _analyze_customer(self, customer_id: str, detailed: bool):
        customer = self.data_store.get_customer(customer_id)
        if not customer:
            print(f"错误: 未找到客户 {customer_id}")
            return

        api_keys = [k for k in self.data_store.get_all_api_keys().values()
                   if k.customer_id == customer_id]

        if not api_keys:
            print(f"客户 {customer.customer_name} ({customer_id}) 没有API密钥")
            return

        print(f"\n{'='*60}")
        print(f"客户分析: {customer.customer_name} ({customer_id})")
        print(f"{'='*60}\n")

        all_assessments = []
        for api_key in api_keys:
            logs = self.data_store.get_access_logs(key_id=api_key.key_id)
            baseline = self.data_store.get_region_baseline(
                customer_id, api_key.key_id
            )
            safety_marks = self.data_store.get_safety_marks(key_id=api_key.key_id)

            assessment = self.risk_engine.analyze(
                logs, customer, api_key, baseline, safety_marks
            )
            all_assessments.append(assessment)

            print(f"密钥: {api_key.key_id}")
            print(f"  风险等级: {self._format_risk_level(assessment.risk_level)}")
            print(f"  综合评分: {assessment.overall_score:.2%}")
            print(f"  风险证据数: {len(assessment.evidences)}")
            if detailed:
                self._print_evidences(assessment.evidences, indent=2)
            print()

        max_risk = max((a.risk_level for a in all_assessments),
                      key=lambda x: [RiskLevel.LOW, RiskLevel.MEDIUM,
                                   RiskLevel.HIGH, RiskLevel.CRITICAL].index(x))
        print(f"客户总体风险等级: {self._format_risk_level(max_risk)}")

    def _analyze_all(self, detailed: bool):
        customers = self.data_store.get_all_customers()
        if not customers:
            print("错误: 没有客户数据")
            return

        risk_counts = {level: 0 for level in RiskLevel}

        print(f"\n{'='*60}")
        print(f"全量分析: {len(customers)} 个客户")
        print(f"{'='*60}\n")

        for customer_id, customer in customers.items():
            api_keys = [k for k in self.data_store.get_all_api_keys().values()
                       if k.customer_id == customer_id]

            for api_key in api_keys:
                logs = self.data_store.get_access_logs(key_id=api_key.key_id)
                baseline = self.data_store.get_region_baseline(
                    customer_id, api_key.key_id
                )
                safety_marks = self.data_store.get_safety_marks(key_id=api_key.key_id)

                assessment = self.risk_engine.analyze(
                    logs, customer, api_key, baseline, safety_marks
                )

                risk_counts[assessment.risk_level] += 1

                if assessment.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                    print(f"[警报] 客户: {customer.customer_name}, 密钥: {api_key.key_id}")
                    print(f"       风险等级: {self._format_risk_level(assessment.risk_level)}")
                    print(f"       综合评分: {assessment.overall_score:.2%}")
                    if detailed:
                        self._print_evidences(assessment.evidences, indent=7)
                    print()

        print(f"\n{'='*60}")
        print("统计汇总:")
        print(f"{'='*60}")
        for level, count in risk_counts.items():
            if count > 0:
                print(f"  {self._format_risk_level(level)}: {count} 个密钥")

    def cmd_explain(self, args):
        if args.key_id:
            api_key = self.data_store.get_api_key(args.key_id)
            if not api_key:
                print(f"错误: 未找到密钥 {args.key_id}")
                return

            customer = self.data_store.get_customer(api_key.customer_id)
            if not customer:
                print(f"错误: 未找到客户 {api_key.customer_id}")
                return

            logs = self.data_store.get_access_logs(key_id=args.key_id)
            baseline = self.data_store.get_region_baseline(
                api_key.customer_id, api_key.key_id
            )
            safety_marks = self.data_store.get_safety_marks(key_id=args.key_id)

            assessment = self.risk_engine.analyze(
                logs, customer, api_key, baseline, safety_marks
            )

            print(f"\n{'='*60}")
            print(f"详细分析 - 密钥: {args.key_id}")
            print(f"{'='*60}\n")
            self._print_assessment(assessment, detailed=True)

            if safety_marks:
                print(f"\n安全标记历史:")
                for mark in safety_marks:
                    status = "有效" if mark.is_active else "已失效"
                    print(f"  - {mark.mark_time.strftime('%Y-%m-%d %H:%M')}: "
                          f"{mark.reason} [{status}]")
        else:
            print("请指定 --key-id 参数")

    def cmd_mark_safe(self, args):
        if not args.key_id:
            print("错误: 必须指定 --key-id")
            return

        api_key = self.data_store.get_api_key(args.key_id)
        if not api_key:
            print(f"错误: 未找到密钥 {args.key_id}")
            return

        expires_at = None
        if args.hours:
            expires_at = datetime.now() + timedelta(hours=args.hours)

        mark = SafetyMark(
            mark_id=str(uuid.uuid4()),
            customer_id=api_key.customer_id,
            key_id=api_key.key_id,
            marked_by=args.user or "system",
            mark_time=datetime.now(),
            reason=args.reason or "运营人员确认安全",
            expires_at=expires_at,
            is_active=True
        )

        self.data_store.add_safety_mark(mark)
        self.data_store.save_safety_marks()

        print(f"密钥 {args.key_id} 已标记为安全")
        print(f"标记人: {mark.marked_by}")
        print(f"原因: {mark.reason}")
        if expires_at:
            print(f"有效期: 至 {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print("有效期: 永久（新异常证据会重新触发警报）")

    def cmd_suggest_limit(self, args):
        if not args.key_id:
            print("错误: 必须指定 --key-id")
            return

        api_key = self.data_store.get_api_key(args.key_id)
        if not api_key:
            print(f"错误: 未找到密钥 {args.key_id}")
            return

        customer = self.data_store.get_customer(api_key.customer_id)
        if not customer:
            print(f"错误: 未找到客户 {api_key.customer_id}")
            return

        logs = self.data_store.get_access_logs(key_id=args.key_id)
        baseline = self.data_store.get_region_baseline(
            api_key.customer_id, api_key.key_id
        )
        safety_marks = self.data_store.get_safety_marks(key_id=args.key_id)

        assessment = self.risk_engine.analyze(
            logs, customer, api_key, baseline, safety_marks
        )

        suggestion = self.limit_suggester.suggest(api_key, customer, logs, assessment)

        print(f"\n{'='*60}")
        print(f"限权建议 - 密钥: {args.key_id}")
        print(f"{'='*60}\n")

        print(f"当前限制: {suggestion.current_limit} 次/小时")
        print(f"建议限制: {suggestion.suggested_limit} 次/小时")
        print(f"调整幅度: {((suggestion.suggested_limit / suggestion.current_limit) - 1) * 100:+.1f}%")
        print(f"")
        print(f"建议原因: {suggestion.reason}")
        print(f"")
        print(f"受影响接口:")
        for api in suggestion.affected_apis:
            print(f"  - {api}")
        print(f"")
        print(f"正常业务影响评估:")
        print(f"  {suggestion.normal_traffic_impact}")
        print(f"\n{'='*60}\n")

    def cmd_report(self, args):
        dimension = args.dimension

        if dimension == "customer":
            self._generate_customer_report(args)
        elif dimension == "key":
            self._generate_key_report(args)
        elif dimension == "api":
            self._generate_api_report(args)
        else:
            print(f"错误: 无效的维度 {dimension}，可选: customer, key, api")

    def _generate_customer_report(self, args):
        customer_id = args.value
        if not customer_id:
            print("错误: 必须通过 --value 指定客户ID")
            return

        customer = self.data_store.get_customer(customer_id)
        if not customer:
            print(f"错误: 未找到客户 {customer_id}")
            return

        api_keys = [k for k in self.data_store.get_all_api_keys().values()
                   if k.customer_id == customer_id]

        all_logs = self.data_store.get_access_logs(customer_id=customer_id)
        all_assessments = []

        for api_key in api_keys:
            logs = self.data_store.get_access_logs(key_id=api_key.key_id)
            baseline = self.data_store.get_region_baseline(customer_id, api_key.key_id)
            safety_marks = self.data_store.get_safety_marks(key_id=api_key.key_id)

            assessment = self.risk_engine.analyze(
                logs, customer, api_key, baseline, safety_marks
            )
            all_assessments.append(assessment)

        report = self.report_generator.generate_customer_report(
            customer, all_assessments, all_logs
        )
        print(self.report_generator.format_report_text(report, detailed=args.detailed))

    def _generate_key_report(self, args):
        key_id = args.value
        if not key_id:
            print("错误: 必须通过 --value 指定密钥ID")
            return

        api_key = self.data_store.get_api_key(key_id)
        if not api_key:
            print(f"错误: 未找到密钥 {key_id}")
            return

        customer = self.data_store.get_customer(api_key.customer_id)
        if not customer:
            print(f"错误: 未找到客户 {api_key.customer_id}")
            return

        logs = self.data_store.get_access_logs(key_id=key_id)
        baseline = self.data_store.get_region_baseline(
            api_key.customer_id, api_key.key_id
        )
        safety_marks = self.data_store.get_safety_marks(key_id=key_id)

        assessment = self.risk_engine.analyze(
            logs, customer, api_key, baseline, safety_marks
        )

        report = self.report_generator.generate_key_report(
            api_key, assessment, logs
        )
        print(self.report_generator.format_report_text(report, detailed=args.detailed))

    def _generate_api_report(self, args):
        endpoint = args.value
        if not endpoint:
            print("错误: 必须通过 --value 指定接口路径")
            return

        logs = self.data_store.get_access_logs(endpoint=endpoint)
        if not logs:
            print(f"未找到接口 {endpoint} 的调用记录")
            return

        all_assessments = []
        involved_keys = set(log.api_key for log in logs)

        for key_str in involved_keys:
            api_key = self.data_store.get_api_key_by_api_key(key_str)
            if not api_key:
                continue

            customer = self.data_store.get_customer(api_key.customer_id)
            if not customer:
                continue

            key_logs = [l for l in logs if l.api_key == key_str]
            baseline = self.data_store.get_region_baseline(
                api_key.customer_id, api_key.key_id
            )
            safety_marks = self.data_store.get_safety_marks(key_id=api_key.key_id)

            assessment = self.risk_engine.analyze(
                key_logs, customer, api_key, baseline, safety_marks
            )
            all_assessments.append(assessment)

        report = self.report_generator.generate_api_report(
            endpoint, all_assessments, logs
        )
        print(self.report_generator.format_report_text(report, detailed=args.detailed))

    def _print_assessment(self, assessment, detailed: bool):
        print(f"客户ID: {assessment.customer_id}")
        print(f"密钥ID: {assessment.key_id}")
        print(f"风险等级: {self._format_risk_level(assessment.risk_level)}")
        print(f"综合评分: {assessment.overall_score:.2%}")
        print(f"分析时间: {assessment.analysis_time.strftime('%Y-%m-%d %H:%M:%S')}")

        if assessment.evidences:
            print(f"\n风险证据 ({len(assessment.evidences)} 条):")
            self._print_evidences(assessment.evidences, indent=2)
        else:
            print(f"\n风险证据: 未发现异常")

        if assessment.recommendations:
            print(f"\n建议动作:")
            for i, rec in enumerate(assessment.recommendations, 1):
                print(f"  {i}. {rec}")

    def _print_evidences(self, evidences, indent: int = 0):
        prefix = " " * indent
        for i, evidence in enumerate(evidences, 1):
            print(f"{prefix}{i}. {evidence.description}")
            print(f"{prefix}   严重度: {evidence.severity:.2%}")
            print(f"{prefix}   风险类型: {evidence.risk_type.value}")

    def _format_risk_level(self, level: RiskLevel) -> str:
        level_map = {
            RiskLevel.LOW: "低风险",
            RiskLevel.MEDIUM: "中风险",
            RiskLevel.HIGH: "高风险",
            RiskLevel.CRITICAL: "严重风险",
        }
        return level_map.get(level, "未知")


def main():
    parser = argparse.ArgumentParser(
        description="API 访问密钥风控 CLI - 识别密钥泄露和异常访问",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  api-risk analyze --key-id KEY-001
  api-risk analyze --customer-id CUST-001
  api-risk analyze
  api-risk explain --key-id KEY-001
  api-risk mark-safe --key-id KEY-001 --user "运营A" --reason "双11活动正常流量"
  api-risk mark-safe --key-id KEY-001 --hours 24
  api-risk suggest-limit --key-id KEY-001
  api-risk report --dimension customer --value CUST-001
  api-risk report --dimension key --value KEY-001
  api-risk report --dimension api --value /api/v1/payment
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    analyze_parser = subparsers.add_parser("analyze", help="分析风险")
    analyze_parser.add_argument("--key-id", help="指定密钥ID")
    analyze_parser.add_argument("--customer-id", help="指定客户ID")
    analyze_parser.add_argument("--detailed", action="store_true", help="显示详细信息")

    explain_parser = subparsers.add_parser("explain", help="解释风险详情")
    explain_parser.add_argument("--key-id", required=True, help="密钥ID")

    mark_safe_parser = subparsers.add_parser("mark-safe", help="标记为安全（不会永久压制新异常）")
    mark_safe_parser.add_argument("--key-id", required=True, help="密钥ID")
    mark_safe_parser.add_argument("--user", help="标记人")
    mark_safe_parser.add_argument("--reason", help="原因")
    mark_safe_parser.add_argument("--hours", type=int, help="有效期（小时），不指定则临时生效，新异常会触发警报")

    suggest_limit_parser = subparsers.add_parser("suggest-limit", help="生成限权建议")
    suggest_limit_parser.add_argument("--key-id", required=True, help="密钥ID")

    report_parser = subparsers.add_parser("report", help="生成风险报告")
    report_parser.add_argument("--dimension", required=True, choices=["customer", "key", "api"],
                              help="报告维度: customer|key|api")
    report_parser.add_argument("--value", help="维度值（客户ID/密钥ID/接口路径）")
    report_parser.add_argument("--detailed", action="store_true", help="显示详细证据")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    cli = RiskCLI()

    if args.command == "analyze":
        cli.cmd_analyze(args)
    elif args.command == "explain":
        cli.cmd_explain(args)
    elif args.command == "mark-safe":
        cli.cmd_mark_safe(args)
    elif args.command == "suggest-limit":
        cli.cmd_suggest_limit(args)
    elif args.command == "report":
        cli.cmd_report(args)


if __name__ == "__main__":
    main()
