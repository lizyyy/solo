from typing import List, Optional
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QListWidget, QListWidgetItem, QPushButton, QMessageBox,
    QMenu
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction

from models.order import Order
from models.patient import Patient
from core.order_repository import OrderRepository
from core.patient_repository import PatientRepository


class OrderListWidget(QWidget):
    order_selected = pyqtSignal(int)
    
    STATUS_COLORS = {
        "待取模": "#e3f2fd",
        "待设计": "#fff3e0",
        "制作中": "#fff9c4",
        "待试穿": "#e8f5e9",
        "需返修": "#ffebee",
        "已交付": "#f5f5f5"
    }
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.order_repo = OrderRepository()
        self.patient_repo = PatientRepository()
        self.orders: List[Order] = []
        self.patients_cache: dict = {}
        
        self._create_ui()
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        search_layout = QHBoxLayout()
        search_label = QLabel("搜索:")
        search_layout.addWidget(search_label)
        
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("输入订单号、患者名、部位...")
        self.search_edit.textChanged.connect(self._filter_orders)
        search_layout.addWidget(self.search_edit)
        
        layout.addLayout(search_layout)
        
        header_label = QLabel("订单列表")
        header_label.setStyleSheet("font-weight: bold; font-size: 14px; padding: 5px;")
        layout.addWidget(header_label)
        
        self.list_widget = QListWidget()
        self.list_widget.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.list_widget.customContextMenuRequested.connect(self._show_context_menu)
        self.list_widget.itemSelectionChanged.connect(self._on_selection_changed)
        layout.addWidget(self.list_widget)
    
    def set_orders(self, orders: List[Order]):
        self.orders = orders
        self._load_patients()
        self._filter_orders(self.search_edit.text())
    
    def _load_patients(self):
        patient_ids = {o.patient_id for o in self.orders}
        self.patients_cache = {}
        for pid in patient_ids:
            patient = self.patient_repo.get_by_id(pid)
            if patient:
                self.patients_cache[pid] = patient
    
    def _filter_orders(self, text: str):
        self.list_widget.clear()
        
        filtered = self.orders
        if text.strip():
            lower_text = text.lower()
            filtered = []
            for order in self.orders:
                patient = self.patients_cache.get(order.patient_id)
                patient_name = patient.name.lower() if patient else ""
                
                if (lower_text in order.order_number.lower() or
                    lower_text in order.body_part.lower() or
                    lower_text in patient_name or
                    lower_text in order.status):
                    filtered.append(order)
        
        for order in filtered:
            item = QListWidgetItem()
            item.setData(Qt.ItemDataRole.UserRole, order.id)
            
            patient = self.patients_cache.get(order.patient_id)
            patient_name = patient.name if patient else "未知患者"
            
            display_text = (
                f"{order.order_number}\n"
                f"  {patient_name} - {order.body_part} ({order.side})\n"
                f"  状态: {order.status}"
            )
            item.setText(display_text)
            
            color = self.STATUS_COLORS.get(order.status, "#ffffff")
            item.setBackground(Qt.GlobalColor.white if color == "#ffffff" else Qt.GlobalColor.white)
            
            self.list_widget.addItem(item)
    
    def _on_selection_changed(self):
        selected = self.list_widget.selectedItems()
        if selected:
            order_id = selected[0].data(Qt.ItemDataRole.UserRole)
            self.order_selected.emit(order_id)
    
    def _show_context_menu(self, pos):
        item = self.list_widget.itemAt(pos)
        if not item:
            return
        
        order_id = item.data(Qt.ItemDataRole.UserRole)
        
        menu = QMenu(self)
        
        view_action = QAction("查看详情", self)
        view_action.triggered.connect(lambda: self.order_selected.emit(order_id))
        menu.addAction(view_action)
        
        menu.addSeparator()
        
        delete_action = QAction("删除订单", self)
        delete_action.triggered.connect(lambda: self._delete_order(order_id))
        menu.addAction(delete_action)
        
        menu.exec(self.list_widget.mapToGlobal(pos))
    
    def _delete_order(self, order_id: int):
        reply = QMessageBox.question(
            self, "确认删除",
            "确定要删除这个订单吗？\n此操作不可恢复。",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self.order_repo.delete(order_id)
            self.orders = [o for o in self.orders if o.id != order_id]
            self._filter_orders(self.search_edit.text())
