import math
from dataclasses import dataclass, field
from typing import Optional, List, Dict


@dataclass
class QueueResult:
    record_id: str
    source: str
    calculation_method: str
    success: bool
    error_reason: Optional[str] = None
    
    arrival_rate: Optional[float] = None
    service_rate: Optional[float] = None
    num_servers: Optional[int] = None
    
    rho: Optional[float] = None
    P0: Optional[float] = None
    Lq: Optional[float] = None
    L: Optional[float] = None
    Wq: Optional[float] = None
    W: Optional[float] = None
    P_wait: Optional[float] = None
    
    requires_manual_review: bool = False
    review_notes: Optional[str] = None
    legacy_calculation: bool = False
    
    formula_references: Dict[str, str] = field(default_factory=dict)
    units: Dict[str, str] = field(default_factory=dict)


class MMcQueueModel:
    """
    M/M/c 排队模型 - 多服务台排队系统
    适用于港口泊位排队模拟
    
    公式来源: 运营管理教材 - 排队论章节
    """
    
    FORMULA_REFERENCES = {
        'rho': 'ρ = λ / (c * μ) - 服务强度',
        'P0': 'P0 = 1 / [Σ((λ/μ)^n / n!) for n=0 to c-1 + ((λ/μ)^c / c!) * (1/(1-ρ))] - 系统空闲概率',
        'P_wait': 'Pw = ((λ/μ)^c / c!) * P0 / (1 - ρ) - 需要等待的概率',
        'Lq': 'Lq = P0 * ((λ/μ)^c * ρ) / (c! * (1 - ρ)^2) - 排队等待的平均船舶数',
        'L': 'L = Lq + λ/μ - 系统中的平均船舶数',
        'Wq': 'Wq = Lq / λ - 平均排队等待时间',
        'W': 'W = Wq + 1/μ - 系统平均逗留时间'
    }
    
    UNITS = {
        'arrival_rate': '艘/小时',
        'service_rate': '艘/小时',
        'rho': '无量纲',
        'P0': '概率',
        'Lq': '艘',
        'L': '艘',
        'Wq': '小时',
        'W': '小时',
        'P_wait': '概率'
    }
    
    BOUNDARY_LIMITS = {
        'arrival_rate_min': 0.1,
        'arrival_rate_max': 100.0,
        'service_rate_min': 0.1,
        'service_rate_max': 50.0,
        'num_servers_min': 1,
        'num_servers_max': 50,
        'rho_stable_max': 0.95,
        'rho_warning_min': 0.7
    }
    
    @classmethod
    def calculate(cls, record_id: str, source: str, 
                  arrival_rate: float, service_rate: float, num_servers: int,
                  legacy_mode: bool = False) -> QueueResult:
        """
        计算 M/M/c 排队模型
        
        参数:
            record_id: 记录ID，用于追溯
            source: 数据来源说明
            arrival_rate: 到达率 λ (艘/小时)
            service_rate: 服务率 μ (艘/小时)
            num_servers: 泊位数量 c
            legacy_mode: 是否使用旧口径计算
        """
        result = QueueResult(
            record_id=record_id,
            source=source,
            calculation_method='M/M/c排队模型' + ('(旧口径)' if legacy_mode else ''),
            success=False,
            arrival_rate=arrival_rate,
            service_rate=service_rate,
            num_servers=num_servers,
            formula_references=cls.FORMULA_REFERENCES.copy(),
            units=cls.UNITS.copy()
        )
        
        if legacy_mode:
            return cls._calculate_legacy(result)
        
        validation = cls._validate_inputs(arrival_rate, service_rate, num_servers)
        if not validation['valid']:
            result.error_reason = validation['reason']
            return result
        
        if validation['warning']:
            result.requires_manual_review = True
            result.review_notes = validation['warning_reason']
        
        try:
            rho = arrival_rate / (num_servers * service_rate)
            
            if rho >= 1:
                result.error_reason = f'系统不稳定: ρ={rho:.4f} ≥ 1，队列将无限增长'
                result.rho = rho
                return result
            
            a = arrival_rate / service_rate
            
            P0 = cls._calculate_P0(a, num_servers, rho)
            P_wait = cls._calculate_P_wait(a, num_servers, P0, rho)
            Lq = cls._calculate_Lq(a, num_servers, P0, rho)
            L = Lq + arrival_rate / service_rate
            Wq = Lq / arrival_rate
            W = Wq + 1 / service_rate
            
            result.rho = rho
            result.P0 = P0
            result.Lq = Lq
            result.L = L
            result.Wq = Wq
            result.W = W
            result.P_wait = P_wait
            result.success = True
            
            if rho > cls.BOUNDARY_LIMITS['rho_warning_min']:
                result.requires_manual_review = True
                warning_level = '接近' if rho <= cls.BOUNDARY_LIMITS['rho_stable_max'] else '超过'
                result.review_notes = (result.review_notes + '; ' if result.review_notes else '') + \
                    f'服务强度ρ={rho:.4f}{warning_level}稳定上限0.95，需人工确认'
            
            return result
            
        except Exception as e:
            result.error_reason = f'计算异常: {str(e)}'
            return result
    
    @classmethod
    def _calculate_legacy(cls, result: QueueResult) -> QueueResult:
        """旧口径计算方法（课堂讲义历史版本）"""
        result.legacy_calculation = True
        
        try:
            lambda_ = result.arrival_rate
            mu = result.service_rate
            c = result.num_servers
            
            if lambda_ <= 0 or mu <= 0 or c <= 0:
                result.error_reason = '旧口径: 参数必须大于0'
                return result
            
            rho = lambda_ / (c * mu)
            if rho >= 1:
                result.error_reason = f'旧口径: 系统不稳定 ρ={rho:.4f} ≥ 1'
                result.rho = rho
                return result
            
            a = lambda_ / mu
            
            P0 = cls._calculate_P0_legacy(a, c)
            P_wait = cls._calculate_P_wait_legacy(a, c, P0)
            Lq = cls._calculate_Lq_legacy(a, c, P0, rho)
            L = Lq + lambda_ / mu
            Wq = Lq / lambda_
            W = Wq + 1 / mu
            
            result.rho = rho
            result.P0 = P0
            result.Lq = Lq
            result.L = L
            result.Wq = Wq
            result.W = W
            result.P_wait = P_wait
            result.success = True
            result.requires_manual_review = True
            result.review_notes = '旧口径计算结果，建议使用新口径复核'
            
            return result
            
        except Exception as e:
            result.error_reason = f'旧口径计算异常: {str(e)}'
            return result
    
    @staticmethod
    def _validate_inputs(arrival_rate: float, service_rate: float, num_servers: int) -> Dict:
        limits = MMcQueueModel.BOUNDARY_LIMITS
        warnings = []
        
        if arrival_rate is None or service_rate is None or num_servers is None:
            return {'valid': False, 'reason': '存在空值参数', 'warning': False}
        
        if arrival_rate <= 0:
            return {'valid': False, 'reason': f'到达率必须>0，当前值: {arrival_rate}', 'warning': False}
        if service_rate <= 0:
            return {'valid': False, 'reason': f'服务率必须>0，当前值: {service_rate}', 'warning': False}
        if num_servers <= 0:
            return {'valid': False, 'reason': f'泊位数量必须>0，当前值: {num_servers}', 'warning': False}
        
        if arrival_rate < limits['arrival_rate_min'] or arrival_rate > limits['arrival_rate_max']:
            warnings.append(f'到达率{arrival_rate}超出经验范围[{limits["arrival_rate_min"]}, {limits["arrival_rate_max"]}]')
        if service_rate < limits['service_rate_min'] or service_rate > limits['service_rate_max']:
            warnings.append(f'服务率{service_rate}超出经验范围[{limits["service_rate_min"]}, {limits["service_rate_max"]}]')
        if num_servers < limits['num_servers_min'] or num_servers > limits['num_servers_max']:
            warnings.append(f'泊位数量{num_servers}超出经验范围[{limits["num_servers_min"]}, {limits["num_servers_max"]}]')
        
        return {
            'valid': True,
            'reason': None,
            'warning': len(warnings) > 0,
            'warning_reason': '; '.join(warnings) if warnings else None
        }
    
    @staticmethod
    def _calculate_P0(a: float, c: int, rho: float) -> float:
        sum_terms = sum((a ** n) / math.factorial(n) for n in range(c))
        last_term = (a ** c) / (math.factorial(c) * (1 - rho))
        return 1 / (sum_terms + last_term)
    
    @staticmethod
    def _calculate_P_wait(a: float, c: int, P0: float, rho: float) -> float:
        return ((a ** c) / math.factorial(c)) * P0 / (1 - rho)
    
    @staticmethod
    def _calculate_Lq(a: float, c: int, P0: float, rho: float) -> float:
        return P0 * (a ** c) * rho / (math.factorial(c) * ((1 - rho) ** 2))
    
    @staticmethod
    def _calculate_P0_legacy(a: float, c: int) -> float:
        rho = a / c
        sum_terms = sum((a ** n) / math.factorial(n) for n in range(c))
        last_term = (a ** c) / (math.factorial(c) * (1 - rho))
        return 1 / (sum_terms + last_term)
    
    @staticmethod
    def _calculate_P_wait_legacy(a: float, c: int, P0: float) -> float:
        rho = a / c
        return ((a ** c) / math.factorial(c)) * P0 / (1 - rho)
    
    @staticmethod
    def _calculate_Lq_legacy(a: float, c: int, P0: float, rho: float) -> float:
        return P0 * (a ** c) * rho / (math.factorial(c) * ((1 - rho) ** 2))
