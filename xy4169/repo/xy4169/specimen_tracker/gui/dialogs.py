"""对话框模块

实现各种交互对话框：
- 登记对话框
- 复核对话框
- 延迟对话框
- 拍照确认对话框
- 电话备注对话框
"""

from datetime import datetime, timedelta
from typing import Optional

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLabel, QLineEdit, QSpinBox, QComboBox, QCheckBox,
    QTextEdit, QPushButton, QDialogButtonBox, QGroupBox,
    QDateTimeEdit, QMessageBox
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from ..models import (
    Specimen, SpecimenStatus, SpecimenEvent, EventType,
    Anomaly, AnomalyType, Patient
)
from ..database import DatabaseManager
from ..state_machine import StateMachine, StateTransitionError


class RegisterDialog(QDialog):
    """标本登记对话框"""
    
    def __init__(self, db_manager: DatabaseManager, initial_no: str = "", parent=None):
        super().__init__(parent)
        self._db = db_manager
        self._initial_no = initial_no
        
        self.setWindowTitle("标本登记")
        self.setMinimumWidth(500)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self._specimen_no_edit = QLineEdit(self._initial_no)
        self._specimen_no_edit.setPlaceholderText("例如: BD202605020001")
        form_layout.addRow("标本号 *:", self._specimen_no_edit)
        
        self._patient_name_edit = QLineEdit()
        form_layout.addRow("患者姓名 *:", self._patient_name_edit)
        
        self._patient_id_edit = QLineEdit()
        self._patient_id_edit.setPlaceholderText("可选")
        form_layout.addRow("患者ID:", self._patient_id_edit)
        
        self._location_edit = QLineEdit()
        self._location_edit.setPlaceholderText("例如: 左侧甲状腺")
        form_layout.addRow("部位 *:", self._location_edit)
        
        self._specimen_type_combo = QComboBox()
        self._specimen_type_combo.addItems(["冰冻切片", "快速石蜡", "术中快速"])
        form_layout.addRow("标本类型:", self._specimen_type_combo)
        
        self._operation_room_edit = QLineEdit()
        self._operation_room_edit.setPlaceholderText("例如: 手术室1")
        form_layout.addRow("手术间:", self._operation_room_edit)
        
        self._surgeon_edit = QLineEdit()
        form_layout.addRow("手术医师:", self._surgeon_edit)
        
        self._urgent_level_combo = QComboBox()
        self._urgent_level_combo.addItems(["常规", "急诊"])
        form_layout.addRow("紧急程度:", self._urgent_level_combo)
        
        layout.addLayout(form_layout)
        
        material_group = QGroupBox("材料核对")
        material_layout = QHBoxLayout(material_group)
        
        self._has_specimen_bag_check = QCheckBox("已收到标本袋")
        material_layout.addWidget(self._has_specimen_bag_check)
        
        self._has_csv_check = QCheckBox("已收到申请单CSV")
        material_layout.addWidget(self._has_csv_check)
        
        material_layout.addStretch()
        layout.addWidget(material_group)
        
        layout.addSpacing(20)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _on_accept(self):
        specimen_no = self._specimen_no_edit.text().strip()
        patient_name = self._patient_name_edit.text().strip()
        location = self._location_edit.text().strip()
        
        if not specimen_no:
            QMessageBox.warning(self, "提示", "请输入标本号")
            return
        
        if not patient_name:
            QMessageBox.warning(self, "提示", "请输入患者姓名")
            return
        
        if not location:
            QMessageBox.warning(self, "提示", "请输入部位")
            return
        
        existing = self._db.get_specimen_by_no(specimen_no)
        if existing:
            QMessageBox.warning(self, "提示", f"标本号 '{specimen_no}' 已存在")
            return
        
        patient_id = self._patient_id_edit.text().strip()
        if patient_id:
            patient = self._db.get_patient_by_id(patient_id)
            if not patient:
                patient = Patient(
                    patient_id=patient_id,
                    name=patient_name,
                )
                self._db.save_patient(patient)
        
        specimen = Specimen(
            specimen_no=specimen_no,
            patient_id=patient_id,
            patient_name=patient_name,
            location=location,
            specimen_type=self._specimen_type_combo.currentText(),
            operation_room=self._operation_room_edit.text().strip(),
            surgeon=self._surgeon_edit.text().strip(),
            urgent_level=self._urgent_level_combo.currentText(),
            has_specimen_bag=self._has_specimen_bag_check.isChecked(),
            has_csv=self._has_csv_check.isChecked(),
            status=SpecimenStatus.REGISTERED,
            registered_at=datetime.now(),
            due_time=datetime.now() + timedelta(minutes=30),
        )
        
        self._db.save_specimen(specimen)
        
        if specimen.id:
            event = SpecimenEvent(
                specimen_id=specimen.id,
                event_type=EventType.REGISTER,
                description=f"标本登记: {specimen_no}",
                operator="值班员",
                event_time=datetime.now(),
            )
            self._db.save_event(event)
        
        self.accept()


