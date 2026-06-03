import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
import json
from pathlib import Path

try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

try:
    import plotly.graph_objects as go
    import plotly.express as px
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False

from .core import MarkovChurnModel, CustomerState


class Visualizer:
    def __init__(self, model: MarkovChurnModel, export_dir: str,
                 enable_3d: bool = True,
                 show_raw_data_on_click: bool = True):
        self.model = model
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)
        self.enable_3d = enable_3d
        self.show_raw_data_on_click = show_raw_data_on_click

    def _get_state_color_map(self) -> Dict[str, str]:
        return {
            "active": "#2ecc71",
            "at_risk": "#f39c12",
            "churned": "#e74c3c",
            "reactivated": "#3498db"
        }

    def plot_transition_matrix_heatmap(self, title: str = "状态转移矩阵热力图",
                                        save_path: str = None) -> Optional[str]:
        if not MATPLOTLIB_AVAILABLE:
            return None

        transition_matrix = self.model.transition_matrix
        states = self.model.states
        
        fig, ax = plt.subplots(figsize=(10, 8))
        sns.heatmap(transition_matrix, annot=True, fmt='.3f', cmap='YlOrRd',
                    xticklabels=states, yticklabels=states, ax=ax)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('下一个状态')
        ax.set_ylabel('当前状态')
        plt.tight_layout()

        if save_path:
            full_path = self.export_dir / save_path
            plt.savefig(full_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(full_path)
        else:
            plt.show()
            return None

    def plot_state_distribution(self, time_steps: int = 5,
                                 title: str = "客户状态分布预测",
                                 save_path: str = None) -> Optional[str]:
        if not MATPLOTLIB_AVAILABLE:
            return None

        distributions = []
        for t in range(time_steps + 1):
            dist = self.model.get_state_distribution(t)
            distributions.append(dist)
        
        distributions = np.array(distributions)
        states = self.model.states
        colors = [self._get_state_color_map().get(s, '#333333') for s in states]

        fig, ax = plt.subplots(figsize=(12, 6))
        
        bottom = np.zeros(time_steps + 1)
        for i, (state, color) in enumerate(zip(states, colors)):
            ax.bar(range(time_steps + 1), distributions[:, i], bottom=bottom,
                   label=state, color=color, alpha=0.8)
            bottom += distributions[:, i]

        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('预测步长')
        ax.set_ylabel('客户比例')
        ax.set_xticks(range(time_steps + 1))
        ax.set_xticklabels([f'第{i}步' for i in range(time_steps + 1)])
        ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()

        if save_path:
            full_path = self.export_dir / save_path
            plt.savefig(full_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(full_path)
        else:
            plt.show()
            return None

    def plot_transition_sankey(self, title: str = "客户状态流转图",
                                save_path: str = None) -> Optional[str]:
        if not PLOTLY_AVAILABLE:
            return None

        transition_matrix = self.model.transition_matrix
        states = self.model.states
        color_map = self._get_state_color_map()
        
        source = []
        target = []
        value = []
        labels = states + states
        
        for i, from_state in enumerate(states):
            for j, to_state in enumerate(states):
                if transition_matrix[i, j] > 0.01:
                    source.append(i)
                    target.append(len(states) + j)
                    value.append(transition_matrix[i, j])

        node_colors = [color_map.get(s, '#cccccc') for s in states] * 2
        
        fig = go.Figure(data=[go.Sankey(
            node=dict(
                pad=15,
                thickness=20,
                line=dict(color="black", width=0.5),
                label=labels,
                color=node_colors
            ),
            link=dict(
                source=source,
                target=target,
                value=value,
                color=[color_map.get(states[s], '#cccccc') for s in source]
            )
        )])

        fig.update_layout(title_text=title, font_size=12)

        if save_path:
            full_path = self.export_dir / save_path
            fig.write_html(str(full_path))
            return str(full_path)
        else:
            fig.show()
            return None

    def plot_3d_transition(self, title: str = "3D 状态转移概率分布",
                            save_path: str = None) -> Optional[str]:
        if not PLOTLY_AVAILABLE or not self.enable_3d:
            return None

        transition_matrix = self.model.transition_matrix
        states = self.model.states
        
        x = []
        y = []
        z = []
        text = []
        
        for i, from_state in enumerate(states):
            for j, to_state in enumerate(states):
                x.append(i)
                y.append(j)
                z.append(transition_matrix[i, j])
                text.append(f"从: {from_state}<br>到: {to_state}<br>概率: {transition_matrix[i, j]:.3f}")

        fig = go.Figure(data=[go.Scatter3d(
            x=x,
            y=y,
            z=z,
            mode='markers+text',
            marker=dict(
                size=12,
                color=z,
                colorscale='Viridis',
                opacity=0.8
            ),
            text=text,
            hovertemplate='%{text}<extra></extra>'
        )])

        fig.update_layout(
            scene=dict(
                xaxis_title='当前状态',
                yaxis_title='下一个状态',
                zaxis_title='转移概率',
                xaxis=dict(ticktext=states, tickvals=list(range(len(states)))),
                yaxis=dict(ticktext=states, tickvals=list(range(len(states))))
            ),
            title=title
        )

        if save_path:
            full_path = self.export_dir / save_path
            fig.write_html(str(full_path))
            return str(full_path)
        else:
            fig.show()
            return None

    def get_clickable_data_point(self, customer_id: str) -> Dict:
        if customer_id not in self.model.customers:
            return {}
        
        states = self.model.customers[customer_id]
        return {
            "customer_id": customer_id,
            "state_history": [
                {
                    "state": s.state,
                    "timestamp": s.timestamp.isoformat(),
                    "student_id": s.student_id,
                    "answer_version": s.answer_version,
                    "annotations": s.annotations,
                    "error_notes": s.error_notes,
                    "source_file": s.source_file
                }
                for s in states
            ]
        }

    def generate_review_link(self, customer_id: str, review_id: str) -> Dict:
        return {
            "customer_id": customer_id,
            "review_id": review_id,
            "review_url": f"/reviews/{review_id}",
            "raw_data_link": f"/api/customers/{customer_id}/raw",
            "annotation_link": f"/api/customers/{customer_id}/annotations"
        }

    def export_all_charts(self, prefix: str = "") -> Dict[str, str]:
        exports = {}
        
        path1 = self.plot_transition_matrix_heatmap(
            save_path=f"{prefix}transition_matrix_heatmap.png"
        )
        if path1:
            exports["transition_matrix_heatmap"] = path1

        path2 = self.plot_state_distribution(
            save_path=f"{prefix}state_distribution.png"
        )
        if path2:
            exports["state_distribution"] = path2

        path3 = self.plot_transition_sankey(
            save_path=f"{prefix}transition_sankey.html"
        )
        if path3:
            exports["transition_sankey"] = path3

        if self.enable_3d:
            path4 = self.plot_3d_transition(
                save_path=f"{prefix}3d_transition.html"
            )
            if path4:
                exports["3d_transition"] = path4

        return exports
