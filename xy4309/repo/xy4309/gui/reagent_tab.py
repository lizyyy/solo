#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
试剂管理标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateEdit,
    QTextEdit, QFormLayout, QMessageBox, QFileDialog, QSplitter,
    QFrame, QCheckBox
)
from PyQt5.QtCore import Qt, QDate
from PyQt5.QtGui import QFont, QColor

from datetime import date, datetime
from typing import Optional, List

from storage.db_manager import DatabaseManager
from models import Reagent, ChemicalCategory
from logic.validation_rules import ValidationRules
from logic.import_export import ImportExportManager


class ReagentTab(QWidget):
    """试剂管理标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.selected_reagent_id: Optional[int] = None
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部工具栏
        toolbar_layout = QHBoxLayout()
        
        # 搜索框
        search_label = QLabel("搜索:")
        toolbar_layout.addWidget(search_label)
        
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("输入瓶号、试剂名称或生产厂家...")
        self.search_edit.setMaximumWidth(300)
        self.search_edit.returnPressed.connect(self._search_reagents)
        toolbar_layout.addWidget(self.search_edit)
        
        search_btn = QPushButton("搜索")
        search_btn.clicked.connect(self._search_reagents)
        toolbar_layout.addWidget(search_btn)
        
        show_all_btn = QPushButton("显示全部")
        show_all_btn.clicked.connect(self._show_all_reagents)
        toolbar_layout.addWidget(show_all_btn)
        
        toolbar_layout.addStretch()
        
        # 操作按钮
        add_btn = QPushButton("新增试剂")
        add_btn.clicked.connect(self._add_reagent)
        toolbar_layout.addWidget(add_btn)
        
        edit_btn = QPushButton("编辑")
        edit_btn.clicked.connect(self._edit_reagent)
        toolbar_layout.addWidget(edit_btn)
        
        delete_btn = QPushButton("删除")
        delete_btn.setStyleSheet("background-color: #f44336; color: white;")
        delete_btn.clicked.connect(self._delete_reagent)
        toolbar_layout.addWidget(delete_btn)
        
        toolbar_layout.addSpacing(20)
        
        # 导入导出
        import_btn = QPushButton("导入 CSV")
        import_btn.clicked.connect(self._import_reagents)
        toolbar_layout.addWidget(import_btn)
        
        export_btn = QPushButton("导出 CSV")
        export_btn.clicked.connect(self._export_reagents)
        toolbar_layout.addWidget(export_btn)
        
        layout.addLayout(toolbar_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Vertical)
        
        # 试剂列表表格
        list_group = QGroupBox("试剂列表")
        list_layout = QVBoxLayout(list_group)
        
        self.reagent_table = QTableWidget()
        self.reagent_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.reagent_table.setSelectionMode(QTableWidget.SingleSelection)
        self.reagent_table.setAlternatingRowColors(True)
        self.reagent_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.reagent_table.verticalHeader().setDefaultSectionSize(30)
        self.reagent_table.cellClicked.connect(self._on_reagent_selected)
        self.reagent_table.itemDoubleClicked.connect(self._edit_reagent)
        
        # 设置表头
        headers = [
            "瓶号", "试剂名称", "类别", "纯度", "规格", "生产厂家",
            "有效期至", "柜位", "数量", "单位", "状态"
        ]
        self.reagent_table.setColumnCount(len(headers))
        self.reagent_table.setHorizontalHeaderLabels(headers)
        
        list_layout.addWidget(self.reagent_table)
        splitter.addWidget(list_group)
        
        # 详细信息面板
        detail_group = QGroupBox("试剂详情")
        detail_layout = QVBoxLayout(detail_group)
        
        # 表单布局
        form_layout = QFormLayout()
        
        # 瓶号
        self.bottle_number_edit = QLineEdit()
        self.bottle_number_edit.setPlaceholderText("自动生成或手动输入")
        form_layout.addRow("瓶号:", self.bottle_number_edit)
        
        # 试剂名称
        self.name_edit = QLineEdit()
        form_layout.addRow("试剂名称:", self.name_edit)
        
        # 类别
        self.category_combo = QComboBox()
        for cat in ChemicalCategory:
            self.category_combo.addItem(cat.value, cat)
        form_layout.addRow("类别:", self.category_combo)
        
        # 纯度和规格
        sub_layout1 = QHBoxLayout()
        self.purity_edit = QLineEdit()
        self.purity_edit.setPlaceholderText("如: 分析纯")
        sub_layout1.addWidget(QLabel("纯度:"))
        sub_layout1.addWidget(self.purity_edit)
        
        self.spec_edit = QLineEdit()
        self.spec_edit.setPlaceholderText("如: 500ml")
        sub_layout1.addWidget(QLabel("规格:"))
        sub_layout1.addWidget(self.spec_edit)
        form_layout.addRow(sub_layout1)
        
        # 生产厂家
        self.manufacturer_edit = QLineEdit()
        form_layout.addRow("生产厂家:", self.manufacturer_edit)
        
        # 生产日期和有效期
        sub_layout2 = QHBoxLayout()
        self.prod_date_edit = QDateEdit()
        self.prod_date_edit.setCalendarPopup(True)
        self.prod_date_edit.setDate(QDate.currentDate())
        sub_layout2.addWidget(QLabel("生产日期:"))
        sub_layout2.addWidget(self.prod_date_edit)
        
        self.exp_date_edit = QDateEdit()
        self.exp_date_edit.setCalendarPopup(True)
        self.exp_date_edit.setDate(QDate.currentDate().addYears(1))
        sub_layout2.addWidget(QLabel("有效期至:"))
        sub_layout2.addWidget(self.exp_date_edit)
        form_layout.addRow(sub_layout2)
        
        # 柜位和责任人
        sub_layout3 = QHBoxLayout()
        self.cabinet_combo = QComboBox()
        sub_layout3.addWidget(QLabel("柜位:"))
        sub_layout3.addWidget(self.cabinet_combo, 1)
        
        self.person_combo = QComboBox()
        sub_layout3.addWidget(QLabel("责任人:"))
        sub_layout3.addWidget(self.person_combo, 1)
        form_layout.addRow(sub_layout3)
        
        # 数量、单位、最低库存
        sub_layout4 = QHBoxLayout()
        self.quantity_spin = QDoubleSpinBox()
        self.quantity_spin.setRange(0, 10000)
        self.quantity_spin.setDecimals(2)
        self.quantity_spin.setValue(1)
        sub_layout4.addWidget(QLabel("当前数量:"))
        sub_layout4.addWidget(self.quantity_spin)
        
        self.unit_edit = QLineEdit()
        self.unit_edit.setText("瓶")
        self.unit_edit.setMaximumWidth(80)
        sub_layout4.addWidget(QLabel("单位:"))
        sub_layout4.addWidget(self.unit_edit)
        
        self.min_quantity_spin = QDoubleSpinBox()
        self.min_quantity_spin.setRange(0, 1000)
        self.min_quantity_spin.setDecimals(2)
        self.min_quantity_spin.setValue(1)
        sub_layout4.addWidget(QLabel("最低库存:"))
        sub_layout4.addWidget(self.min_quantity_spin)
        form_layout.addRow(sub_layout4)
        
        # 购入日期
        self.purchase_date_edit = QDateEdit()
        self.purchase_date_edit.setCalendarPopup(True)
        self.purchase_date_edit.setDate(QDate.currentDate())
        form_layout.addRow("购入日期:", self.purchase_date_edit)
        
        # 备注
        self.notes_edit = QTextEdit()
        self.notes_edit.setMaximumHeight(80)
        form_layout.addRow("备注:", self.notes_edit)
        
        detail_layout.addLayout(form_layout)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.save_btn = QPushButton("保存")
        self.save_btn.setMinimumWidth(100)
        self.save_btn.clicked.connect(self._save_reagent)
        btn_layout.addWidget(self.save_btn)
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.setMinimumWidth(100)
        self.cancel_btn.clicked.connect(self._clear_form)
        btn_layout.addWidget(self.cancel_btn)
        
        detail_layout.addLayout(btn_layout)
        
        splitter.addWidget(detail_group)
        
        # 设置分割器比例
        splitter.setSizes([400, 300])
        
        layout.addWidget(splitter)
    
    def refresh_data(self):
        """刷新数据"""
        # 刷新柜位和责任人下拉列表
        self._refresh_combos()
        
        # 刷新试剂列表
        self._show_all_reagents()
    
    def _refresh_combos(self):
        """刷新下拉列表"""
        # 柜位
        self.cabinet_combo.clear()
        self.cabinet_combo.addItem("请选择柜位", None)
        cabinets = self.db_manager.get_all_cabinets()
        for cab in cabinets:
            self.cabinet_combo.addItem(f"{cab.name} ({cab.location})", cab.id)
        
        # 责任人
        self.person_combo.clear()
        self.person_combo.addItem("请选择责任人", None)
        persons = self.db_manager.get_all_responsible_persons()
        for p in persons:
            self.person_combo.addItem(f"{p.name} ({p.department})", p.id)
    
    def _search_reagents(self):
        """搜索试剂"""
        keyword = self.search_edit.text().strip()
        if keyword:
            reagents = self.db_manager.search_reagents(keyword)
        else:
            reagents = self.db_manager.get_all_reagents()
        
        self._populate_table(reagents)
    
    def _show_all_reagents(self):
        """显示所有试剂"""
        self.search_edit.clear()
        reagents = self.db_manager.get_all_reagents()
        self._populate_table(reagents)
    
    def _populate_table(self, reagents: List[Reagent]):
        """填充表格"""
        self.reagent_table.setRowCount(0)
        
        # 获取柜位和责任人信息
        cabinets = {c.id: c for c in self.db_manager.get_all_cabinets()}
        persons = {p.id: p for p in self.db_manager.get_all_responsible_persons()}
        
        today = date.today()
        
        for row, reagent in enumerate(reagents):
            self.reagent_table.insertRow(row)
            
            # 瓶号
            item = QTableWidgetItem(reagent.bottle_number)
            item.setData(Qt.UserRole, reagent.id)
            self.reagent_table.setItem(row, 0, item)
            
            # 试剂名称
            self.reagent_table.setItem(row, 1, QTableWidgetItem(reagent.name))
            
            # 类别
            self.reagent_table.setItem(row, 2, QTableWidgetItem(reagent.category.value))
            
            # 纯度
            self.reagent_table.setItem(row, 3, QTableWidgetItem(reagent.purity or ""))
            
            # 规格
            self.reagent_table.setItem(row, 4, QTableWidgetItem(reagent.specification or ""))
            
            # 生产厂家
            self.reagent_table.setItem(row, 5, QTableWidgetItem(reagent.manufacturer or ""))
            
            # 有效期至
            exp_date_item = QTableWidgetItem(reagent.expiration_date.isoformat() if reagent.expiration_date else "")
            # 根据过期状态设置颜色
            if reagent.expiration_date:
                days_until_expiry = (reagent.expiration_date - today).days
                if days_until_expiry < 0:
                    exp_date_item.setForeground(QColor(255, 0, 0))  # 红色
                elif days_until_expiry <= 30:
                    exp_date_item.setForeground(QColor(255, 102, 0))  # 橙色
            self.reagent_table.setItem(row, 6, exp_date_item)
            
            # 柜位
            cabinet_name = ""
            if reagent.cabinet_id and reagent.cabinet_id in cabinets:
                cabinet_name = cabinets[reagent.cabinet_id].name
            self.reagent_table.setItem(row, 7, QTableWidgetItem(cabinet_name))
            
            # 数量
            quantity_item = QTableWidgetItem(f"{reagent.quantity}")
            # 检查库存是否不足
            if reagent.quantity <= reagent.min_quantity:
                quantity_item.setForeground(QColor(204, 102, 0))  # 棕色
            self.reagent_table.setItem(row, 8, quantity_item)
            
            # 单位
            self.reagent_table.setItem(row, 9, QTableWidgetItem(reagent.unit))
            
            # 状态
            status = "正常"
            status_color = QColor(0, 153, 0)  # 绿色
            
            # 检查过期
            if reagent.expiration_date and reagent.expiration_date < today:
                status = "已过期"
                status_color = QColor(255, 0, 0)
            elif reagent.expiration_date and (reagent.expiration_date - today).days <= 30:
                status = "即将过期"
                status_color = QColor(255, 102, 0)
            
            # 检查库存
            if reagent.quantity <= reagent.min_quantity:
                if status == "正常":
                    status = "库存不足"
                else:
                    status += " / 库存不足"
                status_color = QColor(204, 102, 0)
            
            status_item = QTableWidgetItem(status)
            status_item.setForeground(status_color)
            self.reagent_table.setItem(row, 10, status_item)
    
    def _on_reagent_selected(self, row: int, column: int):
        """试剂被选中时的处理"""
        item = self.reagent_table.item(row, 0)
        if item:
            reagent_id = item.data(Qt.UserRole)
            self._load_reagent_to_form(reagent_id)
    
    def _load_reagent_to_form(self, reagent_id: int):
        """加载试剂信息到表单"""
        reagent = self.db_manager.get_reagent_by_id(reagent_id)
        if not reagent:
            return
        
        self.selected_reagent_id = reagent_id
        
        self.bottle_number_edit.setText(reagent.bottle_number)
        self.name_edit.setText(reagent.name)
        
        # 设置类别
        index = self.category_combo.findData(reagent.category)
        if index >= 0:
            self.category_combo.setCurrentIndex(index)
        
        self.purity_edit.setText(reagent.purity or "")
        self.spec_edit.setText(reagent.specification or "")
        self.manufacturer_edit.setText(reagent.manufacturer or "")
        
        # 设置日期
        if reagent.production_date:
            self.prod_date_edit.setDate(QDate(reagent.production_date.year, reagent.production_date.month, reagent.production_date.day))
        if reagent.expiration_date:
            self.exp_date_edit.setDate(QDate(reagent.expiration_date.year, reagent.expiration_date.month, reagent.expiration_date.day))
        if reagent.purchase_date:
            self.purchase_date_edit.setDate(QDate(reagent.purchase_date.year, reagent.purchase_date.month, reagent.purchase_date.day))
        
        # 设置柜位
        index = self.cabinet_combo.findData(reagent.cabinet_id)
        if index >= 0:
            self.cabinet_combo.setCurrentIndex(index)
        
        # 设置责任人
        index = self.person_combo.findData(reagent.responsible_person_id)
        if index >= 0:
            self.person_combo.setCurrentIndex(index)
        
        self.quantity_spin.setValue(reagent.quantity)
        self.unit_edit.setText(reagent.unit)
        self.min_quantity_spin.setValue(reagent.min_quantity)
        self.notes_edit.setText(reagent.notes or "")
    
    def _clear_form(self):
        """清空表单"""
        self.selected_reagent_id = None
        self.bottle_number_edit.clear()
        self.name_edit.clear()
        self.category_combo.setCurrentIndex(0)
        self.purity_edit.clear()
        self.spec_edit.clear()
        self.manufacturer_edit.clear()
        self.prod_date_edit.setDate(QDate.currentDate())
        self.exp_date_edit.setDate(QDate.currentDate().addYears(1))
        self.cabinet_combo.setCurrentIndex(0)
        self.person_combo.setCurrentIndex(0)
        self.quantity_spin.setValue(1)
        self.unit_edit.setText("瓶")
        self.min_quantity_spin.setValue(1)
        self.purchase_date_edit.setDate(QDate.currentDate())
        self.notes_edit.clear()
        self.reagent_table.clearSelection()
    
    def _add_reagent(self):
        """新增试剂"""
        self._clear_form()
        
        # 生成默认瓶号
        today = date.today()
        count = len(self.db_manager.get_all_reagents()) + 1
        default_bottle = f"R{today.year}{count:04d}"
        self.bottle_number_edit.setText(default_bottle)
        self.bottle_number_edit.setFocus()
    
    def _edit_reagent(self):
        """编辑选中的试剂"""
        if self.selected_reagent_id is None:
            QMessageBox.warning(self, "提示", "请先选择要编辑的试剂")
            return
    
    def _delete_reagent(self):
        """删除选中的试剂"""
        if self.selected_reagent_id is None:
            QMessageBox.warning(self, "提示", "请先选择要删除的试剂")
            return
        
        reagent = self.db_manager.get_reagent_by_id(self.selected_reagent_id)
        if not reagent:
            return
        
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除试剂 '{reagent.name}' ({reagent.bottle_number}) 吗？\n\n此操作不可恢复。",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.db_manager.delete_reagent(self.selected_reagent_id)
            self.refresh_data()
            self._clear_form()
            QMessageBox.information(self, "成功", "试剂已删除")
    
    def _save_reagent(self):
        """保存试剂"""
        # 验证必填项
        bottle_number = self.bottle_number_edit.text().strip()
        if not bottle_number:
            QMessageBox.warning(self, "验证失败", "请输入瓶号")
            self.bottle_number_edit.setFocus()
            return
        
        name = self.name_edit.text().strip()
        if not name:
            QMessageBox.warning(self, "验证失败", "请输入试剂名称")
            self.name_edit.setFocus()
            return
        
        category = self.category_combo.currentData()
        if category is None:
            QMessageBox.warning(self, "验证失败", "请选择试剂类别")
            self.category_combo.setFocus()
            return
        
        # 检查瓶号是否重复（新增时）
        if self.selected_reagent_id is None:
            existing = self.db_manager.get_reagent_by_bottle_number(bottle_number)
            if existing:
                QMessageBox.warning(self, "验证失败", f"瓶号 '{bottle_number}' 已存在")
                self.bottle_number_edit.setFocus()
                return
        
        # 收集数据
        reagent_data = {
            'bottle_number': bottle_number,
            'name': name,
            'category': category,
            'purity': self.purity_edit.text().strip() or None,
            'specification': self.spec_edit.text().strip() or None,
            'manufacturer': self.manufacturer_edit.text().strip() or None,
            'production_date': self.prod_date_edit.date().toPyDate(),
            'expiration_date': self.exp_date_edit.date().toPyDate(),
            'cabinet_id': self.cabinet_combo.currentData(),
            'quantity': self.quantity_spin.value(),
            'unit': self.unit_edit.text().strip() or "瓶",
            'min_quantity': self.min_quantity_spin.value(),
            'responsible_person_id': self.person_combo.currentData(),
            'purchase_date': self.purchase_date_edit.date().toPyDate(),
            'notes': self.notes_edit.toPlainText().strip() or None,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        if self.selected_reagent_id is None:
            # 新增
            reagent = Reagent(id=None, **reagent_data)
            self.db_manager.add_reagent(reagent)
            QMessageBox.information(self, "成功", "试剂已添加")
        else:
            # 更新
            reagent = Reagent(id=self.selected_reagent_id, **reagent_data)
            self.db_manager.update_reagent(reagent)
            QMessageBox.information(self, "成功", "试剂已更新")
        
        self.refresh_data()
        self._clear_form()
    
    def _import_reagents(self):
        """从 CSV 导入试剂"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择试剂数据文件", "",
            "CSV 文件 (*.csv);;所有文件 (*.*)"
        )
        
        if not file_path:
            return
        
        # 解析 CSV
        reagents_data = ImportExportManager.import_reagents_from_csv(file_path)
        
        if not reagents_data:
            QMessageBox.warning(self, "提示", "没有找到有效的试剂数据")
            return
        
        reply = QMessageBox.question(
            self, "确认导入",
            f"找到 {len(reagents_data)} 条试剂数据，是否导入？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.Yes
        )
        
        if reply != QMessageBox.Yes:
            return
        
        # 导入数据
        imported_count = 0
        skipped_count = 0
        
        for data in reagents_data:
            # 检查瓶号是否已存在
            existing = self.db_manager.get_reagent_by_bottle_number(data['bottle_number'])
            if existing:
                skipped_count += 1
                continue
            
            # 添加试剂
            reagent = Reagent(
                id=None,
                **data,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            self.db_manager.add_reagent(reagent)
            imported_count += 1
        
        self.refresh_data()
        QMessageBox.information(
            self, "导入完成",
            f"成功导入 {imported_count} 条记录\n跳过 {skipped_count} 条重复记录"
        )
    
    def _export_reagents(self):
        """导出试剂到 CSV"""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存试剂数据文件", "",
            "CSV 文件 (*.csv);;所有文件 (*.*)"
        )
        
        if not file_path:
            return
        
        # 确保文件名有 .csv 后缀
        if not file_path.lower().endswith('.csv'):
            file_path += '.csv'
        
        reagents = self.db_manager.get_all_reagents()
        
        if ImportExportManager.export_reagents_to_csv(reagents, file_path):
            QMessageBox.information(self, "导出成功", f"试剂数据已导出到:\n{file_path}")
        else:
            QMessageBox.warning(self, "导出失败", "导出试剂数据失败，请检查文件路径是否可写")
