from datetime import date
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLabel, QLineEdit,
    QTextEdit, QPushButton, QDialogButtonBox, QDateEdit,
    QMessageBox, QGroupBox
)
from PyQt6.QtCore import Qt, QDate

from models.fitting_record import FittingRecord
from core.fitting_repository import FittingRecordRepository


class FittingDialog(QDialog):
    def __init__(self, parent=None, order_id: int = None, fitting_record: FittingRecord = None):
        super().__init__(parent)
        
        self.order_id = order_id
        self.fitting_record = fitting_record
        self.repo = FittingRecordRepository()
        
        self.setWindowTitle("记录试穿" if fitting_record is None else f"编辑试穿记录")
        self.setMinimumWidth(450)
        self._create_ui()
        
        if fitting_record:
            self._load_fitting_record(fitting_record)
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        info_group = QGroupBox("试穿信息")
        info_layout = QFormLayout(info_group)
        
        self.fitting_date_edit = QDateEdit()
        self.fitting_date_edit.setCalendarPopup(True)
        self.fitting_date_edit.setDate(QDate.currentDate())
        info_layout.addRow("试穿日期 *:", self.fitting_date_edit)
        
        self.technician_edit = QLineEdit()
        self.technician_edit.setPlaceholderText("试穿技师姓名")
        info_layout.addRow("技师:", self.technician_edit)
        
        layout.addWidget(info_group)
        
        feedback_group = QGroupBox("反馈与调整")
        feedback_layout = QFormLayout(feedback_group)
        
        self.feedback_edit = QTextEdit()
        self.feedback_edit.setPlaceholderText("患者反馈的问题和感受")
        self.feedback_edit.setMinimumHeight(80)
        feedback_layout.addRow("患者反馈:", self.feedback_edit)
        
        self.adjustments_edit = QTextEdit()
        self.adjustments_edit.setPlaceholderText("现场调整措施")
        self.adjustments_edit.setMinimumHeight(80)
        feedback_layout.addRow("调整措施:", self.adjustments_edit)
        
        layout.addWidget(feedback_group)
        
        followup_group = QGroupBox("复诊安排")
        followup_layout = QFormLayout(followup_group)
        
        self.next_follow_up_edit = QDateEdit()
        self.next_follow_up_edit.setCalendarPopup(True)
        self.next_follow_up_edit.setSpecialValueText("未安排")
        self.next_follow_up_edit.setDate(QDate.fromString("2000-01-01", "yyyy-MM-dd"))
        followup_layout.addRow("下次复诊:", self.next_follow_up_edit)
        
        layout.addWidget(followup_group)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(self._validate_and_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _load_fitting_record(self, record: FittingRecord):
        if record.fitting_date:
            self.fitting_date_edit.setDate(QDate(
                record.fitting_date.year,
                record.fitting_date.month,
                record.fitting_date.day
            ))
        
        self.technician_edit.setText(record.technician or "")
        self.feedback_edit.setPlainText(record.feedback or "")
        self.adjustments_edit.setPlainText(record.adjustments or "")
        
        if record.next_follow_up:
            self.next_follow_up_edit.setDate(QDate(
                record.next_follow_up.year,
                record.next_follow_up.month,
                record.next_follow_up.day
            ))
    
    def _validate_and_accept(self):
        if not self.fitting_date_edit.date().isValid():
            QMessageBox.warning(self, "验证失败", "请选择试穿日期")
            return
        
        self.accept()
    
    def get_fitting_record(self) -> FittingRecord:
        fitting_date = None
        if self.fitting_date_edit.date().isValid():
            qdate = self.fitting_date_edit.date()
            fitting_date = date(qdate.year(), qdate.month(), qdate.day())
        
        next_follow_up = None
        if self.next_follow_up_edit.date().year() >= 2000:
            qdate = self.next_follow_up_edit.date()
            next_follow_up = date(qdate.year(), qdate.month(), qdate.day())
        
        return FittingRecord(
            id=self.fitting_record.id if self.fitting_record else None,
            order_id=self.order_id,
            fitting_date=fitting_date,
            technician=self.technician_edit.text().strip() or None,
            feedback=self.feedback_edit.toPlainText().strip() or None,
            adjustments=self.adjustments_edit.toPlainText().strip() or None,
            next_follow_up=next_follow_up
        )
