import os
import json
from datetime import datetime
from typing import Dict, List, Any
from tabulate import tabulate
import click


class Reporter:
    def __init__(self, config):
        self.config = config
    
    def generate_all(self, risk_results: Dict[str, Any], output_formats: tuple):
        formats = output_formats
        if 'all' in formats:
            formats = ['terminal', 'json', 'markdown']
        
        if 'terminal' in formats:
            self._print_terminal_summary(risk_results)
        
        if 'json' in formats:
            self._write_json_output(risk_results)
        
        if 'markdown' in formats:
            self._write_markdown_report(risk_results)
    
    def _print_terminal_summary(self, risk_results: Dict[str, Any]):
        summary = risk_results['summary']
        
        click.echo("\n" + "=" * 80)
        click.echo("📊 PROMETHEUS 基数估算报告")
        click.echo("=" * 80)
        
        if self.config.service_name:
            click.echo(f"服务名: {self.config.service_name}")
        click.echo(f"生成时间: {risk_results['generated_at']}")
        click.echo()
        
        self._print_summary_table(summary)
        
        click.echo()
        self._print_top_risky_combinations(risk_results)
        
        if risk_results['masked_high_cardinality']:
            click.echo()
            self._print_masked_high_cardinality(risk_results)
        
        if self.config.include_empty_labels and risk_results['empty_label_analysis']:
            click.echo()
            self._print_empty_label_analysis(risk_results)
        
        if risk_results['history_comparison']['has_history']:
            click.echo()
            self._print_history_comparison(risk_results)
        
        click.echo()
        click.echo("=" * 80)
        self._print_exit_code_info(risk_results)
    
    def _print_summary_table(self, summary: Dict[str, Any]):
        headers = ["指标", "数值"]
        rows = [
            ["总 label 组合数", summary['total_combinations']],
            ["🔴 严重 (Critical)", summary['critical_count']],
            ["🟡 警告 (Warning)", summary['warning_count']],
            ["🟢 正常 (Low)", summary['low_count']],
            ["基线阈值", summary['base_threshold']],
            ["显示 Top-N", summary['top_n']],
        ]
        
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
    
    def _print_top_risky_combinations(self, risk_results: Dict[str, Any]):
        top_n = self.config.top_n
        combinations = risk_results['combinations'][:top_n]
        
        click.echo(f"🔥 风险最高的前 {len(combinations)} 个 label 组合:")
        click.echo()
        
        headers = [
            "#", "风险等级", "风险分", "指标名", "Labels",
            "基数", "阈值", "占比%", "增长率%"
        ]
        
        rows = []
        for i, combo in enumerate(combinations, 1):
            risk_icon = {
                'critical': '🔴',
                'warning': '🟡',
                'low': '🟢'
            }.get(combo['risk_level'], '⚪')
            
            growth = combo.get('growth_rate_percent')
            growth_str = f"{growth:+.1f}" if growth is not None else "N/A"
            
            rows.append([
                i,
                f"{risk_icon} {combo['risk_level'].upper()}",
                combo['risk_score'],
                combo['metric_name'][:30],
                ', '.join(combo['labels'])[:40],
                combo['estimated_cardinality'],
                combo['threshold'],
                combo['ratio_to_threshold'],
                growth_str
            ])
        
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
        
        click.echo()
        click.echo("💡 详细建议:")
        for i, combo in enumerate(combinations[:5], 1):
            if combo['risk_level'] != 'low':
                click.echo(f"  {i}. {combo['recommendation']}")
    
    def _print_masked_high_cardinality(self, risk_results: Dict[str, Any]):
        masked = risk_results['masked_high_cardinality'][:10]
        
        click.echo(f"⚠️  发现 {len(masked)} 个被掩盖的高基数 label:")
        click.echo()
        
        headers = ["#", "指标名", "被掩盖 Label", "掩盖 Label", "描述"]
        rows = []
        
        for i, case in enumerate(masked, 1):
            rows.append([
                i,
                case['metric_name'][:25],
                case['masked_label'],
                case['masked_by_label'],
                case['description'][:60]
            ])
        
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
    
    def _print_empty_label_analysis(self, risk_results: Dict[str, Any]):
        empty_labels = risk_results['empty_label_analysis']
        
        click.echo(f"📭 空 Label 分析 (共 {len(empty_labels)} 个):")
        click.echo()
        
        headers = ["Label", "空值数量", "影响的指标"]
        rows = []
        
        for label, data in empty_labels.items():
            rows.append([
                label,
                data['empty_count'],
                ', '.join(data['affected_metrics'])[:40]
            ])
        
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
    
    def _print_history_comparison(self, risk_results: Dict[str, Any]):
        comparison = risk_results['history_comparison']
        
        click.echo("📈 历史对比:")
        
        if comparison['new_high_cardinality_labels']:
            click.echo(f"  新增高基数 label 组合: {len(comparison['new_high_cardinality_labels'])} 个")
        
        if comparison['significant_growth']:
            click.echo(f"  显著增长 (>50%): {len(comparison['significant_growth'])} 个")
        
        if comparison['improved']:
            click.echo(f"  明显改善 (<-20%): {len(comparison['improved'])} 个")
        
        if not any([
            comparison['new_high_cardinality_labels'],
            comparison['significant_growth'],
            comparison['improved']
        ]):
            click.echo("  无显著变化")
    
    def _print_exit_code_info(self, risk_results: Dict[str, Any]):
        summary = risk_results['summary']
        
        if summary['critical_count'] > 0:
            click.echo(f"❌ 退出码: 2 (存在 {summary['critical_count']} 个严重风险)")
        elif summary['warning_count'] > 0:
            click.echo(f"⚠️  退出码: 1 (存在 {summary['warning_count']} 个警告)")
        else:
            click.echo("✅ 退出码: 0 (无风险)")
    
    def _write_json_output(self, risk_results: Dict[str, Any]):
        summary_path = os.path.join(self.config.output_dir, 'summary.json')
        details_path = os.path.join(self.config.output_dir, 'details.json')
        
        summary_data = {
            'service_name': risk_results['service_name'],
            'generated_at': risk_results['generated_at'],
            'summary': risk_results['summary'],
            'top_combinations': risk_results['combinations'][:self.config.top_n],
            'masked_high_cardinality': risk_results['masked_high_cardinality'],
            'history_comparison': risk_results['history_comparison']
        }
        
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=2)
        
        with open(details_path, 'w', encoding='utf-8') as f:
            json.dump(risk_results, f, ensure_ascii=False, indent=2)
        
        if not self.config.quiet:
            click.echo(f"💾 JSON 报告已保存: {summary_path}")
    
    def _write_markdown_report(self, risk_results: Dict[str, Any]):
        md_path = os.path.join(self.config.output_dir, 'report.md')
        
        content = self._generate_markdown_content(risk_results)
        
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        if not self.config.quiet:
            click.echo(f"💾 Markdown 报告已保存: {md_path}")
    
    def _generate_markdown_content(self, risk_results: Dict[str, Any]) -> str:
        lines = []
        
        lines.append("# Prometheus 基数估算报告")
        lines.append("")
        lines.append(f"- **服务名**: {risk_results['service_name']}")
        lines.append(f"- **生成时间**: {risk_results['generated_at']}")
        lines.append(f"- **基线阈值**: {risk_results['summary']['base_threshold']}")
        lines.append("")
        
        lines.append("## 📊 概览")
        lines.append("")
        
        summary = risk_results['summary']
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总 label 组合数 | {summary['total_combinations']} |")
        lines.append(f"| 🔴 严重 (Critical) | {summary['critical_count']} |")
        lines.append(f"| 🟡 警告 (Warning) | {summary['warning_count']} |")
        lines.append(f"| 🟢 正常 (Low) | {summary['low_count']} |")
        lines.append("")
        
        lines.append("## 🔥 高风险 label 组合")
        lines.append("")
        
        top_n = self.config.top_n
        combinations = risk_results['combinations'][:top_n]
        
        lines.append("| # | 风险等级 | 风险分 | 指标名 | Labels | 基数 | 阈值 | 占比% | 建议 |")
        lines.append("|---|---------|-------|--------|--------|------|------|-------|------|")
        
        for i, combo in enumerate(combinations, 1):
            risk_icon = {
                'critical': '🔴',
                'warning': '🟡',
                'low': '🟢'
            }.get(combo['risk_level'], '⚪')
            
            lines.append(
                f"| {i} | {risk_icon} {combo['risk_level'].upper()} | "
                f"{combo['risk_score']} | {combo['metric_name']} | "
                f"{', '.join(combo['labels'])} | {combo['estimated_cardinality']} | "
                f"{combo['threshold']} | {combo['ratio_to_threshold']}% | "
                f"{combo['recommendation']} |"
            )
        
        lines.append("")
        
        if risk_results['masked_high_cardinality']:
            lines.append("## ⚠️ 被掩盖的高基数 Label")
            lines.append("")
            lines.append("某些 label 的高基数被其他 label 掩盖, 单独分析时可能发现不了:")
            lines.append("")
            
            for case in risk_results['masked_high_cardinality']:
                lines.append(f"- **{case['metric_name']}**: {case['description']}")
            
            lines.append("")
        
        if self.config.include_empty_labels and risk_results['empty_label_analysis']:
            lines.append("## 📭 空 Label 分析")
            lines.append("")
            
            for label, data in risk_results['empty_label_analysis'].items():
                lines.append(
                    f"- **{label}**: {data['empty_count']} 个空值, "
                    f"影响指标: {', '.join(data['affected_metrics'])}"
                )
            
            lines.append("")
        
        if risk_results['history_comparison']['has_history']:
            lines.append("## 📈 历史对比")
            lines.append("")
            
            comparison = risk_results['history_comparison']
            
            if comparison['new_high_cardinality_labels']:
                lines.append("### 新增高基数组合")
                lines.append("")
                for item in comparison['new_high_cardinality_labels']:
                    lines.append(
                        f"- **{item['metric_name']}** ({', '.join(item['labels'])}): "
                        f"基数 {item['current_cardinality']} > 阈值 {item['threshold']}"
                    )
                lines.append("")
            
            if comparison['significant_growth']:
                lines.append("### 显著增长 (>50%)")
                lines.append("")
                for item in comparison['significant_growth']:
                    lines.append(
                        f"- **{item['metric_name']}** ({', '.join(item['labels'])}): "
                        f"{item['historical_cardinality']} → {item['current_cardinality']} "
                        f"(+{item['growth_percent']}%)"
                    )
                lines.append("")
            
            if comparison['improved']:
                lines.append("### 明显改善")
                lines.append("")
                for item in comparison['improved']:
                    lines.append(
                        f"- **{item['metric_name']}** ({', '.join(item['labels'])}): "
                        f"{item['historical_cardinality']} → {item['current_cardinality']} "
                        f"(-{item['reduction_percent']}%)"
                    )
                lines.append("")
        
        lines.append("## 📝 风险评估说明")
        lines.append("")
        lines.append("### 风险等级判定规则")
        lines.append("")
        lines.append("- **Critical (严重)**: 风险分 >= 75")
        lines.append("  - 基数超过阈值 2 倍以上 (+100分)")
        lines.append("  - 基数超过阈值 (+75分)")
        lines.append("  - label 组合数量多 (+20分)")
        lines.append("")
        lines.append("- **Warning (警告)**: 风险分 25-74")
        lines.append("  - 基数接近阈值 80% (+50分)")
        lines.append("  - 基数达到阈值 50% (+25分)")
        lines.append("  - label 组合利用率高 (+15分)")
        lines.append("")
        lines.append("- **Low (正常)**: 风险分 < 25")
        lines.append("")
        
        lines.append("## 🛠️  优化建议")
        lines.append("")
        lines.append("1. **移除高基数 label**: 对于严重风险的 label 组合, 考虑从指标中移除")
        lines.append("2. **聚合 label 值**: 将细粒度的 label 值聚合为粗粒度分类")
        lines.append("3. **使用 relabel_config**: 在 Prometheus 抓取时通过 relabel 丢弃或修改 label")
        lines.append("4. **设置 recording rules**: 预先聚合高基数指标")
        lines.append("5. **监控增长趋势**: 定期运行此工具, 关注基数增长速度")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*报告由 prom-cardinality CLI 工具生成于 {datetime.now().isoformat()}*")
        
        return '\n'.join(lines)
