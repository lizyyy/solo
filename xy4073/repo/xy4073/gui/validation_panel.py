from typing import Optional, List

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QListWidget, QListWidgetItem, QGroupBox, QPushButton
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor, QFont, QBrush

from models.validation import ValidationResult, ValidationError, ValidationSeverity


class ValidationPanel(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._validation_result: Optional[ValidationResult] = None
        
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        status_group = QGroupBox("校验状态")
        status_layout = QHBoxLayout(status_group)
        
        self._status_icon = QLabel("●")
        self._status_icon.setStyleSheet("color: gray; font-size: 20px;")
        status_layout.addWidget(self._status_icon)
        
        self._status_label = QLabel("尚未执行校验")
        status_layout.addWidget(self._status_label, 1)
        
        layout.addWidget(status_group)
        
        stats_group = QGroupBox("统计")
        stats_layout = QVBoxLayout(stats_group)
        
        self._error_count_label = QLabel("错误: 0")
        self._error_count_label.setStyleSheet("color: red; font-weight: bold;")
        stats_layout.addWidget(self._error_count_label)
        
        self._warning_count_label = QLabel("警告: 0")
        self._warning_count_label.setStyleSheet("color: orange; font-weight: bold;")
        stats_layout.addWidget(self._warning_count_label)
        
        layout.addWidget(stats_group)
        
        issues_group = QGroupBox("问题列表")
        issues_layout = QVBoxLayout(issues_group)
        
        self._issues_list = QListWidget()
        self._issues_list.setSelectionMode(QListWidget.SingleSelection)
        issues_layout.addWidget(self._issues_list)
        
        layout.addWidget(issues_group, 1)

    def set_validation_result(self, result: Optional[ValidationResult]):
        self._validation_result = result
        self._update_ui()

    def _update_ui(self):
        if not self._validation_result:
            self._status_icon.setStyleSheet("color: gray; font-size: 20px;")
            self._status_label.setText("尚未执行校验")
            self._error_count_label.setText("错误: 0")
            self._warning_count_label.setText("警告: 0")
            self._issues_list.clear()
            return
        
        error_count = self._validation_result.error_count()
        warning_count = self._validation_result.warning_count()
        
        if self._validation_result.is_valid:
            self._status_icon.setStyleSheet("color: green; font-size: 20px;")
            self._status_label.setText("校验通过 ✓")
        else:
            self._status_icon.setStyleSheet("color: red; font-size: 20px;")
            self._status_label.setText(f"校验失败 - 发现 {error_count} 个错误")
        
        self._error_count_label.setText(f"错误: {error_count}")
        self._warning_count_label.setText(f"警告: {warning_count}")
        
        self._issues_list.clear()
        
        for error in self._validation_result.errors:
            item = QListWidgetItem()
            item.setText(f"[错误] {error.message}")
            item.setForeground(QBrush(QColor(200, 0, 0)))
            
            font = item.font()
            font.setBold(True)
            item.setFont(font)
            
            self._issues_list.addItem(item)
        
        for warning in self._validation_result.warnings:
            item = QListWidgetItem()
            item.setText(f"[警告] {warning.message}")
            item.setForeground(QBrush(QColor(200, 120, 0)))
            self._issues_list.addItem(item)
        
        if error_count == 0 and warning_count == 0:
            item = QListWidgetItem()
            item.setText("✓ 所有裁片放置正确")
            item.setForeground(QBrush(QColor(0, 150, 0)))
            self._issues_list.addItem(item)
