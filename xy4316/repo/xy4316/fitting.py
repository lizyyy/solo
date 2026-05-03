import numpy as np
from typing import Dict, Tuple, List, Optional, Callable
from dataclasses import dataclass, field
from scipy.optimize import curve_fit
from scipy import stats
import warnings


@dataclass
class FittingResult:
    model_type: str
    params: np.ndarray
    param_names: List[str]
    covariance: np.ndarray
    residuals: np.ndarray
    r_squared: float
    adjusted_r_squared: float
    rmse: float
    mae: float
    
    pump_speed_range: Tuple[float, float]
    flow_rate_range: Tuple[float, float]
    
    param_errors: Optional[np.ndarray] = None
    confidence_level: float = 0.95
    
    def get_param_info(self) -> Dict[str, Dict]:
        info = {}
        for i, (name, value) in enumerate(zip(self.param_names, self.params)):
            info[name] = {
                'value': value,
                'std_error': np.sqrt(self.covariance[i, i]) if self.covariance is not None else None,
            }
        return info


@dataclass
class PumpSpeedRecommendation:
    target_flow_rate: float
    target_flow_rate_unit: str
    recommended_pump_speed: float
    pump_speed_unit: str
    
    lower_bound: float
    upper_bound: float
    confidence_level: float
    
    exceedance_probability: Optional[float] = None
    risk_assessment: str = ""
    
    additional_info: Dict = field(default_factory=dict)


