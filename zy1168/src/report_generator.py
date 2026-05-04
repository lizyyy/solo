import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')


class ReportGenerator:
    def __init__(self):
        self.task_type_names = {
            'regression': '回归任务',
            'classification': '分类任务'
        }
        
        self.model_names = {
            'linear_regression': '线性回归',
            'logistic_regression': '逻辑回归',
            'decision_tree': '决策树',
            'random_forest': '随机森林',
            'xgboost': 'XGBoost'
        }
    
    def generate_markdown(self, experiment):
        lines = []
        
        lines.append(f'# 机器学习实验报告 - {experiment["experiment_id"]}')
        lines.append('')
        lines.append(f'**创建时间**: {experiment.get("created_at", "N/A")}')
        lines.append(f'**任务类型**: {self.task_type_names.get(experiment.get("task_type"), experiment.get("task_type"))}')
        lines.append(f'**目标列**: {experiment.get("target_column", "N/A")}')
        lines.append(f'**特征列**: {", ".join(experiment.get("feature_columns", []))}')
        lines.append('')
        
        lines.append('## 1. 数据概况')
        lines.append('')
        data_shape = experiment.get('data_shape', {})
        lines.append(f'- 训练集样本数: {data_shape.get("train", "N/A")}')
        lines.append(f'- 测试集样本数: {data_shape.get("test", "N/A")}')
        lines.append('')
        
        preprocessor = experiment.get('preprocessor_info', {})
        if preprocessor.get('missing_values_handling'):
            lines.append('### 缺失值处理')
            lines.append('')
            for col, info in preprocessor['missing_values_handling'].items():
                lines.append(f'- **{col}**: {info.get("strategy")} (缺失数量: {info.get("missing_count")})')
            lines.append('')
        
        if preprocessor.get('encoding'):
            lines.append('### 编码处理')
            lines.append('')
            for col, method in preprocessor['encoding'].items():
                if isinstance(method, dict):
                    lines.append(f'- **{col}**: {method.get("type", "N/A")}')
                    if method.get('classes'):
                        lines.append(f'  - 类别: {", ".join(method["classes"])}')
                else:
                    lines.append(f'- **{col}**: {method}')
            lines.append('')
        
        lines.append('## 2. 模型对比')
        lines.append('')
        
        task_type = experiment.get('task_type')
        models = experiment.get('models', {})
        
        if task_type == 'regression':
            lines.append('| 模型 | MAE | MSE | RMSE | R² | MAPE |')
            lines.append('|------|-----|-----|------|----|------|')
            for model_name, model_data in models.items():
                metrics = model_data.get('metrics', {})
                lines.append(f'| {self.model_names.get(model_name, model_name)} | {metrics.get("MAE", "N/A"):.4f} | {metrics.get("MSE", "N/A"):.4f} | {metrics.get("RMSE", "N/A"):.4f} | {metrics.get("R2", "N/A"):.4f} | {metrics.get("MAPE", "N/A"):.2f}% |')
        else:
            lines.append('| 模型 | Accuracy | Precision | Recall | F1 | AUC |')
            lines.append('|------|----------|-----------|--------|----|-----|')
            for model_name, model_data in models.items():
                metrics = model_data.get('metrics', {})
                auc_value = metrics.get("AUC")
                auc_str = f'{auc_value:.4f}' if auc_value is not None else 'N/A'
                lines.append(f'| {self.model_names.get(model_name, model_name)} | {metrics.get("Accuracy", "N/A"):.4f} | {metrics.get("Precision", "N/A"):.4f} | {metrics.get("Recall", "N/A"):.4f} | {metrics.get("F1", "N/A"):.4f} | {auc_str} |')
        lines.append('')
        
        lines.append('## 3. 模型详情')
        lines.append('')
        
        for model_name, model_data in models.items():
            model_display_name = self.model_names.get(model_name, model_name)
            lines.append(f'### {model_display_name}')
            lines.append('')
            
            lines.append('#### 模型参数')
            lines.append('')
            model_params = model_data.get('model_params', {})
            if model_params:
                for param, value in model_params.items():
                    if isinstance(value, list):
                        if len(value) > 10:
                            value_str = f'[{", ".join(map(str, value[:5]))}, ...] (共{len(value)}个)'
                        else:
                            value_str = str(value)
                    else:
                        value_str = str(value)
                    lines.append(f'- **{param}**: {value_str}')
            else:
                lines.append('无可用参数信息')
            lines.append('')
            
            lines.append('#### 评估指标')
            lines.append('')
            metrics = model_data.get('metrics', {})
            for metric, value in metrics.items():
                if value is not None:
                    if metric == 'MAPE':
                        lines.append(f'- **{metric}**: {value:.2f}%')
                    else:
                        lines.append(f'- **{metric}**: {value:.6f}')
                else:
                    lines.append(f'- **{metric}**: N/A')
            lines.append('')
            
            feature_importance = model_data.get('feature_importance')
            if feature_importance:
                lines.append('#### 特征重要性')
                lines.append('')
                features = feature_importance.get('features', [])
                importance = feature_importance.get('importance', [])
                if features and importance:
                    lines.append('| 特征 | 重要性 |')
                    lines.append('|------|--------|')
                    for feat, imp in zip(features[:15], importance[:15]):
                        lines.append(f'| {feat} | {imp:.6f} |')
                    if len(features) > 15:
                        lines.append(f'*... 还有 {len(features) - 15} 个特征*')
                lines.append('')
            
            residuals = model_data.get('residuals')
            if residuals:
                lines.append('#### 残差统计')
                lines.append('')
                lines.append(f'- 残差均值: {residuals.get("mean", "N/A"):.6f}')
                lines.append(f'- 残差标准差: {residuals.get("std", "N/A"):.6f}')
                lines.append(f'- 残差最小值: {residuals.get("min", "N/A"):.6f}')
                lines.append(f'- 残差最大值: {residuals.get("max", "N/A"):.6f}')
                lines.append('')
            
            confusion_matrix_data = model_data.get('confusion_matrix')
            if confusion_matrix_data:
                lines.append('#### 混淆矩阵')
                lines.append('')
                matrix = confusion_matrix_data.get('matrix', [])
                labels = confusion_matrix_data.get('labels', [])
                if matrix and labels:
                    header = '| | ' + ' | '.join(map(str, labels)) + ' |'
                    separator = '|' + '|'.join(['---'] * (len(labels) + 1)) + '|'
                    lines.append(header)
                    lines.append(separator)
                    for i, row in enumerate(matrix):
                        row_str = f'| **{labels[i]}** | ' + ' | '.join(map(str, row)) + ' |'
                        lines.append(row_str)
                lines.append('')
        
        lines.append('## 4. 实验配置')
        lines.append('')
        lines.append(f'- **测试集比例**: {experiment.get("test_size", 0.2) * 100}%')
        lines.append(f'- **随机种子**: {experiment.get("random_state", 42)}')
        lines.append(f'- **模型数量**: {len(models)}')
        lines.append('')
        
        lines.append('---')
        lines.append('')
        lines.append(f'*报告生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
        
        return '\n'.join(lines)
    
    def generate_json(self, experiment):
        return json.dumps(experiment, indent=2, ensure_ascii=False)
