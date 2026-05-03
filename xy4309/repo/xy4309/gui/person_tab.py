#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
责任人管理标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QLineEdit, QFormLayout, QMessageBox, QSplitter
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

from datetime import datetime
from typing import Optional

from storage.db_manager import DatabaseManager
from models import ResponsiblePerson


class PersonTab(QWidget):
    """责任人管理标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.selected_person_id: Optional[int] = None
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部工具栏
        toolbar_layout = QHBoxLayout()
        
        toolbar_layout.addStretch()
        
        # 操作按钮
        add_btn = QPushButton("新增责任人")
        add_btn.clicked.connect(self._add_person)
        toolbar_layout.addWidget(add_btn)
        
        edit_btn = QPushButton("编辑")
        edit_btn.clicked.connect(self._edit_person)
        toolbar_layout.addWidget(edit_btn)
        
        delete_btn = QPushButton("删除")
        delete_btn.setStyleSheet("background-color: #f44336; color: white;")
        delete_btn.clicked.connect(self._delete_person)
        toolbar_layout.addWidget(delete_btn)
        
        layout.addLayout(toolbar_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Vertical)
        
        # 责任人列表表格
        list_group = QGroupBox("责任人列表")
        list_layout = QVBoxLayout(list_group)
        
        self.person_table = QTableWidget()
        self.person_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.person_table.setSelectionMode(QTableWidget.SingleSelection)
        self.person_table.setAlternatingRowColors(True)
        self.person_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.person_table.verticalHeader().setDefaultSectionSize(30)
        self.person_table.cellClicked.connect(self._on_person_selected)
        self.person_table.itemDoubleClicked.connect(self._edit_person)
        
        # 设置表头
        headers = ["姓名", "工号", "部门", "电话", "邮箱"]
        self.person_table.setColumnCount(len(headers))
        self.person_table.setHorizontalHeaderLabels(headers)
        
        list_layout.addWidget(self.person_table)
        splitter.addWidget(list_group)
        
        # 详细信息面板
        detail_group = QGroupBox("责任人详情")
        detail_layout = QVBoxLayout(detail_group)
        
        # 表单布局
        form_layout = QFormLayout()
        
        # 姓名
        self.name_edit = QLineEdit()
        form_layout.addRow("姓名:", self.name_edit)
        
        # 工号
        self.employee_id_edit = QLineEdit()
        form_layout.addRow("工号:", self.employee_id_edit)
        
        # 部门
        self.department_edit = QLineEdit()
        form_layout.addRow("部门:", self.department_edit)
        
        # 电话
        self.phone_edit = QLineEdit()
        form_layout.addRow("电话:", self.phone_edit)
        
        # 邮箱
        self.email_edit = QLineEdit()
        form_layout.addRow("邮箱:", self.email_edit)
        
        detail_layout.addLayout(form_layout)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.save_btn = QPushButton("保存")
        self.save_btn.setMinimumWidth(100)
        self.save_btn.clicked.connect(self._save_person)
        btn_layout.addWidget(self.save_btn)
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.setMinimumWidth(100)
        self.cancel_btn.clicked.connect(self._clear_form)
        btn_layout.addWidget(self.cancel_btn)
        
        detail_layout.addLayout(btn_layout)
        
        splitter.addWidget(detail_group)
        
        # 设置分割器比例
        splitter.setSizes([350, 250])
        
        layout.addWidget(splitter)
    
    def refresh_data(self):
        """刷新数据"""
        self._populate_table()
    
    def _populate_table(self):
        """填充表格"""
        self.person_table.setRowCount(0)
        
        persons = self.db_manager.get_all_responsible_persons()
        
        for row, person in enumerate(persons):
            self.person_table.insertRow(row)
            
            # 姓名
            item = QTableWidgetItem(person.name)
            item.setData(Qt.UserRole, person.id)
            self.person_table.setItem(row, 0, item)
            
            # 工号
            self.person_table.setItem(row, 1, QTableWidgetItem(person.employee_id))
            
            # 部门
            self.person_table.setItem(row, 2, QTableWidgetItem(person.department))
            
            # 电话
            self.person_table.setItem(row, 3, QTableWidgetItem(person.phone or ""))
            
            # 邮箱
            self.person_table.setItem(row, 4, QTableWidgetItem(person.email or ""))
    
    def _on_person_selected(self, row: int, column: int):
        """责任人被选中时的处理"""
        item = self.person_table.item(row, 0)
        if item:
            person_id = item.data(Qt.UserRole)
            self._load_person_to_form(person_id)
    
    def _load_person_to_form(self, person_id: int):
        """加载责任人信息到表单"""
        person = self.db_manager.get_responsible_person_by_id(person_id)
        if not person:
            return
        
        self.selected_person_id = person_id
        
        self.name_edit.setText(person.name)
        self.employee_id_edit.setText(person.employee_id)
        self.department_edit.setText(person.department)
        self.phone_edit.setText(person.phone or "")
        self.email_edit.setText(person.email or "")
    
    def _clear_form(self):
        """清空表单"""
        self.selected_person_id = None
        self.name_edit.clear()
        self.employee_id_edit.clear()
        self.department_edit.clear()
        self.phone_edit.clear()
        self.email_edit.clear()
        self.person_table.clearSelection()
    
    def _add_person(self):
        """新增责任人"""
        self._clear_form()
        self.name_edit.setFocus()
    
    def _edit_person(self):
        """编辑选中的责任人"""
        if self.selected_person_id is None:
            QMessageBox.warning(self, "提示", "请先选择要编辑的责任人")
            return
    
    def _delete_person(self):
        """删除选中的责任人"""
        if self.selected_person_id is None:
            QMessageBox.warning(self, "提示", "请先选择要删除的责任人")
            return
        
        person = self.db_manager.get_responsible_person_by_id(self.selected_person_id)
        if not person:
            return
        
        # 检查是否有关联数据
        # 检查是否有试剂关联
        reagents = []
        for reagent in self.db_manager.get_all_reagents():
            if reagent.responsible_person_id == self.selected_person_id:
                reagents.append(reagent)
        
        # 检查是否有柜位关联
        cabinets = []
        for cabinet in self.db_manager.get_all_cabinets():
            if cabinet.responsible_person_id == self.selected_person_id:
                cabinets.append(cabinet)
        
        # 检查是否有领用记录关联
        usage_records = []
        for record in self.db_manager.get_all_usage_records():
            if record.operator_id == self.selected_person_id:
                usage_records.append(record)
        
        if reagents or cabinets or usage_records:
            messages = []
            if reagents:
                messages.append(f"- 关联 {len(reagents)} 个试剂")
            if cabinets:
                messages.append(f"- 关联 {len(cabinets)} 个柜位")
            if usage_records:
                messages.append(f"- 关联 {len(usage_records)} 条领用记录")
            
            QMessageBox.warning(
                self, "无法删除",
                f"责任人 '{person.name}' 有关联数据：\n" + "\n".join(messages) +
                "\n\n请先解除这些关联后再删除。"
            )
            return
        
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除责任人 '{person.name}' 吗？\n\n此操作不可恢复。",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.db_manager.delete_responsible_person(self.selected_person_id)
            self.refresh_data()
            self._clear_form()
            QMessageBox.information(self, "成功", "责任人已删除")
    
    def _save_person(self):
        """保存责任人"""
        # 验证必填项
        name = self.name_edit.text().strip()
        if not name:
            QMessageBox.warning(self, "验证失败", "请输入姓名")
            self.name_edit.setFocus()
            return
        
        employee_id = self.employee_id_edit.text().strip()
        if not employee_id:
            QMessageBox.warning(self, "验证失败", "请输入工号")
            self.employee_id_edit.setFocus()
            return
        
        department = self.department_edit.text().strip()
        if not department:
            QMessageBox.warning(self, "验证失败", "请输入部门")
            self.department_edit.setFocus()
            return
        
        # 检查工号是否重复（新增时）
        if self.selected_person_id is None:
            existing = self.db_manager.get_responsible_person_by_employee_id(employee_id)
            if existing:
                QMessageBox.warning(self, "验证失败", f"工号 '{employee_id}' 已存在")
                self.employee_id_edit.setFocus()
                return
        
        # 收集数据
        person_data = {
            'name': name,
            'employee_id': employee_id,
            'department': department,
            'phone': self.phone_edit.text().strip() or None,
            'email': self.email_edit.text().strip() or None,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        if self.selected_person_id is None:
            # 新增
            person = ResponsiblePerson(id=None, **person_data)
            self.db_manager.add_responsible_person(person)
            QMessageBox.information(self, "成功", "责任人已添加")
        else:
            # 更新
            person = ResponsiblePerson(id=self.selected_person_id, **person_data)
            self.db_manager.update_responsible_person(person)
            QMessageBox.information(self, "成功", "责任人已更新")
        
        self.refresh_data()
        self._clear_form()
