#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
热力图组件
用于显示 Humphrey 视野检查的热力图
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QLabel, QHBoxLayout, QFrame,
    QGraphicsView, QGraphicsScene, QGraphicsEllipseItem, QGraphicsTextItem
)
from PyQt5.QtCore import Qt, QRectF, QPointF
from PyQt5.QtGui import QPainter, QColor, QPen, QBrush, QFont, QLinearGradient, QPainterPath

import numpy as np
from typing import Dict, Any, List, Optional, Tuple

from models.data_models import VisualFieldTest


class HeatmapWidget(QWidget):
    """
    视野检查热力图组件
    支持显示单眼或双眼对比
    """
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # 数据
        self.left_eye_data: Optional[VisualFieldTest] = None
        self.right_eye_data: Optional[VisualFieldTest] = None
        self.current_eye: str = "left"
        self.is_comparison: bool = False
        
        # 颜色映射
        self.value_colormap = self._create_value_colormap()
        self.td_colormap = self._create_td_colormap()
        self.pd_colormap = self._create_pd_colormap()
        
        # 当前显示模式
        self.display_mode: str = "value"  # value, td, pd
        
        self.init_ui()
        
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # 标题栏
        title_layout = QHBoxLayout()
        
        self.title_label = QLabel("视野热力图")
        title_font = QFont()
        title_font.setBold(True)
        title_font.setPointSize(12)
        self.title_label.setFont(title_font)
        title_layout.addWidget(self.title_label)
        
        title_layout.addStretch()
        
        # 显示模式选择
        mode_label = QLabel("显示模式:")
        title_layout.addWidget(mode_label)
        
        from PyQt5.QtWidgets import QComboBox
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(["阈值", "总偏差", "模式偏差"])
        self.mode_combo.currentIndexChanged.connect(self._on_mode_changed)
        title_layout.addWidget(self.mode_combo)
        
        layout.addLayout(title_layout)
        
        # 图形视图
        self.graphics_view = QGraphicsView()
        self.graphics_view.setRenderHint(QPainter.Antialiasing)
        self.graphics_view.setMinimumHeight(400)
        
        self.scene = QGraphicsScene()
        self.graphics_view.setScene(self.scene)
        
        layout.addWidget(self.graphics_view, 1)
        
        # 颜色条说明
        legend_layout = QHBoxLayout()
        
        # 颜色条
        self.color_bar_widget = ColorBarWidget()
        legend_layout.addWidget(self.color_bar_widget, 1)
        
        layout.addLayout(legend_layout)
        
    def set_data(self, test_data: VisualFieldTest, eye: str):
        """
        设置单眼数据
        """
        if eye == "left":
            self.left_eye_data = test_data
            self.current_eye = "left"
        else:
            self.right_eye_data = test_data
            self.current_eye = "right"
        
        self.is_comparison = False
        self._update_display()
        
    def set_comparison_data(self, left_data: Optional[VisualFieldTest], 
                           right_data: Optional[VisualFieldTest]):
        """
        设置双眼对比数据
        """
        self.left_eye_data = left_data
        self.right_eye_data = right_data
        self.is_comparison = True
        
        self._update_display()
        
    def _on_mode_changed(self, index):
        """显示模式改变"""
        mode_map = {0: "value", 1: "td", 2: "pd"}
        self.display_mode = mode_map.get(index, "value")
        self._update_display()
        
    def _update_display(self):
        """更新显示"""
        self.scene.clear()
        
        # 更新标题
        if self.is_comparison:
            self.title_label.setText("双眼视野对比")
            self._draw_comparison_view()
        else:
            eye_name = "左眼" if self.current_eye == "left" else "右眼"
            self.title_label.setText(f"{eye_name}视野热力图")
            
            test_data = (self.left_eye_data if self.current_eye == "left" 
                        else self.right_eye_data)
            
            if test_data:
                self._draw_single_view(test_data)
        
        # 更新颜色条
        self._update_color_bar()
        
    def _draw_single_view(self, test_data: VisualFieldTest):
        """绘制单眼视图"""
        if not test_data.points:
            # 没有数据，显示占位
            no_data_text = self.scene.addText("暂无数据")
            no_data_text.setDefaultTextColor(Qt.gray)
            return
        
        # 获取数据范围
        values = self._get_values_for_display(test_data)
        min_val, max_val = self._get_value_range()
        
        # 视图大小
        view_size = 600
        margin = 50
        
        # 创建场景
        self.scene.setSceneRect(0, 0, view_size, view_size)
        
        # 绘制背景网格
        self._draw_grid(view_size, margin)
        
        # 绘制生理盲点位置
        self._draw_blind_spot(view_size, margin, self.current_eye)
        
        # 绘制点位
        point_radius = 15
        
        for point in test_data.points:
            x = point.get('x', 0)
            y = point.get('y', 0)
            value = self._get_point_value(point)
            
            # 转换坐标（视野检查坐标到场景坐标）
            # 视野检查中，中心在(0,0)，范围约 ±30 度
            # 转换到场景坐标，中心在 (view_size/2, view_size/2)
            scale = (view_size - 2 * margin) / 60  # 60度视野
            
            scene_x = view_size / 2 + x * scale
            scene_y = view_size / 2 - y * scale  # y轴翻转
            
            # 获取颜色
            color = self._get_color(value, min_val, max_val)
            
            # 绘制点位
            ellipse = self.scene.addEllipse(
                scene_x - point_radius, scene_y - point_radius,
                point_radius * 2, point_radius * 2,
                QPen(Qt.black, 1), QBrush(color)
            )
            
            # 添加数值标签
            if value is not None:
                text = self.scene.addText(f"{value:.0f}" if isinstance(value, (int, float)) else str(value))
                text.setDefaultTextColor(Qt.white if self._is_dark(color) else Qt.black)
                
                text_rect = text.boundingRect()
                text.setPos(
                    scene_x - text_rect.width() / 2,
                    scene_y - text_rect.height() / 2
                )
            
            # 添加工具提示
            tooltip = self._create_point_tooltip(point)
            ellipse.setToolTip(tooltip)
        
        # 添加坐标轴标签
        self._draw_axis_labels(view_size, margin)
        
    def _draw_comparison_view(self):
        """绘制双眼对比视图"""
        view_size = 600
        margin = 50
        spacing = 40
        
        total_width = view_size * 2 + spacing
        total_height = view_size
        
        self.scene.setSceneRect(0, 0, total_width, total_height)
        
        # 绘制左眼（左侧）
        if self.left_eye_data and self.left_eye_data.points:
            self._draw_eye_in_region(
                self.left_eye_data, "left",
                0, 0, view_size, view_size,
                margin
            )
            # 添加标签
            left_label = self.scene.addText("左眼")
            left_label.setDefaultTextColor(Qt.black)
            left_label.setPos(view_size / 2 - 20, 10)
        
        # 绘制右眼（右侧）
        if self.right_eye_data and self.right_eye_data.points:
            self._draw_eye_in_region(
                self.right_eye_data, "right",
                view_size + spacing, 0, view_size, view_size,
                margin
            )
            # 添加标签
            right_label = self.scene.addText("右眼")
            right_label.setDefaultTextColor(Qt.black)
            right_label.setPos(view_size + spacing + view_size / 2 - 20, 10)
        
    def _draw_eye_in_region(self, test_data: VisualFieldTest, eye: str,
                            x: float, y: float, width: float, height: float,
                            margin: float):
        """在指定区域绘制单眼"""
        values = self._get_values_for_display(test_data)
        min_val, max_val = self._get_value_range()
        
        scale = (width - 2 * margin) / 60
        center_x = x + width / 2
        center_y = y + height / 2
        
        # 绘制网格
        self._draw_grid_in_region(x, y, width, height, margin)
        
        # 绘制生理盲点
        self._draw_blind_spot_in_region(x, y, width, height, margin, eye)
        
        point_radius = 12
        
        for point in test_data.points:
            px = point.get('x', 0)
            py = point.get('y', 0)
            value = self._get_point_value(point)
            
            scene_x = center_x + px * scale
            scene_y = center_y - py * scale
            
            color = self._get_color(value, min_val, max_val)
            
            ellipse = self.scene.addEllipse(
                scene_x - point_radius, scene_y - point_radius,
                point_radius * 2, point_radius * 2,
                QPen(Qt.black, 0.5), QBrush(color)
            )
            
            # 添加工具提示
            tooltip = self._create_point_tooltip(point)
            ellipse.setToolTip(tooltip)
        
        # 坐标轴标签
        # 鼻侧/颞侧标签
        nasal_label = self.scene.addText("鼻侧" if eye == "left" else "颞侧")
        nasal_label.setDefaultTextColor(Qt.gray)
        nasal_label.setPos(x + 10, center_y)
        
        temporal_label = self.scene.addText("颞侧" if eye == "left" else "鼻侧")
        temporal_label.setDefaultTextColor(Qt.gray)
        temporal_label.setPos(x + width - 50, center_y)
        
        # 上/下标签
        superior_label = self.scene.addText("上方")
        superior_label.setDefaultTextColor(Qt.gray)
        superior_label.setPos(center_x - 20, y + 10)
        
        inferior_label = self.scene.addText("下方")
        inferior_label.setDefaultTextColor(Qt.gray)
        inferior_label.setPos(center_x - 20, y + height - 25)
        
    def _draw_grid(self, view_size: float, margin: float):
        """绘制背景网格"""
        self._draw_grid_in_region(0, 0, view_size, view_size, margin)
        
    def _draw_grid_in_region(self, x: float, y: float, width: float, height: float, margin: float):
        """在指定区域绘制网格"""
        pen = QPen(QColor(200, 200, 200), 0.5, Qt.DashLine)
        
        center_x = x + width / 2
        center_y = y + height / 2
        
        # 同心圆（10°, 20°, 30°）
        scale = (width - 2 * margin) / 60
        
        for radius_deg in [10, 20, 30]:
            radius = radius_deg * scale
            self.scene.addEllipse(
                center_x - radius, center_y - radius,
                radius * 2, radius * 2,
                pen
            )
        
        # 放射线（0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°）
        import math
        max_radius = 30 * scale
        
        for angle_deg in range(0, 360, 45):
            angle_rad = math.radians(angle_deg)
            
            start_x = center_x
            start_y = center_y
            end_x = center_x + max_radius * math.cos(angle_rad)
            end_y = center_y - max_radius * math.sin(angle_rad)
            
            self.scene.addLine(start_x, start_y, end_x, end_y, pen)
        
        # 水平和垂直中线（实线）
        solid_pen = QPen(QColor(150, 150, 150), 1)
        self.scene.addLine(center_x, y + margin, center_x, y + height - margin, solid_pen)
        self.scene.addLine(x + margin, center_y, x + width - margin, center_y, solid_pen)
        
    def _draw_blind_spot(self, view_size: float, margin: float, eye: str):
        """绘制生理盲点位置"""
        self._draw_blind_spot_in_region(0, 0, view_size, view_size, margin, eye)
        
    def _draw_blind_spot_in_region(self, x: float, y: float, width: float, height: float, 
                                    margin: float, eye: str):
        """在指定区域绘制生理盲点"""
        # 生理盲点位置：
        # 左眼：约在颞侧 15°，水平线上方
        # 右眼：约在颞侧 15°，水平线上方
        # 注意：视野图中，颞侧对于左眼是右侧，对于右眼是左侧
        
        scale = (width - 2 * margin) / 60
        center_x = x + width / 2
        center_y = y + height / 2
        
        # 生理盲点位置（相对于中心凹）
        blind_spot_x_deg = 15  # 颞侧 15°
        blind_spot_y_deg = 1.5  # 稍上方
        
        # 转换坐标
        if eye == "left":
            # 左眼的颞侧在视野图中是右侧（正x）
            bs_x = center_x + blind_spot_x_deg * scale
        else:
            # 右眼的颞侧在视野图中是左侧（负x）
            bs_x = center_x - blind_spot_x_deg * scale
        
        bs_y = center_y - blind_spot_y_deg * scale
        
        # 绘制虚线椭圆表示生理盲点区域
        pen = QPen(QColor(180, 180, 180), 1, Qt.DashLine)
        brush = QBrush(QColor(240, 240, 240, 100))
        
        bs_width = 8 * scale  # 约 8° 宽
        bs_height = 6 * scale  # 约 6° 高
        
        self.scene.addEllipse(
            bs_x - bs_width / 2, bs_y - bs_height / 2,
            bs_width, bs_height,
            pen, brush
        )
        
        # 添加标签
        bs_label = self.scene.addText("生理盲点")
        bs_label.setDefaultTextColor(QColor(150, 150, 150))
        bs_label.setPos(bs_x - 30, bs_y + bs_height / 2 + 5)
        
    def _draw_axis_labels(self, view_size: float, margin: float):
        """绘制坐标轴标签"""
        center_x = view_size / 2
        center_y = view_size / 2
        
        # 中心注视点
        center_pen = QPen(Qt.black, 2)
        self.scene.addEllipse(center_x - 5, center_y - 5, 10, 10, center_pen)
        
        # 方向标签（根据当前眼别）
        if self.current_eye == "left":
            # 左眼视野图
            # 右侧是颞侧，左侧是鼻侧
            nasal_label = self.scene.addText("鼻侧")
            nasal_label.setDefaultTextColor(Qt.gray)
            nasal_label.setPos(margin - 30, center_y)
            
            temporal_label = self.scene.addText("颞侧")
            temporal_label.setDefaultTextColor(Qt.gray)
            temporal_label.setPos(view_size - margin + 10, center_y)
        else:
            # 右眼视野图
            # 右侧是鼻侧，左侧是颞侧
            nasal_label = self.scene.addText("鼻侧")
            nasal_label.setDefaultTextColor(Qt.gray)
            nasal_label.setPos(view_size - margin + 10, center_y)
            
            temporal_label = self.scene.addText("颞侧")
            temporal_label.setDefaultTextColor(Qt.gray)
            temporal_label.setPos(margin - 30, center_y)
        
        # 上/下标签
        superior_label = self.scene.addText("上方")
        superior_label.setDefaultTextColor(Qt.gray)
        superior_label.setPos(center_x - 20, margin - 25)
        
        inferior_label = self.scene.addText("下方")
        inferior_label.setDefaultTextColor(Qt.gray)
        inferior_label.setPos(center_x - 20, view_size - margin + 10)
        
    def _get_values_for_display(self, test_data: VisualFieldTest) -> List[float]:
        """获取用于显示的值列表"""
        values = []
        for point in test_data.points:
            val = self._get_point_value(point)
            if isinstance(val, (int, float)):
                values.append(val)
        return values
        
    def _get_point_value(self, point: Dict[str, Any]) -> Any:
        """获取点位的当前显示值"""
        if self.display_mode == "value":
            return point.get('value')
        elif self.display_mode == "td":
            return point.get('td')
        elif self.display_mode == "pd":
            return point.get('pd')
        return point.get('value')
        
    def _get_value_range(self) -> Tuple[float, float]:
        """获取值的范围"""
        if self.display_mode == "value":
            # 阈值范围：0-40 dB
            return 0, 40
        elif self.display_mode == "td":
            # 总偏差范围：-30 到 +10 dB
            return -30, 10
        elif self.display_mode == "pd":
            # 模式偏差范围：-20 到 +10 dB
            return -20, 10
        return 0, 40
        
    def _get_color(self, value: Any, min_val: float, max_val: float) -> QColor:
        """根据值获取颜色"""
        if value is None:
            return QColor(200, 200, 200)  # 灰色表示缺失
        
        if not isinstance(value, (int, float)):
            return QColor(200, 200, 200)
        
        # 归一化
        normalized = (value - min_val) / (max_val - min_val) if max_val != min_val else 0.5
        normalized = max(0, min(1, normalized))
        
        # 选择颜色映射
        if self.display_mode == "value":
            colormap = self.value_colormap
        elif self.display_mode == "td":
            colormap = self.td_colormap
        else:
            colormap = self.pd_colormap
        
        # 插值颜色
        index = int(normalized * (len(colormap) - 1))
        index = max(0, min(len(colormap) - 1, index))
        
        return QColor(*colormap[index])
        
    def _create_value_colormap(self) -> List[Tuple[int, int, int]]:
        """创建阈值颜色映射（从高到低：蓝->绿->黄->红）"""
        return [
            (255, 0, 0),      # 红色 - 低值（缺损）
            (255, 128, 0),    # 橙色
            (255, 255, 0),    # 黄色
            (128, 255, 0),    # 浅绿
            (0, 255, 0),      # 绿色
            (0, 255, 128),    # 青绿
            (0, 255, 255),    # 青色
            (0, 128, 255),    # 浅蓝
            (0, 0, 255),      # 蓝色 - 高值（正常）
        ]
        
    def _create_td_colormap(self) -> List[Tuple[int, int, int]]:
        """创建总偏差颜色映射（负偏差更明显）"""
        return [
            (0, 0, 0),        # 黑色 - 极负偏差
            (128, 0, 128),    # 紫色
            (255, 0, 0),      # 红色
            (255, 128, 0),    # 橙色
            (255, 255, 0),    # 黄色
            (192, 192, 192),  # 灰色 - 接近正常
            (128, 255, 128),  # 浅绿 - 正偏差
            (0, 255, 0),      # 绿色
        ]
        
    def _create_pd_colormap(self) -> List[Tuple[int, int, int]]:
        """创建模式偏差颜色映射"""
        return [
            (0, 0, 0),        # 黑色 - 极负偏差
            (128, 0, 128),    # 紫色
            (255, 0, 0),      # 红色
            (255, 128, 0),    # 橙色
            (255, 255, 0),    # 黄色
            (192, 192, 192),  # 灰色 - 接近正常
            (128, 255, 128),  # 浅绿
            (0, 255, 0),      # 绿色
        ]
        
    def _is_dark(self, color: QColor) -> bool:
        """判断颜色是否为深色（用于决定文字颜色）"""
        brightness = (color.red() * 299 + color.green() * 587 + color.blue() * 114) / 1000
        return brightness < 128
        
    def _create_point_tooltip(self, point: Dict[str, Any]) -> str:
        """创建点位工具提示"""
        lines = []
        
        location = point.get('location', '未知')
        lines.append(f"<b>点位: {location}</b>")
        
        x = point.get('x')
        y = point.get('y')
        if x is not None and y is not None:
            lines.append(f"位置: ({x:.0f}°, {y:.0f}°)")
        
        value = point.get('value')
        if value is not None:
            lines.append(f"阈值: {value:.1f} dB")
        
        td = point.get('td')
        td_p = point.get('td_p')
        if td is not None:
            td_str = f"总偏差: {td:.1f} dB"
            if td_p is not None:
                td_str += f" (p = {td_p:.3f})"
            lines.append(td_str)
        
        pd = point.get('pd')
        pd_p = point.get('pd_p')
        if pd is not None:
            pd_str = f"模式偏差: {pd:.1f} dB"
            if pd_p is not None:
                pd_str += f" (p = {pd_p:.3f})"
            lines.append(pd_str)
        
        return "<br>".join(lines)
        
    def _update_color_bar(self):
        """更新颜色条"""
        min_val, max_val = self._get_value_range()
        self.color_bar_widget.set_range(min_val, max_val, self.display_mode)


