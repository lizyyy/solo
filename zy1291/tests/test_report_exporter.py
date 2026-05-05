import pytest
import os
import sys
import tempfile
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from report_exporter.data_loader import DataLoader
from report_exporter.metrics_calculator import MetricsCalculator
from report_exporter.report_generator import ReportGenerator
from report_exporter.report_verifier import ReportVerifier
from report_exporter.exceptions import (
    DataValidationError,
    MissingColumnError,
    InvalidValueError
)


class TestDataLoader:
    """测试数据加载器"""
    
    def test_load_valid_orders_csv(self):
        """测试加载有效的订单 CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write("""order_id,amount,status,channel,order_time
ORD001,199.99,completed,wechat,2026-05-01 09:30:00
ORD002,399.00,completed,taobao,2026-05-01 10:15:00
""")
            csv_path = f.name
        
        try:
            loader = DataLoader(validate_data=True)
            df = loader.load_orders_csv(csv_path)
            
            assert len(df) == 2
            assert 'order_id' in df.columns
            assert 'amount' in df.columns
            assert 'status' in df.columns
            assert 'channel' in df.columns
            assert 'order_time' in df.columns
            
        finally:
            os.unlink(csv_path)
    
    def test_load_missing_column_csv(self):
        """测试加载缺少列的 CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write("""order_id,amount,status
ORD001,199.99,completed
""")
            csv_path = f.name
        
        try:
            loader = DataLoader(validate_data=True)
            
            with pytest.raises(MissingColumnError):
                loader.load_orders_csv(csv_path)
            
        finally:
            os.unlink(csv_path)
    
    def test_load_invalid_amount_csv(self):
        """测试加载包含无效金额的 CSV"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write("""order_id,amount,status,channel,order_time
ORD001,-100.00,completed,wechat,2026-05-01 09:30:00
""")
            csv_path = f.name
        
        try:
            loader = DataLoader(validate_data=True)
            
            with pytest.raises(InvalidValueError):
                loader.load_orders_csv(csv_path)
            
        finally:
            os.unlink(csv_path)
    
    def test_load_metrics_yaml(self):
        """测试加载指标配置 YAML"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            f.write("""report_title: "测试报告"
report_period:
  start: "2026-05-01"
  end: "2026-05-05"
core_metrics:
  - name: "GMV"
    description: "商品交易总额"
""")
            yaml_path = f.name
        
        try:
            loader = DataLoader(validate_data=True)
            config = loader.load_metrics_yaml(yaml_path)
            
            assert config['report_title'] == '测试报告'
            assert 'report_period' in config
            assert 'core_metrics' in config
            
        finally:
            os.unlink(yaml_path)
    
    def test_load_template_md(self):
        """测试加载模板 Markdown"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            f.write("""# {{report_title}}

## 核心指标

