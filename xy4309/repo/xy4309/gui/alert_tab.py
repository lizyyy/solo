#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预警中心标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QComboBox, QMessageBox, QSplitter, QTextEdit, QFormLayout
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QColor, QFont

from datetime import date, datetime
from typing import Optional, List

from storage.db_manager import DatabaseManager
from models import Alert, AlertType


class AlertTab(QWidget):
    """预警中心标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.selected_alert_id: Optional[int] = None
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部工具栏
        toolbar_layout = QHBoxLayout()
        
        # 预警类型筛选
        toolbar_layout.addWidget(QLabel("预警类型:"))
        self.alert_type_combo = QComboBox()
        self.alert_type_combo.addItem("全部类型", None)
        for alert_type in AlertType:
            self.alert_type_combo.addItem(alert_type.value, alert_type)
        self.alert_type_combo.currentIndexChanged.connect(self._filter_alerts)
        toolbar_layout.addWidget(self.alert_type_combo)
        
        # 状态筛选
        toolbar_layout.addWidget(QLabel("状态:"))
        self.status_combo = QComboBox()
        self.status_combo.addItem("全部状态", None)
        self.status_combo.addItem("未处理", False)
        self.status_combo.addItem("已处理", True)
        self.status_combo.currentIndexChanged.connect(self._filter_alerts)
        toolbar_layout.addWidget(self.status_combo)
        
        toolbar_layout.addStretch()
        
        # 操作按钮
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.refresh_data)
        toolbar_layout.addWidget(refresh_btn)
        
        resolve_btn = QPushButton("标记为已处理")
        resolve_btn.setStyleSheet("background-color: #4CAF50; color: white;")
        resolve_btn.clicked.connect(self._resolve_alert)
        toolbar_layout.addWidget(resolve_btn)
        
        resolve_all_btn = QPushButton("全部标记已处理")
        resolve_all_btn.clicked.connect(self._resolve_all_alerts)
        toolbar_layout.addWidget(resolve_all_btn)
        
        layout.addLayout(toolbar_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Vertical)
        
        # 预警列表
        list_group = QGroupBox("预警列表")
        list_layout = QVBoxLayout(list_group)
        
        self.alert_table = QTableWidget()
        self.alert_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.alert_table.setSelectionMode(QTableWidget.SingleSelection)
        self.alert_table.setAlternatingRowColors(True)
        self.alert_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.alert_table.verticalHeader().setDefaultSectionSize(30)
        self.alert_table.cellClicked.connect(self._on_alert_selected)
        
        # 设置表头
        headers = ["ID", "预警类型", "瓶号", "试剂名称", "预警信息", "状态", "创建时间", "处理时间"]
        self.alert_table.setColumnCount(len(headers))
        self.alert_table.setHorizontalHeaderLabels(headers)
        
        # 隐藏ID列
        self.alert_table.setColumnHidden(0, True)
        
        list_layout.addWidget(self.alert_table)
        splitter.addWidget(list_group)
        
        # 预警详情
        detail_group = QGroupBox("预警详情")
        detail_layout = QVBoxLayout(detail_group)
        
        # 表单布局
        form_layout = QFormLayout()
        
        # 预警类型
        self.alert_type_label = QLabel("-")
        form_layout.addRow("预警类型:", self.alert_type_label)
        
        # 瓶号
        self.bottle_number_label = QLabel("-")
        form_layout.addRow("瓶号:", self.bottle_number_label)
        
        # 试剂名称
        self.reagent_name_label = QLabel("-")
        form_layout.addRow("试剂名称:", self.reagent_name_label)
        
        # 状态
        self.status_label = QLabel("-")
        form_layout.addRow("状态:", self.status_label)
        
        # 预警信息
        self.message_edit = QTextEdit()
        self.message_edit.setReadOnly(True)
        self.message_edit.setMaximumHeight(80)
        form_layout.addRow("预警信息:", self.message_edit)
        
        # 创建时间
        self.created_at_label = QLabel("-")
        form_layout.addRow("创建时间:", self.created_at_label)
        
        # 处理时间
        self.resolved_at_label = QLabel("-")
        form_layout.addRow("处理时间:", self.resolved_at_label)
        
        detail_layout.addLayout(form_layout)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.resolve_btn = QPushButton("标记为已处理")
        self.resolve_btn.setMinimumWidth(120)
        self.resolve_btn.setStyleSheet("background-color: #4CAF50; color: white;")
        self.resolve_btn.clicked.connect(self._resolve_alert)
        btn_layout.addWidget(self.resolve_btn)
        
        self.clear_btn = QPushButton("取消选择")
        self.clear_btn.setMinimumWidth(100)
        self.clear_btn.clicked.connect(self._clear_selection)
        btn_layout.addWidget(self.clear_btn)
        
        detail_layout.addLayout(btn_layout)
        
        splitter.addWidget(detail_group)
        
        # 设置分割器比例
        splitter.setSizes([400, 250])
        
        layout.addWidget(splitter)
    
    def refresh_data(self):
        """刷新数据"""
        self._filter_alerts()
        self._clear_selection()
    
    def _filter_alerts(self):
        """筛选预警"""
        alert_type_filter = self.alert_type_combo.currentData()
        status_filter = self.status_combo.currentData()
        
        # 获取所有预警
        all_alerts = self.db_manager.get_all_alerts()
        
        # 应用筛选
        filtered_alerts = []
        for alert in all_alerts:
            # 类型筛选
            if alert_type_filter is not None and alert.alert_type != alert_type_filter:
                continue
            
            # 状态筛选
            if status_filter is not None:
                if status_filter and not alert.is_resolved:
                    continue
                if not status_filter and alert.is_resolved:
                    continue
            
            filtered_alerts.append(alert)
        
        self._populate_table(filtered_alerts)
    
    def _populate_table(self, alerts: List[Alert]):
        """填充表格"""
        self.alert_table.setRowCount(0)
        
        for row, alert in enumerate(alerts):
            self.alert_table.insertRow(row)
            
            # ID
            id_item = QTableWidgetItem(str(alert.id))
            id_item.setData(Qt.UserRole, alert.id)
            self.alert_table.setItem(row, 0, id_item)
            
            # 预警类型
            type_item = QTableWidgetItem(alert.alert_type.value)
            type_item.setForeground(self._get_color_for_alert_type(alert.alert_type))
            self.alert_table.setItem(row, 1, type_item)
            
            # 瓶号
            self.alert_table.setItem(row, 2, QTableWidgetItem(alert.bottle_number))
            
            # 试剂名称
            self.alert_table.setItem(row, 3, QTableWidgetItem(alert.reagent_name))
            
            # 预警信息
            message = alert.message
            if len(message) > 50:
                message = message[:47] + "..."
            self.alert_table.setItem(row, 4, QTableWidgetItem(message))
            
            # 状态
            status = "已处理" if alert.is_resolved else "未处理"
            status_item = QTableWidgetItem(status)
            if alert.is_resolved:
                status_item.setForeground(QColor(0, 153, 0))
            else:
                status_item.setForeground(QColor(255, 0, 0))
            self.alert_table.setItem(row, 5, status_item)
            
            # 创建时间
            created_str = alert.created_at.strftime("%Y-%m-%d %H:%M:%S") if alert.created_at else "-"
            self.alert_table.setItem(row, 6, QTableWidgetItem(created_str))
            
            # 处理时间
            resolved_str = alert.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if alert.resolved_at else "-"
            self.alert_table.setItem(row, 7, QTableWidgetItem(resolved_str))
    
    def _get_color_for_alert_type(self, alert_type: AlertType) -> QColor:
        """根据预警类型获取颜色"""
        if alert_type == AlertType.EXPIRED:
            return QColor(255, 0, 0)
        elif alert_type == AlertType.EXPIRING_SOON:
            return QColor(255, 102, 0)
        elif alert_type == AlertType.LOW_STOCK:
            return QColor(204, 102, 0)
        elif alert_type == AlertType.INCOMPATIBLE:
            return QColor(153, 0, 153)
        elif alert_type == AlertType.OVERDUE_RETURN:
            return QColor(153, 0, 0)
        else:
            return QColor(0, 0, 0)
    
    def _on_alert_selected(self, row: int, column: int):
        """预警被选中时的处理"""
        id_item = self.alert_table.item(row, 0)
        if not id_item:
            return
        
        alert_id = id_item.data(Qt.UserRole)
        self._load_alert_detail(alert_id)
    
    def _load_alert_detail(self, alert_id: int):
        """加载预警详情"""
        # 获取所有预警并查找匹配的
        all_alerts = self.db_manager.get_all_alerts()
        alert = next((a for a in all_alerts if a.id == alert_id), None)
        
        if not alert:
            return
        
        self.selected_alert_id = alert_id
        
        # 更新详情显示
        self.alert_type_label.setText(alert.alert_type.value)
        self.alert_type_label.setStyleSheet(f"color: {self._get_color_for_alert_type(alert.alert_type).name()}; font-weight: bold;")
        
        self.bottle_number_label.setText(alert.bottle_number)
        self.reagent_name_label.setText(alert.reagent_name)
        
        status = "已处理" if alert.is_resolved else "未处理"
        self.status_label.setText(status)
        if alert.is_resolved:
            self.status_label.setStyleSheet("color: #009900; font-weight: bold;")
            self.resolve_btn.setEnabled(False)
        else:
            self.status_label.setStyleSheet("color: #FF0000; font-weight: bold;")
            self.resolve_btn.setEnabled(True)
        
        self.message_edit.setText(alert.message)
        
        created_str = alert.created_at.strftime("%Y-%m-%d %H:%M:%S") if alert.created_at else "-"
        self.created_at_label.setText(created_str)
        
        resolved_str = alert.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if alert.resolved_at else "-"
        self.resolved_at_label.setText(resolved_str)
    
    def _clear_selection(self):
        """清空选择"""
        self.selected_alert_id = None
        self.alert_type_label.setText("-")
        self.alert_type_label.setStyleSheet("")
        self.bottle_number_label.setText("-")
        self.reagent_name_label.setText("-")
        self.status_label.setText("-")
        self.status_label.setStyleSheet("")
        self.message_edit.clear()
        self.created_at_label.setText("-")
        self.resolved_at_label.setText("-")
        self.resolve_btn.setEnabled(True)
        self.alert_table.clearSelection()
    
    def _resolve_alert(self):
        """标记预警为已处理"""
        if self.selected_alert_id is None:
            QMessageBox.warning(self, "提示", "请先选择要处理的预警")
            return
        
        # 获取预警信息
        all_alerts = self.db_manager.get_all_alerts()
        alert = next((a for a in all_alerts if a.id == self.selected_alert_id), None)
        
        if not alert:
            return
        
        if alert.is_resolved:
            QMessageBox.information(self, "提示", "该预警已处理")
            return
        
        reply = QMessageBox.question(
            self, "确认处理",
            f"确定要将该预警标记为已处理吗？\n\n"
            f"预警类型: {alert.alert_type.value}\n"
            f"试剂: {alert.reagent_name} ({alert.bottle_number})\n"
            f"信息: {alert.message}",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.db_manager.resolve_alert(self.selected_alert_id)
            self.refresh_data()
            QMessageBox.information(self, "成功", "预警已标记为已处理")
    
    def _resolve_all_alerts(self):
        """将所有未处理预警标记为已处理"""
        # 获取未处理预警
        unresolved_alerts = self.db_manager.get_unresolved_alerts()
        
        if not unresolved_alerts:
            QMessageBox.information(self, "提示", "暂无未处理的预警")
            return
        
        reply = QMessageBox.question(
            self, "确认处理所有",
            f"当前有 {len(unresolved_alerts)} 条未处理的预警，\n"
            f"确定要全部标记为已处理吗？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            count = 0
            for alert in unresolved_alerts:
                self.db_manager.resolve_alert(alert.id)
                count += 1
            
            self.refresh_data()
            QMessageBox.information(self, "成功", f"已将 {count} 条预警标记为已处理")