class ColorBarWidget(QWidget):
    """颜色条组件"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumHeight(40)
        self.setMinimumWidth(200)
        
        self.min_val = 0
        self.max_val = 40
        self.mode = "value"
        
    def set_range(self, min_val: float, max_val: float, mode: str):
        """设置范围"""
        self.min_val = min_val
        self.max_val = max_val
        self.mode = mode
        self.update()
        
    def paintEvent(self, event):
        """绘制事件"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        rect = self.rect()
        bar_height = 20
        bar_margin = 5
        
        # 颜色条区域
        bar_rect = QRectF(
            bar_margin, 
            rect.height() / 2 - bar_height / 2,
            rect.width() - 2 * bar_margin,
            bar_height
        )
        
        # 创建渐变
        gradient = QLinearGradient(bar_rect.left(), bar_rect.top(), 
                                   bar_rect.right(), bar_rect.top())
        
        # 根据模式设置颜色
        if self.mode == "value":
            # 阈值：蓝->绿->黄->红
            gradient.setColorAt(0.0, QColor(0, 0, 255))      # 蓝 - 高值
            gradient.setColorAt(0.25, QColor(0, 255, 0))     # 绿
            gradient.setColorAt(0.5, QColor(255, 255, 0))   # 黄
            gradient.setColorAt(0.75, QColor(255, 128, 0))  # 橙
            gradient.setColorAt(1.0, QColor(255, 0, 0))      # 红 - 低值
        else:
            # 偏差：黑->紫->红->橙->黄->灰->绿
            gradient.setColorAt(0.0, QColor(0, 0, 0))        # 黑 - 极负
            gradient.setColorAt(0.2, QColor(128, 0, 128))    # 紫
            gradient.setColorAt(0.4, QColor(255, 0, 0))      # 红
            gradient.setColorAt(0.6, QColor(255, 255, 0))    # 黄
            gradient.setColorAt(0.8, QColor(192, 192, 192))  # 灰
            gradient.setColorAt(1.0, QColor(0, 255, 0))      # 绿 - 正
        
        # 绘制颜色条
        painter.fillRect(bar_rect, gradient)
        
        # 绘制边框
        painter.setPen(QPen(Qt.black, 1))
        painter.drawRect(bar_rect)
        
        # 绘制标签
        painter.setPen(Qt.black)
        font = painter.font()
        font.setPointSize(9)
        painter.setFont(font)
        
        # 最小值标签
        min_label = f"{self.min_val:.0f}"
        min_rect = painter.boundingRect(0, 0, 100, 20, Qt.AlignLeft, min_label)
        painter.drawText(
            bar_rect.left(), 
            bar_rect.bottom() + 5,
            min_label
        )
        
        # 最大值标签
        max_label = f"{self.max_val:.0f}"
        max_rect = painter.boundingRect(0, 0, 100, 20, Qt.AlignRight, max_label)
        painter.drawText(
            bar_rect.right() - max_rect.width(), 
            bar_rect.bottom() + 5,
            max_label
        )
        
        # 模式标签
        mode_labels = {
            "value": "阈值 (dB)",
            "td": "总偏差 (dB)",
            "pd": "模式偏差 (dB)"
        }
        mode_label = mode_labels.get(self.mode, "")
        if mode_label:
            painter.drawText(
                bar_rect.center().x() - 40,
                bar_rect.top() - 5,
                mode_label
            )
