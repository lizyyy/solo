import json
from typing import Optional
from datetime import datetime
from tabulate import tabulate

from .models import TroubleshootingResult, ConclusionStatus, VerificationResult


class ConsoleColors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


class NoColors:
    HEADER = ''
    OKBLUE = ''
    OKCYAN = ''
    OKGREEN = ''
    WARNING = ''
    FAIL = ''
    ENDC = ''
    BOLD = ''
    UNDERLINE = ''


class ResultReporter:
    STATUS_COLORS = {
        VerificationResult.PASS: ConsoleColors.OKGREEN,
        VerificationResult.FAIL: ConsoleColors.FAIL,
        VerificationResult.WARNING: ConsoleColors.WARNING,
        VerificationResult.PENDING: ConsoleColors.OKCYAN,
    }

    CONCLUSION_COLORS = {
        ConclusionStatus.APPROVE_REFUND: ConsoleColors.OKGREEN,
        ConclusionStatus.REJECT_REFUND: ConsoleColors.FAIL,
        ConclusionStatus.NEED_MORE_INFO: ConsoleColors.WARNING,
        ConclusionStatus.PARTIAL_REFUND: ConsoleColors.OKCYAN,
    }

    CONCLUSION_DISPLAY = {
        ConclusionStatus.APPROVE_REFUND: "批准退款",
        ConclusionStatus.REJECT_REFUND: "拒绝退款",
        ConclusionStatus.NEED_MORE_INFO: "需要更多信息",
        ConclusionStatus.PARTIAL_REFUND: "部分退款",
    }

    @staticmethod
    def generate_human_report(result: TroubleshootingResult, use_color: bool = True) -> str:
        lines = []
        color = ConsoleColors if use_color else NoColors

        lines.append(f"\n{color.HEADER}{color.BOLD}{'='*70}{color.ENDC}")
        lines.append(f"{color.HEADER}{color.BOLD}           洗衣机启动失败支付核验退款排查报告{color.ENDC}")
        lines.append(f"{color.HEADER}{color.BOLD}{'='*70}{color.ENDC}")

        lines.append(f"\n{color.BOLD}【基本信息】{color.ENDC}")
        basic_info = [
            ["案例编号", result.case_id],
            ["机器编号", result.machine_id],
            ["支付流水", result.payment_id or "-"],
            ["退款申请", result.refund_id or "-"],
            ["生成时间", result.generated_at.strftime("%Y-%m-%d %H:%M:%S")],
        ]
        lines.append(tabulate(basic_info, tablefmt="simple"))

        lines.append(f"\n{color.BOLD}【核查项目结果】{color.ENDC}")
        verification_data = []

        payment_color = ResultReporter.STATUS_COLORS.get(result.payment_verification, '')
        payment_display = ResultReporter._get_verification_display(result.payment_verification)
        verification_data.append([
            "支付核验",
            f"{payment_color}{payment_display}{color.ENDC}",
            result.payment_verification_details.get("result", result.payment_verification_details.get("error", ""))
        ])

        event_color = ResultReporter.STATUS_COLORS.get(result.event_matching, '')
        event_display = ResultReporter._get_verification_display(result.event_matching)
        verification_data.append([
            "启动事件匹配",
            f"{event_color}{event_display}{color.ENDC}",
            result.event_matching_details.get("result", result.event_matching_details.get("error", ""))
        ])

        refund_color = ResultReporter.STATUS_COLORS.get(result.refund_state_check, '')
        refund_display = ResultReporter._get_verification_display(result.refund_state_check)
        verification_data.append([
            "退款状态检查",
            f"{refund_color}{refund_display}{color.ENDC}",
            result.refund_state_details.get("state_description", "")
        ])

        idempotency_color = ResultReporter.STATUS_COLORS.get(result.idempotency_check, '')
        idempotency_display = ResultReporter._get_verification_display(result.idempotency_check)
        verification_data.append([
            "重复申请检查",
            f"{idempotency_color}{idempotency_display}{color.ENDC}",
            result.idempotency_details.get("result", result.idempotency_details.get("issue", ""))
        ])

        lines.append(tabulate(verification_data, headers=["核查项目", "结果", "说明"], tablefmt="grid"))

        lines.append(f"\n{color.BOLD}【故障分析】{color.ENDC}")
        if result.fault_analysis.get("faults_found"):
            lines.append(f"  {color.WARNING}检测到以下故障:{color.ENDC}")
            for desc in result.fault_analysis.get("fault_descriptions", []):
                lines.append(f"    • {desc}")
            lines.append(f"  {color.BOLD}建议措施:{color.ENDC} {result.fault_analysis.get('suggested_action', '')}")
            lines.append(f"  {color.BOLD}是否可退款:{color.ENDC} {'是' if result.fault_analysis.get('refundable') else '否'}")
        else:
            lines.append(f"  {color.OKGREEN}未检测到明确的机器故障{color.ENDC}")

        lines.append(f"\n{color.BOLD}【详细核查信息】{color.ENDC}")

        lines.append(f"\n  {color.UNDERLINE}支付核验详情:{color.ENDC}")
        for key, value in result.payment_verification_details.items():
            lines.append(f"    {key}: {value}")

        lines.append(f"\n  {color.UNDERLINE}启动事件匹配详情:{color.ENDC}")
        for key, value in result.event_matching_details.items():
            if key != "failed_events":
                lines.append(f"    {key}: {value}")

        if "failed_events" in result.event_matching_details:
            lines.append(f"    失败事件列表:")
            for idx, event in enumerate(result.event_matching_details["failed_events"], 1):
                lines.append(f"      [{idx}] 事件ID: {event['event_id']}, 状态: {event['status']}")
                if event.get('fault_code'):
                    lines.append(f"           故障代码: {event['fault_code']}")
                if event.get('error_message'):
                    lines.append(f"           错误信息: {event['error_message']}")

        lines.append(f"\n  {color.UNDERLINE}退款状态详情:{color.ENDC}")
        for key, value in result.refund_state_details.items():
            lines.append(f"    {key}: {value}")

        lines.append(f"\n  {color.UNDERLINE}幂等性检查详情:{color.ENDC}")
        for key, value in result.idempotency_details.items():
            lines.append(f"    {key}: {value}")

        lines.append(f"\n{color.HEADER}{color.BOLD}{'-'*70}{color.ENDC}")
        conclusion_color = ResultReporter.CONCLUSION_COLORS.get(result.conclusion, '')
        conclusion_display = ResultReporter.CONCLUSION_DISPLAY.get(result.conclusion, result.conclusion)
        lines.append(f"{color.BOLD}【最终结论】{color.ENDC}")
        lines.append(f"  结论: {conclusion_color}{color.BOLD}{conclusion_display}{color.ENDC}")
        lines.append(f"  理由: {result.conclusion_reason}")
        if result.suggested_refund_amount is not None:
            lines.append(f"  建议退款金额: ¥{result.suggested_refund_amount:.2f}")

        lines.append(f"\n{color.HEADER}{color.BOLD}{'='*70}{color.ENDC}\n")

        return "\n".join(lines)

    @staticmethod
    def _get_verification_display(status: VerificationResult) -> str:
        display_map = {
            VerificationResult.PASS: "通过 ✓",
            VerificationResult.FAIL: "失败 ✗",
            VerificationResult.WARNING: "警告 ⚠",
            VerificationResult.PENDING: "待处理 ⏳",
        }
        return display_map.get(status, status)

    @staticmethod
    def generate_machine_report(result: TroubleshootingResult, pretty: bool = True) -> str:
        data = result.dict()

        def _serialize_datetime(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")

        if pretty:
            return json.dumps(data, ensure_ascii=False, indent=2, default=_serialize_datetime)
        return json.dumps(data, ensure_ascii=False, separators=(',', ':'), default=_serialize_datetime)

    @staticmethod
    def export_json(result: TroubleshootingResult, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(ResultReporter.generate_machine_report(result))

    @staticmethod
    def export_text(result: TroubleshootingResult, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(ResultReporter.generate_human_report(result, use_color=False))

    @staticmethod
    def verify_consistency(result: TroubleshootingResult) -> bool:
        json_str = ResultReporter.generate_machine_report(result, pretty=False)
        json_data = json.loads(json_str)

        checks = [
            json_data.get("case_id") == result.case_id,
            json_data.get("machine_id") == result.machine_id,
            json_data.get("payment_id") == result.payment_id,
            json_data.get("refund_id") == result.refund_id,
            json_data.get("conclusion") == result.conclusion,
            json_data.get("conclusion_reason") == result.conclusion_reason,
            json_data.get("payment_verification") == result.payment_verification,
            json_data.get("event_matching") == result.event_matching,
            json_data.get("refund_state_check") == result.refund_state_check,
            json_data.get("idempotency_check") == result.idempotency_check,
        ]

        return all(checks)
