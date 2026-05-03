import sys
import os
from typing import Optional, List
from datetime import datetime

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QMenuBar, QMenu, QToolBar, QStatusBar,
    QMessageBox, QFileDialog, QTabWidget, QLabel,
    QAction, QApplication, QSplitter
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QIcon, QFont

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from models.case import Case, CaseStatus
from models.risk import RiskStatus
from storage.case_storage import CaseStorage
from storage.review_manager import ReviewManager
from rules.rule_engine import RuleEngine
from rules.risk_rules import (
    HypothermiaRule, SpO2DropRule, MedicationOverdueRule,
    RecoveryScoreRule, HypotensionRule, HypertensionRule,
    TachycardiaRule, BradycardiaRule
)
from rules.rule_config import DEFAULT_RULE_CONFIG
from parsers.csv_parser import CSVParser
from parsers.json_parser import JSONParser
from exports.markdown_exporter import MarkdownExporter
from exports.csv_exporter import CSVExporter, VitalSignsCSVExporter, MedicationCSVExporter
from exports.json_audit_exporter import JSONAuditExporter

from .timeline_widget import TimelineWidget
from .risk_table_widget import RiskTableWidget
from .risk_detail_widget import RiskDetailWidget


class MainWindow(QMainWindow):
    """
    麻醉监护复盘板主窗口
    """
    
    def __init__(self):
        super().__init__()
        
        # 初始化核心组件
        self.storage = CaseStorage()
        self.review_manager = ReviewManager()
        self.rule_engine = RuleEngine(DEFAULT_RULE_CONFIG)
        
        # 注册规则
        self._register_rules()
        
        # 当前病例
        self.current_case: Optional[Case] = None
        
        # 设置窗口
        self.setWindowTitle("麻醉监护复盘板")
        self.setMinimumSize(1200, 800)
        
        # 创建UI
        self._create_menu_bar()
        self._create_tool_bar()
        self._create_status_bar()
        self._create_central_widget()
        
        # 更新状态
        self._update_status()
    
    def _register_rules(self):
        """
        注册所有规则
        """
        rules = [
            HypothermiaRule(),
            SpO2DropRule(),
            MedicationOverdueRule(),
            RecoveryScoreRule(),
            HypotensionRule(),
            HypertensionRule(),
            TachycardiaRule(),
            BradycardiaRule()
        ]
        
        self.rule_engine.register_rules(rules)
    
    def _create_menu_bar(self):
        """
        创建菜单栏
        """
        menubar = self.menuBar()
        
        # 文件菜单
        file_menu = menubar.addMenu("文件(&F)")
        
        # 新建病例
        new_case_action = QAction("新建病例(&N)", self)
        new_case_action.setShortcut("Ctrl+N")
        new_case_action.triggered.connect(self._new_case)
        file_menu.addAction(new_case_action)
        
        file_menu.addSeparator()
        
        # 导入数据
        import_menu = file_menu.addMenu("导入(&I)")
        
        import_csv_action = QAction("导入监护仪CSV(&C)", self)
        import_csv_action.setShortcut("Ctrl+Shift+C")
        import_csv_action.triggered.connect(self._import_csv)
        import_menu.addAction(import_csv_action)
        
        import_json_action = QAction("导入给药记录JSON(&J)", self)
        import_json_action.setShortcut("Ctrl+Shift+J")
        import_json_action.triggered.connect(self._import_json)
        import_menu.addAction(import_json_action)
        
        file_menu.addSeparator()
        
        # 保存病例
        save_case_action = QAction("保存病例(&S)", self)
        save_case_action.setShortcut("Ctrl+S")
        save_case_action.triggered.connect(self._save_case)
        file_menu.addAction(save_case_action)
        
        # 导出数据
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_md_action = QAction("导出Markdown报告(&M)", self)
        export_md_action.setShortcut("Ctrl+E, M")
        export_md_action.triggered.connect(self._export_markdown)
        export_menu.addAction(export_md_action)
        
        export_csv_action = QAction("导出风险清单CSV(&R)", self)
        export_csv_action.setShortcut("Ctrl+E, R")
        export_csv_action.triggered.connect(self._export_risks_csv)
        export_menu.addAction(export_csv_action)
        
        export_json_action = QAction("导出JSON审计包(&A)", self)
        export_json_action.setShortcut("Ctrl+E, A")
        export_json_action.triggered.connect(self._export_json_audit)
        export_menu.addAction(export_json_action)
        
        file_menu.addSeparator()
        
        # 退出
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 编辑菜单
        edit_menu = menubar.addMenu("编辑(&E)")
        
        # 运行规则检测
        run_rules_action = QAction("运行风险检测(&R)", self)
        run_rules_action.setShortcut("F5")
        run_rules_action.triggered.connect(self._run_rules)
        edit_menu.addAction(run_rules_action)
        
        edit_menu.addSeparator()
        
        # 批量操作
        batch_confirm_action = QAction("批量确认选中风险", self)
        batch_confirm_action.triggered.connect(self._batch_confirm_risks)
        edit_menu.addAction(batch_confirm_action)
        
        batch_dismiss_action = QAction("批量驳回选中风险", self)
        batch_dismiss_action.triggered.connect(self._batch_dismiss_risks)
        edit_menu.addAction(batch_dismiss_action)
        
        # 视图菜单
        view_menu = menubar.addMenu("视图(&V)")
        
        # 帮助菜单
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _create_tool_bar(self):
        """
        创建工具栏
        """
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(24, 24))
        
        # 新建病例
        new_action = QAction("新建", self)
        new_action.setToolTip("新建病例 (Ctrl+N)")
        new_action.triggered.connect(self._new_case)
        toolbar.addAction(new_action)
        
        toolbar.addSeparator()
        
        # 导入数据
        import_csv_action = QAction("导入CSV", self)
        import_csv_action.setToolTip("导入监护仪CSV数据")
        import_csv_action.triggered.connect(self._import_csv)
        toolbar.addAction(import_csv_action)
        
        import_json_action = QAction("导入JSON", self)
        import_json_action.setToolTip("导入给药记录JSON")
        import_json_action.triggered.connect(self._import_json)
        toolbar.addAction(import_json_action)
        
        toolbar.addSeparator()
        
        # 保存
        save_action = QAction("保存", self)
        save_action.setToolTip("保存病例 (Ctrl+S)")
        save_action.triggered.connect(self._save_case)
        toolbar.addAction(save_action)
        
        toolbar.addSeparator()
        
        # 运行规则
        run_action = QAction("检测风险", self)
        run_action.setToolTip("运行风险检测 (F5)")
        run_action.triggered.connect(self._run_rules)
        toolbar.addAction(run_action)
        
        toolbar.addSeparator()
        
        # 导出
        export_action = QAction("导出", self)
        export_action.setToolTip("导出报告")
        export_action.triggered.connect(self._export_markdown)
        toolbar.addAction(export_action)
    
    def _create_status_bar(self):
        """
        创建状态栏
        """
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        
        # 病例信息标签
        self.case_info_label = QLabel("未加载病例")
        self.statusbar.addWidget(self.case_info_label)
        
        # 风险统计标签
        self.risk_stats_label = QLabel("")
        self.statusbar.addPermanentWidget(self.risk_stats_label)
    
    def _create_central_widget(self):
        """
        创建中央部件
        """
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # 主分割器
        main_splitter = QSplitter(Qt.Vertical)
        
        # 上半部分：时间轴
        self.timeline_widget = TimelineWidget()
        main_splitter.addWidget(self.timeline_widget)
        
        # 下半部分：风险列表和详情
        bottom_splitter = QSplitter(Qt.Horizontal)
        
        # 风险列表
        self.risk_table_widget = RiskTableWidget()
        self.risk_table_widget.risk_selected.connect(self._on_risk_selected)
        self.risk_table_widget.risk_confirm_requested.connect(self._on_confirm_risk)
        self.risk_table_widget.risk_dismiss_requested.connect(self._on_dismiss_risk)
        bottom_splitter.addWidget(self.risk_table_widget)
        
        # 风险详情
        self.risk_detail_widget = RiskDetailWidget()
        self.risk_detail_widget.confirm_risk.connect(self._on_confirm_risk)
        self.risk_detail_widget.dismiss_risk.connect(self._on_dismiss_risk)
        bottom_splitter.addWidget(self.risk_detail_widget)
        
        # 设置分割比例
        bottom_splitter.setSizes([400, 600])
        
        main_splitter.addWidget(bottom_splitter)
        
        # 设置主分割比例
        main_splitter.setSizes([400, 400])
        
        layout.addWidget(main_splitter)
    
    def _update_status(self):
        """
        更新状态栏
        """
        if self.current_case:
            case_info = f"病例: {self.current_case.case_id}"
            if self.current_case.patient_name:
                case_info += f" | 患者: {self.current_case.patient_name}"
            self.case_info_label.setText(case_info)
            
            # 风险统计
            total = len(self.current_case.risks)
            pending = len([r for r in self.current_case.risks if r.status == RiskStatus.PENDING])
            confirmed = len([r for r in self.current_case.risks if r.status == RiskStatus.CONFIRMED])
            dismissed = len([r for r in self.current_case.risks if r.status == RiskStatus.DISMISSED])
            
            stats = f"风险: 总计{total} | 待复核{pending} | 已确认{confirmed} | 已驳回{dismissed}"
            self.risk_stats_label.setText(stats)
        else:
            self.case_info_label.setText("未加载病例")
            self.risk_stats_label.setText("")
    
    def _new_case(self):
        """
        新建病例
        """
        # 检查是否有未保存的更改
        if self.current_case:
            reply = QMessageBox.question(
                self, "新建病例",
                "当前病例可能有未保存的更改，是否继续？",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            
            if reply == QMessageBox.No:
                return
        
        # 创建新病例
        self.current_case = Case()
        
        # 更新UI
        self.timeline_widget.set_case(self.current_case)
        self.risk_table_widget.set_case(self.current_case)
        self.risk_detail_widget.set_risk(None)
        
        self._update_status()
        
        QMessageBox.information(self, "新建病例", "已创建新病例，请导入数据。")
    
    def _import_csv(self):
        """
        导入监护仪CSV数据
        """
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择监护仪CSV文件",
            "", "CSV文件 (*.csv);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            parser = CSVParser()
            result = parser.parse(file_path)
            
            if not result.success:
                error_msg = "\n".join(result.errors)
                QMessageBox.critical(self, "导入失败", f"解析CSV文件失败:\n{error_msg}")
                return
            
            # 确保有当前病例
            if not self.current_case:
                self.current_case = Case()
            
            # 添加生命体征数据
            self.current_case.add_vital_signs(result.data)
            
            # 更新UI
            self.timeline_widget.set_case(self.current_case)
            self.risk_table_widget.set_case(self.current_case)
            
            self._update_status()
            
            QMessageBox.information(
                self, "导入成功",
                f"成功导入 {len(result.data.records)} 条生命体征记录。\n\n是否运行风险检测？",
                QMessageBox.Yes | QMessageBox.No
            ) == QMessageBox.Yes and self._run_rules()
            
        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"导入CSV文件时发生错误:\n{str(e)}")
    
    def _import_json(self):
        """
        导入给药记录JSON
        """
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择给药记录JSON文件",
            "", "JSON文件 (*.json);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            parser = JSONParser()
            result = parser.parse(file_path)
            
            if not result.success:
                error_msg = "\n".join(result.errors)
                QMessageBox.critical(self, "导入失败", f"解析JSON文件失败:\n{error_msg}")
                return
            
            # 确保有当前病例
            if not self.current_case:
                self.current_case = Case()
            
            # 添加给药记录
            if result.data and hasattr(result.data, 'records'):
                self.current_case.add_medication(result.data)
                
                # 更新UI
                self.timeline_widget.set_case(self.current_case)
                self.risk_table_widget.set_case(self.current_case)
                
                self._update_status()
                
                QMessageBox.information(
                    self, "导入成功",
                    f"成功导入 {len(result.data.records)} 条给药记录。"
                )
            else:
                QMessageBox.information(
                    self, "导入完成",
                    "JSON文件已解析，但未检测到有效的给药记录格式。"
                )
                
        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"导入JSON文件时发生错误:\n{str(e)}")
    
    def _save_case(self):
        """
        保存病例
        """
        if not self.current_case:
            QMessageBox.warning(self, "保存失败", "没有可保存的病例。")
            return
        
        try:
            success = self.storage.save_case(self.current_case)
            
            if success:
                QMessageBox.information(self, "保存成功", f"病例已保存到:\n{self.storage.get_storage_path()}")
                self._update_status()
            else:
                QMessageBox.critical(self, "保存失败", "保存病例时发生错误。")
                
        except Exception as e:
            QMessageBox.critical(self, "保存失败", f"保存病例时发生错误:\n{str(e)}")
    
    def _run_rules(self):
        """
        运行风险检测规则
        """
        if not self.current_case:
            QMessageBox.warning(self, "检测失败", "没有加载病例数据。")
            return
        
        if not self.current_case.vital_signs:
            QMessageBox.warning(self, "检测失败", "没有生命体征数据，无法进行风险检测。")
            return
        
        try:
            # 运行所有规则
            results = self.rule_engine.execute_all(self.current_case)
            
            # 收集所有风险
            risks = self.rule_engine.get_all_risks()
            
            # 添加到病例
            self.current_case.add_risks(risks)
            
            # 更新UI
            self.risk_table_widget.set_case(self.current_case)
            self.timeline_widget.set_case(self.current_case)
            
            self._update_status()
            
            # 显示结果摘要
            summary = self.rule_engine.get_risk_summary()
            
            msg = f"风险检测完成！\n\n"
            msg += f"执行规则数: {summary['total_rules_executed']}\n"
            msg += f"检测到风险数: {summary['total_risks']}\n\n"
            
            if summary['total_risks'] > 0:
                msg += "风险分布:\n"
                for severity, count in summary['risks_by_severity'].items():
                    if count > 0:
                        severity_names = {
                            'MILD': '轻度',
                            'MODERATE': '中度',
                            'SEVERE': '严重',
                            'CRITICAL': '危急'
                        }
                        msg += f"  {severity_names.get(severity, severity)}: {count}\n"
            
            QMessageBox.information(self, "风险检测完成", msg)
            
        except Exception as e:
            QMessageBox.critical(self, "检测失败", f"运行风险检测时发生错误:\n{str(e)}")
    
    def _on_risk_selected(self, risk_id: str):
        """
        风险被选中
        """
        if not self.current_case:
            return
        
        risk = self.current_case.get_risk_by_id(risk_id)
        self.risk_detail_widget.set_risk(risk)
    
    def _on_confirm_risk(self, risk_id: str, notes: str = None):
        """
        确认风险
        """
        if not self.current_case:
            return
        
        success = self.review_manager.confirm_risk(
            self.current_case, risk_id, reviewer="当前用户", notes=notes
        )
        
        if success:
            # 更新UI
            self.risk_table_widget.update_risk(risk_id)
            self.risk_detail_widget.refresh()
            self._update_status()
            
            # 自动保存
            self.storage.save_case(self.current_case)
    
    def _on_dismiss_risk(self, risk_id: str, notes: str = None):
        """
        驳回风险
        """
        if not self.current_case:
            return
        
        success = self.review_manager.dismiss_risk(
            self.current_case, risk_id, reviewer="当前用户", notes=notes
        )
        
        if success:
            # 更新UI
            self.risk_table_widget.update_risk(risk_id)
            self.risk_detail_widget.refresh()
            self._update_status()
            
            # 自动保存
            self.storage.save_case(self.current_case)
    
    def _batch_confirm_risks(self):
        """
        批量确认选中的风险
        """
        if not self.current_case:
            return
        
        selected_ids = self.risk_table_widget.get_selected_risk_ids()
        
        if not selected_ids:
            QMessageBox.information(self, "批量操作", "请先选中要确认的风险。")
            return
        
        count = self.review_manager.batch_confirm_risks(
            self.current_case, selected_ids, reviewer="当前用户"
        )
        
        # 更新UI
        self.risk_table_widget.set_case(self.current_case)
        self._update_status()
        
        # 自动保存
        self.storage.save_case(self.current_case)
        
        QMessageBox.information(self, "批量确认", f"已确认 {count} 个风险。")
    
    def _batch_dismiss_risks(self):
        """
        批量驳回选中的风险
        """
        if not self.current_case:
            return
        
        selected_ids = self.risk_table_widget.get_selected_risk_ids()
        
        if not selected_ids:
            QMessageBox.information(self, "批量操作", "请先选中要驳回的风险。")
            return
        
        count = self.review_manager.batch_dismiss_risks(
            self.current_case, selected_ids, reviewer="当前用户"
        )
        
        # 更新UI
        self.risk_table_widget.set_case(self.current_case)
        self._update_status()
        
        # 自动保存
        self.storage.save_case(self.current_case)
        
        QMessageBox.information(self, "批量驳回", f"已驳回 {count} 个风险。")
    
    def _export_markdown(self):
        """
        导出Markdown报告
        """
        if not self.current_case:
            QMessageBox.warning(self, "导出失败", "没有可导出的病例。")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存Markdown报告",
            f"{self.current_case.case_id}_report.md",
            "Markdown文件 (*.md);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            exporter = MarkdownExporter()
            result = exporter.export(self.current_case, file_path)
            
            if result.success:
                QMessageBox.information(
                    self, "导出成功",
                    f"Markdown报告已导出到:\n{result.file_path}\n\n文件大小: {result.file_size} 字节"
                )
            else:
                error_msg = "\n".join(result.errors)
                QMessageBox.critical(self, "导出失败", f"导出Markdown报告失败:\n{error_msg}")
                
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出Markdown报告时发生错误:\n{str(e)}")
    
    def _export_risks_csv(self):
        """
        导出风险清单CSV
        """
        if not self.current_case:
            QMessageBox.warning(self, "导出失败", "没有可导出的病例。")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存风险清单CSV",
            f"{self.current_case.case_id}_risks.csv",
            "CSV文件 (*.csv);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            exporter = CSVExporter()
            result = exporter.export(self.current_case, file_path)
            
            if result.success:
                QMessageBox.information(
                    self, "导出成功",
                    f"风险清单CSV已导出到:\n{result.file_path}"
                )
            else:
                error_msg = "\n".join(result.errors)
                QMessageBox.critical(self, "导出失败", f"导出风险清单失败:\n{error_msg}")
                
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出风险清单时发生错误:\n{str(e)}")
    
    def _export_json_audit(self):
        """
        导出JSON审计包
        """
        if not self.current_case:
            QMessageBox.warning(self, "导出失败", "没有可导出的病例。")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存JSON审计包",
            f"{self.current_case.case_id}_audit.json",
            "JSON文件 (*.json);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            exporter = JSONAuditExporter()
            result = exporter.export(self.current_case, file_path)
            
            if result.success:
                QMessageBox.information(
                    self, "导出成功",
                    f"JSON审计包已导出到:\n{result.file_path}\n\n包含完整的审计信息和数据完整性哈希。"
                )
            else:
                error_msg = "\n".join(result.errors)
                QMessageBox.critical(self, "导出失败", f"导出JSON审计包失败:\n{error_msg}")
                
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出JSON审计包时发生错误:\n{str(e)}")
    
    def _show_about(self):
        """
        显示关于对话框
        """
        QMessageBox.about(
            self, "关于麻醉监护复盘板",
            "<h3>麻醉监护复盘板</h3>"
            "<p>版本: 1.0.0</p>"
            "<p>宠物医院麻醉护士专用工具</p>"
            "<p>功能特点:</p>"
            "<ul>"
            "<li>导入监护仪CSV和给药记录JSON</li>"
            "<li>自动检测低体温、血氧掉点等风险</li>"
            "<li>时间轴可视化展示生命体征</li>"
            "<li>风险确认/驳回复核机制</li>"
            "<li>导出Markdown报告、CSV风险清单、JSON审计包</li>"
            "</ul>"
            "<p>数据本地存储，重启不丢失。</p>"
        )
