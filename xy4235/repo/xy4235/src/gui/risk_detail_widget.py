import sys
import os
from typing import Optional
from datetime import datetime

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTextEdit, QPushButton, QGroupBox, QFormLayout,
    QLineEdit, QScrollArea, QFrame
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont, QColor

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from models.risk import Risk, RiskType, RiskStatus, RiskSeverity, RiskSegment
from models.review import ReviewAction


class RiskDetailWidget(QWidget):
    """
    风险详情组件
    显示风险的详细信息，支持确认/驳回操作
    """
    
    confirm_risk = pyqtSignal(str, str)
    dismiss_risk = pyqtSignal(str, str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.current_risk: Optional[Risk] = None
        
        self._create_ui()
    
    def _create_ui(self):
        """
        创建UI
        """
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(5)
        
        # 标题
        title_label = QLabel("风险详情")
        title_label.setFont(QFont("Arial", 12, QFont.Bold))
        layout.addWidget(title_label)
        
        # 滚动区域
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        scroll_layout.setContentsMargins(5, 5, 5, 5)
        scroll_layout.setSpacing(10)
        
        # 基本信息组
        info_group = QGroupBox("基本信息")
        info_layout = QFormLayout(info_group)
        info_layout.setSpacing(5)
        
        self.risk_id_label = QLabel("-")
        info_layout.addRow("风险ID:", self.risk_id_label)
        
        self.type_label = QLabel("-")
        info_layout.addRow("风险类型:", self.type_label)
        
        self.severity_label = QLabel("-")
        info_layout.addRow("严重程度:", self.severity_label)
        
        self.status_label = QLabel("-")
        info_layout.addRow("当前状态:", self.status_label)
        
        self.start_time_label = QLabel("-")
        info_layout.addRow("开始时间:", self.start_time_label)
        
        self.end_time_label = QLabel("-")
        info_layout.addRow("结束时间:", self.end_time_label)
        
        self.duration_label = QLabel("-")
        info_layout.addRow("持续时间:", self.duration_label)
        
        scroll_layout.addWidget(info_group)
        
        # 描述组
        desc_group = QGroupBox("风险描述")
        desc_layout = QVBoxLayout(desc_group)
        
        self.description_edit = QTextEdit()
        self.description_edit.setReadOnly(True)
        self.description_edit.setMaximumHeight(80)
        desc_layout.addWidget(self.description_edit)
        
        scroll_layout.addWidget(desc_group)
        
        # 详细信息组
        detail_group = QGroupBox("详细信息")
        detail_layout = QVBoxLayout(detail_group)
        
        self.details_edit = QTextEdit()
        self.details_edit.setReadOnly(True)
        self.details_edit.setMaximumHeight(120)
        detail_layout.addWidget(self.details_edit)
        
        scroll_layout.addWidget(detail_group)
        
        # 复核记录组
        review_group = QGroupBox("复核记录")
        review_layout = QVBoxLayout(review_group)
        
        self.review_edit = QTextEdit()
        self.review_edit.setReadOnly(True)
        self.review_edit.setMaximumHeight(100)
        review_layout.addWidget(self.review_edit)
        
        scroll_layout.addWidget(review_group)
        
        # 复核备注组
        notes_group = QGroupBox("复核备注")
        notes_layout = QVBoxLayout(notes_group)
        
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("请输入复核备注（可选）...")
        self.notes_edit.setMaximumHeight(60)
        notes_layout.addWidget(self.notes_edit)
        
        scroll_layout.addWidget(notes_group)
        
        # 操作按钮
        buttons_layout = QHBoxLayout()
        
        self.confirm_btn = QPushButton("确认风险")
        self.confirm_btn.setStyleSheet("background-color: #e74c3c; color: white; font-weight: bold;")
        self.confirm_btn.clicked.connect(self._on_confirm_clicked)
        self.confirm_btn.setEnabled(False)
        buttons_layout.addWidget(self.confirm_btn)
        
        self.dismiss_btn = QPushButton("驳回风险")
        self.dismiss_btn.setStyleSheet("background-color: #27ae60; color: white; font-weight: bold;")
        self.dismiss_btn.clicked.connect(self._on_dismiss_clicked)
        self.dismiss_btn.setEnabled(False)
        buttons_layout.addWidget(self.dismiss_btn)
        
        buttons_layout.addStretch()
        
        scroll_layout.addLayout(buttons_layout)
        
        # 添加弹簧
        scroll_layout.addStretch()
        
        scroll_area.setWidget(scroll_content)
        layout.addWidget(scroll_area)
    
    def set_risk(self, risk: Optional[Risk]):
        """
        设置风险数据
        """
        self.current_risk = risk
        self._refresh_display()
    
    def refresh(self):
        """
        刷新显示
        """
        self._refresh_display()
    
    def _refresh_display(self):
        """
        刷新显示内容
        """
        if not self.current_risk:
            self._clear_display()
            return
        
        # 基本信息
        self.risk_id_label.setText(self.current_risk.risk_id[:8] + "...")
        self.risk_id_label.setToolTip(self.current_risk.risk_id)
        
        self.type_label.setText(self._get_type_display(self.current_risk.risk_type))
        self.severity_label.setText(self._get_severity_display(self.current_risk.severity))
        self._apply_severity_style(self.current_risk.severity)
        
        self.status_label.setText(self._get_status_display(self.current_risk.status))
        self._apply_status_style(self.current_risk.status)
        
        # 时间
        if self.current_risk.start_time:
            self.start_time_label.setText(self.current_risk.start_time.strftime("%Y-%m-%d %H:%M:%S"))
        else:
            self.start_time_label.setText("-")
        
        if self.current_risk.end_time:
            self.end_time_label.setText(self.current_risk.end_time.strftime("%Y-%m-%d %H:%M:%S"))
        else:
            self.end_time_label.setText("-")
        
        # 持续时间
        if self.current_risk.start_time and self.current_risk.end_time:
            duration = self.current_risk.end_time - self.current_risk.start_time
            hours = int(duration.total_seconds() // 3600)
            minutes = int((duration.total_seconds() % 3600) // 60)
            seconds = int(duration.total_seconds() % 60)
            
            if hours > 0:
                duration_str = f"{hours}小时 {minutes}分 {seconds}秒"
            elif minutes > 0:
                duration_str = f"{minutes}分 {seconds}秒"
            else:
                duration_str = f"{seconds}秒"
            
            self.duration_label.setText(duration_str)
        else:
            self.duration_label.setText("-")
        
        # 描述
        self.description_edit.setText(self.current_risk.description)
        
        # 详细信息
        details_text = self._format_details(self.current_risk.details)
        self.details_edit.setText(details_text)
        
        # 复核记录
        review_text = self._format_review_history(self.current_risk)
        self.review_edit.setText(review_text)
        
        # 按钮状态
        can_review = self.current_risk.status == RiskStatus.PENDING
        self.confirm_btn.setEnabled(can_review)
        self.dismiss_btn.setEnabled(can_review)
        
        if not can_review:
            self.notes_edit.clear()
            self.notes_edit.setPlaceholderText("该风险已完成复核，无法再次操作")
            self.notes_edit.setEnabled(False)
        else:
            self.notes_edit.setEnabled(True)
            self.notes_edit.setPlaceholderText("请输入复核备注（可选）...")
    
    def _clear_display(self):
        """
        清空显示
        """
        self.risk_id_label.setText("-")
        self.risk_id_label.setToolTip("")
        self.type_label.setText("-")
        self.severity_label.setText("-")
        self.status_label.setText("-")
        self.start_time_label.setText("-")
        self.end_time_label.setText("-")
        self.duration_label.setText("-")
        
        self.description_edit.clear()
        self.details_edit.clear()
        self.review_edit.clear()
        self.notes_edit.clear()
        
        self.confirm_btn.setEnabled(False)
        self.dismiss_btn.setEnabled(False)
        self.notes_edit.setEnabled(True)
        
        # 重置样式
        self.severity_label.setStyleSheet("")
        self.status_label.setStyleSheet("")
    
    def _format_details(self, details: dict) -> str:
        """
        格式化详细信息
        """
        if not details:
            return "无详细信息"
        
        lines = []
        for key, value in details.items():
            key_display = self._translate_detail_key(key)
            lines.append(f"{key_display}: {value}")
        
        return "\n".join(lines)
    
    def _translate_detail_key(self, key: str) -> str:
        """
        翻译详细信息键
        """
        key_map = {
            'min_temperature': '最低体温',
            'max_temperature': '最高体温',
            'min_spo2': '最低血氧',
            'max_spo2_drop': '最大血氧降幅',
            'min_heart_rate': '最低心率',
            'max_heart_rate': '最高心率',
            'min_systolic_bp': '最低收缩压',
            'max_systolic_bp': '最高收缩压',
            'min_diastolic_bp': '最低舒张压',
            'max_diastolic_bp': '最高舒张压',
            'medication_name': '药物名称',
            'scheduled_time': '计划时间',
            'actual_time': '实际时间',
            'delay_minutes': '延迟分钟',
            'recovery_score': '复苏评分',
            'threshold': '阈值',
            'sample_count': '样本数量',
            'duration_seconds': '持续时间(秒)',
            'affected_records': '影响记录数'
        }
        return key_map.get(key, key)
    
    def _format_review_history(self, risk: Risk) -> str:
        """
        格式化复核历史
        """
        if not risk.review_history:
            return "暂无复核记录"
        
        lines = []
        for i, record in enumerate(reversed(risk.review_history)):
            action_display = self._get_action_display(record.action)
            time_str = record.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            lines.append(f"[{i+1}] {action_display}")
            lines.append(f"    时间: {time_str}")
            lines.append(f"    复核人: {record.reviewer or '未知'}")
            if record.notes:
                lines.append(f"    备注: {record.notes}")
            lines.append("")
        
        return "\n".join(lines).strip()
    
    def _get_action_display(self, action: ReviewAction) -> str:
        """
        获取操作显示文本
        """
        action_map = {
            ReviewAction.CONFIRM: "确认风险",
            ReviewAction.DISMISS: "驳回风险",
            ReviewAction.REOPEN: "重新打开"
        }
        return action_map.get(action, action.value)
    
    def _get_type_display(self, risk_type: RiskType) -> str:
        """
        获取风险类型显示文本
        """
        type_map = {
            RiskType.HYPOTHERMIA: "低体温",
            RiskType.SPO2_DROP: "血氧掉点",
            RiskType.MEDICATION_OVERDUE: "用药超时",
            RiskType.RECOVERY_SCORE: "复苏评分异常",
            RiskType.HYPOTENSION: "低血压",
            RiskType.HYPERTENSION: "高血压",
            RiskType.TACHYCARDIA: "心动过速",
            RiskType.BRADYCARDIA: "心动过缓"
        }
        return type_map.get(risk_type, risk_type.value)
    
    def _get_severity_display(self, severity: RiskSeverity) -> str:
        """
        获取严重程度显示文本
        """
        severity_map = {
            RiskSeverity.MILD: "轻度",
            RiskSeverity.MODERATE: "中度",
            RiskSeverity.SEVERE: "严重",
            RiskSeverity.CRITICAL: "危急"
        }
        return severity_map.get(severity, severity.value)
    
    def _apply_severity_style(self, severity: RiskSeverity):
        """
        应用严重程度样式
        """
        style_map = {
            RiskSeverity.MILD: "color: green; font-weight: bold;",
            RiskSeverity.MODERATE: "color: orange; font-weight: bold;",
            RiskSeverity.SEVERE: "color: red; font-weight: bold;",
            RiskSeverity.CRITICAL: "color: darkred; font-weight: bold; background-color: #ffebee;"
        }
        self.severity_label.setStyleSheet(style_map.get(severity, ""))
    
    def _get_status_display(self, status: RiskStatus) -> str:
        """
        获取状态显示文本
        """
        status_map = {
            RiskStatus.PENDING: "待复核",
            RiskStatus.CONFIRMED: "已确认",
            RiskStatus.DISMISSED: "已驳回"
        }
        return status_map.get(status, status.value)
    
    def _apply_status_style(self, status: RiskStatus):
        """
        应用状态样式
        """
        style_map = {
            RiskStatus.PENDING: "color: orange; font-weight: bold;",
            RiskStatus.CONFIRMED: "color: red; font-weight: bold;",
            RiskStatus.DISMISSED: "color: green; font-weight: bold;"
        }
        self.status_label.setStyleSheet(style_map.get(status, ""))
    
    def _on_confirm_clicked(self):
        """
        确认按钮点击
        """
        if not self.current_risk:
            return
        
        notes = self.notes_edit.toPlainText().strip()
        
        # 发出信号
        self.confirm_risk.emit(self.current_risk.risk_id, notes if notes else None)
    
    def _on_dismiss_clicked(self):
        """
        驳回按钮点击
        """
        if not self.current_risk:
            return
        
        notes = self.notes_edit.toPlainText().strip()
        
        # 发出信号
        self.dismiss_risk.emit(self.current_risk.risk_id, notes if notes else None)