GMV: {{gmv}}
退款率: {{refund_rate}}%
""")
            md_path = f.name
        
        try:
            loader = DataLoader(validate_data=True)
            template = loader.load_template_md(md_path)
            
            assert '{{report_title}}' in template
            assert '{{gmv}}' in template
            assert '{{refund_rate}}' in template
            
        finally:
            os.unlink(md_path)


class TestMetricsCalculator:
    """测试指标计算器"""
    
    @pytest.fixture
    def sample_orders_df(self):
        """创建样例订单数据"""
        data = {
            'order_id': ['ORD001', 'ORD002', 'ORD003', 'ORD004', 'ORD005'],
            'amount': [199.99, 399.00, 59.90, 899.50, 129.00],
            'status': ['completed', 'completed', 'completed', 'completed', 'refunded'],
            'channel': ['wechat', 'taobao', 'jingdong', 'wechat', 'taobao'],
            'order_time': ['2026-05-01 09:30:00', '2026-05-01 10:15:00', 
                           '2026-05-01 11:20:00', '2026-05-01 14:05:00',
                           '2026-05-01 15:30:00']
        }
        return pd.DataFrame(data)
    
    @pytest.fixture
    def sample_metrics_config(self):
        """创建样例指标配置"""
        return {
            'report_title': '测试报告',
            'report_period': {'start': '2026-05-01', 'end': '2026-05-05'},
            'core_metrics': [
                {'name': 'GMV', 'description': '商品交易总额', 'unit': '元'},
                {'name': '退款率', 'description': '退款订单占比', 'unit': '%'}
            ]
        }
    
    def test_calculate_gmv(self, sample_orders_df, sample_metrics_config):
        """测试计算 GMV"""
        calculator = MetricsCalculator(sample_orders_df, sample_metrics_config)
        gmv = calculator.calculate_gmv()
        
        expected_gmv = 199.99 + 399.00 + 59.90 + 899.50 + 129.00
        assert abs(gmv - expected_gmv) < 0.01
    
    def test_calculate_refund_rate(self, sample_orders_df, sample_metrics_config):
        """测试计算退款率"""
        calculator = MetricsCalculator(sample_orders_df, sample_metrics_config)
        refund_rate = calculator.calculate_refund_rate()
        
        expected_rate = (1 / 5) * 100
        assert refund_rate == expected_rate
    
    def test_calculate_channel_conversion(self, sample_orders_df, sample_metrics_config):
        """测试计算渠道转化率"""
        calculator = MetricsCalculator(sample_orders_df, sample_metrics_config)
        conversion = calculator.calculate_channel_conversion()
        
        assert 'wechat' in conversion
        assert 'taobao' in conversion
        assert 'jingdong' in conversion
        
        assert conversion['wechat'] == 40.0
        assert conversion['taobao'] == 40.0
        assert conversion['jingdong'] == 20.0
    
    def test_identify_anomalous_orders(self, sample_orders_df, sample_metrics_config):
        """测试识别异常订单"""
        sample_orders_df.loc[len(sample_orders_df)] = {
            'order_id': 'ORD006',
            'amount': 99999.99,
            'status': 'completed',
            'channel': 'wechat',
            'order_time': '2026-05-01 16:00:00'
        }
        
        calculator = MetricsCalculator(sample_orders_df, sample_metrics_config)
        anomalies = calculator.identify_anomalous_orders()
        
        assert len(anomalies) >= 1
    
    def test_calculate_all_metrics(self, sample_orders_df, sample_metrics_config):
        """测试计算所有指标"""
        calculator = MetricsCalculator(sample_orders_df, sample_metrics_config)
        result = calculator.calculate_all_metrics()
        
        assert 'gmv' in result
        assert 'refund_rate' in result
        assert 'channel_conversion' in result
        assert 'anomalous_orders' in result
        assert 'total_orders' in result
        assert 'average_order_value' in result
        assert 'top_channels' in result
        
        assert result['total_orders'] == 5


class TestReportGenerator:
    """测试报告生成器"""
    
    @pytest.fixture
    def sample_metrics_result(self):
        """创建样例指标结果"""
        return {
            'gmv': 1687.39,
            'refund_rate': 20.0,
            'channel_conversion': {'wechat': 40.0, 'taobao': 40.0, 'jingdong': 20.0},
            'anomalous_orders': pd.DataFrame(),
            'total_orders': 5,
            'average_order_value': 337.48,
            'top_channels': {'wechat': 2, 'taobao': 2, 'jingdong': 1}
        }
    
    @pytest.fixture
    def sample_orders_df(self):
        """创建样例订单数据"""
        data = {
            'order_id': ['ORD001', 'ORD002', 'ORD003', 'ORD004', 'ORD005'],
            'amount': [199.99, 399.00, 59.90, 899.50, 129.00],
            'status': ['completed', 'completed', 'completed', 'completed', 'refunded'],
            'channel': ['wechat', 'taobao', 'jingdong', 'wechat', 'taobao'],
            'order_time': ['2026-05-01 09:30:00', '2026-05-01 10:15:00', 
                           '2026-05-01 11:20:00', '2026-05-01 14:05:00',
                           '2026-05-01 15:30:00']
        }
        return pd.DataFrame(data)
    
    @pytest.fixture
    def sample_metrics_config(self):
        """创建样例指标配置"""
        return {
            'report_title': '测试报告',
            'report_period': {'start': '2026-05-01', 'end': '2026-05-05'},
            'core_metrics': [],
            'channels': [
                {'name': 'wechat', 'display_name': '微信小程序'},
                {'name': 'taobao', 'display_name': '淘宝'},
                {'name': 'jingdong', 'display_name': '京东'}
            ]
        }
    
    @pytest.fixture
    def sample_template(self):
        """创建样例模板"""
        return """# {{report_title}}

**报告周期**: {{report_period.start}} - {{report_period.end}}

## 核心指标

| 指标 | 数值 |
|------|------|
| GMV | {{gmv}} |
| 退款率 | {{refund_rate}}% |
| 总订单数 | {{total_orders}} |

## 结论

