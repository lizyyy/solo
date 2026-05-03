import pandas as pd
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import warnings
warnings.filterwarnings('ignore')


@dataclass
class PlatformSchema:
    name: str
    date_field: str
    material_field: str
    spend_field: str
    impression_field: str
    click_field: str
    conversion_field: str
    optional_fields: Dict[str, str] = None


PLATFORMS = {
    '抖音': PlatformSchema(
        name='抖音',
        date_field='日期',
        material_field='素材ID',
        spend_field='消耗(元)',
        impression_field='展示次数',
        click_field='点击次数',
        conversion_field='转化数',
        optional_fields={'cpc': '平均点击单价(元)', 'cpm': '千次展示成本(元)'}
    ),
    '小红书': PlatformSchema(
        name='小红书',
        date_field='日期',
        material_field='笔记ID',
        spend_field='花费(元)',
        impression_field='曝光量',
        click_field='点击量',
        conversion_field='转化量',
        optional_fields={'cpc': '点击单价(元)', 'ctr': '点击率'}
    ),
    '视频号': PlatformSchema(
        name='视频号',
        date_field='日期',
        material_field='创意ID',
        spend_field='消耗金额(元)',
        impression_field='曝光次数',
        click_field='点击次数',
        conversion_field='转化个数',
        optional_fields={'cpc': '单次点击成本(元)', 'cvr': '转化率'}
    )
}


