from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class WalletType(str, Enum):
    BTC = "BTC"
    ETH = "ETH"
    SOL = "SOL"


class MinerInfo(BaseModel):
    miner_id: str = Field(..., description="矿工唯一标识")
    wallet_address: str = Field(..., description="钱包地址")
    wallet_type: WalletType = Field(..., description="钱包类型")
    miner_name: Optional[str] = Field(None, description="矿工名称")


class HashrateRecord(BaseModel):
    miner_id: str = Field(..., description="矿工ID")
    hashrate: float = Field(..., gt=0, description="算力（MH/s）")
    timestamp: datetime = Field(..., description="记录时间")
    source: Optional[str] = Field(None, description="数据来源")


class OnlineRecord(BaseModel):
    miner_id: str = Field(..., description="矿工ID")
    start_time: datetime = Field(..., description="上线时间")
    end_time: Optional[datetime] = Field(None, description="下线时间（None表示在线）")
    is_online: bool = Field(True, description="是否在线")


class BlockReward(BaseModel):
    block_number: int = Field(..., description="区块高度")
    reward_amount: float = Field(..., gt=0, description="区块奖励数量")
    fee_amount: float = Field(..., description="手续费数量（允许负数，系统会自动取绝对值处理）")
    timestamp: datetime = Field(..., description="区块时间")
    coin_type: WalletType = Field(..., description="币种")


class AllocationIssue(BaseModel):
    issue_type: str = Field(..., description="问题类型")
    severity: str = Field(..., description="严重程度: warning/error")
    message: str = Field(..., description="问题描述")
    miner_id: Optional[str] = Field(None, description="关联矿工ID")
    details: Optional[Dict] = Field(None, description="详细信息")


class MinerAllocation(BaseModel):
    miner_id: str = Field(..., description="矿工ID")
    wallet_address: str = Field(..., description="钱包地址")
    wallet_valid: bool = Field(..., description="钱包是否有效")
    total_hashrate: float = Field(..., description="总算力（MH/s）")
    effective_hashrate: float = Field(..., description="有效算力（MH/s）")
    online_duration: float = Field(..., description="在线时长（小时）")
    online_ratio: float = Field(..., description="在线率")
    hashrate_weight: float = Field(..., description="算力权重")
    time_weight: float = Field(..., description="时间权重")
    total_weight: float = Field(..., description="总权重")
    weight_ratio: float = Field(..., description="权重占比")
    base_reward: float = Field(..., description="基础奖励")
    fee_allocation: float = Field(..., description="手续费分配")
    total_allocation: float = Field(..., description="总分配金额")
    issues: List[AllocationIssue] = Field(default_factory=list, description="分配问题列表")


class AllocationReport(BaseModel):
    report_id: str = Field(..., description="报告ID")
    created_at: datetime = Field(..., description="生成时间")
    period_start: datetime = Field(..., description="统计开始时间")
    period_end: datetime = Field(..., description="统计结束时间")
    total_miners: int = Field(..., description="矿工总数")
    valid_miners: int = Field(..., description="有效矿工数")
    total_hashrate: float = Field(..., description="总算力")
    total_reward: float = Field(..., description="总奖励")
    total_fees: float = Field(..., description="总手续费")
    pool_fee_ratio: float = Field(..., description="矿池手续费比例")
    pool_fee_amount: float = Field(..., description="矿池手续费金额")
    allocatable_amount: float = Field(..., description="可分配总金额")
    allocations: List[MinerAllocation] = Field(..., description="矿工分配明细")
    global_issues: List[AllocationIssue] = Field(default_factory=list, description="全局问题")
    summary: Dict[str, float] = Field(default_factory=dict, description="汇总数据")


class AllocationRequest(BaseModel):
    miners: List[MinerInfo] = Field(..., description="矿工列表")
    hashrate_records: List[HashrateRecord] = Field(..., description="算力记录")
    online_records: List[OnlineRecord] = Field(..., description="在线记录")
    block_rewards: List[BlockReward] = Field(..., description="区块奖励")
    period_start: datetime = Field(..., description="统计开始时间")
    period_end: datetime = Field(..., description="统计结束时间")
    pool_fee_ratio: float = Field(0.02, ge=0, le=1, description="矿池手续费比例")


class DiffExplainRequest(BaseModel):
    expected_amount: float = Field(..., description="用户预期金额")
    actual_amount: float = Field(..., description="实际分配金额")
    miner_id: str = Field(..., description="矿工ID")
    report_id: str = Field(..., description="报告ID")


class DiffItem(BaseModel):
    factor: str = Field(..., description="影响因素")
    impact_amount: float = Field(..., description="影响金额")
    explanation: str = Field(..., description="解释说明")


class DiffExplainResponse(BaseModel):
    miner_id: str = Field(..., description="矿工ID")
    expected_amount: float = Field(..., description="预期金额")
    actual_amount: float = Field(..., description="实际金额")
    total_diff: float = Field(..., description="总差额")
    diff_items: List[DiffItem] = Field(..., description="差额明细")
    conclusion: str = Field(..., description="结论")
