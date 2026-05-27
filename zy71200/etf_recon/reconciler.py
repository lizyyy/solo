from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    BrokerReceipt,
    CashSubstitution,
    DifferenceItem,
    ReceiptStatus,
    ReconResult,
    RedemptionList,
    SubstitutionFlag,
    SuspendedSecurity,
)


class ETFReconciler:
    def __init__(self):
        pass

    def reconcile(
        self,
        redemption_list: RedemptionList,
        broker_receipt: BrokerReceipt,
        suspended_securities: Optional[List[SuspendedSecurity]] = None,
        cash_substitutions: Optional[List[CashSubstitution]] = None,
        source_files: Optional[Dict[str, str]] = None,
    ) -> ReconResult:
        result = ReconResult(
            etf_code=redemption_list.etf_code,
            trade_date=redemption_list.trade_date,
            analysis_time=datetime.now(),
            broker_name=broker_receipt.broker_name,
            source_files=source_files or {},
        )

        result.processing_steps.append("步骤1: 加载数据源文件")
        result.processing_steps.append(f"  - 申赎清单: {len(redemption_list.components)} 只成分券")
        result.processing_steps.append(f"  - 券商回执: {len(broker_receipt.components)} 只成分券")
        if suspended_securities:
            result.processing_steps.append(f"  - 停牌日历: {len(suspended_securities)} 只停牌证券")
        if cash_substitutions:
            result.processing_steps.append(f"  - 替代现金清单: {len(cash_substitutions)} 条记录")

        result.processing_steps.append("步骤2: 成分券数量核对")
        self._check_components(redemption_list, broker_receipt, result)

        result.processing_steps.append("步骤3: 替代现金重算校验")
        self._check_cash_substitution(redemption_list, broker_receipt, cash_substitutions, result)

        result.processing_steps.append("步骤4: 异常检测")
        self._check_anomalies(redemption_list, broker_receipt, suspended_securities, result)

        result.processing_steps.append("步骤5: 回执版本校验")
        self._check_receipt_version(broker_receipt, result)

        self._finalize_result(result)

        return result

    def _check_components(
        self,
        redemption_list: RedemptionList,
        broker_receipt: BrokerReceipt,
        result: ReconResult,
    ):
        expected_components = {c.code: c for c in redemption_list.components}
        actual_components = {c.code: c for c in broker_receipt.components}

        all_codes = set(expected_components.keys()) | set(actual_components.keys())
        result.component_total_count = len(expected_components)
        match_count = 0

        for code in all_codes:
            expected = expected_components.get(code)
            actual = actual_components.get(code)

            if expected is None:
                result.differences.append(
                    DifferenceItem(
                        code=code,
                        name=actual.name if actual else "未知",
                        difference_type="额外成分券",
                        expected="无",
                        actual=f"数量 {actual.quantity if actual else 0}",
                        severity="warning",
                        explanation="券商回执包含申赎清单外的证券",
                    )
                )
                result.processing_steps.append(f"  - 发现额外成分券: {code}")
                continue

            if actual is None:
                result.differences.append(
                    DifferenceItem(
                        code=code,
                        name=expected.name,
                        difference_type="缺失成分券",
                        expected=f"数量 {expected.quantity}",
                        actual="无",
                        severity="error",
                        explanation="券商回执缺少申赎清单中的证券",
                    )
                )
                result.processing_steps.append(f"  - 发现缺失成分券: {code}")
                continue

            if expected.quantity != actual.quantity:
                result.differences.append(
                    DifferenceItem(
                        code=code,
                        name=expected.name,
                        difference_type="数量差异",
                        expected=f"{expected.quantity}",
                        actual=f"{actual.quantity}",
                        severity="warning" if abs(expected.quantity - actual.quantity) < 100 else "error",
                        explanation=f"预期数量 {expected.quantity}，实际数量 {actual.quantity}",
                    )
                )
                result.processing_steps.append(f"  - 数量差异: {code} 预期{expected.quantity} 实际{actual.quantity}")
            else:
                match_count += 1

        result.component_match_count = match_count
        result.processing_steps.append(f"  - 核对完成: 匹配 {match_count}/{len(expected_components)} 只")

    def _check_cash_substitution(
        self,
        redemption_list: RedemptionList,
        broker_receipt: BrokerReceipt,
        cash_substitutions: Optional[List[CashSubstitution]],
        result: ReconResult,
    ):
        expected_cash = redemption_list.total_cash_substitution + redemption_list.estimated_cash
        actual_cash = broker_receipt.total_cash_substituted + broker_receipt.actual_cash

        result.expected_cash_total = expected_cash
        result.actual_cash_total = actual_cash

        if cash_substitutions:
            recalculated_cash = sum(s.amount for s in cash_substitutions)
            if abs(recalculated_cash - broker_receipt.total_cash_substituted) > 0.01:
                result.differences.append(
                    DifferenceItem(
                        code="CASH_TOTAL",
                        name="现金替代总额",
                        difference_type="替代现金重复计入",
                        expected=f"{recalculated_cash:.2f}",
                        actual=f"{broker_receipt.total_cash_substituted:.2f}",
                        severity="error",
                        explanation=f"按替代现金清单重算应为 {recalculated_cash:.2f}，回执金额不符，可能存在重复计入",
                    )
                )
                result.processing_steps.append(f"  - 现金替代重算差异: 重算{recalculated_cash:.2f} 回执{broker_receipt.total_cash_substituted:.2f}")

        cash_diff = abs(expected_cash - actual_cash)
        if cash_diff > 0.01:
            result.cash_match = False
            result.differences.append(
                DifferenceItem(
                    code="CASH",
                    name="现金总额",
                    difference_type="现金差异",
                    expected=f"{expected_cash:.2f}",
                    actual=f"{actual_cash:.2f}",
                    severity="error" if cash_diff > 100 else "warning",
                    explanation=f"现金总额差异 {cash_diff:.2f} 元",
                )
            )
            result.processing_steps.append(f"  - 现金总额差异: {cash_diff:.2f} 元")
        else:
            result.processing_steps.append("  - 现金核对通过")

    def _check_anomalies(
        self,
        redemption_list: RedemptionList,
        broker_receipt: BrokerReceipt,
        suspended_securities: Optional[List[SuspendedSecurity]],
        result: ReconResult,
    ):
        if not suspended_securities:
            result.processing_steps.append("  - 无停牌日历数据，跳过停牌检测")
            return

        suspended_codes = {s.code for s in suspended_securities if not s.is_resumed}
        expected_components = {c.code: c for c in redemption_list.components}

        for actual in broker_receipt.components:
            if actual.code in suspended_codes and actual.quantity > 0:
                expected = expected_components.get(actual.code)
                if expected and expected.substitution_flag != SubstitutionFlag.FORBIDDEN:
                    result.anomalies.append(
                        DifferenceItem(
                            code=actual.code,
                            name=actual.name,
                            difference_type="停牌券实物交收",
                            expected="现金替代",
                            actual=f"实物交收 {actual.quantity}",
                            severity="critical",
                            explanation="该证券当日停牌，应使用现金替代而非实物交收",
                        )
                    )
                    result.processing_steps.append(f"  - 异常: 停牌券 {actual.code} 仍按实物处理")

        code_counts: Dict[str, int] = {}
        for actual in broker_receipt.components:
            code_counts[actual.code] = code_counts.get(actual.code, 0) + 1

        for code, count in code_counts.items():
            if count > 1:
                comp = next((c for c in broker_receipt.components if c.code == code), None)
                result.anomalies.append(
                    DifferenceItem(
                        code=code,
                        name=comp.name if comp else "未知",
                        difference_type="重复记录",
                        expected="1条记录",
                        actual=f"{count}条记录",
                        severity="error",
                        explanation="同一证券在回执中出现多次，可能存在重复计入",
                    )
                )
                result.processing_steps.append(f"  - 异常: {code} 出现 {count} 次重复记录")

    def _check_receipt_version(self, broker_receipt: BrokerReceipt, result: ReconResult):
        status_info = f"版本 {broker_receipt.receipt_version} - {broker_receipt.status.value}"
        result.processing_steps.append(f"  - 回执状态: {status_info}")

        if broker_receipt.status == ReceiptStatus.PRELIMINARY:
            result.anomalies.append(
                DifferenceItem(
                    code="RECEIPT",
                    name="回执状态",
                    difference_type="初步回执",
                    expected="最终回执",
                    actual="初步回执",
                    severity="warning",
                    explanation="当前为初步回执，后续可能被新版本覆盖",
                )
            )
        elif broker_receipt.status == ReceiptStatus.CORRECTED:
            result.processing_steps.append("  - 注意: 此为更正回执，已覆盖旧结论")

    def _finalize_result(self, result: ReconResult):
        has_critical = any(a.severity == "critical" for a in result.anomalies)
        has_errors = any(d.severity in ["error", "critical"] for d in result.differences)
        all_matched = result.component_match_count == result.component_total_count
        cash_ok = result.cash_match

        result.is_pass = not has_critical and not has_errors and all_matched and cash_ok

        result.processing_steps.append("步骤6: 生成最终结论")
        result.processing_steps.append(f"  - 成分券匹配率: {result.component_match_count}/{result.component_total_count}")
        result.processing_steps.append(f"  - 现金核对: {'通过' if cash_ok else '不通过'}")
        result.processing_steps.append(f"  - 差异数量: {len(result.differences)}")
        result.processing_steps.append(f"  - 异常数量: {len(result.anomalies)}")
        result.processing_steps.append(f"  - 最终结论: {'通过' if result.is_pass else '不通过'}")
