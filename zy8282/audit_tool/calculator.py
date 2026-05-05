"""指标计算引擎"""

from decimal import Decimal, ROUND_HALF_UP, ROUND_DOWN, ROUND_UP
from typing import Dict, List, Optional

from .models import (
    AuditContext,
    CalculatedMetric,
    LaborCost,
    MetricRule,
    Order,
    Refund,
)


class MetricCalculator:
    """指标计算器"""
    
    def __init__(self, context: AuditContext):
        self.context = context
        self._store_orders: Dict[str, List[Order]] = {}
        self._store_refunds: Dict[str, List[Refund]] = {}
        self._store_labor: Dict[str, List[LaborCost]] = {}
        self._group_data_by_store()
    
    def _group_data_by_store(self):
        """按门店分组数据"""
        for order in self.context.orders:
            if order.store_id not in self._store_orders:
                self._store_orders[order.store_id] = []
            self._store_orders[order.store_id].append(order)
        
        for refund in self.context.refunds:
            if refund.store_id not in self._store_refunds:
                self._store_refunds[refund.store_id] = []
            self._store_refunds[refund.store_id].append(refund)
        
        for labor in self.context.labor_costs:
            if labor.store_id not in self._store_labor:
                self._store_labor[labor.store_id] = []
            self._store_labor[labor.store_id].append(labor)
    
    def calculate_all(self) -> List[CalculatedMetric]:
        """计算所有指标"""
        metrics = []
        
        gmv = self._calculate_gmv()
        metrics.append(gmv)
        
        total_orders = self._calculate_total_orders()
        metrics.append(total_orders)
        
        total_refunds = self._calculate_total_refunds()
        metrics.append(total_refunds)
        
        net_sales = self._calculate_net_sales(gmv, total_refunds)
        metrics.append(net_sales)
        
        average_order_value = self._calculate_average_order_value(gmv, total_orders)
        metrics.append(average_order_value)
        
        refund_rate = self._calculate_refund_rate(total_refunds, gmv)
        metrics.append(refund_rate)
        
        total_labor_cost = self._calculate_total_labor_cost()
        metrics.append(total_labor_cost)
        
        labor_cost_rate = self._calculate_labor_cost_rate(total_labor_cost, net_sales)
        metrics.append(labor_cost_rate)
        
        return metrics
    
    def _calculate_gmv(self) -> CalculatedMetric:
        """计算 GMV（总销售额）"""
        store_breakdown = {}
        total_gmv = Decimal('0')
        
        for store_id, orders in self._store_orders.items():
            store_gmv = sum((o.total_amount for o in orders), Decimal('0'))
            store_breakdown[store_id] = self._round(store_gmv)
            total_gmv += store_gmv
        
        return CalculatedMetric(
            metric_name='gmv',
            display_name='GMV',
            value=self._round(total_gmv),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_total_orders(self) -> CalculatedMetric:
        """计算总订单数"""
        store_breakdown = {}
        total_orders = 0
        
        for store_id, orders in self._store_orders.items():
            store_orders = len(orders)
            store_breakdown[store_id] = Decimal(store_orders)
            total_orders += store_orders
        
        return CalculatedMetric(
            metric_name='total_orders',
            display_name='订单数',
            value=Decimal(total_orders),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_total_refunds(self) -> CalculatedMetric:
        """计算总退款金额"""
        store_breakdown = {}
        total_refunds = Decimal('0')
        
        for store_id, refunds in self._store_refunds.items():
            store_refunds = sum((r.refund_amount for r in refunds), Decimal('0'))
            store_breakdown[store_id] = self._round(store_refunds)
            total_refunds += store_refunds
        
        return CalculatedMetric(
            metric_name='total_refunds',
            display_name='退款金额',
            value=self._round(total_refunds),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_net_sales(
        self, 
        gmv: CalculatedMetric, 
        total_refunds: CalculatedMetric
    ) -> CalculatedMetric:
        """计算净销售额"""
        store_breakdown = {}
        
        all_stores = set(gmv.store_breakdown.keys()) | set(total_refunds.store_breakdown.keys())
        
        for store_id in all_stores:
            store_gmv = gmv.store_breakdown.get(store_id, Decimal('0'))
            store_refunds = total_refunds.store_breakdown.get(store_id, Decimal('0'))
            store_breakdown[store_id] = self._round(store_gmv - store_refunds)
        
        return CalculatedMetric(
            metric_name='net_sales',
            display_name='净销售额',
            value=self._round(gmv.value - total_refunds.value),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_average_order_value(
        self, 
        gmv: CalculatedMetric, 
        total_orders: CalculatedMetric
    ) -> CalculatedMetric:
        """计算客单价"""
        store_breakdown = {}
        
        all_stores = set(gmv.store_breakdown.keys()) | set(total_orders.store_breakdown.keys())
        
        for store_id in all_stores:
            store_gmv = gmv.store_breakdown.get(store_id, Decimal('0'))
            store_orders = total_orders.store_breakdown.get(store_id, Decimal('0'))
            if store_orders > 0:
                aov = store_gmv / store_orders
                store_breakdown[store_id] = self._round(aov)
            else:
                store_breakdown[store_id] = Decimal('0')
        
        if total_orders.value > 0:
            aov = gmv.value / total_orders.value
        else:
            aov = Decimal('0')
        
        return CalculatedMetric(
            metric_name='average_order_value',
            display_name='客单价',
            value=self._round(aov),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_refund_rate(
        self, 
        total_refunds: CalculatedMetric, 
        gmv: CalculatedMetric
    ) -> CalculatedMetric:
        """计算退款率（百分比）"""
        store_breakdown = {}
        
        all_stores = set(gmv.store_breakdown.keys()) | set(total_refunds.store_breakdown.keys())
        
        for store_id in all_stores:
            store_gmv = gmv.store_breakdown.get(store_id, Decimal('0'))
            store_refunds = total_refunds.store_breakdown.get(store_id, Decimal('0'))
            if store_gmv > 0:
                rate = (store_refunds / store_gmv) * 100
                store_breakdown[store_id] = self._round(rate, 2)
            else:
                store_breakdown[store_id] = Decimal('0')
        
        if gmv.value > 0:
            rate = (total_refunds.value / gmv.value) * 100
        else:
            rate = Decimal('0')
        
        return CalculatedMetric(
            metric_name='refund_rate',
            display_name='退款率',
            value=self._round(rate, 2),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_total_labor_cost(self) -> CalculatedMetric:
        """计算总人工成本"""
        store_breakdown = {}
        total_labor = Decimal('0')
        
        for store_id, labors in self._store_labor.items():
            store_labor = sum((l.total_cost for l in labors), Decimal('0'))
            store_breakdown[store_id] = self._round(store_labor)
            total_labor += store_labor
        
        return CalculatedMetric(
            metric_name='total_labor_cost',
            display_name='人工成本',
            value=self._round(total_labor),
            store_breakdown=store_breakdown,
        )
    
    def _calculate_labor_cost_rate(
        self, 
        total_labor_cost: CalculatedMetric, 
        net_sales: CalculatedMetric
    ) -> CalculatedMetric:
        """计算人工成本率（百分比）"""
        store_breakdown = {}
        
        all_stores = set(net_sales.store_breakdown.keys()) | set(total_labor_cost.store_breakdown.keys())
        
        for store_id in all_stores:
            store_net_sales = net_sales.store_breakdown.get(store_id, Decimal('0'))
            store_labor = total_labor_cost.store_breakdown.get(store_id, Decimal('0'))
            if store_net_sales > 0:
                rate = (store_labor / store_net_sales) * 100
                store_breakdown[store_id] = self._round(rate, 2)
            else:
                store_breakdown[store_id] = Decimal('0')
        
        if net_sales.value > 0:
            rate = (total_labor_cost.value / net_sales.value) * 100
        else:
            rate = Decimal('0')
        
        return CalculatedMetric(
            metric_name='labor_cost_rate',
            display_name='人工成本率',
            value=self._round(rate, 2),
            store_breakdown=store_breakdown,
        )
    
    def _round(self, value: Decimal, decimal_places: Optional[int] = None) -> Decimal:
        """根据规则四舍五入"""
        if decimal_places is None:
            rule = self.context.metric_rules.get('default')
            if rule:
                decimal_places = rule.decimal_places
                rounding_method = rule.rounding_method
            else:
                decimal_places = 2
                rounding_method = 'ROUND_HALF_UP'
        else:
            rule = self.context.metric_rules.get('default')
            rounding_method = rule.rounding_method if rule else 'ROUND_HALF_UP'
        
        quantize_str = '1.' + '0' * decimal_places
        
        if rounding_method == 'ROUND_HALF_UP':
            return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)
        elif rounding_method == 'ROUND_DOWN':
            return value.quantize(Decimal(quantize_str), rounding=ROUND_DOWN)
        elif rounding_method == 'ROUND_UP':
            return value.quantize(Decimal(quantize_str), rounding=ROUND_UP)
        
        return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)
