import sys
import os
from typing import Optional, List
from datetime import datetime

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QPushButton, QGroupBox, QComboBox, QMenu,
    QAction, QMessageBox
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont, QColor, QBrush

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from models.case import Case
from models.risk import Risk, RiskType, RiskStatus, RiskSeverity


class RiskTableWidget(QWidget):
    """
    风险列表表格组件
    """
    
    risk_selected = pyqtSignal(str)
    risk_confirm_requested = pyqtSignal(str)
    risk_dismiss_requested = pyqtSignal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.case: Optional[Case] = None
        self._risk_ids: List[str] = []
        
        self._create_ui()
    
    def _create_ui(self):
        """
        创建UI
        """
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(5)
        
        # 标题栏
        header_layout = QHBoxLayout()
        
        title_label = QLabel("风险列表")
        title_label.setFont(QFont("Arial", 12, QFont.Bold))
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # 筛选器
        self.filter_combo = QComboBox()
        self.filter_combo.addItem("全部风险", "all")
        self.filter_combo.addItem("待复核", "pending")
        self.filter_combo.addItem("已确认", "confirmed")
        self.filter_combo.addItem("已驳回", "dismissed")
        self.filter_combo.currentIndexChanged.connect(self._apply_filter)
        header_layout.addWidget(self.filter_combo)
        
        layout.addLayout(header_layout)
        
        # 表格
        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels([
            "状态", "类型", "严重程度", "开始时间", "结束时间", "描述"
        ])
        
        # 设置列宽
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)
        header.setSectionResizeMode(1, QHeaderView.Fixed)
        header.setSectionResizeMode(2, QHeaderView.Fixed)
        header.setSectionResizeMode(3, QHeaderView.Fixed)
        header.setSectionResizeMode(4, QHeaderView.Fixed)
        header.setSectionResizeMode(5, QHeaderView.Stretch)
        
        self.table.setColumnWidth(0, 70)
        self.table.setColumnWidth(1, 100)
        self.table.setColumnWidth(2, 80)
        self.table.setColumnWidth(3, 100)
        self.table.setColumnWidth(4, 100)
        
        # 设置选择模式
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.ExtendedSelection)
        
        # 连接信号
        self.table.itemSelectionChanged.connect(self._on_selection_changed)
        self.table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self._show_context_menu)
        
        layout.addWidget(self.table)
        
        # 操作按钮
        buttons_layout = QHBoxLayout()
        
        self.confirm_btn = QPushButton("确认风险")
        self.confirm_btn.setEnabled(False)
        self.confirm_btn.clicked.connect(self._on_confirm_clicked)
        buttons_layout.addWidget(self.confirm_btn)
        
        self.dismiss_btn = QPushButton("驳回风险")
        self.dismiss_btn.setEnabled(False)
        self.dismiss_btn.clicked.connect(self._on_dismiss_clicked)
        buttons_layout.addWidget(self.dismiss_btn)
        
        buttons_layout.addStretch()
        
        layout.addLayout(buttons_layout)
    
    def set_case(self, case: Optional[Case]):
        """
        设置病例数据
        """
        self.case = case
        self._refresh_table()
    
    def _refresh_table(self):
        """
        刷新表格
        """
        self.table.setRowCount(0)
        self._risk_ids = []
        
        if not self.case or not self.case.risks:
            return
        
        # 获取当前筛选
        filter_value = self.filter_combo.currentData()
        
        # 过滤风险
        filtered_risks = []
        for risk in self.case.risks:
            if filter_value == "all":
                filtered_risks.append(risk)
            elif filter_value == "pending" and risk.status == RiskStatus.PENDING:
                filtered_risks.append(risk)
            elif filter_value == "confirmed" and risk.status == RiskStatus.CONFIRMED:
                filtered_risks.append(risk)
            elif filter_value == "dismissed" and risk.status == RiskStatus.DISMISSED:
                filtered_risks.append(risk)
        
        # 按时间排序
        filtered_risks.sort(key=lambda r: r.start_time or datetime.min)
        
        self._risk_ids = [r.risk_id for r in filtered_risks]
        
        # 填充表格
        self.table.setRowCount(len(filtered_risks))
        
        for row, risk in enumerate(filtered_risks):
            # 状态
            status_item = QTableWidgetItem(self._get_status_display(risk.status))
            status_item.setData(Qt.UserRole, risk.risk_id)
            status_item.setBackground(self._get_status_color(risk.status))
            status_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 0, status_item)
            
            # 类型
            type_item = QTableWidgetItem(self._get_type_display(risk.risk_type))
            type_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 1, type_item)
            
            # 严重程度
            severity_item = QTableWidgetItem(self._get_severity_display(risk.severity))
            severity_item.setBackground(self._get_severity_color(risk.severity))
            severity_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 2, severity_item)
            
            # 开始时间
            start_time_str = risk.start_time.strftime("%H:%M:%S") if risk.start_time else "-"
            start_item = QTableWidgetItem(start_time_str)
            start_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 3, start_item)
            
            # 结束时间
            end_time_str = risk.end_time.strftime("%H:%M:%S") if risk.end_time else "-"
            end_item = QTableWidgetItem(end_time_str)
            end_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 4, end_item)
            
            # 描述
            desc_item = QTableWidgetItem(risk.description[:50] + "..." if len(risk.description) > 50 else risk.description)
            desc_item.setToolTip(risk.description)
            self.table.setItem(row, 5, desc_item)
    
    def _apply_filter(self):
        """
        应用筛选
        """
        self._refresh_table()
    
    def _on_selection_changed(self):
        """
        选择改变
        """
        selected_rows = self.table.selectedItems()
        
        if selected_rows:
            # 获取选中的风险ID
            selected_ids = self.get_selected_risk_ids()
            
            if selected_ids:
                # 发出第一个选中的风险的信号
                self.risk_selected.emit(selected_ids[0])
                
                # 启用按钮
                self.confirm_btn.setEnabled(True)
                self.dismiss_btn.setEnabled(True)
        else:
            self.confirm_btn.setEnabled(False)
            self.dismiss_btn.setEnabled(False)
    
    def get_selected_risk_ids(self) -> List[str]:
        """
        获取选中的风险ID列表
        """
        selected_rows = set()
        for item in self.table.selectedItems():
            selected_rows.add(item.row())
        
        selected_ids = []
        for row in sorted(selected_rows):
            item = self.table.item(row, 0)
            if item:
                risk_id = item.data(Qt.UserRole)
                if risk_id:
                    selected_ids.append(risk_id)
        
        return selected_ids
    
    def update_risk(self, risk_id: str):
        """
        更新单个风险的显示
        """
        # 简单刷新整个表格
        self._refresh_table()
    
    def _show_context_menu(self, pos):
        """
        显示右键菜单
        """
        selected_ids = self.get_selected_risk_ids()
        
        if not selected_ids:
            return
        
        menu = QMenu(self)
        
        confirm_action = QAction("确认风险", self)
        confirm_action.triggered.connect(self._on_confirm_clicked)
        menu.addAction(confirm_action)
        
        dismiss_action = QAction("驳回风险", self)
        dismiss_action.triggered.connect(self._on_dismiss_clicked)
        menu.addAction(dismiss_action)
        
        menu.addSeparator()
        
        # 显示在鼠标位置
        menu.exec_(self.table.viewport().mapToGlobal(pos))
    
    def _on_confirm_clicked(self):
        """
        确认按钮点击
        """
        selected_ids = self.get_selected_risk_ids()
        
        if not selected_ids:
            return
        
        # 发送确认请求（由主窗口处理）
        for risk_id in selected_ids:
            self.risk_confirm_requested.emit(risk_id)
    
    def _on_dismiss_clicked(self):
        """
        驳回按钮点击
        """
        selected_ids = self.get_selected_risk_ids()
        
        if not selected_ids:
            return
        
        # 发送驳回请求（由主窗口处理）
        for risk_id in selected_ids:
            self.risk_dismiss_requested.emit(risk_id)
    
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
    
    def _get_status_color(self, status: RiskStatus) -> QBrush:
        """
        获取状态颜色
        """
        color_map = {
            RiskStatus.PENDING: QColor(255, 255, 200),
            RiskStatus.CONFIRMED: QColor(255, 200, 200),
            RiskStatus.DISMISSED: QColor(200, 255, 200)
        }
        return QBrush(color_map.get(status, QColor(255, 255, 255)))
    
    def _get_type_display(self, risk_type: RiskType) -> str:
        """
        获取风险类型显示文本
        """
        type_map = {
            RiskType.HYPOTHERMIA: "低体温",
            RiskType.SPO2_DROP: "血氧掉点",
            RiskType.MEDICATION_OVERDUE: "用药超时",
            RiskType.RECOVERY_SCORE: "复苏评分",
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
    
    def _get_severity_color(self, severity: RiskSeverity) -> QBrush:
        """
        获取严重程度颜色
        """
        color_map = {
            RiskSeverity.MILD: QColor(200, 255, 200),
            RiskSeverity.MODERATE: QColor(255, 255, 200),
            RiskSeverity.SEVERE: QColor(255, 200, 150),
            RiskSeverity.CRITICAL: QColor(255, 150, 150)
        }
        return QBrush(color_map.get(severity, QColor(255, 255, 255)))
