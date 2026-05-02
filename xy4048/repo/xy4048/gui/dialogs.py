import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List

import customtkinter as ctk

from config import CONFIG, TaskStatus
from database import (
    DatabaseManager, CoolerBox, DrugBatch, DeliveryRoute, DeliveryPoint,
    DeliveryTask, PackingItem, AttachmentType
)


class BaseDialog(ctk.CTkToplevel):
    def __init__(self, parent, title: str, db: DatabaseManager, **kwargs):
        super().__init__(parent, **kwargs)
        self.title(title)
        self.db = db
        self.result = None
        
        self.transient(parent)
        self.grab_set()
        
        self._center_window()
    
    def _center_window(self):
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')
    
    def on_ok(self):
        self.result = True
        self.destroy()
    
    def on_cancel(self):
        self.result = False
        self.destroy()


class MessageDialog(BaseDialog):
    def __init__(self, parent, title: str, message: str, message_type: str = "info"):
        super().__init__(parent, title, None)
        self.geometry("400x200")
        
        icon_map = {
            "info": "ℹ️",
            "warning": "⚠️",
            "error": "❌",
            "success": "✅"
        }
        
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        icon_label = ctk.CTkLabel(frame, text=icon_map.get(message_type, "ℹ️"), font=("Arial", 40))
        icon_label.pack(pady=10)
        
        msg_label = ctk.CTkLabel(frame, text=message, wraplength=350, justify=tk.CENTER)
        msg_label.pack(pady=10)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(pady=10)
        
        ok_btn = ctk.CTkButton(btn_frame, text="确定", command=self.on_ok, width=100)
        ok_btn.pack()


class CoolerBoxDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, cooler_box: Optional[CoolerBox] = None):
        self.cooler_box = cooler_box
        super().__init__(parent, "编辑冷藏箱" if cooler_box else "新增冷藏箱", db)
        self.geometry("400x350")
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        ctk.CTkLabel(frame, text="箱号 *:").pack(anchor=tk.W)
        self.box_number_entry = ctk.CTkEntry(frame)
        self.box_number_entry.pack(fill=tk.X, pady=(0, 10))
        if self.cooler_box:
            self.box_number_entry.insert(0, self.cooler_box.box_number)
        
        ctk.CTkLabel(frame, text="设备号:").pack(anchor=tk.W)
        self.device_id_entry = ctk.CTkEntry(frame)
        self.device_id_entry.pack(fill=tk.X, pady=(0, 10))
        if self.cooler_box:
            self.device_id_entry.insert(0, self.cooler_box.device_id or "")
        
        ctk.CTkLabel(frame, text="描述:").pack(anchor=tk.W)
        self.description_text = ctk.CTkTextbox(frame, height=80)
        self.description_text.pack(fill=tk.X, pady=(0, 10))
        if self.cooler_box and self.cooler_box.description:
            self.description_text.insert(tk.END, self.cooler_box.description)
        
        self.is_active_var = ctk.BooleanVar(value=self.cooler_box.is_active if self.cooler_box else True)
        self.is_active_check = ctk.CTkCheckBox(frame, text="启用", variable=self.is_active_var)
        self.is_active_check.pack(anchor=tk.W, pady=10)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=10)
        
        ctk.CTkButton(btn_frame, text="保存", command=self._save, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _save(self):
        box_number = self.box_number_entry.get().strip()
        if not box_number:
            MessageDialog(self, "错误", "箱号不能为空", "error")
            return
        
        device_id = self.device_id_entry.get().strip()
        description = self.description_text.get("1.0", tk.END).strip()
        is_active = self.is_active_var.get()
        
        if self.cooler_box:
            self.cooler_box.box_number = box_number
            self.cooler_box.device_id = device_id
            self.cooler_box.description = description
            self.cooler_box.is_active = is_active
            self.db.update(self.cooler_box)
        else:
            new_box = CoolerBox(
                box_number=box_number,
                device_id=device_id,
                description=description,
                is_active=is_active
            )
            self.db.create(new_box)
        
        self.on_ok()


class DrugBatchDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, drug_batch: Optional[DrugBatch] = None):
        self.drug_batch = drug_batch
        super().__init__(parent, "编辑药品批号" if drug_batch else "新增药品批号", db)
        self.geometry("450x500")
        self._create_widgets()
    
    def _create_widgets(self):
        canvas = ctk.CTkCanvas(self)
        scrollbar = ctk.CTkScrollbar(self, orientation="vertical", command=canvas.yview)
        scrollable_frame = ctk.CTkFrame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        frame = scrollable_frame
        
        ctk.CTkLabel(frame, text="批号 *:").pack(anchor=tk.W, padx=20, pady=(10, 0))
        self.batch_number_entry = ctk.CTkEntry(frame)
        self.batch_number_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.batch_number_entry.insert(0, self.drug_batch.batch_number)
        
        ctk.CTkLabel(frame, text="药品名称 *:").pack(anchor=tk.W, padx=20)
        self.drug_name_entry = ctk.CTkEntry(frame)
        self.drug_name_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.drug_name_entry.insert(0, self.drug_batch.drug_name)
        
        ctk.CTkLabel(frame, text="规格:").pack(anchor=tk.W, padx=20)
        self.specification_entry = ctk.CTkEntry(frame)
        self.specification_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.specification_entry.insert(0, self.drug_batch.specification or "")
        
        ctk.CTkLabel(frame, text="生产厂家:").pack(anchor=tk.W, padx=20)
        self.manufacturer_entry = ctk.CTkEntry(frame)
        self.manufacturer_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.manufacturer_entry.insert(0, self.drug_batch.manufacturer or "")
        
        ctk.CTkLabel(frame, text="数量:").pack(anchor=tk.W, padx=20)
        self.quantity_entry = ctk.CTkEntry(frame)
        self.quantity_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.quantity_entry.insert(0, str(self.drug_batch.quantity))
        
        ctk.CTkLabel(frame, text="单位:").pack(anchor=tk.W, padx=20)
        self.unit_entry = ctk.CTkEntry(frame)
        self.unit_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.unit_entry.insert(0, self.drug_batch.unit)
        
        ctk.CTkLabel(frame, text="储存条件:").pack(anchor=tk.W, padx=20)
        self.storage_entry = ctk.CTkEntry(frame)
        self.storage_entry.pack(fill=tk.X, padx=20, pady=(0, 10))
        if self.drug_batch:
            self.storage_entry.insert(0, self.drug_batch.storage_condition)
        
        ctk.CTkLabel(frame, text="备注:").pack(anchor=tk.W, padx=20)
        self.notes_text = ctk.CTkTextbox(frame, height=60)
        self.notes_text.pack(fill=tk.X, padx=20, pady=(0, 20))
        if self.drug_batch and self.drug_batch.notes:
            self.notes_text.insert(tk.END, self.drug_batch.notes)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, padx=20, pady=10)
        
        ctk.CTkButton(btn_frame, text="保存", command=self._save, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _save(self):
        batch_number = self.batch_number_entry.get().strip()
        drug_name = self.drug_name_entry.get().strip()
        
        if not batch_number or not drug_name:
            MessageDialog(self, "错误", "批号和药品名称不能为空", "error")
            return
        
        try:
            quantity = int(self.quantity_entry.get().strip() or "0")
        except ValueError:
            quantity = 0
        
        if self.drug_batch:
            self.drug_batch.batch_number = batch_number
            self.drug_batch.drug_name = drug_name
            self.drug_batch.specification = self.specification_entry.get().strip()
            self.drug_batch.manufacturer = self.manufacturer_entry.get().strip()
            self.drug_batch.quantity = quantity
            self.drug_batch.unit = self.unit_entry.get().strip() or "支"
            self.drug_batch.storage_condition = self.storage_entry.get().strip() or "2-8°C冷藏"
            self.drug_batch.notes = self.notes_text.get("1.0", tk.END).strip()
            self.db.update(self.drug_batch)
        else:
            new_batch = DrugBatch(
                batch_number=batch_number,
                drug_name=drug_name,
                specification=self.specification_entry.get().strip(),
                manufacturer=self.manufacturer_entry.get().strip(),
                quantity=quantity,
                unit=self.unit_entry.get().strip() or "支",
                storage_condition=self.storage_entry.get().strip() or "2-8°C冷藏",
                notes=self.notes_text.get("1.0", tk.END).strip()
            )
            self.db.create(new_batch)
        
        self.on_ok()


class DeliveryRouteDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, route: Optional[DeliveryRoute] = None):
        self.route = route
        super().__init__(parent, "编辑配送路线" if route else "新增配送路线", db)
        self.geometry("400x300")
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        ctk.CTkLabel(frame, text="路线名称 *:").pack(anchor=tk.W)
        self.route_name_entry = ctk.CTkEntry(frame)
        self.route_name_entry.pack(fill=tk.X, pady=(0, 10))
        if self.route:
            self.route_name_entry.insert(0, self.route.route_name)
        
        ctk.CTkLabel(frame, text="描述:").pack(anchor=tk.W)
        self.description_text = ctk.CTkTextbox(frame, height=100)
        self.description_text.pack(fill=tk.X, pady=(0, 10))
        if self.route and self.route.description:
            self.description_text.insert(tk.END, self.route.description)
        
        self.is_active_var = ctk.BooleanVar(value=self.route.is_active if self.route else True)
        self.is_active_check = ctk.CTkCheckBox(frame, text="启用", variable=self.is_active_var)
        self.is_active_check.pack(anchor=tk.W, pady=10)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=10)
        
        ctk.CTkButton(btn_frame, text="保存", command=self._save, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _save(self):
        route_name = self.route_name_entry.get().strip()
        if not route_name:
            MessageDialog(self, "错误", "路线名称不能为空", "error")
            return
        
        if self.route:
            self.route.route_name = route_name
            self.route.description = self.description_text.get("1.0", tk.END).strip()
            self.route.is_active = self.is_active_var.get()
            self.db.update(self.route)
        else:
            new_route = DeliveryRoute(
                route_name=route_name,
                description=self.description_text.get("1.0", tk.END).strip(),
                is_active=self.is_active_var.get()
            )
            self.db.create(new_route)
        
        self.on_ok()


class DeliveryPointDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, point: Optional[DeliveryPoint] = None):
        self.point = point
        super().__init__(parent, "编辑收货点" if point else "新增收货点", db)
        self.geometry("450x400")
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        ctk.CTkLabel(frame, text="收货点名称 *:").pack(anchor=tk.W)
        self.point_name_entry = ctk.CTkEntry(frame)
        self.point_name_entry.pack(fill=tk.X, pady=(0, 10))
        if self.point:
            self.point_name_entry.insert(0, self.point.point_name)
        
        ctk.CTkLabel(frame, text="所属路线:").pack(anchor=tk.W)
        self.route_var = ctk.StringVar()
        routes = self.db.get_all(DeliveryRoute, "is_active = 1")
        route_values = ["无"] + [r.route_name for r in routes]
        self.route_combobox = ctk.CTkComboBox(frame, values=route_values, variable=self.route_var)
        self.route_combobox.pack(fill=tk.X, pady=(0, 10))
        if self.point and self.point.route_id:
            for r in routes:
                if r.id == self.point.route_id:
                    self.route_var.set(r.route_name)
                    break
        
        ctk.CTkLabel(frame, text="地址:").pack(anchor=tk.W)
        self.address_entry = ctk.CTkEntry(frame)
        self.address_entry.pack(fill=tk.X, pady=(0, 10))
        if self.point:
            self.address_entry.insert(0, self.point.address or "")
        
        ctk.CTkLabel(frame, text="联系人:").pack(anchor=tk.W)
        self.contact_person_entry = ctk.CTkEntry(frame)
        self.contact_person_entry.pack(fill=tk.X, pady=(0, 10))
        if self.point:
            self.contact_person_entry.insert(0, self.point.contact_person or "")
        
        ctk.CTkLabel(frame, text="联系电话:").pack(anchor=tk.W)
        self.contact_phone_entry = ctk.CTkEntry(frame)
        self.contact_phone_entry.pack(fill=tk.X, pady=(0, 10))
        if self.point:
            self.contact_phone_entry.insert(0, self.point.contact_phone or "")
        
        self.is_active_var = ctk.BooleanVar(value=self.point.is_active if self.point else True)
        self.is_active_check = ctk.CTkCheckBox(frame, text="启用", variable=self.is_active_var)
        self.is_active_check.pack(anchor=tk.W, pady=10)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=10)
        
        ctk.CTkButton(btn_frame, text="保存", command=self._save, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _save(self):
        point_name = self.point_name_entry.get().strip()
        if not point_name:
            MessageDialog(self, "错误", "收货点名称不能为空", "error")
            return
        
        route_id = None
        route_name = self.route_var.get()
        if route_name and route_name != "无":
            routes = self.db.get_all(DeliveryRoute, "route_name = ?", (route_name,))
            if routes:
                route_id = routes[0].id
        
        if self.point:
            self.point.point_name = point_name
            self.point.route_id = route_id
            self.point.address = self.address_entry.get().strip()
            self.point.contact_person = self.contact_person_entry.get().strip()
            self.point.contact_phone = self.contact_phone_entry.get().strip()
            self.point.is_active = self.is_active_var.get()
            self.db.update(self.point)
        else:
            new_point = DeliveryPoint(
                point_name=point_name,
                route_id=route_id,
                address=self.address_entry.get().strip(),
                contact_person=self.contact_person_entry.get().strip(),
                contact_phone=self.contact_phone_entry.get().strip(),
                is_active=self.is_active_var.get()
            )
            self.db.create(new_point)
        
        self.on_ok()


class DeliveryTaskDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, task: Optional[DeliveryTask] = None):
        self.task = task
        super().__init__(parent, "编辑任务" if task else "新增任务", db)
        self.geometry("500x450")
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        ctk.CTkLabel(frame, text="任务编号:").pack(anchor=tk.W)
        self.task_number_entry = ctk.CTkEntry(frame)
        self.task_number_entry.pack(fill=tk.X, pady=(0, 10))
        if self.task:
            self.task_number_entry.insert(0, self.task.task_number)
            self.task_number_entry.configure(state='disabled')
        
        ctk.CTkLabel(frame, text="冷藏箱:").pack(anchor=tk.W)
        self.cooler_box_var = ctk.StringVar()
        cooler_boxes = self.db.get_all(CoolerBox, "is_active = 1")
        box_values = ["无"] + [f"{b.box_number} ({b.device_id})" for b in cooler_boxes]
        self.cooler_box_combobox = ctk.CTkComboBox(frame, values=box_values, variable=self.cooler_box_var)
        self.cooler_box_combobox.pack(fill=tk.X, pady=(0, 10))
        if self.task and self.task.cooler_box_id:
            for b in cooler_boxes:
                if b.id == self.task.cooler_box_id:
                    self.cooler_box_var.set(f"{b.box_number} ({b.device_id})")
                    break
        
        ctk.CTkLabel(frame, text="配送路线:").pack(anchor=tk.W)
        self.route_var = ctk.StringVar()
        routes = self.db.get_all(DeliveryRoute, "is_active = 1")
        route_values = ["无"] + [r.route_name for r in routes]
        self.route_combobox = ctk.CTkComboBox(frame, values=route_values, variable=self.route_var)
        self.route_combobox.pack(fill=tk.X, pady=(0, 10))
        if self.task and self.task.route_id:
            for r in routes:
                if r.id == self.task.route_id:
                    self.route_var.set(r.route_name)
                    break
        
        ctk.CTkLabel(frame, text="收货点:").pack(anchor=tk.W)
        self.delivery_point_var = ctk.StringVar()
        points = self.db.get_all(DeliveryPoint, "is_active = 1")
        point_values = ["无"] + [p.point_name for p in points]
        self.delivery_point_combobox = ctk.CTkComboBox(frame, values=point_values, variable=self.delivery_point_var)
        self.delivery_point_combobox.pack(fill=tk.X, pady=(0, 10))
        if self.task and self.task.delivery_point_id:
            for p in points:
                if p.id == self.task.delivery_point_id:
                    self.delivery_point_var.set(p.point_name)
                    break
        
        ctk.CTkLabel(frame, text="药师:").pack(anchor=tk.W)
        self.pharmacist_entry = ctk.CTkEntry(frame)
        self.pharmacist_entry.pack(fill=tk.X, pady=(0, 10))
        if self.task:
            self.pharmacist_entry.insert(0, self.task.pharmacist or "")
        
        ctk.CTkLabel(frame, text="配送员:").pack(anchor=tk.W)
        self.courier_entry = ctk.CTkEntry(frame)
        self.courier_entry.pack(fill=tk.X, pady=(0, 10))
        if self.task:
            self.courier_entry.insert(0, self.task.courier or "")
        
        ctk.CTkLabel(frame, text="备注:").pack(anchor=tk.W)
        self.notes_text = ctk.CTkTextbox(frame, height=60)
        self.notes_text.pack(fill=tk.X, pady=(0, 10))
        if self.task and self.task.notes:
            self.notes_text.insert(tk.END, self.task.notes)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=10)
        
        ctk.CTkButton(btn_frame, text="保存", command=self._save, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _save(self):
        cooler_box_id = None
        box_str = self.cooler_box_var.get()
        if box_str and box_str != "无":
            box_number = box_str.split(" (")[0]
            boxes = self.db.get_all(CoolerBox, "box_number = ?", (box_number,))
            if boxes:
                cooler_box_id = boxes[0].id
        
        route_id = None
        route_name = self.route_var.get()
        if route_name and route_name != "无":
            routes = self.db.get_all(DeliveryRoute, "route_name = ?", (route_name,))
            if routes:
                route_id = routes[0].id
        
        delivery_point_id = None
        point_name = self.delivery_point_var.get()
        if point_name and point_name != "无":
            points = self.db.get_all(DeliveryPoint, "point_name = ?", (point_name,))
            if points:
                delivery_point_id = points[0].id
        
        if self.task:
            self.task.cooler_box_id = cooler_box_id
            self.task.route_id = route_id
            self.task.delivery_point_id = delivery_point_id
            self.task.pharmacist = self.pharmacist_entry.get().strip()
            self.task.courier = self.courier_entry.get().strip()
            self.task.notes = self.notes_text.get("1.0", tk.END).strip()
            self.db.update(self.task)
        else:
            task_number = self.task_number_entry.get().strip()
            if not task_number:
                from utils import ImportExportManager
                ie_manager = ImportExportManager(self.db)
                task_number = ie_manager.generate_task_number()
            
            new_task = DeliveryTask(
                task_number=task_number,
                status=TaskStatus.TO_PACK,
                cooler_box_id=cooler_box_id,
                route_id=route_id,
                delivery_point_id=delivery_point_id,
                pharmacist=self.pharmacist_entry.get().strip(),
                courier=self.courier_entry.get().strip(),
                notes=self.notes_text.get("1.0", tk.END).strip()
            )
            self.db.create(new_task)
        
        self.on_ok()


class PackingItemDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, task_id: int, item: Optional[PackingItem] = None):
        self.task_id = task_id
        self.item = item
        super().__init__(parent, "编辑装箱项" if item else "添加装箱项", db)
        self.geometry("400x300")
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        ctk.CTkLabel(frame, text="药品批号 *:").pack(anchor=tk.W)
        self.drug_batch_var = ctk.StringVar()
        drug_batches = self.db.get_all(DrugBatch)
        batch_values = [""] + [f"{b.batch_number} - {b.drug_name}" for b in drug_batches]
        self.drug_batch_combobox = ctk.CTkComboBox(frame, values=batch_values, variable=self.drug_batch_var)
        self.drug_batch_combobox.pack(fill=tk.X, pady=(0, 10))
        if self.item:
            batch = self.db.get_by_id(DrugBatch, self.item.drug_batch_id)
            if batch:
                self.drug_batch_var.set(f"{batch.batch_number} - {batch.drug_name}")
        
        ctk.CTkLabel(frame, text="数量 *:").pack(anchor=tk.W)
        self.quantity_entry = ctk.CTkEntry(frame)
        self.quantity_entry.pack(fill=tk.X, pady=(0, 10))
        if self.item:
            self.quantity_entry.insert(0, str(self.item.quantity))
        
        ctk.CTkLabel(frame, text="单位:").pack(anchor=tk.W)
        self.unit_entry = ctk.CTkEntry(frame)
        self.unit_entry.pack(fill=tk.X, pady=(0, 10))
        if self.item:
            self.unit_entry.insert(0, self.item.unit)
        
        ctk.CTkLabel(frame, text="备注:").pack(anchor=tk.W)
        self.notes_entry = ctk.CTkEntry(frame)
        self.notes_entry.pack(fill=tk.X, pady=(0, 10))
        if self.item and self.item.notes:
            self.notes_entry.insert(0, self.item.notes)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=10)
        
        ctk.CTkButton(btn_frame, text="保存", command=self._save, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _save(self):
        batch_str = self.drug_batch_var.get()
        if not batch_str:
            MessageDialog(self, "错误", "请选择药品批号", "error")
            return
        
        batch_number = batch_str.split(" - ")[0]
        batches = self.db.get_all(DrugBatch, "batch_number = ?", (batch_number,))
        if not batches:
            MessageDialog(self, "错误", "无效的药品批号", "error")
            return
        
        try:
            quantity = int(self.quantity_entry.get().strip())
        except ValueError:
            MessageDialog(self, "错误", "数量必须是整数", "error")
            return
        
        if quantity <= 0:
            MessageDialog(self, "错误", "数量必须大于0", "error")
            return
        
        drug_batch_id = batches[0].id
        
        if self.item:
            self.item.drug_batch_id = drug_batch_id
            self.item.quantity = quantity
            self.item.unit = self.unit_entry.get().strip() or "支"
            self.item.notes = self.notes_entry.get().strip()
            self.db.update(self.item)
        else:
            new_item = PackingItem(
                task_id=self.task_id,
                drug_batch_id=drug_batch_id,
                quantity=quantity,
                unit=self.unit_entry.get().strip() or "支",
                notes=self.notes_entry.get().strip()
            )
            self.db.create(new_item)
        
        self.on_ok()


class ImportDialog(BaseDialog):
    def __init__(self, parent, db: DatabaseManager, import_type: str = "temperature"):
        self.import_type = import_type
        self.selected_file = None
        super().__init__(parent, "导入温度CSV" if import_type == "temperature" else "导入药房任务", db)
        self.geometry("500x350")
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        instruction_text = {
            "temperature": "请选择温度记录仪导出的CSV文件\n支持字段：设备号、时间戳、温度、箱号、电量",
            "pharmacy": "请选择药房任务清单CSV文件\n支持字段：任务编号、冷藏箱号、药品批号、药品名称、数量、单位、药师、配送员、收货点、路线、备注"
        }
        
        ctk.CTkLabel(frame, text=instruction_text.get(self.import_type, ""), 
                     wraplength=450, justify=tk.LEFT).pack(pady=10)
        
        file_frame = ctk.CTkFrame(frame, fg_color="transparent")
        file_frame.pack(fill=tk.X, pady=10)
        
        self.file_var = ctk.StringVar(value="未选择文件")
        self.file_label = ctk.CTkLabel(file_frame, textvariable=self.file_var, wraplength=300)
        self.file_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        ctk.CTkButton(file_frame, text="浏览...", command=self._browse_file, width=80).pack(side=tk.RIGHT, padx=5)
        
        self.preview_text = ctk.CTkTextbox(frame, height=120)
        self.preview_text.pack(fill=tk.BOTH, expand=True, pady=10)
        self.preview_text.insert(tk.END, "文件预览将显示在这里...")
        self.preview_text.configure(state='disabled')
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=10)
        
        ctk.CTkButton(btn_frame, text="导入", command=self._do_import, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self.on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _browse_file(self):
        filetypes = [
            ("CSV文件", "*.csv"),
            ("所有文件", "*.*")
        ]
        
        filename = filedialog.askopenfilename(
            title="选择CSV文件",
            filetypes=filetypes
        )
        
        if filename:
            self.selected_file = Path(filename)
            self.file_var.set(self.selected_file.name)
            self._preview_file()
    
    def _preview_file(self):
        if not self.selected_file:
            return
        
        try:
            with open(self.selected_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()[:10]
            
            self.preview_text.configure(state='normal')
            self.preview_text.delete("1.0", tk.END)
            self.preview_text.insert(tk.END, "".join(lines))
            if len(lines) >= 10:
                self.preview_text.insert(tk.END, "\n... (更多内容已省略)")
            self.preview_text.configure(state='disabled')
        except Exception as e:
            self.preview_text.configure(state='normal')
            self.preview_text.delete("1.0", tk.END)
            self.preview_text.insert(tk.END, f"无法预览文件: {e}")
            self.preview_text.configure(state='disabled')
    
    def _do_import(self):
        if not self.selected_file:
            MessageDialog(self, "错误", "请先选择文件", "error")
            return
        
        self.import_result = {
            "success": True,
            "file_path": self.selected_file,
            "import_type": self.import_type
        }
        self.on_ok()
