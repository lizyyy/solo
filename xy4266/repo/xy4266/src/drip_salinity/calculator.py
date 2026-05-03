"""计算规则模块 - 盐分回算算法和趋势预测"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum


class RiskLevel(str, Enum):
    """风险等级枚举"""
    SAFE = "安全"
    WARNING = "预警"
    DANGER = "危险"


@dataclass
class DailySaltBalance:
    """每日盐平衡计算结果"""
    record_date: date
    bed_id: str
    
    # 输入盐分
    input_salt_mass: float  # 输入盐分质量 (meq)
    input_irrigation_volume: float  # 灌溉体积 (L)
    input_irrigation_ec: float  # 灌溉EC (mS/cm)
    
    # 输出盐分
    output_salt_mass: float  # 输出盐分质量 (meq)
    output_drainage_volume: float  # 排液体积 (L)
    output_drainage_ec: float  # 排液EC (mS/cm)
    
    # 盐平衡
    net_salt_change: float  # 净盐分变化 (meq)
    drainage_ratio: float  # 排液率
    
    # 根区状态
    substrate_water_content: float  # 基质含水率 (%)
    estimated_root_ec: float  # 估算根区EC (mS/cm)
    
    # 累积指标
    cumulative_salt_change: float = 0.0  # 累积盐分变化
    days_since_last_flush: int = 0  # 距上次冲洗天数


@dataclass
class SaltTrend:
    """盐分趋势分析"""
    bed_id: str
    current_ec: float  # 当前根区EC
    ec_trend: str  # 趋势描述: "上升", "稳定", "下降"
    ec_change_rate: float  # EC变化速率 (mS/cm/天)
    risk_level: RiskLevel
    warning_days: int  # 距预警天数
    danger_days: int  # 距危险天数
    
    # 历史数据
    historical_ecs: List[Tuple[date, float]] = field(default_factory=list)
    last_7_days_avg_change: float = 0.0


@dataclass
class FlushingRequirement:
    """冲洗需求估算"""
    bed_id: str
    current_ec: float
    target_ec: float
    ec_reduction_needed: float
    
    # 未来3天预测
    day_1_forecast: float
    day_2_forecast: float
    day_3_forecast: float
    
    # 冲洗建议
    flushing_needed: bool
    recommended_flush_volume: float  # 建议冲洗量 (L/畦)
    recommended_flush_ec: float  # 建议冲洗液EC (mS/cm)
    urgency: str  # 紧急程度: "立即", "1天内", "2天内", "3天内", "不需要"
    
    # 风险评估
    risk_if_no_action: RiskLevel


class SaltCalculator:
    """盐分回算计算器"""
    
    # EC与盐分浓度的转换系数 (mS/cm -> meq/L)
    # 约 1 mS/cm = 10 meq/L (对于营养液)
    EC_TO_SALT_FACTOR = 10.0
    
    def __init__(self, substrate_volume: float, initial_ec: float = 2.5):
        """
        初始化计算器
        
        Args:
            substrate_volume: 基质体积 (L/畦)
            initial_ec: 初始根区EC (mS/cm)
        """
        self.substrate_volume = substrate_volume
        self.initial_ec = initial_ec
        
        # 状态追踪
        self._current_ec = initial_ec
        self._cumulative_salt_change = 0.0
        self._last_flush_date: Optional[date] = None
        
        # 历史记录
        self._history: List[DailySaltBalance] = []
    
    def calculate_daily_balance(self, 
                                 irrigation_volume: float,
                                 irrigation_ec: float,
                                 drainage_volume: float,
                                 drainage_ec: float,
                                 substrate_water_content: float,
                                 record_date: date,
                                 bed_id: str) -> DailySaltBalance:
        """
        计算每日盐平衡
        
        Args:
            irrigation_volume: 灌溉量 (L/畦)
            irrigation_ec: 灌溉EC (mS/cm)
            drainage_volume: 排液量 (L/畦)
            drainage_ec: 排液EC (mS/cm)
            substrate_water_content: 基质含水率 (%)
            record_date: 记录日期
            bed_id: 畦号
            
        Returns:
            DailySaltBalance 实例
        """
        # 计算输入盐分质量
        # 盐分质量 = 体积 × EC × 转换系数
        input_salt = irrigation_volume * irrigation_ec * self.EC_TO_SALT_FACTOR
        
        # 计算输出盐分质量
        output_salt = drainage_volume * drainage_ec * self.EC_TO_SALT_FACTOR
        
        # 净盐分变化
        net_change = input_salt - output_salt
        
        # 排液率
        drainage_ratio = drainage_volume / irrigation_volume if irrigation_volume > 0 else 0.0
        
        # 估算根区EC变化
        # 基于盐平衡和基质含水量估算
        # 简化模型: EC变化与净盐分变化成正比，与基质有效体积成反比
        
        # 有效水体积 = 基质体积 × 含水率
        effective_water_volume = self.substrate_volume * (substrate_water_content / 100.0)
        
        if effective_water_volume > 0:
            # 计算EC变化
            # ΔEC = Δ盐分质量 / (有效水体积 × 转换系数)
            ec_change = net_change / (effective_water_volume * self.EC_TO_SALT_FACTOR)
            
            # 应用变化（带阻尼因子，因为基质有缓冲能力）
            damping_factor = 0.7  # 缓冲因子，实际变化约为理论值的70%
            self._current_ec += ec_change * damping_factor
            
            # EC不能为负
            self._current_ec = max(0.1, self._current_ec)
        
        # 累积盐分变化
        self._cumulative_salt_change += net_change
        
        # 计算距上次冲洗天数
        days_since_flush = 0
        if self._last_flush_date:
            days_since_flush = (record_date - self._last_flush_date).days
        
        balance = DailySaltBalance(
            record_date=record_date,
            bed_id=bed_id,
            input_salt_mass=input_salt,
            input_irrigation_volume=irrigation_volume,
            input_irrigation_ec=irrigation_ec,
            output_salt_mass=output_salt,
            output_drainage_volume=drainage_volume,
            output_drainage_ec=drainage_ec,
            net_salt_change=net_change,
            drainage_ratio=drainage_ratio,
            substrate_water_content=substrate_water_content,
            estimated_root_ec=self._current_ec,
            cumulative_salt_change=self._cumulative_salt_change,
            days_since_last_flush=days_since_flush
        )
        
        self._history.append(balance)
        return balance
    
    def record_flush(self, flush_date: date):
        """记录冲洗操作"""
        self._last_flush_date = flush_date
        # 冲洗后重置部分状态（假设冲洗降低了EC）
        self._cumulative_salt_change = 0.0
    
    def get_trend_analysis(self, 
                           warning_threshold: float,
                           danger_threshold: float,
                           lookback_days: int = 7) -> SaltTrend:
        """
        分析盐分趋势
        
        Args:
            warning_threshold: 预警阈值EC
            danger_threshold: 危险阈值EC
            lookback_days: 回看天数
            
        Returns:
            SaltTrend 实例
        """
        if not self._history:
            return SaltTrend(
                bed_id="",
                current_ec=self._current_ec,
                ec_trend="无数据",
                ec_change_rate=0.0,
                risk_level=RiskLevel.SAFE,
                warning_days=999,
                danger_days=999
            )
        
        # 获取最近N天的历史数据
        recent_history = self._history[-lookback_days:] if len(self._history) >= lookback_days else self._history
        
        # 计算EC变化速率
        if len(recent_history) >= 2:
            first_ec = recent_history[0].estimated_root_ec
            last_ec = recent_history[-1].estimated_root_ec
            days = len(recent_history) - 1
            change_rate = (last_ec - first_ec) / days if days > 0 else 0.0
            
            # 7天平均变化
            if len(self._history) >= 7:
                last_7 = self._history[-7:]
                avg_change = sum(
                    last_7[i].estimated_root_ec - last_7[i-1].estimated_root_ec
                    for i in range(1, 7)
                ) / 6
            else:
                avg_change = change_rate
        else:
            change_rate = 0.0
            avg_change = 0.0
        
        # 判断趋势
        if change_rate > 0.1:
            trend = "快速上升"
        elif change_rate > 0.05:
            trend = "缓慢上升"
        elif change_rate < -0.1:
            trend = "快速下降"
        elif change_rate < -0.05:
            trend = "缓慢下降"
        else:
            trend = "稳定"
        
        # 评估风险等级
        current_ec = self._current_ec
        if current_ec >= danger_threshold:
            risk_level = RiskLevel.DANGER
        elif current_ec >= warning_threshold:
            risk_level = RiskLevel.WARNING
        else:
            risk_level = RiskLevel.SAFE
        
        # 计算距预警/危险天数
        warning_days = 999
        danger_days = 999
        
        if change_rate > 0:  # 只有上升趋势才需要计算
            if current_ec < warning_threshold:
                warning_days = int((warning_threshold - current_ec) / change_rate) if change_rate > 0 else 999
            
            if current_ec < danger_threshold:
                danger_days = int((danger_threshold - current_ec) / change_rate) if change_rate > 0 else 999
        
        # 历史EC数据
        historical_ecs = [
            (h.record_date, h.estimated_root_ec) 
            for h in self._history[-14:]  # 最多返回14天
        ]
        
        return SaltTrend(
            bed_id=self._history[0].bed_id if self._history else "",
            current_ec=current_ec,
            ec_trend=trend,
            ec_change_rate=change_rate,
            risk_level=risk_level,
            warning_days=max(0, warning_days),
            danger_days=max(0, danger_days),
            historical_ecs=historical_ecs,
            last_7_days_avg_change=avg_change
        )
    
    def forecast_flushing_need(self,
                               warning_threshold: float,
                               danger_threshold: float,
                               target_ec: float,
                               forecast_days: int = 3) -> FlushingRequirement:
        """
        预测未来冲洗需求
        
        Args:
            warning_threshold: 预警阈值
            danger_threshold: 危险阈值
            target_ec: 目标EC值
            forecast_days: 预测天数
            
        Returns:
            FlushingRequirement 实例
        """
        trend = self.get_trend_analysis(warning_threshold, danger_threshold)
        
        # 基于当前趋势预测未来EC
        current_ec = trend.current_ec
        change_rate = trend.last_7_days_avg_change
        
        # 如果变化率为负（下降趋势），使用0变化率进行保守预测
        forecast_rate = max(0, change_rate)
        
        day_1 = current_ec + forecast_rate
        day_2 = day_1 + forecast_rate
        day_3 = day_2 + forecast_rate
        
        # 判断是否需要冲洗
        flushing_needed = False
        urgency = "不需要"
        
        # 检查未来3天是否会超过阈值
        future_max = max(day_1, day_2, day_3)
        
        if current_ec >= danger_threshold:
            flushing_needed = True
            urgency = "立即"
        elif day_1 >= danger_threshold:
            flushing_needed = True
            urgency = "1天内"
        elif day_2 >= danger_threshold:
            flushing_needed = True
            urgency = "2天内"
        elif day_3 >= danger_threshold:
            flushing_needed = True
            urgency = "3天内"
        elif current_ec >= warning_threshold:
            flushing_needed = True
            urgency = "建议"
        
        # 计算EC需要降低的量
        ec_reduction_needed = max(0, current_ec - target_ec)
        
        # 估算需要的冲洗量
        # 简化模型：冲洗量 = 基质体积 × (需要降低的EC / 当前EC) × 经验系数
        # 经验系数约为2-3倍
        recommended_volume = 0.0
        if flushing_needed and ec_reduction_needed > 0:
            # 冲洗量估算：每降低1 mS/cm约需要基质体积的1-2倍水量
            volume_factor = 1.5  # 经验系数
            recommended_volume = self.substrate_volume * (ec_reduction_needed / current_ec) * volume_factor
            recommended_volume = max(recommended_volume, self.substrate_volume * 0.3)  # 最小冲洗量
        
        # 建议冲洗液EC（使用较低EC的水）
        recommended_flush_ec = max(0.5, target_ec * 0.5)  # 至少0.5 mS/cm
        
        # 评估不采取行动的风险
        risk_if_no_action = RiskLevel.SAFE
        if future_max >= danger_threshold:
            risk_if_no_action = RiskLevel.DANGER
        elif future_max >= warning_threshold:
            risk_if_no_action = RiskLevel.WARNING
        
        return FlushingRequirement(
            bed_id=trend.bed_id,
            current_ec=current_ec,
            target_ec=target_ec,
            ec_reduction_needed=ec_reduction_needed,
            day_1_forecast=day_1,
            day_2_forecast=day_2,
            day_3_forecast=day_3,
            flushing_needed=flushing_needed,
            recommended_flush_volume=round(recommended_volume, 1),
            recommended_flush_ec=round(recommended_flush_ec, 2),
            urgency=urgency,
            risk_if_no_action=risk_if_no_action
        )
    
    @property
    def current_ec(self) -> float:
        """获取当前估算的根区EC"""
        return self._current_ec
    
    @property
    def history(self) -> List[DailySaltBalance]:
        """获取历史记录"""
        return self._history.copy()


class MultiBedCalculator:
    """多畦计算器 - 管理多个畦的盐分计算"""
    
    def __init__(self, substrate_volume: float, initial_ec: float = 2.5):
        """
        初始化多畦计算器
        
        Args:
            substrate_volume: 单畦基质体积
            initial_ec: 初始EC值
        """
        self.substrate_volume = substrate_volume
        self.initial_ec = initial_ec
        self._calculators: Dict[str, SaltCalculator] = {}
    
    def get_or_create_calculator(self, bed_id: str) -> SaltCalculator:
        """获取或创建指定畦的计算器"""
        if bed_id not in self._calculators:
            self._calculators[bed_id] = SaltCalculator(
                self.substrate_volume,
                self.initial_ec
            )
        return self._calculators[bed_id]
    
    def process_record(self, record) -> DailySaltBalance:
        """
        处理单条记录
        
        Args:
            record: DailyRecord 实例
            
        Returns:
            DailySaltBalance 实例
        """
        calculator = self.get_or_create_calculator(record.bed_id)
        return calculator.calculate_daily_balance(
            irrigation_volume=record.irrigation_volume,
            irrigation_ec=record.irrigation_ec,
            drainage_volume=record.drainage_volume,
            drainage_ec=record.drainage_ec,
            substrate_water_content=record.substrate_water_content,
            record_date=record.record_date,
            bed_id=record.bed_id
        )
    
    def get_all_trends(self, warning_threshold: float, danger_threshold: float) -> Dict[str, SaltTrend]:
        """获取所有畦的趋势分析"""
        results = {}
        for bed_id, calculator in self._calculators.items():
            results[bed_id] = calculator.get_trend_analysis(
                warning_threshold,
                danger_threshold
            )
        return results
    
    def get_all_flushing_forecasts(self, 
                                    warning_threshold: float,
                                    danger_threshold: float,
                                    target_ec: float) -> Dict[str, FlushingRequirement]:
        """获取所有畦的冲洗预测"""
        results = {}
        for bed_id, calculator in self._calculators.items():
            results[bed_id] = calculator.forecast_flushing_need(
                warning_threshold,
                danger_threshold,
                target_ec
            )
        return results
    
    def get_bed_history(self, bed_id: str) -> Optional[List[DailySaltBalance]]:
        """获取指定畦的历史记录"""
        if bed_id in self._calculators:
            return self._calculators[bed_id].history
        return None
    
    @property
    def bed_ids(self) -> List[str]:
        """获取所有畦号"""
        return list(self._calculators.keys())
