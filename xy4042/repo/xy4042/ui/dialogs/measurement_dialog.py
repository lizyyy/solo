from datetime import date
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QTextEdit, QPushButton, QFormLayout, QDialogButtonBox,
    QSpinBox, QMessageBox, QScrollArea, QWidget, QGridLayout
)
from PyQt6.QtCore import Qt

from models.measurement import Measurement
from core.measurement_repository import MeasurementRepository


class MeasurementDialog(QDialog):
    def __init__(self, parent=None, order_id: int = None, measurement: Measurement = None):
        super().__init__(parent)
        
        self.order_id = order_id
        self.measurement = measurement
        self.repo = MeasurementRepository()
        
        self.setWindowTitle("新建尺寸记录" if measurement is None else f"编辑尺寸版本 {measurement.version}")
        self.setMinimumWidth(500)
        self._create_ui()
        
        if measurement:
            self._load_measurement(measurement)
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self.version_spin = QSpinBox()
        self.version_spin.setMinimum(1)
        self.version_spin.setMaximum(100)
        
        if self.order_id:
            existing = self.repo.get_by_order(self.order_id)
            self.version_spin.setValue(len(existing) + 1)
        
        form_layout.addRow("版本号:", self.version_spin)
        
        self.technician_edit = QLineEdit()
        self.technician_edit.setPlaceholderText("测量技师姓名")
        form_layout.addRow("技师:", self.technician_edit)
        
        layout.addLayout(form_layout)
        
        dimensions_label = QLabel("尺寸数据（键值对）:")
        layout.addWidget(dimensions_label)
        
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setMinimumHeight(200)
        
        dimensions_widget = QWidget()
        self.dimensions_layout = QGridLayout(dimensions_widget)
        self.dimensions_layout.setSpacing(5)
        
        self.dimension_rows = []
        self._add_dimension_row()
        
        scroll_area.setWidget(dimensions_widget)
        layout.addWidget(scroll_area)
        
        add_row_btn = QPushButton("+ 添加尺寸项")
        add_row_btn.clicked.connect(self._add_dimension_row)
        layout.addWidget(add_row_btn)
        
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("备注信息")
        self.notes_edit.setMaximumHeight(60)
        layout.addWidget(QLabel("备注:"))
        layout.addWidget(self.notes_edit)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(self._validate_and_accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _add_dimension_row(self):
        row_idx = len(self.dimension_rows)
        
        key_edit = QLineEdit()
        key_edit.setPlaceholderText("名称，如：大腿围度")
        
        value_edit = QLineEdit()
        value_edit.setPlaceholderText("数值，如：45cm")
        
        delete_btn = QPushButton("×")
        delete_btn.setMaximumWidth(30)
        delete_btn.clicked.connect(lambda: self._remove_dimension_row(row_idx))
        
        self.dimensions_layout.addWidget(key_edit, row_idx, 0)
        self.dimensions_layout.addWidget(value_edit, row_idx, 1)
        self.dimensions_layout.addWidget(delete_btn, row_idx, 2)
        
        self.dimension_rows.append((key_edit, value_edit, delete_btn))
    
    def _remove_dimension_row(self, index):
        if len(self.dimension_rows) <= 1:
            return
        
        key_edit, value_edit, delete_btn = self.dimension_rows[index]
        key_edit.deleteLater()
        value_edit.deleteLater()
        delete_btn.deleteLater()
        
        self.dimension_rows.pop(index)
        
        for i, (k, v, d) in enumerate(self.dimension_rows):
            d.clicked.disconnect()
            d.clicked.connect(lambda checked, idx=i: self._remove_dimension_row(idx))
    
    def _load_measurement(self, measurement: Measurement):
        self.version_spin.setValue(measurement.version)
        self.technician_edit.setText(measurement.technician or "")
        self.notes_edit.setPlainText(measurement.notes or "")
        
        dims = measurement.get_dimensions_dict()
        if dims:
            self.dimension_rows.clear()
            for i in reversed(range(self.dimensions_layout.count())):
                item = self.dimensions_layout.itemAt(i)
                if item.widget():
                    item.widget().deleteLater()
            
            for key, value in dims.items():
                row_idx = len(self.dimension_rows)
                
                key_edit = QLineEdit()
                key_edit.setText(key)
                
                value_edit = QLineEdit()
                value_edit.setText(str(value))
                
                delete_btn = QPushButton("×")
                delete_btn.setMaximumWidth(30)
                delete_btn.clicked.connect(lambda checked, idx=row_idx: self._remove_dimension_row(idx))
                
                self.dimensions_layout.addWidget(key_edit, row_idx, 0)
                self.dimensions_layout.addWidget(value_edit, row_idx, 1)
                self.dimensions_layout.addWidget(delete_btn, row_idx, 2)
                
                self.dimension_rows.append((key_edit, value_edit, delete_btn))
    
    def _validate_and_accept(self):
        self.accept()
    
    def get_measurement(self) -> Measurement:
        dims = {}
        for key_edit, value_edit, _ in self.dimension_rows:
            key = key_edit.text().strip()
            value = value_edit.text().strip()
            if key and value:
                dims[key] = value
        
        measurement = Measurement(
            id=self.measurement.id if self.measurement else None,
            order_id=self.order_id,
            version=self.version_spin.value()
        )
        measurement.set_dimensions_dict(dims)
        measurement.technician = self.technician_edit.text().strip() or None
        measurement.notes = self.notes_edit.toPlainText().strip() or None
        
        return measurement
