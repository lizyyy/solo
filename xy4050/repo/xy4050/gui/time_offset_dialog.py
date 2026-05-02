import sys
from pathlib import Path
from typing import Dict, Optional, List

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLabel, QLineEdit, QTextEdit, QComboBox,
    QPushButton, QGroupBox, QDialogButtonBox,
    QCheckBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QSpinBox, QDoubleSpinBox, QMessageBox
)
from PyQt6.QtCore import Qt

sys.path.insert(0, str(Path(__file__).parent.parent))

from merger.time_offset import TimeOffsetManager, SourceOffset


class TimeOffsetDialog(QDialog):
    def __init__(self, parent=None, offset_manager: Optional[TimeOffsetManager] = None):
        super().__init__(parent)
        self._offset_manager = offset_manager or TimeOffsetManager()
        self._modified_offsets: Dict[str, int] = {}
        
        self.setWindowTitle("时间偏移设置")
        self.setMinimumWidth(600)
        self.setMinimumHeight(400)
        
        self._init_ui()
        self._refresh_table()
    
    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        help_group = QGroupBox("说明")
        help_layout = QVBoxLayout(help_group)
        
        help_label = QLabel(
            "时间偏移用于将不同来源的记录同步到统一时间线。\n"
            "  - 正偏移: 该来源的时间需要提前 (例如: 偏移 60 秒表示该来源的时间比实际早 60 秒)\n"
            "  - 负偏移: 该来源的时间需要延后 (例如: 偏移 -30 秒表示该来源的时间比实际晚 30 秒)\n"
            "点击表格中的偏移量单元格可以手动编辑。"
        )
        help_label.setWordWrap(True)
        help_layout.addWidget(help_label)
        
        layout.addWidget(help_group)
        
        table_group = QGroupBox("来源偏移设置")
        table_layout = QVBoxLayout(table_group)
        
        self._offsets_table = QTableWidget()
        self._offsets_table.setColumnCount(4)
        self._offsets_table.setHorizontalHeaderLabels([
            "来源名称", "偏移量(秒)", "是否手动设置", "置信度"
        ])
        self._offsets_table.horizontalHeader().setStretchLastSection(True)
        self._offsets_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._offsets_table.setAlternatingRowColors(True)
        
        header = self._offsets_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        
        self._offsets_table.itemChanged.connect(self._on_item_changed)
        
        table_layout.addWidget(self._offsets_table)
        
        btn_layout = QHBoxLayout()
        
        self._btn_auto_estimate = QPushButton("自动估算")
        self._btn_auto_estimate.setToolTip("基于锚点事件自动估算偏移")
        btn_layout.addWidget(self._btn_auto_estimate)
        
        self._btn_reset = QPushButton("重置所有")
        btn_layout.addWidget(self._btn_reset)
        
        btn_layout.addStretch()
        
        table_layout.addLayout(btn_layout)
        
        layout.addWidget(table_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | 
            QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        
        layout.addWidget(buttons)
    
    def _refresh_table(self):
        self._offsets_table.setRowCount(0)
        self._offsets_table.blockSignals(True)
        
        offsets = self._offset_manager.get_all_offsets()
        
        for source, offset_info in offsets.items():
            row = self._offsets_table.rowCount()
            self._offsets_table.insertRow(row)
            
            source_item = QTableWidgetItem(source)
            source_item.setFlags(source_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self._offsets_table.setItem(row, 0, source_item)
            
            offset_item = QTableWidgetItem(str(offset_info.offset_seconds))
            offset_item.setData(Qt.ItemDataRole.UserRole, source)
            self._offsets_table.setItem(row, 1, offset_item)
            
            manual_item = QTableWidgetItem("是" if offset_info.is_manual else "否")
            manual_item.setFlags(manual_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self._offsets_table.setItem(row, 2, manual_item)
            
            conf_item = QTableWidgetItem(f"{offset_info.confidence:.2f}")
            conf_item.setFlags(conf_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self._offsets_table.setItem(row, 3, conf_item)
        
        self._offsets_table.blockSignals(False)
    
    def _on_item_changed(self, item: QTableWidgetItem):
        if item.column() != 1:
            return
        
        source = item.data(Qt.ItemDataRole.UserRole)
        if not source:
            return
        
        try:
            offset_seconds = int(item.text())
            self._modified_offsets[source] = offset_seconds
            
            row = item.row()
            manual_item = self._offsets_table.item(row, 2)
            if manual_item:
                manual_item.setText("是")
                
        except ValueError:
            QMessageBox.warning(self, "输入错误", "偏移量必须是整数")
            offsets = self._offset_manager.get_all_offsets()
            if source in offsets:
                item.setText(str(offsets[source].offset_seconds))
    
    def _on_accept(self):
        for source, offset_seconds in self._modified_offsets.items():
            self._offset_manager.set_offset(source, offset_seconds, is_manual=True)
        
        self.accept()
    
    def get_offset_manager(self) -> TimeOffsetManager:
        return self._offset_manager
