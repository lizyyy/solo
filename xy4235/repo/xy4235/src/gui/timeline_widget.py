import sys
import os
from typing import Optional, List, Dict
from datetime import datetime, timedelta

from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QComboBox, QCheckBox, QGroupBox
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

try:
    import matplotlib
    matplotlib.use('Qt5Agg')
    from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
    from matplotlib.backends.backend_qt5agg import NavigationToolbar2QT as NavigationToolbar
    from matplotlib.figure import Figure
    from matplotlib.lines import Line2D
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    plt = None
    np = None

from models.case import Case
from models.risk import RiskType, RiskStatus, Risk
from models.vital_signs import VitalSigns, VitalSignsRecord
from models.medication import Medication, MedicationRecord


class TimelineWidget(QWidget):
    """
    时间轴可视化组件
    展示生命体征、给药节点和风险片段
    """
    
    risk_clicked = pyqtSignal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.case: Optional[Case] = None
        
        # 创建UI
        self._create_ui()
    
    def _create_ui(self):
        """
        创建UI
        """
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(5)
        
        # 控制面板
        controls_layout = QHBoxLayout()
        
        # 标题
        title_label = QLabel("时间轴视图")
        title_label.setFont(QFont("Arial", 12, QFont.Bold))
        controls_layout.addWidget(title_label)
        
        controls_layout.addStretch()
        
        # 显示选项
        self.show_temp_cb = QCheckBox("体温")
        self.show_temp_cb.setChecked(True)
        self.show_temp_cb.stateChanged.connect(self._refresh_plot)
        controls_layout.addWidget(self.show_temp_cb)
        
        self.show_hr_cb = QCheckBox("心率")
        self.show_hr_cb.setChecked(True)
        self.show_hr_cb.stateChanged.connect(self._refresh_plot)
        controls_layout.addWidget(self.show_hr_cb)
        
        self.show_spo2_cb = QCheckBox("血氧")
        self.show_spo2_cb.setChecked(True)
        self.show_spo2_cb.stateChanged.connect(self._refresh_plot)
        controls_layout.addWidget(self.show_spo2_cb)
        
        self.show_bp_cb = QCheckBox("血压")
        self.show_bp_cb.setChecked(True)
        self.show_bp_cb.stateChanged.connect(self._refresh_plot)
        controls_layout.addWidget(self.show_bp_cb)
        
        self.show_medication_cb = QCheckBox("给药节点")
        self.show_medication_cb.setChecked(True)
        self.show_medication_cb.stateChanged.connect(self._refresh_plot)
        controls_layout.addWidget(self.show_medication_cb)
        
        self.show_risks_cb = QCheckBox("风险片段")
        self.show_risks_cb.setChecked(True)
        self.show_risks_cb.stateChanged.connect(self._refresh_plot)
        controls_layout.addWidget(self.show_risks_cb)
        
        layout.addLayout(controls_layout)
        
        # matplotlib 画布
        if plt and np:
            self.figure = Figure(figsize=(10, 6), dpi=100)
            self.canvas = FigureCanvas(self.figure)
            self.toolbar = NavigationToolbar(self.canvas, self)
            layout.addWidget(self.toolbar)
            layout.addWidget(self.canvas)
            
            # 初始绘制
            self._init_plot()
        else:
            label = QLabel("matplotlib 未安装，无法显示图表")
            label.setAlignment(Qt.AlignCenter)
            label.setStyleSheet("font-size: 14px; color: red; padding: 50px;")
            layout.addWidget(label)
            self.canvas = None
    
    def _init_plot(self):
        """
        初始化绘图区域
        """
        if not plt:
            return
        
        self.figure.clear()
        
        # 创建子图：生命体征、给药、风险
        gs = self.figure.add_gridspec(3, 1, height_ratios=[3, 1, 1], hspace=0.3)
        
        self.ax_vitals = self.figure.add_subplot(gs[0])
        self.ax_medication = self.figure.add_subplot(gs[1])
        self.ax_risks = self.figure.add_subplot(gs[2])
        
        # 设置标题
        self.ax_vitals.set_title("生命体征时间轴", fontsize=12, fontweight='bold')
        self.ax_medication.set_title("给药记录", fontsize=10)
        self.ax_risks.set_title("风险片段", fontsize=10)
        
        # 设置网格
        self.ax_vitals.grid(True, alpha=0.3)
        self.ax_medication.grid(True, alpha=0.3)
        self.ax_risks.grid(True, alpha=0.3)
        
        # 设置Y轴标签
        self.ax_vitals.set_ylabel("数值")
        self.ax_medication.set_yticks([0])
        self.ax_medication.set_yticklabels(["给药"])
        self.ax_risks.set_yticks([0])
        self.ax_risks.set_yticklabels(["风险"])
        
        # 调整布局
        self.figure.tight_layout()
        
        # 绘制
        self.canvas.draw()
    
    def set_case(self, case: Optional[Case]):
        """
        设置病例数据
        """
        self.case = case
        self._refresh_plot()
    
    def _refresh_plot(self):
        """
        刷新图表
        """
        if not plt or not np or not self.canvas:
            return
        
        self.figure.clear()
        
        # 重新创建子图
        gs = self.figure.add_gridspec(3, 1, height_ratios=[3, 1, 1], hspace=0.3)
        
        self.ax_vitals = self.figure.add_subplot(gs[0])
        self.ax_medication = self.figure.add_subplot(gs[1])
        self.ax_risks = self.figure.add_subplot(gs[2])
        
        if self.case:
            self._plot_vital_signs()
            self._plot_medications()
            self._plot_risks()
        else:
            # 空状态
            for ax in [self.ax_vitals, self.ax_medication, self.ax_risks]:
                ax.text(0.5, 0.5, "请导入数据", transform=ax.transAxes,
                       ha='center', va='center', fontsize=14, alpha=0.5)
                ax.set_xticks([])
                ax.set_yticks([])
        
        # 设置标题
        self.ax_vitals.set_title("生命体征时间轴", fontsize=12, fontweight='bold')
        self.ax_medication.set_title("给药记录", fontsize=10)
        self.ax_risks.set_title("风险片段", fontsize=10)
        
        # 调整布局
        self.figure.tight_layout()
        
        # 绘制
        self.canvas.draw()
    
    def _plot_vital_signs(self):
        """
        绘制生命体征
        """
        if not self.case or not self.case.vital_signs:
            return
        
        vs = self.case.vital_signs
        
        # 获取时间序列
        times = [r.timestamp for r in vs.records]
        
        if not times:
            return
        
        # 转换为相对时间（秒）
        start_time = times[0]
        x = [(t - start_time).total_seconds() for t in times]
        
        lines = []
        labels = []
        
        # 体温
        if self.show_temp_cb.isChecked() and vs.has_data('temperature'):
            temps = [r.temperature for r in vs.records]
            line, = self.ax_vitals.plot(x, temps, 'r-', linewidth=1.5, label='体温 (°C)')
            lines.append(line)
            labels.append('体温 (°C)')
        
        # 心率
        if self.show_hr_cb.isChecked() and vs.has_data('heart_rate'):
            hrs = [r.heart_rate for r in vs.records]
            line, = self.ax_vitals.plot(x, hrs, 'g-', linewidth=1.5, label='心率 (bpm)')
            lines.append(line)
            labels.append('心率 (bpm)')
        
        # 血氧
        if self.show_spo2_cb.isChecked() and vs.has_data('spo2'):
            spo2s = [r.spo2 for r in vs.records]
            line, = self.ax_vitals.plot(x, spo2s, 'b-', linewidth=1.5, label='血氧 (%)')
            lines.append(line)
            labels.append('血氧 (%)')
        
        # 血压
        if self.show_bp_cb.isChecked():
            has_sbp = vs.has_data('systolic_bp')
            has_dbp = vs.has_data('diastolic_bp')
            
            if has_sbp:
                sbps = [r.systolic_bp for r in vs.records]
                line, = self.ax_vitals.plot(x, sbps, 'm--', linewidth=1, label='收缩压')
                lines.append(line)
                labels.append('收缩压')
            
            if has_dbp:
                dbps = [r.diastolic_bp for r in vs.records]
                line, = self.ax_vitals.plot(x, dbps, 'm:', linewidth=1, label='舒张压')
                lines.append(line)
                labels.append('舒张压')
        
        # 添加图例
        if lines:
            self.ax_vitals.legend(lines, labels, loc='upper right', fontsize=8)
        
        # 设置X轴
        self._format_x_axis(self.ax_vitals, x, start_time)
        
        # 添加网格
        self.ax_vitals.grid(True, alpha=0.3)
    
    def _plot_medications(self):
        """
        绘制给药记录
        """
        if not self.show_medication_cb.isChecked():
            self.ax_medication.set_yticks([0])
            self.ax_medication.set_yticklabels(["给药"])
            return
        
        if not self.case or not self.case.medications:
            self.ax_medication.text(0.5, 0.5, "无给药记录", transform=self.ax_medication.transAxes,
                                    ha='center', va='center', fontsize=10, alpha=0.5)
            self.ax_medication.set_yticks([0])
            self.ax_medication.set_yticklabels(["给药"])
            return
        
        # 获取时间范围
        if self.case.vital_signs and self.case.vital_signs.records:
            start_time = self.case.vital_signs.records[0].timestamp
            end_time = self.case.vital_signs.records[-1].timestamp
        else:
            # 使用给药时间
            all_med_times = []
            for med in self.case.medications:
                all_med_times.extend([r.admin_time for r in med.records])
            
            if not all_med_times:
                self.ax_medication.text(0.5, 0.5, "无有效时间数据", transform=self.ax_medication.transAxes,
                                        ha='center', va='center', fontsize=10, alpha=0.5)
                return
            
            start_time = min(all_med_times)
            end_time = max(all_med_times)
        
        # 颜色映射
        colors = plt.cm.get_cmap('tab10', 10)
        color_idx = 0
        
        # 绘制每种药物
        for med in self.case.medications:
            med_color = colors(color_idx % 10)
            color_idx += 1
            
            # 绘制给药时间点
            for i, record in enumerate(med.records):
                x = (record.admin_time - start_time).total_seconds()
                
                # 绘制垂直线
                self.ax_medication.axvline(x=x, color=med_color, alpha=0.7, linewidth=2)
                
                # 添加药物名称标签
                label = record.medication_name or med.name or "未知药物"
                self.ax_medication.text(x, 0.05, label, rotation=45, ha='left', va='bottom',
                                       fontsize=7, color=med_color)
        
        # 设置Y轴
        self.ax_medication.set_ylim(-0.5, 1)
        self.ax_medication.set_yticks([0])
        self.ax_medication.set_yticklabels(["给药"])
        
        # 设置X轴范围
        total_duration = (end_time - start_time).total_seconds()
        if total_duration > 0:
            self.ax_medication.set_xlim(-total_duration * 0.05, total_duration * 1.05)
        else:
            self.ax_medication.set_xlim(-60, 60)
        
        # 隐藏X轴标签（与上面的图共享）
        self.ax_medication.set_xticklabels([])
        
        self.ax_medication.grid(True, alpha=0.3, axis='x')
    
    def _plot_risks(self):
        """
        绘制风险片段
        """
        if not self.show_risks_cb.isChecked():
            self.ax_risks.set_yticks([0])
            self.ax_risks.set_yticklabels(["风险"])
            return
        
        if not self.case or not self.case.risks:
            self.ax_risks.text(0.5, 0.5, "无检测到风险", transform=self.ax_risks.transAxes,
                              ha='center', va='center', fontsize=10, alpha=0.5)
            self.ax_risks.set_yticks([0])
            self.ax_risks.set_yticklabels(["风险"])
            return
        
        # 获取时间范围
        if self.case.vital_signs and self.case.vital_signs.records:
            start_time = self.case.vital_signs.records[0].timestamp
            end_time = self.case.vital_signs.records[-1].timestamp
        else:
            # 使用风险时间
            all_risk_times = []
            for risk in self.case.risks:
                if risk.start_time:
                    all_risk_times.append(risk.start_time)
                if risk.end_time:
                    all_risk_times.append(risk.end_time)
            
            if not all_risk_times:
                self.ax_risks.text(0.5, 0.5, "无有效时间数据", transform=self.ax_risks.transAxes,
                                   ha='center', va='center', fontsize=10, alpha=0.5)
                return
            
            start_time = min(all_risk_times)
            end_time = max(all_risk_times)
        
        # 风险类型颜色映射
        risk_colors = {
            RiskType.HYPOTHERMIA: 'blue',
            RiskType.SPO2_DROP: 'red',
            RiskType.MEDICATION_OVERDUE: 'orange',
            RiskType.RECOVERY_SCORE: 'purple',
            RiskType.HYPOTENSION: 'green',
            RiskType.HYPERTENSION: 'brown',
            RiskType.TACHYCARDIA: 'pink',
            RiskType.BRADYCARDIA: 'gray'
        }
        
        # 状态颜色
        status_colors = {
            RiskStatus.PENDING: 'yellow',
            RiskStatus.CONFIRMED: 'red',
            RiskStatus.DISMISSED: 'green'
        }
        
        # 按类型分组
        risk_types = sorted(set(r.risk_type for r in self.case.risks))
        type_to_y = {rt: i for i, rt in enumerate(risk_types)}
        
        # 绘制每个风险
        for risk in self.case.risks:
            y = type_to_y.get(risk.risk_type, 0)
            
            # 计算X位置
            if risk.start_time:
                x_start = (risk.start_time - start_time).total_seconds()
            else:
                x_start = 0
            
            if risk.end_time:
                x_end = (risk.end_time - start_time).total_seconds()
            else:
                x_end = x_start + 60
            
            # 颜色
            color = risk_colors.get(risk.risk_type, 'gray')
            
            # 状态透明度
            alpha = 0.8 if risk.status == RiskStatus.CONFIRMED else 0.5
            alpha = 0.3 if risk.status == RiskStatus.DISMISSED else alpha
            
            # 绘制矩形
            self.ax_risks.axhspan(y - 0.4, y + 0.4, xmin=x_start/((end_time - start_time).total_seconds() or 1),
                                  xmax=x_end/((end_time - start_time).total_seconds() or 1),
                                  color=color, alpha=alpha)
            
            # 标记边界
            self.ax_risks.axvline(x=x_start, color=color, linestyle='--', alpha=0.5)
            self.ax_risks.axvline(x=x_end, color=color, linestyle='--', alpha=0.5)
        
        # 设置Y轴
        self.ax_risks.set_ylim(-0.5, len(risk_types) - 0.5)
        self.ax_risks.set_yticks(range(len(risk_types)))
        
        # 风险类型名称映射
        risk_type_names = {
            RiskType.HYPOTHERMIA: '低体温',
            RiskType.SPO2_DROP: '血氧掉点',
            RiskType.MEDICATION_OVERDUE: '用药超时',
            RiskType.RECOVERY_SCORE: '复苏评分',
            RiskType.HYPOTENSION: '低血压',
            RiskType.HYPERTENSION: '高血压',
            RiskType.TACHYCARDIA: '心动过速',
            RiskType.BRADYCARDIA: '心动过缓'
        }
        
        ytick_labels = [risk_type_names.get(rt, rt.value) for rt in risk_types]
        self.ax_risks.set_yticklabels(ytick_labels, fontsize=8)
        
        # 设置X轴
        total_duration = (end_time - start_time).total_seconds()
        if total_duration > 0:
            self.ax_risks.set_xlim(-total_duration * 0.05, total_duration * 1.05)
        else:
            self.ax_risks.set_xlim(-60, 60)
        
        self._format_x_axis(self.ax_risks, [0, total_duration], start_time)
        
        self.ax_risks.grid(True, alpha=0.3, axis='x')
    
    def _format_x_axis(self, ax, x_values, start_time):
        """
        格式化X轴为时间显示
        """
        if not x_values:
            return
        
        max_x = max(x_values)
        
        # 选择合适的时间单位
        if max_x < 60:
            # 秒
            formatter = lambda sec: f"{sec:.0f}s"
            step = 10
        elif max_x < 3600:
            # 分:秒
            def formatter(sec):
                mins = int(sec // 60)
                secs = int(sec % 60)
                return f"{mins}:{secs:02d}"
            step = 60
        else:
            # 时:分:秒
            def formatter(sec):
                hours = int(sec // 3600)
                mins = int((sec % 3600) // 60)
                secs = int(sec % 60)
                return f"{hours}:{mins:02d}:{secs:02d}"
            step = 300
        
        # 设置刻度
        if max_x > 0:
            num_ticks = min(10, int(max_x / step) + 1)
            ticks = np.linspace(0, max_x, num_ticks)
            ax.set_xticks(ticks)
            ax.set_xticklabels([formatter(t) for t in ticks], rotation=0, fontsize=8)
        
        ax.set_xlabel(f"时间 (从 {start_time.strftime('%H:%M:%S')} 开始)")
