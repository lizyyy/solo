from datetime import date
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLabel, QLineEdit,
    QTextEdit, QPushButton, QDialogButtonBox, QDateEdit,
    QMessageBox, QGroupBox, QComboBox
)
from PyQt6.QtCore import Qt, QDate

from models.rework_record import ReworkRecord
from models.fitting_record import FittingRecord
from core.rework_repository import ReworkRecordRepository
from core.fitting_repository import FittingRecordRepository


class ReworkDialog(QDialog):
    def __init__(self, parent=None, order_id: int = None, rework_record: ReworkRecord = None):
        super().__init__(parent)
        
        self.order_id = order_id
        self.rework_record = rework_record
        self.repo = ReworkRecordRepository()
        self.fitting_repo = FittingRecordRepository()
        
        self.setWindowTitle("创建返修记录" if rework_record is None else f"编辑返修记录")
        self.setMinimumWidth(450)
        self._create_ui()
        
        if rework_record:
            self._load_rework_record(rework_record)
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        info_group = QGroupBox("返修信息")
        info_layout = QFormLayout(info_group)
        
        self.fitting_combo = QComboBox()
        self._load_fitting_records()
        info_layout.addRow("关联试穿记录 *:", self.fitting_combo)
        
        self.rework_date_edit = QDateEdit()
        self.rework_date_edit.setCalendarPopup(True)
        self.rework_date_edit.setDate(QDate.currentDate())
        info_layout.addRow("返修日期 *:", self.rework_date_edit)
        
        self.technician_edit = QLineEdit()
        self.technician_edit.setPlaceholderText("负责返修的技师姓名")
        info_layout.addRow("技师:", self.technician_edit)
        
        layout.addWidget(info_group)
        
        reason_group = QGroupBox("返修原因")
        reason_layout = QFormLayout(reason_group)
        
        self.reason_combo = QComboBox()
        self.reason_combo.setEditable(True)
        self.reason_combo.addItems([
            "尺寸不合适",
            "压力不均",
            "重量问题",
            "外观问题",
            "功能问题",
            "其他原因"
        ])
        reason_layout.addRow("返修原因 *:", self.reason_combo)
        
        self.details_edit = QTextEdit()
        self.details_edit.setPlaceholderText("详细描述返修原因和需要调整的内容")
        self.details_edit.setMinimumHeight(100)
        reason_layout.addRow("详细说明:", self.details_edit)
        
        layout.addWidget(reason_group)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(self._validate_and_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _load_fitting_records(self):
        self.fitting_combo.clear()
        
        if self.order_id:
            fittings = self.fitting_repo.get_by_order(self.order_id)
            for f in fittings:
                display = f"试穿 #{f.id} - {f.fitting_date or '未知日期'}"
                if f.technician:
                    display += f" ({f.technician})"
                self.fitting_combo.addItem(display, f.id)
            
            if fittings:
                self.fitting_combo.setCurrentIndex(len(fittings) - 1)
    
    def _load_rework_record(self, record: ReworkRecord):
        for i in range(self.fitting_combo.count()):
            if self.fitting_combo.itemData(i) == record.fitting_record_id:
                self.fitting_combo.setCurrentIndex(i)
                break
        
        if record.rework_date:
            self.rework_date_edit.setDate(QDate(
                record.rework_date.year,
                record.rework_date.month,
                record.rework_date.day
            ))
        
        self.technician_edit.setText(record.technician or "")
        self.reason_combo.setCurrentText(record.rework_reason or "")
        self.details_edit.setPlainText(record.rework_details or "")
    
    def _validate_and_accept(self):
        if self.fitting_combo.currentData() is None:
            QMessageBox.warning(self, "验证失败", "请选择关联的试穿记录（返修必须有试穿记录）")
            return
        
        if not self.reason_combo.currentText().strip():
            QMessageBox.warning(self, "验证失败", "请输入返修原因")
            self.reason_combo.setFocus()
            return
        
        self.accept()
    
    def get_rework_record(self) -> ReworkRecord:
        rework_date = None
        if self.rework_date_edit.date().isValid():
            qdate = self.rework_date_edit.date()
            rework_date = date(qdate.year(), qdate.month(), qdate.day())
        
        return ReworkRecord(
            id=self.rework_record.id if self.rework_record else None,
            order_id=self.order_id,
            fitting_record_id=self.fitting_combo.currentData(),
            rework_reason=self.reason_combo.currentText().strip(),
            rework_details=self.details_edit.toPlainText().strip() or None,
            technician=self.technician_edit.text().strip() or None,
            rework_date=rework_date
        )
