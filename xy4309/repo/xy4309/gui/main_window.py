#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
主窗口模块
"""

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QLabel, QStatusBar, QMenuBar, QMenu,
    QAction, QMessageBox, QSplitter, QFileDialog, QPushButton,
    QGroupBox, QTextEdit
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QIcon, QFont

from storage.db_manager import DatabaseManager
from gui.reagent_tab import ReagentTab
from gui.cabinet_tab import CabinetTab
from gui.person_tab import PersonTab
from gui.usage_tab import UsageTab
from gui.inventory_tab import InventoryTab
from gui.inspection_tab import InspectionTab
from gui.alert_tab import AlertTab


class MainWindow(QMainWindow):
    """主窗口类"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        
        # 设置窗口属性
        self.setWindowTitle("危化品柜巡检签收台")
        self.setMinimumSize(1200, 800)
        
        # 创建菜单栏
        self._create_menu_bar()
        
        # 创建中心部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 主布局
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        
        # 创建顶部信息栏
        header_layout = QHBoxLayout()
        
        # 标题
        title_label = QLabel("危化品柜巡检签收台")
        title_font = QFont("Microsoft YaHei", 18, QFont.Bold)
        title_label.setFont(title_font)
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        # 快速操作按钮
        self.refresh_btn = QPushButton("刷新数据")
        self.refresh_btn.clicked.connect(self._refresh_all_tabs)
        header_layout.addWidget(self.refresh_btn)
        
        self.inspection_btn = QPushButton("开始巡检")
        self.inspection_btn.setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;")
        self.inspection_btn.clicked.connect(self._start_inspection)
        header_layout.addWidget(self.inspection_btn)
        
        main_layout.addLayout(header_layout)
        
        # 创建分割器
        splitter = QSplitter(Qt.Horizontal)
        
        # 创建左侧预警面板
        self.alert_panel = self._create_alert_panel()
        splitter.addWidget(self.alert_panel)
        
        # 创建右侧标签页
        self.tab_widget = QTabWidget()
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #CCCCCC;
                border-radius: 4px;
            }
            QTabBar::tab {
                background: #F0F0F0;
                border: 1px solid #CCCCCC;
                border-bottom: none;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
                min-width: 100px;
                padding: 8px 12px;
            }
            QTabBar::tab:selected {
                background: white;
                border-bottom: 1px solid white;
            }
            QTabBar::tab:hover {
                background: #E8E8E8;
            }
        """)
        
        # 创建各个标签页
        self.reagent_tab = ReagentTab(self.db_manager)
        self.cabinet_tab = CabinetTab(self.db_manager)
        self.person_tab = PersonTab(self.db_manager)
        self.usage_tab = UsageTab(self.db_manager)
        self.inventory_tab = InventoryTab(self.db_manager)
        self.inspection_tab = InspectionTab(self.db_manager)
        self.alert_tab = AlertTab(self.db_manager)
        
        # 添加标签页
        self.tab_widget.addTab(self.reagent_tab, "试剂管理")
        self.tab_widget.addTab(self.cabinet_tab, "柜位管理")
        self.tab_widget.addTab(self.person_tab, "责任人管理")
        self.tab_widget.addTab(self.usage_tab, "领用/归还")
        self.tab_widget.addTab(self.inventory_tab, "盘点管理")
        self.tab_widget.addTab(self.inspection_tab, "巡检报告")
        self.tab_widget.addTab(self.alert_tab, "预警中心")
        
        splitter.addWidget(self.tab_widget)
        
        # 设置分割器比例
        splitter.setSizes([300, 900])
        
        main_layout.addWidget(splitter)
        
        # 创建状态栏
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪 | 数据已加载")
        
        # 初始化数据
        self._refresh_all_tabs()
    
    def _create_menu_bar(self):
        """创建菜单栏"""
        menubar = self.menuBar()
        
        # 文件菜单
        file_menu = menubar.addMenu("文件(&F)")
        
        # 导入试剂
        import_reagent_action = QAction("导入试剂数据...", self)
        import_reagent_action.triggered.connect(self._import_reagents)
        file_menu.addAction(import_reagent_action)
        
        # 导出试剂
        export_reagent_action = QAction("导出试剂数据...", self)
        export_reagent_action.triggered.connect(self._export_reagents)
        file_menu.addAction(export_reagent_action)
        
        file_menu.addSeparator()
        
        # 退出
        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 工具菜单
        tool_menu = menubar.addMenu("工具(&T)")
        
        # 刷新
        refresh_action = QAction("刷新数据", self)
        refresh_action.triggered.connect(self._refresh_all_tabs)
        tool_menu.addAction(refresh_action)
        
        tool_menu.addSeparator()
        
        # 开始巡检
        inspection_action = QAction("开始巡检", self)
        inspection_action.triggered.connect(self._start_inspection)
        tool_menu.addAction(inspection_action)
        
        # 帮助菜单
        help_menu = menubar.addMenu("帮助(&H)")
        
        # 关于
        about_action = QAction("关于", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _create_alert_panel(self) -> QGroupBox:
        """创建预警面板"""
        group_box = QGroupBox("实时预警")
        layout = QVBoxLayout(group_box)
        
        # 预警列表
        self.alert_text = QTextEdit()
        self.alert_text.setReadOnly(True)
        self.alert_text.setStyleSheet("""
            QTextEdit {
                background-color: #FFF8E7;
                border: 1px solid #FFB74D;
                border-radius: 4px;
                padding: 5px;
            }
        """)
        layout.addWidget(self.alert_text)
        
        # 按钮区域
        btn_layout = QHBoxLayout()
        
        view_all_btn = QPushButton("查看全部预警")
        view_all_btn.clicked.connect(self._go_to_alert_tab)
        btn_layout.addWidget(view_all_btn)
        
        resolve_btn = QPushButton("标记已处理")
        resolve_btn.clicked.connect(self._resolve_selected_alert)
        btn_layout.addWidget(resolve_btn)
        
        layout.addLayout(btn_layout)
        
        return group_box
    
    def _refresh_all_tabs(self):
        """刷新所有标签页数据"""
        self.reagent_tab.refresh_data()
        self.cabinet_tab.refresh_data()
        self.person_tab.refresh_data()
        self.usage_tab.refresh_data()
        self.inventory_tab.refresh_data()
        self.inspection_tab.refresh_data()
        self.alert_tab.refresh_data()
        
        # 更新预警面板
        self._update_alert_panel()
        
        self.status_bar.showMessage("数据已刷新 | " + self._get_current_datetime())
    
    def _update_alert_panel(self):
        """更新预警面板"""
        alerts = self.db_manager.get_unresolved_alerts()
        
        if not alerts:
            self.alert_text.setHtml("<div style='color: green; font-weight: bold;'>✓ 暂无未处理的预警</div>")
            return
        
        html_parts = []
        for alert in alerts:
            alert_type = alert.alert_type.value
            if alert_type == "过期预警":
                color = "#FF0000"
            elif alert_type == "即将过期":
                color = "#FF6600"
            elif alert_type == "库存不足":
                color = "#CC6600"
            elif alert_type == "超期未归还":
                color = "#990000"
            else:
                color = "#CC0000"
            
            html_parts.append(f"""
                <div style='margin: 5px 0; padding: 8px; background-color: #FFF; border-left: 4px solid {color}; border-radius: 2px;'>
                    <div style='font-weight: bold; color: {color};'>⚠ {alert_type}</div>
                    <div style='margin-top: 3px; font-size: 12px;'>
                        <b>{alert.reagent_name}</b> ({alert.bottle_number})
                    </div>
                    <div style='margin-top: 2px; font-size: 11px; color: #666;'>
                        {alert.message}
                    </div>
                </div>
            """)
        
        self.alert_text.setHtml("".join(html_parts))
    
    def _start_inspection(self):
        """开始巡检"""
        self.tab_widget.setCurrentWidget(self.inspection_tab)
        self.status_bar.showMessage("已切换到巡检报告页面")
    
    def _go_to_alert_tab(self):
        """跳转到预警标签页"""
        self.tab_widget.setCurrentWidget(self.alert_tab)
        self.status_bar.showMessage("已切换到预警中心页面")
    
    def _resolve_selected_alert(self):
        """标记选中的预警为已处理"""
        QMessageBox.information(self, "提示", "请在预警中心页面选择并处理预警")
        self._go_to_alert_tab()
    
    def _import_reagents(self):
        """导入试剂数据"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择试剂数据文件", "",
            "CSV 文件 (*.csv);;JSON 文件 (*.json);;所有文件 (*.*)"
        )
        
        if file_path:
            QMessageBox.information(self, "提示", f"导入功能已准备就绪\n文件: {file_path}\n\n请在试剂管理页面使用导入功能")
            self.tab_widget.setCurrentWidget(self.reagent_tab)
    
    def _export_reagents(self):
        """导出试剂数据"""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存试剂数据文件", "",
            "CSV 文件 (*.csv);;JSON 文件 (*.json);;所有文件 (*.*)"
        )
        
        if file_path:
            QMessageBox.information(self, "提示", f"导出功能已准备就绪\n文件: {file_path}\n\n请在试剂管理页面使用导出功能")
            self.tab_widget.setCurrentWidget(self.reagent_tab)
    
    def _show_about(self):
        """显示关于对话框"""
        QMessageBox.about(
            self,
            "关于 危化品柜巡检签收台",
            """
            <h3>危化品柜巡检签收台</h3>
            <p>版本: 1.0.0</p>
            <p>用于校园实验室危化品柜的日常巡检、盘点和领用管理</p>
            <p>主要功能:</p>
            <ul>
                <li>试剂、柜位、责任人管理</li>
                <li>领用/归还流水记录</li>
                <li>扫码或输入瓶号盘点</li>
                <li>自动校验过期、库存下限、同柜禁配、未归还超期</li>
                <li>生成 Markdown 报告和 CSV 异常清单</li>
            </ul>
            <p>技术: Python + PyQt5 + SQLite</p>
            """
        )
    
    @staticmethod
    def _get_current_datetime() -> str:
        """获取当前日期时间字符串"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def closeEvent(self, event):
        """窗口关闭事件"""
        reply = QMessageBox.question(
            self, '确认退出',
            "确定要退出危化品柜巡检签收台吗？\n\n数据已自动保存。",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            event.accept()
        else:
            event.ignore()
