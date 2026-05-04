import os
import json
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
from ..experiments import Experiment, ExperimentManager

class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = output_dir
        
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_markdown_report(self, experiment: Experiment, 
                                  include_history: bool = True,
                                  include_analysis: bool = True) -> str:
        state = experiment.get_state()
        history = experiment.get_history()
        behavior = experiment.analyze_behavior() if include_analysis else {}
        warnings = experiment.validate_configuration()
        
        report_lines = []
        report_lines.append(f"# 优化器实验报告: {experiment.name}")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().isoformat()}")
        report_lines.append(f"**实验ID**: {experiment.id}")
        report_lines.append(f"**创建时间**: {experiment.created_at}")
        report_lines.append(f"**更新时间**: {experiment.updated_at}")
        report_lines.append("")
        
        report_lines.append("## 1. 配置信息")
        report_lines.append("")
        report_lines.append("### 1.1 优化器配置")
        report_lines.append("")
        if state.get('optimizer_type'):
            report_lines.append(f"- **类型**: {state['optimizer_type']}")
            if state.get('optimizer'):
                opt = state['optimizer']
                report_lines.append(f"- **学习率**: {opt.get('learning_rate', 'N/A')}")
                if 'momentum' in opt:
                    report_lines.append(f"- **动量**: {opt['momentum']}")
                if 'beta' in opt:
                    report_lines.append(f"- **Beta**: {opt['beta']}")
                if 'beta1' in opt:
                    report_lines.append(f"- **Beta1**: {opt['beta1']}")
                if 'beta2' in opt:
                    report_lines.append(f"- **Beta2**: {opt['beta2']}")
                if 'epsilon' in opt:
                    report_lines.append(f"- **Epsilon**: {opt['epsilon']}")
                if opt.get('seed') is not None:
                    report_lines.append(f"- **随机种子**: {opt['seed']}")
        report_lines.append("")
        
        report_lines.append("### 1.2 训练配置")
        report_lines.append("")
        report_lines.append(f"- **Batch Size**: {state.get('batch_size', 'N/A')}")
        report_lines.append(f"- **总 Epochs**: {state.get('epochs', 'N/A')}")
        report_lines.append(f"- **已完成 Epochs**: {state.get('current_epoch', 'N/A')}")
        report_lines.append(f"- **运行状态**: {'已完成' if state.get('is_completed') else '运行中' if state.get('is_running') else '未开始'}")
        report_lines.append("")
        
        if warnings:
            report_lines.append("### 1.3 配置警告")
            report_lines.append("")
            for param, msg in warnings:
                report_lines.append(f"- ⚠️ **{param}**: {msg}")
            report_lines.append("")
        
        report_lines.append("## 2. 实验结果")
        report_lines.append("")
        
        if history and history.get('loss'):
            losses = history['loss']
            report_lines.append(f"- **初始 Loss**: {losses[0]:.6f}")
            report_lines.append(f"- **最终 Loss**: {losses[-1]:.6f}")
            report_lines.append(f"- **最小 Loss**: {min(losses):.6f}")
            report_lines.append(f"- **Loss 减少量**: {losses[0] - losses[-1]:.6f}")
            report_lines.append(f"- **Loss 减少比例**: {(losses[0] - losses[-1]) / losses[0] * 100 if losses[0] > 0 else 0:.2f}%")
            report_lines.append("")
        
        if include_analysis and behavior:
            report_lines.append("## 3. 行为分析")
            report_lines.append("")
            
            if behavior.get('status') == 'insufficient_data':
                report_lines.append("> 数据不足，无法进行完整分析")
                report_lines.append("")
            else:
                report_lines.append(f"- **震荡检测**: {'是' if behavior.get('oscillating') else '否'}")
                report_lines.append(f"- **收敛检测**: {'是' if behavior.get('converging') else '否'}")
                report_lines.append(f"- **停滞检测**: {'是' if behavior.get('stagnant') else '否'}")
                report_lines.append(f"- **Loss 趋势**: {behavior.get('loss_trend', 'N/A')}")
                report_lines.append("")
                
                if behavior.get('analysis'):
                    report_lines.append("### 3.1 详细分析")
                    report_lines.append("")
                    for analysis in behavior['analysis']:
                        report_lines.append(f"- {analysis}")
                    report_lines.append("")
        
        if include_history and history and history.get('loss'):
            report_lines.append("## 4. 训练历史")
            report_lines.append("")
            report_lines.append("### 4.1 Loss 曲线数据")
            report_lines.append("")
            report_lines.append("| Epoch | Loss |")
            report_lines.append("|-------|------|")
            
            losses = history['loss']
            step = max(1, len(losses) // 20)
            for i in range(0, len(losses), step):
                report_lines.append(f"| {i+1} | {losses[i]:.6f} |")
            if len(losses) > 0 and (len(losses) - 1) % step != 0:
                report_lines.append(f"| {len(losses)} | {losses[-1]:.6f} |")
            report_lines.append("")
            
            if history.get('parameters') and len(history['parameters']) > 0:
                report_lines.append("### 4.2 参数变化")
                report_lines.append("")
                params = history['parameters']
                report_lines.append(f"初始参数: {params[0]}")
                report_lines.append(f"")
                report_lines.append(f"最终参数: {params[-1]}")
                report_lines.append("")
        
        if experiment.metadata:
            report_lines.append("## 5. 元数据")
            report_lines.append("")
            for key, value in experiment.metadata.items():
                report_lines.append(f"- **{key}**: {value}")
            report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append(f"*报告生成时间: {datetime.now().isoformat()}*")
        
        return "\n".join(report_lines)
    
    def generate_comparison_report(self, manager: ExperimentManager, 
                                    experiment_ids: List[str],
                                    format: str = "markdown") -> str:
        comparison = manager.compare_experiments(experiment_ids)
        
        if 'error' in comparison:
            return f"# 对比报告错误\n\n{comparison['error']}"
        
        if format == "json":
            return json.dumps(comparison, indent=2, ensure_ascii=False)
        
        report_lines = []
        report_lines.append("# 优化器对比实验报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().isoformat()}")
        report_lines.append(f"**参与对比的实验数**: {len(comparison.get('experiment_ids', []))}")
        report_lines.append("")
        
        report_lines.append("## 1. 实验概览")
        report_lines.append("")
        report_lines.append("| 实验名称 | 优化器类型 | 已完成 Epochs | 状态 |")
        report_lines.append("|----------|------------|---------------|------|")
        
        for i, exp_id in enumerate(comparison.get('experiment_ids', [])):
            name = comparison.get('experiment_names', [])[i] if i < len(comparison.get('experiment_names', [])) else 'N/A'
            opt_type = comparison.get('optimizer_types', [])[i] if i < len(comparison.get('optimizer_types', [])) else 'N/A'
            
            exp = manager.get_experiment(exp_id)
            epochs = exp.current_epoch if exp else 'N/A'
            status = '已完成' if (exp and exp.is_completed) else '运行中' if (exp and exp.is_running) else '未完成'
            
            report_lines.append(f"| {name} | {opt_type} | {epochs} | {status} |")
        report_lines.append("")
        
        report_lines.append("## 2. 性能对比")
        report_lines.append("")
        
        metrics = comparison.get('metrics', [])
        if metrics:
            report_lines.append("| 排名 | 实验名称 | 优化器 | 最终 Loss | 初始 Loss | Loss 减少量 | 减少比例 | 震荡率 |")
            report_lines.append("|------|----------|--------|-----------|-----------|-------------|----------|--------|")
            
            for i, metric in enumerate(metrics):
                report_lines.append(f"| {i+1} | {metric['experiment_name']} | {metric['optimizer_type']} | {metric['final_loss']:.6f} | {metric['initial_loss']:.6f} | {metric['loss_reduction']:.6f} | {metric['loss_reduction_ratio']*100:.2f}% | {metric['oscillation_ratio']*100:.2f}% |")
            report_lines.append("")
        
        report_lines.append("## 3. 行为分析对比")
        report_lines.append("")
        
        behavior_analysis = comparison.get('behavior_analysis', {})
        for exp_id, analysis in behavior_analysis.items():
            name = analysis.get('name', exp_id)
            behavior = analysis.get('analysis', {})
            
            report_lines.append(f"### {name}")
            report_lines.append("")
            
            if behavior.get('status') == 'insufficient_data':
                report_lines.append("> 数据不足，无法进行完整分析")
            else:
                report_lines.append(f"- **震荡**: {'是' if behavior.get('oscillating') else '否'}")
                report_lines.append(f"- **收敛**: {'是' if behavior.get('converging') else '否'}")
                report_lines.append(f"- **停滞**: {'是' if behavior.get('stagnant') else '否'}")
                
                if behavior.get('analysis'):
                    report_lines.append("")
                    report_lines.append("**详细分析**:")
                    for a in behavior['analysis']:
                        report_lines.append(f"- {a}")
            report_lines.append("")
        
        report_lines.append("---")
        report_lines.append("")
        report_lines.append(f"*报告生成时间: {datetime.now().isoformat()}*")
        
        return "\n".join(report_lines)
    
    def save_report(self, report: str, filename: str, format: str = "markdown") -> str:
        if format == "markdown":
            if not filename.endswith('.md'):
                filename = filename + '.md'
        elif format == "json":
            if not filename.endswith('.json'):
                filename = filename + '.json'
        
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report)
        
        return filepath
    
    def generate_and_save_report(self, experiment: Experiment, 
                                  filename: Optional[str] = None,
                                  format: str = "markdown",
                                  include_history: bool = True,
                                  include_analysis: bool = True) -> str:
        if format == "json":
            report = json.dumps(experiment.get_state(), indent=2, ensure_ascii=False)
        else:
            report = self.generate_markdown_report(
                experiment, 
                include_history=include_history,
                include_analysis=include_analysis
            )
        
        if filename is None:
            filename = f"report_{experiment.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        return self.save_report(report, filename, format)
    
    def generate_and_save_comparison(self, manager: ExperimentManager,
                                       experiment_ids: List[str],
                                       filename: Optional[str] = None,
                                       format: str = "markdown") -> str:
        report = self.generate_comparison_report(manager, experiment_ids, format)
        
        if filename is None:
            filename = f"comparison_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        return self.save_report(report, filename, format)
    
    def __str__(self):
        return f"ReportGenerator(output_dir={self.output_dir})"
    
    def __repr__(self):
        return self.__str__()
