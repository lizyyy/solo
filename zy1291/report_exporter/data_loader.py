import pandas as pd
import yaml
import os
from typing import Dict, Any, Tuple, List
from datetime import datetime

from .exceptions import (
    DataValidationError,
    FileFormatError,
    MissingColumnError,
    InvalidValueError,
    TemplateError
)


class DataLoader:
    """数据加载器 - 负责加载和验证订单数据、指标配置和报告模板"""
    
    REQUIRED_ORDER_COLUMNS = ['order_id', 'amount', 'status', 'channel', 'order_time']
    VALID_STATUSES = ['completed', 'refunded', 'pending', 'cancelled']
    
    def __init__(self, validate_data: bool = True):
        self.validate_data = validate_data
        self.validation_errors: List[Dict[str, Any]] = []
    
    def load_orders_csv(self, file_path: str) -> pd.DataFrame:
        """
        加载订单数据 CSV 文件
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            pandas DataFrame 包含订单数据
            
        Raises:
            FileFormatError: 文件格式错误
            MissingColumnError: 缺少必需列
            InvalidValueError: 包含无效值
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"订单文件不存在: {file_path}")
        
        if not file_path.endswith('.csv'):
            raise FileFormatError(
                file_path=file_path,
                expected_format='CSV',
                suggestions=['请确保文件扩展名为 .csv', '检查文件是否为正确的逗号分隔格式']
            )
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding='gbk')
        except Exception as e:
            raise FileFormatError(
                file_path=file_path,
                expected_format='CSV',
                suggestions=['检查文件是否损坏', '尝试用 Excel 打开并另存为 CSV']
            ) from e
        
        if self.validate_data:
            self._validate_orders_dataframe(df, file_path)
        
        return df
    
    def _validate_orders_dataframe(self, df: pd.DataFrame, file_path: str):
        """验证订单数据 DataFrame"""
        self.validation_errors = []
        
        for col in self.REQUIRED_ORDER_COLUMNS:
            if col not in df.columns:
                self.validation_errors.append({
                    'type': 'missing_column',
                    'field': col,
                    'message': f"缺少必需列: {col}",
                    'suggestion': f"请在 CSV 文件中添加 '{col}' 列"
                })
        
        if self.validation_errors:
            messages = [e['message'] for e in self.validation_errors]
            suggestions = [e['suggestion'] for e in self.validation_errors]
            raise MissingColumnError(
                column_name=messages[0],
                file_path=file_path,
                suggestions=suggestions
            )
        
        for idx, row in df.iterrows():
            row_num = idx + 2
            
            if pd.isna(row['order_id']) or str(row['order_id']).strip() == '':
                self.validation_errors.append({
                    'type': 'invalid_value',
                    'field': 'order_id',
                    'row': row_num,
                    'value': row['order_id'],
                    'message': f"第 {row_num} 行: 订单ID不能为空",
                    'suggestion': f"请为第 {row_num} 行填写有效的订单ID"
                })
            
            try:
                amount = float(row['amount'])
                if amount <= 0:
                    self.validation_errors.append({
                        'type': 'invalid_value',
                        'field': 'amount',
                        'row': row_num,
                        'value': row['amount'],
                        'message': f"第 {row_num} 行: 金额必须大于0，当前值为 {row['amount']}",
                        'suggestion': f"请检查第 {row_num} 行的金额是否正确"
                    })
            except (ValueError, TypeError):
                self.validation_errors.append({
                    'type': 'invalid_value',
                    'field': 'amount',
                    'row': row_num,
                    'value': row['amount'],
                    'message': f"第 {row_num} 行: 金额格式无效，当前值为 {row['amount']}",
                    'suggestion': f"请确保第 {row_num} 行的金额为有效数字"
                })
            
            if pd.notna(row['status']) and row['status'] not in self.VALID_STATUSES:
                self.validation_errors.append({
                    'type': 'invalid_value',
                    'field': 'status',
                    'row': row_num,
                    'value': row['status'],
                    'message': f"第 {row_num} 行: 订单状态 '{row['status']}' 不是有效值",
                    'suggestion': f"有效状态包括: {', '.join(self.VALID_STATUSES)}"
                })
            
            if pd.isna(row['channel']) or str(row['channel']).strip() == '':
                self.validation_errors.append({
                    'type': 'invalid_value',
                    'field': 'channel',
                    'row': row_num,
                    'value': row['channel'],
                    'message': f"第 {row_num} 行: 渠道信息不能为空",
                    'suggestion': f"请为第 {row_num} 行填写渠道信息（如: wechat, taobao, jingdong）"
                })
        
        if self.validation_errors:
            error_count = len(self.validation_errors)
            messages = [e['message'] for e in self.validation_errors[:5]]
            if error_count > 5:
                messages.append(f"... 还有 {error_count - 5} 个错误")
            
            suggestions = []
            for e in self.validation_errors[:5]:
                suggestions.append(e['suggestion'])
            if error_count > 5:
                suggestions.append(f"请检查所有 {error_count} 个错误并修复")
            
            raise InvalidValueError(
                field='data_validation',
                value=None,
                suggestions=suggestions
            )
    
    def load_metrics_yaml(self, file_path: str) -> Dict[str, Any]:
        """
        加载指标配置 YAML 文件
        
        Args:
            file_path: YAML 文件路径
            
        Returns:
            字典包含指标配置
            
        Raises:
            FileFormatError: 文件格式错误
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"指标配置文件不存在: {file_path}")
        
        if not file_path.endswith(('.yaml', '.yml')):
            raise FileFormatError(
                file_path=file_path,
                expected_format='YAML',
                suggestions=['请确保文件扩展名为 .yaml 或 .yml', '检查 YAML 语法是否正确']
            )
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise FileFormatError(
                file_path=file_path,
                expected_format='YAML',
                suggestions=[
                    '检查 YAML 缩进是否正确（使用2空格缩进）',
                    '确保冒号后有空格',
                    '检查是否有未闭合的引号'
                ]
            ) from e
        except Exception as e:
            raise FileFormatError(
                file_path=file_path,
                expected_format='YAML'
            ) from e
        
        if config is None:
            config = {}
        
        if self.validate_data:
            self._validate_metrics_config(config, file_path)
        
        return config
    
    def _validate_metrics_config(self, config: Dict[str, Any], file_path: str):
        """验证指标配置"""
        required_keys = ['report_title', 'report_period', 'core_metrics']
        missing = [key for key in required_keys if key not in config]
        
        if missing:
            raise DataValidationError(
                message=f"指标配置缺少必需字段: {', '.join(missing)}",
                suggestions=[
                    f"请在 {file_path} 中添加以下字段: {', '.join(missing)}",
                    "参考 seed 命令生成的样例配置"
                ]
            )
    
    def load_template_md(self, file_path: str) -> str:
        """
        加载报告模板 Markdown 文件
        
        Args:
            file_path: Markdown 文件路径
            
        Returns:
            模板字符串
            
        Raises:
            FileFormatError: 文件格式错误
            TemplateError: 模板错误
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"模板文件不存在: {file_path}")
        
        if not file_path.endswith('.md'):
            raise FileFormatError(
                file_path=file_path,
                expected_format='Markdown',
                suggestions=['请确保文件扩展名为 .md']
            )
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                content = f.read()
        except Exception as e:
            raise FileFormatError(
                file_path=file_path,
                expected_format='Markdown'
            ) from e
        
        if self.validate_data:
            self._validate_template(content, file_path)
        
        return content
    
    def _validate_template(self, content: str, file_path: str):
        """验证模板内容"""
        required_variables = ['{{report_title}}', '{{gmv}}', '{{refund_rate}}']
        missing = []
        
        for var in required_variables:
            if var not in content:
                missing.append(var)
        
        if missing:
            raise TemplateError(
                message=f"模板缺少必需变量: {', '.join(missing)}",
                template_path=file_path,
                suggestions=[
                    f"请在模板中添加以下变量: {', '.join(missing)}",
                    "参考 seed 命令生成的样例模板"
                ]
            )
    
    def load_all(self, 
                 orders_csv_path: str,
                 metrics_yaml_path: str,
                 template_md_path: str) -> Tuple[pd.DataFrame, Dict[str, Any], str]:
        """
        加载所有输入文件
        
        Args:
            orders_csv_path: 订单 CSV 文件路径
            metrics_yaml_path: 指标配置 YAML 文件路径
            template_md_path: 报告模板 Markdown 文件路径
            
        Returns:
            元组 (orders_df, metrics_config, template_content)
        """
        orders_df = self.load_orders_csv(orders_csv_path)
        metrics_config = self.load_metrics_yaml(metrics_yaml_path)
        template_content = self.load_template_md(template_md_path)
        
        return orders_df, metrics_config, template_content
    
    def get_validation_errors(self) -> List[Dict[str, Any]]:
        """获取验证错误列表"""
        return self.validation_errors
