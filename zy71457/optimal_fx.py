#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最优换汇路径API (Optimal FX Path API)
跨境电商财务多币种换汇路径比较工具

业务解释：
- 图搜索：把每种币种看作"站点"，汇率+手续费看作"票价"，找最便宜的换乘路线
- 成本计算：不仅看表面汇率，还要算上每一步的手续费，算出真实到手金额
- 限额校验：每一步兑换都不能超过账户余额和单笔/日累计限额，避免"账面最优但实际走不通"
"""

import json
import sys
import argparse
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from datetime import datetime
from collections import defaultdict


class RiskType(str, Enum):
    """风险类型 - 业务同事能一眼看懂的分类"""
    FEE_MISSED = "FEE_MISSED"           # 手续费漏算
    LIMIT_EXCEEDED = "LIMIT_EXCEEDED"   # 额度超限
    PATH_CYCLE = "PATH_CYCLE"           # 路径循环
    DATA_CONFLICT = "DATA_CONFLICT"     # 数据口径冲突
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE"  # 余额不足


class RecordStatus(str, Enum):
    """记录状态 - 正常/问题分离"""
    NORMAL = "NORMAL"     # 正常记录
    PROBLEM = "PROBLEM"   # 问题记录


@dataclass
class ExchangeRate:
    """币种汇率
    业务解释：A币种兑B币种的汇率=1单位A能换多少B
    例：USD/CNY=7.25 表示1美元换7.25人民币
    """
    from_currency: str
    to_currency: str
    rate: float
    source: str                    # 数据来源，用于冲突识别
    effective_date: str
    data_conflict: bool = False    # 标记是否与其他来源口径冲突
    original_values: List[Dict] = field(default_factory=list)  # 冲突时保留所有原始值

    def __post_init__(self):
        if not self.original_values:
            self.original_values.append({
                "rate": self.rate,
                "source": self.source,
                "effective_date": self.effective_date
            })


@dataclass
class FeeConfig:
    """手续费配置
    支持三种模式：固定金额、百分比、阶梯式
    例：换汇手续费=0.1% 最低2美元 最高50美元
    """
    from_currency: str
    to_currency: str
    fee_type: str                  # FIXED / PERCENTAGE / TIERED
    fee_value: float               # 固定金额或百分比
    min_fee: Optional[float] = None
    max_fee: Optional[float] = None
    currency: str = ""             # 手续费收取币种（默认=from_currency）
    tiered_config: List[Dict] = field(default_factory=list)
    source: str = ""
    data_conflict: bool = False
    original_values: List[Dict] = field(default_factory=list)

    def __post_init__(self):
        if not self.currency:
            self.currency = self.from_currency
        if not self.original_values:
            self.original_values.append({
                "fee_type": self.fee_type,
                "fee_value": self.fee_value,
                "min_fee": self.min_fee,
                "max_fee": self.max_fee,
                "source": self.source
            })


@dataclass
class AccountBalance:
    """账户余额
    业务解释：某账户下某币种的可用余额，以及该通道的兑换限额
    """
    account_id: str
    currency: str
    available_balance: float
    daily_limit: Optional[float] = None      # 日累计兑换限额
    single_limit: Optional[float] = None     # 单笔兑换限额
    daily_used: float = 0.0                  # 当日已用额度
    source: str = ""


@dataclass
class PathNode:
    """路径节点 - 图搜索中的每一步"""
    currency: str
    amount: float                      # 兑换到该币种时的金额（已扣手续费）
    fee_paid: float                    # 本步支付的手续费
    rate_used: float                   # 本步使用的汇率
    from_amount: float                 # 本步投入的金额
    account_id: str = ""
    fee_config_hash: str = ""          # 用于检测手续费是否漏算


@dataclass
class RiskIssue:
    """风险问题 - 每个问题单独记录，不混在结果里"""
    risk_type: RiskType
    severity: str                      # HIGH / MEDIUM / LOW
    message: str
    business_explanation: str          # 业务同事能懂的解释
    details: Dict[str, Any] = field(default_factory=dict)
    path_reference: Optional[List[str]] = None  # 关联的币种路径


@dataclass
class ManualOverride:
    """人工修正记录 - 审计用，月底复盘能翻回来"""
    field_name: str
    old_value: Any
    new_value: Any
    reason: str
    operator: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    original_record_id: str = ""


@dataclass
class PathResult:
    """换汇路径结果"""
    record_id: str
    status: RecordStatus
    source_currency: str
    target_currency: str
    source_amount: float
    final_amount: float
    total_fee: float
    path: List[PathNode]
    path_currencies: List[str]
    effective_rate: float              # 综合汇率 = final_amount / source_amount
    steps: int
    issues: List[RiskIssue] = field(default_factory=list)
    manual_overrides: List[ManualOverride] = field(default_factory=list)
    business_explanation: str = ""     # 整条路径的业务解释


class CostCalculator:
    """
    成本计算器
    业务解释：每一步兑换的真实成本 = 汇差 + 手续费
    例：USD->CNY直接换可能比USD->EUR->CNY贵，因为中间行手续费不同
    """

    @staticmethod
    def calculate_fee(amount: float, fee: FeeConfig) -> Tuple[float, str]:
        """计算手续费
        返回：(手续费金额, 手续费币种, 是否有问题标记)
        """
        if fee.data_conflict:
            explanation = f"手续费口径冲突：{[v['source'] for v in fee.original_values]} 各报不同，取{fee.source}的值"
            return (0, fee.currency)  # 冲突时不自动选值，返回0并在风险中标记

        if fee.fee_type == "FIXED":
            return (fee.fee_value, fee.currency)

        elif fee.fee_type == "PERCENTAGE":
            calculated = amount * fee.fee_value
            if fee.min_fee and calculated < fee.min_fee:
                calculated = fee.min_fee
            if fee.max_fee and calculated > fee.max_fee:
                calculated = fee.max_fee
            return (round(calculated, 6), fee.currency)

        elif fee.fee_type == "TIERED":
            for tier in sorted(fee.tiered_config, key=lambda x: x['min_amount']):
                if amount >= tier['min_amount']:
                    current_tier = tier
            return (round(amount * current_tier['percentage'], 6), fee.currency)

        return (0, fee.currency)

    @staticmethod
    def calculate_effective_rate(source_amount: float, target_amount: float) -> float:
        """计算综合有效汇率
        业务解释：把所有手续费摊进去后，实际1单位源币种能换到多少目标币种
        """
        if source_amount <= 0:
            return 0
        return round(target_amount / source_amount, 8)

    @staticmethod
    def step_convert(from_amount: float, rate: ExchangeRate, fee: FeeConfig,
                     balance: AccountBalance) -> Tuple[float, float, List[RiskIssue]]:
        """执行单步兑换计算
        返回：(到手金额, 支付手续费, 风险问题列表)
        """
        issues = []

        if rate.data_conflict:
            issues.append(RiskIssue(
                risk_type=RiskType.DATA_CONFLICT,
                severity="MEDIUM",
                message=f"汇率口径冲突：{rate.from_currency}->{rate.to_currency}",
                business_explanation=f"{rate.source}与其他数据源汇率不一致，当前使用{rate.rate}，原始值：{rate.original_values}",
                details={"rate_key": f"{rate.from_currency}_{rate.to_currency}",
                         "sources": [v['source'] for v in rate.original_values]}
            ))

        if fee.data_conflict:
            issues.append(RiskIssue(
                risk_type=RiskType.DATA_CONFLICT,
                severity="MEDIUM",
                message=f"手续费口径冲突：{fee.from_currency}->{fee.to_currency}",
                business_explanation=f"不同来源手续费标准不同，不自动选择，请人工确认",
                details={"sources": [v['source'] for v in fee.original_values]}
            ))

        fee_amount, fee_currency = CostCalculator.calculate_fee(from_amount, fee)

        if fee_amount == 0 and not fee.data_conflict:
            issues.append(RiskIssue(
                risk_type=RiskType.FEE_MISSED,
                severity="HIGH",
                message=f"手续费可能漏算：{fee.from_currency}->{fee.to_currency}",
                business_explanation="计算出的手续费为0，请检查手续费配置是否完整，避免实际换汇时产生额外成本",
                details={"from_amount": from_amount, "fee_type": fee.fee_type}
            ))

        convert_result = from_amount * rate.rate
        received_amount = convert_result

        if fee_currency == fee.to_currency:
            received_amount = convert_result - fee_amount
        elif fee_currency == fee.from_currency:
            effective_from = from_amount - fee_amount
            received_amount = effective_from * rate.rate

        received_amount = round(received_amount, 6)

        if balance.available_balance < from_amount:
            issues.append(RiskIssue(
                risk_type=RiskType.INSUFFICIENT_BALANCE,
                severity="HIGH",
                message=f"余额不足：{balance.currency} 需{from_amount} 仅{balance.available_balance}",
                business_explanation=f"账户{balance.account_id}的{balance.currency}可用余额{balance.available_balance}，不足以支付本次兑换的{from_amount}",
                details={"account_id": balance.account_id, "currency": balance.currency,
                         "available": balance.available_balance, "required": from_amount}
            ))

        if balance.single_limit and from_amount > balance.single_limit:
            issues.append(RiskIssue(
                risk_type=RiskType.LIMIT_EXCEEDED,
                severity="HIGH",
                message=f"单笔超限：{balance.currency} 单笔限{balance.single_limit}",
                business_explanation=f"本次兑换{from_amount}{balance.currency}超过单笔限额{balance.single_limit}，需拆分或申请提额",
                details={"limit_type": "SINGLE", "limit": balance.single_limit, "amount": from_amount}
            ))

        if balance.daily_limit and (balance.daily_used + from_amount) > balance.daily_limit:
            remaining = balance.daily_limit - balance.daily_used
            issues.append(RiskIssue(
                risk_type=RiskType.LIMIT_EXCEEDED,
                severity="HIGH",
                message=f"日累计超限：{balance.currency} 日限{balance.daily_limit} 已用{balance.daily_used}",
                business_explanation=f"当日已用{balance.daily_used}，剩余{remaining}，本次{from_amount}超出日累计限额",
                details={"limit_type": "DAILY", "limit": balance.daily_limit,
                         "used": balance.daily_used, "amount": from_amount,
                         "remaining": remaining}
            ))

        return (received_amount, fee_amount, issues)


class FXPathFinder:
    """
    换汇路径搜索器 - 基于Bellman-Ford算法的图搜索
    业务解释：
    - 把币种看作节点，汇率+手续费看作边的权重
    - 找从源币种到目标币种总成本最低的路径
    - 同时检测负权环（循环套利机会，实际业务中通常禁止）
    """

    def __init__(self, rates: Dict[str, ExchangeRate], fees: Dict[str, FeeConfig],
                 balances: Dict[str, AccountBalance]):
        self.rates = rates
        self.fees = fees
        self.balances = balances
        self.MAX_STEPS = 5  # 最多允许4步兑换，防止路径过长手续费吃掉收益

    def _get_rate_key(self, from_cur: str, to_cur: str) -> str:
        return f"{from_cur}_{to_cur}"

    def _has_cycle(self, path: List[str], currency: str) -> bool:
        """检测是否形成循环"""
        return currency in path

    @staticmethod
    def _deduplicate_issues(issues: List[RiskIssue]) -> List[RiskIssue]:
        """风险问题去重 - 同一类问题只保留一条
        去重维度：风险类型 + 核心消息（取前30字符）+ 币种对
        """
        seen = set()
        unique_issues = []
        for issue in issues:
            key_parts = [issue.risk_type.value, issue.message[:30]]
            if issue.details:
                for k in ["rate_key", "missing_fee", "limit_type", "cycle_path"]:
                    if k in issue.details:
                        key_parts.append(str(issue.details[k]))
                        break
            key = "|".join(key_parts)
            if key not in seen:
                seen.add(key)
                unique_issues.append(issue)
        return unique_issues

    def find_optimal_path(self, source_currency: str, target_currency: str,
                          source_amount: float, record_id: str = "") -> PathResult:
        """
        查找最优换汇路径
        业务解释：用动态规划思想，一步步尝试所有可能的兑换组合，
        每一步都算上汇率和手续费，最后比较哪个路径到手的钱最多
        """
        best_amount = {source_currency: source_amount}
        best_path = {source_currency: [PathNode(
            currency=source_currency,
            amount=source_amount,
            fee_paid=0,
            rate_used=1.0,
            from_amount=source_amount
        )]}
        best_fees = {source_currency: 0.0}
        all_issues: List[RiskIssue] = []

        for step in range(self.MAX_STEPS):
            new_best = dict(best_amount)
            updated = False

            for from_cur, current_amount in best_amount.items():
                if current_amount <= 0:
                    continue

                for rate_key, rate in self.rates.items():
                    if not rate_key.startswith(f"{from_cur}_"):
                        continue

                    to_cur = rate.to_currency
                    if to_cur == from_cur:
                        continue

                    path_so_far = [n.currency for n in best_path[from_cur]]

                    if self._has_cycle(path_so_far, to_cur):
                        cycle_path = path_so_far + [to_cur]
                        all_issues.append(RiskIssue(
                            risk_type=RiskType.PATH_CYCLE,
                            severity="HIGH",
                            message=f"检测到循环路径：{'->'.join(cycle_path)}",
                            business_explanation=f"路径{'->'.join(cycle_path)}形成闭环，可能是套利算法识别到的机会，但实际业务中循环兑换会产生额外手续费且可能违反监管规定",
                            details={"cycle_path": cycle_path, "step": step},
                            path_reference=cycle_path
                        ))
                        continue

                    fee_key = self._get_rate_key(from_cur, to_cur)
                    fee = self.fees.get(fee_key)

                    if fee is None:
                        all_issues.append(RiskIssue(
                            risk_type=RiskType.FEE_MISSED,
                            severity="HIGH",
                            message=f"缺少手续费配置：{from_cur}->{to_cur}",
                            business_explanation=f"从{from_cur}兑换到{to_cur}的手续费规则未配置，实际执行时可能产生未知费用",
                            details={"missing_fee": fee_key},
                            path_reference=path_so_far + [to_cur]
                        ))
                        fee = FeeConfig(
                            from_currency=from_cur,
                            to_currency=to_cur,
                            fee_type="PERCENTAGE",
                            fee_value=0,
                            source="DEFAULT_EMPTY"
                        )

                    bal_key = f"default_{from_cur}"
                    balance = self.balances.get(bal_key, AccountBalance(
                        account_id="default",
                        currency=from_cur,
                        available_balance=float('inf')
                    ))

                    received, fee_paid, step_issues = CostCalculator.step_convert(
                        current_amount, rate, fee, balance
                    )
                    all_issues.extend(step_issues)

                    if to_cur not in new_best or received > new_best[to_cur]:
                        new_best[to_cur] = received
                        new_node = PathNode(
                            currency=to_cur,
                            amount=received,
                            fee_paid=fee_paid,
                            rate_used=rate.rate,
                            from_amount=current_amount
                        )
                        best_path[to_cur] = best_path[from_cur] + [new_node]
                        best_fees[to_cur] = best_fees[from_cur] + fee_paid
                        updated = True

            best_amount = new_best
            if not updated:
                break

        all_issues = self._deduplicate_issues(all_issues)

        if target_currency not in best_amount:
            issues = self._deduplicate_issues(all_issues + [RiskIssue(
                risk_type=RiskType.LIMIT_EXCEEDED,
                severity="CRITICAL",
                message=f"无法找到从{source_currency}到{target_currency}的可行路径",
                business_explanation="所有可能的兑换路径都被限额、余额或其他限制阻断，请检查输入数据",
                details={"source": source_currency, "target": target_currency}
            )])
            return PathResult(
                record_id=record_id,
                status=RecordStatus.PROBLEM,
                source_currency=source_currency,
                target_currency=target_currency,
                source_amount=source_amount,
                final_amount=0,
                total_fee=0,
                path=[],
                path_currencies=[source_currency, target_currency],
                effective_rate=0,
                steps=0,
                issues=issues
            )

        final_path = best_path[target_currency]
        final_amount = best_amount[target_currency]
        total_fee = best_fees[target_currency]
        path_currencies = [n.currency for n in final_path]
        effective_rate = CostCalculator.calculate_effective_rate(source_amount, final_amount)

        has_high_risk = any(i.severity in ("HIGH", "CRITICAL") for i in all_issues)
        status = RecordStatus.PROBLEM if has_high_risk else RecordStatus.NORMAL

        steps = len(final_path) - 1
        path_desc = "->".join(path_currencies)
        if steps == 1:
            explanation = f"直接兑换：{path_desc}，综合汇率{effective_rate}，总手续费{total_fee}"
        else:
            explanation = f"多步兑换（{steps}步）：{path_desc}，虽然多了{steps-1}次手续费，但综合汇率{effective_rate}优于直接兑换"

        explanation += f" | 图搜索逻辑：从{source_currency}出发，尝试所有不超过{self.MAX_STEPS-1}次中转的路径；成本计算：每步扣除手续费后用实际到手金额比较；限额校验：每步都检查余额和单笔/日累计限额"

        return PathResult(
            record_id=record_id,
            status=status,
            source_currency=source_currency,
            target_currency=target_currency,
            source_amount=source_amount,
            final_amount=final_amount,
            total_fee=total_fee,
            path=final_path,
            path_currencies=path_currencies,
            effective_rate=effective_rate,
            steps=steps,
            issues=all_issues,
            business_explanation=explanation
        )


class DataIntegrityChecker:
    """
    数据完整性校验器
    业务解释：不同数据源可能打架（比如路透和彭博的汇率不同），
    我们不替业务做选择，只把冲突标记出来保留原始值
    """

    @staticmethod
    def detect_and_mark_conflicts(rates: List[Dict], fees: List[Dict]) -> Tuple[Dict[str, ExchangeRate], Dict[str, FeeConfig]]:
        """检测数据冲突并保留所有原始值"""
        rate_groups = defaultdict(list)
        for r in rates:
            key = f"{r['from_currency']}_{r['to_currency']}"
            rate_groups[key].append(r)

        fee_groups = defaultdict(list)
        for f in fees:
            key = f"{f['from_currency']}_{f['to_currency']}"
            fee_groups[key].append(f)

        result_rates = {}
        for key, group in rate_groups.items():
            unique_rates = {g['rate'] for g in group}
            has_conflict = len(unique_rates) > 1

            rate_obj = ExchangeRate(
                from_currency=group[0]['from_currency'],
                to_currency=group[0]['to_currency'],
                rate=group[0]['rate'],
                source=group[0].get('source', 'unknown'),
                effective_date=group[0].get('effective_date', ''),
                data_conflict=has_conflict,
                original_values=[{
                    "rate": g['rate'],
                    "source": g.get('source', 'unknown'),
                    "effective_date": g.get('effective_date', '')
                } for g in group]
            )
            if has_conflict:
                sources = [g.get('source', 'unknown') for g in group]
                vals = [g['rate'] for g in group]
                print(f"[数据冲突警告] 汇率{key}: {sources} 分别报 {vals}", file=sys.stderr)
            result_rates[key] = rate_obj

        result_fees = {}
        for key, group in fee_groups.items():
            unique_fees = set()
            for g in group:
                unique_fees.add((g.get('fee_type'), g.get('fee_value'), g.get('min_fee'), g.get('max_fee')))
            has_conflict = len(unique_fees) > 1

            fee_obj = FeeConfig(
                from_currency=group[0]['from_currency'],
                to_currency=group[0]['to_currency'],
                fee_type=group[0]['fee_type'],
                fee_value=group[0]['fee_value'],
                min_fee=group[0].get('min_fee'),
                max_fee=group[0].get('max_fee'),
                currency=group[0].get('currency', group[0]['from_currency']),
                tiered_config=group[0].get('tiered_config', []),
                source=group[0].get('source', 'unknown'),
                data_conflict=has_conflict,
                original_values=[{
                    "fee_type": g.get('fee_type'),
                    "fee_value": g.get('fee_value'),
                    "min_fee": g.get('min_fee'),
                    "max_fee": g.get('max_fee'),
                    "source": g.get('source', 'unknown')
                } for g in group]
            )
            if has_conflict:
                sources = [g.get('source', 'unknown') for g in group]
                print(f"[数据冲突警告] 手续费{key}: {sources} 口径不一致", file=sys.stderr)
            result_fees[key] = fee_obj

        return result_rates, result_fees


class BatchProcessor:
    """
    批量处理器
    业务解释：批量处理时，正常记录和问题记录严格分开输出，
    避免业务同事翻半天找不到异常
    """

    def __init__(self, finder: FXPathFinder):
        self.finder = finder
        self.manual_overrides: Dict[str, List[ManualOverride]] = defaultdict(list)

    def apply_override(self, record_id: str, override: ManualOverride):
        """应用人工修正并记录审计轨迹"""
        self.manual_overrides[record_id].append(override)
        print(f"[人工修正] {record_id}: {override.field_name} {override.old_value}->{override.new_value} 理由:{override.reason}", file=sys.stderr)

    def process_batch(self, requests: List[Dict]) -> Dict[str, List[PathResult]]:
        """批量处理换汇请求，分离正常/问题记录"""
        normal_results = []
        problem_results = []

        for idx, req in enumerate(requests):
            record_id = req.get('record_id', f'REQ_{idx+1:06d}')

            result = self.finder.find_optimal_path(
                source_currency=req['source_currency'],
                target_currency=req['target_currency'],
                source_amount=req['source_amount'],
                record_id=record_id
            )

            if record_id in self.manual_overrides:
                result.manual_overrides = self.manual_overrides[record_id]

            if result.status == RecordStatus.NORMAL:
                normal_results.append(result)
            else:
                problem_results.append(result)

        return {
            "normal": normal_results,
            "problem": problem_results
        }


def result_to_dict(result: PathResult) -> Dict:
    """结果序列化 - 保留所有细节供审计"""
    d = {
        "record_id": result.record_id,
        "status": result.status.value,
        "source_currency": result.source_currency,
        "target_currency": result.target_currency,
        "source_amount": result.source_amount,
        "final_amount": result.final_amount,
        "total_fee": result.total_fee,
        "path_currencies": result.path_currencies,
        "effective_rate": result.effective_rate,
        "steps": result.steps,
        "business_explanation": result.business_explanation,
        "path_details": [
            {
                "step": idx,
                "currency": n.currency,
                "amount": n.amount,
                "fee_paid": n.fee_paid,
                "rate_used": n.rate_used,
                "from_amount": n.from_amount
            } for idx, n in enumerate(result.path)
        ],
        "issues": [
            {
                "risk_type": i.risk_type.value,
                "severity": i.severity,
                "message": i.message,
                "business_explanation": i.business_explanation,
                "details": i.details,
                "path_reference": i.path_reference
            } for i in result.issues
        ],
        "manual_overrides": [
            {
                "field_name": o.field_name,
                "old_value": o.old_value,
                "new_value": o.new_value,
                "reason": o.reason,
                "operator": o.operator,
                "timestamp": o.timestamp
            } for o in result.manual_overrides
        ]
    }
    return d


def load_json_file(path: str) -> Any:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description='最优换汇路径API - 跨境电商财务多币种换汇路径比较')
    parser.add_argument('--rates', required=True, help='汇率配置JSON文件路径')
    parser.add_argument('--fees', required=True, help='手续费配置JSON文件路径')
    parser.add_argument('--balances', required=True, help='账户余额JSON文件路径')
    parser.add_argument('--requests', required=True, help='换汇请求JSON文件路径')
    parser.add_argument('--overrides', help='人工修正配置JSON文件路径（可选）')
    parser.add_argument('--output-normal', default='normal_results.json', help='正常记录输出文件')
    parser.add_argument('--output-problem', default='problem_results.json', help='问题记录输出文件')
    parser.add_argument('--format', choices=['json', 'text'], default='json', help='输出格式')

    args = parser.parse_args()

    rates_data = load_json_file(args.rates)
    fees_data = load_json_file(args.fees)
    balances_data = load_json_file(args.balances)
    requests_data = load_json_file(args.requests)

    rates, fees = DataIntegrityChecker.detect_and_mark_conflicts(rates_data, fees_data)

    balances = {}
    for b in balances_data:
        key = f"{b.get('account_id', 'default')}_{b['currency']}"
        balances[key] = AccountBalance(**b)
        default_key = f"default_{b['currency']}"
        if default_key not in balances:
            balances[default_key] = AccountBalance(**b)

    finder = FXPathFinder(rates, fees, balances)
    processor = BatchProcessor(finder)

    if args.overrides:
        overrides_data = load_json_file(args.overrides)
        for o in overrides_data:
            override = ManualOverride(**o)
            processor.apply_override(o['original_record_id'], override)

    batch_result = processor.process_batch(requests_data)

    normal_dicts = [result_to_dict(r) for r in batch_result["normal"]]
    problem_dicts = [result_to_dict(r) for r in batch_result["problem"]]

    summary = {
        "total_requests": len(requests_data),
        "normal_count": len(normal_dicts),
        "problem_count": len(problem_dicts),
        "risk_breakdown": defaultdict(int)
    }

    for r in batch_result["normal"] + batch_result["problem"]:
        for issue in r.issues:
            summary["risk_breakdown"][issue.risk_type.value] += 1

    if args.format == 'json':
        with open(args.output_normal, 'w', encoding='utf-8') as f:
            json.dump({
                "summary": summary,
                "records": normal_dicts
            }, f, ensure_ascii=False, indent=2)

        with open(args.output_problem, 'w', encoding='utf-8') as f:
            json.dump({
                "summary": summary,
                "records": problem_dicts
            }, f, ensure_ascii=False, indent=2)

        print(json.dumps(summary, ensure_ascii=False, indent=2))
        print(f"\n正常记录已写入: {args.output_normal}")
        print(f"问题记录已写入: {args.output_problem}")

    else:
        print("\n" + "="*60)
        print("最优换汇路径API - 处理报告")
        print("="*60)
        print(f"总请求数: {summary['total_requests']}")
        print(f"正常记录: {summary['normal_count']}")
        print(f"问题记录: {summary['problem_count']}")
        print(f"\n风险分类统计:")
        for risk_type, count in summary["risk_breakdown"].items():
            print(f"  {risk_type}: {count} 条")

        print("\n" + "-"*60)
        print("【正常记录】")
        print("-"*60)
        for r in normal_dicts:
            print(f"\n[{r['record_id']}] {r['source_currency']}->{r['target_currency']}")
            print(f"  投入: {r['source_amount']} {r['source_currency']}")
            print(f"  到手: {r['final_amount']} {r['target_currency']}")
            print(f"  手续费: {r['total_fee']}")
            print(f"  路径: {'->'.join(r['path_currencies'])} ({r['steps']}步)")
            print(f"  综合汇率: {r['effective_rate']}")
            print(f"  业务解释: {r['business_explanation']}")
            if r['manual_overrides']:
                print(f"  人工修正: {len(r['manual_overrides'])} 条")

        if problem_dicts:
            print("\n" + "-"*60)
            print("【问题记录 - 需人工介入】")
            print("-"*60)
            for r in problem_dicts:
                print(f"\n[{r['record_id']}] {r['source_currency']}->{r['target_currency']}")
                print(f"  投入: {r['source_amount']} {r['source_currency']}")
                print(f"  问题数: {len(r['issues'])}")
                for issue in r['issues']:
                    print(f"    [{issue['risk_type']}/{issue['severity']}] {issue['message']}")
                    print(f"      业务解释: {issue['business_explanation']}")
                if r['manual_overrides']:
                    print(f"  人工修正: {len(r['manual_overrides'])} 条")

    print("\n[执行完成] 正常记录与问题记录已分离输出，请重点关注问题记录中的风险项")


if __name__ == "__main__":
    main()