class ReviewDialog(QDialog):
    """复核对话框"""
    
    def __init__(self, specimen: Specimen, db_manager: DatabaseManager, parent=None):
        super().__init__(parent)
        self._specimen = specimen
        self._db = db_manager
        self._state_machine = StateMachine()
        
        self.setWindowTitle("复核签名")
        self.setMinimumWidth(450)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        
        info_label = QLabel(f"标本: {self._specimen.specimen_no}\n患者: {self._specimen.patient_name}")
        info_font = info_label.font()
        info_font.setBold(True)
        info_label.setFont(info_font)
        layout.addWidget(info_label)
        
        layout.addSpacing(10)
        
        form_layout = QFormLayout()
        
        self._reviewer_edit = QLineEdit()
        self._reviewer_edit.setPlaceholderText("请输入复核人姓名")
        form_layout.addRow("复核人签名 *:", self._reviewer_edit)
        
        self._remark_edit = QTextEdit()
        self._remark_edit.setPlaceholderText("复核意见（可选）")
        self._remark_edit.setMaximumHeight(100)
        form_layout.addRow("复核意见:", self._remark_edit)
        
        layout.addLayout(form_layout)
        
        layout.addSpacing(20)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _on_accept(self):
        reviewer = self._reviewer_edit.text().strip()
        if not reviewer:
            QMessageBox.warning(self, "提示", "请输入复核人姓名")
            return
        
        try:
            event = self._state_machine.transition(
                self._specimen, SpecimenStatus.REVIEWED,
                operator=reviewer,
                description="复核通过"
            )
            
            self._specimen.reviewed_by = reviewer
            self._specimen.reviewed_at = datetime.now()
            
            remark = self._remark_edit.toPlainText().strip()
            if remark:
                event.details = remark
            
            self._db.save_specimen(self._specimen)
            if self._specimen.id:
                event.specimen_id = self._specimen.id
                self._db.save_event(event)
            
            self.accept()
            
        except StateTransitionError as e:
            QMessageBox.critical(self, "错误", str(e))


class DelayDialog(QDialog):
    """延迟标记对话框"""
    
    def __init__(self, specimen: Specimen, db_manager: DatabaseManager,
                 state_machine: StateMachine, parent=None):
        super().__init__(parent)
        self._specimen = specimen
        self._db = db_manager
        self._state_machine = state_machine
        
        self.setWindowTitle("标记延迟")
        self.setMinimumWidth(450)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        
        info_label = QLabel(
            f"标本: {self._specimen.specimen_no}\n"
            f"患者: {self._specimen.patient_name}\n"
            f"当前状态: {self._specimen.status.value}"
        )
        info_font = info_label.font()
        info_font.setBold(True)
        info_label.setFont(info_font)
        layout.addWidget(info_label)
        
        layout.addSpacing(10)
        
        form_layout = QFormLayout()
        
        self._reason_edit = QTextEdit()
        self._reason_edit.setPlaceholderText("请输入延迟原因")
        self._reason_edit.setMaximumHeight(120)
        form_layout.addRow("延迟原因 *:", self._reason_edit)
        
        self._new_due_time_edit = QDateTimeEdit()
        self._new_due_time_edit.setDateTime(datetime.now() + timedelta(minutes=30))
        self._new_due_time_edit.setCalendarPopup(True)
        form_layout.addRow("新截止时间:", self._new_due_time_edit)
        
        layout.addLayout(form_layout)
        
        layout.addSpacing(20)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _on_accept(self):
        reason = self._reason_edit.toPlainText().strip()
        if not reason:
            QMessageBox.warning(self, "提示", "请输入延迟原因")
            return
        
        try:
            event = self._state_machine.transition(
                self._specimen, SpecimenStatus.DELAYED,
                operator="值班员",
                description=f"标记延迟: {reason}"
            )
            
            new_due_time = self._new_due_time_edit.dateTime().toPyDateTime()
            self._specimen.due_time = new_due_time
            
            self._db.save_specimen(self._specimen)
            if self._specimen.id:
                event.specimen_id = self._specimen.id
                self._db.save_event(event)
            
            self.accept()
            
        except StateTransitionError as e:
            QMessageBox.critical(self, "错误", str(e))


