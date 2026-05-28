"""
报告生成、图表导出和历史记录模块
"""
import os
import json
import yaml
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np
import pandas as pd

from .mode_calculator import RoomMode, RoomDimensions, ModeCalculator, ModeType
from .risk_analyzer import (
    RiskAnalyzer, FrequencyGap, ModeCluster,
    ListeningPointAnalysis, RiskLevel
)
from .data_handler import RoomConfig, DataIssue


@dataclass
class AnalysisResult:
    project_id: str
    config: RoomConfig
    modes: List[RoomMode] = field(default_factory=list)
    frequency_gaps: List[FrequencyGap] = field(default_factory=list)
    mode_clusters: List[ModeCluster] = field(default_factory=list)
    listening_point_analyses: List[ListeningPointAnalysis] = field(default_factory=list)
    duplicate_modes: List = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self):
        return {
            'project_id': self.project_id,
            'config': self.config.to_dict(),
            'modes': [m.to_dict() for m in self.modes],
            'frequency_gaps': [g.to_dict() for g in self.frequency_gaps],
            'mode_clusters': [c.to_dict() for c in self.mode_clusters],
            'listening_point_analyses': [
                lpa.to_dict() for lpa in self.listening_point_analyses
            ],
            'duplicate_modes': [
                {
                    'primary': dm[0].to_dict(),
                    'duplicates': [d.to_dict() for d in dm[1]]
                }
                for dm in self.duplicate_modes
            ],
            'generated_at': self.generated_at.isoformat()
        }


@dataclass
class DiffResult:
    project_id: str
    old_result: AnalysisResult
    new_result: AnalysisResult
    dimension_changes: Dict[str, Dict[str, float]] = field(default_factory=dict)
    added_modes: List[RoomMode] = field(default_factory=list)
    removed_modes: List[RoomMode] = field(default_factory=list)
    frequency_shifts: List[Dict] = field(default_factory=list)
    gap_changes: List[Dict] = field(default_factory=list)
    risk_changes: List[Dict] = field(default_factory=list)

    def to_dict(self):
        return {
            'project_id': self.project_id,
            'dimension_changes': self.dimension_changes,
            'added_modes': [m.to_dict() for m in self.added_modes],
            'removed_modes': [m.to_dict() for m in self.removed_modes],
            'frequency_shifts': self.frequency_shifts,
            'gap_changes': self.gap_changes,
            'risk_changes': self.risk_changes
        }


