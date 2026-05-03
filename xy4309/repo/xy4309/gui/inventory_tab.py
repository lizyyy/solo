#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
盘点管理标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QLineEdit, QComboBox, QDoubleSpinBox, QDateEdit,
    QTextEdit, QFormLayout, QMessageBox, QSplitter, QTabWidget,
    QFrame, QSpinBox, QCheckBox
)
from PyQt5.QtCore import Qt, QDate
from PyQt5.QtGui import QColor, QFont

from datetime import date, datetime
from typing import Optional, List, Dict

from storage.db_manager import DatabaseManager
from models import InventoryCheck, Reagent, Cabinet


class InventoryTab(QWidget):
    """盘点管理标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.selected_reagent_id: Optional[int] = None
        self.inventory_checks: List[InventoryCheck] = []  # 当前盘点会话的记录
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部信息栏
        info_layout = QHBoxLayout()
        
        # 盘点日期
        info_layout.addWidget(QLabel("盘点日期:"))
        self.inventory_date_edit = QDateEdit()
        self.inventory_date_edit.setCalendarPopup(True)
        self.inventory_date_edit.setDate(QDate.currentDate())
        self.inventory_date_edit.setMaximumWidth(150)
        info_layout.addWidget(self.inventory_date_edit)
        
        # 盘点人
        info_layout.addWidget(QLabel("盘点人:"))
        self.checker_combo = QComboBox()
        self.checker_combo.setMaximumWidth(200)
        info_layout.addWidget(self.checker_combo)
        
        # 柜位选择
        info_layout.addWidget(QLabel("柜位:"))
        self.cabinet_combo = QComboBox()
        self.cabinet_combo.setMaximumWidth(200)
        self.cabinet_combo.currentIndexChanged.connect(self._filter_by_cabinet)
        info_layout.addWidget(self.cabinet_combo)
        
        info_layout.addStretch()
        
        # 操作按钮
        start_inventory_btn = QPushButton("开始新一轮盘点")
        start_inventory_btn.setStyleSheet("background-color: #2196F3; color: white;")
        start_inventory_btn.clicked.connect(self._start_new_inventory)
        info_layout.addWidget(start_inventory_btn)
        
        export_btn = QPushButton("导出盘点报告")
        export_btn.clicked.connect(self._export_inventory_report)
        info_layout.addWidget(export_btn)
        
        layout.addLayout(info_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Horizontal)
        
        # 左侧：待盘点试剂列表
        left_group = QGroupBox("待盘点试剂（扫码或输入瓶号）")
        left_layout = QVBoxLayout(left_group)
        
        # 扫码输入区
        scan_layout = QHBoxLayout()
        scan_layout.addWidget(QLabel("瓶号:"))
        
        self.bottle_number_edit = QLineEdit()
        self.bottle_number_edit.setPlaceholderText("扫码或输入瓶号后按回车...")
        self.bottle_number_edit.returnPressed.connect(self._on_bottle_number_entered)
        self.bottle_number_edit.setMinimumWidth(250)
        scan_layout.addWidget(self.bottle_number_edit)
        
        self.scan_btn = QPushButton("确认")
        self.scan_btn.clicked.connect(self._on_bottle_number_entered)
        scan_layout.addWidget(self.scan_btn)
        
        left_layout.addLayout(scan_layout)
        
        # 当前扫描信息显示
        self.current_info_group = QGroupBox("当前扫描试剂信息")
        current_info_layout = QFormLayout(self.current_info_group)
        
        self.current_name_label = QLabel("-")
        current_info_layout.addRow("试剂名称:", self.current_name_label)
        
        self.current_category_label = QLabel("-")
        current_info_layout.addRow("类别:", self.current_category_label)
        
        self.current_quantity_label = QLabel("-")
        current_info_layout.addRow("系统记录数量:", self.current_quantity_label)
        
        # 实际数量输入
        self.actual_quantity_spin = QDoubleSpinBox()
        self.actual_quantity_spin.setRange(0, 10000)
        self.actual_quantity_spin.setDecimals(2)
        self.actual_quantity_spin.setValue(0)
        current_info_layout.addRow("实际盘点数量:", self.actual_quantity_spin)
        
        # 差异原因
        self.difference_reason_edit = QTextEdit()
        self.difference_reason_edit.setMaximumHeight(60)
        self.difference_reason_edit.setPlaceholderText("如有差异，请说明原因...")
        current_info_layout.addRow("差异原因:", self.difference_reason_edit)
        
        # 确认盘点按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.confirm_btn = QPushButton("确认盘点")
        self.confirm_btn.setMinimumWidth(100)
        self.confirm_btn.setStyleSheet("background-color: #4CAF50; color: white;")
        self.confirm_btn.clicked.connect(self._confirm_inventory_check)
        btn_layout.addWidget(self.confirm_btn)
        
        self.skip_btn = QPushButton("跳过")
        self.skip_btn.setMinimumWidth(80)
        self.skip_btn.clicked.connect(self._skip_reagent)
        btn_layout.addWidget(self.skip_btn)
        
        current_info_layout.addRow(btn_layout)
        
        left_layout.addWidget(self.current_info_group)
        
        # 待盘点列表
        self.pending_table = QTableWidget()
        self.pending_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.pending_table.setSelectionMode(QTableWidget.SingleSelection)
        self.pending_table.setAlternatingRowColors(True)
        self.pending_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.pending_table.verticalHeader().setDefaultSectionSize(25)
        self.pending_table.itemDoubleClicked.connect(self._on_pending_item_double_clicked)
        
        headers = ["瓶号", "试剂名称", "系统数量", "状态"]
        self.pending_table.setColumnCount(len(headers))
        self.pending_table.setHorizontalHeaderLabels(headers)
        
        left_layout.addWidget(QLabel("待盘点列表:"))
        left_layout.addWidget(self.pending_table)
        
        splitter.addWidget(left_group)
        
        # 右侧：已盘点记录
        right_group = QGroupBox("已盘点记录")
        right_layout = QVBoxLayout(right_group)
        
        # 统计信息
        stats_layout = QHBoxLayout()
        
        self.total_label = QLabel("总数: 0")
        self.total_label.setFont(QFont("Microsoft YaHei", 10, QFont.Bold))
        stats_layout.addWidget(self.total_label)
        
        self.checked_label = QLabel("已盘点: 0")
        self.checked_label.setStyleSheet("color: #4CAF50;")
        self.checked_label.setFont(QFont("Microsoft YaHei", 10, QFont.Bold))
        stats_layout.addWidget(self.checked_label)
        
        self.pending_label = QLabel("待盘点: 0")
        self.pending_label.setStyleSheet("color: #FF9800;")
        self.pending_label.setFont(QFont("Microsoft YaHei", 10, QFont.Bold))
        stats_layout.addWidget(self.pending_label)
        
        self.abnormal_label = QLabel("异常: 0")
        self.abnormal_label.setStyleSheet("color: #F44336;")
        self.abnormal_label.setFont(QFont("Microsoft YaHei", 10, QFont.Bold))
        stats_layout.addWidget(self.abnormal_label)
        
        stats_layout.addStretch()
        
        right_layout.addLayout(stats_layout)
        
        # 已盘点表格
        self.checked_table = QTableWidget()
        self.checked_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.checked_table.setSelectionMode(QTableWidget.SingleSelection)
        self.checked_table.setAlternatingRowColors(True)
        self.checked_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.checked_table.verticalHeader().setDefaultSectionSize(25)
        
        headers = ["瓶号", "试剂名称", "系统数量", "实际数量", "差异", "状态"]
        self.checked_table.setColumnCount(len(headers))
        self.checked_table.setHorizontalHeaderLabels(headers)
        
        right_layout.addWidget(self.checked_table)
        
        splitter.addWidget(right_group)
        
        # 设置分割器比例
        splitter.setSizes([500, 500])
        
        layout.addWidget(splitter)
        
        # 隐藏当前信息区域（初始状态）
        self.current_info_group.setVisible(False)
    
    def refresh_data(self):
        """刷新数据"""
        # 刷新下拉列表
        self._refresh_combos()
        
        # 刷新待盘点列表
        self._populate_pending_table()
        
        # 更新统计信息
        self._update_stats()
    
    def _refresh_combos(self):
        """刷新下拉列表"""
        # 盘点人
        self.checker_combo.clear()
        self.checker_combo.addItem("请选择盘点人", None)
        persons = self.db_manager.get_all_responsible_persons()
        for p in persons:
            self.checker_combo.addItem(f"{p.name} ({p.department})", p.id)
        
        # 柜位
        self.cabinet_combo.clear()
        self.cabinet_combo.addItem("全部柜位", None)
        cabinets = self.db_manager.get_all_cabinets()
        for cab in cabinets:
            self.cabinet_combo.addItem(f"{cab.name} ({cab.location})", cab.id)
    
    def _filter_by_cabinet(self):
        """按柜位过滤"""
        self._populate_pending_table()
        self._update_stats()
    
    def _populate_pending_table(self):
        """填充待盘点列表"""
        self.pending_table.setRowCount(0)
        
        # 获取已盘点的瓶号
        checked_bottles = {check.bottle_number for check in self.inventory_checks}
        
        # 获取柜位过滤器
        cabinet_id = self.cabinet_combo.currentData()
        
        # 获取所有试剂
        if cabinet_id:
            reagents = self.db_manager.get_reagents_by_cabinet(cabinet_id)
        else:
            reagents = self.db_manager.get_all_reagents()
        
        # 过滤掉已盘点的
        pending_reagents = [r for r in reagents if r.bottle_number not in checked_bottles]
        
        for row, reagent in enumerate(pending_reagents):
            self.pending_table.insertRow(row)
            
            # 瓶号
            item = QTableWidgetItem(reagent.bottle_number)
            item.setData(Qt.UserRole, reagent.id)
            self.pending_table.setItem(row, 0, item)
            
            # 试剂名称
            self.pending_table.setItem(row, 1, QTableWidgetItem(reagent.name))
            
            # 系统数量
            self.pending_table.setItem(row, 2, QTableWidgetItem(f"{reagent.quantity} {reagent.unit}"))
            
            # 状态
            status = "待盘点"
            status_color = QColor(255, 152, 0)  # 橙色
            
            # 检查是否有预警
            today = date.today()
            if reagent.expiration_date and reagent.expiration_date < today:
                status = "已过期"
                status_color = QColor(255, 0, 0)
            elif reagent.expiration_date and (reagent.expiration_date - today).days <= 30:
                status = "即将过期"
                status_color = QColor(255, 102, 0)
            elif reagent.quantity <= reagent.min_quantity:
                status = "库存不足"
                status_color = QColor(204, 102, 0)
            
            status_item = QTableWidgetItem(status)
            status_item.setForeground(status_color)
            self.pending_table.setItem(row, 3, status_item)
    
    def _populate_checked_table(self):
        """填充已盘点列表"""
        self.checked_table.setRowCount(0)
        
        for row, check in enumerate(self.inventory_checks):
            self.checked_table.insertRow(row)
            
            # 瓶号
            item = QTableWidgetItem(check.bottle_number)
            item.setData(Qt.UserRole, check.reagent_id)
            self.checked_table.setItem(row, 0, item)
            
            # 试剂名称
            reagent = self.db_manager.get_reagent_by_id(check.reagent_id)
            reagent_name = reagent.name if reagent else "-"
            self.checked_table.setItem(row, 1, QTableWidgetItem(reagent_name))
            
            # 系统数量
            self.checked_table.setItem(row, 2, QTableWidgetItem(f"{check.expected_quantity}"))
            
            # 实际数量
            self.checked_table.setItem(row, 3, QTableWidgetItem(f"{check.actual_quantity}"))
            
            # 差异
            diff_item = QTableWidgetItem(f"{check.difference}")
            if check.difference != 0:
                diff_item.setForeground(QColor(255, 0, 0))
            self.checked_table.setItem(row, 4, diff_item)
            
            # 状态
            status_item = QTableWidgetItem(check.status)
            if check.status == "异常":
                status_item.setForeground(QColor(255, 0, 0))
            else:
                status_item.setForeground(QColor(0, 153, 0))
            self.checked_table.setItem(row, 5, status_item)
    
    def _update_stats(self):
        """更新统计信息"""
        # 获取柜位过滤器
        cabinet_id = self.cabinet_combo.currentData()
        
        # 获取所有试剂
        if cabinet_id:
            reagents = self.db_manager.get_reagents_by_cabinet(cabinet_id)
        else:
            reagents = self.db_manager.get_all_reagents()
        
        total_count = len(reagents)
        checked_count = len(self.inventory_checks)
        pending_count = total_count - checked_count
        
        # 计算异常数量
        abnormal_count = sum(1 for check in self.inventory_checks if check.status == "异常")
        
        self.total_label.setText(f"总数: {total_count}")
        self.checked_label.setText(f"已盘点: {checked_count}")
        self.pending_label.setText(f"待盘点: {pending_count}")
        self.abnormal_label.setText(f"异常: {abnormal_count}")
    
    def _on_bottle_number_entered(self):
        """瓶号输入完成后的处理"""
        bottle_number = self.bottle_number_edit.text().strip()
        if not bottle_number:
            return
        
        # 检查是否已盘点
        for check in self.inventory_checks:
            if check.bottle_number == bottle_number:
                QMessageBox.information(self, "提示", f"瓶号 '{bottle_number}' 已盘点")
                return
        
        # 查找试剂
        reagent = self.db_manager.get_reagent_by_bottle_number(bottle_number)
        if not reagent:
            QMessageBox.warning(self, "错误", f"未找到瓶号为 '{bottle_number}' 的试剂")
            return
        
        # 显示试剂信息
        self.selected_reagent_id = reagent.id
        self.current_name_label.setText(reagent.name)
        self.current_category_label.setText(reagent.category.value)
        self.current_quantity_label.setText(f"{reagent.quantity} {reagent.unit}")
        self.actual_quantity_spin.setValue(reagent.quantity)
        self.actual_quantity_spin.setRange(0, reagent.quantity * 2)
        self.difference_reason_edit.clear()
        
        self.current_info_group.setVisible(True)
        self.actual_quantity_spin.setFocus()
    
    def _on_pending_item_double_clicked(self, item: QTableWidgetItem):
        """待盘点列表项双击"""
        row = item.row()
        bottle_item = self.pending_table.item(row, 0)
        if bottle_item:
            bottle_number = bottle_item.text()
            self.bottle_number_edit.setText(bottle_number)
            self._on_bottle_number_entered()
    
    def _confirm_inventory_check(self):
        """确认盘点"""
        if self.selected_reagent_id is None:
            QMessageBox.warning(self, "提示", "请先扫描或选择一个试剂")
            return
        
        # 验证盘点人
        checker_id = self.checker_combo.currentData()
        if not checker_id:
            QMessageBox.warning(self, "验证失败", "请选择盘点人")
            self.checker_combo.setFocus()
            return
        
        # 获取试剂信息
        reagent = self.db_manager.get_reagent_by_id(self.selected_reagent_id)
        if not reagent:
            return
        
        expected_quantity = reagent.quantity
        actual_quantity = self.actual_quantity_spin.value()
        difference = actual_quantity - expected_quantity
        
        # 确定状态
        status = "正常" if difference == 0 else "异常"
        difference_reason = self.difference_reason_edit.toPlainText().strip() or None
        
        # 创建盘点记录
        check = InventoryCheck(
            id=None,
            reagent_id=reagent.id,
            bottle_number=reagent.bottle_number,
            check_date=self.inventory_date_edit.date().toPyDate(),
            checker_id=checker_id,
            expected_quantity=expected_quantity,
            actual_quantity=actual_quantity,
            difference=difference,
            difference_reason=difference_reason,
            status=status,
            notes=None,
            created_at=datetime.now()
        )
        
        # 添加到数据库
        self.db_manager.add_inventory_check(check)
        
        # 添加到当前会话
        self.inventory_checks.append(check)
        
        # 刷新界面
        self._populate_pending_table()
        self._populate_checked_table()
        self._update_stats()
        
        # 清空表单
        self._clear_current_form()
        
        # 显示提示
        if status == "正常":
            QMessageBox.information(self, "成功", f"盘点完成，数量一致\n{reagent.bottle_number} - {reagent.name}")
        else:
            QMessageBox.warning(
                self, "异常",
                f"盘点完成，数量差异: {difference}\n"
                f"系统记录: {expected_quantity}, 实际: {actual_quantity}\n"
                f"请记录差异原因"
            )
        
        # 聚焦到瓶号输入框，准备下一次扫描
        self.bottle_number_edit.clear()
        self.bottle_number_edit.setFocus()
    
    def _skip_reagent(self):
        """跳过当前试剂"""
        self._clear_current_form()
    
    def _clear_current_form(self):
        """清空当前表单"""
        self.selected_reagent_id = None
        self.current_name_label.setText("-")
        self.current_category_label.setText("-")
        self.current_quantity_label.setText("-")
        self.actual_quantity_spin.setValue(0)
        self.difference_reason_edit.clear()
        self.current_info_group.setVisible(False)
        self.bottle_number_edit.clear()
    
    def _start_new_inventory(self):
        """开始新一轮盘点"""
        reply = QMessageBox.question(
            self, "确认",
            "开始新一轮盘点将清空当前盘点记录，\n是否继续？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.inventory_checks.clear()
            self._populate_pending_table()
            self._populate_checked_table()
            self._update_stats()
            self._clear_current_form()
            QMessageBox.information(self, "已开始", "新一轮盘点已开始，请扫描瓶号")
            self.bottle_number_edit.setFocus()
    
    def _export_inventory_report(self):
        """导出盘点报告"""
        if not self.inventory_checks:
            QMessageBox.warning(self, "提示", "暂无盘点记录可导出")
            return
        
        # 验证盘点人
        checker_id = self.checker_combo.currentData()
        if not checker_id:
            QMessageBox.warning(self, "验证失败", "请选择盘点人")
            return
        
        checker = self.db_manager.get_responsible_person_by_id(checker_id)
        if not checker:
            return
        
        # 选择保存路径
        from PyQt5.QtWidgets import QFileDialog
        from logic.report_generator import ReportGenerator
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存盘点报告", "",
            "CSV 文件 (*.csv);;所有文件 (*.*)"
        )
        
        if not file_path:
            return
        
        # 确保文件名有 .csv 后缀
        if not file_path.lower().endswith('.csv'):
            file_path += '.csv'
        
        # 获取输出目录
        from pathlib import Path
        output_dir = str(Path(file_path).parent)
        
        # 生成报告
        from logic.report_generator import ReportGenerator
        report_path = ReportGenerator.generate_inventory_report(
            check_date=self.inventory_date_edit.date().toPyDate(),
            checker=checker,
            inventory_checks=self.inventory_checks,
            output_dir=output_dir
        )
        
        QMessageBox.information(self, "导出成功", f"盘点报告已导出到:\n{report_path}")
