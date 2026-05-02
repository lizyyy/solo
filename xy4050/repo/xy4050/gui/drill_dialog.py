import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLabel, QLineEdit, QTextEdit, QComboBox,
    QDateTimeEdit, QDialogButtonBox, QGroupBox, QSpinBox
)
from PyQt6.QtCore import Qt, QDateTime

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.drill import Drill, DrillStatus


class DrillDialog(QDialog):
    def __init__(self, parent=None, drill: Optional[Drill] = None):
        super().__init__(parent)
        self._drill = drill
        self._is_edit_mode = drill is not None
        
        if self._is_edit_mode:
            self.setWindowTitle("编辑演练档案")
        else:
            self.setWindowTitle("新建演练档案")
        
        self.setMinimumWidth(500)
        self._init_ui()
        
        if drill:
            self._load_drill_data()
    
    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        form_group = QGroupBox("基本信息")
        form_layout = QFormLayout(form_group)
        
        self._edit_name = QLineEdit()
        self._edit_name.setPlaceholderText("例如：2024年Q2消防疏散演练")
        form_layout.addRow("演练名称:", self._edit_name)
        
        self._edit_code = QLineEdit()
        self._edit_code.setPlaceholderText("例如：DRILL-2024-Q2-001")
        form_layout.addRow("演练编号:", self._edit_code)
        
        self._combo_type = QComboBox()
        self._combo_type.addItems([
            "消防疏散演练",
            "反恐应急演练",
            "医疗救援演练",
            "地震疏散演练",
            "火灾逃生演练",
            "化学泄漏演练",
            "其他"
        ])
        form_layout.addRow("演练类型:", self._combo_type)
        
        self._combo_status = QComboBox()
        for status in DrillStatus:
            self._combo_status.addItem(str(status), status)
        form_layout.addRow("演练状态:", self._combo_status)
        
        layout.addWidget(form_group)
        
        time_group = QGroupBox("时间设置")
        time_layout = QFormLayout(time_group)
        
        self._edit_planned_start = QDateTimeEdit()
        self._edit_planned_start.setCalendarPopup(True)
        self._edit_planned_start.setDateTime(QDateTime.currentDateTime())
        time_layout.addRow("计划开始:", self._edit_planned_start)
        
        self._edit_planned_end = QDateTimeEdit()
        self._edit_planned_end.setCalendarPopup(True)
        self._edit_planned_end.setDateTime(QDateTime.currentDateTime().addSecs(3600))
        time_layout.addRow("计划结束:", self._edit_planned_end)
        
        self._edit_actual_start = QDateTimeEdit()
        self._edit_actual_start.setCalendarPopup(True)
        self._edit_actual_start.setDateTime(QDateTime.currentDateTime())
        time_layout.addRow("实际开始:", self._edit_actual_start)
        
        self._edit_actual_end = QDateTimeEdit()
        self._edit_actual_end.setCalendarPopup(True)
        time_layout.addRow("实际结束:", self._edit_actual_end)
        
        layout.addWidget(time_group)
        
        desc_group = QGroupBox("演练描述")
        desc_layout = QVBoxLayout(desc_group)
        
        self._edit_description = QTextEdit()
        self._edit_description.setPlaceholderText(
            "描述演练的目的、参与人员、预设场景等信息...\n"
            "例如：本次消防疏散演练涉及办公楼A座和B座共15层，\n"
            "演练场景为10层会议室发生电气火灾，需要评估疏散效率..."
        )
        self._edit_description.setMaximumHeight(120)
        desc_layout.addWidget(self._edit_description)
        
        layout.addWidget(desc_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | 
            QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        
        layout.addWidget(buttons)
    
    def _load_drill_data(self):
        if not self._drill:
            return
        
        self._edit_name.setText(self._drill.name or "")
        self._edit_code.setText(self._drill.code or "")
        
        if self._drill.drill_type:
            idx = self._combo_type.findText(self._drill.drill_type)
            if idx >= 0:
                self._combo_type.setCurrentIndex(idx)
        
        for i in range(self._combo_status.count()):
            if self._combo_status.itemData(i) == self._drill.status:
                self._combo_status.setCurrentIndex(i)
                break
        
        if self._drill.planned_start_time:
            self._edit_planned_start.setDateTime(
                QDateTime(self._drill.planned_start_time)
            )
        if self._drill.planned_end_time:
            self._edit_planned_end.setDateTime(
                QDateTime(self._drill.planned_end_time)
            )
        if self._drill.actual_start_time:
            self._edit_actual_start.setDateTime(
                QDateTime(self._drill.actual_start_time)
            )
        if self._drill.actual_end_time:
            self._edit_actual_end.setDateTime(
                QDateTime(self._drill.actual_end_time)
            )
        
        if self._drill.description:
            self._edit_description.setPlainText(self._drill.description)
    
    def _on_accept(self):
        name = self._edit_name.text().strip()
        code = self._edit_code.text().strip()
        
        if not name:
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "提示", "请输入演练名称")
            return
        
        if not code:
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.warning(self, "提示", "请输入演练编号")
            return
        
        self.accept()
    
    def get_drill(self) -> Drill:
        drill = self._drill if self._drill else Drill()
        
        drill.name = self._edit_name.text().strip()
        drill.code = self._edit_code.text().strip()
        drill.drill_type = self._combo_type.currentText()
        
        status_data = self._combo_status.currentData()
        if status_data:
            drill.status = status_data
        
        drill.planned_start_time = self._edit_planned_start.dateTime().toPyDateTime()
        drill.planned_end_time = self._edit_planned_end.dateTime().toPyDateTime()
        drill.actual_start_time = self._edit_actual_start.dateTime().toPyDateTime()
        drill.actual_end_time = self._edit_actual_end.dateTime().toPyDateTime()
        
        drill.description = self._edit_description.toPlainText().strip() or None
        
        return drill