class PhotoConfirmDialog(QDialog):
    """拍照确认对话框"""
    
    def __init__(self, specimen_id: int, db_manager: DatabaseManager, parent=None):
        super().__init__(parent)
        self._specimen_id = specimen_id
        self._db = db_manager
        
        self._specimen = db_manager.get_specimen_by_id(specimen_id)
        
        self.setWindowTitle("拍照确认")
        self.setMinimumWidth(400)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        
        if self._specimen:
            info_label = QLabel(
                f"标本: {self._specimen.specimen_no}\n"
                f"患者: {self._specimen.patient_name}\n"
                f"当前照片数: {self._specimen.photo_count}"
            )
        else:
            info_label = QLabel("标本信息加载失败")
        
        info_font = info_label.font()
        info_font.setBold(True)
        info_label.setFont(info_font)
        layout.addWidget(info_label)
        
        layout.addSpacing(10)
        
        form_layout = QFormLayout()
        
        self._photo_count_spin = QSpinBox()
        self._photo_count_spin.setRange(0, 99)
        if self._specimen:
            self._photo_count_spin.setValue(self._specimen.photo_count)
        else:
            self._photo_count_spin.setValue(1)
        form_layout.addRow("照片数量:", self._photo_count_spin)
        
        self._mark_complete_check = QCheckBox("标记拍照完成")
        if self._specimen and self._specimen.photo_count > 0:
            self._mark_complete_check.setChecked(True)
        form_layout.addRow("", self._mark_complete_check)
        
        layout.addLayout(form_layout)
        
        layout.addSpacing(20)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _on_accept(self):
        if not self._specimen:
            QMessageBox.critical(self, "错误", "标本信息无效")
            self.reject()
            return
        
        photo_count = self._photo_count_spin.value()
        self._specimen.photo_count = photo_count
        
        if self._mark_complete_check.isChecked() and photo_count > 0:
            self._specimen.status = SpecimenStatus.PHOTO_COMPLETE
            
            if self._specimen.id:
                event = SpecimenEvent(
                    specimen_id=self._specimen.id,
                    event_type=EventType.PHOTOGRAPH,
                    description=f"完成拍照 {photo_count} 张",
                    operator="值班员",
                    event_time=datetime.now(),
                )
                self._db.save_event(event)
        
        self._db.save_specimen(self._specimen)
        self.accept()


class PhoneRemarkDialog(QDialog):
    """电话备注对话框"""
    
    def __init__(self, specimen: Specimen, db_manager: DatabaseManager, parent=None):
        super().__init__(parent)
        self._specimen = specimen
        self._db = db_manager
        
        self.setWindowTitle("术中电话备注")
        self.setMinimumWidth(450)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        
        info_label = QLabel(
            f"标本: {self._specimen.specimen_no}\n"
            f"患者: {self._specimen.patient_name}"
        )
        info_font = info_label.font()
        info_font.setBold(True)
        info_label.setFont(info_font)
        layout.addWidget(info_label)
        
        if self._specimen.phone_remark:
            existing_label = QLabel(f"\n现有备注:\n{self._specimen.phone_remark}")
            existing_label.setStyleSheet("color: #666;")
            layout.addWidget(existing_label)
        
        layout.addSpacing(10)
        
        form_layout = QFormLayout()
        
        self._remark_edit = QTextEdit()
        self._remark_edit.setPlaceholderText("请输入术中电话沟通内容")
        self._remark_edit.setMaximumHeight(150)
        form_layout.addRow("电话内容 *:", self._remark_edit)
        
        layout.addLayout(form_layout)
        
        layout.addSpacing(20)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _on_accept(self):
        remark = self._remark_edit.toPlainText().strip()
        if not remark:
            QMessageBox.warning(self, "提示", "请输入电话内容")
            return
        
        self._specimen.phone_remark = remark
        self._db.save_specimen(self._specimen)
        
        if self._specimen.id:
            event = SpecimenEvent(
                specimen_id=self._specimen.id,
                event_type=EventType.PHONE_CALL,
                description=remark,
                operator="值班员",
                event_time=datetime.now(),
            )
            self._db.save_event(event)
        
        self.accept()


class ExportDialog(QDialog):
    """导出选项对话框"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.setWindowTitle("导出选项")
        self.setMinimumWidth(400)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        
        label = QLabel("选择导出格式:")
        layout.addWidget(label)
        
        self._format_combo = QComboBox()
        self._format_combo.addItems([
            "Markdown 交接班记录",
            "CSV 异常表",
            "JSON 审计包",
        ])
        layout.addWidget(self._format_combo)
        
        layout.addSpacing(20)
        
        self._include_released_check = QCheckBox("包含已放行的标本")
        self._include_released_check.setChecked(False)
        layout.addWidget(self._include_released_check)
        
        layout.addSpacing(20)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    @property
    def export_format(self) -> str:
        return self._format_combo.currentText()
    
    @property
    def include_released(self) -> bool:
        return self._include_released_check.isChecked()
