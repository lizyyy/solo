import pandas as pd
import numpy as np
from typing import Dict, List, Any
import logging
from .models import QualityIssue, QualityIssueType, ProcessingReport


class QualityControlEngine:
    def __init__(self, config: Dict[str, Any], logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.rules = self._initialize_rules()
        
    def _initialize_rules(self) -> List[Dict[str, Any]]:
        qc_config = self.config['quality_control']
        
        return [
            {
                'id': 'RULE_001',
                'name': '数据完整性检查',
                'description': '检查关键列是否存在缺失值',
                'severity': 'high',
                'check': self._rule_data_completeness
            },
            {
                'id': 'RULE_002',
                'name': '数值有效性检查',
                'description': '检查数值是否在合理范围内',
                'severity': 'high',
                'check': self._rule_numeric_validity
            },
            {
                'id': 'RULE_003',
                'name': '单位一致性检查',
                'description': '检查单位是否符合标准',
                'severity': 'medium',
                'check': self._rule_unit_consistency
            },
            {
                'id': 'RULE_004',
                'name': '重复记录检查',
                'description': '检查是否存在重复数据',
                'severity': 'medium',
                'check': self._rule_duplicate_detection
            },
            {
                'id': 'RULE_005',
                'name': '异常值检测',
                'description': '基于统计方法检测异常值',
                'severity': 'medium',
                'check': self._rule_outlier_detection
            },
            {
                'id': 'RULE_006',
                'name': '过敏原合规检查',
                'description': '检查是否包含禁用过敏原',
                'severity': 'high',
                'check': self._rule_allergen_compliance
            }
        ]
        
    def validate_dataframe(self, df: pd.DataFrame) -> List[QualityIssue]:
        self.logger.info("开始执行质控规则检查...")
        all_issues = []
        
        for rule in self.rules:
            self.logger.info(f"执行 {rule['id']}: {rule['name']}")
            issues = rule['check'](df)
            all_issues.extend(issues)
            
            if issues:
                self.logger.warning(f"  - 发现 {len(issues)} 个问题 (严重度: {rule['severity']})")
            else:
                self.logger.info(f"  - 通过检查")
        
        self.logger.info(f"质控检查完成，共发现 {len(all_issues)} 个问题")
        return all_issues
    
    def generate_quality_report(self, issues: List[QualityIssue]) -> Dict[str, Any]:
        if not issues:
            return {
                'total_issues': 0,
                'by_severity': {'high': 0, 'medium': 0, 'low': 0},
                'by_type': {},
                'summary': '所有质控规则通过'
            }
        
        by_type = {}
        for issue in issues:
            type_name = issue.issue_type.value
            if type_name not in by_type:
                by_type[type_name] = 0
            by_type[type_name] += 1
        
        summary = {
            'total_issues': len(issues),
            'issues': issues,
            'by_type': by_type,
            'needs_review': len(issues) > 0
        }
        
        return summary
    
    def _rule_data_completeness(self, df: pd.DataFrame) -> List[QualityIssue]:
        issues = []
        
        critical_cols = ['name', 'category']
        for col in critical_cols:
            if col in df.columns:
                missing = df[df[col].isna() | (df[col].astype(str).str.strip() == '')]
                for idx, row in missing.iterrows():
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.MISSING_VALUE,
                        description=f"关键列 '{col}' 存在缺失值",
                        ingredient_name=row.get('name', f"未知_{idx}"),
                        row_index=int(idx),
                        column=col
                    ))
        
        numeric_cols = ['protein', 'sodium', 'cost']
        for col in numeric_cols:
            if col in df.columns:
                missing = df[df[col].isna()]
                for idx, row in missing.iterrows():
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.MISSING_VALUE,
                        description=f"数值列 '{col}' 存在缺失值",
                        ingredient_name=row.get('name', f"未知_{idx}"),
                        row_index=int(idx),
                        column=col
                    ))
        
        return issues
    
    def _rule_numeric_validity(self, df: pd.DataFrame) -> List[QualityIssue]:
        issues = []
        
        numeric_ranges = {
            'protein': (0, 100),
            'sodium': (0, 5000),
            'cost': (0, 100),
            'weight': (0, 10000)
        }
        
        for col, (min_val, max_val) in numeric_ranges.items():
            if col in df.columns:
                for idx, row in df.iterrows():
                    val = row.get(col)
                    if pd.notna(val):
                        try:
                            num_val = float(val)
                            if num_val < min_val or num_val > max_val:
                                issues.append(QualityIssue(
                                    issue_type=QualityIssueType.OUTLIER,
                                    description=f"'{col}' 值 {num_val} 超出合理范围 [{min_val}, {max_val}]",
                                    ingredient_name=row.get('name', f"未知_{idx}"),
                                    row_index=int(idx),
                                    column=col,
                                    original_value=val
                                ))
                        except (ValueError, TypeError):
                            issues.append(QualityIssue(
                                issue_type=QualityIssueType.INVALID_RECORD,
                                description=f"'{col}' 值 '{val}' 不是有效数字",
                                ingredient_name=row.get('name', f"未知_{idx}"),
                                row_index=int(idx),
                                column=col,
                                original_value=val
                            ))
        
        return issues
    
    def _rule_unit_consistency(self, df: pd.DataFrame) -> List[QualityIssue]:
        issues = []
        
        allowed_units = self.config['quality_control']['allowed_units']
        
        unit_columns = {
            'protein_unit': 'protein',
            'sodium_unit': 'sodium',
            'cost_unit': 'cost'
        }
        
        for unit_col, value_col in unit_columns.items():
            if unit_col in df.columns:
                for idx, row in df.iterrows():
                    unit = row.get(unit_col)
                    if pd.notna(unit) and str(unit).strip():
                        unit_str = str(unit).strip()
                        if unit_str not in allowed_units.get(value_col, []):
                            issues.append(QualityIssue(
                                issue_type=QualityIssueType.UNIT_ERROR,
                                description=f"单位 '{unit_str}' 不在允许的单位列表中",
                                ingredient_name=row.get('name', f"未知_{idx}"),
                                row_index=int(idx),
                                column=unit_col,
                                original_value=unit_str
                            ))
        
        return issues
    
    def _rule_duplicate_detection(self, df: pd.DataFrame) -> List[QualityIssue]:
        issues = []
        
        key_cols = ['name', 'category', 'protein', 'sodium', 'cost']
        existing_cols = [col for col in key_cols if col in df.columns]
        
        if existing_cols:
            for idx, row in df.iterrows():
                key_values = tuple(str(row.get(col, '')) for col in existing_cols)
                duplicates = df[
                    (df[existing_cols].astype(str) == dict(zip(existing_cols, key_values))).all(axis=1)
                ]
                
                if len(duplicates) > 1 and idx != duplicates.index[0]:
                    issues.append(QualityIssue(
                        issue_type=QualityIssueType.DUPLICATE,
                        description="记录与其他记录重复",
                        ingredient_name=row.get('name', f"未知_{idx}"),
                        row_index=int(idx)
                    ))
        
        return issues
    
    def _rule_outlier_detection(self, df: pd.DataFrame) -> List[QualityIssue]:
        issues = []
        
        z_threshold = self.config['quality_control']['z_score_threshold']
        numeric_cols = ['protein', 'sodium', 'cost']
        
        for col in numeric_cols:
            if col in df.columns:
                values = pd.to_numeric(df[col], errors='coerce').dropna()
                
                if len(values) > 3:
                    mean = values.mean()
                    std = values.std()
                    
                    if std > 0:
                        for idx, row in df.iterrows():
                            val = row.get(col)
                            if pd.notna(val):
                                try:
                                    num_val = float(val)
                                    z_score = abs((num_val - mean) / std)
                                    
                                    if z_score > z_threshold:
                                        issues.append(QualityIssue(
                                            issue_type=QualityIssueType.OUTLIER,
                                            description=f"'{col}' 值 {num_val} 为异常值 (Z-score={z_score:.2f} > {z_threshold})",
                                            ingredient_name=row.get('name', f"未知_{idx}"),
                                            row_index=int(idx),
                                            column=col,
                                            original_value=val
                                        ))
                                except (ValueError, TypeError):
                                    pass
        
        return issues
    
    def _rule_allergen_compliance(self, df: pd.DataFrame) -> List[QualityIssue]:
        issues = []
        
        forbidden_allergens = self.config['allergens']['forbidden']
        
        if 'allergens' in df.columns:
            for idx, row in df.iterrows():
                allergens = str(row.get('allergens', '')).strip()
                
                if allergens and allergens != 'nan':
                    ingredient_allergens = [a.strip() for a in allergens.split(',')]
                    
                    for allergen in ingredient_allergens:
                        if allergen in forbidden_allergens:
                            issues.append(QualityIssue(
                                issue_type=QualityIssueType.ALLERGEN,
                                description=f"包含禁用过敏原: {allergen}",
                                ingredient_name=row.get('name', f"未知_{idx}"),
                                row_index=int(idx),
                                column='allergens',
                                original_value=allergen
                            ))
        
        return issues
