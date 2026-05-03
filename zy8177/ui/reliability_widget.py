#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
可靠性评分组件
用于显示视野检查的可靠性评分和指标
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QGridLayout, QProgressBar
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont, QColor, QPainter, QLinearGradient, QPen, QBrush
from typing import Dict, Any, Optional


class ReliabilityWidget(QWidget):
    """
    可靠性评分组件
    显示固视丢失、假阳性、假阴性率和综合评分
    """
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # 当前数据
        self.current_reliability: Optional[Dict[str, Any]] = None
        
        self.init_ui()
        
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        
        # 标题
        title_label = QLabel("可靠性评分")
        title_font = QFont()
        title_font.setBold(True)
        title_font.setPointSize(11)
        title_label.setFont(title_font)
        layout.addWidget(title_label)
        
        # 综合评分区域
        score_layout = QHBoxLayout()
        
        # 圆形评分显示
        self.score_display = CircularScoreDisplay()
        score_layout.addWidget(self.score_display)
        
        # 评分描述
        self.level_description = QLabel("暂无数据")
        self.level_description.setWordWrap(True)
        self.level_description.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        score_layout.addWidget(self.level_description, 1)
        
        layout.addLayout(score_layout)
        
        # 分隔线
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        layout.addWidget(line)
        
        # 详细指标区域
        metrics_layout = QGridLayout()
        metrics_layout.setSpacing(10)
        
        # 固视丢失
        fixation_label = QLabel("固视丢失:")
        metrics_layout.addWidget(fixation_label, 0, 0)
        
        self.fixation_progress = QProgressBar()
        self.fixation_progress.setRange(0, 100)
        self.fixation_progress.setTextVisible(True)
        metrics_layout.addWidget(self.fixation_progress, 0, 1)
        
        self.fixation_status = QLabel()
        metrics_layout.addWidget(self.fixation_status, 0, 2)
        
        # 假阳性
        fp_label = QLabel("假阳性:")
        metrics_layout.addWidget(fp_label, 1, 0)
        
        self.fp_progress = QProgressBar()
        self.fp_progress.setRange(0, 100)
        self.fp_progress.setTextVisible(True)
        metrics_layout.addWidget(self.fp_progress, 1, 1)
        
        self.fp_status = QLabel()
        metrics_layout.addWidget(self.fp_status, 1, 2)
        
        # 假阴性
        fn_label = QLabel("假阴性:")
        metrics_layout.addWidget(fn_label, 2, 0)
        
        self.fn_progress = QProgressBar()
        self.fn_progress.setRange(0, 100)
        self.fn_progress.setTextVisible(True)
        metrics_layout.addWidget(self.fn_progress, 2, 1)
        
        self.fn_status = QLabel()
        metrics_layout.addWidget(self.fn_status, 2, 2)
        
        layout.addLayout(metrics_layout)
        
        # 问题列表
        issues_label = QLabel("问题列表:")
        issues_font = QFont()
        issues_font.setBold(True)
        issues_label.setFont(issues_font)
        layout.addWidget(issues_label)
        
        self.issues_text = QLabel("暂无问题")
        self.issues_text.setWordWrap(True)
        self.issues_text.setStyleSheet("color: #666666;")
        layout.addWidget(self.issues_text)
        
        # 警告列表
        warnings_label = QLabel("警告:")
        warnings_font = QFont()
        warnings_font.setBold(True)
        warnings_label.setFont(warnings_font)
        layout.addWidget(warnings_label)
        
        self.warnings_text = QLabel("暂无警告")
        self.warnings_text.setWordWrap(True)
        self.warnings_text.setStyleSheet("color: #996600;")
        layout.addWidget(self.warnings_text)
        
    def set_reliability(self, reliability: Dict[str, Any]):
        """
        设置可靠性数据
        """
        self.current_reliability = reliability
        
        # 更新综合评分
        score = reliability.get('score', 0)
        level = reliability.get('level', {})
        
        self.score_display.set_score(score, level.get('color', '#888888'))
        
        # 更新等级描述
        level_label = level.get('label', '未知')
        level_desc = level.get('description', '')
        self.level_description.setText(
            f"<b>{level_label}</b><br><br>{level_desc}"
        )
        
        # 更新各项指标
        fixation_rate = reliability.get('fixation_rate', 0)
        fp_rate = reliability.get('false_positive_rate', 0)
        fn_rate = reliability.get('false_negative_rate', 0)
        
        # 固视丢失
        self.fixation_progress.setValue(int(fixation_rate))
        self.fixation_progress.setFormat(f"{fixation_rate:.1f}%")
        self._update_progress_bar_style(self.fixation_progress, fixation_rate, 'fixation')
        
        # 假阳性
        self.fp_progress.setValue(int(fp_rate))
        self.fp_progress.setFormat(f"{fp_rate:.1f}%")
        self._update_progress_bar_style(self.fp_progress, fp_rate, 'false_positive')
        
        # 假阴性
        self.fn_progress.setValue(int(fn_rate))
        self.fn_progress.setFormat(f"{fn_rate:.1f}%")
        self._update_progress_bar_style(self.fn_progress, fn_rate, 'false_negative')
        
        # 更新状态标签
        self._update_status_labels(reliability)
        
        # 更新问题列表
        issues = reliability.get('issues', [])
        if issues:
            issues_html = "<ul>"
            for issue in issues:
                issues_html += f"<li style='color: #CC0000;'>{issue}</li>"
            issues_html += "</ul>"
            self.issues_text.setText(issues_html)
            self.issues_text.setStyleSheet("")
        else:
            self.issues_text.setText("暂无问题")
            self.issues_text.setStyleSheet("color: #666666;")
        
        # 更新警告列表
        warnings = reliability.get('warnings', [])
        if warnings:
            warnings_html = "<ul>"
            for warning in warnings:
                warnings_html += f"<li style='color: #996600;'>{warning}</li>"
            warnings_html += "</ul>"
            self.warnings_text.setText(warnings_html)
            self.warnings_text.setStyleSheet("")
        else:
            self.warnings_text.setText("暂无警告")
            self.warnings_text.setStyleSheet("color: #666666;")
            
    def _update_progress_bar_style(self, progress_bar: QProgressBar, rate: float, metric_type: str):
        """
        更新进度条样式
        """
        # 根据比率设置颜色
        if metric_type == 'fixation':
            critical = 30  # 30%
            warning = 20   # 20%
        elif metric_type == 'false_positive':
            critical = 20
            warning = 15
        else:  # false_negative
            critical = 30
            warning = 20
        
        if rate >= critical:
            # 红色 - 严重
            color = "#F44336"
        elif rate >= warning:
            # 橙色 - 警告
            color = "#FF9800"
        else:
            # 绿色 - 正常
            color = "#4CAF50"
        
        # 设置样式
        style = f"""
            QProgressBar {{
                border: 1px solid #CCCCCC;
                border-radius: 3px;
                text-align: center;
                background-color: #F5F5F5;
            }}
            QProgressBar::chunk {{
                background-color: {color};
                border-radius: 2px;
            }}
        """
        progress_bar.setStyleSheet(style)
        
    def _update_status_labels(self, reliability: Dict[str, Any]):
        """
        更新状态标签
        """
        fixation_score = reliability.get('fixation_score', 0)
        fp_score = reliability.get('false_positive_score', 0)
        fn_score = reliability.get('false_negative_score', 0)
        
        # 固视丢失状态
        if fixation_score >= 80:
            status_text = "✓ 正常"
            status_color = "#4CAF50"
        elif fixation_score >= 50:
            status_text = "⚠ 注意"
            status_color = "#FF9800"
        else:
            status_text = "✗ 异常"
            status_color = "#F44336"
        
        self.fixation_status.setText(status_text)
        self.fixation_status.setStyleSheet(f"color: {status_color}; font-weight: bold;")
        
        # 假阳性状态
        if fp_score >= 80:
            status_text = "✓ 正常"
            status_color = "#4CAF50"
        elif fp_score >= 50:
            status_text = "⚠ 注意"
            status_color = "#FF9800"
        else:
            status_text = "✗ 异常"
            status_color = "#F44336"
        
        self.fp_status.setText(status_text)
        self.fp_status.setStyleSheet(f"color: {status_color}; font-weight: bold;")
        
        # 假阴性状态
        if fn_score >= 80:
            status_text = "✓ 正常"
            status_color = "#4CAF50"
        elif fn_score >= 50:
            status_text = "⚠ 注意"
            status_color = "#FF9800"
        else:
            status_text = "✗ 异常"
            status_color = "#F44336"
        
        self.fn_status.setText(status_text)
        self.fn_status.setStyleSheet(f"color: {status_color}; font-weight: bold;")


