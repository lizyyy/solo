from datetime import date
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QTextEdit, QPushButton, QFormLayout, QDialogButtonBox,
    QComboBox, QDateEdit, QMessageBox, QGroupBox
)
from PyQt6.QtCore import Qt, QDate

from models.order import Order
from models.patient import Patient
from core.patient_repository import PatientRepository
from core.order_repository import OrderRepository
from config.settings import get_settings


class OrderDialog(QDialog):
    def __init__(self, parent=None, order: Order = None):
        super().__init__(parent)
        
        self.order = order
        self.settings = get_settings()
        self.patient_repo = PatientRepository()
        self.order_repo = OrderRepository()
        
        self.setWindowTitle("新建订单" if order is None else "编辑订单")
        self.setMinimumWidth(500)
        self._create_ui()
        
        if order:
            self._load_order(order)
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        patient_group = QGroupBox("患者信息")
        patient_layout = QFormLayout(patient_group)
        
        self.patient_combo = QComboBox()
        self.patient_combo.setEditable(True)
        self._load_patients()
        patient_layout.addRow("患者:", self.patient_combo)
        
        new_patient_btn = QPushButton("新建患者")
        new_patient_btn.clicked.connect(self._new_patient)
        patient_layout.addRow("", new_patient_btn)
        
        layout.addWidget(patient_group)
        
        order_group = QGroupBox("订单信息")
        order_layout = QFormLayout(order_group)
        
        self.order_number_edit = QLineEdit()
        self.order_number_edit.setText(self._generate_order_number())
        order_layout.addRow("订单号 *:", self.order_number_edit)
        
        self.body_part_edit = QLineEdit()
        self.body_part_edit.setPlaceholderText("例如：小腿假肢、大腿矫形器")
        order_layout.addRow("诊断部位 *:", self.body_part_edit)
        
        self.side_combo = QComboBox()
        self.side_combo.addItems(self.settings.side_enum)
        order_layout.addRow("左右侧 *:", self.side_combo)
        
        self.status_combo = QComboBox()
        self.status_combo.addItems(self.settings.status_enum)
        self.status_combo.setCurrentText("待取模")
        order_layout.addRow("状态:", self.status_combo)
        
        self.impression_date_edit = QDateEdit()
        self.impression_date_edit.setCalendarPopup(True)
        self.impression_date_edit.setDate(QDate.currentDate())
        order_layout.addRow("取模日期:", self.impression_date_edit)
        
        self.technician_edit = QLineEdit()
        self.technician_edit.setPlaceholderText("负责技师姓名")
        order_layout.addRow("技师:", self.technician_edit)
        
        self.follow_up_date_edit = QDateEdit()
        self.follow_up_date_edit.setCalendarPopup(True)
        self.follow_up_date_edit.setSpecialValueText("未设置")
        self.follow_up_date_edit.setDate(QDate.fromString("2000-01-01", "yyyy-MM-dd"))
        order_layout.addRow("复诊日期:", self.follow_up_date_edit)
        
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("备注信息")
        self.notes_edit.setMaximumHeight(80)
        order_layout.addRow("备注:", self.notes_edit)
        
        layout.addWidget(order_group)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(self._validate_and_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _load_patients(self):
        self.patient_combo.clear()
        patients = self.patient_repo.get_all()
        for patient in patients:
            display = f"{patient.name}"
            if patient.phone:
                display += f" ({patient.phone})"
            self.patient_combo.addItem(display, patient.id)
    
    def _generate_order_number(self) -> str:
        today = date.today()
        date_str = today.strftime("%Y%m%d")
        
        existing = self.order_repo.get_all_order_numbers()
        today_orders = [o for o in existing if o.startswith(date_str)]
        
        seq = len(today_orders) + 1
        return f"{date_str}{seq:04d}"
    
    def _load_order(self, order: Order):
        self.order_number_edit.setText(order.order_number)
        self.body_part_edit.setText(order.body_part)
        self.side_combo.setCurrentText(order.side)
        self.status_combo.setCurrentText(order.status)
        
        if order.impression_date:
            self.impression_date_edit.setDate(QDate(order.impression_date.year, order.impression_date.month, order.impression_date.day))
        
        self.technician_edit.setText(order.technician or "")
        
        if order.follow_up_date:
            self.follow_up_date_edit.setDate(QDate(order.follow_up_date.year, order.follow_up_date.month, order.follow_up_date.day))
        
        self.notes_edit.setPlainText(order.notes or "")
        
        for i in range(self.patient_combo.count()):
            if self.patient_combo.itemData(i) == order.patient_id:
                self.patient_combo.setCurrentIndex(i)
                break
    
    def _new_patient(self):
        from ui.dialogs.patient_dialog import PatientDialog
        dialog = PatientDialog(self)
        if dialog.exec() == PatientDialog.DialogCode.Accepted:
            patient = dialog.get_patient()
            patient = self.patient_repo.create(patient)
            self._load_patients()
            for i in range(self.patient_combo.count()):
                if self.patient_combo.itemData(i) == patient.id:
                    self.patient_combo.setCurrentIndex(i)
                    break
    
    def _validate_and_accept(self):
        patient_id = self.patient_combo.currentData()
        if patient_id is None:
            QMessageBox.warning(self, "验证失败", "请选择患者")
            return
        
        order_number = self.order_number_edit.text().strip()
        if not order_number:
            QMessageBox.warning(self, "验证失败", "请输入订单号")
            self.order_number_edit.setFocus()
            return
        
        body_part = self.body_part_edit.text().strip()
        if not body_part:
            QMessageBox.warning(self, "验证失败", "请输入诊断部位")
            self.body_part_edit.setFocus()
            return
        
        if self.order is None:
            existing = self.order_repo.get_by_order_number(order_number)
            if existing:
                QMessageBox.warning(self, "验证失败", f"订单号 \"{order_number}\" 已存在")
                self.order_number_edit.setFocus()
                return
        
        self.accept()
    
    def get_order(self) -> Order:
        impression_date = None
        if self.impression_date_edit.date().isValid():
            qdate = self.impression_date_edit.date()
            impression_date = date(qdate.year(), qdate.month(), qdate.day())
        
        follow_up_date = None
        if self.follow_up_date_edit.date().year() >= 2000:
            qdate = self.follow_up_date_edit.date()
            follow_up_date = date(qdate.year(), qdate.month(), qdate.day())
        
        return Order(
            id=self.order.id if self.order else None,
            patient_id=self.patient_combo.currentData(),
            order_number=self.order_number_edit.text().strip(),
            body_part=self.body_part_edit.text().strip(),
            side=self.side_combo.currentText(),
            status=self.status_combo.currentText(),
            impression_date=impression_date,
            technician=self.technician_edit.text().strip() or None,
            follow_up_date=follow_up_date,
            notes=self.notes_edit.toPlainText().strip() or None
        )
