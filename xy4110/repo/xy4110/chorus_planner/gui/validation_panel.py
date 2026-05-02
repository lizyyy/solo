"""约束校验结果面板"""
from typing import Dict, Optional, List, Any
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QDialog, QFormLayout, QLineEdit, QComboBox, QSpinBox,
    QTextEdit, QMessageBox, QSplitter, QFrame, QScrollArea,
    QCheckBox, QFileDialog, QTabWidget, QListWidget, QListWidgetItem,
    QToolButton, QMenu
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor, QBrush, QFont

from ..models.member import Member, VoicePart, SeniorityLevel, MemberStatus
from ..models.seating import Seat, SeatingLayout
from ..core.constraint_validator import (
    ConstraintValidator, ValidationResult, ValidationIssue,
    IssueType, IssueSeverity
)


class ValidationPanel(QWidget):
    """约束校验结果面板"""
    
    issue_selected = pyqtSignal(str)
    validate_requested = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._issues: List[ValidationIssue] = []
        self._members: Dict[str, Member] = {}
        self._layout: Optional[SeatingLayout] = None
        self._validator = ConstraintValidator()
        
        self._init_ui()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._validate_btn = QPushButton("执行校验")
        self._validate_btn.clicked.connect(self._on_validate)
        toolbar.addWidget(self._validate_btn)
        
        toolbar.addStretch()
        
        self._stats_label = QLabel("就绪")
        toolbar.addWidget(self._stats_label)
        
        layout.addLayout(toolbar)
        
        self._issue_table = QTableWidget()
        self._issue_table.setColumnCount(5)
        self._issue_table.setHorizontalHeaderLabels([
            "严重程度", "类型", "问题描述", "详情", "建议"
        ])
        self._issue_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._issue_table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self._issue_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._issue_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self._issue_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self._issue_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self._issue_table.itemSelectionChanged.connect(self._on_issue_selected)
        self._issue_table.doubleClicked.connect(self._on_issue_double_click)
        
        layout.addWidget(self._issue_table)
        
        self._detail_label = QLabel("选择一个问题查看详情")
        self._detail_label.setWordWrap(True)
        self._detail_label.setStyleSheet("background-color: #f0f0f0; padding: 10px;")
        layout.addWidget(self._detail_label)
    
    def set_data(self, layout: SeatingLayout, members: Dict[str, Member]):
        """设置数据"""
        self._layout = layout
        self._members = {k: v for k, v in members.items()}
    
    def set_issues(self, issues: List[ValidationIssue]):
        """设置问题列表"""
        self._issues = issues
        self._refresh_table()
    
    def validate(self) -> ValidationResult:
        """执行校验"""
        if not self._layout:
            result = ValidationResult()
            self.set_issues([])
            return result
        
        result = self._validator.validate(self._layout, self._members)
        self.set_issues(result.issues)
        return result
    
    def _refresh_table(self):
        """刷新表格"""
        self._issue_table.setRowCount(0)
        
        critical_count = sum(1 for i in self._issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in self._issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in self._issues if i.severity == IssueSeverity.INFO)
        
        self._stats_label.setText(
            f"严重: {critical_count} | 警告: {warning_count} | 提示: {info_count}"
        )
        
        sorted_issues = sorted(
            self._issues,
            key=lambda i: {
                IssueSeverity.CRITICAL: 0,
                IssueSeverity.WARNING: 1,
                IssueSeverity.INFO: 2,
            }.get(i.severity, 99)
        )
        
        self._issue_table.setRowCount(len(sorted_issues))
        
        severity_colors = {
            IssueSeverity.CRITICAL: QColor(231, 76, 60),
            IssueSeverity.WARNING: QColor(243, 156, 18),
            IssueSeverity.INFO: QColor(52, 152, 219),
        }
        
        for row, issue in enumerate(sorted_issues):
            item = QTableWidgetItem(IssueSeverity.display_name(issue.severity))
            item.setForeground(QBrush(severity_colors.get(issue.severity, QColor(0, 0, 0))))
            font = item.font()
            font.setBold(True)
            item.setFont(font)
            item.setData(Qt.ItemDataRole.UserRole, row)
            self._issue_table.setItem(row, 0, item)
            
            item = QTableWidgetItem(IssueType.display_name(issue.issue_type))
            self._issue_table.setItem(row, 1, item)
            
            item = QTableWidgetItem(issue.message)
            self._issue_table.setItem(row, 2, item)
            
            item = QTableWidgetItem(issue.details)
            self._issue_table.setItem(row, 3, item)
            
            item = QTableWidgetItem(issue.suggestion)
            self._issue_table.setItem(row, 4, item)
        
        if critical_count > 0:
            self._stats_label.setStyleSheet("color: #e74c3c; font-weight: bold;")
        elif warning_count > 0:
            self._stats_label.setStyleSheet("color: #f39c12;")
        else:
            self._stats_label.setStyleSheet("color: #27ae60;")
    
    def _on_validate(self):
        """执行校验按钮"""
        if not self._layout:
            QMessageBox.information(self, "提示", "请先加载数据")
            return
        
        result = self.validate()
        
        if result.is_valid:
            if not result.issues:
                QMessageBox.information(self, "校验结果", "校验通过，没有发现任何问题！")
            else:
                QMessageBox.information(self, "校验结果", f"校验完成，发现 {len(result.issues)} 个问题")
        else:
            QMessageBox.warning(self, "校验结果", f"校验发现 {result.critical_count} 个严重问题，需要处理")
        
        self.validate_requested.emit()
    
    def _on_issue_selected(self):
        """问题选择变化"""
        selected = self._issue_table.selectedItems()
        if selected:
            row = selected[0].data(Qt.ItemDataRole.UserRole)
            if 0 <= row < len(self._issues):
                issue = self._issues[row]
                
                detail_text = f"""
<b>问题类型：</b>{IssueType.display_name(issue.issue_type)}<br>
<b>严重程度：</b>{IssueSeverity.display_name(issue.severity)}<br>
<br>
<b>问题描述：</b>{issue.message}<br>
<br>
<b>详细信息：</b>{issue.details}<br>
<br>
<b>建议：</b>{issue.suggestion}<br>
<br>
<b>涉及成员：</b>{', '.join(issue.affected_member_ids) if issue.affected_member_ids else '无'}<br>
<b>涉及座位：</b>{', '.join(issue.affected_seat_ids) if issue.affected_seat_ids else '无'}
"""
                self._detail_label.setText(detail_text)
                
                if issue.affected_seat_ids:
                    self.issue_selected.emit(issue.affected_seat_ids[0])
        else:
            self._detail_label.setText("选择一个问题查看详情")
    
    def _on_issue_double_click(self, index):
        """双击问题"""
        selected = self._issue_table.selectedItems()
        if selected:
            row = selected[0].data(Qt.ItemDataRole.UserRole)
            if 0 <= row < len(self._issues):
                issue = self._issues[row]
                if issue.affected_seat_ids:
                    for seat_id in issue.affected_seat_ids:
                        self.issue_selected.emit(seat_id)
    
    def get_issues(self) -> List[ValidationIssue]:
        """获取问题列表"""
        return list(self._issues)
    
    def has_critical_issues(self) -> bool:
        """是否有严重问题"""
        return any(i.severity == IssueSeverity.CRITICAL for i in self._issues)
