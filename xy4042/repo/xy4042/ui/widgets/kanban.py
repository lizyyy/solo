from typing import List, Optional, Dict
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QScrollArea, QMessageBox, QMenu
)
from PyQt6.QtCore import Qt, pyqtSignal, QMimeData
from PyQt6.QtGui import QDrag, QAction, QPainter, QColor, QPen

from models.order import Order
from models.patient import Patient
from core.order_repository import OrderRepository
from core.patient_repository import PatientRepository
from core.workflow.state_machine import StateMachine


class KanbanCard(QFrame):
    STATUS_CONFIG = {
        "待取模": {"color": "#2196f3", "bg_color": "#e3f2fd"},
        "待设计": {"color": "#ff9800", "bg_color": "#fff3e0"},
        "制作中": {"color": "#ffc107", "bg_color": "#fff9c4"},
        "待试穿": {"color": "#4caf50", "bg_color": "#e8f5e9"},
        "需返修": {"color": "#f44336", "bg_color": "#ffebee"},
        "已交付": {"color": "#9e9e9e", "bg_color": "#f5f5f5"}
    }
    
    def __init__(self, order: Order, patient: Optional[Patient], parent=None):
        super().__init__(parent)
        
        self.order = order
        self.patient = patient
        self.setFixedHeight(80)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        
        self._setup_ui()
        self._setup_drag()
    
    def _setup_ui(self):
        config = self.STATUS_CONFIG.get(self.order.status, self.STATUS_CONFIG["待取模"])
        
        self.setStyleSheet(f"""
            KanbanCard {{
                background-color: {config['bg_color']};
                border-left: 4px solid {config['color']};
                border-radius: 4px;
                margin: 2px;
            }}
            KanbanCard:hover {{
                background-color: #ffffff;
                border: 1px solid {config['color']};
            }}
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.setSpacing(2)
        
        top_layout = QHBoxLayout()
        
        order_label = QLabel(self.order.order_number)
        order_label.setStyleSheet("font-weight: bold; font-size: 11px;")
        top_layout.addWidget(order_label)
        
        top_layout.addStretch()
        
        status_label = QLabel(self.order.status)
        status_label.setStyleSheet(f"color: {config['color']}; font-size: 10px;")
        top_layout.addWidget(status_label)
        
        layout.addLayout(top_layout)
        
        patient_name = self.patient.name if self.patient else "未知"
        patient_label = QLabel(f"{patient_name} - {self.order.body_part}")
        patient_label.setStyleSheet("font-size: 11px;")
        layout.addWidget(patient_label)
        
        side_label = QLabel(f"{self.order.side} | {self.order.technician or '未分配'}")
        side_label.setStyleSheet("font-size: 10px; color: #666;")
        layout.addWidget(side_label)
    
    def _setup_drag(self):
        self.setAcceptDrops(False)
    
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            drag = QDrag(self)
            mime_data = QMimeData()
            mime_data.setData("application/order-id", str(self.order.id).encode())
            mime_data.setData("application/order-status", self.order.status.encode())
            drag.setMimeData(mime_data)
            
            pixmap = self.grab()
            drag.setPixmap(pixmap)
            drag.setHotSpot(event.position().toPoint())
            
            drag.exec(Qt.DropAction.MoveAction)


class KanbanColumn(QFrame):
    order_dropped = pyqtSignal(int, str)
    order_selected = pyqtSignal(int)
    
    def __init__(self, status: str, parent=None):
        super().__init__(parent)
        
        self.status = status
        self.setAcceptDrops(True)
        self.setMinimumWidth(220)
        
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        
        header = QFrame()
        header.setFixedHeight(36)
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(8, 4, 8, 4)
        
        self.title_label = QLabel(self.status)
        self.title_label.setStyleSheet("font-weight: bold; font-size: 13px;")
        header_layout.addWidget(self.title_label)
        
        self.count_label = QLabel("0")
        self.count_label.setStyleSheet("""
            background-color: #e0e0e0;
            border-radius: 10px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: bold;
        """)
        header_layout.addWidget(self.count_label)
        
        layout.addWidget(header)
        
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("QScrollArea { border: none; }")
        
        scroll_content = QWidget()
        self.cards_layout = QVBoxLayout(scroll_content)
        self.cards_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.cards_layout.setSpacing(2)
        
        scroll_area.setWidget(scroll_content)
        layout.addWidget(scroll_area)
        
        self.setStyleSheet(f"""
            KanbanColumn {{
                background-color: #fafafa;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
            }}
        """)
    
    def add_card(self, card: KanbanCard):
        self.cards_layout.addWidget(card)
        card.order_selected.connect(self.order_selected)
        self._update_count()
    
    def clear(self):
        while self.cards_layout.count():
            item = self.cards_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self._update_count()
    
    def _update_count(self):
        count = self.cards_layout.count()
        self.count_label.setText(str(count))
    
    def dragEnterEvent(self, event):
        if event.mimeData().hasFormat("application/order-id"):
            event.acceptProposedAction()
    
    def dragMoveEvent(self, event):
        if event.mimeData().hasFormat("application/order-id"):
            event.acceptProposedAction()
    
    def dropEvent(self, event):
        if event.mimeData().hasFormat("application/order-id"):
            order_id = int(event.mimeData().data("application/order-id").data().decode())
            old_status = event.mimeData().data("application/order-status").data().decode()
            
            if old_status != self.status:
                self.order_dropped.emit(order_id, self.status)
            
            event.acceptProposedAction()


class KanbanWidget(QWidget):
    order_selected = pyqtSignal(int)
    order_status_changed = pyqtSignal(int, str)
    
    STATUSES = ["待取模", "待设计", "制作中", "待试穿", "需返修", "已交付"]
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.order_repo = OrderRepository()
        self.patient_repo = PatientRepository()
        self.state_machine = StateMachine()
        self.columns: Dict[str, KanbanColumn] = {}
        self.patients_cache: dict = {}
        
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        
        for status in self.STATUSES:
            column = KanbanColumn(status)
            column.order_selected.connect(self.order_selected)
            column.order_dropped.connect(self._on_order_dropped)
            self.columns[status] = column
            layout.addWidget(column)
    
    def set_orders(self, orders: List[Order]):
        self._load_patients(orders)
        
        for column in self.columns.values():
            column.clear()
        
        for order in orders:
            patient = self.patients_cache.get(order.patient_id)
            card = KanbanCard(order, patient)
            card.order_selected = self.order_selected
            
            if order.status in self.columns:
                self.columns[order.status].add_card(card)
    
    def _load_patients(self, orders: List[Order]):
        patient_ids = {o.patient_id for o in orders}
        self.patients_cache = {}
        for pid in patient_ids:
            patient = self.patient_repo.get_by_id(pid)
            if patient:
                self.patients_cache[pid] = patient
    
    def _on_order_dropped(self, order_id: int, new_status: str):
        order = self.order_repo.get_by_id(order_id)
        if not order:
            return
        
        if self.state_machine.can_transition(order.status, new_status):
            measurements = self._get_measurements(order_id)
            attachments = self._get_attachments(order_id)
            fittings = self._get_fittings(order_id)
            
            context = {
                "has_measurements": len(measurements) > 0,
                "has_images": any(a.is_image() for a in attachments),
                "has_scans": any(a.is_scan() for a in attachments),
                "has_fitting_record": len(fittings) > 0
            }
            
            result = self.state_machine.validate_transition(order, new_status, context)
            
            if result.success:
                self.order_status_changed.emit(order_id, new_status)
            else:
                QMessageBox.warning(self, "状态变更失败", "\n".join(result.errors))
        else:
            QMessageBox.warning(
                self, "状态变更失败",
                f"无法从 '{order.status}' 直接转换到 '{new_status}'"
            )
    
    def _get_measurements(self, order_id: int) -> List:
        from core.measurement_repository import MeasurementRepository
        repo = MeasurementRepository()
        return repo.get_by_order(order_id)
    
    def _get_attachments(self, order_id: int) -> List:
        from core.attachment_repository import AttachmentRepository
        repo = AttachmentRepository()
        return repo.get_by_order(order_id)
    
    def _get_fittings(self, order_id: int) -> List:
        from core.fitting_repository import FittingRecordRepository
        repo = FittingRecordRepository()
        return repo.get_by_order(order_id)
