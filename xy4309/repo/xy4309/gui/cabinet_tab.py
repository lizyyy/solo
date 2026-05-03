#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
柜位管理标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QLineEdit, QComboBox, QSpinBox, QFormLayout, QMessageBox,
    QSplitter, QTextEdit
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont, QColor

from datetime import datetime
from typing import Optional, List

from storage.db_manager import DatabaseManager
from models import Cabinet


class CabinetTab(QWidget):
    """柜位管理标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.selected_cabinet_id: Optional[int] = None
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部工具栏
        toolbar_layout = QHBoxLayout()
        
        toolbar_layout.addStretch()
        
        # 操作按钮
        add_btn = QPushButton("新增柜位")
        add_btn.clicked.connect(self._add_cabinet)
        toolbar_layout.addWidget(add_btn)
        
        edit_btn = QPushButton("编辑")
        edit_btn.clicked.connect(self._edit_cabinet)
        toolbar_layout.addWidget(edit_btn)
        
        delete_btn = QPushButton("删除")
        delete_btn.setStyleSheet("background-color: #f44336; color: white;")
        delete_btn.clicked.connect(self._delete_cabinet)
        toolbar_layout.addWidget(delete_btn)
        
        layout.addLayout(toolbar_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Vertical)
        
        # 柜位列表表格
        list_group = QGroupBox("柜位列表")
        list_layout = QVBoxLayout(list_group)
        
        self.cabinet_table = QTableWidget()
        self.cabinet_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.cabinet_table.setSelectionMode(QTableWidget.SingleSelection)
        self.cabinet_table.setAlternatingRowColors(True)
        self.cabinet_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.cabinet_table.verticalHeader().setDefaultSectionSize(30)
        self.cabinet_table.cellClicked.connect(self._on_cabinet_selected)
        self.cabinet_table.itemDoubleClicked.connect(self._edit_cabinet)
        
        # 设置表头
        headers = ["柜位名称", "位置", "描述", "责任人", "容量", "试剂数量"]
        self.cabinet_table.setColumnCount(len(headers))
        self.cabinet_table.setHorizontalHeaderLabels(headers)
        
        list_layout.addWidget(self.cabinet_table)
        splitter.addWidget(list_group)
        
        # 详细信息面板
        detail_group = QGroupBox("柜位详情")
        detail_layout = QVBoxLayout(detail_group)
        
        # 表单布局
        form_layout = QFormLayout()
        
        # 柜位名称
        self.name_edit = QLineEdit()
        form_layout.addRow("柜位名称:", self.name_edit)
        
        # 位置
        self.location_edit = QLineEdit()
        form_layout.addRow("位置:", self.location_edit)
        
        # 责任人
        self.person_combo = QComboBox()
        form_layout.addRow("责任人:", self.person_combo)
        
        # 容量
        self.capacity_spin = QSpinBox()
        self.capacity_spin.setRange(0, 1000)
        self.capacity_spin.setValue(50)
        form_layout.addRow("容量:", self.capacity_spin)
        
        # 描述
        self.description_edit = QTextEdit()
        self.description_edit.setMaximumHeight(80)
        form_layout.addRow("描述:", self.description_edit)
        
        detail_layout.addLayout(form_layout)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.save_btn = QPushButton("保存")
        self.save_btn.setMinimumWidth(100)
        self.save_btn.clicked.connect(self._save_cabinet)
        btn_layout.addWidget(self.save_btn)
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.setMinimumWidth(100)
        self.cancel_btn.clicked.connect(self._clear_form)
        btn_layout.addWidget(self.cancel_btn)
        
        detail_layout.addLayout(btn_layout)
        
        splitter.addWidget(detail_group)
        
        # 设置分割器比例
        splitter.setSizes([350, 300])
        
        layout.addWidget(splitter)
    
    def refresh_data(self):
        """刷新数据"""
        # 刷新责任人下拉列表
        self._refresh_person_combo()
        
        # 刷新柜位列表
        self._populate_table()
    
    def _refresh_person_combo(self):
        """刷新责任人下拉列表"""
        self.person_combo.clear()
        self.person_combo.addItem("请选择责任人", None)
        persons = self.db_manager.get_all_responsible_persons()
        for p in persons:
            self.person_combo.addItem(f"{p.name} ({p.department})", p.id)
    
    def _populate_table(self):
        """填充表格"""
        self.cabinet_table.setRowCount(0)
        
        cabinets = self.db_manager.get_all_cabinets()
        persons = {p.id: p for p in self.db_manager.get_all_responsible_persons()}
        
        for row, cabinet in enumerate(cabinets):
            self.cabinet_table.insertRow(row)
            
            # 柜位名称
            item = QTableWidgetItem(cabinet.name)
            item.setData(Qt.UserRole, cabinet.id)
            self.cabinet_table.setItem(row, 0, item)
            
            # 位置
            self.cabinet_table.setItem(row, 1, QTableWidgetItem(cabinet.location))
            
            # 描述
            self.cabinet_table.setItem(row, 2, QTableWidgetItem(cabinet.description or ""))
            
            # 责任人
            person_name = ""
            if cabinet.responsible_person_id and cabinet.responsible_person_id in persons:
                person_name = persons[cabinet.responsible_person_id].name
            self.cabinet_table.setItem(row, 3, QTableWidgetItem(person_name))
            
            # 容量
            capacity_str = f"{cabinet.capacity}" if cabinet.capacity else "未设置"
            self.cabinet_table.setItem(row, 4, QTableWidgetItem(capacity_str))
            
            # 试剂数量
            reagents = self.db_manager.get_reagents_by_cabinet(cabinet.id)
            self.cabinet_table.setItem(row, 5, QTableWidgetItem(f"{len(reagents)}"))
    
    def _on_cabinet_selected(self, row: int, column: int):
        """柜位被选中时的处理"""
        item = self.cabinet_table.item(row, 0)
        if item:
            cabinet_id = item.data(Qt.UserRole)
            self._load_cabinet_to_form(cabinet_id)
    
    def _load_cabinet_to_form(self, cabinet_id: int):
        """加载柜位信息到表单"""
        cabinet = self.db_manager.get_cabinet_by_id(cabinet_id)
        if not cabinet:
            return
        
        self.selected_cabinet_id = cabinet_id
        
        self.name_edit.setText(cabinet.name)
        self.location_edit.setText(cabinet.location)
        self.description_edit.setText(cabinet.description or "")
        
        # 设置责任人
        index = self.person_combo.findData(cabinet.responsible_person_id)
        if index >= 0:
            self.person_combo.setCurrentIndex(index)
        
        # 设置容量
        if cabinet.capacity:
            self.capacity_spin.setValue(cabinet.capacity)
        else:
            self.capacity_spin.setValue(50)
    
    def _clear_form(self):
        """清空表单"""
        self.selected_cabinet_id = None
        self.name_edit.clear()
        self.location_edit.clear()
        self.description_edit.clear()
        self.person_combo.setCurrentIndex(0)
        self.capacity_spin.setValue(50)
        self.cabinet_table.clearSelection()
    
    def _add_cabinet(self):
        """新增柜位"""
        self._clear_form()
        self.name_edit.setFocus()
    
    def _edit_cabinet(self):
        """编辑选中的柜位"""
        if self.selected_cabinet_id is None:
            QMessageBox.warning(self, "提示", "请先选择要编辑的柜位")
            return
    
    def _delete_cabinet(self):
        """删除选中的柜位"""
        if self.selected_cabinet_id is None:
            QMessageBox.warning(self, "提示", "请先选择要删除的柜位")
            return
        
        cabinet = self.db_manager.get_cabinet_by_id(self.selected_cabinet_id)
        if not cabinet:
            return
        
        # 检查是否有试剂在该柜位
        reagents = self.db_manager.get_reagents_by_cabinet(self.selected_cabinet_id)
        if reagents:
            QMessageBox.warning(
                self, "无法删除",
                f"柜位 '{cabinet.name}' 中有 {len(reagents)} 个试剂，\n"
                f"请先将这些试剂移走后再删除柜位。"
            )
            return
        
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除柜位 '{cabinet.name}' 吗？\n\n此操作不可恢复。",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.db_manager.delete_cabinet(self.selected_cabinet_id)
            self.refresh_data()
            self._clear_form()
            QMessageBox.information(self, "成功", "柜位已删除")
    
    def _save_cabinet(self):
        """保存柜位"""
        # 验证必填项
        name = self.name_edit.text().strip()
        if not name:
            QMessageBox.warning(self, "验证失败", "请输入柜位名称")
            self.name_edit.setFocus()
            return
        
        location = self.location_edit.text().strip()
        if not location:
            QMessageBox.warning(self, "验证失败", "请输入柜位位置")
            self.location_edit.setFocus()
            return
        
        # 收集数据
        cabinet_data = {
            'name': name,
            'location': location,
            'description': self.description_edit.toPlainText().strip() or None,
            'responsible_person_id': self.person_combo.currentData(),
            'capacity': self.capacity_spin.value() if self.capacity_spin.value() > 0 else None,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        if self.selected_cabinet_id is None:
            # 新增
            cabinet = Cabinet(id=None, **cabinet_data)
            self.db_manager.add_cabinet(cabinet)
            QMessageBox.information(self, "成功", "柜位已添加")
        else:
            # 更新
            cabinet = Cabinet(id=self.selected_cabinet_id, **cabinet_data)
            self.db_manager.update_cabinet(cabinet)
            QMessageBox.information(self, "成功", "柜位已更新")
        
        self.refresh_data()
        self._clear_form()