class ReportGenerator:
    def __init__(self, output_dir: str = 'output'):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def plot_mode_distribution(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_mode_distribution.png"
        filepath = os.path.join(self.output_dir, filename)

        fig, ax = plt.subplots(figsize=(14, 8))

        modes_by_type = {
            ModeType.AXIAL: [],
            ModeType.TANGENTIAL: [],
            ModeType.OBLIQUE: []
        }

        for mode in result.modes:
            modes_by_type[mode.mode_type].append(mode.frequency)

        colors = {
            ModeType.AXIAL: '#e74c3c',
            ModeType.TANGENTIAL: '#3498db',
            ModeType.OBLIQUE: '#2ecc71'
        }

        y_positions = {
            ModeType.AXIAL: 3,
            ModeType.TANGENTIAL: 2,
            ModeType.OBLIQUE: 1
        }

        labels = {
            ModeType.AXIAL: '轴向模式 (Axial)',
            ModeType.TANGENTIAL: '切向模式 (Tangential)',
            ModeType.OBLIQUE: '斜向模式 (Oblique)'
        }

        for mode_type, freqs in modes_by_type.items():
            if freqs:
                ax.scatter(
                    freqs,
                    [y_positions[mode_type]] * len(freqs),
                    color=colors[mode_type],
                    label=labels[mode_type],
                    alpha=0.7,
                    s=100,
                    marker='o'
                )

        for cluster in result.mode_clusters:
            if cluster.risk_level in [RiskLevel.CRITICAL, RiskLevel.WARNING]:
                ax.axvspan(
                    cluster.center_freq - cluster.bandwidth / 2,
                    cluster.center_freq + cluster.bandwidth / 2,
                    alpha=0.2,
                    color='red' if cluster.risk_level == RiskLevel.CRITICAL else 'orange'
                )

        ax.set_ylim(0.5, 3.5)
        ax.set_yticks([1, 2, 3])
        ax.set_yticklabels(['斜向模式', '切向模式', '轴向模式'])
        ax.set_xlabel('频率 (Hz)', fontsize=12)
        ax.set_title(
            f'房间模式分布 - {result.project_id}',
            fontsize=14,
            fontweight='bold'
        )
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3, axis='x')

        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def plot_frequency_spacing(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_frequency_spacing.png"
        filepath = os.path.join(self.output_dir, filename)

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))

        sorted_modes = sorted(result.modes, key=lambda m: m.frequency)
        frequencies = [m.frequency for m in sorted_modes]

        ax1.bar(
            range(len(frequencies)),
            frequencies,
            color='#3498db',
            alpha=0.7
        )
        ax1.set_xlabel('模式序号', fontsize=12)
        ax1.set_ylabel('频率 (Hz)', fontsize=12)
        ax1.set_title('模式频率排序', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3, axis='y')

        if len(frequencies) > 1:
            spacings = np.diff(frequencies)
            ax2.bar(
                range(len(spacings)),
                spacings,
                color='#2ecc71',
                alpha=0.7
            )

            for gap in result.frequency_gaps:
                if gap.risk_level in [RiskLevel.CRITICAL, RiskLevel.WARNING]:
                    idx = frequencies.index(gap.start_freq)
                    color = 'red' if gap.risk_level == RiskLevel.CRITICAL else 'orange'
                    ax2.bar(idx, gap.gap_size, color=color, alpha=0.8)

            ax2.axhline(y=10, color='orange', linestyle='--', label='警告阈值 (10Hz)')
            ax2.axhline(y=20, color='red', linestyle='--', label='危险阈值 (20Hz)')
            ax2.set_xlabel('间隔序号', fontsize=12)
            ax2.set_ylabel('频率间隔 (Hz)', fontsize=12)
            ax2.set_title('模式频率间隔分布', fontsize=14, fontweight='bold')
            ax2.legend(loc='upper right')
            ax2.grid(True, alpha=0.3, axis='y')

        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def plot_listening_point_analysis(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_listening_points.png"
        filepath = os.path.join(self.output_dir, filename)

        if not result.listening_point_analyses:
            return ""

        fig, axes = plt.subplots(
            len(result.listening_point_analyses),
            1,
            figsize=(14, 5 * len(result.listening_point_analyses))
        )

        if len(result.listening_point_analyses) == 1:
            axes = [axes]

        for idx, lpa in enumerate(result.listening_point_analyses):
            ax = axes[idx]
            point = lpa.point

            freqs = []
            amplitudes = []
            mode_types = []

            for mode in result.modes:
                key = (mode.nx, mode.ny, mode.nz)
                if key in lpa.mode_amplitude_factors:
                    freqs.append(mode.frequency)
                    amplitudes.append(lpa.mode_amplitude_factors[key])
                    mode_types.append(mode.mode_type)

            colors = [
                '#e74c3c' if mt == ModeType.AXIAL else
                '#3498db' if mt == ModeType.TANGENTIAL else '#2ecc71'
                for mt in mode_types
            ]

            ax.scatter(freqs, amplitudes, c=colors, alpha=0.7, s=80)
            ax.axhline(y=0.1, color='red', linestyle='--', label='节点阈值 (0.1)')
            ax.set_xlabel('频率 (Hz)', fontsize=12)
            ax.set_ylabel('相对振幅', fontsize=12)
            ax.set_title(
                f'监听点 ({point.x:.2f}, {point.y:.2f}, {point.z:.2f}m) 模式振幅分析',
                fontsize=14,
                fontweight='bold'
            )
            ax.legend(loc='upper right')
            ax.grid(True, alpha=0.3)
            ax.set_ylim(0, 1.1)

        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches='tight')
        plt.close()

        return filepath

    def generate_charts(self, result: AnalysisResult) -> Dict[str, str]:
        charts = {}
        charts['mode_distribution'] = self.plot_mode_distribution(result)
        charts['frequency_spacing'] = self.plot_frequency_spacing(result)
        charts['listening_points'] = self.plot_listening_point_analysis(result)
        return charts

    def export_modes_csv(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_modes.csv"
        filepath = os.path.join(self.output_dir, filename)

        data = []
        for mode in result.modes:
            data.append({
                '频率(Hz)': round(mode.frequency, 2),
                'nx': mode.nx,
                'ny': mode.ny,
                'nz': mode.nz,
                '模式类型': mode.mode_type.value,
                '波长(m)': round(mode.wavelength, 3),
                '简并度': mode.degeneracy
            })

        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        return filepath

    def export_report_json(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_report.json"
        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)

        return filepath

    def export_report_yaml(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_report.yaml"
        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.dump(result.to_dict(), f, allow_unicode=True, default_flow_style=False)

        return filepath

    def generate_text_report(
        self,
        result: AnalysisResult,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"{result.project_id}_report.txt"
        filepath = os.path.join(self.output_dir, filename)

        lines = []
        lines.append("=" * 60)
        lines.append(f"房间声学模式分析报告 - {result.project_id}")
        lines.append(f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")

        config = result.config
        lines.append("【房间配置】")
        lines.append(f"  尺寸: {config.room_dimensions.length:.2f}m x "
                     f"{config.room_dimensions.width:.2f}m x "
                     f"{config.room_dimensions.height:.2f}m")
        lines.append(f"  体积: {(config.room_dimensions.length * config.room_dimensions.width * config.room_dimensions.height):.2f} m³")
        lines.append(f"  声速: {config.sound_speed:.1f} m/s")
        lines.append(f"  频率范围: {config.min_frequency:.0f} - {config.max_frequency:.0f} Hz")
        lines.append("")

        lines.append("【模式统计】")
        axial_count = sum(1 for m in result.modes if m.mode_type == ModeType.AXIAL)
        tangential_count = sum(1 for m in result.modes if m.mode_type == ModeType.TANGENTIAL)
        oblique_count = sum(1 for m in result.modes if m.mode_type == ModeType.OBLIQUE)
        lines.append(f"  总模式数: {len(result.modes)}")
        lines.append(f"  轴向模式: {axial_count}")
        lines.append(f"  切向模式: {tangential_count}")
        lines.append(f"  斜向模式: {oblique_count}")
        lines.append("")

        lines.append("【风险分析】")
        lines.append(f"  频率间隔异常: {len(result.frequency_gaps)} 处")
        for gap in result.frequency_gaps[:5]:
            lines.append(f"    - {gap.start_freq:.1f} - {gap.end_freq:.1f} Hz: "
                         f"间隔 {gap.gap_size:.1f} Hz [{gap.risk_level.value}]")
        if len(result.frequency_gaps) > 5:
            lines.append(f"    ... 还有 {len(result.frequency_gaps) - 5} 处")
        lines.append("")

        lines.append(f"  模式聚集: {len(result.mode_clusters)} 处")
        for cluster in result.mode_clusters[:5]:
            lines.append(f"    - {cluster.center_freq:.1f} Hz: "
                         f"{len(cluster.modes)} 个模式, 带宽 {cluster.bandwidth:.1f} Hz "
                         f"[{cluster.risk_level.value}]")
        if len(result.mode_clusters) > 5:
            lines.append(f"    ... 还有 {len(result.mode_clusters) - 5} 处")
        lines.append("")

        lines.append(f"  重复/简并模式: {len(result.duplicate_modes)} 组")
        for primary, duplicates in result.duplicate_modes[:5]:
            lines.append(f"    - {primary.frequency:.1f} Hz: "
                         f"({primary.nx},{primary.ny},{primary.nz}) + "
                         f"{len(duplicates)} 个重复")
        if len(result.duplicate_modes) > 5:
            lines.append(f"    ... 还有 {len(result.duplicate_modes) - 5} 组")
        lines.append("")

        lines.append("【监听点分析】")
        for i, lpa in enumerate(result.listening_point_analyses):
            lines.append(f"  监听点 {i + 1}: ({lpa.point.x:.2f}, {lpa.point.y:.2f}, {lpa.point.z:.2f}) m")
            if lpa.issues:
                for issue in lpa.issues[:3]:
                    lines.append(f"    - {issue}")
                if len(lpa.issues) > 3:
                    lines.append(f"    ... 还有 {len(lpa.issues) - 3} 个问题")
            else:
                lines.append("    - 无明显问题")
        lines.append("")

        if config.issues:
            lines.append("【数据问题】")
            for issue in config.issues:
                lines.append(f"  [{issue.severity}] {issue.field}: {issue.message}")
            lines.append("")

        lines.append("=" * 60)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return filepath

    def generate_all_reports(
        self,
        result: AnalysisResult
    ) -> Dict[str, str]:
        outputs = {}
        outputs['charts'] = self.generate_charts(result)
        outputs['modes_csv'] = self.export_modes_csv(result)
        outputs['report_json'] = self.export_report_json(result)
        outputs['report_yaml'] = self.export_report_yaml(result)
        outputs['report_txt'] = self.generate_text_report(result)
        return outputs


class HistoryManager:
    def __init__(self, history_dir: str = 'history'):
        self.history_dir = history_dir
        os.makedirs(history_dir, exist_ok=True)

    def save_result(self, result: AnalysisResult) -> str:
        timestamp = result.generated_at.strftime('%Y%m%d_%H%M%S')
        filename = f"{result.project_id}_{timestamp}.json"
        filepath = os.path.join(self.history_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)

        return filepath

    def load_result(self, filepath: str) -> Optional[AnalysisResult]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return self._dict_to_result(data)
        except Exception:
            return None

    def _dict_to_result(self, data: Dict) -> AnalysisResult:
        return AnalysisResult(
            project_id=data['project_id'],
            config=self._dict_to_config(data['config']),
            modes=[self._dict_to_mode(m) for m in data['modes']],
            frequency_gaps=[self._dict_to_gap(g) for g in data['frequency_gaps']],
            mode_clusters=[self._dict_to_cluster(c) for c in data['mode_clusters']],
            listening_point_analyses=[],
            duplicate_modes=[],
            generated_at=datetime.fromisoformat(data['generated_at'])
        )

    def _dict_to_config(self, data: Dict) -> RoomConfig:
        from .data_handler import RoomDimensions, ListeningPoint
        dims = data['room_dimensions']
        return RoomConfig(
            project_id=data['project_id'],
            room_dimensions=RoomDimensions(
                length=dims['length'],
                width=dims['width'],
                height=dims['height'],
                unit=dims['unit']
            ),
            sound_speed=data['sound_speed'],
            min_frequency=data['min_frequency'],
            max_frequency=data['max_frequency'],
            listening_points=[
                ListeningPoint(**lp) for lp in data['listening_points']
            ],
            absorption_materials=data.get('absorption_materials', {}),
            notes=data.get('notes', ''),
            issues=[],
            is_valid=data['is_valid']
        )

    def _dict_to_mode(self, data: Dict) -> RoomMode:
        return RoomMode(
            frequency=data['frequency'],
            nx=data['nx'],
            ny=data['ny'],
            nz=data['nz'],
            mode_type=ModeType(data['mode_type']),
            wavelength=data['wavelength'],
            degeneracy=data['degeneracy']
        )

    def _dict_to_gap(self, data: Dict) -> FrequencyGap:
        return FrequencyGap(
            start_freq=data['start_freq'],
            end_freq=data['end_freq'],
            gap_size=data['gap_size'],
            risk_level=RiskLevel(data['risk_level'])
        )

    def _dict_to_cluster(self, data: Dict) -> ModeCluster:
        return ModeCluster(
            center_freq=data['center_freq'],
            modes=[self._dict_to_mode(m) for m in data['modes']],
            bandwidth=data['bandwidth'],
            risk_level=RiskLevel(data['risk_level'])
        )

    def get_project_history(self, project_id: str) -> List[str]:
        history_files = []
        for filename in os.listdir(self.history_dir):
            if filename.startswith(project_id) and filename.endswith('.json'):
                history_files.append(os.path.join(self.history_dir, filename))
        return sorted(history_files, reverse=True)

    def get_latest_result(self, project_id: str) -> Optional[AnalysisResult]:
        history = self.get_project_history(project_id)
        if not history:
            return None
        return self.load_result(history[0])


class DiffAnalyzer:
    def __init__(self, tolerance: float = 0.5):
        self.tolerance = tolerance

    def compare_results(
        self,
        old_result: AnalysisResult,
        new_result: AnalysisResult
    ) -> DiffResult:
        diff = DiffResult(
            project_id=new_result.project_id,
            old_result=old_result,
            new_result=new_result
        )

        old_dims = old_result.config.room_dimensions
        new_dims = new_result.config.room_dimensions

        diff.dimension_changes = {
            'length': {'old': old_dims.length, 'new': new_dims.length,
                       'diff': new_dims.length - old_dims.length},
            'width': {'old': old_dims.width, 'new': new_dims.width,
                      'diff': new_dims.width - old_dims.width},
            'height': {'old': old_dims.height, 'new': new_dims.height,
                       'diff': new_dims.height - old_dims.height}
        }

        old_mode_keys = {(m.nx, m.ny, m.nz): m for m in old_result.modes}
        new_mode_keys = {(m.nx, m.ny, m.nz): m for m in new_result.modes}

        for key, mode in new_mode_keys.items():
            if key not in old_mode_keys:
                diff.added_modes.append(mode)

        for key, mode in old_mode_keys.items():
            if key not in new_mode_keys:
                diff.removed_modes.append(mode)

        for key, old_mode in old_mode_keys.items():
            if key in new_mode_keys:
                new_mode = new_mode_keys[key]
                freq_diff = new_mode.frequency - old_mode.frequency
                if abs(freq_diff) > self.tolerance:
                    diff.frequency_shifts.append({
                        'mode': key,
                        'old_freq': old_mode.frequency,
                        'new_freq': new_mode.frequency,
                        'diff': freq_diff
                    })

        return diff

    def generate_diff_report(
        self,
        diff: DiffResult,
        output_dir: str = 'output'
    ) -> str:
        filename = f"{diff.project_id}_diff_report.txt"
        filepath = os.path.join(output_dir, filename)

        lines = []
        lines.append("=" * 60)
        lines.append(f"差异分析报告 - {diff.project_id}")
        lines.append("=" * 60)
        lines.append("")

        lines.append("【尺寸变化】")
        for dim, changes in diff.dimension_changes.items():
            sign = '+' if changes['diff'] >= 0 else ''
            lines.append(f"  {dim}: {changes['old']:.3f}m -> {changes['new']:.3f}m "
                         f"({sign}{changes['diff']:.3f}m)")
        lines.append("")

        lines.append("【模式变化】")
        lines.append(f"  新增模式: {len(diff.added_modes)} 个")
        for mode in diff.added_modes[:10]:
            lines.append(f"    + ({mode.nx},{mode.ny},{mode.nz}): {mode.frequency:.1f} Hz")
        if len(diff.added_modes) > 10:
            lines.append(f"    ... 还有 {len(diff.added_modes) - 10} 个")
        lines.append("")

        lines.append(f"  移除模式: {len(diff.removed_modes)} 个")
        for mode in diff.removed_modes[:10]:
            lines.append(f"    - ({mode.nx},{mode.ny},{mode.nz}): {mode.frequency:.1f} Hz")
        if len(diff.removed_modes) > 10:
            lines.append(f"    ... 还有 {len(diff.removed_modes) - 10} 个")
        lines.append("")

        lines.append(f"  频率偏移: {len(diff.frequency_shifts)} 个")
        for shift in diff.frequency_shifts[:10]:
            sign = '+' if shift['diff'] >= 0 else ''
            lines.append(f"    ~ {shift['mode']}: {shift['old_freq']:.1f} -> {shift['new_freq']:.1f} Hz "
                         f"({sign}{shift['diff']:.1f} Hz)")
        if len(diff.frequency_shifts) > 10:
            lines.append(f"    ... 还有 {len(diff.frequency_shifts) - 10} 个")
        lines.append("")

        lines.append("=" * 60)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return filepath
