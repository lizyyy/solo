#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
疑似进展组件
用于显示视野检查中疑似进展的点位
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTableWidget,
    QTableWidgetItem, QHeaderView, QGroupBox, QFrame, QScrollArea
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QFont, QColor, QBrush
from typing import Dict, Any, List, Optional, Tuple


class ProgressWidget(QWidget):
    """
    疑似进展点位组件
    显示视野检查中疑似进展的点位列表和统计信息
    """
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # 当前数据
        self.progress_points: List[Dict[str, Any]] = []
        
        self.init_ui()
        
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(10)
        
        # 统计信息区域
        stats_group = QGroupBox("进展统计")
        stats_layout = QHBoxLayout(stats_group)
        
        # 严重程度统计
        self.severe_count_label = QLabel("严重进展: 0")
        self.severe_count_label.setStyleSheet("color: #D32F2F; font-weight: bold;")
        stats_layout.addWidget(self.severe_count_label)
        
        self.moderate_count_label = QLabel("中度进展: 0")
        self.moderate_count_label.setStyleSheet("color: #FF9800; font-weight: bold;")
        stats_layout.addWidget(self.moderate_count_label)
        
        self.mild_count_label = QLabel("轻度可疑: 0")
        self.mild_count_label.setStyleSheet("color: #FFC107; font-weight: bold;")
        stats_layout.addWidget(self.mild_count_label)
        
        stats_layout.addStretch()
        
        layout.addWidget(stats_group)
        
        # 进展点位列表
        table_group = QGroupBox("进展点位详情")
        table_layout = QVBoxLayout(table_group)
        
        self.progress_table = QTableWidget()
        self.progress_table.setColumnCount(6)
        self.progress_table.setHorizontalHeaderLabels([
            "眼别", "点位", "位置", "严重程度", "变化描述", "详细信息"
        ])
        
        # 设置列宽
        header = self.progress_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)
        header.setSectionResizeMode(1, QHeaderView.Fixed)
        header.setSectionResizeMode(2, QHeaderView.Fixed)
        header.setSectionResizeMode(3, QHeaderView.Fixed)
        header.setSectionResizeMode(4, QHeaderView.Stretch)
        header.setSectionResizeMode(5, QHeaderView.Stretch)
        
        self.progress_table.setColumnWidth(0, 60)
        self.progress_table.setColumnWidth(1, 80)
        self.progress_table.setColumnWidth(2, 100)
        self.progress_table.setColumnWidth(3, 100)
        
        # 允许选择多行
        self.progress_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.progress_table.setSelectionMode(QTableWidget.ExtendedSelection)
        
        # 交替行颜色
        self.progress_table.setAlternatingRowColors(True)
        
        table_layout.addWidget(self.progress_table)
        
        layout.addWidget(table_group, 1)
        
    def set_progress_points(self, progress_points: List[Any]):
        """
        设置进展点位数据
        支持两种格式：
        1. 字典列表（单眼）
        2. 元组列表（双眼对比，格式为 (眼别, 点信息典)）
        """
        self.progress_points = []
        
        # 标准化数据格式
        for item in progress_points:
            if isinstance(item, tuple) and len(item) >= 2:
                # 元组格式：(眼别, 点信息)
                eye, point = item
                point_data = copy.copy(point) if isinstance(point, dict) else {}
                point_data['_eye'] = eye
                self.progress_points.append(point_data)
            elif isinstance(item, dict):
                # 字典格式
                self.progress_points.append(item)
        
        self._update_display()
        
    def _update_display(self):
        """更新显示"""
        # 更新统计
        severe_count = 0
        moderate_count = 0
        mild_count = 0
        
        for point in self.progress_points:
            severity = point.get('severity', 'normal')
            if severity == 'severe':
                severe_count += 1
            elif severity == 'moderate':
                moderate_count += 1
            elif severity == 'mild':
                mild_count += 1
        
        self.severe_count_label.setText(f"严重进展: {severe_count}")
        self.moderate_count_label.setText(f"中度进展: {moderate_count}")
        self.mild_count_label.setText(f"轻度可疑: {mild_count}")
        
        # 更新表格
        self.progress_table.setRowCount(len(self.progress_points))
        
        for row, point in enumerate(self.progress_points):
            # 眼别
            eye = point.get('_eye', point.get('eye', ''))
            eye_label = "左眼" if eye == 'left' else "右眼" if eye == 'right' else ""
            eye_item = QTableWidgetItem(eye_label)
            eye_item.setTextAlignment(Qt.AlignCenter)
            self.progress_table.setItem(row, 0, eye_item)
            
            # 点位
            location = point.get('location', '')
            location_item = QTableWidgetItem(str(location))
            location_item.setTextAlignment(Qt.AlignCenter)
            self.progress_table.setItem(row, 1, location_item)
            
            # 位置坐标
            x = point.get('x')
            y = point.get('y')
            pos_str = ""
            if x is not None and y is not None:
                pos_str = f"({x:.0f}°, {y:.0f}°)"
            pos_item = QTableWidgetItem(pos_str)
            pos_item.setTextAlignment(Qt.AlignCenter)
            self.progress_table.setItem(row, 2, pos_item)
            
            # 严重程度
            severity = point.get('severity', 'normal')
            severity_label = point.get('severity_label', '未知')
            
            severity_item = QTableWidgetItem(severity_label)
            severity_item.setTextAlignment(Qt.AlignCenter)
            
            # 设置颜色
            if severity == 'severe':
                severity_item.setForeground(QBrush(QColor('#D32F2F')))
                severity_item.setBackground(QBrush(QColor('#FFEBEE')))
            elif severity == 'moderate':
                severity_item.setForeground(QBrush(QColor('#FF9800')))
                severity_item.setBackground(QBrush(QColor('#FFF3E0')))
            elif severity == 'mild':
                severity_item.setForeground(QBrush(QColor('#FFC107')))
                severity_item.setBackground(QBrush(QColor('#FFFDE7')))
            
            severity_item.setFont(self._get_bold_font())
            self.progress_table.setItem(row, 3, severity_item)
            
            # 变化描述
            description = point.get('description', '')
            desc_item = QTableWidgetItem(description)
            desc_item.setToolTip(description)
            self.progress_table.setItem(row, 4, desc_item)
            
            # 详细信息
            details = self._format_details(point)
            details_item = QTableWidgetItem(details)
            details_item.setToolTip(details)
            self.progress_table.setItem(row, 5, details_item)
            
            # 设置行高
            self.progress_table.setRowHeight(row, 40)
            
    def _format_details(self, point: Dict[str, Any]) -> str:
        """格式化详细信息"""
        details_parts = []
        
        # 当前值
        latest_value = point.get('latest_value')
        if latest_value is not None:
            details_parts.append(f"当前: {latest_value:.1f} dB")
        
        # 前次值
        previous_value = point.get('previous_value')
        if previous_value is not None:
            details_parts.append(f"前次: {previous_value:.1f} dB")
        
        # 变化量
        change_from_previous = point.get('change_from_previous')
        if change_from_previous is not None:
            sign = "-" if change_from_previous < 0 else "+"
            details_parts.append(f"变化: {sign}{abs(change_from_previous):.1f} dB")
        
        # 总变化
        total_change = point.get('total_change')
        if total_change is not None:
            sign = "-" if total_change < 0 else "+"
            details_parts.append(f"总变化: {sign}{abs(total_change):.1f} dB")
        
        # 模式偏差变化
        pd_change = point.get('pd_change')
        if pd_change is not None:
            sign = "-" if pd_change < 0 else "+"
            details_parts.append(f"PD变化: {sign}{abs(pd_change):.1f} dB")
        
        # 当前TD和PD
        latest_td = point.get('latest_td')
        latest_pd = point.get('latest_pd')
        
        if latest_td is not None:
            details_parts.append(f"TD: {latest_td:.1f}")
        if latest_pd is not None:
            details_parts.append(f"PD: {latest_pd:.1f}")
        
        # 聚类信息
        cluster_info = point.get('cluster_info')
        if cluster_info:
            point_count = cluster_info.get('point_count', 0)
            details_parts.append(f"聚类: {point_count}个连续点位")
        
        return " | ".join(details_parts)
        
    def _get_bold_font(self) -> QFont:
        """获取粗体字体"""
        font = QFont()
        font.setBold(True)
        return font
        
    def get_selected_points(self) -> List[Dict[str, Any]]:
        """获取选中的进展点位"""
        selected_rows = set()
        for item in self.progress_table.selectedItems():
            selected_rows.add(item.row())
        
        selected_points = []
        for row in sorted(selected_rows):
            if row < len(self.progress_points):
                selected_points.append(self.progress_points[row])
        
        return selected_points
        
    def clear(self):
        """清空数据"""
        self.progress_points = []
        self.progress_table.setRowCount(0)
        self.severe_count_label.setText("严重进展: 0")
        self.moderate_count_label.setText("中度进展: 0")
        self.mild_count_label.setText("轻度可疑: 0")


import copy
