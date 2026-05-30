import numpy as np
import scipy.stats as stats
import time
import traceback
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class PricingParameters:
    option_type: str
    S0: float
    K: float
    r: float
    sigma: float
    T: float
    q: float = 0.0
    seed: Optional[int] = None
    num_simulations: int = 10000
    num_steps: int = 252
    confidence_level: float = 0.95
    apply_discount: bool = True

@dataclass
class SimulationResult:
    final_prices: np.ndarray
    payoffs: np.ndarray
    discounted_payoffs: np.ndarray
    paths: Optional[np.ndarray]
    actual_seed: int
    calculation_time_ms: float

@dataclass
class PricingStatistics:
    option_price: float
    standard_error: float
    ci_lower: float
    ci_upper: float
    discount_factor: float
    expected_payoff: float
    variance: float
    skewness: float
    kurtosis: float
    discount_method: str
    confidence_level: float

class MonteCarloPricer:
    def __init__(self):
        self._rng = np.random.RandomState()

    def _generate_seed(self, user_seed: Optional[int] = None) -> int:
        if user_seed is not None:
            return user_seed
        return np.random.randint(0, 2**31 - 1)

    def simulate_paths(self, params: PricingParameters, store_paths: bool = False) -> SimulationResult:
        start_time = time.time()
        
        actual_seed = self._generate_seed(params.seed)
        self._rng.seed(actual_seed)
        
        dt = params.T / params.num_steps
        drift = (params.r - params.q - 0.5 * params.sigma**2) * dt
        diffusion = params.sigma * np.sqrt(dt)
        
        if store_paths:
            paths = np.zeros((params.num_simulations, params.num_steps + 1))
            paths[:, 0] = params.S0
            for t in range(1, params.num_steps + 1):
                Z = self._rng.standard_normal(params.num_simulations)
                paths[:, t] = paths[:, t-1] * np.exp(drift + diffusion * Z)
            final_prices = paths[:, -1]
        else:
            Z = self._rng.standard_normal(params.num_simulations)
            final_prices = params.S0 * np.exp(
                (params.r - params.q - 0.5 * params.sigma**2) * params.T +
                params.sigma * np.sqrt(params.T) * Z
            )
            paths = None
        
        if params.option_type.lower() == 'call':
            payoffs = np.maximum(final_prices - params.K, 0)
        elif params.option_type.lower() == 'put':
            payoffs = np.maximum(params.K - final_prices, 0)
        else:
            raise ValueError(f"Unknown option type: {params.option_type}")
        
        discount_factor = np.exp(-params.r * params.T) if params.apply_discount else 1.0
        discounted_payoffs = payoffs * discount_factor
        
        calculation_time_ms = (time.time() - start_time) * 1000
        
        return SimulationResult(
            final_prices=final_prices,
            payoffs=payoffs,
            discounted_payoffs=discounted_payoffs,
            paths=paths,
            actual_seed=actual_seed,
            calculation_time_ms=calculation_time_ms
        )

    def calculate_statistics(self, sim_result: SimulationResult, params: PricingParameters) -> PricingStatistics:
        discounted_payoffs = sim_result.discounted_payoffs
        n = len(discounted_payoffs)
        
        option_price = np.mean(discounted_payoffs)
        variance = np.var(discounted_payoffs, ddof=1)
        standard_error = np.sqrt(variance / n)
        
        z_score = stats.norm.ppf((1 + params.confidence_level) / 2)
        ci_lower = option_price - z_score * standard_error
        ci_upper = option_price + z_score * standard_error
        
        discount_factor = np.exp(-params.r * params.T) if params.apply_discount else 1.0
        expected_payoff = np.mean(sim_result.payoffs)
        
        skewness = stats.skew(discounted_payoffs)
        kurtosis = stats.kurtosis(discounted_payoffs)
        
        discount_method = "continuous_compounding" if params.apply_discount else "no_discount"
        
        return PricingStatistics(
            option_price=float(option_price),
            standard_error=float(standard_error),
            ci_lower=float(ci_lower),
            ci_upper=float(ci_upper),
            discount_factor=float(discount_factor),
            expected_payoff=float(expected_payoff),
            variance=float(variance),
            skewness=float(skewness),
            kurtosis=float(kurtosis),
            discount_method=discount_method,
            confidence_level=params.confidence_level
        )

    def price(self, params: PricingParameters, store_paths: bool = False) -> Tuple[SimulationResult, PricingStatistics]:
        sim_result = self.simulate_paths(params, store_paths)
        stats_result = self.calculate_statistics(sim_result, params)
        return sim_result, stats_result

class PricingErrorAnalyzer:
    @staticmethod
    def analyze_error_sources(params: PricingParameters, stats: PricingStatistics) -> Dict:
        return {
            "standard_error": stats.standard_error,
            "relative_error": stats.standard_error / stats.option_price if stats.option_price > 0 else float('inf'),
            "confidence_interval_width": stats.ci_upper - stats.ci_lower,
            "ci_relative_width": (stats.ci_upper - stats.ci_lower) / stats.option_price if stats.option_price > 0 else float('inf'),
            "variance_reduction_opportunities": {
                "antithetic_variates": "可用: 生成正负配对随机数",
                "control_variates": "可用: 使用Black-Scholes作为控制变量",
                "importance_sampling": "建议: 对于深度价外期权"
            },
            "convergence_assessment": {
                "n_simulations": params.num_simulations,
                "required_n_for_1pct_error": int(np.ceil((stats.standard_error * 100)**2)) if stats.option_price > 0 else None,
                "current_error_tolerance": f"{stats.standard_error / stats.option_price * 100:.2f}%" if stats.option_price > 0 else "N/A"
            }
        }

    @staticmethod
    def check_missing_discount(params: PricingParameters) -> Dict:
        if not params.apply_discount:
            return {
                "issue": "missing_discount",
                "severity": "high",
                "description": "未应用贴现因子，价格为到期日预期收益而非现值",
                "theoretical_discount_factor": np.exp(-params.r * params.T),
                "price_adjustment_needed": "需要乘以贴现因子得到现值"
            }
        return {"issue": None}

    @staticmethod
    def check_confidence_interval_interpretation(ci_lower: float, ci_upper: float, confidence_level: float = 0.95, true_value: Optional[float] = None) -> Dict:
        return {
            "ci_interpretation": f"我们有{int(confidence_level * 100)}%的信心认为真实价格落在[{ci_lower:.4f}, {ci_upper:.4f}]区间内",
            "common_misinterpretations": [
                "❌ 错误: '真实价格有95%概率落在这个区间内' (频率学派视角下真实价格是固定值)",
                "✅ 正确: '如果重复抽样，95%的区间会包含真实价格'",
                "⚠️ 注意: 这不是对单次区间的概率陈述，而是对方法的长期覆盖率陈述"
            ],
            "contains_true_value": true_value is not None and ci_lower <= true_value <= ci_upper if true_value else None
        }

def format_exception_for_storage(e: Exception) -> Dict:
    return {
        "exception_type": type(e).__name__,
        "error_message": str(e),
        "stack_trace": traceback.format_exc(),
        "is_recoverable": not isinstance(e, (ValueError, TypeError, KeyError))
    }
