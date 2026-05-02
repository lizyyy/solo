"""成员管理面板"""
from typing import Dict, Optional, List, Any
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QDialog, QFormLayout, QLineEdit, QComboBox, QSpinBox,
    QTextEdit, QMessageBox, QSplitter, QFrame, QScrollArea,
    QCheckBox, QFileDialog, QTabWidget, QListWidget, QListWidgetItem
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor, QBrush

from ..models.member import Member, VoicePart, SeniorityLevel, MemberStatus


class MemberDialog(QDialog):
    """成员编辑对话框"""
    
    def __init__(self, member: Optional[Member] = None, existing_members: Optional[Dict[str, Member]] = None, parent=None):
        super().__init__(parent)
        
        self._member = member
        self._existing_members = existing_members or {}
        self._result: Optional[Member] = None
        
        self.setWindowTitle("编辑成员" if member else "添加成员")
        self.setMinimumWidth(400)
        self.resize(450, 500)
        
        self._init_ui()
        
        if member:
            self._load_member_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        form = QFormLayout()
        
        self._name_edit = QLineEdit()
        self._name_edit.setPlaceholderText("请输入姓名")
        form.addRow("姓名:", self._name_edit)
        
        self._voice_combo = QComboBox()
        for vp in [
            VoicePart.SOPRANO_1, VoicePart.SOPRANO_2,
            VoicePart.ALTO_1, VoicePart.ALTO_2,
            VoicePart.TENOR_1, VoicePart.TENOR_2,
            VoicePart.BASS_1, VoicePart.BASS_2,
            VoicePart.UNASSIGNED,
        ]:
            self._voice_combo.addItem(VoicePart.display_name(vp), vp)
        form.addRow("声部:", self._voice_combo)
        
        self._height_spin = QSpinBox()
        self._height_spin.setRange(100, 220)
        self._height_spin.setValue(165)
        self._height_spin.setSuffix(" cm")
        form.addRow("身高:", self._height_spin)
        
        self._seniority_combo = QComboBox()
        for sl in [
            SeniorityLevel.NEW,
            SeniorityLevel.JUNIOR,
            SeniorityLevel.MID,
            SeniorityLevel.SENIOR,
            SeniorityLevel.LEADER,
        ]:
            self._seniority_combo.addItem(SeniorityLevel.display_name(sl), sl)
        form.addRow("资深度:", self._seniority_combo)
        
        self._status_combo = QComboBox()
        for st in [
            MemberStatus.UNKNOWN,
            MemberStatus.PRESENT,
            MemberStatus.ABSENT,
            MemberStatus.LEAVE,
        ]:
            self._status_combo.addItem(MemberStatus.display_name(st), st)
        form.addRow("状态:", self._status_combo)
        
        self._mentor_combo = QComboBox()
        self._mentor_combo.addItem("（无）", None)
        for mid, m in self._existing_members.items():
            if self._member and mid == self._member.id:
                continue
            if m.is_mentor() or m.seniority in [SeniorityLevel.SENIOR, SeniorityLevel.LEADER]:
                self._mentor_combo.addItem(f"{m.name} ({VoicePart.display_name(m.voice_part)})", mid)
        form.addRow("带教老师:", self._mentor_combo)
        
        form.addRow(QLabel(""))
        
        self._notes_edit = QTextEdit()
        self._notes_edit.setPlaceholderText("备注信息...")
        self._notes_edit.setMaximumHeight(100)
        form.addRow("备注:", self._notes_edit)
        
        layout.addLayout(form)
        
        layout.addStretch()
        
        btn_layout = QHBoxLayout()
        
        self._ok_btn = QPushButton("确定")
        self._ok_btn.clicked.connect(self._on_ok)
        btn_layout.addWidget(self._ok_btn)
        
        self._cancel_btn = QPushButton("取消")
        self._cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self._cancel_btn)
        
        layout.addLayout(btn_layout)
    
    def _load_member_data(self):
        """加载成员数据"""
        if not self._member:
            return
        
        self._name_edit.setText(self._member.name)
        
        idx = self._voice_combo.findData(self._member.voice_part)
        if idx >= 0:
            self._voice_combo.setCurrentIndex(idx)
        
        self._height_spin.setValue(self._member.height_cm)
        
        idx = self._seniority_combo.findData(self._member.seniority)
        if idx >= 0:
            self._seniority_combo.setCurrentIndex(idx)
        
        idx = self._status_combo.findData(self._member.status)
        if idx >= 0:
            self._status_combo.setCurrentIndex(idx)
        
        if self._member.mentor_id:
            idx = self._mentor_combo.findData(self._member.mentor_id)
            if idx >= 0:
                self._mentor_combo.setCurrentIndex(idx)
        
        self._notes_edit.setText(self._member.notes)
    
    def _on_ok(self):
        """确定按钮"""
        name = self._name_edit.text().strip()
        if not name:
            QMessageBox.warning(self, "提示", "请输入姓名")
            return
        
        if self._member:
            member = self._member
        else:
            member = Member()
        
        member.name = name
        member.voice_part = self._voice_combo.currentData()
        member.height_cm = self._height_spin.value()
        member.seniority = self._seniority_combo.currentData()
        member.status = self._status_combo.currentData()
        member.mentor_id = self._mentor_combo.currentData()
        member.notes = self._notes_edit.toPlainText()
        
        self._result = member
        self.accept()
    
    def get_result(self) -> Optional[Member]:
        """获取编辑结果"""
        return self._result


