import math
from typing import List, Dict, Any, Optional
from datetime import datetime

class RevenueCalculator:
    def __init__(self):
        self.default_discount_rate = 0.05
        self.default_inflation_rate = 0.02
    
    def calculate_hourly_revenue(self,
                                   hourly_data: List[Dict[str, Any]],
                                   hourly_generation: List[Dict[str, Any]],
                                   self_consumption_ratio: float = 0.7) -> Dict[str, Any]:
        total_revenue = 0.0
        total_self_consumed = 0.0
        total_grid_exported = 0.0
        monthly_revenue = [0.0] * 12
        
        for i, (data, gen) in enumerate(zip(hourly_data, hourly_generation)):
            try:
                timestamp = data.get('timestamp')
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                
                kwh = gen.get('kwh', 0)
                electricity_price = data.get('electricity_price', 0.6)
                feed_in_tariff = data.get('feed_in_tariff', electricity_price * 0.7)
                
                self_consumed = kwh * self_consumption_ratio
                grid_exported = kwh * (1 - self_consumption_ratio)
                
                revenue = (self_consumed * electricity_price + 
                          grid_exported * feed_in_tariff)
                
                total_revenue += revenue
                total_self_consumed += self_consumed
                total_grid_exported += grid_exported
                
                if timestamp:
                    month = timestamp.month - 1
                    monthly_revenue[month] += revenue
                    
            except Exception as e:
                continue
        
        return {
            'total_revenue': total_revenue,
            'total_self_consumed': total_self_consumed,
            'total_grid_exported': total_grid_exported,
            'monthly_revenue': monthly_revenue,
            'self_consumption_ratio': self_consumption_ratio
        }
    
    def calculate_financial_metrics(self,
                                      initial_investment: float,
                                      annual_revenue: float,
                                      lifetime: int = 25,
                                      discount_rate: Optional[float] = None,
                                      inflation_rate: Optional[float] = None,
                                      degradation_rate: float = 0.5) -> Dict[str, Any]:
        if discount_rate is None:
            discount_rate = self.default_discount_rate
        if inflation_rate is None:
            inflation_rate = self.default_inflation_rate
        
        real_discount_rate = (1 + discount_rate) / (1 + inflation_rate) - 1
        
        cumulative_cash_flow = 0.0
        payback_period = None
        npv = -initial_investment
        cash_flows = []
        
        for year in range(1, lifetime + 1):
            degradation_factor = (1 - degradation_rate / 100) ** (year - 1)
            annual_cash_flow = annual_revenue * degradation_factor
            
            discount_factor = 1 / (1 + real_discount_rate) ** year
            discounted_cf = annual_cash_flow * discount_factor
            
            npv += discounted_cf
            cumulative_cash_flow += annual_cash_flow
            
            cash_flows.append({
                'year': year,
                'annual_cash_flow': annual_cash_flow,
                'discounted_cash_flow': discounted_cf,
                'cumulative_cash_flow': cumulative_cash_flow,
                'degradation_factor': degradation_factor
            })
            
            if payback_period is None and cumulative_cash_flow >= initial_investment:
                if year > 1:
                    prev_cf = cumulative_cash_flow - annual_cash_flow
                    remaining = initial_investment - prev_cf
                    fraction = remaining / annual_cash_flow
                    payback_period = year - 1 + fraction
                else:
                    payback_period = year
        
        if cumulative_cash_flow >= initial_investment and payback_period is None:
            payback_period = lifetime
        
        irr = self._calculate_irr(initial_investment, 
                                  [cf['annual_cash_flow'] for cf in cash_flows])
        
        return {
            'initial_investment': initial_investment,
            'annual_revenue': annual_revenue,
            'lifetime': lifetime,
            'discount_rate': discount_rate,
            'inflation_rate': inflation_rate,
            'real_discount_rate': real_discount_rate,
            'payback_period_years': payback_period,
            'net_present_value': npv,
            'internal_rate_of_return': irr,
            'cumulative_cash_flow': cumulative_cash_flow,
            'cash_flows': cash_flows
        }
    
    def _calculate_irr(self, initial_investment: float, cash_flows: List[float], 
                        guess: float = 0.1, max_iterations: int = 1000, 
                        tolerance: float = 1e-6) -> Optional[float]:
        irr = guess
        
        for _ in range(max_iterations):
            npv = -initial_investment
            npv_derivative = 0
            
            for t, cf in enumerate(cash_flows, 1):
                npv += cf / (1 + irr) ** t
                npv_derivative -= t * cf / (1 + irr) ** (t + 1)
            
            if abs(npv) < tolerance:
                return irr
            
            if npv_derivative == 0:
                break
            
            irr = irr - npv / npv_derivative
            
            if irr < -0.99 or irr > 10:
                break
        
        return None
    
    def calculate_risk_factors(self,
                                 shading_loss_ratio: float,
                                 installable_capacity: float,
                                 actual_capacity: float,
                                 annual_generation: float,
                                 payback_period: Optional[float],
                                 location: str = '') -> List[Dict[str, Any]]:
        risks = []
        
        if shading_loss_ratio > 0.2:
            risks.append({
                'type': 'shading',
                'severity': 'high' if shading_loss_ratio > 0.4 else 'medium',
                'description': f'遮阴损失率较高 ({shading_loss_ratio*100:.1f}%)，可能影响发电量',
                'suggestion': '建议优化组件排布位置，避开障碍物遮阴区域，或考虑使用微逆变器'
            })
        elif shading_loss_ratio > 0.1:
            risks.append({
                'type': 'shading',
                'severity': 'low',
                'description': f'存在轻微遮阴影响 ({shading_loss_ratio*100:.1f}%)',
                'suggestion': '可考虑优化排布以进一步减少遮阴影响'
            })
        
        capacity_utilization = actual_capacity / installable_capacity if installable_capacity > 0 else 0
        if capacity_utilization < 0.6:
            risks.append({
                'type': 'capacity',
                'severity': 'high' if capacity_utilization < 0.4 else 'medium',
                'description': f'屋顶面积利用率较低 ({capacity_utilization*100:.1f}%)',
                'suggestion': '建议优化组件排布方案，提高屋顶面积利用率'
            })
        
        specific_yield = annual_generation / actual_capacity if actual_capacity > 0 else 0
        if specific_yield < 1000:
            risks.append({
                'type': 'yield',
                'severity': 'high' if specific_yield < 800 else 'medium',
                'description': f'单位容量发电量较低 ({specific_yield:.0f} kWh/kWp/年)',
                'suggestion': '建议检查日照数据是否准确，或考虑选择更高效率的组件'
            })
        
        if payback_period:
            if payback_period > 10:
                risks.append({
                    'type': 'financial',
                    'severity': 'high' if payback_period > 15 else 'medium',
                    'description': f'投资回收期较长 ({payback_period:.1f} 年)',
                    'suggestion': '建议评估投资风险，可考虑申请光伏补贴或降低初始投资成本'
                })
            elif payback_period > 7:
                risks.append({
                    'type': 'financial',
                    'severity': 'low',
                    'description': f'投资回收期一般 ({payback_period:.1f} 年)',
                    'suggestion': '可考虑优化方案以缩短投资回收期'
                })
        
        if not risks:
            risks.append({
                'type': 'general',
                'severity': 'low',
                'description': '方案整体风险较低',
                'suggestion': '建议定期维护光伏系统，确保长期稳定运行'
            })
        
        return risks
