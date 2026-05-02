"""主窗口"""
from typing import Dict, Optional, List, Any
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QSplitter, QTabWidget,
    QMenuBar, QToolBar, QStatusBar, QMessageBox,
    QFileDialog, QComboBox, QSpinBox, QGroupBox,
    QCheckBox, QDialog, QFormLayout, QLineEdit
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QAction, QKeySequence, QIcon

from ..models.member import Member, VoicePart, SeniorityLevel, MemberStatus
from ..models.seating import Seat, SeatingLayout, SeatingAssignment
from ..models.version import RehearsalPlan
from ..core.seating_algorithm import SeatingAlgorithm, AlgorithmConfig
from ..persistence.storage import StorageManager
from ..io.export import export_seating_chart, ExportFormat
from ..io.csv_import import get_sample_csv_content

from .seating_widget import SeatingWidget
from .member_panel import MemberPanel, MemberDialog
from .validation_panel import ValidationPanel
from .version_panel import VersionPanel


class LayoutConfigDialog(QDialog):
    """布局配置对话框"""
    
    def __init__(self, current_rows: int = 4, current_cols: int = 10, parent=None):
        super().__init__(parent)
        
        self.setWindowTitle("座位布局配置")
        self.setMinimumWidth(300)
        
        self._init_ui(current_rows, current_cols)
    
    def _init_ui(self, current_rows: int, current_cols: int):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        form = QFormLayout()
        
        self._rows_spin = QSpinBox()
        self._rows_spin.setRange(1, 20)
        self._rows_spin.setValue(current_rows)
        self._rows_spin.setSuffix(" 排")
        form.addRow("排数:", self._rows_spin)
        
        self._cols_spin = QSpinBox()
        self._cols_spin.setRange(1, 30)
        self._cols_spin.setValue(current_cols)
        self._cols_spin.setSuffix(" 列")
        form.addRow("列数:", self._cols_spin)
        
        form.addRow(QLabel(""))
        
        self._keep_locked_check = QCheckBox("保留锁定的座位分配")
        self._keep_locked_check.setChecked(True)
        form.addRow(self._keep_locked_check)
        
        layout.addLayout(form)
        
        btn_layout = QHBoxLayout()
        
        self._ok_btn = QPushButton("确定")
        self._ok_btn.clicked.connect(self.accept)
        btn_layout.addWidget(self._ok_btn)
        
        self._cancel_btn = QPushButton("取消")
        self._cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self._cancel_btn)
        
        layout.addLayout(btn_layout)
    
    def get_rows(self) -> int:
        return self._rows_spin.value()
    
    def get_cols(self) -> int:
        return self._cols_spin.value()
    
    def keep_locked(self) -> bool:
        return self._keep_locked_check.isChecked()