class MemberPanel(QWidget):
    """成员管理面板"""
    
    member_changed = pyqtSignal()
    member_selected = pyqtSignal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._members: Dict[str, Member] = {}
        self._selected_member_id: Optional[str] = None
        
        self._init_ui()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._add_btn = QPushButton("添加")
        self._add_btn.clicked.connect(self._on_add_member)
        toolbar.addWidget(self._add_btn)
        
        self._edit_btn = QPushButton("编辑")
        self._edit_btn.clicked.connect(self._on_edit_member)
        toolbar.addWidget(self._edit_btn)
        
        self._delete_btn = QPushButton("删除")
        self._delete_btn.clicked.connect(self._on_delete_member)
        toolbar.addWidget(self._delete_btn)
        
        toolbar.addStretch()
        
        self._import_btn = QPushButton("导入 CSV")
        self._import_btn.clicked.connect(self._on_import_csv)
        toolbar.addWidget(self._import_btn)
        
        layout.addLayout(toolbar)
        
        self._table = QTableWidget()
        self._table.setColumnCount(7)
        self._table.setHorizontalHeaderLabels([
            "姓名", "声部", "身高", "资深度", "状态", "带教", "备注"
        ])
        self._table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self._table.horizontalHeader().setSectionResizeMode(6, QHeaderView.ResizeMode.Stretch)
        self._table.itemSelectionChanged.connect(self._on_selection_changed)
        self._table.doubleClicked.connect(self._on_table_double_click)
        
        layout.addWidget(self._table)
        
        stats_layout = QHBoxLayout()
        self._stats_label = QLabel("共 0 位成员")
        stats_layout.addWidget(self._stats_label)
        stats_layout.addStretch()
        layout.addLayout(stats_layout)
    
    def set_members(self, members: Dict[str, Member]):
        """设置成员数据"""
        self._members = {k: v for k, v in members.items()}
        self._refresh_table()
    
    def get_members(self) -> Dict[str, Member]:
        """获取成员数据"""
        return {k: v for k, v in self._members.items()}
    
    def get_selected_member(self) -> Optional[Member]:
        """获取选中的成员"""
        if self._selected_member_id:
            return self._members.get(self._selected_member_id)
        return None
    
    def _refresh_table(self):
        """刷新表格"""
        self._table.setRowCount(0)
        
        sorted_members = sorted(
            self._members.values(),
            key=lambda m: (m.voice_part.value, m.name)
        )
        
        self._table.setRowCount(len(sorted_members))
        
        status_colors = {
            MemberStatus.PRESENT: QColor(46, 204, 113),
            MemberStatus.ABSENT: QColor(231, 76, 60),
            MemberStatus.LEAVE: QColor(243, 156, 18),
            MemberStatus.UNKNOWN: QColor(149, 165, 166),
        }
        
        for row, member in enumerate(sorted_members):
            item = QTableWidgetItem(member.name)
            item.setData(Qt.ItemDataRole.UserRole, member.id)
            if member.is_new():
                item.setBackground(QBrush(QColor(255, 255, 200)))
            self._table.setItem(row, 0, item)
            
            item = QTableWidgetItem(VoicePart.display_name(member.voice_part))
            self._table.setItem(row, 1, item)
            
            item = QTableWidgetItem(f"{member.height_cm}cm")
            self._table.setItem(row, 2, item)
            
            item = QTableWidgetItem(SeniorityLevel.display_name(member.seniority))
            self._table.setItem(row, 3, item)
            
            item = QTableWidgetItem(MemberStatus.display_name(member.status))
            if member.status in status_colors:
                item.setForeground(QBrush(status_colors[member.status]))
            self._table.setItem(row, 4, item)
            
            mentor_name = ""
            if member.mentor_id and member.mentor_id in self._members:
                mentor_name = self._members[member.mentor_id].name
            item = QTableWidgetItem(mentor_name)
            self._table.setItem(row, 5, item)
            
            item = QTableWidgetItem(member.notes[:20] + "..." if len(member.notes) > 20 else member.notes)
            self._table.setItem(row, 6, item)
        
        self._stats_label.setText(f"共 {len(self._members)} 位成员")
    
    def _on_selection_changed(self):
        """选择变化"""
        selected = self._table.selectedItems()
        if selected:
            item = selected[0]
            self._selected_member_id = item.data(Qt.ItemDataRole.UserRole)
            self.member_selected.emit(self._selected_member_id)
        else:
            self._selected_member_id = None
    
    def _on_table_double_click(self, index):
        """双击表格"""
        self._on_edit_member()
    
    def _on_add_member(self):
        """添加成员"""
        dlg = MemberDialog(existing_members=self._members, parent=self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            member = dlg.get_result()
            if member:
                self._members[member.id] = member
                self._refresh_table()
                self.member_changed.emit()
    
    def _on_edit_member(self):
        """编辑成员"""
        member = self.get_selected_member()
        if not member:
            QMessageBox.information(self, "提示", "请先选择一个成员")
            return
        
        dlg = MemberDialog(member=member, existing_members=self._members, parent=self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            edited = dlg.get_result()
            if edited:
                self._members[edited.id] = edited
                self._refresh_table()
                self.member_changed.emit()
    
    def _on_delete_member(self):
        """删除成员"""
        member = self.get_selected_member()
        if not member:
            QMessageBox.information(self, "提示", "请先选择一个成员")
            return
        
        reply = QMessageBox.question(
            self, "确认",
            f"确定要删除成员 '{member.name}' 吗？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            del self._members[member.id]
            self._selected_member_id = None
            self._refresh_table()
            self.member_changed.emit()
    
    def _on_import_csv(self):
        """导入 CSV"""
        from ..io.csv_import import CSVImporter, get_sample_csv_content
        from pathlib import Path
        
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "选择 CSV 文件",
            "",
            "CSV 文件 (*.csv);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            importer = CSVImporter()
            result = importer.import_from_file(Path(file_path), self._members)
            
            if result.success:
                self._members = result.members
                self._refresh_table()
                self.member_changed.emit()
                
                QMessageBox.information(
                    self, "导入结果",
                    f"导入成功！\n\n"
                    f"新增：{result.imported_count} 人\n"
                    f"更新：{result.updated_count} 人\n"
                    f"跳过：{result.skipped_count} 人"
                )
            else:
                QMessageBox.warning(self, "导入失败", result.message)
        
        except Exception as e:
            QMessageBox.critical(self, "错误", f"导入时发生错误：{e}")
