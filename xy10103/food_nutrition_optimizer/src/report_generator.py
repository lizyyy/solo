import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
from typing import Dict, List, Any
import logging
from datetime import datetime
import os
from .models import RecipeResult, ProcessingReport, QualityIssue, QualityIssueType


class ReportGenerator:
    def __init__(self, config: Dict[str, Any], logger: logging.Logger, output_dir: str = "reports"):
        self.config = config
        self.logger = logger
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
        sns.set_style("whitegrid")
        
    def generate_complete_report(self, 
                                  original_df: pd.DataFrame,
                                  processed_df: pd.DataFrame,
                                  processing_report: ProcessingReport,
                                  recipe_result: RecipeResult,
                                  qc_issues: List[QualityIssue]) -> Dict[str, str]:
        self.logger.info("开始生成完整报告...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        output_files = {}
        
        try:
            html_path = self._generate_html_report(
                original_df, processed_df, processing_report, 
                recipe_result, qc_issues, timestamp
            )
            output_files['html'] = html_path
            self.logger.info(f"HTML报告已生成: {html_path}")
        except Exception as e:
            self.logger.error(f"生成HTML报告失败: {e}")
        
        try:
            excel_path = self._generate_excel_report(
                original_df, processed_df, processing_report, 
                recipe_result, qc_issues, timestamp
            )
            output_files['excel'] = excel_path
            self.logger.info(f"Excel报告已生成: {excel_path}")
        except Exception as e:
            self.logger.error(f"生成Excel报告失败: {e}")
        
        try:
            chart_path = self._generate_charts(
                original_df, processed_df, processing_report, 
                recipe_result, qc_issues, timestamp
            )
            output_files['charts'] = chart_path
            self.logger.info(f"图表已生成: {chart_path}")
        except Exception as e:
            self.logger.error(f"生成图表失败: {e}")
        
        return output_files
    
    def _generate_html_report(self, 
                               original_df: pd.DataFrame,
                               processed_df: pd.DataFrame,
                               processing_report: ProcessingReport,
                               recipe_result: RecipeResult,
                               qc_issues: List[QualityIssue],
                               timestamp: str) -> str:
        
        html_content = self._build_html_content(
            original_df, processed_df, processing_report, 
            recipe_result, qc_issues, timestamp
        )
        
        filename = f"nutrition_recipe_report_{timestamp}.html"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return filepath
    
    def _build_html_content(self,
                            original_df: pd.DataFrame,
                            processed_df: pd.DataFrame,
                            processing_report: ProcessingReport,
                            recipe_result: RecipeResult,
                            qc_issues: List[QualityIssue],
                            timestamp: str) -> str:
        
        html_parts = []
        
        html_parts.append(f'''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>食品营养配方优化报告 - {timestamp}</title>
    <style>
        body {{
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            text-align: center;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            padding-left: 15px;
            border-left: 4px solid #3498db;
        }}
        h3 {{
            color: #555;
            margin-top: 20px;
        }}
        .summary-box {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin: 20px 0;
        }}
        .stat-card {{
            flex: 1;
            min-width: 200px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            text-align: center;
        }}
        .stat-card.success {{ background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }}
        .stat-card.warning {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }}
        .stat-card.info {{ background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }}
        .stat-value {{ font-size: 32px; font-weight: bold; }}
        .stat-label {{ font-size: 14px; opacity: 0.9; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:hover {{ background-color: #f5f5f5; }}
        .issue-table {{ font-size: 14px; }}
        .issue-table .warning {{ background-color: #fff3cd; }}
        .issue-table .error {{ background-color: #f8d7da; }}
        .issue-table .info {{ background-color: #d4edda; }}
        .constraint-item {{
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            border-left: 5px solid;
        }}
        .constraint-item.satisfied {{ background-color: #d4edda; border-color: #28a745; }}
        .constraint-item.violated {{ background-color: #f8d7da; border-color: #dc3545; }}
        .ingredient-list {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .ingredient-badge {{
            padding: 8px 15px;
            background-color: #e8f4fd;
            border-radius: 20px;
            border: 1px solid #3498db;
        }}
        .timestamp {{
            text-align: center;
            color: #888;
            font-size: 12px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🥗 食品营养配方优化报告</h1>
        
        <div class="summary-box">
            <div class="stat-card {('success' if recipe_result.is_feasible else 'warning')}">
                <div class="stat-value">{'✓' if recipe_result.is_feasible else '✗'}</div>
                <div class="stat-label">优化状态</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">{processing_report.total_records}</div>
                <div class="stat-label">原始记录数</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">{processing_report.valid_records}</div>
                <div class="stat-label">有效记录数</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">{len(qc_issues)}</div>
                <div class="stat-label">质量问题数</div>
            </div>
        </div>
''')
        
        if recipe_result.is_feasible:
            html_parts.append(f'''
        <h2>📊 最优配方结果</h2>
        
        <h3>配方组成</h3>
        <div class="ingredient-list">
''')
            for ing, prop in recipe_result.proportions.items():
                percentage = (prop / recipe_result.total_weight) * 100
                html_parts.append(f'''
            <span class="ingredient-badge">{ing}: {prop:.2f}g ({percentage:.1f}%)</span>
''')
            
            html_parts.append(f'''
        </div>
        
        <h3>营养指标</h3>
''')
            for constraint in recipe_result.constraints:
                status_class = 'satisfied' if constraint.is_satisfied else 'violated'
                status_text = '✓ 满足' if constraint.is_satisfied else '✗ 不满足'
                current = constraint.current_value if constraint.current_value else 0
                html_parts.append(f'''
        <div class="constraint-item {status_class}">
            <strong>{constraint.name}</strong> ({status_text})<br>
            当前值: {current:.2f} {constraint.unit}<br>
            约束范围: {constraint.min_value:.2f} - {constraint.max_value:.2f} {constraint.unit}
        </div>
''')
        else:
            html_parts.append(f'''
        <h2>❌ 配方优化失败</h2>
        <div class="constraint-item violated">
            <strong>失败原因:</strong><br>
            {recipe_result.notes}
        </div>
''')
        
        html_parts.append(f'''
        <h2>📋 数据处理报告</h2>
        
        <table>
            <thead>
                <tr>
                    <th>处理步骤</th>
                    <th>数量</th>
                    <th>说明</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>总记录数</td><td>{processing_report.total_records}</td><td>原始输入数据</td></tr>
                <tr><td>有效记录数</td><td>{processing_report.valid_records}</td><td>可用于优化的数据</td></tr>
                <tr><td>删除重复记录</td><td>{processing_report.removed_duplicates}</td><td>完全相同的重复数据</td></tr>
                <tr><td>填充缺失值</td><td>{processing_report.filled_missing_values}</td><td>使用类别平均值填充</td></tr>
                <tr><td>单位转换</td><td>{processing_report.converted_units}</td><td>统一到标准单位</td></tr>
                <tr><td>移除异常值</td><td>{processing_report.removed_outliers}</td><td>Z-score > 3.0 的数据</td></tr>
                <tr><td>过滤过敏原</td><td>{processing_report.removed_allergens}</td><td>含禁用过敏原的食材</td></tr>
            </tbody>
        </table>
''')
        
        if qc_issues:
            issues_by_type = processing_report.get_issues_by_type()
            
            html_parts.append(f'''
        <h2>⚠️ 质量问题详情</h2>
''')
            
            for issue_type, issues in issues_by_type.items():
                html_parts.append(f'''
        <h3>{issue_type} ({len(issues)}个问题)</h3>
        <table class="issue-table">
            <thead>
                <tr>
                    <th>序号</th>
                    <th>食材名称</th>
                    <th>行号</th>
                    <th>列名</th>
                    <th>问题描述</th>
                </tr>
            </thead>
            <tbody>
''')
                for i, issue in enumerate(issues, 1):
                    html_parts.append(f'''
                <tr>
                    <td>{i}</td>
                    <td>{issue.ingredient_name or '-'}</td>
                    <td>{issue.row_index or '-'}</td>
                    <td>{issue.column or '-'}</td>
                    <td>{issue.description}</td>
                </tr>
''')
                html_parts.append(f'''
            </tbody>
        </table>
''')
        
        html_parts.append(f'''
        <h2>🔍 质控规则检查</h2>
        <table>
            <thead>
                <tr>
                    <th>规则ID</th>
                    <th>规则名称</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>RULE_001</td><td>数据完整性检查</td><td>{'✗ 发现问题' if any(i.issue_type == QualityIssueType.MISSING_VALUE for i in qc_issues) else '✓ 通过'}</td></tr>
                <tr><td>RULE_002</td><td>数值有效性检查</td><td>{'✗ 发现问题' if any(i.issue_type in [QualityIssueType.OUTLIER, QualityIssueType.INVALID_RECORD] for i in qc_issues) else '✓ 通过'}</td></tr>
                <tr><td>RULE_003</td><td>单位一致性检查</td><td>{'✗ 发现问题' if any(i.issue_type == QualityIssueType.UNIT_ERROR for i in qc_issues) else '✓ 通过'}</td></tr>
                <tr><td>RULE_004</td><td>重复记录检查</td><td>{'✗ 发现问题' if any(i.issue_type == QualityIssueType.DUPLICATE for i in qc_issues) else '✓ 通过'}</td></tr>
                <tr><td>RULE_005</td><td>异常值检测</td><td>{'✗ 发现问题' if any(i.issue_type == QualityIssueType.OUTLIER for i in qc_issues) else '✓ 通过'}</td></tr>
                <tr><td>RULE_006</td><td>过敏原合规检查</td><td>{'✗ 发现问题' if any(i.issue_type == QualityIssueType.ALLERGEN for i in qc_issues) else '✓ 通过'}</td></tr>
            </tbody>
        </table>
        
        <div class="timestamp">
            报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br>
            报告版本: 1.0.0
        </div>
    </div>
</body>
</html>
''')
        
        return ''.join(html_parts)
    
    def _generate_excel_report(self,
                               original_df: pd.DataFrame,
                               processed_df: pd.DataFrame,
                               processing_report: ProcessingReport,
                               recipe_result: RecipeResult,
                               qc_issues: List[QualityIssue],
                               timestamp: str) -> str:
        
        filename = f"nutrition_recipe_report_{timestamp}.xlsx"
        filepath = os.path.join(self.output_dir, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            
            summary_data = {
                '指标': [
                    '总记录数', '有效记录数', '无效记录数', '删除重复记录',
                    '填充缺失值', '单位转换', '移除异常值', '过滤过敏原',
                    '优化状态', '优化耗时(秒)'
                ],
                '数值': [
                    processing_report.total_records, processing_report.valid_records,
                    processing_report.invalid_records, processing_report.removed_duplicates,
                    processing_report.filled_missing_values, processing_report.converted_units,
                    processing_report.removed_outliers, processing_report.removed_allergens,
                    '成功' if recipe_result.is_feasible else '失败',
                    f"{recipe_result.optimization_time:.2f}"
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='概览', index=False)
            
            if recipe_result.is_feasible:
                recipe_data = {
                    '食材名称': list(recipe_result.proportions.keys()),
                    '用量(g)': list(recipe_result.proportions.values()),
                    '占比(%)': [
                        (v / recipe_result.total_weight) * 100 
                        for v in recipe_result.proportions.values()
                    ]
                }
                pd.DataFrame(recipe_data).to_excel(writer, sheet_name='最优配方', index=False)
                
                constraints_data = {
                    '约束名称': [c.name for c in recipe_result.constraints],
                    '当前值': [f"{c.current_value:.2f} {c.unit}" if c.current_value else '-' 
                              for c in recipe_result.constraints],
                    '最小值': [f"{c.min_value:.2f} {c.unit}" for c in recipe_result.constraints],
                    '最大值': [f"{c.max_value:.2f} {c.unit}" for c in recipe_result.constraints],
                    '是否满足': ['是' if c.is_satisfied else '否' for c in recipe_result.constraints]
                }
                pd.DataFrame(constraints_data).to_excel(writer, sheet_name='约束满足情况', index=False)
            else:
                pd.DataFrame({'失败原因': [recipe_result.notes]}).to_excel(
                    writer, sheet_name='优化结果', index=False
                )
            
            if qc_issues:
                issues_data = {
                    '问题类型': [i.issue_type.value for i in qc_issues],
                    '食材名称': [i.ingredient_name or '-' for i in qc_issues],
                    '行号': [i.row_index or '-' for i in qc_issues],
                    '列名': [i.column or '-' for i in qc_issues],
                    '问题描述': [i.description for i in qc_issues]
                }
                pd.DataFrame(issues_data).to_excel(writer, sheet_name='质量问题', index=False)
            
            original_df.to_excel(writer, sheet_name='原始数据', index=False)
            processed_df.to_excel(writer, sheet_name='处理后数据', index=False)
        
        return filepath
    
    def _generate_charts(self,
                         original_df: pd.DataFrame,
                         processed_df: pd.DataFrame,
                         processing_report: ProcessingReport,
                         recipe_result: RecipeResult,
                         qc_issues: List[QualityIssue],
                         timestamp: str) -> str:
        
        charts_dir = os.path.join(self.output_dir, f"charts_{timestamp}")
        os.makedirs(charts_dir, exist_ok=True)
        
        self._create_data_quality_chart(processing_report, qc_issues, charts_dir)
        
        if recipe_result.is_feasible:
            self._create_recipe_chart(recipe_result, charts_dir)
            self._create_constraints_chart(recipe_result, charts_dir)
        
        if 'category' in processed_df.columns:
            self._create_category_distribution_chart(processed_df, charts_dir)
        
        return charts_dir
    
    def _create_data_quality_chart(self,
                                    processing_report: ProcessingReport,
                                    qc_issues: List[QualityIssue],
                                    charts_dir: str):
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        processing_labels = ['有效记录', '删除重复', '填充缺失', '单位转换', '移除异常', '过敏原过滤']
        processing_values = [
            processing_report.valid_records,
            processing_report.removed_duplicates,
            processing_report.filled_missing_values,
            processing_report.converted_units,
            processing_report.removed_outliers,
            processing_report.removed_allergens
        ]
        colors = ['#28a745', '#ffc107', '#17a2b8', '#007bff', '#dc3545', '#6f42c1']
        
        bars = ax1.bar(processing_labels, processing_values, color=colors, alpha=0.8)
        ax1.set_ylabel('记录数量')
        ax1.set_title('数据处理统计')
        ax1.tick_params(axis='x', rotation=45)
        
        for bar in bars:
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height)}',
                    ha='center', va='bottom')
        
        ax2 = axes[1]
        if qc_issues:
            issues_by_type = processing_report.get_issues_by_type()
            issue_types = list(issues_by_type.keys())
            issue_counts = [len(v) for v in issues_by_type.values()]
            
            bars2 = ax2.bar(issue_types, issue_counts, color='#dc3545', alpha=0.7)
            ax2.set_ylabel('问题数量')
            ax2.set_title('质量问题类型分布')
            ax2.tick_params(axis='x', rotation=45)
            
            for bar in bars2:
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{int(height)}',
                        ha='center', va='bottom')
        else:
            ax2.text(0.5, 0.5, '无质量问题', ha='center', va='center', fontsize=14, color='#28a745')
            ax2.set_title('质量问题类型分布')
        
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'data_quality.png'), dpi=150, bbox_inches='tight')
        plt.close()
    
    def _create_recipe_chart(self, recipe_result: RecipeResult, charts_dir: str):
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        ingredients = list(recipe_result.proportions.keys())
        proportions = list(recipe_result.proportions.values())
        
        colors = plt.cm.Set3(np.linspace(0, 1, len(ingredients)))
        wedges, texts, autotexts = ax1.pie(
            proportions, labels=ingredients, autopct='%1.1f%%',
            colors=colors, startangle=90
        )
        ax1.set_title('配方成分占比')
        
        ax2 = axes[1]
        bars = ax2.bar(ingredients, proportions, color=colors, alpha=0.8)
        ax2.set_ylabel('用量 (g)')
        ax2.set_title('各成分用量')
        ax2.tick_params(axis='x', rotation=45)
        
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}g',
                    ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'recipe_composition.png'), dpi=150, bbox_inches='tight')
        plt.close()
    
    def _create_constraints_chart(self, recipe_result: RecipeResult, charts_dir: str):
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        constraint_names = [c.name for c in recipe_result.constraints]
        current_values = [c.current_value or 0 for c in recipe_result.constraints]
        min_values = [c.min_value for c in recipe_result.constraints]
        max_values = [c.max_value for c in recipe_result.constraints]
        
        x = np.arange(len(constraint_names))
        width = 0.25
        
        bars1 = ax.bar(x - width, min_values, width, label='最小值', color='#17a2b8', alpha=0.7)
        bars2 = ax.bar(x, current_values, width, label='当前值', color='#28a745', alpha=0.9)
        bars3 = ax.bar(x + width, max_values, width, label='最大值', color='#ffc107', alpha=0.7)
        
        ax.set_ylabel('数值')
        ax.set_title('约束满足情况对比')
        ax.set_xticks(x)
        ax.set_xticklabels(constraint_names)
        ax.legend()
        
        for i, (bar, constraint) in enumerate(zip(bars2, recipe_result.constraints)):
            status = '✓' if constraint.is_satisfied else '✗'
            color = '#28a745' if constraint.is_satisfied else '#dc3545'
            ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() * 1.02,
                    status, ha='center', va='bottom', fontsize=16, color=color)
        
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'constraints_comparison.png'), dpi=150, bbox_inches='tight')
        plt.close()
    
    def _create_category_distribution_chart(self, df: pd.DataFrame, charts_dir: str):
        
        fig, axes = plt.subplots(1, 3, figsize=(18, 6))
        
        category_counts = df['category'].value_counts()
        
        ax1 = axes[0]
        category_counts.plot(kind='bar', ax=ax1, color='#3498db', alpha=0.8)
        ax1.set_title('食材类别分布')
        ax1.set_ylabel('数量')
        ax1.tick_params(axis='x', rotation=45)
        
        ax2 = axes[1]
        if 'protein' in df.columns and 'category' in df.columns:
            cat_protein = df.groupby('category')['protein'].mean().sort_values(ascending=False)
            cat_protein.plot(kind='bar', ax=ax2, color='#e74c3c', alpha=0.8)
            ax2.set_title('各类别平均蛋白质含量')
            ax2.set_ylabel('蛋白质 (g/100g)')
            ax2.tick_params(axis='x', rotation=45)
        
        ax3 = axes[2]
        if 'cost' in df.columns and 'category' in df.columns:
            cat_cost = df.groupby('category')['cost'].mean().sort_values(ascending=False)
            cat_cost.plot(kind='bar', ax=ax3, color='#2ecc71', alpha=0.8)
            ax3.set_title('各类别平均成本')
            ax3.set_ylabel('成本 (USD/100g)')
            ax3.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plt.savefig(os.path.join(charts_dir, 'category_analysis.png'), dpi=150, bbox_inches='tight')
        plt.close()
