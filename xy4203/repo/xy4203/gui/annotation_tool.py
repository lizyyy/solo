#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
标注工具模块 - 支持人工圈选复核
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, List, Dict, Any, Tuple
import cv2
import numpy as np
from PIL import Image, ImageTk
from datetime import datetime

from persistence.data_store import ManualAnnotation


class AnnotationTool(tk.Frame):
    """
    人工圈选标注工具
    支持矩形、椭圆、多边形、自由绘制等多种标注方式
    """
    
    # 标注工具类型
    TOOL_RECTANGLE = "rectangle"
    TOOL_ELLIPSE = "ellipse"
    TOOL_POLYGON = "polygon"
    TOOL_FREEHAND = "freehand"
    TOOL_SELECT = "select"
    
    def __init__(self, parent, *args, **kwargs):
        """
        初始化标注工具
        
        Args:
            parent: 父组件
        """
        super().__init__(parent, *args, **kwargs)
        
        # 初始化属性
        self.current_tool = self.TOOL_SELECT
        self.annotations: List[ManualAnnotation] = []
        self.selected_annotation: Optional[ManualAnnotation] = None
        
        # 绘制状态
        self.is_drawing = False
        self.start_x = 0
        self.start_y = 0
        self.current_x = 0
        self.current_y = 0
        
        # 多边形绘制点
        self.polygon_points: List[Tuple[int, int]] = []
        
        # 自由绘制点
        self.freehand_points: List[Tuple[int, int]] = []
        
        # 图像相关
        self.base_image: Optional[np.ndarray] = None
        self.display_image: Optional[ImageTk.PhotoImage] = None
        
        # 缩放和平移
        self.zoom_factor = 1.0
        self.offset_x = 0
        self.offset_y = 0
        
        # 创建UI组件
        self._create_widgets()
        
        # 绑定事件
        self._bind_events()
    
    def _create_widgets(self):
        """创建UI组件"""
        # 工具选择栏
        self.toolbar = ttk.Frame(self)
        self.toolbar.pack(fill=tk.X, pady=5)
        
        # 工具按钮
        ttk.Label(self.toolbar, text="标注工具:").pack(side=tk.LEFT, padx=5)
        
        # 工具按钮帧
        self.tool_buttons_frame = ttk.Frame(self.toolbar)
        self.tool_buttons_frame.pack(side=tk.LEFT, padx=5)
        
        # 创建工具按钮
        self.tool_buttons: Dict[str, ttk.Button] = {}
        
        tools = [
            (self.TOOL_SELECT, "选择", "✋"),
            (self.TOOL_RECTANGLE, "矩形", "▢"),
            (self.TOOL_ELLIPSE, "椭圆", "○"),
            (self.TOOL_POLYGON, "多边形", "⬡"),
            (self.TOOL_FREEHAND, "自由绘制", "✎"),
        ]
        
        for tool_id, tool_name, tool_icon in tools:
            btn = ttk.Button(
                self.tool_buttons_frame,
                text=f"{tool_icon} {tool_name}",
                command=lambda t=tool_id: self._select_tool(t),
                width=8
            )
            btn.pack(side=tk.LEFT, padx=2)
            self.tool_buttons[tool_id] = btn
        
        # 分隔线
        ttk.Separator(self.toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 操作按钮
        ttk.Button(self.toolbar, text="删除", command=self._delete_selected, width=6).pack(side=tk.LEFT, padx=2)
        ttk.Button(self.toolbar, text="清除全部", command=self._clear_all, width=8).pack(side=tk.LEFT, padx=2)
        
        # 分隔线
        ttk.Separator(self.toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 标签输入
        ttk.Label(self.toolbar, text="标签:").pack(side=tk.LEFT, padx=5)
        self.label_var = tk.StringVar()
        self.label_entry = ttk.Entry(self.toolbar, textvariable=self.label_var, width=15)
        self.label_entry.pack(side=tk.LEFT, padx=5)
        
        # 预设标签
        ttk.Label(self.toolbar, text="预设:").pack(side=tk.LEFT, padx=5)
        preset_labels = ["缺损", "补纸", "色差", "污渍", "褶皱", "其他"]
        self.preset_combobox = ttk.Combobox(
            self.toolbar, 
            values=preset_labels,
            state="readonly",
            width=8
        )
        self.preset_combobox.pack(side=tk.LEFT, padx=5)
        self.preset_combobox.bind("<<ComboboxSelected>>", self._on_preset_selected)
        
        # 画布区域
        self.canvas_frame = ttk.Frame(self)
        self.canvas_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 创建画布
        self.canvas = tk.Canvas(
            self.canvas_frame,
            bg="gray20",
            highlightthickness=0,
            cursor="cross"
        )
        
        # 滚动条
        self.scroll_x = ttk.Scrollbar(self.canvas_frame, orient=tk.HORIZONTAL, command=self.canvas.xview)
        self.scroll_y = ttk.Scrollbar(self.canvas_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        
        self.canvas.configure(xscrollcommand=self.scroll_x.set, yscrollcommand=self.scroll_y.set)
        
        # 布局
        self.scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 属性面板（右侧）
        self.properties_frame = ttk.LabelFrame(self, text="标注属性", padding=5)
        self.properties_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=5, pady=5)
        
        # 属性内容
        ttk.Label(self.properties_frame, text="ID:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.id_label = ttk.Label(self.properties_frame, text="-")
        self.id_label.grid(row=0, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(self.properties_frame, text="类型:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.type_label = ttk.Label(self.properties_frame, text="-")
        self.type_label.grid(row=1, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(self.properties_frame, text="标签:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.prop_label_var = tk.StringVar()
        self.prop_label_entry = ttk.Entry(self.properties_frame, textvariable=self.prop_label_var, width=15)
        self.prop_label_entry.grid(row=2, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(self.properties_frame, text="面积:").grid(row=3, column=0, sticky=tk.W, pady=2)
        self.area_label = ttk.Label(self.properties_frame, text="-")
        self.area_label.grid(row=3, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(self.properties_frame, text="位置:").grid(row=4, column=0, sticky=tk.W, pady=2)
        self.position_label = ttk.Label(self.properties_frame, text="-")
        self.position_label.grid(row=4, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(self.properties_frame, text="描述:").grid(row=5, column=0, sticky=tk.NW, pady=2)
        self.description_text = tk.Text(self.properties_frame, width=15, height=4, wrap=tk.WORD)
        self.description_text.grid(row=5, column=1, sticky=tk.W, pady=2)
        
        # 应用按钮
        ttk.Button(
            self.properties_frame, 
            text="应用更改", 
            command=self._apply_property_changes
        ).grid(row=6, column=0, columnspan=2, pady=10)
        
        # 状态栏
        self.status_bar = ttk.Frame(self)
        self.status_bar.pack(fill=tk.X, pady=2)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪", anchor=tk.W)
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        self.coord_label = ttk.Label(self.status_bar, text="", anchor=tk.E)
        self.coord_label.pack(side=tk.RIGHT, padx=5)
        
        # 高亮当前选择的工具
        self._select_tool(self.TOOL_SELECT)
    
    def _bind_events(self):
        """绑定事件"""
        # 鼠标事件
        self.canvas.bind("<ButtonPress-1>", self._on_mouse_down)
        self.canvas.bind("<B1-Motion>", self._on_mouse_move)
        self.canvas.bind("<ButtonRelease-1>", self._on_mouse_up)
        
        # 双击完成多边形
        self.canvas.bind("<Double-Button-1>", self._on_double_click)
        
        # 右键取消
        self.canvas.bind("<ButtonPress-3>", self._on_right_click)
        
        # 鼠标移动显示坐标
        self.canvas.bind("<Motion>", self._on_mouse_hover)
        
        # 键盘事件
        self.canvas.bind("<Delete>", lambda e: self._delete_selected())
        self.canvas.bind("<Escape>", self._cancel_drawing)
        
        # 画布配置改变
        self.canvas.bind("<Configure>", self._on_canvas_configure)
    
    def load_image(self, image: np.ndarray):
        """
        加载图像
        
        Args:
            image: OpenCV格式图像（BGR）
        """
        self.base_image = image.copy()
        self._redraw()
    
    def set_annotations(self, annotations: List[ManualAnnotation]):
        """
        设置标注列表
        
        Args:
            annotations: 标注列表
        """
        self.annotations = annotations.copy()
        self.selected_annotation = None
        self._redraw()
    
    def get_annotations(self) -> List[ManualAnnotation]:
        """
        获取当前所有标注
        
        Returns:
            标注列表
        """
        return self.annotations.copy()
    
    def _select_tool(self, tool_id: str):
        """
        选择标注工具
        
        Args:
            tool_id: 工具ID
        """
        self.current_tool = tool_id
        
        # 更新按钮样式
        for tid, btn in self.tool_buttons.items():
            if tid == tool_id:
                btn.configure(style="Accent.TButton")
            else:
                btn.configure(style="TButton")
        
        # 更新光标
        if tool_id == self.TOOL_SELECT:
            self.canvas.configure(cursor="arrow")
        else:
            self.canvas.configure(cursor="cross")
        
        # 取消正在进行的绘制
        self._cancel_drawing()
        
        self._update_status(f"已选择工具: {self._get_tool_name(tool_id)}")
    
    def _get_tool_name(self, tool_id: str) -> str:
        """获取工具名称"""
        names = {
            self.TOOL_SELECT: "选择",
            self.TOOL_RECTANGLE: "矩形",
            self.TOOL_ELLIPSE: "椭圆",
            self.TOOL_POLYGON: "多边形",
            self.TOOL_FREEHAND: "自由绘制",
        }
        return names.get(tool_id, "未知")
    
    def _on_mouse_down(self, event):
        """鼠标按下事件"""
        # 转换为图像坐标
        img_x, img_y = self._screen_to_image(event.x, event.y)
        
        if self.current_tool == self.TOOL_SELECT:
            # 选择模式：查找点击的标注
            self._select_annotation_at(img_x, img_y)
        else:
            # 绘制模式
            self.is_drawing = True
            self.start_x = img_x
            self.start_y = img_y
            self.current_x = img_x
            self.current_y = img_y
            
            if self.current_tool == self.TOOL_POLYGON:
                # 多边形：添加第一个点
                if not self.polygon_points:
                    self.polygon_points = [(img_x, img_y)]
                else:
                    self.polygon_points.append((img_x, img_y))
            elif self.current_tool == self.TOOL_FREEHAND:
                # 自由绘制：开始记录点
                self.freehand_points = [(img_x, img_y)]
        
        self._redraw()
    
    def _on_mouse_move(self, event):
        """鼠标移动事件"""
        # 转换为图像坐标
        img_x, img_y = self._screen_to_image(event.x, event.y)
        self.current_x = img_x
        self.current_y = img_y
        
        if self.is_drawing:
            if self.current_tool == self.TOOL_FREEHAND:
                # 自由绘制：记录连续点
                self.freehand_points.append((img_x, img_y))
            
            self._redraw()
    
    def _on_mouse_up(self, event):
        """鼠标释放事件"""
        if not self.is_drawing:
            return
        
        self.is_drawing = False
        
        # 转换为图像坐标
        img_x, img_y = self._screen_to_image(event.x, event.y)
        self.current_x = img_x
        self.current_y = img_y
        
        if self.current_tool == self.TOOL_RECTANGLE:
            self._create_rectangle_annotation()
        elif self.current_tool == self.TOOL_ELLIPSE:
            self._create_ellipse_annotation()
        elif self.current_tool == self.TOOL_FREEHAND:
            self._create_freehand_annotation()
        
        # 多边形不在这里完成，需要双击或右键
        
        self._redraw()
    
    def _on_double_click(self, event):
        """双击事件"""
        if self.current_tool == self.TOOL_POLYGON and len(self.polygon_points) >= 3:
            # 完成多边形
            self._create_polygon_annotation()
            self._redraw()
    
    def _on_right_click(self, event):
        """右键点击事件"""
        self._cancel_drawing()
        self._redraw()
    
    def _cancel_drawing(self):
        """取消当前绘制"""
        self.is_drawing = False
        self.polygon_points = []
        self.freehand_points = []
    
    def _create_rectangle_annotation(self):
        """创建矩形标注"""
        x1, y1 = self.start_x, self.start_y
        x2, y2 = self.current_x, self.current_y
        
        # 确保x1 < x2, y1 < y2
        x = min(x1, x2)
        y = min(y1, y2)
        width = abs(x2 - x1)
        height = abs(y2 - y1)
        
        # 计算面积
        area = width * height
        
        # 创建标注
        annotation = ManualAnnotation(
            id=self._generate_annotation_id(),
            annotation_type=self.TOOL_RECTANGLE,
            coordinates=[{"x": x, "y": y}, {"x": x + width, "y": y}, 
                         {"x": x + width, "y": y + height}, {"x": x, "y": y + height}],
            width=width,
            height=height,
            area=area,
            label=self.label_var.get() or "矩形标注",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        
        self.annotations.append(annotation)
        self.selected_annotation = annotation
        
        self._update_status(f"已创建矩形标注，面积: {area:.0f} 像素")
        self._update_properties_panel()
    
    def _create_ellipse_annotation(self):
        """创建椭圆标注"""
        x1, y1 = self.start_x, self.start_y
        x2, y2 = self.current_x, self.current_y
        
        # 计算中心和半径
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        width = abs(x2 - x1)
        height = abs(y2 - y1)
        
        # 椭圆面积（近似）
        area = np.pi * (width / 2) * (height / 2)
        
        # 创建标注（用多边形点近似椭圆边界）
        points = []
        num_points = 20
        for i in range(num_points):
            angle = 2 * np.pi * i / num_points
            px = center_x + (width / 2) * np.cos(angle)
            py = center_y + (height / 2) * np.sin(angle)
            points.append({"x": px, "y": py})
        
        annotation = ManualAnnotation(
            id=self._generate_annotation_id(),
            annotation_type=self.TOOL_ELLIPSE,
            coordinates=points,
            width=width,
            height=height,
            area=area,
            label=self.label_var.get() or "椭圆标注",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        
        self.annotations.append(annotation)
        self.selected_annotation = annotation
        
        self._update_status(f"已创建椭圆标注，面积: {area:.0f} 像素")
        self._update_properties_panel()
    
    def _create_polygon_annotation(self):
        """创建多边形标注"""
        if len(self.polygon_points) < 3:
            return
        
        # 转换点格式
        coordinates = [{"x": x, "y": y} for x, y in self.polygon_points]
        
        # 计算边界框
        xs = [p[0] for p in self.polygon_points]
        ys = [p[1] for p in self.polygon_points]
        x = min(xs)
        y = min(ys)
        width = max(xs) - x
        height = max(ys) - y
        
        # 计算多边形面积（使用 shoelace 公式）
        area = self._calculate_polygon_area(self.polygon_points)
        
        annotation = ManualAnnotation(
            id=self._generate_annotation_id(),
            annotation_type=self.TOOL_POLYGON,
            coordinates=coordinates,
            width=width,
            height=height,
            area=area,
            label=self.label_var.get() or "多边形标注",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        
        self.annotations.append(annotation)
        self.selected_annotation = annotation
        
        # 清除绘制点
        self.polygon_points = []
        
        self._update_status(f"已创建多边形标注，面积: {area:.0f} 像素")
        self._update_properties_panel()
    
    def _create_freehand_annotation(self):
        """创建自由绘制标注"""
        if len(self.freehand_points) < 3:
            return
        
        # 转换点格式
        coordinates = [{"x": x, "y": y} for x, y in self.freehand_points]
        
        # 计算边界框
        xs = [p[0] for p in self.freehand_points]
        ys = [p[1] for p in self.freehand_points]
        x = min(xs)
        y = min(ys)
        width = max(xs) - x
        height = max(ys) - y
        
        # 计算面积（简化：最小包围矩形面积）
        area = width * height
        
        annotation = ManualAnnotation(
            id=self._generate_annotation_id(),
            annotation_type=self.TOOL_FREEHAND,
            coordinates=coordinates,
            width=width,
            height=height,
            area=area,
            label=self.label_var.get() or "自由绘制标注",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        
        self.annotations.append(annotation)
        self.selected_annotation = annotation
        
        # 清除绘制点
        self.freehand_points = []
        
        self._update_status(f"已创建自由绘制标注，面积: {area:.0f} 像素")
        self._update_properties_panel()
    
    def _calculate_polygon_area(self, points: List[Tuple[float, float]]) -> float:
        """
        计算多边形面积（Shoelace公式）
        
        Args:
            points: 多边形顶点列表 [(x1,y1), (x2,y2), ...]
            
        Returns:
            面积值
        """
        if len(points) < 3:
            return 0.0
        
        n = len(points)
        area = 0.0
        
        for i in range(n):
            j = (i + 1) % n
            area += points[i][0] * points[j][1]
            area -= points[j][0] * points[i][1]
        
        return abs(area) / 2.0
    
    def _generate_annotation_id(self) -> str:
        """生成标注ID"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"ann_{timestamp}_{len(self.annotations)}"
    
    def _select_annotation_at(self, x: float, y: float):
        """
        选择指定位置的标注
        
        Args:
            x, y: 图像坐标
        """
        # 从后往前找（选择最上层的）
        for annotation in reversed(self.annotations):
            if self._is_point_in_annotation(x, y, annotation):
                self.selected_annotation = annotation
                self._update_properties_panel()
                self._update_status(f"已选择标注: {annotation.label}")
                return
        
        # 没有找到
        self.selected_annotation = None
        self._update_properties_panel()
    
    def _is_point_in_annotation(self, x: float, y: float, annotation: ManualAnnotation) -> bool:
        """
        检查点是否在标注范围内
        
        Args:
            x, y: 点坐标
            annotation: 标注对象
            
        Returns:
            是否在范围内
        """
        if not annotation.coordinates:
            return False
        
        # 对于矩形和椭圆，使用边界框判断
        if annotation.annotation_type in [self.TOOL_RECTANGLE, self.TOOL_ELLIPSE]:
            # 获取边界框
            if annotation.coordinates:
                xs = [p["x"] for p in annotation.coordinates]
                ys = [p["y"] for p in annotation.coordinates]
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                
                return x_min <= x <= x_max and y_min <= y <= y_max
        
        # 对于多边形和自由绘制，使用点在多边形内判断
        elif annotation.annotation_type in [self.TOOL_POLYGON, self.TOOL_FREEHAND]:
            points = [(p["x"], p["y"]) for p in annotation.coordinates]
            return self._point_in_polygon(x, y, points)
        
        return False
    
    def _point_in_polygon(self, x: float, y: float, points: List[Tuple[float, float]]) -> bool:
        """
        点在多边形内判断（射线法）
        
        Args:
            x, y: 点坐标
            points: 多边形顶点
            
        Returns:
            是否在多边形内
        """
        n = len(points)
        inside = False
        
        p1x, p1y = points[0]
        for i in range(n + 1):
            p2x, p2y = points[i % n]
            
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            
            p1x, p1y = p2x, p2y
        
        return inside
    
    def _delete_selected(self):
        """删除选中的标注"""
        if self.selected_annotation and self.selected_annotation in self.annotations:
            self.annotations.remove(self.selected_annotation)
            self.selected_annotation = None
            self._update_properties_panel()
            self._redraw()
            self._update_status("已删除选中的标注")
    
    def _clear_all(self):
        """清除所有标注"""
        if self.annotations:
            if messagebox.askyesno("确认", "确定要清除所有标注吗？"):
                self.annotations = []
                self.selected_annotation = None
                self._update_properties_panel()
                self._redraw()
                self._update_status("已清除所有标注")
    
    def _update_properties_panel(self):
        """更新属性面板"""
        if self.selected_annotation:
            ann = self.selected_annotation
            self.id_label.config(text=ann.id[-8:] if len(ann.id) > 8 else ann.id)
            
            type_names = {
                self.TOOL_RECTANGLE: "矩形",
                self.TOOL_ELLIPSE: "椭圆",
                self.TOOL_POLYGON: "多边形",
                self.TOOL_FREEHAND: "自由绘制",
            }
            self.type_label.config(text=type_names.get(ann.annotation_type, ann.annotation_type))
            
            self.prop_label_var.set(ann.label)
            self.area_label.config(text=f"{ann.area:.0f} px²")
            
            if ann.coordinates and len(ann.coordinates) >= 2:
                xs = [p["x"] for p in ann.coordinates]
                ys = [p["y"] for p in ann.coordinates]
                x, y = min(xs), min(ys)
                self.position_label.config(text=f"({x:.0f}, {y:.0f})")
            else:
                self.position_label.config(text="-")
            
            self.description_text.delete(1.0, tk.END)
            self.description_text.insert(tk.END, ann.description or "")
        else:
            self.id_label.config(text="-")
            self.type_label.config(text="-")
            self.prop_label_var.set("")
            self.area_label.config(text="-")
            self.position_label.config(text="-")
            self.description_text.delete(1.0, tk.END)
    
    def _apply_property_changes(self):
        """应用属性更改"""
        if self.selected_annotation:
            self.selected_annotation.label = self.prop_label_var.get()
            self.selected_annotation.description = self.description_text.get(1.0, tk.END).strip()
            self.selected_annotation.updated_at = datetime.now().isoformat()
            self._redraw()
            self._update_status("已更新标注属性")
    
    def _on_preset_selected(self, event=None):
        """预设标签选择事件"""
        selected = self.preset_combobox.get()
        if selected:
            self.label_var.set(selected)
    
    def _on_mouse_hover(self, event):
        """鼠标悬停事件"""
        # 转换为图像坐标
        img_x, img_y = self._screen_to_image(event.x, event.y)
        self.coord_label.config(text=f"({img_x:.0f}, {img_y:.0f})")
    
    def _on_canvas_configure(self, event):
        """画布配置改变事件"""
        self._redraw()
    
    def _screen_to_image(self, screen_x: int, screen_y: int) -> Tuple[float, float]:
        """
        屏幕坐标转换为图像坐标
        
        Args:
            screen_x, screen_y: 屏幕坐标
            
        Returns:
            图像坐标
        """
        # 这里需要考虑缩放和平移
        # 简化实现：直接返回
        return (screen_x - self.offset_x) / self.zoom_factor, (screen_y - self.offset_y) / self.zoom_factor
    
    def _image_to_screen(self, img_x: float, img_y: float) -> Tuple[float, float]:
        """
        图像坐标转换为屏幕坐标
        
        Args:
            img_x, img_y: 图像坐标
            
        Returns:
            屏幕坐标
        """
        return img_x * self.zoom_factor + self.offset_x, img_y * self.zoom_factor + self.offset_y
    
    def _redraw(self):
        """重新绘制"""
        self.canvas.delete("all")
        
        if self.base_image is not None:
            # 绘制基础图像
            display_img = self.base_image.copy()
            
            # 转换为RGB
            display_img = cv2.cvtColor(display_img, cv2.COLOR_BGR2RGB)
            
            # 绘制所有标注
            overlay = display_img.copy()
            
            for annotation in self.annotations:
                is_selected = (annotation == self.selected_annotation)
                self._draw_annotation(overlay, annotation, is_selected)
            
            # 绘制正在进行的绘制
            if self.is_drawing:
                if self.current_tool == self.TOOL_RECTANGLE:
                    cv2.rectangle(
                        overlay,
                        (int(self.start_x), int(self.start_y)),
                        (int(self.current_x), int(self.current_y)),
                        (255, 165, 0),  # 橙色
                        2
                    )
                elif self.current_tool == self.TOOL_ELLIPSE:
                    center_x = int((self.start_x + self.current_x) / 2)
                    center_y = int((self.start_y + self.current_y) / 2)
                    width = int(abs(self.current_x - self.start_x) / 2)
                    height = int(abs(self.current_y - self.start_y) / 2)
                    cv2.ellipse(
                        overlay,
                        (center_x, center_y),
                        (width, height),
                        0, 0, 360,
                        (255, 165, 0),
                        2
                    )
                elif self.current_tool == self.TOOL_FREEHAND and len(self.freehand_points) >= 2:
                    points = np.array(self.freehand_points, np.int32)
                    cv2.polylines(
                        overlay,
                        [points],
                        False,
                        (255, 165, 0),
                        2
                    )
            
            # 绘制多边形点
            if self.current_tool == self.TOOL_POLYGON and len(self.polygon_points) >= 1:
                points = np.array(self.polygon_points, np.int32)
                if len(points) >= 2:
                    cv2.polylines(
                        overlay,
                        [points],
                        False,
                        (255, 165, 0),
                        2
                    )
                # 绘制顶点
                for i, (x, y) in enumerate(self.polygon_points):
                    cv2.circle(overlay, (int(x), int(y)), 4, (255, 165, 0), -1)
            
            # 转换为PIL图像
            pil_image = Image.fromarray(overlay)
            self.display_image = ImageTk.PhotoImage(pil_image)
            
            # 绘制到画布
            self.canvas.create_image(
                self.offset_x,
                self.offset_y,
                anchor=tk.NW,
                image=self.display_image
            )
            
            # 更新滚动区域
            self.canvas.configure(scrollregion=self.canvas.bbox(tk.ALL))
    
    def _draw_annotation(self, image: np.ndarray, annotation: ManualAnnotation, is_selected: bool):
        """
        在图像上绘制标注
        
        Args:
            image: 目标图像
            annotation: 标注对象
            is_selected: 是否被选中
        """
        if not annotation.coordinates:
            return
        
        # 转换点为整数坐标
        points = [(int(p["x"]), int(p["y"])) for p in annotation.coordinates]
        
        # 选择颜色
        if is_selected:
            color = (0, 255, 0)  # 绿色（选中）
            thickness = 3
        else:
            color = (255, 0, 0)  # 红色（未选中）
            thickness = 2
        
        # 根据类型绘制
        if annotation.annotation_type == self.TOOL_RECTANGLE:
            if len(points) >= 2:
                x1, y1 = points[0]
                x2, y2 = points[2] if len(points) >= 3 else points[1]
                cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)
        
        elif annotation.annotation_type == self.TOOL_ELLIPSE:
            if len(points) >= 3:
                # 计算中心和半径
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                center_x = int(np.mean(xs))
                center_y = int(np.mean(ys))
                width = int((max(xs) - min(xs)) / 2)
                height = int((max(ys) - min(ys)) / 2)
                cv2.ellipse(image, (center_x, center_y), (width, height), 0, 0, 360, color, thickness)
        
        elif annotation.annotation_type in [self.TOOL_POLYGON, self.TOOL_FREEHAND]:
            if len(points) >= 2:
                pts = np.array(points, np.int32)
                cv2.polylines(image, [pts], annotation.annotation_type == self.TOOL_POLYGON, color, thickness)
        
        # 绘制标签
        if annotation.label:
            if points:
                x, y = points[0]
                cv2.putText(
                    image,
                    annotation.label,
                    (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    1
                )
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_label.config(text=message)
    
    def clear(self):
        """清除所有内容"""
        self.base_image = None
        self.annotations = []
        self.selected_annotation = None
        self.canvas.delete("all")
        self._update_properties_panel()
        self._update_status("就绪")
