import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
import warnings
from metrics import AggregatedMetrics, MetricsAnalyzer, LongTailMetrics
from simulator import SimulationConfig, MonteCarloSimulator, ParameterValidator


warnings.filterwarnings('ignore')
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False


@dataclass
class ComparisonResult:
    configs: List[SimulationConfig]
    all_metrics: List[AggregatedMetrics]
    comparison_df: pd.DataFrame

    def get_best_strategy(self, metric: str = 'p95_wait') -> Tuple[str, float]:
        valid_df = self.comparison_df.dropna(subset=[metric])
        if valid_df.empty:
            return "N/A", float('inf')
        best_row = valid_df.loc[valid_df[metric].idxmin()]
        return best_row['策略'], best_row[metric]


class StrategyComparator:
    @staticmethod
    def compare_strategies(
        base_config: SimulationConfig,
        strategy_names: List[str],
        num_runs: int = 50
    ) -> ComparisonResult:
        configs = []
        all_metrics = []
        
        for strategy_name in strategy_names:
            config = SimulationConfig(
                num_patients=base_config.num_patients,
                num_windows=base_config.num_windows,
                arrival_rate=base_config.arrival_rate,
                avg_service_time=base_config.avg_service_time,
                std_service_time=base_config.std_service_time,
                sim_duration=base_config.sim_duration,
                random_seed=base_config.random_seed,
                strategy_name=strategy_name,
                window_breaks=base_config.window_breaks,
                priority_ratio=base_config.priority_ratio,
            )
            
            validator = ParameterValidator.validate(config)
            if not validator.is_valid:
                print(f"策略 {strategy_name} 参数验证失败:")
                for err in validator.errors:
                    print(f"  ❌ {err}")
                continue
            
            configs.append(config)
            simulator = MonteCarloSimulator(config)
            results = simulator.run_monte_carlo(num_runs=num_runs)
            metrics = MetricsAnalyzer.aggregate_results(results)
            all_metrics.append(metrics)

        comparison_data = []
        for metrics in all_metrics:
            comparison_data.append({
                '策略': metrics.strategy_name,
                '平均等待': metrics.avg_metrics.mean_wait,
                'P50等待': metrics.avg_metrics.p50_wait,
                'P75等待': metrics.avg_metrics.p75_wait,
                'P90等待': metrics.avg_metrics.p90_wait,
                'P95等待': metrics.avg_metrics.p95_wait,
                'P99等待': metrics.avg_metrics.p99_wait,
                '最大等待': metrics.avg_metrics.max_wait,
                '长尾比': metrics.avg_metrics.tail_ratio,
                '极端等待比例': metrics.avg_metrics.extreme_wait_ratio,
                '窗口利用率': metrics.avg_utilization,
                '平均队列长度': metrics.avg_queue_length,
                '最大队列长度': metrics.avg_max_queue,
            })

        comparison_df = pd.DataFrame(comparison_data)
        return ComparisonResult(configs, all_metrics, comparison_df)

    @staticmethod
    def compare_window_counts(
        base_config: SimulationConfig,
        window_counts: List[int],
        num_runs: int = 50
    ) -> ComparisonResult:
        configs = []
        all_metrics = []
        
        for n_windows in window_counts:
            config = SimulationConfig(
                num_patients=base_config.num_patients,
                num_windows=n_windows,
                arrival_rate=base_config.arrival_rate,
                avg_service_time=base_config.avg_service_time,
                std_service_time=base_config.std_service_time,
                sim_duration=base_config.sim_duration,
                random_seed=base_config.random_seed,
                strategy_name=base_config.strategy_name,
                window_breaks=base_config.window_breaks[:n_windows] if base_config.window_breaks else [],
                priority_ratio=base_config.priority_ratio,
            )
            
            validator = ParameterValidator.validate(config)
            if not validator.is_valid:
                print(f"窗口数 {n_windows} 参数验证失败:")
                for err in validator.errors:
                    print(f"  ❌ {err}")
                continue
            
            configs.append(config)
            simulator = MonteCarloSimulator(config)
            results = simulator.run_monte_carlo(num_runs=num_runs)
            metrics = MetricsAnalyzer.aggregate_results(results)
            all_metrics.append(metrics)

        comparison_data = []
        for config, metrics in zip(configs, all_metrics):
            comparison_data.append({
                '策略': f"{config.num_windows}窗口",
                '窗口数': config.num_windows,
                '平均等待': metrics.avg_metrics.mean_wait,
                'P50等待': metrics.avg_metrics.p50_wait,
                'P75等待': metrics.avg_metrics.p75_wait,
                'P90等待': metrics.avg_metrics.p90_wait,
                'P95等待': metrics.avg_metrics.p95_wait,
                'P99等待': metrics.avg_metrics.p99_wait,
                '最大等待': metrics.avg_metrics.max_wait,
                '长尾比': metrics.avg_metrics.tail_ratio,
                '极端等待比例': metrics.avg_metrics.extreme_wait_ratio,
                '窗口利用率': metrics.avg_utilization,
                '平均队列长度': metrics.avg_queue_length,
                '最大队列长度': metrics.avg_max_queue,
            })

        comparison_df = pd.DataFrame(comparison_data)
        return ComparisonResult(configs, all_metrics, comparison_df)