class PumpFlowModel:
    def __init__(self):
        self.models = {
            'linear': self._linear_model,
            'quadratic': self._quadratic_model,
            'power': self._power_model,
            'exponential': self._exponential_model,
        }
        
        self.model_params = {
            'linear': ['slope', 'intercept'],
            'quadratic': ['a', 'b', 'c'],
            'power': ['a', 'b'],
            'exponential': ['a', 'b', 'c'],
        }
    
    @staticmethod
    def _linear_model(x, slope, intercept):
        return slope * x + intercept
    
    @staticmethod
    def _quadratic_model(x, a, b, c):
        return a * x**2 + b * x + c
    
    @staticmethod
    def _power_model(x, a, b):
        return a * x**b
    
    @staticmethod
    def _exponential_model(x, a, b, c):
        return a * np.exp(b * x) + c
    
    def get_model_function(self, model_type: str) -> Callable:
        if model_type not in self.models:
            raise ValueError(f"未知的模型类型: {model_type}")
        return self.models[model_type]
    
    def get_param_names(self, model_type: str) -> List[str]:
        if model_type not in self.model_params:
            raise ValueError(f"未知的模型类型: {model_type}")
        return self.model_params[model_type]
    
    def get_initial_guess(self, model_type: str, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        if len(x) < 2 or len(y) < 2:
            raise ValueError("数据点不足")
        
        slope = (y[-1] - y[0]) / (x[-1] - x[0]) if x[-1] != x[0] else 1.0
        intercept = y[0] - slope * x[0]
        
        if model_type == 'linear':
            return np.array([slope, intercept])
        elif model_type == 'quadratic':
            return np.array([0.01, slope, intercept])
        elif model_type == 'power':
            if np.any(x <= 0) or np.any(y <= 0):
                raise ValueError("幂函数模型要求x和y都为正数")
            x_log = np.log(x)
            y_log = np.log(y)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", np.RankWarning)
                coeffs = np.polyfit(x_log, y_log, 1)
            return np.array([np.exp(coeffs[1]), coeffs[0]])
        elif model_type == 'exponential':
            return np.array([1.0, 0.01, intercept])
        
        return np.array([slope, intercept])


class CurveFitter:
    def __init__(self):
        self.model = PumpFlowModel()
        self.default_confidence = 0.95
    
    def fit(
        self,
        pump_speed: np.ndarray,
        flow_rate: np.ndarray,
        model_type: str = 'linear',
        confidence_level: float = 0.95
    ) -> FittingResult:
        if len(pump_speed) != len(flow_rate):
            raise ValueError("泵速和流量数据长度不一致")
        
        if len(pump_speed) < 3:
            raise ValueError("至少需要3个数据点进行拟合")
        
        x = np.asarray(pump_speed, dtype=np.float64)
        y = np.asarray(flow_rate, dtype=np.float64)
        
        valid_mask = ~np.isnan(x) & ~np.isnan(y)
        x = x[valid_mask]
        y = y[valid_mask]
        
        if len(x) < 3:
            raise ValueError("有效数据点不足3个")
        
        model_func = self.model.get_model_function(model_type)
        param_names = self.model.get_param_names(model_type)
        
        try:
            p0 = self.model.get_initial_guess(model_type, x, y)
        except Exception as e:
            p0 = None
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                if p0 is not None:
                    params, covariance = curve_fit(
                        model_func, x, y, p0=p0,
                        maxfev=10000
                    )
                else:
                    params, covariance = curve_fit(
                        model_func, x, y,
                        maxfev=10000
                    )
            except RuntimeError as e:
                raise ValueError(f"拟合失败: {e}")
        
        y_pred = model_func(x, *params)
        residuals = y - y_pred
        
        ss_res = np.sum(residuals**2)
        ss_tot = np.sum((y - np.mean(y))**2)
        
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
        
        n = len(x)
        k = len(params)
        adjusted_r_squared = 1 - (1 - r_squared) * (n - 1) / (n - k - 1) if n > k + 1 else r_squared
        
        rmse = np.sqrt(np.mean(residuals**2))
        mae = np.mean(np.abs(residuals))
        
        param_errors = np.sqrt(np.diag(covariance)) if covariance is not None else None
        
        return FittingResult(
            model_type=model_type,
            params=params,
            param_names=param_names,
            covariance=covariance,
            residuals=residuals,
            r_squared=r_squared,
            adjusted_r_squared=adjusted_r_squared,
            rmse=rmse,
            mae=mae,
            pump_speed_range=(float(np.min(x)), float(np.max(x))),
            flow_rate_range=(float(np.min(y)), float(np.max(y))),
            param_errors=param_errors,
            confidence_level=confidence_level
        )
    
    def calculate_recommended_pump_speed(
        self,
        fitting_result: FittingResult,
        target_flow_rate: float,
        confidence_level: float = 0.95,
        pump_speed_bounds: Optional[Tuple[float, float]] = None
    ) -> PumpSpeedRecommendation:
        if target_flow_rate <= 0:
            raise ValueError("目标流量必须大于0")
        
        model_func = self.model.get_model_function(fitting_result.model_type)
        params = fitting_result.params
        
        x_min, x_max = fitting_result.pump_speed_range
        y_min, y_max = fitting_result.flow_rate_range
        
        if target_flow_rate < y_min or target_flow_rate > y_max:
            raise ValueError(
                f"目标流量 {target_flow_rate} 超出数据范围 [{y_min}, {y_max}]，"
                f"外推可能导致不准确结果"
            )
        
        if fitting_result.model_type == 'linear':
            slope, intercept = params
            if np.isclose(slope, 0):
                raise ValueError("流量不随泵速变化，无法计算推荐泵速")
            recommended_speed = (target_flow_rate - intercept) / slope
        else:
            from scipy.optimize import minimize_scalar
            
            def objective(x):
                if x <= 0:
                    return np.inf
                pred = model_func(x, *params)
                return (pred - target_flow_rate)**2
            
            search_min = x_min * 0.5 if x_min > 0 else 0.1
            search_max = x_max * 1.5
            
            result = minimize_scalar(
                objective,
                bracket=(search_min, search_max),
                method='brent'
            )
            
            if not result.success:
                raise ValueError(f"无法求解目标泵速: {result.message}")
            
            recommended_speed = result.x
        
        if pump_speed_bounds is None:
            pump_speed_bounds = (x_min, x_max)
        
        recommended_speed = np.clip(recommended_speed, pump_speed_bounds[0], pump_speed_bounds[1])
        
        n = len(fitting_result.residuals)
        k = len(params)
        df = n - k
        
        if df <= 0:
            t_critical = 1.96
        else:
            t_critical = stats.t.ppf((1 + confidence_level) / 2, df)
        
        residual_std = np.std(fitting_result.residuals, ddof=k)
        
        margin = t_critical * residual_std
        
        predicted_flow = model_func(recommended_speed, *params)
        
        relative_error = abs(predicted_flow - target_flow_rate) / target_flow_rate if target_flow_rate > 0 else 0
        
        if relative_error > 0.1:
            warnings.warn(f"流量预测误差较大: {relative_error*100:.1f}%")
        
        if fitting_result.model_type == 'linear':
            slope, intercept = params
            slope_error = np.sqrt(fitting_result.covariance[0, 0]) if fitting_result.covariance is not None else 0
            intercept_error = np.sqrt(fitting_result.covariance[1, 1]) if fitting_result.covariance is not None else 0
            
            flow_error = np.sqrt(
                (slope_error * recommended_speed)**2 + 
                intercept_error**2 +
                residual_std**2
            )
            
            lower_speed = (target_flow_rate - intercept - t_critical * flow_error) / slope
            upper_speed = (target_flow_rate - intercept + t_critical * flow_error) / slope
            
            if slope < 0:
                lower_speed, upper_speed = upper_speed, lower_speed
        else:
            lower_speed = recommended_speed * (1 - 0.1 * t_critical)
            upper_speed = recommended_speed * (1 + 0.1 * t_critical)
        
        lower_speed = max(lower_speed, pump_speed_bounds[0])
        upper_speed = min(upper_speed, pump_speed_bounds[1])
        
        z_score = margin / residual_std if residual_std > 0 else 1.96
        exceedance_prob = 2 * (1 - stats.norm.cdf(abs(z_score)))
        
        if exceedance_prob > 0.1:
            risk_assessment = "高风险：超限概率较高，建议增加校准点"
        elif exceedance_prob > 0.05:
            risk_assessment = "中风险：超限概率中等，建议关注"
        else:
            risk_assessment = "低风险：超限概率较低"
        
        return PumpSpeedRecommendation(
            target_flow_rate=target_flow_rate,
            target_flow_rate_unit='L/h',
            recommended_pump_speed=float(recommended_speed),
            pump_speed_unit='Hz',
            lower_bound=float(lower_speed),
            upper_bound=float(upper_speed),
            confidence_level=confidence_level,
            exceedance_probability=float(exceedance_prob),
            risk_assessment=risk_assessment,
            additional_info={
                'predicted_flow': float(predicted_flow),
                'relative_error_percent': float(relative_error * 100),
                'residual_std': float(residual_std),
                't_critical': float(t_critical),
                'margin_of_error': float(margin),
            }
        )
    
    def compare_models(
        self,
        pump_speed: np.ndarray,
        flow_rate: np.ndarray,
        models: List[str] = None,
        confidence_level: float = 0.95
    ) -> Dict[str, FittingResult]:
        if models is None:
            models = ['linear', 'quadratic', 'power']
        
        results = {}
        for model_type in models:
            try:
                results[model_type] = self.fit(
                    pump_speed, flow_rate, model_type, confidence_level
                )
            except Exception as e:
                warnings.warn(f"模型 {model_type} 拟合失败: {e}")
        
        return results
    
    def select_best_model(
        self,
        fitting_results: Dict[str, FittingResult]
    ) -> Tuple[str, FittingResult]:
        if not fitting_results:
            raise ValueError("没有可用的拟合结果")
        
        best_model = None
        best_result = None
        best_score = -np.inf
        
        for model_name, result in fitting_results.items():
            score = result.adjusted_r_squared
            
            if model_name == 'linear':
                score += 0.02
            
            if score > best_score:
                best_score = score
                best_model = model_name
                best_result = result
        
        return best_model, best_result


curve_fitter = CurveFitter()
