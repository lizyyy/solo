from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QTextEdit, QPushButton, QFormLayout, QDialogButtonBox, QMessageBox
)
from PyQt6.QtCore import Qt

from models.patient import Patient
from core.workflow.order_validator import OrderValidator


class PatientDialog(QDialog):
    def __init__(self, parent=None, patient: Patient = None):
        super().__init__(parent)
        
        self.patient = patient
        self.validator = OrderValidator()
        
        self.setWindowTitle("新建患者" if patient is None else "编辑患者")
        self.setMinimumWidth(400)
        self._create_ui()
        
        if patient:
            self._load_patient(patient)
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("请输入患者姓名")
        form_layout.addRow("姓名 *:", self.name_edit)
        
        self.phone_edit = QLineEdit()
        self.phone_edit.setPlaceholderText("请输入联系电话")
        form_layout.addRow("电话:", self.phone_edit)
        
        self.id_card_edit = QLineEdit()
        self.id_card_edit.setPlaceholderText("请输入身份证号（选填）")
        form_layout.addRow("身份证号:", self.id_card_edit)
        
        self.diagnosis_edit = QLineEdit()
        self.diagnosis_edit.setPlaceholderText("请输入诊断信息（选填）")
        form_layout.addRow("诊断:", self.diagnosis_edit)
        
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("请输入备注信息（选填）")
        self.notes_edit.setMaximumHeight(100)
        form_layout.addRow("备注:", self.notes_edit)
        
        layout.addLayout(form_layout)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(self._validate_and_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _load_patient(self, patient: Patient):
        self.name_edit.setText(patient.name or "")
        self.phone_edit.setText(patient.phone or "")
        self.id_card_edit.setText(patient.id_card or "")
        self.diagnosis_edit.setText(patient.diagnosis or "")
        self.notes_edit.setPlainText(patient.notes or "")
    
    def _validate_and_accept(self):
        name = self.name_edit.text().strip()
        
        if not name:
            QMessageBox.warning(self, "验证失败", "请输入患者姓名")
            self.name_edit.setFocus()
            return
        
        phone = self.phone_edit.text().strip()
        if phone:
            phone_errors = self.validator.validate_phone(phone)
            if phone_errors:
                QMessageBox.warning(self, "提示", phone_errors[0].message)
        
        self.accept()
    
    def get_patient(self) -> Patient:
        return Patient(
            id=self.patient.id if self.patient else None,
            name=self.name_edit.text().strip(),
            phone=self.phone_edit.text().strip() or None,
            id_card=self.id_card_edit.text().strip() or None,
            diagnosis=self.diagnosis_edit.text().strip() or None,
            notes=self.notes_edit.toPlainText().strip() or None
        )
