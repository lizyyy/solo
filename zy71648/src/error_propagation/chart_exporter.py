"""图表导出模块"""

import matplotlib.pyplot as plt
import matplotlib
import numpy as np
from typing import Dict, List, Optional, Tuple
import os

from .types import PropagationResult, Measurement, ExperimentGroup

matplotlib.use('Agg')
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False


class ChartExporter:
    """图表导出器"""

    def __init__(self, output_dir: str = "charts"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def export_all(
        self,
        result: PropagationResult,
        measurements: Dict[str, Measurement],
        base_filename: str = "error_analysis"
    ) -> Dict[str, str]:
        """导出所有图表"""
        charts = {}

        charts['contribution_bar'] = self.export_contribution_bar(
            result, measurements, f"{base_filename}_contribution_bar.png"
        )
        charts['contribution_pie'] = self.export_contribution_pie(
            result, f"{base_filename}_contribution_pie.png"
        )
        charts['error_bars'] = self.export_error_bars(
            result, measurements, f"{base_filename}_error_bars.png"
        )

        return charts

    def export_contribution_bar(
        self,
        result: PropagationResult,
        measurements: Dict[str, Measurement],
        filename: str
    ) -> str:
        """导出不确定度贡献柱状图"""
        contributions = result.uncertainty_contributions
        if not contributions:
            return ""

        sorted_items = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        vars_list = [item[0] for item in sorted_items]
        contribs = [item[1] for item in sorted_items]

        total_sq = sum(c ** 2 for c in contributions.values())
        percentages = [(c ** 2 / total_sq * 100) if total_sq > 0 else 0 for c in contribs]

        fig, ax1 = plt.subplots(figsize=(10, 6))

        colors = plt.cm.RdYlGn_r(np.linspace(0, 0.8, len(vars_list)))
        bars = ax1.bar(vars_list, contribs, color=colors, alpha=0.7, label='不确定度贡献')

        ax1.set_xlabel('变量', fontsize=12)
        ax1.set_ylabel('不确定度贡献值', fontsize=12, color='steelblue')
        ax1.tick_params(axis='y', labelcolor='steelblue')

        ax2 = ax1.twinx()
        cum_percent = np.cumsum(percentages)
        ax2.plot(vars_list, cum_percent, 'r-o', linewidth=2, markersize=8, label='累积占比')
        ax2.set_ylabel('累积占比 (%)', fontsize=12, color='red')
        ax2.tick_params(axis='y', labelcolor='red')
        ax2.set_ylim(0, 105)

        for i, (bar, percent) in enumerate(zip(bars, percentages)):
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width() / 2, height,
                    f'{percent:.1f}%', ha='center', va='bottom', fontsize=10)

        plt.title(f'{result.target_name} 不确定度来源贡献分析', fontsize=14, pad=20)
        ax1.grid(axis='y', alpha=0.3)

        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper center')

        plt.tight_layout()
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def export_contribution_pie(
        self,
        result: PropagationResult,
        filename: str
    ) -> str:
        """导出不确定度贡献饼图"""
        contributions = result.uncertainty_contributions
        if not contributions:
            return ""

        sorted_items = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        vars_list = [item[0] for item in sorted_items]
        contribs = np.array([item[1] for item in sorted_items])
        contribs_sq = contribs ** 2

        total_sq = contribs_sq.sum()
        percentages = (contribs_sq / total_sq * 100) if total_sq > 0 else np.zeros_like(contribs_sq)

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        colors = plt.cm.Set3(np.linspace(0, 1, len(vars_list)))
        wedges1, texts1, autotexts1 = ax1.pie(
            contribs, labels=vars_list, autopct='%1.1f%%', colors=colors,
            startangle=90, textprops={'fontsize': 10}
        )
        ax1.set_title('按贡献值比例', fontsize=12)

        wedges2, texts2, autotexts2 = ax2.pie(
            percentages, labels=vars_list, autopct='%1.1f%%', colors=colors,
            startangle=90, textprops={'fontsize': 10}
        )
        ax2.set_title('按方差贡献比例', fontsize=12)

        plt.suptitle(f'{result.target_name} 不确定度来源分布', fontsize=14)
        plt.tight_layout()

        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def export_error_bars(
        self,
        result: PropagationResult,
        measurements: Dict[str, Measurement],
        filename: str
    ) -> str:
        """导出误差棒图"""
        contributions = result.uncertainty_contributions
        if not contributions:
            return ""

        sorted_items = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        vars_list = [item[0] for item in sorted_items]

        values = []
        uncertainties = []
        units = []
        for v in vars_list:
            m = measurements.get(v)
            if m:
                values.append(m.value)
                uncertainties.append(m.uncertainty)
                units.append(m.unit)
            else:
                values.append(0)
                uncertainties.append(0)
                units.append('')

        fig, ax = plt.subplots(figsize=(10, 6))

        x_pos = np.arange(len(vars_list))
        ax.errorbar(x_pos, values, yerr=uncertainties, fmt='o', capsize=10,
                   elinewidth=2, markeredgewidth=2, markersize=8, color='steelblue')

        for i, (v, u, unit) in enumerate(zip(values, uncertainties, units)):
            rel = u / abs(v) * 100 if abs(v) > 1e-12 else 0
            ax.text(i, v + u, f'{rel:.1f}%', ha='center', va='bottom', fontsize=10, color='red')

        ax.set_xticks(x_pos)
        ax.set_xticklabels([f'{v}\n({unit})' for v, unit in zip(vars_list, units)], fontsize=10)
        ax.set_ylabel('测量值', fontsize=12)
        ax.set_title('各测量值的误差棒图（红色数字为相对不确定度）', fontsize=14, pad=20)
        ax.grid(axis='y', alpha=0.3)

        plt.tight_layout()
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def export_group_comparison(
        self,
        groups: Dict[str, ExperimentGroup],
        target_variable: str,
        filename: str
    ) -> str:
        """导出租间比较图"""
        group_names = []
        values = []
        uncertainties = []

        for group_name, group in groups.items():
            result = group.results.get(target_variable)
            if result:
                group_names.append(group_name)
                values.append(result.target_value)
                uncertainties.append(result.target_uncertainty)

        if not values:
            return ""

        fig, ax = plt.subplots(figsize=(12, 6))

        x_pos = np.arange(len(group_names))
        bars = ax.bar(x_pos, values, yerr=uncertainties, capsize=10,
                     alpha=0.7, color='steelblue', edgecolor='black')

        for i, (bar, val, unc) in enumerate(zip(bars, values, uncertainties)):
            height = bar.get_height()
            rel = unc / abs(val) * 100 if abs(val) > 1e-12 else 0
            ax.text(bar.get_x() + bar.get_width() / 2, height + unc,
                    f'{val:.3g}\n±{unc:.1g}\n({rel:.1f}%)',
                    ha='center', va='bottom', fontsize=10)

        ax.set_xticks(x_pos)
        ax.set_xticklabels(group_names, fontsize=11)
        ax.set_ylabel(f'{target_variable}', fontsize=12)
        ax.set_title(f'各实验组 {target_variable} 结果比较', fontsize=14, pad=20)
        ax.grid(axis='y', alpha=0.3)

        plt.tight_layout()
        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def export_propagation_network(
        self,
        result: PropagationResult,
        measurements: Dict[str, Measurement],
        filename: str
    ) -> str:
        """导出误差传播网络图（需要networkx）"""
        try:
            import networkx as nx
        except ImportError:
            return "networkx not installed"

        contributions = result.uncertainty_contributions
        if not contributions:
            return ""

        G = nx.DiGraph()

        target = result.target_name
        G.add_node(target, node_type='target', color='#667eea', size=3000)

        for var, contrib in contributions.items():
            m = measurements.get(var)
            rel_unc = m.relative_uncertainty if m else 0
            G.add_node(var, node_type='variable',
                      color=f'#{int(255 - rel_unc * 255):02x}{int(rel_unc * 255):02x}00',
                      size=1000 + rel_unc * 3000)
            G.add_edge(var, target, weight=contrib)

        fig, ax = plt.subplots(figsize=(10, 10))

        pos = nx.spring_layout(G, k=2, iterations=50)

        node_colors = [G.nodes[n]['color'] for n in G.nodes()]
        node_sizes = [G.nodes[n]['size'] for n in G.nodes()]

        nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=node_sizes, alpha=0.8)

        edges = G.edges()
        weights = [G[u][v]['weight'] for u, v in edges]
        max_weight = max(weights) if weights else 1
        normalized_weights = [w / max_weight * 5 for w in weights]

        nx.draw_networkx_edges(G, pos, width=normalized_weights, alpha=0.6,
                              edge_color='gray', arrowsize=20)

        labels = {}
        for node in G.nodes():
            if node == target:
                labels[node] = f'{target}\n= {result.target_value:.3g} ± {result.target_uncertainty:.3g}'
            else:
                m = measurements.get(node)
                if m:
                    labels[node] = f'{node}\n= {m.value:.3g} ± {m.uncertainty:.3g}'
                else:
                    labels[node] = node

        nx.draw_networkx_labels(G, pos, labels, font_size=9, font_weight='bold')

        edge_labels = {(u, v): f'{w:.3g}' for (u, v), w in zip(edges, weights)}
        nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_size=8)

        ax.set_title('误差传播网络图\n（节点大小表示相对不确定度，边宽表示贡献大小）',
                    fontsize=14, pad=20)
        ax.axis('off')

        filepath = os.path.join(self.output_dir, filename)
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath
