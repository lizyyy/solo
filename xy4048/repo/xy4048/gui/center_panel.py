import tkinter as tk
from tkinter import ttk
from datetime import datetime
from typing import Optional, Callable, Dict, Any, List

import customtkinter as ctk

from config import CONFIG, TaskStatus
from database import (
    DatabaseManager, DeliveryTask, CoolerBox, DeliveryPoint, PackingItem
)
from core import StateMachine, StateTransitionError
from .dialogs import (
    DeliveryTaskDialog, PackingItemDialog, ImportDialog, MessageDialog
)


STATUS_COLORS = {
    TaskStatus.TO_PACK: ("#3B82F6", "#1E40AF"),
    TaskStatus.IN_TRANSIT: ("#F59E0B", "#D97706"),
    TaskStatus.TO_SIGN: ("#10B981", "#059669"),
    TaskStatus.NEED_REVIEW: ("#EF4444", "#DC2626"),
    TaskStatus.ARCHIVED: ("#6B7280", "#4B5563"),
}


class CenterPanel(ctk.CTkFrame):
    def __init__(
        self,
        parent,
        db: DatabaseManager,
        on_task_selected: Optional[Callable] = None,
        on_data_changed: Optional[Callable] = None,
        **kwargs
    ):
        super().__init__(parent, **kwargs)
        self.db = db
        self.on_task_selected = on_task_selected
        self.on_data_changed = on_data_changed
        self.selected_task_id: Optional[int] = None
        
        self.state_machine = StateMachine(db)
        
        self._create_widgets()
        self._refresh_all()
    
    def _create_widgets(self):
        toolbar = ctk.CTkFrame(self, fg_color="transparent")
        toolbar.pack(fill=tk.X, padx=5, pady=5)
        
        ctk.CTkButton(toolbar, text="新增任务", command=self._add_task, width=100).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(toolbar, text="编辑任务", command=self._edit_task, width=100).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(toolbar, text="装箱清单", command=self._manage_packing, width=100).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(toolbar, text="刷新", command=self._refresh_all, width=80).pack(side=tk.LEFT, padx=2)
        
        self.status_filters: Dict[TaskStatus, ctk.BooleanVar] = {}
        for status in TaskStatus:
            var = ctk.BooleanVar(value=True)
            self.status_filters[status] = var
            cb = ctk.CTkCheckBox(
                toolbar,
                text=status.value,
                variable=var,
                command=self._apply_filter
            )
            cb.pack(side=tk.LEFT, padx=10)
        
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.task_frames: Dict[TaskStatus, ctk.CTkFrame] = {}
        self.task_views: Dict[TaskStatus, ttk.Treeview] = {}
        
        for status in TaskStatus:
            frame = ctk.CTkFrame(self.notebook)
            self.notebook.add(frame, text=status.value)
            self.task_frames[status] = frame
            
            self._create_task_view(frame, status)
        
        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_changed)
    
    def _create_task_view(self, parent, status: TaskStatus):
        columns = ("task_number", "cooler_box", "delivery_point", "pharmacist", "courier", "created_time")
        tree = ttk.Treeview(parent, columns=columns, show="headings", height=15)
        
        tree.heading("task_number", text="任务编号")
        tree.heading("cooler_box", text="冷藏箱")
        tree.heading("delivery_point", text="收货点")
        tree.heading("pharmacist", text="药师")
        tree.heading("courier", text="配送员")
        tree.heading("created_time", text="创建时间")
        
        tree.column("task_number", width=120)
        tree.column("cooler_box", width=100)
        tree.column("delivery_point", width=120)
        tree.column("pharmacist", width=80)
        tree.column("courier", width=80)
        tree.column("created_time", width=150)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        tree.bind("<<TreeviewSelect>>", self._on_task_select)
        tree.bind("<Double-1>", self._on_task_double_click)
        
        self.task_views[status] = tree
    
    def _refresh_tasks(self, status: TaskStatus):
        tree = self.task_views[status]
        
        for item in tree.get_children():
            tree.delete(item)
        
        tasks = self.db.get_all(
            DeliveryTask,
            "status = ?",
            (status.value,)
        )
        
        cooler_boxes = {}
        for box in self.db.get_all(CoolerBox):
            cooler_boxes[box.id] = box
        
        delivery_points = {}
        for point in self.db.get_all(DeliveryPoint):
            delivery_points[point.id] = point
        
        for task in tasks:
            cooler_box = cooler_boxes.get(task.cooler_box_id)
            box_display = cooler_box.box_number if cooler_box else ""
            
            delivery_point = delivery_points.get(task.delivery_point_id)
            point_display = delivery_point.point_name if delivery_point else ""
            
            created_time = task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else ""
            
            tree.insert("", tk.END, values=(
                task.task_number,
                box_display,
                point_display,
                task.pharmacist or "",
                task.courier or "",
                created_time
            ), iid=task.id, tags=(status.value,))
    
    def _refresh_all(self):
        for status in TaskStatus:
            self._refresh_tasks(status)
    
    def _apply_filter(self):
        pass
    
    def _on_tab_changed(self, event):
        pass
    
    def _on_task_select(self, event):
        widget = event.widget
        selected = widget.selection()
        
        if selected:
            task_id = int(selected[0])
            self.selected_task_id = task_id
            
            if self.on_task_selected:
                self.on_task_selected(task_id)
    
    def _on_task_double_click(self, event):
        self._edit_task()
    
    def _add_task(self):
        dialog = DeliveryTaskDialog(self, self.db)
        dialog.wait_window()
        if dialog.result:
            self._refresh_all()
            self._notify_data_changed()
    
    def _edit_task(self):
        if self.selected_task_id is None:
            MessageDialog(self, "提示", "请选择要编辑的任务", "warning")
            return
        
        task = self.db.get_by_id(DeliveryTask, self.selected_task_id)
        if not task:
            return
        
        dialog = DeliveryTaskDialog(self, self.db, task)
        dialog.wait_window()
        if dialog.result:
            self._refresh_all()
            self._notify_data_changed()
    
    def _manage_packing(self):
        if self.selected_task_id is None:
            MessageDialog(self, "提示", "请选择任务", "warning")
            return
        
        task = self.db.get_by_id(DeliveryTask, self.selected_task_id)
        if not task:
            return
        
        dialog = PackingListDialog(self, self.db, task)
        dialog.wait_window()
        
        self._refresh_all()
        self._notify_data_changed()
    
    def _notify_data_changed(self):
        if self.on_data_changed:
            self.on_data_changed()
        
        if self.selected_task_id and self.on_task_selected:
            self.on_task_selected(self.selected_task_id)
    
    def refresh(self):
        self._refresh_all()


