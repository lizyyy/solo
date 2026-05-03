#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
巡检报告标签页
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QLineEdit, QComboBox, QTextEdit, QFormLayout, QMessageBox,
    QSplitter, QDateEdit, QFileDialog, QProgressBar, QFrame,
    QCheckBox, QSpinBox, QScrollArea
)
from PyQt5.QtCore import Qt, QDate, QThread, pyqtSignal
from PyQt5.QtGui import QColor, QFont

from datetime import date, datetime, timedelta
from typing import Optional, List, Dict
from pathlib import Path

from storage.db_manager import DatabaseManager
from models import (
    Reagent, Cabinet, ResponsiblePerson, UsageRecord,
    InspectionRecord, AlertType
)
from logic.validation_rules import ValidationRules, ValidationResult
from logic.report_generator import ReportGenerator


class InspectionTab(QWidget):
    """巡检报告标签页"""
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__()
        
        self.db_manager = db_manager
        self.validation_results: Dict[int, List[ValidationResult]] = {}
        self.overdue_results: List[ValidationResult] = []
        
        self._init_ui()
        self.refresh_data()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        
        # 顶部信息栏
        info_layout = QHBoxLayout()
        
        # 巡检日期
        info_layout.addWidget(QLabel("巡检日期:"))
        self.inspection_date_edit = QDateEdit()
        self.inspection_date_edit.setCalendarPopup(True)
        self.inspection_date_edit.setDate(QDate.currentDate())
        self.inspection_date_edit.setMaximumWidth(150)
        info_layout.addWidget(self.inspection_date_edit)
        
        # 巡检人
        info_layout.addWidget(QLabel("巡检人:"))
        self.inspector_combo = QComboBox()
        self.inspector_combo.setMaximumWidth(200)
        info_layout.addWidget(self.inspector_combo)
        
        info_layout.addStretch()
        
        # 操作按钮
        run_check_btn = QPushButton("执行巡检检查")
        run_check_btn.setStyleSheet("background-color: #2196F3; color: white; font-weight: bold;")
        run_check_btn.setMinimumWidth(150)
        run_check_btn.clicked.connect(self._run_inspection_check)
        info_layout.addWidget(run_check_btn)
        
        generate_report_btn = QPushButton("生成巡检报告")
        generate_report_btn.setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;")
        generate_report_btn.setMinimumWidth(150)
        generate_report_btn.clicked.connect(self._generate_inspection_report)
        info_layout.addWidget(generate_report_btn)
        
        layout.addLayout(info_layout)
        
        # 分割器
        splitter = QSplitter(Qt.Vertical)
        
        # 上部分：统计和问题列表
        top_group = QGroupBox("巡检检查结果")
        top_layout = QVBoxLayout(top_group)
        
        # 统计面板
        stats_frame = QFrame()
        stats_frame.setFrameStyle(QFrame.StyledPanel | QFrame.Raised)
        stats_frame.setLineWidth(1)
        stats_layout = QHBoxLayout(stats_frame)
        
        # 统计项
        self.total_label = self._create_stat_label("试剂总数", "0", QColor(0, 0, 0))
        stats_layout.addWidget(self.total_label)
        
        self.expired_label = self._create_stat_label("过期", "0", QColor(255, 0, 0))
        stats_layout.addWidget(self.expired_label)
        
        self.expiring_label = self._create_stat_label("即将过期", "0", QColor(255, 102, 0))
        stats_layout.addWidget(self.expiring_label)
        
        self.low_stock_label = self._create_stat_label("库存不足", "0", QColor(204, 102, 0))
        stats_layout.addWidget(self.low_stock_label)
        
        self.incompatible_label = self._create_stat_label("禁配警告", "0", QColor(153, 0, 153))
        stats_layout.addWidget(self.incompatible_label)
        
        self.overdue_label = self._create_stat_label("超期未归还", "0", QColor(153, 0, 0))
        stats_layout.addWidget(self.overdue_label)
        
        top_layout.addWidget(stats_frame)
        
        # 问题列表
        self.problem_table = QTableWidget()
        self.problem_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.problem_table.setSelectionMode(QTableWidget.SingleSelection)
        self.problem_table.setAlternatingRowColors(True)
        self.problem_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.problem_table.verticalHeader().setDefaultSectionSize(30)
        
        headers = ["柜位", "瓶号", "试剂名称", "问题类型", "问题描述", "处理建议"]
        self.problem_table.setColumnCount(len(headers))
        self.problem_table.setHorizontalHeaderLabels(headers)
        
        top_layout.addWidget(QLabel("发现的问题:"))
        top_layout.addWidget(self.problem_table)
        
        splitter.addWidget(top_group)
        
        # 下部分：历史记录
        bottom_group = QGroupBox("巡检历史记录")
        bottom_layout = QVBoxLayout(bottom_group)
        
        # 历史记录表
        self.history_table = QTableWidget()
        self.history_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.history_table.setSelectionMode(QTableWidget.SingleSelection)
        self.history_table.setAlternatingRowColors(True)
        self.history_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.history_table.verticalHeader().setDefaultSectionSize(30)
        self.history_table.itemDoubleClicked.connect(self._on_history_item_double_clicked)
        
        headers = ["巡检日期", "巡检人", "试剂总数", "过期", "库存不足", "禁配", "超期未还", "状态", "报告路径"]
        self.history_table.setColumnCount(len(headers))
        self.history_table.setHorizontalHeaderLabels(headers)
        
        bottom_layout.addWidget(self.history_table)
        
        splitter.addWidget(bottom_group)
        
        # 设置分割器比例
        splitter.setSizes([400, 250])
        
        layout.addWidget(splitter)
    
    def _create_stat_label(self, title: str, value: str, color: QColor) -> QLabel:
        """创建统计标签"""
        label = QLabel(f"<div style='text-align: center;'>"
                      f"<div style='font-size: 14px; font-weight: bold; color: {color.name()};'>{value}</div>"
                      f"<div style='font-size: 11px; color: #666;'>{title}</div>"
                      f"</div>")
        label.setStyleSheet("background-color: #F5F5F5; padding: 10px; border-radius: 5px;")
        label.setMinimumWidth(100)
        return label
    
    def refresh_data(self):
        """刷新数据"""
        # 刷新巡检人下拉列表
        self._refresh_inspector_combo()
        
        # 刷新历史记录
        self._refresh_history_table()
    
    def _refresh_inspector_combo(self):
        """刷新巡检人下拉列表"""
        self.inspector_combo.clear()
        self.inspector_combo.addItem("请选择巡检人", None)
        persons = self.db_manager.get_all_responsible_persons()
        for p in persons:
            self.inspector_combo.addItem(f"{p.name} ({p.department})", p.id)
    
    def _refresh_history_table(self):
        """刷新历史记录表"""
        self.history_table.setRowCount(0)
        
        records = self.db_manager.get_all_inspection_records()
        persons = {p.id: p for p in self.db_manager.get_all_responsible_persons()}
        
        for row, record in enumerate(records):
            self.history_table.insertRow(row)
            
            # 巡检日期
            item = QTableWidgetItem(record.inspection_date.isoformat() if record.inspection_date else "-")
            item.setData(Qt.UserRole, record.id)
            self.history_table.setItem(row, 0, item)
            
            # 巡检人
            inspector_name = ""
            if record.inspector_id in persons:
                inspector_name = persons[record.inspector_id].name
            self.history_table.setItem(row, 1, QTableWidgetItem(inspector_name))
            
            # 试剂总数
            self.history_table.setItem(row, 2, QTableWidgetItem(f"{record.total_reagents}"))
            
            # 过期
            self.history_table.setItem(row, 3, QTableWidgetItem(f"{record.expired_count}"))
            
            # 库存不足
            self.history_table.setItem(row, 4, QTableWidgetItem(f"{record.low_stock_count}"))
            
            # 禁配
            self.history_table.setItem(row, 5, QTableWidgetItem(f"{record.incompatible_count}"))
            
            # 超期未还
            self.history_table.setItem(row, 6, QTableWidgetItem(f"{record.overdue_return_count}"))
            
            # 状态
            status_item = QTableWidgetItem(record.status)
            if record.status == "完成":
                status_item.setForeground(QColor(0, 153, 0))
            else:
                status_item.setForeground(QColor(255, 102, 0))
            self.history_table.setItem(row, 7, status_item)
            
            # 报告路径
            report_path = record.report_path or "-"
            if len(report_path) > 40:
                report_path = "..." + report_path[-37:]
            self.history_table.setItem(row, 8, QTableWidgetItem(report_path))
    
    def _run_inspection_check(self):
        """执行巡检检查"""
        # 获取所有数据
        reagents = self.db_manager.get_all_reagents()
        cabinets = self.db_manager.get_all_cabinets()
        usage_records = self.db_manager.get_all_usage_records()
        
        if not reagents:
            QMessageBox.information(self, "提示", "暂无试剂数据需要检查")
            return
        
        # 执行校验
        self.validation_results = ValidationRules.validate_all_reagents(reagents, cabinets)
        self.overdue_results = ValidationRules.validate_usage_records(usage_records)
        
        # 更新统计
        self._update_stats(reagents)
        
        # 更新问题列表
        self._update_problem_table(cabinets)
        
        QMessageBox.information(self, "检查完成", f"巡检检查完成，发现 {self._count_problems()} 个问题")
    
    def _count_problems(self) -> int:
        """统计问题数量"""
        count = 0
        for results in self.validation_results.values():
            count += len(results)
        count += len(self.overdue_results)
        return count
    
    def _update_stats(self, reagents: List[Reagent]):
        """更新统计信息"""
        total_count = len(reagents)
        expired_count = 0
        expiring_soon_count = 0
        low_stock_count = 0
        incompatible_count = 0
        overdue_count = len(self.overdue_results)
        
        for cabinet_id, results in self.validation_results.items():
            for result in results:
                if result.alert_type == AlertType.EXPIRED:
                    expired_count += 1
                elif result.alert_type == AlertType.EXPIRING_SOON:
                    expiring_soon_count += 1
                elif result.alert_type == AlertType.LOW_STOCK:
                    low_stock_count += 1
                elif result.alert_type == AlertType.INCOMPATIBLE:
                    incompatible_count += 1
        
        # 更新标签
        self.total_label.setText(f"<div style='text-align: center;'>"
                                f"<div style='font-size: 14px; font-weight: bold;'>{total_count}</div>"
                                f"<div style='font-size: 11px; color: #666;'>试剂总数</div>"
                                f"</div>")
        
        self.expired_label.setText(f"<div style='text-align: center;'>"
                                   f"<div style='font-size: 14px; font-weight: bold; color: #FF0000;'>{expired_count}</div>"
                                   f"<div style='font-size: 11px; color: #666;'>过期</div>"
                                   f"</div>")
        
        self.expiring_label.setText(f"<div style='text-align: center;'>"
                                    f"<div style='font-size: 14px; font-weight: bold; color: #FF6600;'>{expiring_soon_count}</div>"
                                    f"<div style='font-size: 11px; color: #666;'>即将过期</div>"
                                    f"</div>")
        
        self.low_stock_label.setText(f"<div style='text-align: center;'>"
                                     f"<div style='font-size: 14px; font-weight: bold; color: #CC6600;'>{low_stock_count}</div>"
                                     f"<div style='font-size: 11px; color: #666;'>库存不足</div>"
                                     f"</div>")
        
        self.incompatible_label.setText(f"<div style='text-align: center;'>"
                                        f"<div style='font-size: 14px; font-weight: bold; color: #990099;'>{incompatible_count}</div>"
                                        f"<div style='font-size: 11px; color: #666;'>禁配警告</div>"
                                        f"</div>")
        
        self.overdue_label.setText(f"<div style='text-align: center;'>"
                                   f"<div style='font-size: 14px; font-weight: bold; color: #990000;'>{overdue_count}</div>"
                                   f"<div style='font-size: 11px; color: #666;'>超期未归还</div>"
                                   f"</div>")
    
    def _update_problem_table(self, cabinets: List[Cabinet]):
        """更新问题列表"""
        self.problem_table.setRowCount(0)
        
        cabinet_names = {c.id: c.name for c in cabinets}
        
        row = 0
        
        # 试剂相关问题
        for cabinet_id, results in self.validation_results.items():
            cabinet_name = cabinet_names.get(cabinet_id, "未知柜位")
            
            for result in results:
                self.problem_table.insertRow(row)
                
                # 柜位
                self.problem_table.setItem(row, 0, QTableWidgetItem(cabinet_name))
                
                # 瓶号
                self.problem_table.setItem(row, 1, QTableWidgetItem(result.bottle_number or "-"))
                
                # 试剂名称
                self.problem_table.setItem(row, 2, QTableWidgetItem(result.reagent_name or "-"))
                
                # 问题类型
                alert_type_str = result.alert_type.value if result.alert_type else "未知"
                type_item = QTableWidgetItem(alert_type_str)
                type_item.setForeground(self._get_color_for_alert_type(result.alert_type))
                self.problem_table.setItem(row, 3, type_item)
                
                # 问题描述
                self.problem_table.setItem(row, 4, QTableWidgetItem(result.message))
                
                # 处理建议
                suggestion = self._get_suggestion(result.alert_type)
                self.problem_table.setItem(row, 5, QTableWidgetItem(suggestion))
                
                row += 1
        
        # 超期未归还问题
        for result in self.overdue_results:
            self.problem_table.insertRow(row)
            
            # 柜位
            self.problem_table.setItem(row, 0, QTableWidgetItem("-"))
            
            # 瓶号
            self.problem_table.setItem(row, 1, QTableWidgetItem(result.bottle_number or "-"))
            
            # 试剂名称
            self.problem_table.setItem(row, 2, QTableWidgetItem("-"))
            
            # 问题类型
            alert_type_str = result.alert_type.value if result.alert_type else "未知"
            type_item = QTableWidgetItem(alert_type_str)
            type_item.setForeground(self._get_color_for_alert_type(result.alert_type))
            self.problem_table.setItem(row, 3, type_item)
            
            # 问题描述
            self.problem_table.setItem(row, 4, QTableWidgetItem(result.message))
            
            # 处理建议
            suggestion = self._get_suggestion(result.alert_type)
            self.problem_table.setItem(row, 5, QTableWidgetItem(suggestion))
            
            row += 1
    
    def _get_color_for_alert_type(self, alert_type: Optional[AlertType]) -> QColor:
        """根据预警类型获取颜色"""
        if alert_type == AlertType.EXPIRED:
            return QColor(255, 0, 0)
        elif alert_type == AlertType.EXPIRING_SOON:
            return QColor(255, 102, 0)
        elif alert_type == AlertType.LOW_STOCK:
            return QColor(204, 102, 0)
        elif alert_type == AlertType.INCOMPATIBLE:
            return QColor(153, 0, 153)
        elif alert_type == AlertType.OVERDUE_RETURN:
            return QColor(153, 0, 0)
        else:
            return QColor(0, 0, 0)
    
    def _get_suggestion(self, alert_type: Optional[AlertType]) -> str:
        """根据预警类型获取处理建议"""
        suggestions = {
            AlertType.EXPIRED: "立即停止使用，按规定程序进行销毁处理",
            AlertType.EXPIRING_SOON: "优先安排使用，如无法用完及时申请报废",
            AlertType.LOW_STOCK: "及时补充库存",
            AlertType.INCOMPATIBLE: "立即调整存放位置，分柜存放",
            AlertType.OVERDUE_RETURN: "立即联系领用人，督促归还"
        }
        return suggestions.get(alert_type, "请联系管理员处理")
    
    def _generate_inspection_report(self):
        """生成巡检报告"""
        # 验证巡检人
        inspector_id = self.inspector_combo.currentData()
        if not inspector_id:
            QMessageBox.warning(self, "验证失败", "请选择巡检人")
            self.inspector_combo.setFocus()
            return
        
        # 获取巡检人信息
        inspector = self.db_manager.get_responsible_person_by_id(inspector_id)
        if not inspector:
            QMessageBox.warning(self, "错误", "无法获取巡检人信息")
            return
        
        # 如果还没有执行检查，先执行
        if not self.validation_results and not self.overdue_results:
            reply = QMessageBox.question(
                self, "确认",
                "尚未执行巡检检查，是否现在执行？",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.Yes
            )
            if reply == QMessageBox.Yes:
                self._run_inspection_check()
            else:
                return
        
        # 选择输出目录
        output_dir = QFileDialog.getExistingDirectory(self, "选择报告输出目录")
        if not output_dir:
            return
        
        # 获取数据
        reagents = self.db_manager.get_all_reagents()
        cabinets = self.db_manager.get_all_cabinets()
        usage_records = self.db_manager.get_all_usage_records()
        
        # 生成报告
        try:
            report_paths = ReportGenerator.generate_inspection_report(
                inspection_date=self.inspection_date_edit.date().toPyDate(),
                inspector=inspector,
                reagents=reagents,
                cabinets=cabinets,
                usage_records=usage_records,
                validation_results=self.validation_results,
                overdue_results=self.overdue_results,
                output_dir=output_dir
            )
            
            # 统计问题数量
            expired_count = 0
            low_stock_count = 0
            incompatible_count = 0
            for cabinet_id, results in self.validation_results.items():
                for result in results:
                    if result.alert_type == AlertType.EXPIRED:
                        expired_count += 1
                    elif result.alert_type == AlertType.LOW_STOCK:
                        low_stock_count += 1
                    elif result.alert_type == AlertType.INCOMPATIBLE:
                        incompatible_count += 1
            
            overdue_count = len(self.overdue_results)
            
            # 创建巡检记录
            inspection_record = InspectionRecord(
                id=None,
                inspection_date=self.inspection_date_edit.date().toPyDate(),
                inspector_id=inspector_id,
                total_reagents=len(reagents),
                expired_count=expired_count,
                low_stock_count=low_stock_count,
                incompatible_count=incompatible_count,
                overdue_return_count=overdue_count,
                status="完成",
                report_path=report_paths['markdown'],
                csv_path=report_paths['csv'],
                notes=None,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            self.db_manager.add_inspection_record(inspection_record)
            
            # 刷新历史记录
            self._refresh_history_table()
            
            QMessageBox.information(
                self, "报告生成成功",
                f"巡检报告已生成！\n\n"
                f"Markdown 报告: {report_paths['markdown']}\n"
                f"CSV 异常清单: {report_paths['csv']}"
            )
            
        except Exception as e:
            QMessageBox.warning(self, "报告生成失败", f"生成报告时出错: {str(e)}")
    
    def _on_history_item_double_clicked(self, item: QTableWidgetItem):
        """历史记录项双击处理"""
        row = item.row()
        id_item = self.history_table.item(row, 0)
        if not id_item:
            return
        
        record_id = id_item.data(Qt.UserRole)
        record = self.db_manager.get_inspection_record_by_id(record_id)
        
        if not record:
            return
        
        if record.report_path:
            import os
            from pathlib import Path
            
            report_path = Path(record.report_path)
            if report_path.exists():
                # 在文件管理器中打开
                reply = QMessageBox.question(
                    self, "打开报告",
                    f"报告路径: {record.report_path}\n\n"
                    f"是否在文件管理器中打开？",
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.Yes
                )
                
                if reply == QMessageBox.Yes:
                    try:
                        import subprocess
                        import platform
                        
                        if platform.system() == 'Darwin':  # macOS
                            subprocess.run(['open', '-R', str(report_path)])
                        elif platform.system() == 'Windows':
                            subprocess.run(['explorer', '/select,', str(report_path)])
                        else:  # Linux
                            subprocess.run(['xdg-open', str(report_path.parent)])
                    except Exception as e:
                        QMessageBox.warning(self, "提示", f"无法打开文件管理器: {e}")
            else:
                QMessageBox.information(self, "提示", "报告文件不存在")
        else:
            QMessageBox.information(self, "提示", "该巡检记录没有保存报告")
