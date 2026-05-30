from typing import List, Dict, Tuple, Set
from datetime import datetime, timedelta
from collections import defaultdict
import uuid

from models import (
    MinerInfo, HashrateRecord, OnlineRecord, BlockReward,
    MinerAllocation, AllocationReport, AllocationIssue, AllocationRequest
)
from wallet_validator import WalletValidator


class RewardAllocator:
    def __init__(self):
        self.issues: List[AllocationIssue] = []
        self.processed_miners: Set[str] = set()

    def _add_issue(self, issue_type: str, severity: str, message: str, 
                   miner_id: str = None, details: Dict = None):
        self.issues.append(AllocationIssue(
            issue_type=issue_type,
            severity=severity,
            message=message,
            miner_id=miner_id,
            details=details
        ))

    def _calculate_period_hours(self, start: datetime, end: datetime) -> float:
        return max(0.0, (end - start).total_seconds() / 3600.0)

    def _process_hashrate_records(self, records: List[HashrateRecord], 
                                   period_start: datetime, period_end: datetime,
                                   miner_ids: Set[str]) -> Tuple[Dict[str, List[Tuple[datetime, float]]], Dict[str, float]]:
        hashrate_by_miner = defaultdict(list)
        seen_timestamps: Dict[Tuple[str, datetime], int] = defaultdict(int)
        
        for record in records:
            if record.miner_id not in miner_ids:
                self._add_issue(
                    issue_type="unknown_miner",
                    severity="warning",
                    message=f"发现未知矿工的算力记录，已忽略",
                    miner_id=record.miner_id,
                    details={"hashrate": record.hashrate, "timestamp": record.timestamp.isoformat()}
                )
                continue
            
            if not (period_start <= record.timestamp <= period_end):
                continue
            
            key = (record.miner_id, record.timestamp.replace(microsecond=0))
            seen_timestamps[key] += 1
            
            if seen_timestamps[key] > 1:
                self._add_issue(
                    issue_type="duplicate_hashrate",
                    severity="warning",
                    message=f"发现重复算力记录，取平均值处理",
                    miner_id=record.miner_id,
                    details={"timestamp": record.timestamp.isoformat(), "duplicate_count": seen_timestamps[key]}
                )
                continue
            
            hashrate_by_miner[record.miner_id].append((record.timestamp, record.hashrate))
        
        avg_hashrate_by_miner = {}
        for miner_id, hr_list in hashrate_by_miner.items():
            if not hr_list:
                avg_hashrate_by_miner[miner_id] = 0.0
                continue
            
            sorted_hr = sorted(hr_list, key=lambda x: x[0])
            total_weighted_hr = 0.0
            total_weight = 0.0
            
            for i, (ts, hr) in enumerate(sorted_hr):
                if i < len(sorted_hr) - 1:
                    weight = (sorted_hr[i+1][0] - ts).total_seconds()
                else:
                    weight = (period_end - ts).total_seconds()
                
                total_weighted_hr += hr * max(0, weight)
                total_weight += max(0, weight)
            
            if total_weight > 0:
                avg_hashrate_by_miner[miner_id] = total_weighted_hr / total_weight
            else:
                avg_hashrate_by_miner[miner_id] = sum(hr for _, hr in sorted_hr) / len(sorted_hr)
        
        return hashrate_by_miner, avg_hashrate_by_miner

    def _process_online_records(self, records: List[OnlineRecord], 
                                 period_start: datetime, period_end: datetime,
                                 miner_ids: Set[str]) -> Dict[str, float]:
        online_duration_by_miner = defaultdict(float)
        period_hours = self._calculate_period_hours(period_start, period_end)
        
        miner_records: Dict[str, List[OnlineRecord]] = defaultdict(list)
        for record in records:
            if record.miner_id in miner_ids:
                miner_records[record.miner_id].append(record)
        
        for miner_id in miner_ids:
            miner_online_records = miner_records.get(miner_id, [])
            
            if not miner_online_records:
                self._add_issue(
                    issue_type="no_online_record",
                    severity="warning",
                    message=f"矿工无在线记录，按离线处理",
                    miner_id=miner_id
                )
                online_duration_by_miner[miner_id] = 0.0
                continue
            
            total_online_seconds = 0.0
            gaps_found = 0
            
            sorted_records = sorted(miner_online_records, key=lambda x: x.start_time)
            
            for i, record in enumerate(sorted_records):
                actual_start = max(record.start_time, period_start)
                if record.end_time:
                    actual_end = min(record.end_time, period_end)
                else:
                    actual_end = period_end
                
                if actual_end > actual_start:
                    duration = (actual_end - actual_start).total_seconds()
                    total_online_seconds += duration
                
                if i < len(sorted_records) - 1:
                    gap = (sorted_records[i+1].start_time - (record.end_time or period_end)).total_seconds()
                    if gap > 60:
                        gaps_found += 1
            
            if gaps_found > 0:
                self._add_issue(
                    issue_type="online_gaps",
                    severity="warning",
                    message=f"在线记录存在{gaps_found}处时间缺口",
                    miner_id=miner_id,
                    details={"gap_count": gaps_found}
                )
            
            online_duration_by_miner[miner_id] = total_online_seconds / 3600.0
        
        return online_duration_by_miner

    def _calculate_block_rewards(self, rewards: List[BlockReward], 
                                  period_start: datetime, period_end: datetime) -> Tuple[float, float]:
        total_reward = 0.0
        total_fees = 0.0
        fee_direction_issues = 0
        
        for reward in rewards:
            if not (period_start <= reward.timestamp <= period_end):
                continue
            
            if reward.fee_amount < 0:
                fee_direction_issues += 1
                self._add_issue(
                    issue_type="negative_fee",
                    severity="error",
                    message=f"区块#{reward.block_number}手续费为负，取绝对值处理",
                    details={"block_number": reward.block_number, "fee_amount": reward.fee_amount}
                )
            
            total_reward += reward.reward_amount
            total_fees += abs(reward.fee_amount)
        
        return total_reward, total_fees

    def allocate(self, request: AllocationRequest) -> AllocationReport:
        self.issues = []
        self.processed_miners = set()
        
        miner_ids = {m.miner_id for m in request.miners}
        period_hours = self._calculate_period_hours(request.period_start, request.period_end)
        
        if period_hours <= 0:
            self._add_issue(
                issue_type="invalid_period",
                severity="error",
                message="统计周期无效（结束时间不晚于开始时间）"
            )
            period_hours = 1.0
        
        hashrate_by_miner, avg_hashrate_by_miner = self._process_hashrate_records(
            request.hashrate_records, request.period_start, request.period_end, miner_ids
        )
        
        online_duration_by_miner = self._process_online_records(
            request.online_records, request.period_start, request.period_end, miner_ids
        )
        
        total_reward, total_fees = self._calculate_block_rewards(
            request.block_rewards, request.period_start, request.period_end
        )
        
        pool_fee_amount = (total_reward + total_fees) * request.pool_fee_ratio
        allocatable_amount = total_reward + total_fees - pool_fee_amount
        
        miner_allocations: List[MinerAllocation] = []
        total_effective_hashrate = 0.0
        total_weight = 0.0
        weights_by_miner = {}
        
        for miner in request.miners:
            miner_id = miner.miner_id
            miner_issues: List[AllocationIssue] = []
            
            wallet_valid, wallet_msg = WalletValidator.validate_address(
                miner.wallet_address, miner.wallet_type
            )
            if not wallet_valid:
                miner_issues.append(AllocationIssue(
                    issue_type="invalid_wallet",
                    severity="error",
                    message=f"钱包地址无效: {wallet_msg}",
                    miner_id=miner_id
                ))
            
            total_hashrate = avg_hashrate_by_miner.get(miner_id, 0.0)
            online_duration = online_duration_by_miner.get(miner_id, 0.0)
            online_ratio = online_duration / period_hours if period_hours > 0 else 0.0
            
            if online_ratio < 0.95:
                miner_issues.append(AllocationIssue(
                    issue_type="low_uptime",
                    severity="warning",
                    message=f"在线率低于95%: {online_ratio*100:.1f}%",
                    miner_id=miner_id,
                    details={"online_ratio": online_ratio, "required_ratio": 0.95}
                ))
            
            effective_hashrate = total_hashrate * online_ratio
            
            if not wallet_valid:
                effective_hashrate = 0.0
                miner_issues.append(AllocationIssue(
                    issue_type="wallet_invalid_penalty",
                    severity="error",
                    message="钱包无效，算力不计入分配",
                    miner_id=miner_id
                ))
            
            hashrate_weight = effective_hashrate
            time_weight = online_ratio
            miner_total_weight = hashrate_weight * (0.8 + 0.2 * time_weight)
            
            weights_by_miner[miner_id] = {
                'total_hashrate': total_hashrate,
                'effective_hashrate': effective_hashrate,
                'online_duration': online_duration,
                'online_ratio': online_ratio,
                'hashrate_weight': hashrate_weight,
                'time_weight': time_weight,
                'total_weight': miner_total_weight,
                'wallet_valid': wallet_valid,
                'issues': miner_issues
            }
            
            total_effective_hashrate += effective_hashrate
            total_weight += miner_total_weight
        
        global_issues = self.issues.copy()
        
        for miner in request.miners:
            miner_id = miner.miner_id
            w = weights_by_miner[miner_id]
            
            if total_weight > 0:
                weight_ratio = w['total_weight'] / total_weight
            else:
                weight_ratio = 0.0
                if w['total_weight'] > 0:
                    global_issues.append(AllocationIssue(
                        issue_type="zero_total_weight",
                        severity="error",
                        message="总算力权重为零，无法分配",
                        miner_id=miner_id
                    ))
            
            base_reward = allocatable_amount * weight_ratio
            fee_allocation = base_reward * (total_fees / (total_reward + total_fees)) if (total_reward + total_fees) > 0 else 0
            
            allocation = MinerAllocation(
                miner_id=miner_id,
                wallet_address=miner.wallet_address,
                wallet_valid=w['wallet_valid'],
                total_hashrate=w['total_hashrate'],
                effective_hashrate=w['effective_hashrate'],
                online_duration=w['online_duration'],
                online_ratio=w['online_ratio'],
                hashrate_weight=w['hashrate_weight'],
                time_weight=w['time_weight'],
                total_weight=w['total_weight'],
                weight_ratio=weight_ratio,
                base_reward=base_reward,
                fee_allocation=fee_allocation,
                total_allocation=base_reward,
                issues=w['issues']
            )
            miner_allocations.append(allocation)
        
        report_id = str(uuid.uuid4())[:8]
        
        return AllocationReport(
            report_id=report_id,
            created_at=datetime.now(),
            period_start=request.period_start,
            period_end=request.period_end,
            total_miners=len(request.miners),
            valid_miners=sum(1 for a in miner_allocations if a.wallet_valid and a.effective_hashrate > 0),
            total_hashrate=sum(a.total_hashrate for a in miner_allocations),
            total_reward=total_reward,
            total_fees=total_fees,
            pool_fee_ratio=request.pool_fee_ratio,
            pool_fee_amount=pool_fee_amount,
            allocatable_amount=allocatable_amount,
            allocations=miner_allocations,
            global_issues=global_issues,
            summary={
                "period_hours": period_hours,
                "avg_online_ratio": sum(a.online_ratio for a in miner_allocations) / len(miner_allocations) if miner_allocations else 0,
                "total_effective_hashrate": total_effective_hashrate,
                "total_weight": total_weight
            }
        )
