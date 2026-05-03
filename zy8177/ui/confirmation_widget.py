#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
待确认列表组件
用于显示需要人工确认的项目列表
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTableWidget,
    QTableWidgetItem, QHeaderView, QGroupBox, QPushButton,
    QDialog, QLineEdit, QTextEdit, QFormLayout, QDialogButtonBox,
    QMessageBox, QComboBox, QCheckBox
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QFont, QColor, QBrush
from typing import Dict, Any, List, Optional
from datetime import datetime


class ConfirmationWidget(QWidget):
    """
    待确认列表组件
    显示需要人工确认的项目，支持确认、标记异常、添加备注等操作
    """
    
    # 确认状态常量
    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_ABNORMAL = 'abnormal'
    STATUS_NOTE_ADDED = 'note_added'
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # 当前数据
        self.items: List[Dict[str, Any]] = []
        self.confirmation_states: Dict[int, Dict[str, Any]] = {}
        
        self.init_ui()
        
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(10)
        
        # 统计信息
        stats_layout = QHBoxLayout()
        
        self.pending_label = QLabel("待确认: 0")
        self.pending_label.setStyleSheet("color: #1976D2; font-weight: bold;")
        stats_layout.addWidget(self.pending_label)
        
        self.confirmed_label = QLabel("已确认: 0")
        self.confirmed_label.setStyleSheet("color: #388E3C; font-weight: bold;")
        stats_layout.addWidget(self.confirmed_label)
        
        self.abnormal_label = QLabel("标记异常: 0")
        self.abnormal_label.setStyleSheet("color: #D32F2F; font-weight: bold;")
        stats_layout.addWidget(self.abnormal_label)
        
        stats_layout.addStretch()
        
        layout.addLayout(stats_layout)
        
        # 待确认列表表格
        self.confirmation_table = QTableWidget()
        self.confirmation_table.setColumnCount(6)
        self.confirmation_table.setHorizontalHeaderLabels([
            "状态", "类型", "眼别", "描述", "备注", "确认时间"
        ])
        
        # 设置列宽
        header = self.confirmation_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)
        header.setSectionResizeMode(1, QHeaderView.Fixed)
        header.setSectionResizeMode(2, QHeaderView.Fixed)
        header.setSectionResizeMode(3, QHeaderView.Stretch)
        header.setSectionResizeMode(4, QHeaderView.Stretch)
        header.setSectionResizeMode(5, QHeaderView.Fixed)
        
        self.confirmation_table.setColumnWidth(0, 80)
        self.confirmation_table.setColumnWidth(1, 100)
        self.confirmation_table.setColumnWidth(2, 60)
        self.confirmation_table.setColumnWidth(5, 120)
        
        # 允许选择多行
        self.confirmation_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.confirmation_table.setSelectionMode(QTableWidget.ExtendedSelection)
        
        # 交替行颜色
        self.confirmation_table.setAlternatingRowColors(True)
        
        # 双击编辑备注
        self.confirmation_table.itemDoubleClicked.connect(self._on_item_double_clicked)
        
        layout.addWidget(self.confirmation_table, 1)
        
    def set_items(self, items: List[Dict[str, Any]]):
        """
        设置待确认项目列表
        """
        self.items = items
        self._update_display()
        
    def _update_display(self):
        """更新显示"""
        self.confirmation_table.setRowCount(len(self.items))
        
        pending_count = 0
        confirmed_count = 0
        abnormal_count = 0
        
        for row, item in enumerate(self.items):
            # 获取状态
            state = self.confirmation_states.get(row, {})
            status = state.get('status', self.STATUS_PENDING)
            
            # 统计
            if status == self.STATUS_PENDING:
                pending_count += 1
            elif status == self.STATUS_CONFIRMED:
                confirmed_count += 1
            elif status == self.STATUS_ABNORMAL:
                abnormal_count += 1
            
            # 状态列
            status_label, status_color = self._get_status_display(status)
            status_item = QTableWidgetItem(status_label)
            status_item.setTextAlignment(Qt.AlignCenter)
            status_item.setForeground(QBrush(QColor(status_color)))
            status_item.setFont(self._get_bold_font())
            self.confirmation_table.setItem(row, 0, status_item)
            
            # 类型列
            item_type = item.get('type', 'unknown')
            type_label = self._get_type_label(item_type)
            type_item = QTableWidgetItem(type_label)
            type_item.setTextAlignment(Qt.AlignCenter)
            self.confirmation_table.setItem(row, 1, type_item)
            
            # 眼别列
            eye = item.get('eye', '')
            eye_label = "左眼" if eye == 'left' else "右眼" if eye == 'right' else ""
            eye_item = QTableWidgetItem(eye_label)
            eye_item.setTextAlignment(Qt.AlignCenter)
            self.confirmation_table.setItem(row, 2, eye_item)
            
            # 描述列
            description = item.get('description', '')
            desc_item = QTableWidgetItem(description)
            desc_item.setToolTip(description)
            self.confirmation_table.setItem(row, 3, desc_item)
            
            # 备注列
            note = state.get('note', '')
            note_item = QTableWidgetItem(note)
            note_item.setToolTip(note)
            self.confirmation_table.setItem(row, 4, note_item)
            
            # 确认时间列
            confirm_time = state.get('confirm_time', '')
            time_item = QTableWidgetItem(confirm_time)
            time_item.setTextAlignment(Qt.AlignCenter)
            self.confirmation_table.setItem(row, 5, time_item)
            
            # 设置行背景色
            if status == self.STATUS_CONFIRMED:
                for col in range(self.confirmation_table.columnCount()):
                    table_item = self.confirmation_table.item(row, col)
                    if table_item:
                        table_item.setBackground(QBrush(QColor('#E8F5E9')))
            elif status == self.STATUS_ABNORMAL:
                for col in range(self.confirmation_table.columnCount()):
                    table_item = self.confirmation_table.item(row, col)
                    if table_item:
                        table_item.setBackground(QBrush(QColor('#FFEBEE')))
            
            # 设置行高
            self.confirmation_table.setRowHeight(row, 35)
        
        # 更新统计标签
        self.pending_label.setText(f"待确认: {pending_count}")
        self.confirmed_label.setText(f"已确认: {confirmed_count}")
        self.abnormal_label.setText(f"标记异常: {abnormal_count}")
        
    def _get_status_display(self, status: str) -> tuple:
        """获取状态显示文本和颜色"""
        status_map = {
            self.STATUS_PENDING: ("待确认", "#1976D2"),
            self.STATUS_CONFIRMED: ("已确认", "#388E3C"),
            self.STATUS_ABNORMAL: ("异常", "#D32F2F"),
            self.STATUS_NOTE_ADDED: ("有备注", "#7B1FA2")
        }
        return status_map.get(status, ("未知", "#757575"))
        
    def _get_type_label(self, item_type: str) -> str:
        """获取类型标签"""
        type_map = {
            'reliability': "可靠性",
            'progress': "进展",
            'data_quality': "数据质量"
        }
        return type_map.get(item_type, item_type)
        
    def _get_bold_font(self) -> QFont:
        """获取粗体字体"""
        font = QFont()
        font.setBold(True)
        return font
        
    def confirm_all(self):
        """全部确认"""
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M')
        
        for row in range(len(self.items)):
            self.confirmation_states[row] = {
                'status': self.STATUS_CONFIRMED,
                'confirm_time': current_time,
                'note': self.confirmation_states.get(row, {}).get('note', '')
            }
        
        self._update_display()
        
    def confirm_selected(self):
        """确认选中"""
        selected_rows = self._get_selected_rows()
        
        if not selected_rows:
            QMessageBox.information(self, "提示", "请先选择要确认的项目")
            return
        
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M')
        
        for row in selected_rows:
            self.confirmation_states[row] = {
                'status': self.STATUS_CONFIRMED,
                'confirm_time': current_time,
                'note': self.confirmation_states.get(row, {}).get('note', '')
            }
        
        self._update_display()
        
    def mark_as_abnormal(self):
        """标记为异常"""
        selected_rows = self._get_selected_rows()
        
        if not selected_rows:
            QMessageBox.information(self, "提示", "请先选择要标记的项目")
            return
        
        # 显示备注对话框
        dialog = NoteDialog(self)
        dialog.setWindowTitle("添加异常备注")
        
        if dialog.exec_() == QDialog.Accepted:
            note = dialog.get_note()
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M')
            
            for row in selected_rows:
                self.confirmation_states[row] = {
                    'status': self.STATUS_ABNORMAL,
                    'confirm_time': current_time,
                    'note': note
                }
            
            self._update_display()
        
    def add_note(self):
        """添加备注"""
        selected_rows = self._get_selected_rows()
        
        if not selected_rows:
            QMessageBox.information(self, "提示", "请先选择要添加备注的项目")
            return
        
        # 如果只选中一行，显示现有备注
        existing_note = ''
        if len(selected_rows) == 1:
            row = selected_rows[0]
            existing_note = self.confirmation_states.get(row, {}).get('note', '')
        
        dialog = NoteDialog(self)
        dialog.setWindowTitle("添加备注")
        dialog.set_note(existing_note)
        
        if dialog.exec_() == QDialog.Accepted:
            note = dialog.get_note()
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M')
            
            for row in selected_rows:
                current_state = self.confirmation_states.get(row, {})
                current_status = current_state.get('status', self.STATUS_PENDING)
                
                # 如果还没有确认状态，设置为有备注
                if current_status == self.STATUS_PENDING:
                    new_status = self.STATUS_NOTE_ADDED
                else:
                    new_status = current_status
                
                self.confirmation_states[row] = {
                    'status': new_status,
                    'confirm_time': current_time,
                    'note': note
                }
            
            self._update_display()
        
    def _get_selected_rows(self) -> List[int]:
        """获取选中的行"""
        selected_rows = set()
        for item in self.confirmation_table.selectedItems():
            selected_rows.add(item.row())
        return sorted(selected_rows)
        
    def _on_item_double_clicked(self, item: QTableWidgetItem):
        """双击项目时编辑备注"""
        row = item.row()
        
        # 获取现有备注
        existing_note = self.confirmation_states.get(row, {}).get('note', '')
        
        dialog = NoteDialog(self)
        dialog.setWindowTitle("编辑备注")
        dialog.set_note(existing_note)
        
        if dialog.exec_() == QDialog.Accepted:
            note = dialog.get_note()
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M')
            
            current_state = self.confirmation_states.get(row, {})
            current_status = current_state.get('status', self.STATUS_PENDING)
            
            # 如果还没有确认状态，设置为有备注
            if current_status == self.STATUS_PENDING:
                new_status = self.STATUS_NOTE_ADDED
            else:
                new_status = current_status
            
            self.confirmation_states[row] = {
                'status': new_status,
                'confirm_time': current_time,
                'note': note
            }
            
            self._update_display()
        
    def get_confirmation_states(self) -> Dict[int, Dict[str, Any]]:
        """获取确认状态"""
        return self.confirmation_states.copy()
        
    def set_confirmation_states(self, states: Dict[int, Dict[str, Any]]):
        """设置确认状态"""
        self.confirmation_states = states.copy()
        self._update_display()
        
    def clear(self):
        """清空数据"""
        self.items = []
        self.confirmation_states = {}
        self.confirmation_table.setRowCount(0)
        self.pending_label.setText("待确认: 0")
        self.confirmed_label.setText("已确认: 0")
        self.abnormal_label.setText("标记异常: 0")


class NoteDialog(QDialog):
    """
    备注对话框
    """
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.setWindowTitle("添加备注")
        self.setMinimumWidth(400)
        self.setMinimumHeight(200)
        
        layout = QVBoxLayout(self)
        
        # 备注输入
        form_layout = QFormLayout()
        
        self.note_text = QTextEdit()
        self.note_text.setPlaceholderText("请输入备注内容...")
        form_layout.addRow("备注:", self.note_text)
        
        layout.addLayout(form_layout)
        
        # 按钮
        button_box = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        
        layout.addWidget(button_box)
        
    def set_note(self, note: str):
        """设置备注"""
        self.note_text.setPlainText(note)
        
    def get_note(self) -> str:
        """获取备注"""
        return self.note_text.toPlainText().strip()