class PackingListDialog(ctk.CTkToplevel):
    def __init__(self, parent, db: DatabaseManager, task: DeliveryTask):
        super().__init__(parent)
        self.title(f"装箱清单 - {task.task_number}")
        self.db = db
        self.task = task
        self.geometry("600x450")
        
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
        self._refresh_items()
    
    def _create_widgets(self):
        info_frame = ctk.CTkFrame(self)
        info_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ctk.CTkLabel(info_frame, text=f"任务: {self.task.task_number}", font=("Arial", 12, "bold")).pack(side=tk.LEFT)
        ctk.CTkLabel(info_frame, text=f"状态: {self.task.status.value}").pack(side=tk.LEFT, padx=20)
        
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ctk.CTkButton(btn_frame, text="添加", command=self._add_item, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="编辑", command=self._edit_item, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="删除", command=self._delete_item, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="刷新", command=self._refresh_items, width=80).pack(side=tk.LEFT, padx=2)
        
        columns = ("drug_name", "batch_number", "specification", "quantity", "unit", "notes")
        self.tree = ttk.Treeview(self, columns=columns, show="headings", height=15)
        
        self.tree.heading("drug_name", text="药品名称")
        self.tree.heading("batch_number", text="批号")
        self.tree.heading("specification", text="规格")
        self.tree.heading("quantity", text="数量")
        self.tree.heading("unit", text="单位")
        self.tree.heading("notes", text="备注")
        
        self.tree.column("drug_name", width=120)
        self.tree.column("batch_number", width=100)
        self.tree.column("specification", width=100)
        self.tree.column("quantity", width=60)
        self.tree.column("unit", width=50)
        self.tree.column("notes", width=100)
        
        scrollbar = ttk.Scrollbar(self, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y, pady=5)
        
        close_btn = ctk.CTkButton(self, text="关闭", command=self.destroy, width=100)
        close_btn.pack(pady=10)
    
    def _refresh_items(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        items = self.db.get_all(
            PackingItem,
            "task_id = ?",
            (self.task.id,)
        )
        
        drug_batches = {}
        for batch in self.db.get_all(DrugBatch):
            drug_batches[batch.id] = batch
        
        for item in items:
            batch = drug_batches.get(item.drug_batch_id)
            if batch:
                self.tree.insert("", tk.END, values=(
                    batch.drug_name,
                    batch.batch_number,
                    batch.specification or "",
                    item.quantity,
                    item.unit,
                    item.notes or ""
                ), iid=item.id)
    
    def _add_item(self):
        dialog = PackingItemDialog(self, self.db, self.task.id)
        dialog.wait_window()
        if dialog.result:
            self._refresh_items()
    
    def _edit_item(self):
        selected = self.tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要编辑的装箱项", "warning")
            return
        
        item_id = int(selected[0])
        item = self.db.get_by_id(PackingItem, item_id)
        if not item:
            return
        
        dialog = PackingItemDialog(self, self.db, self.task.id, item)
        dialog.wait_window()
        if dialog.result:
            self._refresh_items()
    
    def _delete_item(self):
        selected = self.tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要删除的装箱项", "warning")
            return
        
        item_id = int(selected[0])
        item = self.db.get_by_id(PackingItem, item_id)
        if not item:
            return
        
        if tk.messagebox.askyesno("确认", "确定要删除该装箱项吗？"):
            self.db.delete(item)
            self._refresh_items()