class CircularScoreDisplay(QWidget):
    """
    圆形评分显示组件
    """
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(120, 120)
        self.setMaximumSize(150, 150)
        
        self.score = 0
        self.color = "#888888"
        
    def set_score(self, score: float, color: str):
        """设置分数和颜色"""
        self.score = score
        self.color = color
        self.update()
        
    def paintEvent(self, event):
        """绘制事件"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 中心点
        center_x = self.width() / 2
        center_y = self.height() / 2
        radius = min(center_x, center_y) - 10
        
        # 绘制背景圆
        pen = QPen(QColor("#E0E0E0"), 8)
        painter.setPen(pen)
        painter.drawEllipse(center_x - radius, center_y - radius, radius * 2, radius * 2)
        
        # 绘制进度圆弧
        import math
        
        # 转换角度 (Qt使用1/16度)
        # 0度在右侧，逆时针为正
        # 我们需要从顶部(270度)开始，顺时针绘制
        
        start_angle = 90 * 16  # 从顶部开始
        span_angle = int(-self.score / 100 * 360 * 16)  # 顺时针绘制
        
        pen = QPen(QColor(self.color), 10)
        pen.setCapStyle(Qt.RoundCap)
        painter.setPen(pen)
        
        # 绘制圆弧
        painter.drawArc(
            int(center_x - radius), int(center_y - radius),
            int(radius * 2), int(radius * 2),
            start_angle, span_angle
        )
        
        # 绘制分数文字
        painter.setPen(QColor("#333333"))
        font = painter.font()
        font.setBold(True)
        font.setPointSize(16)
        painter.setFont(font)
        
        score_text = f"{self.score:.0f}"
        painter.drawText(
            int(center_x - 30), int(center_y - 10),
            60, 40,
            Qt.AlignCenter,
            score_text
        )
        
        # 绘制"分"字
        font.setPointSize(10)
        font.setBold(False)
        painter.setFont(font)
        painter.drawText(
            int(center_x - 30), int(center_y + 15),
            60, 20,
            Qt.AlignCenter,
            "分"
        )
