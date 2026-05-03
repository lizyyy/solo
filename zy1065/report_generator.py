import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import markdown2

from data_loader import DataLoader
from pricing_config import PricingConfig
from data_visualizer import DataVisualizer
from task_manager import TaskManager
from load_shifting_optimizer import (
    LoadShiftingOptimizer, 
    OptimizationResult, 
    OptimizationSummary
)


class ReportGenerator:
    """报告生成模块"""
    
    def __init__(self):
        self.generation_time = datetime.now()
    
    def generate_markdown_report(
        self,
        df: pd.DataFrame,
        pricing_config: PricingConfig,
        data_loader: DataLoader,
        visualizer: DataVisualizer,
        optimization_results: Optional[List[OptimizationResult]] = None,
        optimization_summary: Optional[OptimizationSummary] = None,
        task_manager: Optional[TaskManager] = None
    ) -> str:
        """
        生成 Markdown 格式的报告
        
        Args:
            df: 用电数据
            pricing_config: 电价配置
            data_loader: 数据加载器（用于获取摘要）
            visualizer: 数据可视化器（用于获取统计）
            optimization_results: 优化结果列表
            optimization_summary: 优化汇总
            task_manager: 任务管理器
            
        Returns:
            Markdown 格式的报告字符串
        """
        lines = []
        
        # 标题
        lines.append("# 电费分析报告")
        lines.append(f"**生成时间**: {self.generation_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 1. 数据摘要
        lines.append("## 1. 数据摘要")
        lines.append("")
        
        summary = data_loader.get_data_summary()
        if summary:
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 总记录数 | {summary.get('总记录数', 'N/A')} |")
            lines.append(f"| 日期范围 | {summary.get('日期范围', 'N/A')} |")
            lines.append(f"| 总用电量 | {summary.get('总用电量(kWh)', 'N/A')} kWh |")
            lines.append(f"| 平均日用电量 | {summary.get('平均日用电量(kWh)', 'N/A')} kWh |")
            lines.append(f"| 最高用电量时段 | {summary.get('最高用电量时段', 'N/A')} |")
            lines.append(f"| 最低用电量时段 | {summary.get('最低用电量时段', 'N/A')} |")
            lines.append("")
        
        # 2. 电价配置
        lines.append("## 2. 电价配置")
        lines.append("")
        
        time_slots = pricing_config.get_time_slots_as_list()
        if time_slots:
            lines.append("| 时段 | 开始时间 | 结束时间 | 电价 (元/kWh) | 覆盖小时 |")
            lines.append("|------|----------|----------|---------------|----------|")
            
            for slot in time_slots:
                hours_list = ', '.join([f"{h}:00" for h in slot['hours'][:5]])
                if len(slot['hours']) > 5:
                    hours_list += f" 等{len(slot['hours'])}个小时"
                
                lines.append(
                    f"| {slot['name']} | {slot['start_hour']}:00 | {slot['end_hour']}:00 | "
                    f"{slot['price']:.3f} | {hours_list} |"
                )
            lines.append("")
        
        # 检查时段覆盖
        is_covered, uncovered = pricing_config.validate_coverage()
        if not is_covered:
            lines.append(f"⚠️ **警告**: 以下小时未被任何时段覆盖: {', '.join([f'{h}:00' for h in uncovered])}")
            lines.append("")
        
        # 3. 峰谷用电分析
        lines.append("## 3. 峰谷用电分析")
        lines.append("")
        
        stats = visualizer.get_summary_statistics(df)
        if stats:
            lines.append(f"**总用电量**: {stats.get('总用电量(kWh)', 0):.2f} kWh")
            lines.append(f"**总电费**: ¥{stats.get('总电费(元)', 0):.2f}")
            lines.append(f"**平均日用电量**: {stats.get('平均日用电量(kWh)', 0):.2f} kWh")
            lines.append("")
            
            # 时段统计
            slot_stats = stats.get('时段统计', {})
            if slot_stats:
                lines.append("### 按时段统计")
                lines.append("")
                lines.append("| 时段 | 用电量 (kWh) | 电费 (元) | 占比 |")
                lines.append("|------|--------------|-----------|------|")
                
                total_consumption = stats.get('总用电量(kWh)', 1)
                total_cost = stats.get('总电费(元)', 1)
                
                for slot_name in slot_stats.get('用电量(kWh)', {}).keys() if slot_stats else []:
                    consumption = slot_stats.get('用电量(kWh)', {}).get(slot_name, {}).get('sum', 0)
                    cost = slot_stats.get('电费', {}).get(slot_name, 0)
                    
                    consumption_pct = consumption / total_consumption * 100 if total_consumption > 0 else 0
                    cost_pct = cost / total_cost * 100 if total_cost > 0 else 0
                    
                    lines.append(
                        f"| {slot_name} | {consumption:.2f} | ¥{cost:.2f} | "
                        f"用电 {consumption_pct:.1f}% / 电费 {cost_pct:.1f}% |"
                    )
                lines.append("")
        
        # 4. 异常高耗电时段
        lines.append("## 4. 异常高耗电时段")
        lines.append("")
        
        if stats:
            high_count = stats.get('异常高用电时段数', 0)
            mean_val = stats.get('用电平均值(kWh)', 0)
            std_val = stats.get('用电标准差(kWh)', 0)
            threshold = mean_val + 2 * std_val
            
            if high_count > 0:
                lines.append(f"⚠️ **发现 {high_count} 个异常高用电时段**")
                lines.append("")
                lines.append(f"- 用电平均值: {mean_val:.2f} kWh")
                lines.append(f"- 用电标准差: {std_val:.2f} kWh")
                lines.append(f"- 异常阈值 (平均值 + 2σ): {threshold:.2f} kWh")
                lines.append("")
                
                # 找出具体的异常时段
                mean_consumption = df['用电量(kWh)'].mean()
                std_consumption = df['用电量(kWh)'].std()
                high_threshold = mean_consumption + 2 * std_consumption
                
                high_values = df[df['用电量(kWh)'] > high_threshold]
                if not high_values.empty:
                    lines.append("### 异常时段详情")
                    lines.append("")
                    lines.append("| 日期 | 小时 | 用电量 (kWh) |")
                    lines.append("|------|------|--------------|")
                    
                    for _, row in high_values.head(10).iterrows():
                        lines.append(f"| {row['日期']} | {row['小时']}:00 | {row['用电量(kWh)']:.2f} |")
                    
                    if len(high_values) > 10:
                        lines.append(f"| ... | ... | 还有 {len(high_values) - 10} 条记录 |")
                    
                    lines.append("")
                    lines.append("**建议**: 这些时段的用电量显著高于平均水平，建议检查是否有大功率电器在这些时段运行，或是否存在设备故障。")
                    lines.append("")
            else:
                lines.append("✅ **未发现异常高用电时段**")
                lines.append("")
                lines.append(f"- 用电平均值: {mean_val:.2f} kWh")
                lines.append(f"- 用电标准差: {std_val:.2f} kWh")
                lines.append(f"- 异常阈值: {threshold:.2f} kWh")
                lines.append("")
        
        # 5. 错峰优化分析
        lines.append("## 5. 错峰优化分析")
        lines.append("")
        
        if optimization_summary and optimization_results:
            lines.append("### 优化效果汇总")
            lines.append("")
            lines.append(f"**优化任务数**: {optimization_summary.optimized_tasks} 个")
            lines.append(f"**优化前总费用**: ¥{optimization_summary.total_original_cost:.2f}")
            lines.append(f"**优化后总费用**: ¥{optimization_summary.total_optimized_cost:.2f}")
            lines.append(f"**预计节省**: ¥{optimization_summary.total_savings:.2f} ({optimization_summary.total_savings_percentage:.1f}%)")
            lines.append("")
            
            # 按时段统计
            if optimization_summary.tasks_by_slot:
                lines.append("### 优化后时段分布")
                lines.append("")
                lines.append("| 时段 | 任务数 | 节省金额 (元) |")
                lines.append("|------|--------|---------------|")
                
                for slot_name, task_count in optimization_summary.tasks_by_slot.items():
                    savings = optimization_summary.savings_by_slot.get(slot_name, 0)
                    lines.append(f"| {slot_name} | {task_count} | ¥{savings:.2f} |")
                lines.append("")
            
            # 问题任务
            if optimization_summary.tasks_with_issues:
                lines.append("### ⚠️ 需要注意的任务")
                lines.append("")
                for issue in optimization_summary.tasks_with_issues:
                    lines.append(f"- **{issue['task_name']}**: {issue['issue']}")
                    lines.append(f"  - 延迟时间: {issue['delay_hours']:.1f} 小时")
                    lines.append(f"  - 最大允许: {issue['max_allowed']:.1f} 小时")
                    lines.append("")
            
            # 各任务详情
            lines.append("### 各任务优化详情")
            lines.append("")
            lines.append("| 任务 | 原始时段 | 推荐时段 | 原始费用 | 优化费用 | 节省金额 | 节省比例 |")
            lines.append("|------|----------|----------|----------|----------|----------|----------|")
            
            for result in optimization_results:
                original_slot = result.original_slot_name or "未分类"
                optimized_slot = result.optimized_slot_name or "未分类"
                original_time = f"{result.original_start_hour}:00" if result.original_start_hour is not None else "N/A"
                optimized_time = f"{result.optimized_start_hour}:00"
                
                lines.append(
                    f"| {result.task_name} | {original_time} ({original_slot}) | "
                    f"{optimized_time} ({optimized_slot}) | ¥{result.original_cost:.2f} | "
                    f"¥{result.optimized_cost:.2f} | ¥{result.savings:.2f} | {result.savings_percentage:.1f}% |"
                )
            lines.append("")
        else:
            lines.append("*未执行错峰优化，请配置可挪动的用电任务后再进行优化分析。*")
            lines.append("")
            
            # 显示预设任务
            if task_manager:
                preset_tasks = task_manager.get_all_tasks()
                if preset_tasks:
                    lines.append("### 可用预设任务")
                    lines.append("")
                    lines.append("| 任务名称 | 用电量 (kWh) | 持续时间 (小时) | 可用时段 | 最大延迟 (小时) |")
                    lines.append("|----------|--------------|-----------------|----------|-----------------|")
                    
                    for task in preset_tasks:
                        window = f"{task.window_start_hour}:00-{task.window_end_hour}:00"
                        status = "✅ 已启用" if task.is_enabled else "⚠️ 已禁用"
                        lines.append(
                            f"| {task.name} {status} | {task.energy_kwh:.1f} | {task.duration_hours:.1f} | "
                            f"{window} | {task.max_delay_hours:.1f} |"
                        )
                    lines.append("")
        
        # 6. 建议
        lines.append("## 6. 优化建议")
        lines.append("")
        
        suggestions = self._generate_suggestions(df, pricing_config, stats, optimization_summary)
        for i, suggestion in enumerate(suggestions, 1):
            lines.append(f"{i}. {suggestion}")
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("*此报告由电费分析小工具自动生成*")
        lines.append(f"*数据时间范围: {summary.get('日期范围', 'N/A') if summary else 'N/A'}*")
        
        return "\n".join(lines)
    
    def _generate_suggestions(
        self,
        df: pd.DataFrame,
        pricing_config: PricingConfig,
        stats: Dict,
        optimization_summary: Optional[OptimizationSummary]
    ) -> List[str]:
        """生成优化建议"""
        suggestions = []
        
        # 1. 峰时段用电建议
        if stats:
            slot_stats = stats.get('时段统计', {})
            peak_consumption = 0
            valley_consumption = 0
            
            for slot_name in slot_stats.get('用电量(kWh)', {}).keys() if slot_stats else []:
                consumption = slot_stats.get('用电量(kWh)', {}).get(slot_name, {}).get('sum', 0)
                if '峰' in slot_name:
                    peak_consumption += consumption
                elif '谷' in slot_name:
                    valley_consumption += consumption
            
            if peak_consumption > valley_consumption * 2:
                suggestions.append(
                    "**峰时段用电占比较高**：当前峰时段用电量显著高于谷时段。"
                    "建议尽可能将洗衣机、烘干机、洗碗机等可延迟的电器调整到谷时段运行，"
                    "以利用较低的电价。"
                )
        
        # 2. 异常时段建议
        if stats and stats.get('异常高用电时段数', 0) > 0:
            suggestions.append(
                "**存在异常高用电时段**：检测到部分时段用电量显著高于平均水平。"
                "建议检查这些时段是否有大功率电器（如电热水器、空调、电暖器等）长时间运行，"
                "或考虑是否存在设备故障导致的异常耗电。"
            )
        
        # 3. 错峰优化建议
        if optimization_summary:
            if optimization_summary.total_savings > 0:
                suggestions.append(
                    f"**错峰优化收益显著**：通过优化 {optimization_summary.optimized_tasks} 个任务的运行时间，"
                    f"预计可节省 ¥{optimization_summary.total_savings:.2f}。"
                    "建议按照推荐方案调整用电时间，特别是将电动车充电、热水器加热等大用电量任务安排在谷时段。"
                )
            
            if optimization_summary.tasks_with_issues:
                suggestions.append(
                    f"**部分任务需要注意**：有 {len(optimization_summary.tasks_with_issues)} 个任务的优化方案"
                    "可能超出了您设定的时间窗口或延迟限制。建议根据实际情况调整这些任务的时间约束，"
                    "或者手动选择更合适的运行时间。"
                )
        
        # 4. 通用建议
        suggestions.append(
            "**养成良好用电习惯**："
            "1) 空调温度设置合理（夏季26°C左右，冬季20°C左右）；"
            "2) 热水器在不用时可适当调低温度或关闭；"
            "3) 及时关闭不使用的电器和灯光；"
            "4) 定期清洁空调、冰箱等电器，保持高效运行。"
        )
        
        suggestions.append(
            "**关注用电趋势**：建议持续记录和分析用电数据，"
            "观察不同季节、不同天气条件下的用电变化规律，"
            "及时发现异常并调整用电计划。"
        )
        
        return suggestions
    
    def generate_html_report(
        self,
        markdown_content: str,
        title: str = "电费分析报告"
    ) -> str:
        """
        将 Markdown 内容转换为 HTML 格式
        
        Args:
            markdown_content: Markdown 格式的报告内容
            title: 报告标题
            
        Returns:
            HTML 格式的报告字符串
        """
        # 使用 markdown2 转换
        html_body = markdown2.markdown(
            markdown_content,
            extras=['tables', 'fenced-code-blocks', 'header-ids']
        )
        
        # 包装成完整的 HTML 文档
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }}
        .container {{
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
            margin-top: 30px;
        }}
        h3 {{
            color: #5d6d7e;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        tr:hover {{
            background-color: #e9ecef;
        }}
        .warning {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
        .success {{
            background-color: #d4edda;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
        .info {{
            background-color: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
        hr {{
            border: none;
            border-top: 1px solid #eee;
            margin: 30px 0;
        }}
        footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #6c757d;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        {html_body}
    </div>
</body>
</html>"""
        
        return html
    
    def save_report(
        self,
        content: str,
        file_path: str,
        format_type: str = 'markdown'
    ) -> Tuple[bool, str]:
        """
        保存报告到文件
        
        Args:
            content: 报告内容
            file_path: 文件路径
            format_type: 格式类型 ('markdown' 或 'html')
            
        Returns:
            (成功与否, 消息)
        """
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, f"报告已保存到: {file_path}"
        except Exception as e:
            return False, f"保存报告失败: {str(e)}"
