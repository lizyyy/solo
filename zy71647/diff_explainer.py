from typing import List, Dict, Optional
from models import DiffExplainRequest, DiffExplainResponse, DiffItem, AllocationReport


class DiffExplainer:
    @staticmethod
    def explain_diff(request: DiffExplainRequest, report: AllocationReport) -> DiffExplainResponse:
        miner_allocation = None
        for alloc in report.allocations:
            if alloc.miner_id == request.miner_id:
                miner_allocation = alloc
                break
        
        if not miner_allocation:
            return DiffExplainResponse(
                miner_id=request.miner_id,
                expected_amount=request.expected_amount,
                actual_amount=request.actual_amount,
                total_diff=request.actual_amount - request.expected_amount,
                diff_items=[
                    DiffItem(
                        factor="矿工不存在",
                        impact_amount=request.actual_amount - request.expected_amount,
                        explanation=f"在报告 {request.report_id} 中未找到矿工 {request.miner_id} 的分配记录"
                    )
                ],
                conclusion="无法找到该矿工的分配数据，请检查矿工ID是否正确"
            )
        
        diff_items: List[DiffItem] = []
        total_diff = request.actual_amount - request.expected_amount
        
        expected_hashrate = request.expected_amount / report.allocatable_amount * report.total_hashrate if report.allocatable_amount > 0 else 0
        hashrate_diff = miner_allocation.effective_hashrate - expected_hashrate
        if abs(hashrate_diff) > 0.001:
            hashrate_impact = hashrate_diff / report.total_hashrate * report.allocatable_amount if report.total_hashrate > 0 else 0
            diff_items.append(DiffItem(
                factor="算力差异",
                impact_amount=hashrate_impact,
                explanation=f"有效算力 {miner_allocation.effective_hashrate:.2f} MH/s 与预期 {expected_hashrate:.2f} MH/s 不同，"
                           f"差异主要来自: 时间加权在线率 {miner_allocation.online_ratio*100:.1f}%"
            ))
        
        if miner_allocation.online_ratio < 1.0:
            offline_impact = miner_allocation.total_hashrate * (1 - miner_allocation.online_ratio) / report.total_hashrate * report.allocatable_amount if report.total_hashrate > 0 else 0
            if abs(offline_impact) > 0.0001:
                diff_items.append(DiffItem(
                    factor="离线扣除",
                    impact_amount=-offline_impact,
                    explanation=f"在线时长 {miner_allocation.online_duration:.2f} 小时，在线率 {miner_allocation.online_ratio*100:.1f}%，"
                               f"低于100%导致算力打折"
                ))
        
        pool_fee_impact = request.expected_amount * report.pool_fee_ratio / (1 - report.pool_fee_ratio) if report.pool_fee_ratio < 1 else 0
        if pool_fee_impact > 0.0001:
            diff_items.append(DiffItem(
                factor="矿池手续费",
                impact_amount=-pool_fee_impact,
                explanation=f"矿池收取 {report.pool_fee_ratio*100:.1f}% 手续费，金额 {report.pool_fee_amount:.6f}"
            ))
        
        if not miner_allocation.wallet_valid:
            wallet_impact = request.expected_amount
            diff_items.append(DiffItem(
                factor="钱包无效",
                impact_amount=-wallet_impact,
                explanation="钱包地址校验失败，收益被暂停发放"
            ))
        
        for issue in miner_allocation.issues:
            if issue.issue_type == "duplicate_hashrate":
                diff_items.append(DiffItem(
                    factor="重复算力记录",
                    impact_amount=0,
                    explanation="存在重复算力上报，系统已自动去重取平均"
                ))
        
        explained_amount = sum(item.impact_amount for item in diff_items)
        unexplained = total_diff - explained_amount
        if abs(unexplained) > 0.0001:
            diff_items.append(DiffItem(
                factor="其他因素",
                impact_amount=unexplained,
                explanation="包含计算精度、权重公式差异等其他影响因素"
            ))
        
        if total_diff >= 0:
            conclusion = f"实际收益比预期高 {total_diff:.6f}，主要原因是实际有效算力高于预期"
        else:
            reasons = []
            if not miner_allocation.wallet_valid:
                reasons.append("钱包无效导致暂停发放")
            elif miner_allocation.online_ratio < 0.95:
                reasons.append(f"在线率偏低({miner_allocation.online_ratio*100:.1f}%)")
            else:
                reasons.append("算力权重计算差异")
            conclusion = f"实际收益比预期低 {abs(total_diff):.6f}，主要原因: {', '.join(reasons)}"
        
        return DiffExplainResponse(
            miner_id=request.miner_id,
            expected_amount=request.expected_amount,
            actual_amount=request.actual_amount,
            total_diff=total_diff,
            diff_items=diff_items,
            conclusion=conclusion
        )
