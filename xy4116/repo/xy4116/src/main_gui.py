#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GUI主界面模块
无线麦频率彩排台的主窗口和所有界面组件
"""

import sys
from datetime import time, datetime
from typing import List, Optional
from pathlib import Path

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QTableWidget, QTableWidgetItem, QPushButton, QLabel,
    QSplitter, QGroupBox, QFormLayout, QLineEdit, QDoubleSpinBox,
    QSpinBox, QTimeEdit, QCheckBox, QTextEdit, QComboBox,
    QMessageBox, QFileDialog, QHeaderView, QMenu, QMenuBar,
    QToolBar, QStatusBar, QSplitter, QFrame, QScrollArea
)
from PyQt6.QtCore import Qt, QTime, pyqtSignal, QTimer
from PyQt6.QtGui import QAction, QIcon, QFont, QColor

from .models import (
    RehearsalPlan, Microphone, ScheduleEntry, ForbiddenBand,
    ChannelInfo, RiskItem, RiskLevel, RiskType
)
from .frequency_rules import FrequencyRuleEngine
from .timeline_state import TimelineStateManager
from .persistence import PlanPersistence
from .import_export import DataImporter, DataExporter
from .sample_data import create_sample_plan


class WirelessMicMainWindow(QMainWindow):
    """主窗口"""
    
    def __init__(self):
        super().__init__()
        
        self.plan = RehearsalPlan()
        self.persistence = PlanPersistence()
        self.rule_engine = FrequencyRuleEngine()
        self.timeline_manager = TimelineStateManager()
        
        self.current_filepath: Optional[str] = None
        self.unsaved_changes = False
        
        self.init_ui()
        self.init_menu()
        self.init_toolbar()
        self.init_statusbar()
        
        self.load_sample_plan()
    
    def init_ui(self):
        """初始化界面"""
        self.setWindowTitle("无线麦频率彩排台")
        self.setMinimumSize(1200, 800)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        layout = QVBoxLayout(central_widget)
        
        header_layout = QHBoxLayout()
        
        plan_name_label = QLabel("方案名称：")
        header_layout.addWidget(plan_name_label)
        
        self.plan_name_edit = QLineEdit()
        self.plan_name_edit.setText(self.plan.name)
        self.plan_name_edit.textChanged.connect(self.on_plan_name_changed)
        header_layout.addWidget(self.plan_name_edit, 1)
        
        self.check_btn = QPushButton("🔍 执行风险检查")
        self.check_btn.setStyleSheet("font-weight: bold; padding: 8px 16px;")
        self.check_btn.clicked.connect(self.run_risk_check)
        header_layout.addWidget(self.check_btn)
        
        self.risk_summary_label = QLabel("风险：未检查")
        self.risk_summary_label.setStyleSheet("font-weight: bold; color: #666;")
        header_layout.addWidget(self.risk_summary_label)
        
        layout.addLayout(header_layout)
        
        self.tab_widget = QTabWidget()
        
        self.mics_tab = MicrophonesTab(self)
        self.tab_widget.addTab(self.mics_tab, "🎤 麦克风清单")
        
        self.schedule_tab = ScheduleTab(self)
        self.tab_widget.addTab(self.schedule_tab, "📅 时间走位表")
        
        self.forbidden_tab = ForbiddenBandsTab(self)
        self.tab_widget.addTab(self.forbidden_tab, "🚫 禁用频段")
        
        self.channels_tab = ChannelsTab(self)
        self.tab_widget.addTab(self.channels_tab, "📻 频道配置")
        
        self.risks_tab = RisksTab(self)
        self.tab_widget.addTab(self.risks_tab, "⚠️ 风险检测")
        
        self.timeline_tab = TimelineTab(self)
        self.tab_widget.addTab(self.timeline_tab, "📊 时间线视图")
        
        layout.addWidget(self.tab_widget, 1)
        
        notes_group = QGroupBox("备注")
        notes_layout = QVBoxLayout(notes_group)
        self.notes_edit = QTextEdit()
        self.notes_edit.setMaximumHeight(80)
        self.notes_edit.textChanged.connect(self.on_notes_changed)
        notes_layout.addWidget(self.notes_edit)
        layout.addWidget(notes_group)
    
    def init_menu(self):
        """初始化菜单栏"""
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        new_action = QAction("新建方案(&N)", self)
        new_action.setShortcut("Ctrl+N")
        new_action.triggered.connect(self.new_plan)
        file_menu.addAction(new_action)
        
        open_action = QAction("打开方案(&O)", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.open_plan)
        file_menu.addAction(open_action)
        
        save_action = QAction("保存方案(&S)", self)
        save_action.setShortcut("Ctrl+S")
        save_action.triggered.connect(self.save_plan)
        file_menu.addAction(save_action)
        
        save_as_action = QAction("另存为(&A)...", self)
        save_as_action.setShortcut("Ctrl+Shift+S")
        save_as_action.triggered.connect(self.save_plan_as)
        file_menu.addAction(save_as_action)
        
        file_menu.addSeparator()
        
        import_menu = file_menu.addMenu("导入数据(&I)")
        
        import_mics_action = QAction("从CSV导入麦克风...", self)
        import_mics_action.triggered.connect(self.import_mics_csv)
        import_menu.addAction(import_mics_action)
        
        import_schedule_action = QAction("从CSV导入时间表...", self)
        import_schedule_action.triggered.connect(self.import_schedule_csv)
        import_menu.addAction(import_schedule_action)
        
        import_forbidden_action = QAction("从CSV导入禁用频段...", self)
        import_forbidden_action.triggered.connect(self.import_forbidden_csv)
        import_menu.addAction(import_forbidden_action)
        
        import_channels_action = QAction("从CSV导入频道配置...", self)
        import_channels_action.triggered.connect(self.import_channels_csv)
        import_menu.addAction(import_channels_action)
        
        file_menu.addSeparator()
        
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_report_action = QAction("导出Markdown报告...", self)
        export_report_action.triggered.connect(self.export_markdown)
        export_menu.addAction(export_report_action)
        
        export_risks_action = QAction("导出风险清单CSV...", self)
        export_risks_action.triggered.connect(self.export_risks_csv)
        export_menu.addAction(export_risks_action)
        
        file_menu.addSeparator()
        
        sample_action = QAction("加载示例方案(&L)", self)
        sample_action.triggered.connect(self.load_sample_plan)
        file_menu.addAction(sample_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        edit_menu = menubar.addMenu("编辑(&E)")
        
        run_check_action = QAction("执行风险检查(&C)", self)
        run_check_action.setShortcut("F5")
        run_check_action.triggered.connect(self.run_risk_check)
        edit_menu.addAction(run_check_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
    
    def init_toolbar(self):
        """初始化工具栏"""
        toolbar = self.addToolBar("主要工具")
        toolbar.setMovable(False)
        
        new_action = QAction("新建", self)
        new_action.triggered.connect(self.new_plan)
        toolbar.addAction(new_action)
        
        open_action = QAction("打开", self)
        open_action.triggered.connect(self.open_plan)
        toolbar.addAction(open_action)
        
        save_action = QAction("保存", self)
        save_action.triggered.connect(self.save_plan)
        toolbar.addAction(save_action)
        
        toolbar.addSeparator()
        
        check_action = QAction("🔍 检查风险", self)
        check_action.triggered.connect(self.run_risk_check)
        toolbar.addAction(check_action)
        
        toolbar.addSeparator()
        
        export_action = QAction("📄 导出报告", self)
        export_action.triggered.connect(self.export_markdown)
        toolbar.addAction(export_action)
    
    def init_statusbar(self):
        """初始化状态栏"""
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("就绪")
    
    def update_ui_from_plan(self):
        """从方案数据更新UI"""
        self.plan_name_edit.setText(self.plan.name)
        self.notes_edit.setPlainText(self.plan.notes)
        
        self.mics_tab.refresh_table()
        self.schedule_tab.refresh_table()
        self.forbidden_tab.refresh_table()
        self.channels_tab.refresh_table()
        self.risks_tab.refresh_table()
        self.timeline_tab.refresh_view()
        
        self.update_risk_summary()
    
    def update_risk_summary(self):
        """更新风险摘要显示"""
        unresolved = [r for r in self.plan.risks if not r.is_resolved]
        
        if not unresolved:
            if self.plan.risks:
                self.risk_summary_label.setText("✅ 所有风险已解决")
                self.risk_summary_label.setStyleSheet("font-weight: bold; color: green;")
            else:
                self.risk_summary_label.setText("风险：未检查")
                self.risk_summary_label.setStyleSheet("font-weight: bold; color: #666;")
        else:
            critical = len([r for r in unresolved if r.level == RiskLevel.CRITICAL])
            high = len([r for r in unresolved if r.level == RiskLevel.HIGH])
            
            if critical > 0:
                self.risk_summary_label.setText(f"🔴 严重风险: {critical} 项 | 高风险: {high} 项")
                self.risk_summary_label.setStyleSheet("font-weight: bold; color: #dc3545;")
            elif high > 0:
                self.risk_summary_label.setText(f"🟠 高风险: {high} 项")
                self.risk_summary_label.setStyleSheet("font-weight: bold; color: #fd7e14;")
            else:
                self.risk_summary_label.setText(f"🟡 存在待处理风险: {len(unresolved)} 项")
                self.risk_summary_label.setStyleSheet("font-weight: bold; color: #ffc107;")
    
    def on_plan_name_changed(self, text):
        """方案名称变更"""
        self.plan.name = text
        self.setWindowTitle(f"无线麦频率彩排台 - {text} *")
        self.unsaved_changes = True
    
    def on_notes_changed(self):
        """备注变更"""
        self.plan.notes = self.notes_edit.toPlainText()
        self.unsaved_changes = True
    
    def run_risk_check(self):
        """执行风险检查"""
        self.statusbar.showMessage("正在执行风险检查...")
        
        all_risks = []
        
        freq_risks = self.rule_engine.check_all(
            self.plan.microphones,
            self.plan.forbidden_bands,
            self.plan.channels
        )
        all_risks.extend(freq_risks)
        
        timeline_risks = self.timeline_manager.check_all(
            self.plan.schedule,
            self.plan.microphones
        )
        all_risks.extend(timeline_risks)
        
        self.plan.risks = all_risks
        
        self.risks_tab.refresh_table()
        self.update_risk_summary()
        
        unresolved = [r for r in all_risks if not r.is_resolved]
        if unresolved:
            self.tab_widget.setCurrentWidget(self.risks_tab)
            self.statusbar.showMessage(f"检查完成，发现 {len(unresolved)} 个待处理风险")
        else:
            self.statusbar.showMessage("检查完成，未发现风险")
        
        self.unsaved_changes = True
    
    def new_plan(self):
        """新建方案"""
        if self.unsaved_changes:
            reply = QMessageBox.question(
                self, "确认",
                "当前方案有未保存的更改，是否保存？",
                QMessageBox.StandardButton.Save | 
                QMessageBox.StandardButton.Discard | 
                QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self.save_plan()
            elif reply == QMessageBox.StandardButton.Cancel:
                return
        
        self.plan = RehearsalPlan()
        self.current_filepath = None
        self.unsaved_changes = False
        self.update_ui_from_plan()
        self.statusbar.showMessage("已创建新方案")
    
    def load_sample_plan(self):
        """加载示例方案"""
        self.plan = create_sample_plan()
        self.current_filepath = None
        self.unsaved_changes = False
        self.update_ui_from_plan()
        self.statusbar.showMessage("已加载示例方案")
    
    def open_plan(self):
        """打开方案"""
        if self.unsaved_changes:
            reply = QMessageBox.question(
                self, "确认",
                "当前方案有未保存的更改，是否保存？",
                QMessageBox.StandardButton.Save | 
                QMessageBox.StandardButton.Discard | 
                QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self.save_plan()
            elif reply == QMessageBox.StandardButton.Cancel:
                return
        
        filepath, _ = QFileDialog.getOpenFileName(
            self, "打开彩排方案", "",
            f"彩排方案文件 (*{self.persistence.FILE_EXTENSION});;所有文件 (*.*)"
        )
        
        if filepath:
            try:
                self.plan = self.persistence.load_plan(filepath)
                self.current_filepath = filepath
                self.unsaved_changes = False
                self.update_ui_from_plan()
                self.statusbar.showMessage(f"已打开：{filepath}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"打开文件失败：{str(e)}")
    
    def save_plan(self):
        """保存方案"""
        if self.current_filepath:
            try:
                self.persistence.save_plan(self.plan, self.current_filepath)
                self.unsaved_changes = False
                self.setWindowTitle(f"无线麦频率彩排台 - {self.plan.name}")
                self.statusbar.showMessage(f"已保存：{self.current_filepath}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存文件失败：{str(e)}")
        else:
            self.save_plan_as()
    
    def save_plan_as(self):
        """另存为"""
        filepath, _ = QFileDialog.getSaveFileName(
            self, "保存彩排方案", "",
            f"彩排方案文件 (*{self.persistence.FILE_EXTENSION});;所有文件 (*.*)"
        )
        
        if filepath:
            if not filepath.endswith(self.persistence.FILE_EXTENSION):
                filepath += self.persistence.FILE_EXTENSION
            
            try:
                saved_path = self.persistence.save_plan(self.plan, filepath)
                self.current_filepath = saved_path
                self.unsaved_changes = False
                self.setWindowTitle(f"无线麦频率彩排台 - {self.plan.name}")
                self.statusbar.showMessage(f"已保存：{saved_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存文件失败：{str(e)}")
    
    def import_mics_csv(self):
        """导入麦克风CSV"""
        filepath, _ = QFileDialog.getOpenFileName(
            self, "导入麦克风数据", "", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if filepath:
            try:
                mics = DataImporter.import_microphones_from_csv(filepath)
                self.plan.microphones = mics
                self.mics_tab.refresh_table()
                self.unsaved_changes = True
                self.statusbar.showMessage(f"已导入 {len(mics)} 条麦克风记录")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入失败：{str(e)}")
    
    def import_schedule_csv(self):
        """导入时间表CSV"""
        filepath, _ = QFileDialog.getOpenFileName(
            self, "导入时间表数据", "", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if filepath:
            try:
                schedule = DataImporter.import_schedule_from_csv(filepath)
                self.plan.schedule = schedule
                self.schedule_tab.refresh_table()
                self.unsaved_changes = True
                self.statusbar.showMessage(f"已导入 {len(schedule)} 条时间表记录")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入失败：{str(e)}")
    
    def import_forbidden_csv(self):
        """导入禁用频段CSV"""
        filepath, _ = QFileDialog.getOpenFileName(
            self, "导入禁用频段数据", "", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if filepath:
            try:
                bands = DataImporter.import_forbidden_bands_from_csv(filepath)
                self.plan.forbidden_bands = bands
                self.forbidden_tab.refresh_table()
                self.unsaved_changes = True
                self.statusbar.showMessage(f"已导入 {len(bands)} 条禁用频段记录")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入失败：{str(e)}")
    
    def import_channels_csv(self):
        """导入频道配置CSV"""
        filepath, _ = QFileDialog.getOpenFileName(
            self, "导入频道配置数据", "", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if filepath:
            try:
                channels = DataImporter.import_channels_from_csv(filepath)
                self.plan.channels = channels
                self.channels_tab.refresh_table()
                self.unsaved_changes = True
                self.statusbar.showMessage(f"已导入 {len(channels)} 条频道记录")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入失败：{str(e)}")
    
    def export_markdown(self):
        """导出Markdown报告"""
        filepath, _ = QFileDialog.getSaveFileName(
            self, "导出Markdown报告", "", "Markdown文件 (*.md);;所有文件 (*.*)"
        )
        
        if filepath:
            if not filepath.endswith('.md'):
                filepath += '.md'
            
            try:
                DataExporter.export_markdown_report(
                    self.plan, filepath, self.plan.risks
                )
                self.statusbar.showMessage(f"报告已导出：{filepath}")
                QMessageBox.information(self, "成功", f"报告已导出到：\n{filepath}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败：{str(e)}")
    
    def export_risks_csv(self):
        """导出风险清单CSV"""
        filepath, _ = QFileDialog.getSaveFileName(
            self, "导出风险清单", "", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if filepath:
            if not filepath.endswith('.csv'):
                filepath += '.csv'
            
            try:
                DataExporter.export_risk_csv(
                    self.plan.risks, filepath, self.plan.microphones
                )
                self.statusbar.showMessage(f"风险清单已导出：{filepath}")
                QMessageBox.information(self, "成功", f"风险清单已导出到：\n{filepath}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败：{str(e)}")
    
    def show_about(self):
        """显示关于对话框"""
        QMessageBox.about(
            self, "关于无线麦频率彩排台",
            """<h3>无线麦频率彩排台</h3>
            <p>版本：1.0.0</p>
            <p>专为小剧场音响师设计的无线麦克风频率管理工具</p>
            <p>功能特点：</p>
            <ul>
                <li>频率间隔检查</li>
                <li>三阶互调干扰检测</li>
                <li>禁用频段检查</li>
                <li>设备电量监控</li>
                <li>备用通道管理</li>
                <li>时间线状态追踪</li>
            </ul>"""
        )
    
    def closeEvent(self, event):
        """窗口关闭事件"""
        if self.unsaved_changes:
            reply = QMessageBox.question(
                self, "确认退出",
                "当前方案有未保存的更改，是否保存？",
                QMessageBox.StandardButton.Save | 
                QMessageBox.StandardButton.Discard | 
                QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self.save_plan()
                if self.unsaved_changes:
                    event.ignore()
                    return
            elif reply == QMessageBox.StandardButton.Cancel:
                event.ignore()
                return
        
        event.accept()


class BaseTableTab(QWidget):
    """表格标签页基类"""
    
    def __init__(self, main_window: WirelessMicMainWindow):
        super().__init__()
        self.main_window = main_window
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        toolbar_layout = QHBoxLayout()
        
        self.add_btn = QPushButton("➕ 添加")
        self.add_btn.clicked.connect(self.add_row)
        toolbar_layout.addWidget(self.add_btn)
        
        self.delete_btn = QPushButton("➖ 删除选中")
        self.delete_btn.clicked.connect(self.delete_selected)
        toolbar_layout.addWidget(self.delete_btn)
        
        toolbar_layout.addStretch()
        
        layout.addLayout(toolbar_layout)
        
        self.table = QTableWidget()
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.ExtendedSelection)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.itemChanged.connect(self.on_item_changed)
        layout.addWidget(self.table)
    
    def refresh_table(self):
        """刷新表格"""
        raise NotImplementedError()
    
    def add_row(self):
        """添加行"""
        raise NotImplementedError()
    
    def delete_selected(self):
        """删除选中行"""
        raise NotImplementedError()
    
    def on_item_changed(self, item: QTableWidgetItem):
        """项目变更"""
        pass


class MicrophonesTab(BaseTableTab):
    """麦克风列表标签页"""
    
    HEADERS = ["设备ID", "演员姓名", "频率(MHz)", "频道", "电量(%)", "备用频率", "备用频道", "备注"]
    
    def init_ui(self):
        super().init_ui()
        self.table.setColumnCount(len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
    
    def refresh_table(self):
        self.table.blockSignals(True)
        self.table.setRowCount(0)
        
        for mic in self.main_window.plan.microphones:
            row = self.table.rowCount()
            self.table.insertRow(row)
            
            self.table.setItem(row, 0, QTableWidgetItem(mic.device_id))
            self.table.setItem(row, 1, QTableWidgetItem(mic.actor_name))
            self.table.setItem(row, 2, QTableWidgetItem(f"{mic.frequency:.2f}" if mic.frequency > 0 else ""))
            self.table.setItem(row, 3, QTableWidgetItem(mic.channel))
            self.table.setItem(row, 4, QTableWidgetItem(f"{mic.battery_level:.0f}"))
            
            backup_freq = f"{mic.backup_frequency:.2f}" if mic.backup_frequency else ""
            self.table.setItem(row, 5, QTableWidgetItem(backup_freq))
            self.table.setItem(row, 6, QTableWidgetItem(mic.backup_channel or ""))
            self.table.setItem(row, 7, QTableWidgetItem(mic.notes))
        
        self.table.blockSignals(False)
    
    def add_row(self):
        mic = Microphone()
        self.main_window.plan.microphones.append(mic)
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def delete_selected(self):
        rows = sorted(set(item.row() for item in self.table.selectedItems()), reverse=True)
        for row in rows:
            if 0 <= row < len(self.main_window.plan.microphones):
                del self.main_window.plan.microphones[row]
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def on_item_changed(self, item: QTableWidgetItem):
        row = item.row()
        col = item.column()
        
        if 0 <= row < len(self.main_window.plan.microphones):
            mic = self.main_window.plan.microphones[row]
            text = item.text().strip()
            
            if col == 0:
                mic.device_id = text
            elif col == 1:
                mic.actor_name = text
            elif col == 2:
                try:
                    mic.frequency = float(text) if text else 0.0
                except ValueError:
                    pass
            elif col == 3:
                mic.channel = text
            elif col == 4:
                try:
                    mic.battery_level = float(text) if text else 100.0
                except ValueError:
                    pass
            elif col == 5:
                try:
                    mic.backup_frequency = float(text) if text else None
                except ValueError:
                    pass
            elif col == 6:
                mic.backup_channel = text if text else None
            elif col == 7:
                mic.notes = text
            
            self.main_window.unsaved_changes = True


class ScheduleTab(BaseTableTab):
    """时间走位表标签页"""
    
    HEADERS = ["场景名称", "开始时间", "结束时间", "演员名单", "备注"]
    
    def init_ui(self):
        super().init_ui()
        self.table.setColumnCount(len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
    
    def refresh_table(self):
        self.table.blockSignals(True)
        self.table.setRowCount(0)
        
        for entry in self.main_window.plan.schedule:
            row = self.table.rowCount()
            self.table.insertRow(row)
            
            self.table.setItem(row, 0, QTableWidgetItem(entry.scene_name))
            
            start_time = entry.start_time.strftime("%H:%M") if entry.start_time else ""
            self.table.setItem(row, 1, QTableWidgetItem(start_time))
            
            end_time = entry.end_time.strftime("%H:%M") if entry.end_time else ""
            self.table.setItem(row, 2, QTableWidgetItem(end_time))
            
            self.table.setItem(row, 3, QTableWidgetItem(", ".join(entry.actor_names)))
            self.table.setItem(row, 4, QTableWidgetItem(entry.notes))
        
        self.table.blockSignals(False)
    
    def add_row(self):
        entry = ScheduleEntry()
        self.main_window.plan.schedule.append(entry)
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def delete_selected(self):
        rows = sorted(set(item.row() for item in self.table.selectedItems()), reverse=True)
        for row in rows:
            if 0 <= row < len(self.main_window.plan.schedule):
                del self.main_window.plan.schedule[row]
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def on_item_changed(self, item: QTableWidgetItem):
        row = item.row()
        col = item.column()
        
        if 0 <= row < len(self.main_window.plan.schedule):
            entry = self.main_window.plan.schedule[row]
            text = item.text().strip()
            
            if col == 0:
                entry.scene_name = text
            elif col == 1:
                try:
                    if text:
                        if ':' in text:
                            parts = text.split(':')
                            h = int(parts[0])
                            m = int(parts[1]) if len(parts) > 1 else 0
                            s = int(parts[2]) if len(parts) > 2 else 0
                            entry.start_time = time(h, m, s)
                        else:
                            entry.start_time = None
                    else:
                        entry.start_time = None
                except ValueError:
                    pass
            elif col == 2:
                try:
                    if text:
                        if ':' in text:
                            parts = text.split(':')
                            h = int(parts[0])
                            m = int(parts[1]) if len(parts) > 1 else 0
                            s = int(parts[2]) if len(parts) > 2 else 0
                            entry.end_time = time(h, m, s)
                        else:
                            entry.end_time = None
                    else:
                        entry.end_time = None
                except ValueError:
                    pass
            elif col == 3:
                entry.actor_names = [n.strip() for n in text.split(',') if n.strip()]
            elif col == 4:
                entry.notes = text
            
            self.main_window.unsaved_changes = True


class ForbiddenBandsTab(BaseTableTab):
    """禁用频段标签页"""
    
    HEADERS = ["频段名称", "起始频率(MHz)", "结束频率(MHz)", "禁用原因"]
    
    def init_ui(self):
        super().init_ui()
        self.table.setColumnCount(len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
    
    def refresh_table(self):
        self.table.blockSignals(True)
        self.table.setRowCount(0)
        
        for band in self.main_window.plan.forbidden_bands:
            row = self.table.rowCount()
            self.table.insertRow(row)
            
            self.table.setItem(row, 0, QTableWidgetItem(band.name))
            self.table.setItem(row, 1, QTableWidgetItem(f"{band.start_freq:.2f}"))
            self.table.setItem(row, 2, QTableWidgetItem(f"{band.end_freq:.2f}"))
            self.table.setItem(row, 3, QTableWidgetItem(band.reason))
        
        self.table.blockSignals(False)
    
    def add_row(self):
        band = ForbiddenBand()
        self.main_window.plan.forbidden_bands.append(band)
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def delete_selected(self):
        rows = sorted(set(item.row() for item in self.table.selectedItems()), reverse=True)
        for row in rows:
            if 0 <= row < len(self.main_window.plan.forbidden_bands):
                del self.main_window.plan.forbidden_bands[row]
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def on_item_changed(self, item: QTableWidgetItem):
        row = item.row()
        col = item.column()
        
        if 0 <= row < len(self.main_window.plan.forbidden_bands):
            band = self.main_window.plan.forbidden_bands[row]
            text = item.text().strip()
            
            if col == 0:
                band.name = text
            elif col == 1:
                try:
                    band.start_freq = float(text) if text else 0.0
                except ValueError:
                    pass
            elif col == 2:
                try:
                    band.end_freq = float(text) if text else 0.0
                except ValueError:
                    pass
            elif col == 3:
                band.reason = text
            
            self.main_window.unsaved_changes = True


class ChannelsTab(BaseTableTab):
    """频道配置标签页"""
    
    HEADERS = ["频道名称", "中心频率(MHz)", "带宽(MHz)", "可用"]
    
    def init_ui(self):
        super().init_ui()
        self.table.setColumnCount(len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
    
    def refresh_table(self):
        self.table.blockSignals(True)
        self.table.setRowCount(0)
        
        for channel in self.main_window.plan.channels:
            row = self.table.rowCount()
            self.table.insertRow(row)
            
            self.table.setItem(row, 0, QTableWidgetItem(channel.channel_name))
            self.table.setItem(row, 1, QTableWidgetItem(f"{channel.center_freq:.2f}"))
            self.table.setItem(row, 2, QTableWidgetItem(f"{channel.bandwidth:.2f}"))
            self.table.setItem(row, 3, QTableWidgetItem("是" if channel.is_available else "否"))
        
        self.table.blockSignals(False)
    
    def add_row(self):
        channel = ChannelInfo()
        self.main_window.plan.channels.append(channel)
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def delete_selected(self):
        rows = sorted(set(item.row() for item in self.table.selectedItems()), reverse=True)
        for row in rows:
            if 0 <= row < len(self.main_window.plan.channels):
                del self.main_window.plan.channels[row]
        self.refresh_table()
        self.main_window.unsaved_changes = True
    
    def on_item_changed(self, item: QTableWidgetItem):
        row = item.row()
        col = item.column()
        
        if 0 <= row < len(self.main_window.plan.channels):
            channel = self.main_window.plan.channels[row]
            text = item.text().strip()
            
            if col == 0:
                channel.channel_name = text
            elif col == 1:
                try:
                    channel.center_freq = float(text) if text else 0.0
                except ValueError:
                    pass
            elif col == 2:
                try:
                    channel.bandwidth = float(text) if text else 0.2
                except ValueError:
                    pass
            elif col == 3:
                channel.is_available = text.lower() in ['是', 'yes', 'true', '1', '可用']
            
            self.main_window.unsaved_changes = True


class RisksTab(BaseTableTab):
    """风险检测标签页"""
    
    HEADERS = ["风险等级", "风险类型", "影响演员", "影响场景", "状态", "描述"]
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        toolbar_layout = QHBoxLayout()
        
        self.refresh_btn = QPushButton("🔄 重新检查")
        self.refresh_btn.clicked.connect(self.main_window.run_risk_check)
        toolbar_layout.addWidget(self.refresh_btn)
        
        self.mark_resolved_btn = QPushButton("✅ 标记已解决")
        self.mark_resolved_btn.clicked.connect(self.mark_resolved)
        toolbar_layout.addWidget(self.mark_resolved_btn)
        
        self.mark_unresolved_btn = QPushButton("🔄 标记待处理")
        self.mark_unresolved_btn.clicked.connect(self.mark_unresolved)
        toolbar_layout.addWidget(self.mark_unresolved_btn)
        
        toolbar_layout.addStretch()
        
        layout.addLayout(toolbar_layout)
        
        self.table = QTableWidget()
        self.table.setColumnCount(len(self.HEADERS))
        self.table.setHorizontalHeaderLabels(self.HEADERS)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableWidget.SelectionMode.ExtendedSelection)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.table)
    
    def refresh_table(self):
        self.table.blockSignals(True)
        self.table.setRowCount(0)
        
        mic_map = {m.id: m for m in self.main_window.plan.microphones}
        
        for risk in sorted(self.main_window.plan.risks, key=lambda r: r.level.value, reverse=True):
            row = self.table.rowCount()
            self.table.insertRow(row)
            
            level_name = {
                RiskLevel.CRITICAL: "🔴 严重",
                RiskLevel.HIGH: "🟠 高",
                RiskLevel.MEDIUM: "🟡 中",
                RiskLevel.LOW: "🟢 低"
            }.get(risk.level, "未知")
            level_item = QTableWidgetItem(level_name)
            if risk.level == RiskLevel.CRITICAL:
                level_item.setBackground(QColor(255, 200, 200))
            elif risk.level == RiskLevel.HIGH:
                level_item.setBackground(QColor(255, 230, 200))
            self.table.setItem(row, 0, level_item)
            
            type_name = {
                RiskType.FREQUENCY_CONFLICT: "频率冲突",
                RiskType.INTERMODULATION: "互调干扰",
                RiskType.FORBIDDEN_BAND: "禁用频段",
                RiskType.LOW_BATTERY: "低电量",
                RiskType.NO_BACKUP: "无备用",
                RiskType.OVERLAP_CHANNEL: "频道重叠"
            }.get(risk.risk_type, "未知")
            self.table.setItem(row, 1, QTableWidgetItem(type_name))
            
            affected_actors = []
            for mic_id in risk.affected_mics:
                mic = mic_map.get(mic_id)
                if mic:
                    affected_actors.append(mic.actor_name)
            self.table.setItem(row, 2, QTableWidgetItem(", ".join(affected_actors)))
            
            self.table.setItem(row, 3, QTableWidgetItem(risk.affected_scene or ""))
            
            status = "✅ 已解决" if risk.is_resolved else "⏳ 待处理"
            status_item = QTableWidgetItem(status)
            if risk.is_resolved:
                status_item.setBackground(QColor(200, 255, 200))
            self.table.setItem(row, 4, status_item)
            
            self.table.setItem(row, 5, QTableWidgetItem(risk.description))
        
        self.table.blockSignals(False)
    
    def mark_resolved(self):
        rows = sorted(set(item.row() for item in self.table.selectedItems()))
        risk_list = sorted(self.main_window.plan.risks, key=lambda r: r.level.value, reverse=True)
        
        for row in rows:
            if 0 <= row < len(risk_list):
                risk_list[row].is_resolved = True
        
        self.refresh_table()
        self.main_window.update_risk_summary()
        self.main_window.unsaved_changes = True
    
    def mark_unresolved(self):
        rows = sorted(set(item.row() for item in self.table.selectedItems()))
        risk_list = sorted(self.main_window.plan.risks, key=lambda r: r.level.value, reverse=True)
        
        for row in rows:
            if 0 <= row < len(risk_list):
                risk_list[row].is_resolved = False
        
        self.refresh_table()
        self.main_window.update_risk_summary()
        self.main_window.unsaved_changes = True


class TimelineTab(QWidget):
    """时间线视图标签页"""
    
    def __init__(self, main_window: WirelessMicMainWindow):
        super().__init__()
        self.main_window = main_window
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        info_label = QLabel("📊 时间线视图 - 显示各场景的麦克风使用情况")
        info_label.setStyleSheet("font-weight: bold; font-size: 14px;")
        layout.addWidget(info_label)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        
        self.content_widget = QWidget()
        self.content_layout = QVBoxLayout(self.content_widget)
        
        scroll.setWidget(self.content_widget)
        layout.addWidget(scroll)
    
    def refresh_view(self):
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        plan = self.main_window.plan
        
        if not plan.schedule:
            label = QLabel("暂无时间走位表数据，请先添加场景。")
            label.setStyleSheet("color: #666; padding: 20px;")
            self.content_layout.addWidget(label)
            return
        
        summary = self.main_window.timeline_manager.generate_timeline_summary(
            plan.schedule, plan.microphones
        )
        
        summary_group = QGroupBox("时间线摘要")
        summary_layout = QVBoxLayout(summary_group)
        
        summary_info = QLabel(
            f"总场景数：{summary['total_scenes']} 个 | "
            f"使用的频率数：{len(summary['frequency_usage'])} 个"
        )
        summary_layout.addWidget(summary_info)
        
        self.content_layout.addWidget(summary_group)
        
        for scene_info in summary['scenes']:
            scene_group = QGroupBox(f"🎬 {scene_info['scene_name']}")
            scene_layout = QVBoxLayout(scene_group)
            
            time_info = QLabel(f"⏰ 时间：{scene_info['start_time']} - {scene_info['end_time']}")
            time_info.setStyleSheet("font-weight: bold;")
            scene_layout.addWidget(time_info)
            
            if scene_info['active_mics']:
                mics_label = QLabel("🎤 活跃麦克风：")
                mics_label.setStyleSheet("font-weight: bold; margin-top: 10px;")
                scene_layout.addWidget(mics_label)
                
                mics_table = QTableWidget()
                mics_table.setColumnCount(4)
                mics_table.setHorizontalHeaderLabels(["演员", "频率(MHz)", "频道", "设备ID"])
                mics_table.setRowCount(len(scene_info['active_mics']))
                mics_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
                mics_table.setMaximumHeight(150)
                
                for i, mic in enumerate(scene_info['active_mics']):
                    mics_table.setItem(i, 0, QTableWidgetItem(mic['actor_name']))
                    mics_table.setItem(i, 1, QTableWidgetItem(f"{mic['frequency']:.2f}"))
                    mics_table.setItem(i, 2, QTableWidgetItem(mic['channel']))
                    mics_table.setItem(i, 3, QTableWidgetItem(mic['id'][:8] + "..."))
                
                scene_layout.addWidget(mics_table)
            else:
                no_mics = QLabel("该场景无活跃麦克风")
                no_mics.setStyleSheet("color: #666;")
                scene_layout.addWidget(no_mics)
            
            self.content_layout.addWidget(scene_group)
        
        if summary['frequency_usage']:
            freq_group = QGroupBox("📻 频率使用统计")
            freq_layout = QVBoxLayout(freq_group)
            
            freq_table = QTableWidget()
            freq_table.setColumnCount(2)
            freq_table.setHorizontalHeaderLabels(["频率", "使用场景/演员"])
            freq_table.setRowCount(len(summary['frequency_usage']))
            freq_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
            freq_table.setMaximumHeight(200)
            
            for i, (freq, usages) in enumerate(sorted(summary['frequency_usage'].items())):
                freq_table.setItem(i, 0, QTableWidgetItem(freq))
                
                usage_text = "; ".join([
                    f"{u['actor']} ({u['scene']})" for u in usages
                ])
                freq_table.setItem(i, 1, QTableWidgetItem(usage_text))
                
                if len(usages) > 1:
                    for col in range(2):
                        item = freq_table.item(i, col)
                        if item:
                            item.setBackground(QColor(255, 200, 200))
            
            freq_layout.addWidget(freq_table)
            
            note = QLabel("⚠️ 红色背景表示该频率在多个场景中被使用")
            note.setStyleSheet("color: #dc3545; font-size: 12px;")
            freq_layout.addWidget(note)
            
            self.content_layout.addWidget(freq_group)
        
        self.content_layout.addStretch()
