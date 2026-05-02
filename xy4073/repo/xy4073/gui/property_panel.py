from typing import Optional

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QFormLayout, QGroupBox,
    QLabel, QLineEdit, QSpinBox, QDoubleSpinBox,
    QCheckBox, QPushButton, QColorDialog, QComboBox
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QColor

from models.piece import Piece
from models.fabric import FabricSettings


class PropertyPanel(QWidget):
    piece_changed = pyqtSignal(str)
    fabric_changed = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._selected_piece: Optional[Piece] = None
        self._fabric_settings: Optional[FabricSettings] = None
        
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        self._piece_group = QGroupBox("裁片属性")
        piece_layout = QFormLayout(self._piece_group)
        
        self._piece_name_edit = QLineEdit()
        self._piece_name_edit.setEnabled(False)
        self._piece_name_edit.textChanged.connect(self._on_piece_property_changed)
        piece_layout.addRow("名称:", self._piece_name_edit)
        
        self._piece_id_label = QLabel("-")
        piece_layout.addRow("ID:", self._piece_id_label)
        
        self._piece_quantity_spin = QSpinBox()
        self._piece_quantity_spin.setRange(1, 100)
        self._piece_quantity_spin.setEnabled(False)
        self._piece_quantity_spin.valueChanged.connect(self._on_piece_property_changed)
        piece_layout.addRow("数量:", self._piece_quantity_spin)
        
        self._piece_width_label = QLabel("-")
        piece_layout.addRow("宽度:", self._piece_width_label)
        
        self._piece_height_label = QLabel("-")
        piece_layout.addRow("高度:", self._piece_height_label)
        
        self._piece_area_label = QLabel("-")
        piece_layout.addRow("面积:", self._piece_area_label)
        
        color_layout = QFormLayout()
        self._color_btn = QPushButton("选择颜色")
        self._color_btn.setEnabled(False)
        self._color_btn.clicked.connect(self._choose_color)
        color_layout.addRow("颜色:", self._color_btn)
        piece_layout.addRow(color_layout)
        
        self._can_rotate_check = QCheckBox("允许旋转")
        self._can_rotate_check.setEnabled(False)
        self._can_rotate_check.stateChanged.connect(self._on_piece_property_changed)
        piece_layout.addRow(self._can_rotate_check)
        
        self._has_plaid_check = QCheckBox("需要格纹对齐")
        self._has_plaid_check.setEnabled(False)
        self._has_plaid_check.stateChanged.connect(self._on_piece_property_changed)
        piece_layout.addRow(self._has_plaid_check)
        
        layout.addWidget(self._piece_group)
        
        self._fabric_group = QGroupBox("布料设置")
        fabric_layout = QFormLayout(self._fabric_group)
        
        self._fabric_name_edit = QLineEdit()
        self._fabric_name_edit.textChanged.connect(self._on_fabric_property_changed)
        fabric_layout.addRow("名称:", self._fabric_name_edit)
        
        self._fabric_width_spin = QDoubleSpinBox()
        self._fabric_width_spin.setRange(10, 500)
        self._fabric_width_spin.setSuffix(" cm")
        self._fabric_width_spin.valueChanged.connect(self._on_fabric_property_changed)
        fabric_layout.addRow("布幅宽度:", self._fabric_width_spin)
        
        self._shrink_x_spin = QDoubleSpinBox()
        self._shrink_x_spin.setRange(-50, 50)
        self._shrink_x_spin.setSuffix(" %")
        self._shrink_x_spin.valueChanged.connect(self._on_fabric_property_changed)
        fabric_layout.addRow("缩水率 (横):", self._shrink_x_spin)
        
        self._shrink_y_spin = QDoubleSpinBox()
        self._shrink_y_spin.setRange(-50, 50)
        self._shrink_y_spin.setSuffix(" %")
        self._shrink_y_spin.valueChanged.connect(self._on_fabric_property_changed)
        fabric_layout.addRow("缩水率 (纵):", self._shrink_y_spin)
        
        self._grain_combo = QComboBox()
        self._grain_combo.addItems(["经向 (0°)", "纬向 (90°)", "斜向 (45°)"])
        self._grain_combo.currentIndexChanged.connect(self._on_fabric_property_changed)
        fabric_layout.addRow("纹向:", self._grain_combo)
        
        self._margin_spin = QDoubleSpinBox()
        self._margin_spin.setRange(0, 10)
        self._margin_spin.setSingleStep(0.1)
        self._margin_spin.setSuffix(" cm")
        self._margin_spin.valueChanged.connect(self._on_fabric_property_changed)
        fabric_layout.addRow("安全边距:", self._margin_spin)
        
        layout.addWidget(self._fabric_group)
        
        layout.addStretch()

    def set_selected_piece(self, piece: Optional[Piece]):
        self._selected_piece = piece
        
        has_selection = piece is not None
        
        self._piece_name_edit.setEnabled(has_selection)
        self._piece_quantity_spin.setEnabled(has_selection)
        self._can_rotate_check.setEnabled(has_selection)
        self._has_plaid_check.setEnabled(has_selection)
        self._color_btn.setEnabled(has_selection)
        
        if piece:
            self._piece_name_edit.blockSignals(True)
            self._piece_name_edit.setText(piece.name)
            self._piece_name_edit.blockSignals(False)
            
            self._piece_id_label.setText(piece.id)
            
            self._piece_quantity_spin.blockSignals(True)
            self._piece_quantity_spin.setValue(piece.quantity)
            self._piece_quantity_spin.blockSignals(False)
            
            self._piece_width_label.setText(f"{piece.get_width():.1f} cm")
            self._piece_height_label.setText(f"{piece.get_height():.1f} cm")
            self._piece_area_label.setText(f"{piece.get_area():.1f} cm²")
            
            self._can_rotate_check.blockSignals(True)
            self._can_rotate_check.setChecked(piece.can_rotate)
            self._can_rotate_check.blockSignals(False)
            
            self._has_plaid_check.blockSignals(True)
            self._has_plaid_check.setChecked(piece.has_plaid_match)
            self._has_plaid_check.blockSignals(False)
        else:
            self._piece_name_edit.setText("")
            self._piece_id_label.setText("-")
            self._piece_quantity_spin.setValue(1)
            self._piece_width_label.setText("-")
            self._piece_height_label.setText("-")
            self._piece_area_label.setText("-")

    def set_fabric_settings(self, settings: FabricSettings):
        self._fabric_settings = settings
        
        if settings:
            self._fabric_name_edit.blockSignals(True)
            self._fabric_name_edit.setText(settings.name)
            self._fabric_name_edit.blockSignals(False)
            
            self._fabric_width_spin.blockSignals(True)
            self._fabric_width_spin.setValue(settings.width)
            self._fabric_width_spin.blockSignals(False)
            
            self._shrink_x_spin.blockSignals(True)
            self._shrink_x_spin.setValue(settings.shrinkage_x)
            self._shrink_x_spin.blockSignals(False)
            
            self._shrink_y_spin.blockSignals(True)
            self._shrink_y_spin.setValue(settings.shrinkage_y)
            self._shrink_y_spin.blockSignals(False)
            
            self._grain_combo.blockSignals(True)
            if abs(settings.grain_direction - 90) < 5:
                self._grain_combo.setCurrentIndex(1)
            elif abs(settings.grain_direction - 45) < 5:
                self._grain_combo.setCurrentIndex(2)
            else:
                self._grain_combo.setCurrentIndex(0)
            self._grain_combo.blockSignals(False)
            
            self._margin_spin.blockSignals(True)
            self._margin_spin.setValue(settings.safety_margin)
            self._margin_spin.blockSignals(False)

    def clear_piece_selection(self):
        self.set_selected_piece(None)

    def _on_piece_property_changed(self):
        if not self._selected_piece:
            return
        
        self._selected_piece.name = self._piece_name_edit.text()
        self._selected_piece.quantity = self._piece_quantity_spin.value()
        self._selected_piece.can_rotate = self._can_rotate_check.isChecked()
        self._selected_piece.has_plaid_match = self._has_plaid_check.isChecked()
        
        self.piece_changed.emit(self._selected_piece.id)

    def _on_fabric_property_changed(self):
        if not self._fabric_settings:
            return
        
        self._fabric_settings.name = self._fabric_name_edit.text()
        self._fabric_settings.width = self._fabric_width_spin.value()
        self._fabric_settings.shrinkage_x = self._shrink_x_spin.value()
        self._fabric_settings.shrinkage_y = self._shrink_y_spin.value()
        
        grain_index = self._grain_combo.currentIndex()
        if grain_index == 1:
            self._fabric_settings.grain_direction = 90.0
        elif grain_index == 2:
            self._fabric_settings.grain_direction = 45.0
        else:
            self._fabric_settings.grain_direction = 0.0
        
        self._fabric_settings.safety_margin = self._margin_spin.value()
        
        self.fabric_changed.emit()

    def _choose_color(self):
        if not self._selected_piece:
            return
        
        current_color = QColor(self._selected_piece.color)
        color = QColorDialog.getColor(current_color, self, "选择裁片颜色")
        
        if color.isValid():
            self._selected_piece.color = color.name()
            self.piece_changed.emit(self._selected_piece.id)
