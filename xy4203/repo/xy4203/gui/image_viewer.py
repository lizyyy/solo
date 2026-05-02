#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图像查看器模块 - 支持并排/叠加查看图像
"""

import tkinter as tk
from tkinter import ttk
from typing import Optional, Tuple, List, Dict, Any
import cv2
import numpy as np
from PIL import Image, ImageTk

from image_processing.comparator import ImageComparator


class ImageViewer(tk.Frame):
    """
    图像查看器
    支持并排显示、叠加显示、差异图显示等多种查看模式
    """
    
    # 查看模式
    MODE_SIDE_BY_SIDE = "side_by_side"
    MODE_OVERLAY = "overlay"
    MODE_DIFFERENCE = "difference"
    MODE_BEFORE = "before"
    MODE_AFTER = "after"
    
    def __init__(self, parent, *args, **kwargs):
        """
        初始化图像查看器
        
        Args:
            parent: 父组件
        """
        super().__init__(parent, *args, **kwargs)
        
        # 初始化属性
        self.comparator = ImageComparator()
        self.current_mode = self.MODE_SIDE_BY_SIDE
        self.overlay_alpha = 0.5
        
        self.before_image_path: Optional[str] = None
        self.after_image_path: Optional[str] = None
        
        self.current_image: Optional[np.ndarray] = None
        self.display_image: Optional[ImageTk.PhotoImage] = None
        
        self.zoom_factor = 1.0
        self.pan_start_x = 0
        self.pan_start_y = 0
        self.pan_offset_x = 0
        self.pan_offset_y = 0
        
        # 标记是否正在平移
        self.is_panning = False
        
        # 创建UI组件
        self._create_widgets()
        
        # 绑定事件
        self._bind_events()
    
    def _create_widgets(self):
        """创建UI组件"""
        # 控制工具栏
        self.toolbar = ttk.Frame(self)
        self.toolbar.pack(fill=tk.X, pady=5)
        
        # 查看模式选择
        ttk.Label(self.toolbar, text="查看模式:").pack(side=tk.LEFT, padx=5)
        
        self.mode_var = tk.StringVar(value=self.MODE_SIDE_BY_SIDE)
        
        mode_combobox = ttk.Combobox(
            self.toolbar, 
            textvariable=self.mode_var,
            values=[
                ("并排显示", self.MODE_SIDE_BY_SIDE),
                ("叠加显示", self.MODE_OVERLAY),
                ("差异图", self.MODE_DIFFERENCE),
                ("仅修复前", self.MODE_BEFORE),
                ("仅修复后", self.MODE_AFTER)
            ],
            state="readonly",
            width=15
        )
        mode_combobox.pack(side=tk.LEFT, padx=5)
        mode_combobox.bind("<<ComboboxSelected>>", self._on_mode_changed)
        
        # 叠加透明度控制（仅在叠加模式下显示）
        self.alpha_frame = ttk.Frame(self.toolbar)
        self.alpha_frame.pack(side=tk.LEFT, padx=10)
        
        ttk.Label(self.alpha_frame, text="透明度:").pack(side=tk.LEFT)
        
        self.alpha_scale = ttk.Scale(
            self.alpha_frame, 
            from_=0.1, 
            to=0.9, 
            value=self.overlay_alpha,
            orient=tk.HORIZONTAL,
            length=100,
            command=self._on_alpha_changed
        )
        self.alpha_scale.pack(side=tk.LEFT, padx=5)
        
        # 缩放控制
        ttk.Label(self.toolbar, text="缩放:").pack(side=tk.LEFT, padx=10)
        
        self.zoom_var = tk.StringVar(value="100%")
        zoom_label = ttk.Label(self.toolbar, textvariable=self.zoom_var)
        zoom_label.pack(side=tk.LEFT)
        
        ttk.Button(self.toolbar, text="+", command=self.zoom_in, width=3).pack(side=tk.LEFT, padx=2)
        ttk.Button(self.toolbar, text="-", command=self.zoom_out, width=3).pack(side=tk.LEFT, padx=2)
        ttk.Button(self.toolbar, text="1:1", command=self.reset_zoom, width=4).pack(side=tk.LEFT, padx=2)
        ttk.Button(self.toolbar, text="适应", command=self.fit_to_window, width=4).pack(side=tk.LEFT, padx=2)
        
        # 图像显示区域
        self.canvas_frame = ttk.Frame(self)
        self.canvas_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 创建画布
        self.canvas = tk.Canvas(
            self.canvas_frame, 
            bg="gray20",
            highlightthickness=0
        )
        
        # 添加滚动条
        self.scroll_x = ttk.Scrollbar(self.canvas_frame, orient=tk.HORIZONTAL, command=self.canvas.xview)
        self.scroll_y = ttk.Scrollbar(self.canvas_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        
        self.canvas.configure(xscrollcommand=self.scroll_x.set, yscrollcommand=self.scroll_y.set)
        
        # 布局
        self.scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 状态信息栏
        self.status_bar = ttk.Frame(self)
        self.status_bar.pack(fill=tk.X, pady=2)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪", anchor=tk.W)
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        self.position_label = ttk.Label(self.status_bar, text="", anchor=tk.E)
        self.position_label.pack(side=tk.RIGHT, padx=5)
    
    def _bind_events(self):
        """绑定事件"""
        # 鼠标滚轮缩放
        self.canvas.bind("<MouseWheel>", self._on_mouse_wheel)
        self.canvas.bind("<Button-4>", self._on_mouse_wheel)
        self.canvas.bind("<Button-5>", self._on_mouse_wheel)
        
        # 鼠标平移
        self.canvas.bind("<ButtonPress-2>", self._on_pan_start)
        self.canvas.bind("<B2-Motion>", self._on_pan_move)
        self.canvas.bind("<ButtonRelease-2>", self._on_pan_end)
        
        # 鼠标中键也可以用Ctrl+左键
        self.canvas.bind("<Control-ButtonPress-1>", self._on_pan_start)
        self.canvas.bind("<Control-B1-Motion>", self._on_pan_move)
        self.canvas.bind("<Control-ButtonRelease-1>", self._on_pan_end)
        
        # 鼠标移动显示位置
        self.canvas.bind("<Motion>", self._on_mouse_move)
        
        # 画布大小变化
        self.canvas.bind("<Configure>", self._on_canvas_configure)
    
    def load_images(self, before_path: str, after_path: str) -> bool:
        """
        加载修复前后的图像
        
        Args:
            before_path: 修复前图像路径
            after_path: 修复后图像路径
            
        Returns:
            是否加载成功
        """
        self.before_image_path = before_path
        self.after_image_path = after_path
        
        # 使用比较器加载图像
        success = self.comparator.load_images(before_path, after_path)
        
        if success:
            # 更新显示
            self._update_display()
            self._update_status(f"已加载图像: {before_path.split('/')[-1]} 和 {after_path.split('/')[-1]}")
        
        return success
    
    def _update_display(self):
        """更新图像显示"""
        if self.comparator.before_image is None or self.comparator.after_image is None:
            return
        
        # 根据当前模式获取显示图像
        if self.current_mode == self.MODE_SIDE_BY_SIDE:
            display_image = self.comparator.get_side_by_side()
        elif self.current_mode == self.MODE_OVERLAY:
            display_image = self.comparator.get_overlay(self.overlay_alpha)
        elif self.current_mode == self.MODE_DIFFERENCE:
            display_image = self.comparator.get_difference_map()
        elif self.current_mode == self.MODE_BEFORE:
            display_image = self.comparator.before_image.copy()
        elif self.current_mode == self.MODE_AFTER:
            display_image = self.comparator.after_image.copy()
        else:
            display_image = self.comparator.get_side_by_side()
        
        # 应用缩放
        if self.zoom_factor != 1.0:
            height, width = display_image.shape[:2]
            new_width = int(width * self.zoom_factor)
            new_height = int(height * self.zoom_factor)
            display_image = cv2.resize(display_image, (new_width, new_height))
        
        self.current_image = display_image
        
        # 转换为PIL图像
        pil_image = self.comparator.to_pil_image(display_image)
        
        # 转换为Tkinter图像
        self.display_image = ImageTk.PhotoImage(pil_image)
        
        # 清除画布
        self.canvas.delete("all")
        
        # 绘制图像
        self.canvas.create_image(
            self.pan_offset_x, 
            self.pan_offset_y,
            anchor=tk.NW,
            image=self.display_image
        )
        
        # 更新滚动区域
        self.canvas.configure(scrollregion=self.canvas.bbox(tk.ALL))
        
        # 更新缩放显示
        self.zoom_var.set(f"{int(self.zoom_factor * 100)}%")
    
    def _on_mode_changed(self, event=None):
        """查看模式改变事件"""
        # 获取选择的模式值
        selection = self.mode_var.get()
        
        # 从显示文本中提取实际值
        mode_map = {
            "并排显示": self.MODE_SIDE_BY_SIDE,
            "叠加显示": self.MODE_OVERLAY,
            "差异图": self.MODE_DIFFERENCE,
            "仅修复前": self.MODE_BEFORE,
            "仅修复后": self.MODE_AFTER,
            self.MODE_SIDE_BY_SIDE: self.MODE_SIDE_BY_SIDE,
            self.MODE_OVERLAY: self.MODE_OVERLAY,
            self.MODE_DIFFERENCE: self.MODE_DIFFERENCE,
            self.MODE_BEFORE: self.MODE_BEFORE,
            self.MODE_AFTER: self.MODE_AFTER
        }
        
        self.current_mode = mode_map.get(selection, self.MODE_SIDE_BY_SIDE)
        
        # 显示/隐藏透明度控制
        if self.current_mode == self.MODE_OVERLAY:
            self.alpha_frame.pack(side=tk.LEFT, padx=10)
        else:
            self.alpha_frame.pack_forget()
        
        # 更新显示
        self._update_display()
    
    def _on_alpha_changed(self, value):
        """透明度改变事件"""
        self.overlay_alpha = float(value)
        
        # 仅在叠加模式下更新
        if self.current_mode == self.MODE_OVERLAY:
            self._update_display()
    
    def _on_mouse_wheel(self, event):
        """鼠标滚轮缩放事件"""
        # 确定缩放方向
        if event.num == 4:  # Linux上向上滚动
            delta = 1
        elif event.num == 5:  # Linux上向下滚动
            delta = -1
        else:  # Windows/Mac上的MouseWheel事件
            delta = 1 if event.delta > 0 else -1
        
        # 计算新的缩放因子
        if delta > 0:
            self.zoom_factor *= 1.1
        else:
            self.zoom_factor /= 1.1
        
        # 限制缩放范围
        self.zoom_factor = max(0.1, min(5.0, self.zoom_factor))
        
        # 更新显示
        self._update_display()
    
    def zoom_in(self):
        """放大"""
        self.zoom_factor *= 1.2
        self.zoom_factor = min(5.0, self.zoom_factor)
        self._update_display()
    
    def zoom_out(self):
        """缩小"""
        self.zoom_factor /= 1.2
        self.zoom_factor = max(0.1, self.zoom_factor)
        self._update_display()
    
    def reset_zoom(self):
        """重置缩放为1:1"""
        self.zoom_factor = 1.0
        self.pan_offset_x = 0
        self.pan_offset_y = 0
        self._update_display()
    
    def fit_to_window(self):
        """适应窗口大小"""
        if self.current_image is None:
            return
        
        # 获取画布大小
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        
        if canvas_width < 10 or canvas_height < 10:
            return
        
        # 获取原始图像大小
        if self.current_mode == self.MODE_SIDE_BY_SIDE:
            # 并排模式是两倍宽度
            img_width = self.comparator.get_image_size()[0] * 2
            img_height = self.comparator.get_image_size()[1]
        else:
            img_width, img_height = self.comparator.get_image_size()
        
        # 计算缩放比例
        scale_x = (canvas_width - 20) / img_width
        scale_y = (canvas_height - 20) / img_height
        
        self.zoom_factor = min(scale_x, scale_y)
        self.zoom_factor = max(0.1, min(5.0, self.zoom_factor))
        
        # 重置平移偏移，使图像居中
        self.pan_offset_x = max(0, (canvas_width - img_width * self.zoom_factor) / 2)
        self.pan_offset_y = max(0, (canvas_height - img_height * self.zoom_factor) / 2)
        
        self._update_display()
    
    def _on_pan_start(self, event):
        """平移开始事件"""
        self.is_panning = True
        self.pan_start_x = event.x
        self.pan_start_y = event.y
        self.canvas.config(cursor="fleur")
    
    def _on_pan_move(self, event):
        """平移移动事件"""
        if not self.is_panning:
            return
        
        # 计算移动距离
        delta_x = event.x - self.pan_start_x
        delta_y = event.y - self.pan_start_y
        
        # 更新平移偏移
        self.pan_offset_x += delta_x
        self.pan_offset_y += delta_y
        
        # 更新起始位置
        self.pan_start_x = event.x
        self.pan_start_y = event.y
        
        # 更新显示
        self._update_display()
    
    def _on_pan_end(self, event):
        """平移结束事件"""
        self.is_panning = False
        self.canvas.config(cursor="")
    
    def _on_mouse_move(self, event):
        """鼠标移动事件"""
        if self.current_image is None:
            return
        
        # 计算在图像上的位置
        img_x = int((event.x - self.pan_offset_x) / self.zoom_factor)
        img_y = int((event.y - self.pan_offset_y) / self.zoom_factor)
        
        # 获取图像尺寸
        if self.current_mode == self.MODE_SIDE_BY_SIDE:
            img_width = self.comparator.get_image_size()[0] * 2
            img_height = self.comparator.get_image_size()[1]
        else:
            img_width, img_height = self.comparator.get_image_size()
        
        # 检查是否在图像范围内
        if 0 <= img_x < img_width and 0 <= img_y < img_height:
            # 尝试获取像素颜色（如果是并排模式，确定是哪张图）
            if self.current_mode == self.MODE_SIDE_BY_SIDE:
                half_width = img_width // 2
                if img_x < half_width:
                    image_name = "修复前"
                    actual_x = img_x
                else:
                    image_name = "修复后"
                    actual_x = img_x - half_width
                self.position_label.config(text=f"{image_name}: ({actual_x}, {img_y})")
            else:
                self.position_label.config(text=f"({img_x}, {img_y})")
        else:
            self.position_label.config(text="")
    
    def _on_canvas_configure(self, event):
        """画布大小改变事件"""
        # 可以在这里实现自适应调整
        pass
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_label.config(text=message)
    
    def get_current_view_image(self) -> Optional[np.ndarray]:
        """
        获取当前显示的图像
        
        Returns:
            当前显示的图像数组（用于保存或导出）
        """
        return self.current_image
    
    def clear(self):
        """清除显示"""
        self.canvas.delete("all")
        self.current_image = None
        self.display_image = None
        self.before_image_path = None
        self.after_image_path = None
        self.zoom_factor = 1.0
        self.pan_offset_x = 0
        self.pan_offset_y = 0
        self._update_status("就绪")