{{conclusion}}
"""
    
    def test_generate_markdown(self, sample_metrics_result, sample_orders_df, 
                                sample_metrics_config, sample_template):
        """测试生成 Markdown 报告"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = os.path.join(tmp_dir, 'test_report.md')
            
            generator = ReportGenerator(sample_template, sample_metrics_config)
            content = generator.generate_markdown(sample_metrics_result, sample_orders_df, output_path)
            
            assert os.path.exists(output_path)
            
            assert '{{report_title}}' not in content
            assert sample_metrics_config['report_title'] in content
            assert '1687.39' in content
            assert '20.0' in content
            assert '5' in content
    
    def test_generate_excel(self, sample_metrics_result, sample_orders_df,
                             sample_metrics_config, sample_template):
        """测试生成 Excel 报告"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = os.path.join(tmp_dir, 'test_report.xlsx')
            
            generator = ReportGenerator(sample_template, sample_metrics_config)
            result_path = generator.generate_excel(sample_metrics_result, sample_orders_df, output_path)
            
            assert os.path.exists(output_path)
            assert result_path == output_path
    
    def test_generate_pdf(self, sample_metrics_result, sample_orders_df,
                          sample_metrics_config, sample_template):
        """测试生成 PDF 报告"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = os.path.join(tmp_dir, 'test_report.pdf')
            
            generator = ReportGenerator(sample_template, sample_metrics_config)
            result_path = generator.generate_pdf(sample_metrics_result, sample_orders_df, output_path)
            
            assert os.path.exists(output_path)
            assert result_path == output_path


class TestReportVerifier:
    """测试报告验证器"""
    
    def test_extract_from_markdown(self):
        """测试从 Markdown 提取内容"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
            f.write("""# 测试报告

## 1. 核心指标

GMV: 1687.39 元
退款率: 20.0%
总订单数: 5 笔

## 2. 异常订单

异常订单总数: 2 笔

| 订单ID | 金额 | 异常原因 |
|--------|------|----------|
| ORD006 | 99999.99 | 金额异常 |
| ORD007 | -50.00 | 负金额 |

## 3. 结论

本月销售表现良好，GMV 达到 1687.39 元。
""")
            md_path = f.name
        
        try:
            verifier = ReportVerifier()
            result = verifier.extract_report_content(md_path, 'markdown')
            
            assert result['title'] == '测试报告'
            assert '核心指标' in result['sections']
            assert '异常订单' in result['sections']
            assert '结论' in result['sections']
            
        finally:
            os.unlink(md_path)
    
    def test_verify_consistency_same(self):
        """测试验证一致性（相同报告）"""
        report1 = {
            'title': '测试报告',
            'sections': ['核心指标', '异常订单', '结论'],
            'metrics': {'gmv': 1687.39, 'refund_rate': 20.0, 'total_orders': 5},
            'tables': [{'row_count': 3, 'headers': ['订单ID', '金额']}],
            'anomalies': ['ORD006', 'ORD007'],
            'conclusion': '本月销售表现良好'
        }
        
        report2 = {
            'title': '测试报告',
            'sections': ['核心指标', '异常订单', '结论'],
            'metrics': {'gmv': 1687.39, 'refund_rate': 20.0, 'total_orders': 5},
            'tables': [{'row_count': 3, 'headers': ['订单ID', '金额']}],
            'anomalies': ['ORD006', 'ORD007'],
            'conclusion': '本月销售表现良好'
        }
        
        verifier = ReportVerifier()
        result = verifier.verify_consistency({
            'markdown': report1,
            'excel': report2
        })
        
        assert result['consistent'] is True
        assert len(result['differences']) == 0
    
    def test_verify_consistency_different(self):
        """测试验证一致性（不同报告）"""
        report1 = {
            'title': '测试报告',
            'sections': ['核心指标', '异常订单', '结论'],
            'metrics': {'gmv': 1687.39, 'refund_rate': 20.0, 'total_orders': 5},
            'tables': [{'row_count': 3, 'headers': ['订单ID', '金额']}],
            'anomalies': ['ORD006'],
            'conclusion': '本月销售表现良好'
        }
        
        report2 = {
            'title': '不同的报告标题',
            'sections': ['核心指标'],
            'metrics': {'gmv': 2000.00, 'refund_rate': 10.0, 'total_orders': 10},
            'tables': [],
            'anomalies': [],
            'conclusion': ''
        }
        
        verifier = ReportVerifier()
        result = verifier.verify_consistency({
            'markdown': report1,
            'excel': report2
        })
        
        assert result['consistent'] is False
        assert len(result['differences']) > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