class ChartExporter:
    @staticmethod
    def plot_wait_time_distribution(
        metrics_list: List[AggregatedMetrics],
        save_path: str = 'wait_time_distribution.png',
        title: str = '等待时间分布对比'
    ):
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        strategy_names = [m.strategy_name for m in metrics_list]
        
        metrics_map = {
            'P50': [m.avg_metrics.p50_wait for m in metrics_list],
            'P75': [m.avg_metrics.p75_wait for m in metrics_list],
            'P90': [m.avg_metrics.p90_wait for m in metrics_list],
            'P95': [m.avg_metrics.p95_wait for m in metrics_list],
            'P99': [m.avg_metrics.p99_wait for m in metrics_list],
            'Max': [m.avg_metrics.max_wait for m in metrics_list],
        }
        
        ax = axes[0, 0]
        x = np.arange(len(strategy_names))
        width = 0.12
        for i, (metric, values) in enumerate(metrics_map.items()):
            ax.bar(x + i * width, values, width, label=metric)
        ax.set_xlabel('策略')
        ax.set_ylabel('等待时间 (分钟)')
        ax.set_title('分位等待时间对比')
        ax.set_xticks(x + width * 2.5)
        ax.set_xticklabels(strategy_names, rotation=15)
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
        
        ax = axes[0, 1]
        tail_ratios = [m.avg_metrics.tail_ratio for m in metrics_list]
        colors = ['red' if tr > 5 else 'orange' if tr > 3 else 'green' for tr in tail_ratios]
        ax.bar(strategy_names, tail_ratios, color=colors)
        ax.axhline(y=5, color='red', linestyle='--', alpha=0.7, label='严重阈值(5)')
        ax.axhline(y=3, color='orange', linestyle='--', alpha=0.7, label='警告阈值(3)')
        ax.set_xlabel('策略')
        ax.set_ylabel('长尾比 (P95/P50)')
        ax.set_title('长尾效应对比')
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
        plt.setp(ax.get_xticklabels(), rotation=15)
        
        ax = axes[1, 0]
        utilizations = [m.avg_utilization * 100 for m in metrics_list]
        bars = ax.bar(strategy_names, utilizations)
        ax.axhline(y=85, color='green', linestyle='--', alpha=0.7, label='理想区间上限')
        ax.axhline(y=60, color='green', linestyle='--', alpha=0.7, label='理想区间下限')
        ax.set_xlabel('策略')
        ax.set_ylabel('窗口利用率 (%)')
        ax.set_title('资源利用率对比')
        ax.set_ylim(0, 100)
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
        plt.setp(ax.get_xticklabels(), rotation=15)
        
        ax = axes[1, 1]
        extreme_ratios = [m.avg_metrics.extreme_wait_ratio * 100 for m in metrics_list]
        colors = ['red' if r > 10 else 'orange' if r > 5 else 'green' for r in extreme_ratios]
        ax.bar(strategy_names, extreme_ratios, color=colors)
        ax.axhline(y=10, color='red', linestyle='--', alpha=0.7, label='严重阈值(10%)')
        ax.axhline(y=5, color='orange', linestyle='--', alpha=0.7, label='警告阈值(5%)')
        ax.set_xlabel('策略')
        ax.set_ylabel('极端等待比例 (%)')
        ax.set_title('患者体验指标')
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
        plt.setp(ax.get_xticklabels(), rotation=15)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        return save_path

    @staticmethod
    def plot_window_scaling_analysis(
        comparison_result: ComparisonResult,
        save_path: str = 'window_scaling.png'
    ):
        df = comparison_result.comparison_df
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        ax = axes[0, 0]
        ax.plot(df['窗口数'], df['P95等待'], 'o-', linewidth=2, markersize=8, label='P95等待')
        ax.plot(df['窗口数'], df['平均等待'], 's--', linewidth=2, markersize=8, label='平均等待')
        ax.set_xlabel('窗口数量')
        ax.set_ylabel('等待时间 (分钟)')
        ax.set_title('窗口数量 vs 等待时间')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        for idx, row in df.iterrows():
            if idx > 0:
                prev = df.iloc[idx - 1]
                reduction = (prev['P95等待'] - row['P95等待']) / prev['P95等待'] * 100
                ax.annotate(f'-{reduction:.1f}%', 
                           ((prev['窗口数'] + row['窗口数']) / 2, 
                            (prev['P95等待'] + row['P95等待']) / 2),
                           ha='center', va='bottom')
        
        ax = axes[0, 1]
        ax.plot(df['窗口数'], df['窗口利用率'] * 100, 'o-', linewidth=2, markersize=8, color='purple')
        ax.axhline(y=85, color='green', linestyle='--', alpha=0.7, label='理想上限')
        ax.axhline(y=60, color='green', linestyle='--', alpha=0.7, label='理想下限')
        ax.set_xlabel('窗口数量')
        ax.set_ylabel('平均窗口利用率 (%)')
        ax.set_title('资源利用率变化')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        ax = axes[1, 0]
        ax.plot(df['窗口数'], df['长尾比'], 'o-', linewidth=2, markersize=8, color='orange')
        ax.axhline(y=5, color='red', linestyle='--', alpha=0.7, label='严重阈值')
        ax.axhline(y=3, color='yellow', linestyle='--', alpha=0.7, label='警告阈值')
        ax.set_xlabel('窗口数量')
        ax.set_ylabel('长尾比 (P95/P50)')
        ax.set_title('长尾效应变化')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        ax = axes[1, 1]
        ax.plot(df['窗口数'], df['极端等待比例'] * 100, 'o-', linewidth=2, markersize=8, color='red')
        ax.axhline(y=10, color='red', linestyle='--', alpha=0.7, label='严重阈值')
        ax.axhline(y=5, color='orange', linestyle='--', alpha=0.7, label='警告阈值')
        ax.set_xlabel('窗口数量')
        ax.set_ylabel('极端等待比例 (%)')
        ax.set_title('患者体验改善')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        plt.close()
        return save_path

    @staticmethod
    def export_all_charts(
        comparison_result: ComparisonResult,
        output_dir: str = '.'
    ) -> Dict[str, str]:
        exported = {}
        
        exported['distribution'] = ChartExporter.plot_wait_time_distribution(
            comparison_result.all_metrics,
            f'{output_dir}/wait_time_distribution.png'
        )
        
        if '窗口数' in comparison_result.comparison_df.columns:
            exported['scaling'] = ChartExporter.plot_window_scaling_analysis(
                comparison_result,
                f'{output_dir}/window_scaling.png'
            )
        
        return exported
