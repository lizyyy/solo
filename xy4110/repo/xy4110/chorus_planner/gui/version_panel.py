"""版本历史面板"""
from typing import Dict, Optional, List, Any
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QDialog, QFormLayout, QLineEdit, QComboBox, QSpinBox,
    QTextEdit, QMessageBox, QSplitter, QFrame, QScrollArea,
    QCheckBox, QFileDialog, QTabWidget, QListWidget, QListWidgetItem,
    QToolButton, QMenu, QInputDialog
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor, QBrush, QFont, QAction

from ..models.version import RehearsalPlan, VersionHistory, VersionSnapshot


class VersionPanel(QWidget):
    """版本历史面板"""
    
    version_loaded = pyqtSignal(str)
    version_saved = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._plan: Optional[RehearsalPlan] = None
        
        self._init_ui()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._save_btn = QPushButton("保存当前版本")
        self._save_btn.clicked.connect(self._on_save_version)
        toolbar.addWidget(self._save_btn)
        
        self._restore_btn = QPushButton("恢复选中版本")
        self._restore_btn.clicked.connect(self._on_restore_version)
        toolbar.addWidget(self._restore_btn)
        
        toolbar.addStretch()
        
        self._mark_btn = QPushButton("标记版本")
        self._mark_btn.clicked.connect(self._on_mark_version)
        toolbar.addWidget(self._mark_btn)
        
        layout.addLayout(toolbar)
        
        self._version_table = QTableWidget()
        self._version_table.setColumnCount(6)
        self._version_table.setHorizontalHeaderLabels([
            "版本号", "标签", "时间", "是否标记", "自动保存", "描述"
        ])
        self._version_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._version_table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self._version_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._version_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self._version_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self._version_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self._version_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self._version_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self._version_table.doubleClicked.connect(self._on_version_double_click)
        
        layout.addWidget(self._version_table)
        
        info_layout = QHBoxLayout()
        self._info_label = QLabel("当前版本: 无")
        info_layout.addWidget(self._info_label)
        info_layout.addStretch()
        layout.addLayout(info_layout)
    
    def set_plan(self, plan: RehearsalPlan):
        """设置排练计划"""
        self._plan = plan
        self._refresh_version_list()
    
    def _refresh_version_list(self):
        """刷新版本列表"""
        self._version_table.setRowCount(0)
        
        if not self._plan:
            self._info_label.setText("当前版本: 无")
            return
        
        current = self._plan.version_history.get_current_snapshot()
        if current:
            self._info_label.setText(f"当前版本: v{current.version_number} - {current.label or '未命名'}")
        else:
            self._info_label.setText("当前版本: 无")
        
        snapshots = self._plan.version_history.get_snapshots_desc()
        
        self._version_table.setRowCount(len(snapshots))
        
        for row, snapshot in enumerate(snapshots):
            item = QTableWidgetItem(f"v{snapshot.version_number}")
            item.setData(Qt.ItemDataRole.UserRole, snapshot.id)
            font = item.font()
            if current and snapshot.id == current.id:
                font.setBold(True)
                item.setFont(font)
                item.setBackground(QBrush(QColor(200, 230, 255)))
            self._version_table.setItem(row, 0, item)
            
            item = QTableWidgetItem(snapshot.label or "")
            self._version_table.setItem(row, 1, item)
            
            time_str = snapshot.created_at.strftime("%m-%d %H:%M") if snapshot.created_at else ""
            item = QTableWidgetItem(time_str)
            self._version_table.setItem(row, 2, item)
            
            marked = "★" if snapshot.is_marked else ""
            item = QTableWidgetItem(marked)
            item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            if snapshot.is_marked:
                item.setForeground(QBrush(QColor(243, 156, 18)))
            self._version_table.setItem(row, 3, item)
            
            auto_save = "是" if snapshot.is_auto_save else "否"
            item = QTableWidgetItem(auto_save)
            self._version_table.setItem(row, 4, item)
            
            item = QTableWidgetItem(snapshot.description or "")
            self._version_table.setItem(row, 5, item)
    
    def get_selected_snapshot_id(self) -> Optional[str]:
        """获取选中的版本 ID"""
        selected = self._version_table.selectedItems()
        if selected:
            return selected[0].data(Qt.ItemDataRole.UserRole)
        return None
    
    def _on_save_version(self):
        """保存版本"""
        if not self._plan:
            QMessageBox.information(self, "提示", "没有打开的排练计划")
            return
        
        label, ok = QInputDialog.getText(
            self, "保存版本", "版本标签（可选）:",
            QLineEdit.EchoMode.Normal, ""
        )
        
        if not ok:
            return
        
        self._plan.members = {k: v.to_dict() for k, v in self._plan.members.items()} if hasattr(self._plan, 'members') and self._plan.members and isinstance(list(self._plan.members.values())[0], Member) else self._plan.members
        
        self._plan.save_version(
            label=label,
            description="",
            is_auto_save=False
        )
        
        self._refresh_version_list()
        QMessageBox.information(self, "成功", "版本已保存")
        self.version_saved.emit()
    
    def _on_restore_version(self):
        """恢复版本"""
        if not self._plan:
            QMessageBox.information(self, "提示", "没有打开的排练计划")
            return
        
        snapshot_id = self.get_selected_snapshot_id()
        if not snapshot_id:
            QMessageBox.information(self, "提示", "请先选择一个版本")
            return
        
        current = self._plan.version_history.get_current_snapshot()
        if current and current.id == snapshot_id:
            QMessageBox.information(self, "提示", "当前已是选中版本")
            return
        
        reply = QMessageBox.question(
            self, "确认",
            "恢复版本会覆盖当前数据，确定要继续吗？\n\n提示：建议先保存当前版本。",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            if self._plan.restore_from_snapshot(snapshot_id):
                self._refresh_version_list()
                QMessageBox.information(self, "成功", "版本已恢复")
                self.version_loaded.emit(snapshot_id)
            else:
                QMessageBox.warning(self, "失败", "无法恢复版本")
    
    def _on_mark_version(self):
        """标记版本"""
        if not self._plan:
            QMessageBox.information(self, "提示", "没有打开的排练计划")
            return
        
        snapshot_id = self.get_selected_snapshot_id()
        if not snapshot_id:
            QMessageBox.information(self, "提示", "请先选择一个版本")
            return
        
        for s in self._plan.version_history.snapshots:
            if s.id == snapshot_id:
                new_marked = not s.is_marked
                self._plan.version_history.mark_snapshot(snapshot_id, new_marked)
                self._refresh_version_list()
                
                if new_marked:
                    QMessageBox.information(self, "成功", "版本已标记为重要版本")
                else:
                    QMessageBox.information(self, "成功", "已取消重要版本标记")
                return
    
    def _on_version_double_click(self, index):
        """双击版本"""
        self._on_restore_version()
    
    def auto_save(self, label: str = "自动保存"):
        """自动保存"""
        if not self._plan:
            return
        
        self._plan.save_version(
            label=label,
            description="",
            is_auto_save=True
        )
        self._refresh_version_list()
