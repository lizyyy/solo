import pandas as pd
from datetime import datetime
from typing import Tuple, Optional, List


class DataLoader:
    """数据导入和校验模块"""
    
    # 必需的列名和可能的别名
    REQUIRED_COLUMNS = {
        '日期': ['日期', 'date', 'Date', '时间', 'time', 'Time'],
        '小时': ['小时', 'hour', 'Hour', '时段'],
        '用电量(kWh)': ['用电量(kWh)', '用电量', 'kWh', 'consumption', 'Consumption', 'usage', 'Usage']
    }
    
    def __init__(self):
        self.df = None
        self.errors = []
        self.warnings = []
    
    def load_csv(self, file_path_or_buffer, is_uploaded: bool = False) -> Tuple[bool, Optional[pd.DataFrame]]:
        """
        加载 CSV 文件并进行数据校验
        
        Args:
            file_path_or_buffer: 文件路径或上传的文件对象
            is_uploaded: 是否为上传的文件
            
        Returns:
            (成功与否, 数据框或None)
        """
        self.errors = []
        self.warnings = []
        
        try:
            # 读取 CSV
            if is_uploaded:
                self.df = pd.read_csv(file_path_or_buffer)
            else:
                self.df = pd.read_csv(file_path_or_buffer)
            
            # 标准化列名
            self._standardize_columns()
            
            # 检查必需列
            if not self._check_required_columns():
                return False, None
            
            # 数据类型校验和转换
            if not self._validate_and_convert_data():
                return False, None
            
            # 数据完整性检查
            self._check_data_integrity()
            
            # 按日期和小时排序
            self.df = self.df.sort_values(['日期', '小时']).reset_index(drop=True)
            
            return True, self.df
            
        except Exception as e:
            self.errors.append(f"文件读取失败: {str(e)}")
            return False, None
    
    def _standardize_columns(self):
        """标准化列名，将可能的别名映射到标准列名"""
        column_mapping = {}
        
        for standard_col, aliases in self.REQUIRED_COLUMNS.items():
            for col in self.df.columns:
                if col in aliases or col.strip() in aliases:
                    column_mapping[col] = standard_col
                    break
        
        if column_mapping:
            self.df = self.df.rename(columns=column_mapping)
    
    def _check_required_columns(self) -> bool:
        """检查是否包含所有必需的列"""
        missing_columns = []
        
        for standard_col in self.REQUIRED_COLUMNS.keys():
            if standard_col not in self.df.columns:
                missing_columns.append(standard_col)
        
        if missing_columns:
            self.errors.append(
                f"缺少必需的列: {', '.join(missing_columns)}。\n"
                f"请确保 CSV 包含以下列: 日期、小时、用电量(kWh)。\n"
                f"支持的列名别名:\n"
                f"- 日期: date, Date, 时间, time, Time\n"
                f"- 小时: hour, Hour, 时段\n"
                f"- 用电量(kWh): 用电量, kWh, consumption, Consumption, usage, Usage"
            )
            return False
        
        return True
    
    def _validate_and_convert_data(self) -> bool:
        """验证和转换数据类型"""
        success = True
        
        # 验证日期列
        try:
            self.df['日期'] = pd.to_datetime(self.df['日期'])
            # 提取日期部分（去除时间）
            self.df['日期'] = self.df['日期'].dt.date
        except Exception as e:
            self.errors.append(
                f"日期格式不正确: {str(e)}。\n"
                f"请确保日期格式为 YYYY-MM-DD 或其他可识别的日期格式。"
            )
            success = False
        
        # 验证小时列
        try:
            self.df['小时'] = pd.to_numeric(self.df['小时'], errors='coerce')
            
            # 检查是否有缺失值
            if self.df['小时'].isnull().any():
                null_rows = self.df[self.df['小时'].isnull()].index.tolist()
                self.errors.append(
                    f"小时列包含无法转换的数值，行号: {[r+2 for r in null_rows]}。"
                )
                success = False
            
            # 检查小时范围 (0-23)
            invalid_hours = self.df[(self.df['小时'] < 0) | (self.df['小时'] > 23)]
            if not invalid_hours.empty:
                invalid_values = invalid_hours['小时'].unique().tolist()
                self.errors.append(
                    f"小时值超出有效范围(0-23): {invalid_values}。"
                )
                success = False
            
            # 转换为整数
            self.df['小时'] = self.df['小时'].astype(int)
            
        except Exception as e:
            self.errors.append(f"小时列格式不正确: {str(e)}")
            success = False
        
        # 验证用电量列
        try:
            self.df['用电量(kWh)'] = pd.to_numeric(self.df['用电量(kWh)'], errors='coerce')
            
            # 检查是否有缺失值
            if self.df['用电量(kWh)'].isnull().any():
                null_count = self.df['用电量(kWh)'].isnull().sum()
                self.warnings.append(
                    f"用电量列包含 {null_count} 个缺失值，已设置为 0。"
                )
                self.df['用电量(kWh)'] = self.df['用电量(kWh)'].fillna(0)
            
            # 检查负值
            negative_values = self.df[self.df['用电量(kWh)'] < 0]
            if not negative_values.empty:
                neg_count = len(negative_values)
                self.errors.append(
                    f"用电量列包含 {neg_count} 个负值。\n"
                    f"用电量不能为负数，请检查数据。\n"
                    f"示例负值行: {negative_values.head(5).index.tolist()}"
                )
                success = False
            
        except Exception as e:
            self.errors.append(f"用电量列格式不正确: {str(e)}")
            success = False
        
        return success
    
    def _check_data_integrity(self):
        """检查数据完整性，如时间连续性等"""
        # 检查是否有重复的日期+小时组合
        duplicates = self.df.duplicated(subset=['日期', '小时'])
        if duplicates.any():
            dup_count = duplicates.sum()
            self.warnings.append(
                f"发现 {dup_count} 条重复的日期+小时记录，已保留第一条。"
            )
            self.df = self.df.drop_duplicates(subset=['日期', '小时'], keep='first')
        
        # 检查是否有异常高的值（超过平均值的3倍标准差）
        mean_consumption = self.df['用电量(kWh)'].mean()
        std_consumption = self.df['用电量(kWh)'].std()
        threshold = mean_consumption + 3 * std_consumption
        
        high_values = self.df[self.df['用电量(kWh)'] > threshold]
        if not high_values.empty:
            self.warnings.append(
                f"发现 {len(high_values)} 条异常高用电量记录（超过平均值3倍标准差）。\n"
                f"这些时段可能需要特别关注。"
            )
    
    def get_errors(self) -> List[str]:
        """获取错误列表"""
        return self.errors
    
    def get_warnings(self) -> List[str]:
        """获取警告列表"""
        return self.warnings
    
    def get_data_summary(self) -> dict:
        """获取数据摘要信息"""
        if self.df is None:
            return {}
        
        summary = {
            '总记录数': len(self.df),
            '日期范围': f"{self.df['日期'].min()} 至 {self.df['日期'].max()}",
            '总用电量(kWh)': round(self.df['用电量(kWh)'].sum(), 2),
            '平均日用电量(kWh)': round(self.df.groupby('日期')['用电量(kWh)'].sum().mean(), 2),
            '最高用电量时段': self._get_highest_consumption_hour(),
            '最低用电量时段': self._get_lowest_consumption_hour()
        }
        
        return summary
    
    def _get_highest_consumption_hour(self) -> str:
        """获取用电量最高的时段"""
        if self.df is None:
            return "N/A"
        
        hour_stats = self.df.groupby('小时')['用电量(kWh)'].mean()
        max_hour = hour_stats.idxmax()
        max_value = hour_stats.max()
        
        return f"{int(max_hour)}:00 时段 (平均 {round(max_value, 2)} kWh)"
    
    def _get_lowest_consumption_hour(self) -> str:
        """获取用电量最低的时段"""
        if self.df is None:
            return "N/A"
        
        hour_stats = self.df.groupby('小时')['用电量(kWh)'].mean()
        min_hour = hour_stats.idxmin()
        min_value = hour_stats.min()
        
        return f"{int(min_hour)}:00 时段 (平均 {round(min_value, 2)} kWh)"