class DataParser:
    def __init__(self):
        self.platforms = PLATFORMS
    
    def detect_platform(self, df: pd.DataFrame) -> Optional[str]:
        columns = set(df.columns)
        for platform_name, schema in self.platforms.items():
            required_fields = {
                schema.date_field,
                schema.material_field,
                schema.spend_field,
                schema.impression_field,
                schema.click_field,
                schema.conversion_field
            }
            if required_fields.issubset(columns):
                return platform_name
        return None
    
    def normalize_data(
        self, df: pd.DataFrame, platform_name: str
    ) -> Tuple[pd.DataFrame, Dict[str, List[str]]]:
        schema = self.platforms[platform_name]
        warnings = {
            'missing_fields': [],
            'type_conversion': [],
            'null_values': []
        }
        
        required_mapping = {
            'date': schema.date_field,
            'material_id': schema.material_field,
            'spend': schema.spend_field,
            'impression': schema.impression_field,
            'click': schema.click_field,
            'conversion': schema.conversion_field
        }
        
        normalized = pd.DataFrame()
        
        for target_col, source_col in required_mapping.items():
            if source_col not in df.columns:
                warnings['missing_fields'].append(source_col)
                normalized[target_col] = None
                continue
            
            series = df[source_col].copy()
            
            if target_col == 'date':
                try:
                    normalized[target_col] = pd.to_datetime(series).dt.date
                except Exception as e:
                    warnings['type_conversion'].append(f'{source_col}: 日期转换失败 - {str(e)}')
                    normalized[target_col] = series
            elif target_col == 'material_id':
                normalized[target_col] = series.astype(str).fillna('未知素材')
            else:
                try:
                    if series.dtype == object:
                        series = series.str.replace(',', '').str.replace('¥', '')
                    numeric_series = pd.to_numeric(series, errors='coerce')
                    null_count = numeric_series.isnull().sum()
                    if null_count > 0:
                        warnings['null_values'].append(f'{source_col}: {null_count}个空值/无效值')
                    normalized[target_col] = numeric_series.fillna(0)
                except Exception as e:
                    warnings['type_conversion'].append(f'{source_col}: 数值转换失败 - {str(e)}')
                    normalized[target_col] = 0
        
        normalized['platform'] = platform_name
        
        if schema.optional_fields:
            for target_col, source_col in schema.optional_fields.items():
                if source_col in df.columns:
                    try:
                        if df[source_col].dtype == object:
                            series = df[source_col].str.replace(',', '').str.replace('¥', '')
                        else:
                            series = df[source_col]
                        normalized[target_col] = pd.to_numeric(series, errors='coerce').fillna(0)
                    except:
                        pass
        
        return normalized, warnings
    
    def parse_transaction_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, List[str]]]:
        warnings = {
            'missing_fields': [],
            'type_conversion': [],
            'null_values': []
        }
        
        normalized = pd.DataFrame()
        
        date_fields = ['日期', 'date', 'Date', '下单时间', '订单日期']
        date_col = None
        for field in date_fields:
            if field in df.columns:
                date_col = field
                break
        
        if date_col:
            try:
                normalized['date'] = pd.to_datetime(df[date_col]).dt.date
            except Exception as e:
                warnings['type_conversion'].append(f'{date_col}: 日期转换失败 - {str(e)}')
                normalized['date'] = df[date_col]
        else:
            warnings['missing_fields'].append('日期字段')
            normalized['date'] = None
        
        amount_fields = ['订单金额', '成交金额', 'GMV', '金额', 'amount', 'revenue']
        amount_col = None
        for field in amount_fields:
            if field in df.columns:
                amount_col = field
                break
        
        if amount_col:
            try:
                if df[amount_col].dtype == object:
                    series = df[amount_col].str.replace(',', '').str.replace('¥', '')
                else:
                    series = df[amount_col]
                numeric_series = pd.to_numeric(series, errors='coerce')
                null_count = numeric_series.isnull().sum()
                if null_count > 0:
                    warnings['null_values'].append(f'{amount_col}: {null_count}个空值/无效值')
                normalized['revenue'] = numeric_series.fillna(0)
            except Exception as e:
                warnings['type_conversion'].append(f'{amount_col}: 数值转换失败 - {str(e)}')
                normalized['revenue'] = 0
        else:
            warnings['missing_fields'].append('金额字段')
            normalized['revenue'] = 0
        
        order_fields = ['订单数', '订单量', '订单个数', 'orders', 'count']
        order_col = None
        for field in order_fields:
            if field in df.columns:
                order_col = field
                break
        
        if order_col:
            try:
                if df[order_col].dtype == object:
                    series = df[order_col].str.replace(',', '')
                else:
                    series = df[order_col]
                numeric_series = pd.to_numeric(series, errors='coerce')
                null_count = numeric_series.isnull().sum()
                if null_count > 0:
                    warnings['null_values'].append(f'{order_col}: {null_count}个空值/无效值')
                normalized['order_count'] = numeric_series.fillna(0)
            except Exception as e:
                warnings['type_conversion'].append(f'{order_col}: 数值转换失败 - {str(e)}')
                normalized['order_count'] = 0
        else:
            normalized['order_count'] = 1
        
        if 'material_id' not in normalized.columns and '素材ID' in df.columns:
            normalized['material_id'] = df['素材ID'].astype(str).fillna('未知')
        
        return normalized, warnings
    
    def merge_all_data(
        self, 
        ad_data_list: List[Tuple[str, pd.DataFrame]], 
        transaction_data: Optional[pd.DataFrame] = None
    ) -> Tuple[pd.DataFrame, Dict]:
        all_normalized = []
        merge_warnings = {
            'platforms': [],
            'records_count': 0,
            'warnings': {}
        }
        
        for platform_name, df in ad_data_list:
            normalized, warnings = self.normalize_data(df, platform_name)
            all_normalized.append(normalized)
            merge_warnings['platforms'].append({
                'name': platform_name,
                'count': len(normalized),
                'warnings': warnings
            })
        
        if not all_normalized:
            return pd.DataFrame(), merge_warnings
        
        combined = pd.concat(all_normalized, ignore_index=True)
        merge_warnings['records_count'] = len(combined)
        
        if transaction_data is not None and not transaction_data.empty:
            trans_normalized, trans_warnings = self.parse_transaction_data(transaction_data)
            merge_warnings['transaction_warnings'] = trans_warnings
            
            if 'date' in combined.columns and 'date' in trans_normalized.columns:
                daily_revenue = trans_normalized.groupby('date').agg({
                    'revenue': 'sum',
                    'order_count': 'sum'
                }).reset_index()
                
                combined = combined.merge(
                    daily_revenue, 
                    on='date', 
                    how='left',
                    suffixes=('', '_trans')
                )
                if 'revenue_trans' in combined.columns:
                    combined['revenue'] = combined['revenue_trans'].fillna(0)
                    combined = combined.drop(columns=['revenue_trans'])
                else:
                    combined['revenue'] = 0
                
                if 'order_count' in combined.columns:
                    combined['order_count'] = combined['order_count'].fillna(0)
                else:
                    combined['order_count'] = 0
        
        return combined, merge_warnings
