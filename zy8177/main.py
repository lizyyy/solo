#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
青光眼视野检查复核工具
用于眼科技师复核Humphrey视野检查结果
"""

import sys
import os
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QMenuBar, QMenu, QAction, QFileDialog, QMessageBox,
    QSplitter, QLabel, QTableWidget, QTableWidgetItem, QHeaderView,
    QGroupBox, QGridLayout, QPushButton, QComboBox, QStatusBar,
    QToolBar, QSpinBox, QDoubleSpinBox, QCheckBox, QTextEdit,
    QSplitter, QFrame
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QFont, QIcon

# 导入我们的模块
from models.data_models import PatientData, VisualFieldTest, ReliabilityRules
from services.data_importer import DataImporter
from services.data_processor import DataProcessor
from services.state_manager import StateManager
from services.exporter import Exporter
from ui.heatmap_widget import HeatmapWidget
from ui.reliability_widget import ReliabilityWidget
from ui.progress_widget import ProgressWidget
from ui.confirmation_widget import ConfirmationWidget


class GlaucomaReviewApp(QMainWindow):
    """主应用窗口"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("青光眼视野检查复核工具")
        self.setMinimumSize(1400, 900)
        
        # 初始化数据
        self.patient_data = None
        self.reliability_rules = None
        self.state_manager = StateManager()
        self.data_processor = None
        
        # 初始化UI
        self.init_ui()
        self.create_menu_bar()
        self.create_tool_bar()
        self.create_status_bar()
        
        # 连接信号和槽
        self.connect_signals()
        
    def init_ui(self):
        """初始化用户界面"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # 顶部信息栏
        info_group = QGroupBox("患者信息")
        info_layout = QHBoxLayout(info_group)
        
        self.patient_name_label = QLabel("患者姓名: 未加载")
        self.patient_id_label = QLabel("患者ID: 未加载")
        self.study_date_label = QLabel("检查日期: 未加载")
        
        info_layout.addWidget(self.patient_name_label)
        info_layout.addWidget(self.patient_id_label)
        info_layout.addWidget(self.study_date_label)
        info_layout.addStretch()
        
        main_layout.addWidget(info_group)
        
        # 主内容区域 - 使用分割器
        main_splitter = QSplitter(Qt.Horizontal)
        
        # 左侧：热力图和可靠性评分
        left_group = QGroupBox("视野检查结果")
        left_layout = QVBoxLayout(left_group)
        
        # 眼别选择
        eye_selector = QHBoxLayout()
        eye_selector.addWidget(QLabel("选择眼别:"))
        self.eye_combo = QComboBox()
        self.eye_combo.addItems(["左眼", "右眼", "双眼对比"])
        eye_selector.addWidget(self.eye_combo)
        eye_selector.addStretch()
        left_layout.addLayout(eye_selector)
        
        # 热力图
        self.heatmap_widget = HeatmapWidget()
        left_layout.addWidget(self.heatmap_widget, 1)
        
        # 可靠性评分
        self.reliability_widget = ReliabilityWidget()
        left_layout.addWidget(self.reliability_widget)
        
        main_splitter.addWidget(left_group)
        
        # 右侧：疑似进展和待确认列表
        right_splitter = QSplitter(Qt.Vertical)
        
        # 疑似进展点位
        progress_group = QGroupBox("疑似进展点位")
        progress_layout = QVBoxLayout(progress_group)
        
        self.progress_widget = ProgressWidget()
        progress_layout.addWidget(self.progress_widget)
        
        right_splitter.addWidget(progress_group)
        
        # 待人工确认列表
        confirm_group = QGroupBox("待人工确认列表")
        confirm_layout = QVBoxLayout(confirm_group)
        
        self.confirmation_widget = ConfirmationWidget()
        confirm_layout.addWidget(self.confirmation_widget)
        
        # 操作按钮
        button_layout = QHBoxLayout()
        
        self.confirm_all_btn = QPushButton("全部确认")
        self.confirm_selected_btn = QPushButton("确认选中")
        self.reject_btn = QPushButton("标记为异常")
        self.add_note_btn = QPushButton("添加备注")
        
        button_layout.addWidget(self.confirm_all_btn)
        button_layout.addWidget(self.confirm_selected_btn)
        button_layout.addWidget(self.reject_btn)
        button_layout.addWidget(self.add_note_btn)
        button_layout.addStretch()
        
        confirm_layout.addLayout(button_layout)
        
        right_splitter.addWidget(confirm_group)
        right_splitter.setSizes([400, 400])
        
        main_splitter.addWidget(right_splitter)
        main_splitter.setSizes([700, 700])
        
        main_layout.addWidget(main_splitter, 1)
        
    def create_menu_bar(self):
        """创建菜单栏"""
        menubar = self.menuBar()
        
        # 文件菜单
        file_menu = menubar.addMenu("文件(&F)")
        
        # 导入检查点位CSV
        import_csv_action = QAction("导入检查点位 CSV...", self)
        import_csv_action.setShortcut("Ctrl+I")
        import_csv_action.triggered.connect(self.import_csv)
        file_menu.addAction(import_csv_action)
        
        # 导入患者随访JSON
        import_json_action = QAction("导入患者随访 JSON...", self)
        import_json_action.setShortcut("Ctrl+J")
        import_json_action.triggered.connect(self.import_json)
        file_menu.addAction(import_json_action)
        
        # 导入可靠性规则YAML
        import_yaml_action = QAction("导入可靠性规则 YAML...", self)
        import_yaml_action.setShortcut("Ctrl+Y")
        import_yaml_action.triggered.connect(self.import_yaml)
        file_menu.addAction(import_yaml_action)
        
        # 导入历史报告
        import_history_action = QAction("导入历史报告...", self)
        import_history_action.setShortcut("Ctrl+H")
        import_history_action.triggered.connect(self.import_history)
        file_menu.addAction(import_history_action)
        
        file_menu.addSeparator()
        
        # 保存状态
        save_state_action = QAction("保存状态", self)
        save_state_action.setShortcut("Ctrl+S")
        save_state_action.triggered.connect(self.save_state)
        file_menu.addAction(save_state_action)
        
        # 加载状态
        load_state_action = QAction("加载状态", self)
        load_state_action.setShortcut("Ctrl+L")
        load_state_action.triggered.connect(self.load_state)
        file_menu.addAction(load_state_action)
        
        file_menu.addSeparator()
        
        # 导出
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_issues_action = QAction("导出 issues.csv", self)
        export_issues_action.setShortcut("Ctrl+E")
        export_issues_action.triggered.connect(self.export_issues)
        export_menu.addAction(export_issues_action)
        
        export_report_action = QAction("导出 review_report.md", self)
        export_report_action.setShortcut("Ctrl+R")
        export_report_action.triggered.connect(self.export_report)
        export_menu.addAction(export_report_action)
        
        file_menu.addSeparator()
        
        # 退出
        exit_action = QAction("退出", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 视图菜单
        view_menu = menubar.addMenu("视图(&V)")
        
        # 刷新视图
        refresh_action = QAction("刷新视图", self)
        refresh_action.setShortcut("F5")
        refresh_action.triggered.connect(self.refresh_view)
        view_menu.addAction(refresh_action)
        
        # 帮助菜单
        help_menu = menubar.addMenu("帮助(&H)")
        
        # 关于
        about_action = QAction("关于", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
        
    def create_tool_bar(self):
        """创建工具栏"""
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        # 导入CSV
        import_csv_action = QAction("导入CSV", self)
        import_csv_action.triggered.connect(self.import_csv)
        toolbar.addAction(import_csv_action)
        
        # 导入JSON
        import_json_action = QAction("导入JSON", self)
        import_json_action.triggered.connect(self.import_json)
        toolbar.addAction(import_json_action)
        
        toolbar.addSeparator()
        
        # 保存状态
        save_state_action = QAction("保存状态", self)
        save_state_action.triggered.connect(self.save_state)
        toolbar.addAction(save_state_action)
        
        toolbar.addSeparator()
        
        # 导出
        export_action = QAction("导出报告", self)
        export_action.triggered.connect(self.export_report)
        toolbar.addAction(export_action)
        
    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")
        
    def connect_signals(self):
        """连接信号和槽"""
        self.eye_combo.currentTextChanged.connect(self.on_eye_changed)
        self.confirm_all_btn.clicked.connect(self.confirm_all)
        self.confirm_selected_btn.clicked.connect(self.confirm_selected)
        self.reject_btn.clicked.connect(self.mark_as_abnormal)
        self.add_note_btn.clicked.connect(self.add_note)
        
    def import_csv(self):
        """导入检查点位CSV"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择检查点位CSV文件", "", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                self.status_bar.showMessage(f"正在导入: {file_path}")
                test_data = DataImporter.import_csv(file_path)
                
                if self.patient_data is None:
                    self.patient_data = PatientData()
                
                # 确定眼别
                eye = self.detect_eye(test_data)
                if eye == "left":
                    self.patient_data.left_eye = test_data
                elif eye == "right":
                    self.patient_data.right_eye = test_data
                else:
                    # 让用户选择眼别
                    eye_choice = QMessageBox.question(
                        self, "选择眼别", 
                        "无法自动检测眼别，请选择：",
                        QMessageBox.Yes | QMessageBox.No
                    )
                    if eye_choice == QMessageBox.Yes:
                        self.patient_data.left_eye = test_data
                    else:
                        self.patient_data.right_eye = test_data
                
                self.process_data()
                self.update_ui()
                self.status_bar.showMessage(f"成功导入: {file_path}")
                QMessageBox.information(self, "导入成功", f"检查点位数据已导入")
                
            except Exception as e:
                QMessageBox.critical(self, "导入失败", f"导入CSV时出错: {str(e)}")
                self.status_bar.showMessage("导入失败")
                
    def import_json(self):
        """导入患者随访JSON"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择患者随访JSON文件", "", "JSON文件 (*.json);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                self.status_bar.showMessage(f"正在导入: {file_path}")
                patient_data = DataImporter.import_json(file_path)
                
                if self.patient_data is None:
                    self.patient_data = patient_data
                else:
                    # 合并数据
                    self.patient_data.merge(patient_data)
                
                self.process_data()
                self.update_ui()
                self.status_bar.showMessage(f"成功导入: {file_path}")
                QMessageBox.information(self, "导入成功", f"患者随访数据已导入")
                
            except Exception as e:
                QMessageBox.critical(self, "导入失败", f"导入JSON时出错: {str(e)}")
                self.status_bar.showMessage("导入失败")
                
    def import_yaml(self):
        """导入可靠性规则YAML"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择可靠性规则YAML文件", "", "YAML文件 (*.yaml *.yml);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                self.status_bar.showMessage(f"正在导入: {file_path}")
                self.reliability_rules = DataImporter.import_yaml(file_path)
                
                if self.data_processor:
                    self.data_processor.reliability_rules = self.reliability_rules
                    self.process_data()
                
                self.update_ui()
                self.status_bar.showMessage(f"成功导入: {file_path}")
                QMessageBox.information(self, "导入成功", f"可靠性规则已导入")
                
            except Exception as e:
                QMessageBox.critical(self, "导入失败", f"导入YAML时出错: {str(e)}")
                self.status_bar.showMessage("导入失败")
                
    def import_history(self):
        """导入历史报告"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择历史报告文件", "", "所有支持的文件 (*.csv *.json *.yaml *.yml);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                self.status_bar.showMessage(f"正在导入历史报告: {file_path}")
                # 根据文件扩展名处理
                if file_path.endswith('.csv'):
                    history_data = DataImporter.import_csv(file_path)
                elif file_path.endswith('.json'):
                    history_data = DataImporter.import_json(file_path)
                elif file_path.endswith('.yaml') or file_path.endswith('.yml'):
                    # 假设是可靠性规则
                    history_rules = DataImporter.import_yaml(file_path)
                    if self.reliability_rules is None:
                        self.reliability_rules = history_rules
                    else:
                        # 合并规则
                        self.reliability_rules.merge(history_rules)
                    
                    if self.data_processor:
                        self.data_processor.reliability_rules = self.reliability_rules
                else:
                    raise ValueError(f"不支持的文件格式: {file_path}")
                
                # 处理历史数据
                if isinstance(history_data, VisualFieldTest) and self.patient_data:
                    # 添加到历史记录
                    eye = self.detect_eye(history_data)
                    if eye == "left" and self.patient_data.left_eye_history:
                        self.patient_data.left_eye_history.append(history_data)
                    elif eye == "right" and self.patient_data.right_eye_history:
                        self.patient_data.right_eye_history.append(history_data)
                
                self.process_data()
                self.update_ui()
                self.status_bar.showMessage(f"成功导入历史报告: {file_path}")
                QMessageBox.information(self, "导入成功", f"历史报告已导入")
                
            except Exception as e:
                QMessageBox.critical(self, "导入失败", f"导入历史报告时出错: {str(e)}")
                self.status_bar.showMessage("导入失败")
                
    def save_state(self):
        """保存状态"""
        if self.patient_data is None:
            QMessageBox.warning(self, "警告", "没有数据可保存")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存状态文件", "", "状态文件 (*.state);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                self.state_manager.save_state(
                    file_path, 
                    self.patient_data, 
                    self.reliability_rules,
                    self.confirmation_widget.get_confirmation_states()
                )
                self.status_bar.showMessage(f"状态已保存到: {file_path}")
                QMessageBox.information(self, "保存成功", f"状态已保存到: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "保存失败", f"保存状态时出错: {str(e)}")
                self.status_bar.showMessage("保存失败")
                
    def load_state(self):
        """加载状态"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "加载状态文件", "", "状态文件 (*.state);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                state_data = self.state_manager.load_state(file_path)
                
                self.patient_data = state_data.get('patient_data')
                self.reliability_rules = state_data.get('reliability_rules')
                confirmation_states = state_data.get('confirmation_states', {})
                
                if self.reliability_rules and self.data_processor:
                    self.data_processor.reliability_rules = self.reliability_rules
                
                self.process_data()
                self.confirmation_widget.set_confirmation_states(confirmation_states)
                self.update_ui()
                
                self.status_bar.showMessage(f"状态已从: {file_path} 加载")
                QMessageBox.information(self, "加载成功", f"状态已从: {file_path} 加载")
                
            except Exception as e:
                QMessageBox.critical(self, "加载失败", f"加载状态时出错: {str(e)}")
                self.status_bar.showMessage("加载失败")
                
    def export_issues(self):
        """导出issues.csv"""
        if self.patient_data is None:
            QMessageBox.warning(self, "警告", "没有数据可导出")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出 issues.csv", "issues.csv", "CSV文件 (*.csv);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                Exporter.export_issues(
                    file_path, 
                    self.patient_data, 
                    self.data_processor,
                    self.confirmation_widget.get_confirmation_states()
                )
                self.status_bar.showMessage(f"已导出到: {file_path}")
                QMessageBox.information(self, "导出成功", f"issues.csv 已导出到: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "导出失败", f"导出issues.csv时出错: {str(e)}")
                self.status_bar.showMessage("导出失败")
                
    def export_report(self):
        """导出review_report.md"""
        if self.patient_data is None:
            QMessageBox.warning(self, "警告", "没有数据可导出")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出 review_report.md", "review_report.md", "Markdown文件 (*.md);;所有文件 (*.*)"
        )
        
        if file_path:
            try:
                Exporter.export_report(
                    file_path, 
                    self.patient_data, 
                    self.data_processor,
                    self.confirmation_widget.get_confirmation_states()
                )
                self.status_bar.showMessage(f"已导出到: {file_path}")
                QMessageBox.information(self, "导出成功", f"review_report.md 已导出到: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "导出失败", f"导出review_report.md时出错: {str(e)}")
                self.status_bar.showMessage("导出失败")
                
    def process_data(self):
        """处理数据"""
        if self.patient_data is None:
            return
        
        # 初始化数据处理器
        if self.data_processor is None:
            self.data_processor = DataProcessor(self.reliability_rules)
        
        # 处理数据
        self.data_processor.process(self.patient_data)
        
    def update_ui(self):
        """更新UI"""
        if self.patient_data is None:
            return
        
        # 更新患者信息
        if self.patient_data.patient_name:
            self.patient_name_label.setText(f"患者姓名: {self.patient_data.patient_name}")
        if self.patient_data.patient_id:
            self.patient_id_label.setText(f"患者ID: {self.patient_data.patient_id}")
        
        # 更新最新检查日期
        latest_date = self.patient_data.get_latest_test_date()
        if latest_date:
            self.study_date_label.setText(f"检查日期: {latest_date}")
        
        # 更新热力图
        self.update_heatmap()
        
        # 更新可靠性评分
        self.update_reliability()
        
        # 更新疑似进展点位
        self.update_progress()
        
        # 更新待确认列表
        self.update_confirmation_list()
        
    def update_heatmap(self):
        """更新热力图"""
        current_eye = self.eye_combo.currentText()
        
        if current_eye == "左眼" and self.patient_data.left_eye:
            self.heatmap_widget.set_data(self.patient_data.left_eye, "left")
        elif current_eye == "右眼" and self.patient_data.right_eye:
            self.heatmap_widget.set_data(self.patient_data.right_eye, "right")
        elif current_eye == "双眼对比":
            # 显示双眼对比
            self.heatmap_widget.set_comparison_data(
                self.patient_data.left_eye, 
                self.patient_data.right_eye
            )
            
    def update_reliability(self):
        """更新可靠性评分"""
        if self.data_processor is None:
            return
        
        current_eye = self.eye_combo.currentText()
        
        if current_eye == "左眼":
            reliability = self.data_processor.left_eye_reliability
        elif current_eye == "右眼":
            reliability = self.data_processor.right_eye_reliability
        else:
            # 双眼对比，显示平均或分别显示
            reliability = None
            
        if reliability:
            self.reliability_widget.set_reliability(reliability)
            
    def update_progress(self):
        """更新疑似进展点位"""
        if self.data_processor is None:
            return
        
        current_eye = self.eye_combo.currentText()
        
        if current_eye == "左眼":
            progress_points = self.data_processor.left_eye_progress
        elif current_eye == "右眼":
            progress_points = self.data_processor.right_eye_progress
        else:
            # 双眼对比，合并显示
            progress_points = []
            if self.data_processor.left_eye_progress:
                progress_points.extend([("左眼", p) for p in self.data_processor.left_eye_progress])
            if self.data_processor.right_eye_progress:
                progress_points.extend([("右眼", p) for p in self.data_processor.right_eye_progress])
        
        self.progress_widget.set_progress_points(progress_points)
        
    def update_confirmation_list(self):
        """更新待确认列表"""
        if self.data_processor is None:
            return
        
        # 合并所有需要确认的项目
        confirmation_items = []
        
        # 可靠性问题
        if self.data_processor.left_eye_reliability:
            for issue in self.data_processor.left_eye_reliability.get('issues', []):
                confirmation_items.append({
                    'type': 'reliability',
                    'eye': 'left',
                    'issue': issue,
                    'description': f"左眼可靠性问题: {issue}"
                })
                
        if self.data_processor.right_eye_reliability:
            for issue in self.data_processor.right_eye_reliability.get('issues', []):
                confirmation_items.append({
                    'type': 'reliability',
                    'eye': 'right',
                    'issue': issue,
                    'description': f"右眼可靠性问题: {issue}"
                })
        
        # 疑似进展点位
        if self.data_processor.left_eye_progress:
            for point in self.data_processor.left_eye_progress:
                confirmation_items.append({
                    'type': 'progress',
                    'eye': 'left',
                    'point': point,
                    'description': f"左眼疑似进展点位: {point}"
                })
                
        if self.data_processor.right_eye_progress:
            for point in self.data_processor.right_eye_progress:
                confirmation_items.append({
                    'type': 'progress',
                    'eye': 'right',
                    'point': point,
                    'description': f"右眼疑似进展点位: {point}"
                })
        
        # 数据质量问题
        if self.data_processor.data_quality_issues:
            for issue in self.data_processor.data_quality_issues:
                confirmation_items.append({
                    'type': 'data_quality',
                    'issue': issue,
                    'description': f"数据质量问题: {issue}"
                })
        
        self.confirmation_widget.set_items(confirmation_items)
        
    def on_eye_changed(self, eye):
        """眼别改变事件"""
        self.update_heatmap()
        self.update_reliability()
        self.update_progress()
        
    def confirm_all(self):
        """全部确认"""
        self.confirmation_widget.confirm_all()
        self.status_bar.showMessage("已全部确认")
        
    def confirm_selected(self):
        """确认选中"""
        self.confirmation_widget.confirm_selected()
        self.status_bar.showMessage("已确认选中项")
        
    def mark_as_abnormal(self):
        """标记为异常"""
        self.confirmation_widget.mark_as_abnormal()
        self.status_bar.showMessage("已标记为异常")
        
    def add_note(self):
        """添加备注"""
        self.confirmation_widget.add_note()
        
    def refresh_view(self):
        """刷新视图"""
        self.process_data()
        self.update_ui()
        self.status_bar.showMessage("视图已刷新")
        
    def show_about(self):
        """显示关于对话框"""
        QMessageBox.about(
            self,
            "关于",
            "<h2>青光眼视野检查复核工具</h2>"
            "<p>版本: 1.0.0</p>"
            "<p>用于眼科技师复核Humphrey视野检查结果</p>"
            "<p>功能包括:</p>"
            "<ul>"
            "<li>导入检查点位CSV、患者随访JSON、设备可靠性规则YAML</li>"
            "<li>显示左右眼热力图</li>"
            "<li>显示可靠性评分</li>"
            "<li>显示疑似进展点位</li>"
            "<li>待人工确认列表</li>"
            "<li>本地保存确认状态</li>"
            "<li>导出issues.csv和review_report.md</li>"
            "</ul>"
            "<p>处理以下特殊情况:</p>"
            "<ul>"
            "<li>固视丢失过高</li>"
            "<li>左右眼混录</li>"
            "<li>缺失点位</li>"
            "<li>跨日期随访排序</li>"
            "</ul>"
        )
        
    def detect_eye(self, test_data):
        """检测眼别"""
        # 尝试从数据中检测眼别
        if hasattr(test_data, 'eye'):
            if test_data.eye == 'left' or test_data.eye == '左眼':
                return 'left'
            elif test_data.eye == 'right' or test_data.eye == '右眼':
                return 'right'
        
        # 尝试从点位分布检测
        if hasattr(test_data, 'points') and test_data.points:
            # 简单的启发式方法：检查点位的x坐标分布
            left_x_count = sum(1 for p in test_data.points if p.get('x', 0) < 0)
            right_x_count = sum(1 for p in test_data.points if p.get('x', 0) > 0)
            
            if left_x_count > right_x_count:
                return 'right'  # 右眼检查通常左眼视野点位更多
            elif right_x_count > left_x_count:
                return 'left'  # 左眼检查通常右眼视野点位更多
        
        return 'unknown'


def main():
    """主函数"""
    app = QApplication(sys.argv)
    app.setStyle('Fusion')  # 使用现代风格
    
    # 创建主窗口
    window = GlaucomaReviewApp()
    window.show()
    
    # 运行应用
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