class MainWindow(QMainWindow):
    """应用主窗口"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._storage_manager = StorageManager()
        self._current_plan: Optional[RehearsalPlan] = None
        self._auto_save_timer = QTimer(self)
        self._auto_save_timer.timeout.connect(self._on_auto_save)
        self._unsaved_changes = False
        
        self.setWindowTitle("合唱排练座位编排器")
        self.setMinimumSize(1200, 800)
        self.resize(1400, 900)
        
        self._init_menus()
        self._init_toolbar()
        self._init_ui()
        self._init_status_bar()
        
        self._new_plan()
    
    def _init_menus(self):
        """初始化菜单"""
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        new_action = QAction("新建计划(&N)", self)
        new_action.setShortcut(QKeySequence.StandardKey.New)
        new_action.triggered.connect(self._on_new_plan)
        file_menu.addAction(new_action)
        
        open_action = QAction("打开计划(&O)", self)
        open_action.setShortcut(QKeySequence.StandardKey.Open)
        open_action.triggered.connect(self._on_open_plan)
        file_menu.addAction(open_action)
        
        save_action = QAction("保存计划(&S)", self)
        save_action.setShortcut(QKeySequence.StandardKey.Save)
        save_action.triggered.connect(self._on_save_plan)
        file_menu.addAction(save_action)
        
        file_menu.addSeparator()
        
        import_menu = file_menu.addMenu("导入(&I)")
        
        import_csv_action = QAction("导入成员 CSV", self)
        import_csv_action.triggered.connect(self._on_import_csv)
        import_menu.addAction(import_csv_action)
        
        sample_csv_action = QAction("导出示例 CSV", self)
        sample_csv_action.triggered.connect(self._on_export_sample_csv)
        import_menu.addAction(sample_csv_action)
        
        file_menu.addSeparator()
        
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_text_action = QAction("导出座位单 (文本)", self)
        export_text_action.triggered.connect(lambda: self._on_export_chart("text"))
        export_menu.addAction(export_text_action)
        
        export_csv_action = QAction("导出座位单 (CSV)", self)
        export_csv_action.triggered.connect(lambda: self._on_export_chart("csv"))
        export_menu.addAction(export_csv_action)
        
        export_json_action = QAction("导出座位单 (JSON)", self)
        export_json_action.triggered.connect(lambda: self._on_export_chart("json"))
        export_menu.addAction(export_json_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut(QKeySequence.StandardKey.Quit)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        edit_menu = menubar.addMenu("编辑(&E)")
        
        layout_action = QAction("布局配置(&L)", self)
        layout_action.triggered.connect(self._on_layout_config)
        edit_menu.addAction(layout_action)
        
        edit_menu.addSeparator()
        
        auto_seat_action = QAction("自动排座(&A)", self)
        auto_seat_action.setShortcut(QKeySequence("F5"))
        auto_seat_action.triggered.connect(self._on_auto_seat)
        edit_menu.addAction(auto_seat_action)
        
        clear_action = QAction("清空分配(&C)", self)
        clear_action.triggered.connect(self._on_clear_assignments)
        edit_menu.addAction(clear_action)
        
        edit_menu.addSeparator()
        
        validate_action = QAction("执行校验(&V)", self)
        validate_action.setShortcut(QKeySequence("F6"))
        validate_action.triggered.connect(self._on_validate)
        edit_menu.addAction(validate_action)
        
        version_menu = menubar.addMenu("版本(&V)")
        
        save_version_action = QAction("保存版本(&S)", self)
        save_version_action.triggered.connect(self._on_save_version)
        version_menu.addAction(save_version_action)
        
        version_menu.addSeparator()
        
        auto_save_action = QAction("自动保存", self)
        auto_save_action.setCheckable(True)
        auto_save_action.setChecked(True)
        auto_save_action.triggered.connect(self._on_toggle_auto_save)
        version_menu.addAction(auto_save_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self._on_about)
        help_menu.addAction(about_action)
    
    def _init_toolbar(self):
        """初始化工具栏"""
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        toolbar.addAction("新建", self._on_new_plan)
        toolbar.addAction("打开", self._on_open_plan)
        toolbar.addAction("保存", self._on_save_plan)
        
        toolbar.addSeparator()
        
        toolbar.addAction("自动排座", self._on_auto_seat)
        toolbar.addAction("校验", self._on_validate)
        
        toolbar.addSeparator()
        
        toolbar.addAction("布局", self._on_layout_config)
        
        toolbar.addSeparator()
        
        self._plan_name_label = QLabel("当前计划: 无")
        toolbar.addWidget(self._plan_name_label)
    
    def _init_ui(self):
        """初始化主 UI"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        
        top_toolbar = QHBoxLayout()
        
        algo_label = QLabel("排座策略:")
        top_toolbar.addWidget(algo_label)
        
        self._algo_combo = QComboBox()
        self._algo_combo.addItem("默认（女高-女低-男高-男低）", "default")
        self._algo_combo.addItem("后排更高", "back_taller")
        top_toolbar.addWidget(self._algo_combo)
        
        top_toolbar.addStretch()
        
        main_layout.addLayout(top_toolbar)
        
        main_splitter = QSplitter(Qt.Orientation.Horizontal)
        
        left_tab = QTabWidget()
        
        self._member_panel = MemberPanel()
        self._member_panel.member_changed.connect(self._on_member_changed)
        self._member_panel.member_selected.connect(self._on_member_selected)
        left_tab.addTab(self._member_panel, "成员管理")
        
        main_splitter.addWidget(left_tab)
        
        center_splitter = QSplitter(Qt.Orientation.Vertical)
        
        self._seating_widget = SeatingWidget()
        self._seating_widget.seat_clicked.connect(self._on_seat_clicked)
        self._seating_widget.seat_double_clicked.connect(self._on_seat_double_clicked)
        self._seating_widget.assignment_changed.connect(self._on_assignment_changed)
        center_splitter.addWidget(self._seating_widget)
        
        bottom_tab = QTabWidget()
        
        self._validation_panel = ValidationPanel()
        self._validation_panel.issue_selected.connect(self._on_issue_selected)
        bottom_tab.addTab(self._validation_panel, "约束校验")
        
        self._version_panel = VersionPanel()
        self._version_panel.version_loaded.connect(self._on_version_loaded)
        self._version_panel.version_saved.connect(self._on_version_saved)
        bottom_tab.addTab(self._version_panel, "版本历史")
        
        center_splitter.addWidget(bottom_tab)
        
        center_splitter.setSizes([600, 300])
        
        main_splitter.addWidget(center_splitter)
        
        main_splitter.setSizes([300, 900])
        
        main_layout.addWidget(main_splitter)
    
    def _init_status_bar(self):
        """初始化状态栏"""
        self._status_bar = self.statusBar()
        self._status_bar.showMessage("就绪")
        
        self._status_label = QLabel("就绪")
        self._status_bar.addWidget(self._status_label, 1)
        
        self._changes_label = QLabel("")
        self._status_bar.addPermanentWidget(self._changes_label)
    
    def _update_plan_display(self):
        """更新计划显示"""
        if self._current_plan:
            name = self._current_plan.name
            self._plan_name_label.setText(f"当前计划: {name}")
            self.setWindowTitle(f"合唱排练座位编排器 - {name}")
            
            if self._unsaved_changes:
                self._changes_label.setText("● 有未保存的更改")
            else:
                self._changes_label.setText("")
        else:
            self._plan_name_label.setText("当前计划: 无")
            self.setWindowTitle("合唱排练座位编排器")
            self._changes_label.setText("")
    
    def _new_plan(self):
        """创建新计划"""
        plan = self._storage_manager.create_new_plan()
        
        layout = SeatingLayout(rows=4, cols=10)
        plan.layout = layout.to_dict()
        plan.members = {}
        
        self._current_plan = plan
        self._unsaved_changes = False
        
        self._sync_plan_to_ui()
        self._update_plan_display()
        
        self._auto_save_timer.start(60000)
    
    def _sync_plan_to_ui(self):
        """同步计划数据到 UI"""
        if not self._current_plan:
            return
        
        members_dict: Dict[str, Member] = {}
        for mid, mdata in self._current_plan.members.items():
            members_dict[mid] = Member.from_dict(mdata)
        
        self._member_panel.set_members(members_dict)
        
        layout = SeatingLayout.from_dict(self._current_plan.layout)
        self._seating_widget.set_layout(layout)
        self._seating_widget.set_members(members_dict)
        
        self._validation_panel.set_data(layout, members_dict)
        
        self._version_panel.set_plan(self._current_plan)
    
    def _sync_ui_to_plan(self):
        """同步 UI 数据到计划"""
        if not self._current_plan:
            return
        
        members = self._member_panel.get_members()
        self._current_plan.members = {k: v.to_dict() for k, v in members.items()}
        
        if self._seating_widget._layout:
            self._current_plan.layout = self._seating_widget._layout.to_dict()
        
        self._unsaved_changes = True
        self._update_plan_display()
    
    def _on_new_plan(self):
        """新建计划"""
        if self._unsaved_changes:
            reply = QMessageBox.question(
                self, "确认",
                "当前计划有未保存的更改，确定要新建计划吗？",
                QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self._on_save_plan()
            elif reply == QMessageBox.StandardButton.Cancel:
                return
        
        self._new_plan()
        self._status_bar.showMessage("已创建新计划")
    
    def _on_open_plan(self):
        """打开计划"""
        plans = self._storage_manager.list_plans()
        
        if not plans:
            QMessageBox.information(self, "提示", "没有保存的排练计划")
            return
        
        if self._unsaved_changes:
            reply = QMessageBox.question(
                self, "确认",
                "当前计划有未保存的更改，确定要打开其他计划吗？",
                QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self._on_save_plan()
            elif reply == QMessageBox.StandardButton.Cancel:
                return
        
        class PlanDialog(QDialog):
            def __init__(self, plans_data, parent=None):
                super().__init__(parent)
                self.setWindowTitle("选择排练计划")
                self.setMinimumWidth(500)
                self._selected_id = None
                
                layout = QVBoxLayout(self)
                
                self._list = QListWidget()
                for p in plans_data:
                    item = QListWidgetItem(f"{p['name']} ({p['member_count']} 人)")
                    item.setData(Qt.ItemDataRole.UserRole, p['id'])
                    self._list.addItem(item)
                
                self._list.itemDoubleClicked.connect(self.accept)
                layout.addWidget(self._list)
                
                btn_layout = QHBoxLayout()
                ok_btn = QPushButton("打开")
                ok_btn.clicked.connect(self.accept)
                btn_layout.addWidget(ok_btn)
                
                delete_btn = QPushButton("删除")
                delete_btn.clicked.connect(self._on_delete)
                btn_layout.addWidget(delete_btn)
                
                cancel_btn = QPushButton("取消")
                cancel_btn.clicked.connect(self.reject)
                btn_layout.addWidget(cancel_btn)
                
                layout.addLayout(btn_layout)
                
                self._plans_data = {p['id']: p for p in plans_data}
            
            def _on_delete(self):
                current = self._list.currentItem()
                if current:
                    plan_id = current.data(Qt.ItemDataRole.UserRole)
                    reply = QMessageBox.question(
                        self, "确认",
                        f"确定要删除计划 '{self._plans_data[plan_id]['name']}' 吗？",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                    )
                    if reply == QMessageBox.StandardButton.Yes:
                        from ..persistence.storage import StorageManager
                        manager = StorageManager()
                        manager.delete_plan(plan_id)
                        row = self._list.row(current)
                        self._list.takeItem(row)
                        del self._plans_data[plan_id]
            
            def get_selected_id(self):
                current = self._list.currentItem()
                if current:
                    return current.data(Qt.ItemDataRole.UserRole)
                return None
        
        dlg = PlanDialog(plans, self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            plan_id = dlg.get_selected_id()
            if plan_id:
                plan = self._storage_manager.load_plan(plan_id)
                if plan:
                    self._current_plan = plan
                    self._unsaved_changes = False
                    self._sync_plan_to_ui()
                    self._update_plan_display()
                    self._status_bar.showMessage(f"已打开计划: {plan.name}")
    
    def _on_save_plan(self):
        """保存计划"""
        if not self._current_plan:
            return
        
        self._sync_ui_to_plan()
        
        if self._storage_manager.save_plan(self._current_plan):
            self._unsaved_changes = False
            self._update_plan_display()
            self._status_bar.showMessage("计划已保存")
        else:
            QMessageBox.warning(self, "错误", "保存失败")
    
    def _on_import_csv(self):
        """导入成员 CSV"""
        self._member_panel._on_import_csv()
    
    def _on_export_sample_csv(self):
        """导出示例 CSV"""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存示例 CSV",
            "members_sample.csv",
            "CSV 文件 (*.csv)"
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(get_sample_csv_content())
                QMessageBox.information(self, "成功", f"示例 CSV 已保存到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存失败: {e}")
    
    def _on_export_chart(self, format: str):
        """导出座位单"""
        if not self._current_plan:
            QMessageBox.information(self, "提示", "没有打开的计划")
            return
        
        self._sync_ui_to_plan()
        
        ext_map = {
            "text": "txt",
            "txt": "txt",
            "csv": "csv",
            "json": "json",
        }
        ext = ext_map.get(format.lower(), "txt")
        
        default_name = f"座位单_{self._current_plan.name}.{ext}"
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出座位单",
            default_name,
            f"{ext.upper()} 文件 (*.{ext})"
        )
        
        if file_path:
            try:
                result = export_seating_chart(self._current_plan, format, file_path)
                if result.success:
                    QMessageBox.information(self, "成功", f"座位单已导出到: {result.file_path}")
                else:
                    QMessageBox.warning(self, "失败", result.message)
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {e}")
    
    def _on_layout_config(self):
        """布局配置"""
        current_rows = 4
        current_cols = 10
        
        if self._seating_widget._layout:
            current_rows = self._seating_widget._layout.rows
            current_cols = self._seating_widget._layout.cols
        
        dlg = LayoutConfigDialog(current_rows, current_cols, self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            rows = dlg.get_rows()
            cols = dlg.get_cols()
            keep_locked = dlg.keep_locked()
            
            if self._seating_widget._layout:
                old_assignments = {}
                if keep_locked:
                    for seat_id, assignment in self._seating_widget._layout.assignments.items():
                        if assignment.is_locked:
                            old_assignments[seat_id] = assignment
                
                self._seating_widget._layout.resize(rows, cols)
                
                for seat_id, assignment in old_assignments.items():
                    seat = self._seating_widget._layout.seats.get(seat_id)
                    if seat:
                        self._seating_widget._layout.assignments[seat_id] = assignment
                
                self._seating_widget.refresh()
                self._sync_ui_to_plan()
                self._status_bar.showMessage(f"布局已调整为 {rows} 排 x {cols} 列")
    
    def _on_auto_seat(self):
        """自动排座"""
        if not self._current_plan:
            QMessageBox.information(self, "提示", "没有打开的计划")
            return
        
        members = self._member_panel.get_members()
        if not members:
            QMessageBox.information(self, "提示", "没有成员数据，请先添加或导入成员")
            return
        
        layout = self._seating_widget._layout
        if not layout:
            QMessageBox.information(self, "提示", "没有座位布局")
            return
        
        reply = QMessageBox.question(
            self, "确认",
            "自动排座会清空现有的座位分配（锁定的座位除外），确定要继续吗？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply != QMessageBox.StandardButton.Yes:
            return
        
        config = AlgorithmConfig()
        algorithm = SeatingAlgorithm(config)
        
        result = algorithm.auto_seat(layout, members)
        
        self._seating_widget.refresh()
        self._sync_ui_to_plan()
        
        self._on_validate()
        
        if result.success:
            self._status_bar.showMessage(
                f"自动排座完成: 分配 {result.assigned_count} 人, "
                f"问题 {result.validation_issues_count} 个"
            )
        else:
            self._status_bar.showMessage("自动排座失败")
    
    def _on_clear_assignments(self):
        """清空分配"""
        reply = QMessageBox.question(
            self, "确认",
            "确定要清空所有座位分配吗？锁定的座位会保留。",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self._seating_widget.clear_assignments(keep_locked=True)
            self._sync_ui_to_plan()
            self._status_bar.showMessage("已清空座位分配")
    
    def _on_validate(self):
        """执行校验"""
        self._validation_panel.validate()
        issues = self._validation_panel.get_issues()
        
        if issues:
            self._seating_widget.set_validation_issues(issues)
            
            if self._validation_panel.has_critical_issues():
                self._status_bar.showMessage(f"校验发现严重问题，请检查")
            else:
                self._status_bar.showMessage(f"校验完成，发现 {len(issues)} 个问题")
        else:
            self._seating_widget.set_validation_issues([])
            self._status_bar.showMessage("校验通过，没有发现问题")
    
    def _on_save_version(self):
        """保存版本"""
        self._sync_ui_to_plan()
        self._version_panel._on_save_version()
    
    def _on_toggle_auto_save(self, enabled: bool):
        """切换自动保存"""
        if enabled:
            self._auto_save_timer.start(60000)
            self._status_bar.showMessage("自动保存已启用（每分钟）")
        else:
            self._auto_save_timer.stop()
            self._status_bar.showMessage("自动保存已禁用")
    
    def _on_auto_save(self):
        """自动保存"""
        if self._unsaved_changes and self._current_plan:
            self._sync_ui_to_plan()
            if self._storage_manager.save_plan(self._current_plan):
                self._unsaved_changes = False
                self._update_plan_display()
                self._status_bar.showMessage("自动保存完成")
    
    def _on_version_loaded(self, snapshot_id: str):
        """版本已加载"""
        self._sync_plan_to_ui()
        self._unsaved_changes = True
        self._update_plan_display()
        self._status_bar.showMessage("版本已恢复")
    
    def _on_version_saved(self):
        """版本已保存"""
        self._status_bar.showMessage("版本已保存")
    
    def _on_member_changed(self):
        """成员更改"""
        members = self._member_panel.get_members()
        self._seating_widget.set_members(members)
        self._sync_ui_to_plan()
        
        if self._seating_widget._layout:
            self._validation_panel.set_data(self._seating_widget._layout, members)
    
    def _on_member_selected(self, member_id: str):
        """成员选中"""
        pass
    
    def _on_seat_clicked(self, seat_id: str):
        """座位点击"""
        pass
    
    def _on_seat_double_clicked(self, seat_id: str):
        """座位双击 - 打开分配对话框"""
        if not self._current_plan:
            return
        
        members = self._member_panel.get_members()
        layout = self._seating_widget._layout
        
        if not layout:
            return
        
        current_assignment = layout.get_assignment_by_seat(seat_id)
        current_member_id = current_assignment.member_id if current_assignment else None
        is_locked = current_assignment.is_locked if current_assignment else False
        
        class AssignDialog(QDialog):
            def __init__(self, members_dict, seat, current_mid, locked, parent=None):
                super().__init__(parent)
                self.setWindowTitle(f"分配座位 - {seat.label}")
                self.setMinimumWidth(400)
                
                layout = QVBoxLayout(self)
                
                form = QFormLayout()
                
                self._member_combo = QComboBox()
                self._member_combo.addItem("（空）", None)
                
                for mid, m in members_dict.items():
                    self._member_combo.addItem(
                        f"{m.name} ({VoicePart.display_name(m.voice_part)}, {m.height_cm}cm)",
                        mid
                    )
                
                if current_mid:
                    idx = self._member_combo.findData(current_mid)
                    if idx >= 0:
                        self._member_combo.setCurrentIndex(idx)
                
                form.addRow("成员:", self._member_combo)
                
                self._locked_check = QCheckBox("锁定此分配")
                self._locked_check.setChecked(locked)
                form.addRow(self._locked_check)
                
                layout.addLayout(form)
                
                btn_layout = QHBoxLayout()
                ok_btn = QPushButton("确定")
                ok_btn.clicked.connect(self.accept)
                btn_layout.addWidget(ok_btn)
                
                unassign_btn = QPushButton("取消分配")
                unassign_btn.clicked.connect(self._on_unassign)
                btn_layout.addWidget(unassign_btn)
                
                cancel_btn = QPushButton("取消")
                cancel_btn.clicked.connect(self.reject)
                btn_layout.addWidget(cancel_btn)
                
                layout.addLayout(btn_layout)
                
                self._unassign_flag = False
            
            def _on_unassign(self):
                self._unassign_flag = True
                self.accept()
            
            def get_member_id(self):
                return self._member_combo.currentData()
            
            def is_locked(self):
                return self._locked_check.isChecked()
            
            def should_unassign(self):
                return self._unassign_flag
        
        seat = layout.seats.get(seat_id)
        if not seat:
            return
        
        dlg = AssignDialog(members, seat, current_member_id, is_locked, self)
        if dlg.exec() == QDialog.DialogCode.Accepted:
            if dlg.should_unassign():
                try:
                    self._seating_widget.unassign_seat(seat_id)
                    self._sync_ui_to_plan()
                    self._status_bar.showMessage(f"已取消 {seat.label} 的分配")
                except ValueError as e:
                    QMessageBox.warning(self, "提示", str(e))
            else:
                member_id = dlg.get_member_id()
                if member_id:
                    try:
                        self._seating_widget.assign_member(seat_id, member_id, dlg.is_locked())
                        self._sync_ui_to_plan()
                        
                        member = members.get(member_id)
                        if member:
                            self._status_bar.showMessage(f"已将 {member.name} 分配到 {seat.label}")
                    except ValueError as e:
                        QMessageBox.warning(self, "提示", str(e))
                else:
                    try:
                        self._seating_widget.unassign_seat(seat_id)
                        self._sync_ui_to_plan()
                    except ValueError as e:
                        QMessageBox.warning(self, "提示", str(e))
    
    def _on_assignment_changed(self):
        """分配更改"""
        self._sync_ui_to_plan()
    
    def _on_issue_selected(self, seat_id: str):
        """问题选中 - 高亮座位"""
        pass
    
    def _on_about(self):
        """关于"""
        QMessageBox.about(
            self, "关于",
            "合唱排练座位编排器 v1.0\n\n"
            "功能特点：\n"
            "• 成员管理和 CSV 导入\n"
            "• 可视化座位图和拖拽操作\n"
            "• 自动排座算法\n"
            "• 约束校验（断层、遮挡、带教关系等）\n"
            "• 版本历史和回滚\n"
            "• 座位单导出"
        )
    
    def closeEvent(self, event):
        """关闭事件"""
        if self._unsaved_changes:
            reply = QMessageBox.question(
                self, "确认",
                "当前计划有未保存的更改，确定要退出吗？",
                QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self._on_save_plan()
            elif reply == QMessageBox.StandardButton.Cancel:
                event.ignore()
                return
        
        self._auto_save_timer.stop()
        event.accept()
