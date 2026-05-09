import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any
import logging
from .models import QualityIssue, QualityIssueType, ProcessingReport, Ingredient


class DataPreprocessor:
    def __init__(self, config: Dict[str, Any], logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.report = ProcessingReport()
        self.conversions = config['units']['conversions']
        
    def process(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, ProcessingReport]:
        self.logger.info("开始数据预处理...")
        self.report.total_records = len(df)
        
        df = self._remove_duplicates(df)
        df = self._handle_missing_values(df)
        df = self._convert_units(df)
        df = self._detect_and_handle_outliers(df)
        df = self._filter_allergens(df)
        df = self._final_validation(df)
        
        self.report.valid_records = len(df)
        self.report.invalid_records = self.report.total_records - len(df)
        
        self.logger.info(f"数据预处理完成: {self.report.valid_records}/{self.report.total_records} 条有效记录")
        
        return df, self.report
    
    def _remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("检查重复数据...")
        
        before_count = len(df)
        
        duplicates = df.duplicated(subset=['name', 'category', 'protein', 'sodium', 'cost'], keep='first')
        
        for idx in df[duplicates].index:
            row = df.loc[idx]
            issue = QualityIssue(
                issue_type=QualityIssueType.DUPLICATE,
                description=f"发现重复数据，与已有记录完全相同",
                ingredient_name=row.get('name', f"未知_{idx}"),
                row_index=int(idx),
                original_value=None
            )
            self.report.add_issue(issue)
            self.logger.warning(f"删除重复数据: {row.get('name')} (行 {idx})")
        
        df = df.drop_duplicates(subset=['name', 'category', 'protein', 'sodium', 'cost'], keep='first')
        
        self.report.removed_duplicates = before_count - len(df)
        
        if self.report.removed_duplicates > 0:
            self.logger.info(f"删除了 {self.report.removed_duplicates} 条重复数据")
            
        return df
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("处理缺失值...")
        
        df = df.copy()
        
        critical_cols = ['name', 'category']
        for col in critical_cols:
            missing = df[col].isna()
            for idx in df[missing].index:
                issue = QualityIssue(
                    issue_type=QualityIssueType.MISSING_VALUE,
                    description=f"关键列 '{col}' 存在缺失值，无法修复，记录已删除",
                    row_index=int(idx),
                    column=col
                )
                self.report.add_issue(issue)
                self.logger.warning(f"删除缺失关键信息的记录: 行 {idx}")
            df = df.dropna(subset=critical_cols)
        
        numeric_cols = ['protein', 'sodium', 'cost']
        for col in numeric_cols:
            if col in df.columns:
                missing_mask = df[col].isna()
                for idx in df[missing_mask].index:
                    row = df.loc[idx]
                    
                    category_mean = df[df['category'] == row['category']][col].mean()
                    
                    if pd.isna(category_mean):
                        category_mean = df[col].mean()
                    
                    if not pd.isna(category_mean):
                        df.loc[idx, col] = category_mean
                        
                        issue = QualityIssue(
                            issue_type=QualityIssueType.MISSING_VALUE,
                            description=f"'{col}' 缺失值已用同类别的平均值 {category_mean:.2f} 填充",
                            ingredient_name=row.get('name'),
                            row_index=int(idx),
                            column=col,
                            original_value=None
                        )
                        self.report.add_issue(issue)
                        self.report.filled_missing_values += 1
                        self.logger.info(f"填充缺失值: {row['name']} 的 {col} = {category_mean:.2f}")
                    else:
                        issue = QualityIssue(
                            issue_type=QualityIssueType.MISSING_VALUE,
                            description=f"'{col}' 无法填充，记录标记为无效",
                            ingredient_name=row.get('name'),
                            row_index=int(idx),
                            column=col
                        )
                        self.report.add_issue(issue)
                        self.logger.warning(f"无法填充缺失值: {row['name']} 的 {col}")
        
        return df
    
    def _convert_units(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("统一单位...")
        
        df = df.copy()
        
        units_config = self.config['units']
        
        for idx, row in df.iterrows():
            try:
                if 'protein_unit' in df.columns and pd.notna(row.get('protein_unit')):
                    current_unit = row['protein_unit'].strip()
                    target_unit = units_config['protein_base']
                    
                    if current_unit != target_unit:
                        converted_value = self._convert_value(row['protein'], current_unit, target_unit, 'protein')
                        if converted_value is not None:
                            df.loc[idx, 'protein'] = converted_value
                            df.loc[idx, 'protein_unit'] = target_unit
                            
                            issue = QualityIssue(
                                issue_type=QualityIssueType.UNIT_ERROR,
                                description=f"蛋白质单位从 {current_unit} 转换为 {target_unit}",
                                ingredient_name=row.get('name'),
                                row_index=int(idx),
                                column='protein',
                                original_value=f"{row['protein']} {current_unit}"
                            )
                            self.report.add_issue(issue)
                            self.report.converted_units += 1
                
                if 'sodium_unit' in df.columns and pd.notna(row.get('sodium_unit')):
                    current_unit = row['sodium_unit'].strip()
                    target_unit = units_config['sodium_base']
                    
                    if current_unit != target_unit:
                        converted_value = self._convert_value(row['sodium'], current_unit, target_unit, 'sodium')
                        if converted_value is not None:
                            df.loc[idx, 'sodium'] = converted_value
                            df.loc[idx, 'sodium_unit'] = target_unit
                            
                            issue = QualityIssue(
                                issue_type=QualityIssueType.UNIT_ERROR,
                                description=f"钠含量单位从 {current_unit} 转换为 {target_unit}",
                                ingredient_name=row.get('name'),
                                row_index=int(idx),
                                column='sodium',
                                original_value=f"{row['sodium']} {current_unit}"
                            )
                            self.report.add_issue(issue)
                            self.report.converted_units += 1
                
                if 'cost_unit' in df.columns and pd.notna(row.get('cost_unit')):
                    current_unit = row['cost_unit'].strip()
                    target_unit = units_config['cost_base']
                    
                    if current_unit != target_unit:
                        converted_value = self._convert_value(row['cost'], current_unit, target_unit, 'cost')
                        if converted_value is not None:
                            df.loc[idx, 'cost'] = converted_value
                            df.loc[idx, 'cost_unit'] = target_unit
                            
                            issue = QualityIssue(
                                issue_type=QualityIssueType.UNIT_ERROR,
                                description=f"成本单位从 {current_unit} 转换为 {target_unit}",
                                ingredient_name=row.get('name'),
                                row_index=int(idx),
                                column='cost',
                                original_value=f"{row['cost']} {current_unit}"
                            )
                            self.report.add_issue(issue)
                            self.report.converted_units += 1
                            
            except Exception as e:
                issue = QualityIssue(
                    issue_type=QualityIssueType.UNIT_ERROR,
                    description=f"单位转换失败: {str(e)}",
                    ingredient_name=row.get('name'),
                    row_index=int(idx)
                )
                self.report.add_issue(issue)
                self.logger.error(f"单位转换失败: {row.get('name')} - {e}")
        
        if self.report.converted_units > 0:
            self.logger.info(f"完成 {self.report.converted_units} 次单位转换")
            
        return df
    
    def _convert_value(self, value: float, from_unit: str, to_unit: str, field_type: str) -> float:
        if pd.isna(value):
            return None
        
        key = f"{from_unit}_to_{to_unit}"
        if key in self.conversions:
            return value * self.conversions[key]
        
        reverse_key = f"{to_unit}_to_{from_unit}"
        if reverse_key in self.conversions:
            return value / self.conversions[reverse_key]
        
        self.logger.warning(f"未找到 {from_unit} 到 {to_unit} 的转换规则，保持原值")
        return value
    
    def _detect_and_handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("检测异常值...")
        
        df = df.copy()
        
        z_threshold = self.config['quality_control']['z_score_threshold']
        numeric_cols = ['protein', 'sodium', 'cost']
        
        for col in numeric_cols:
            if col in df.columns:
                col_values = df[col].dropna()
                
                if len(col_values) > 3:
                    mean = col_values.mean()
                    std = col_values.std()
                    
                    if std > 0:
                        z_scores = np.abs((col_values - mean) / std)
                        
                        outliers = z_scores > z_threshold
                        outlier_indices = col_values[outliers].index
                        
                        for idx in outlier_indices:
                            row = df.loc[idx]
                            value = row[col]
                            
                            issue = QualityIssue(
                                issue_type=QualityIssueType.OUTLIER,
                                description=f"{col}={value:.2f} 为异常值 (Z-score > {z_threshold})",
                                ingredient_name=row.get('name'),
                                row_index=int(idx),
                                column=col,
                                original_value=value
                            )
                            self.report.add_issue(issue)
                            self.report.removed_outliers += 1
                            self.logger.warning(f"检测到异常值: {row['name']} 的 {col}={value:.2f}")
                        
                        df = df.drop(outlier_indices)
        
        if self.report.removed_outliers > 0:
            self.logger.info(f"移除了 {self.report.removed_outliers} 条包含异常值的记录")
            
        return df
    
    def _filter_allergens(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("过敏原过滤...")
        
        df = df.copy()
        
        forbidden_allergens = self.config['allergens']['forbidden']
        
        if 'allergens' in df.columns:
            removed_indices = []
            
            for idx, row in df.iterrows():
                allergens = str(row.get('allergens', '')).strip()
                
                if allergens and allergens != 'nan':
                    ingredient_allergens = [a.strip() for a in allergens.split(',')]
                    
                    found_forbidden = [a for a in ingredient_allergens if a in forbidden_allergens]
                    
                    if found_forbidden:
                        issue = QualityIssue(
                            issue_type=QualityIssueType.ALLERGEN,
                            description=f"包含禁用过敏原: {', '.join(found_forbidden)}",
                            ingredient_name=row.get('name'),
                            row_index=int(idx),
                            column='allergens',
                            original_value=allergens
                        )
                        self.report.add_issue(issue)
                        self.report.removed_allergens += 1
                        removed_indices.append(idx)
                        self.logger.info(f"过滤过敏原: {row['name']} 包含 {', '.join(found_forbidden)}")
            
            df = df.drop(removed_indices)
        
        if self.report.removed_allergens > 0:
            self.logger.info(f"过滤了 {self.report.removed_allergens} 条含过敏原的记录")
            
        return df
    
    def _final_validation(self, df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("最终数据验证...")
        
        df = df.copy()
        
        required_cols = ['protein', 'sodium', 'cost']
        for col in required_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
                invalid_mask = (df[col] < 0) | df[col].isna()
                for idx in df[invalid_mask].index:
                    row = df.loc[idx]
                    issue = QualityIssue(
                        issue_type=QualityIssueType.INVALID_RECORD,
                        description=f"{col} 值无效或为负数: {row.get(col)}",
                        ingredient_name=row.get('name'),
                        row_index=int(idx),
                        column=col
                    )
                    self.report.add_issue(issue)
                
                df = df[~invalid_mask]
        
        return df
    
    def dataframe_to_ingredients(self, df: pd.DataFrame) -> List[Ingredient]:
        ingredients = []
        
        for _, row in df.iterrows():
            allergens = []
            if pd.notna(row.get('allergens')):
                allergen_str = str(row['allergens']).strip()
                if allergen_str and allergen_str != 'nan':
                    allergens = [a.strip() for a in allergen_str.split(',')]
            
            ingredient = Ingredient(
                id=str(row.get('ingredient_id', len(ingredients) + 1)),
                name=row.get('name', '未知'),
                category=row.get('category', '未知'),
                protein=float(row.get('protein', 0)),
                sodium=float(row.get('sodium', 0)),
                cost=float(row.get('cost', 0)),
                weight=float(row.get('weight', 100)),
                protein_unit=str(row.get('protein_unit', 'g')),
                sodium_unit=str(row.get('sodium_unit', 'mg')),
                cost_unit=str(row.get('cost_unit', 'USD')),
                allergens=allergens,
                notes=str(row.get('notes', ''))
            )
            ingredients.append(ingredient)
        
        return ingredients
