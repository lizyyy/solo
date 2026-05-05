import pandas as pd
from typing import Dict, List, Any
from .exceptions import DataValidationError


class MetricsCalculator:
    """计算核心业务指标"""
    
    def __init__(self, orders_df: pd.DataFrame, metrics_config: Dict[str, Any]):
        self.orders_df = orders_df
        self.metrics_config = metrics_config
        self._validate_columns()
    
    def _validate_columns(self):
        """验证必需的列是否存在"""
        required_columns = ['order_id', 'amount', 'status', 'channel', 'order_time']
        missing = [col for col in required_columns if col not in self.orders_df.columns]
        if missing:
            raise DataValidationError(f"订单数据缺少必需列: {', '.join(missing)}")
    
    def calculate_gmv(self) -> float:
        """计算 GMV (商品交易总额)"""
        gmv = self.orders_df['amount'].sum()
        return round(gmv, 2)
    
    def calculate_refund_rate(self) -> float:
        """计算退款率"""
        total_orders = len(self.orders_df)
        refund_orders = len(self.orders_df[self.orders_df['status'] == 'refunded'])
        if total_orders == 0:
            return 0.0
        refund_rate = (refund_orders / total_orders) * 100
        return round(refund_rate, 2)
    
    def calculate_channel_conversion(self) -> Dict[str, float]:
        """计算渠道转化率"""
        if 'conversion_rate' in self.metrics_config:
            return self.metrics_config['conversion_rate']
        
        channel_counts = self.orders_df['channel'].value_counts()
        total_orders = len(self.orders_df)
        
        conversion_rates = {}
        for channel, count in channel_counts.items():
            if total_orders > 0:
                rate = (count / total_orders) * 100
                conversion_rates[channel] = round(rate, 2)
        
        return conversion_rates
    
    def identify_anomalous_orders(self) -> pd.DataFrame:
        """识别异常订单"""
        anomalies = []
        
        mean_amount = self.orders_df['amount'].mean()
        std_amount = self.orders_df['amount'].std()
        
        for idx, row in self.orders_df.iterrows():
            anomaly_reasons = []
            
            if row['amount'] > mean_amount + 3 * std_amount:
                anomaly_reasons.append(f"金额异常: 订单金额 {row['amount']} 远高于平均值 {mean_amount:.2f}")
            
            if row['amount'] <= 0:
                anomaly_reasons.append(f"金额异常: 订单金额 {row['amount']} 小于等于 0")
            
            if pd.isna(row['order_id']):
                anomaly_reasons.append("订单ID缺失")
            
            if pd.isna(row['channel']):
                anomaly_reasons.append("渠道信息缺失")
            
            if anomaly_reasons:
                anomalies.append({
                    'order_id': row['order_id'],
                    'amount': row['amount'],
                    'status': row['status'],
                    'channel': row['channel'],
                    'reasons': anomaly_reasons
                })
        
        return pd.DataFrame(anomalies)
    
    def calculate_all_metrics(self) -> Dict[str, Any]:
        """计算所有指标"""
        return {
            'gmv': self.calculate_gmv(),
            'refund_rate': self.calculate_refund_rate(),
            'channel_conversion': self.calculate_channel_conversion(),
            'anomalous_orders': self.identify_anomalous_orders(),
            'total_orders': len(self.orders_df),
            'average_order_value': round(self.orders_df['amount'].mean(), 2),
            'top_channels': self.orders_df['channel'].value_counts().head(3).to_dict()
        }
