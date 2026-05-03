#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
领用/归还标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QLineEdit, QComboBox, QDoubleSpinBox, QDateEdit,
    QTextEdit, QFormLayout, QMessageBox, QSplitter, QTabWidget
)
from PyQt5.QtCore import Qt, QDate
from PyQt5.QtGui import QColor

from datetime import date, datetime
from typing import Optional, List

from storage.db_manager import DatabaseManager
from models import UsageRecord, Reagent


class UsageTab(QWidget):
    """领用/归还标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.selected_record_id: Optional[int] = None
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部工具栏
        toolbar_layout = QHBoxLayout()
        
        # 操作类型选择
        self.operation_combo = QComboBox()
        self.operation_combo.addItem("全部操作", None)
        self.operation_combo.addItem("领用", "领用")
        self.operation_combo.addItem("归还", "归还")
        self.operation_combo.currentIndexChanged.connect(self._filter_records)
        toolbar_layout.addWidget(QLabel("操作类型:"))
        toolbar_layout.addWidget(self.operation_combo)
        
        toolbar_layout.addSpacing(20)
        
        # 状态选择
        self.status_combo = QComboBox()
        self.status_combo.addItem("全部状态", None)
        self.status_combo.addItem("已归还", "returned")
        self.status_combo.addItem("未归还", "not_returned")
        self.status_combo.addItem("超期未归还", "overdue")
        self.status_combo.currentIndexChanged.connect(self._filter_records)
        toolbar_layout.addWidget(QLabel("状态:"))
        toolbar_layout.addWidget(self.status_combo)
        
        toolbar_layout.addStretch()
        
        # 操作按钮
        add_usage_btn = QPushButton("新增领用")
        add_usage_btn.clicked.connect(self._add_usage)
        toolbar_layout.addWidget(add_usage_btn)
        
        add_return_btn = QPushButton("新增归还")
        add_return_btn.clicked.connect(self._add_return)
        toolbar_layout.addWidget(add_return_btn)
        
        layout.addLayout(toolbar_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Vertical)
        
        # 记录列表表格
        list_group = QGroupBox("领用/归还记录")
        list_layout = QVBoxLayout(list_group)
        
        self.record_table = QTableWidget()
        self.record_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.record_table.setSelectionMode(QTableWidget.SingleSelection)
        self.record_table.setAlternatingRowColors(True)
        self.record_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.record_table.verticalHeader().setDefaultSectionSize(30)
        self.record_table.cellClicked.connect(self._on_record_selected)
        
        # 设置表头
        headers = [
            "瓶号", "试剂名称", "操作类型", "数量", "单位",
            "操作人", "预计归还日期", "实际归还日期", "状态"
        ]
        self.record_table.setColumnCount(len(headers))
        self.record_table.setHorizontalHeaderLabels(headers)
        
        list_layout.addWidget(self.record_table)
        splitter.addWidget(list_group)
        
        # 详细信息面板
        detail_group = QGroupBox("记录详情 / 新增记录")
        detail_layout = QVBoxLayout(detail_group)
        
        # 表单布局
        form_layout = QFormLayout()
        
        # 瓶号输入（支持扫码或手动输入）
        self.bottle_number_edit = QLineEdit()
        self.bottle_number_edit.setPlaceholderText("扫码或输入瓶号后按回车...")
        self.bottle_number_edit.returnPressed.connect(self._on_bottle_number_entered)
        form_layout.addRow("瓶号:", self.bottle_number_edit)
        
        # 试剂名称（只读，根据瓶号自动填充）
        self.reagent_name_label = QLabel("-")
        form_layout.addRow("试剂名称:", self.reagent_name_label)
        
        # 操作类型
        self.operation_type_combo = QComboBox()
        self.operation_type_combo.addItem("领用", "领用")
        self.operation_type_combo.addItem("归还", "归还")
        self.operation_type_combo.currentIndexChanged.connect(self._on_operation_type_changed)
        form_layout.addRow("操作类型:", self.operation_type_combo)
        
        # 数量和单位
        sub_layout1 = QHBoxLayout()
        self.quantity_spin = QDoubleSpinBox()
        self.quantity_spin.setRange(0, 10000)
        self.quantity_spin.setDecimals(2)
        self.quantity_spin.setValue(1)
        sub_layout1.addWidget(QLabel("数量:"))
        sub_layout1.addWidget(self.quantity_spin)
        
        self.unit_edit = QLineEdit()
        self.unit_edit.setText("瓶")
        self.unit_edit.setMaximumWidth(80)
        sub_layout1.addWidget(QLabel("单位:"))
        sub_layout1.addWidget(self.unit_edit)
        form_layout.addRow(sub_layout1)
        
        # 操作人
        self.operator_combo = QComboBox()
        form_layout.addRow("操作人:", self.operator_combo)
        
        # 预计归还日期（仅领用需要）
        self.expected_return_label = QLabel("预计归还日期:")
        self.expected_return_edit = QDateEdit()
        self.expected_return_edit.setCalendarPopup(True)
        self.expected_return_edit.setDate(QDate.currentDate().addDays(7))
        form_layout.addRow(self.expected_return_label, self.expected_return_edit)
        
        # 用途
        self.purpose_edit = QLineEdit()
        self.purpose_edit.setPlaceholderText("实验用途...")
        form_layout.addRow("用途:", self.purpose_edit)
        
        # 备注
        self.notes_edit = QTextEdit()
        self.notes_edit.setMaximumHeight(60)
        form_layout.addRow("备注:", self.notes_edit)
        
        detail_layout.addLayout(form_layout)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.save_btn = QPushButton("保存记录")
        self.save_btn.setMinimumWidth(120)
        self.save_btn.clicked.connect(self._save_record)
        btn_layout.addWidget(self.save_btn)
        
        self.clear_btn = QPushButton("清空表单")
        self.clear_btn.setMinimumWidth(100)
        self.clear_btn.clicked.connect(self._clear_form)
        btn_layout.addWidget(self.clear_btn)
        
        detail_layout.addLayout(btn_layout)
        
        splitter.addWidget(detail_group)
        
        # 设置分割器比例
        splitter.setSizes([400, 350])
        
        layout.addWidget(splitter)
        
        # 初始状态隐藏预计归还日期相关控件
        self._update_return_controls_visibility()
    
    def refresh_data(self):
        """刷新数据"""
        # 刷新操作人下拉列表
        self._refresh_operator_combo()
        
        # 刷新记录列表
        self._filter_records()
    
    def _refresh_operator_combo(self):
        """刷新操作人下拉列表"""
        self.operator_combo.clear()
        self.operator_combo.addItem("请选择操作人", None)
        persons = self.db_manager.get_all_responsible_persons()
        for p in persons:
            self.operator_combo.addItem(f"{p.name} ({p.department})", p.id)
    
    def _filter_records(self):
        """过滤记录"""
        operation_filter = self.operation_combo.currentData()
        status_filter = self.status_combo.currentData()
        
        all_records = self.db_manager.get_all_usage_records()
        filtered_records = []
        
        today = date.today()
        
        for record in all_records:
            # 操作类型过滤
            if operation_filter and record.operation_type != operation_filter:
                continue
            
            # 状态过滤
            if status_filter:
                if status_filter == "returned":
                    if record.actual_return_date is None:
                        continue
                elif status_filter == "not_returned":
                    if record.actual_return_date is not None:
                        continue
                elif status_filter == "overdue":
                    if record.actual_return_date is not None:
                        continue
                    if record.expected_return_date is None:
                        continue
                    if record.expected_return_date >= today:
                        continue
            
            filtered_records.append(record)
        
        self._populate_table(filtered_records)
    
    def _populate_table(self, records: List[UsageRecord]):
        """填充表格"""
        self.record_table.setRowCount(0)
        
        # 获取试剂和责任人信息
        reagents = {r.id: r for r in self.db_manager.get_all_reagents()}
        persons = {p.id: p for p in self.db_manager.get_all_responsible_persons()}
        
        today = date.today()
        
        for row, record in enumerate(records):
            self.record_table.insertRow(row)
            
            # 瓶号
            item = QTableWidgetItem(record.bottle_number)
            item.setData(Qt.UserRole, record.id)
            self.record_table.setItem(row, 0, item)
            
            # 试剂名称
            reagent_name = ""
            if record.reagent_id in reagents:
                reagent_name = reagents[record.reagent_id].name
            self.record_table.setItem(row, 1, QTableWidgetItem(reagent_name))
            
            # 操作类型
            op_item = QTableWidgetItem(record.operation_type)
            if record.operation_type == "领用":
                op_item.setForeground(QColor(0, 102, 204))  # 蓝色
            else:
                op_item.setForeground(QColor(0, 153, 0))  # 绿色
            self.record_table.setItem(row, 2, op_item)
            
            # 数量
            self.record_table.setItem(row, 3, QTableWidgetItem(f"{record.quantity}"))
            
            # 单位
            self.record_table.setItem(row, 4, QTableWidgetItem(record.unit))
            
            # 操作人
            operator_name = ""
            if record.operator_id in persons:
                operator_name = persons[record.operator_id].name
            self.record_table.setItem(row, 5, QTableWidgetItem(operator_name))
            
            # 预计归还日期
            expected_str = record.expected_return_date.isoformat() if record.expected_return_date else "-"
            self.record_table.setItem(row, 6, QTableWidgetItem(expected_str))
            
            # 实际归还日期
            actual_str = record.actual_return_date.isoformat() if record.actual_return_date else "-"
            self.record_table.setItem(row, 7, QTableWidgetItem(actual_str))
            
            # 状态
            status = ""
            status_color = QColor(0, 153, 0)  # 绿色
            
            if record.operation_type == "领用":
                if record.actual_return_date is not None:
                    status = "已归还"
                else:
                    if record.expected_return_date is None:
                        status = "未设置归还日期"
                        status_color = QColor(204, 102, 0)  # 棕色
                    elif record.expected_return_date < today:
                        days_overdue = (today - record.expected_return_date).days
                        status = f"超期 {days_overdue} 天"
                        status_color = QColor(255, 0, 0)  # 红色
                    else:
                        status = "领用中"
            else:
                status = "已归还"
            
            status_item = QTableWidgetItem(status)
            status_item.setForeground(status_color)
            self.record_table.setItem(row, 8, status_item)
    
    def _on_record_selected(self, row: int, column: int):
        """记录被选中时的处理"""
        item = self.record_table.item(row, 0)
        if item:
            record_id = item.data(Qt.UserRole)
            self._load_record_to_form(record_id)
    
    def _load_record_to_form(self, record_id: int):
        """加载记录信息到表单"""
        record = self.db_manager.get_usage_record_by_id(record_id)
        if not record:
            return
        
        self.selected_record_id = record_id
        
        self.bottle_number_edit.setText(record.bottle_number)
        
        # 尝试获取试剂名称
        reagent = self.db_manager.get_reagent_by_bottle_number(record.bottle_number)
        if reagent:
            self.reagent_name_label.setText(reagent.name)
        else:
            self.reagent_name_label.setText("-")
        
        # 设置操作类型
        index = self.operation_type_combo.findData(record.operation_type)
        if index >= 0:
            self.operation_type_combo.setCurrentIndex(index)
        
        self.quantity_spin.setValue(record.quantity)
        self.unit_edit.setText(record.unit)
        
        # 设置操作人
        index = self.operator_combo.findData(record.operator_id)
        if index >= 0:
            self.operator_combo.setCurrentIndex(index)
        
        # 设置预计归还日期
        if record.expected_return_date:
            self.expected_return_edit.setDate(QDate(
                record.expected_return_date.year,
                record.expected_return_date.month,
                record.expected_return_date.day
            ))
        
        self.purpose_edit.setText(record.purpose or "")
        self.notes_edit.setText(record.notes or "")
        
        # 更新控件可见性
        self._update_return_controls_visibility()
    
    def _on_bottle_number_entered(self):
        """瓶号输入完成后的处理"""
        bottle_number = self.bottle_number_edit.text().strip()
        if not bottle_number:
            return
        
        # 查找试剂
        reagent = self.db_manager.get_reagent_by_bottle_number(bottle_number)
        if reagent:
            self.reagent_name_label.setText(reagent.name)
            self.unit_edit.setText(reagent.unit)
            self.quantity_spin.setValue(min(1.0, reagent.quantity))
            self.quantity_spin.setRange(0, reagent.quantity)
        else:
            self.reagent_name_label.setText("未找到该瓶号的试剂")
            self.quantity_spin.setRange(0, 10000)
    
    def _on_operation_type_changed(self):
        """操作类型改变时的处理"""
        self._update_return_controls_visibility()
    
    def _update_return_controls_visibility(self):
        """更新预计归还日期控件的可见性"""
        operation_type = self.operation_type_combo.currentData()
        is_usage = (operation_type == "领用")
        
        self.expected_return_label.setVisible(is_usage)
        self.expected_return_edit.setVisible(is_usage)
    
    def _clear_form(self):
        """清空表单"""
        self.selected_record_id = None
        self.bottle_number_edit.clear()
        self.reagent_name_label.setText("-")
        self.operation_type_combo.setCurrentIndex(0)
        self.quantity_spin.setValue(1)
        self.quantity_spin.setRange(0, 10000)
        self.unit_edit.setText("瓶")
        self.operator_combo.setCurrentIndex(0)
        self.expected_return_edit.setDate(QDate.currentDate().addDays(7))
        self.purpose_edit.clear()
        self.notes_edit.clear()
        self.record_table.clearSelection()
        self._update_return_controls_visibility()
    
    def _add_usage(self):
        """新增领用"""
        self._clear_form()
        self.operation_type_combo.setCurrentIndex(0)  # 领用
        self.bottle_number_edit.setFocus()
    
    def _add_return(self):
        """新增归还"""
        self._clear_form()
        self.operation_type_combo.setCurrentIndex(1)  # 归还
        self.bottle_number_edit.setFocus()
    
    def _save_record(self):
        """保存记录"""
        # 验证必填项
        bottle_number = self.bottle_number_edit.text().strip()
        if not bottle_number:
            QMessageBox.warning(self, "验证失败", "请输入瓶号")
            self.bottle_number_edit.setFocus()
            return
        
        # 查找试剂
        reagent = self.db_manager.get_reagent_by_bottle_number(bottle_number)
        if not reagent:
            QMessageBox.warning(self, "验证失败", f"未找到瓶号为 '{bottle_number}' 的试剂")
            self.bottle_number_edit.setFocus()
            return
        
        operation_type = self.operation_type_combo.currentData()
        if not operation_type:
            QMessageBox.warning(self, "验证失败", "请选择操作类型")
            return
        
        quantity = self.quantity_spin.value()
        if quantity <= 0:
            QMessageBox.warning(self, "验证失败", "数量必须大于0")
            self.quantity_spin.setFocus()
            return
        
        operator_id = self.operator_combo.currentData()
        if not operator_id:
            QMessageBox.warning(self, "验证失败", "请选择操作人")
            self.operator_combo.setFocus()
            return
        
        # 领用需要验证库存
        if operation_type == "领用":
            if quantity > reagent.quantity:
                QMessageBox.warning(
                    self, "验证失败",
                    f"库存不足！当前库存: {reagent.quantity} {reagent.unit}"
                )
                return
        
        # 收集数据
        record_data = {
            'reagent_id': reagent.id,
            'bottle_number': bottle_number,
            'operation_type': operation_type,
            'quantity': quantity,
            'unit': self.unit_edit.text().strip() or "瓶",
            'operator_id': operator_id,
            'expected_return_date': self.expected_return_edit.date().toPyDate() if operation_type == "领用" else None,
            'actual_return_date': date.today() if operation_type == "归还" else None,
            'purpose': self.purpose_edit.text().strip() or None,
            'notes': self.notes_edit.toPlainText().strip() or None,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        # 添加记录
        record = UsageRecord(id=None, **record_data)
        self.db_manager.add_usage_record(record)
        
        # 更新试剂库存
        if operation_type == "领用":
            reagent.quantity -= quantity
        else:  # 归还
            reagent.quantity += quantity
        
        self.db_manager.update_reagent(reagent)
        
        QMessageBox.information(self, "成功", f"{operation_type}记录已保存")
        
        self.refresh_data()
        self._clear_form()
