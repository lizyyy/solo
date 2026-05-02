import tkinter as tk
from tkinter import ttk
from typing import Optional, Callable, Dict, Any

import customtkinter as ctk

from config import CONFIG
from database import (
    DatabaseManager, CoolerBox, DrugBatch, DeliveryRoute, DeliveryPoint
)
from .dialogs import (
    CoolerBoxDialog, DrugBatchDialog, DeliveryRouteDialog, DeliveryPointDialog,
    MessageDialog
)


class LeftPanel(ctk.CTkFrame):
    def __init__(self, parent, db: DatabaseManager, on_data_changed: Optional[Callable] = None, **kwargs):
        super().__init__(parent, **kwargs)
        self.db = db
        self.on_data_changed = on_data_changed
        
        self._create_widgets()
        self._refresh_all()
    
    def _create_widgets(self):
        self.tabview = ctk.CTkTabview(self)
        self.tabview.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.tab_cooler = self.tabview.add("冷藏箱")
        self.tab_drugs = self.tabview.add("药品批号")
        self.tab_routes = self.tabview.add("配送路线")
        self.tab_points = self.tabview.add("收货点")
        
        self._create_cooler_tab()
        self._create_drugs_tab()
        self._create_routes_tab()
        self._create_points_tab()
    
    def _create_cooler_tab(self):
        btn_frame = ctk.CTkFrame(self.tab_cooler, fg_color="transparent")
        btn_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ctk.CTkButton(btn_frame, text="新增", command=self._add_cooler, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="编辑", command=self._edit_cooler, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="删除", command=self._delete_cooler, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="刷新", command=self._refresh_cooler, width=80).pack(side=tk.LEFT, padx=2)
        
        columns = ("box_number", "device_id", "description", "is_active")
        self.cooler_tree = ttk.Treeview(self.tab_cooler, columns=columns, show="headings", height=15)
        
        self.cooler_tree.heading("box_number", text="箱号")
        self.cooler_tree.heading("device_id", text="设备号")
        self.cooler_tree.heading("description", text="描述")
        self.cooler_tree.heading("is_active", text="状态")
        
        self.cooler_tree.column("box_number", width=80)
        self.cooler_tree.column("device_id", width=100)
        self.cooler_tree.column("description", width=120)
        self.cooler_tree.column("is_active", width=60)
        
        scrollbar = ttk.Scrollbar(self.tab_cooler, orient=tk.VERTICAL, command=self.cooler_tree.yview)
        self.cooler_tree.configure(yscrollcommand=scrollbar.set)
        
        self.cooler_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_drugs_tab(self):
        btn_frame = ctk.CTkFrame(self.tab_drugs, fg_color="transparent")
        btn_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ctk.CTkButton(btn_frame, text="新增", command=self._add_drug, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="编辑", command=self._edit_drug, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="删除", command=self._delete_drug, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="刷新", command=self._refresh_drugs, width=80).pack(side=tk.LEFT, padx=2)
        
        columns = ("batch_number", "drug_name", "specification", "manufacturer", "quantity", "unit")
        self.drugs_tree = ttk.Treeview(self.tab_drugs, columns=columns, show="headings", height=15)
        
        self.drugs_tree.heading("batch_number", text="批号")
        self.drugs_tree.heading("drug_name", text="药品名称")
        self.drugs_tree.heading("specification", text="规格")
        self.drugs_tree.heading("manufacturer", text="生产厂家")
        self.drugs_tree.heading("quantity", text="数量")
        self.drugs_tree.heading("unit", text="单位")
        
        self.drugs_tree.column("batch_number", width=100)
        self.drugs_tree.column("drug_name", width=100)
        self.drugs_tree.column("specification", width=80)
        self.drugs_tree.column("manufacturer", width=100)
        self.drugs_tree.column("quantity", width=60)
        self.drugs_tree.column("unit", width=50)
        
        scrollbar = ttk.Scrollbar(self.tab_drugs, orient=tk.VERTICAL, command=self.drugs_tree.yview)
        self.drugs_tree.configure(yscrollcommand=scrollbar.set)
        
        self.drugs_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_routes_tab(self):
        btn_frame = ctk.CTkFrame(self.tab_routes, fg_color="transparent")
        btn_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ctk.CTkButton(btn_frame, text="新增", command=self._add_route, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="编辑", command=self._edit_route, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="删除", command=self._delete_route, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="刷新", command=self._refresh_routes, width=80).pack(side=tk.LEFT, padx=2)
        
        columns = ("route_name", "description", "is_active")
        self.routes_tree = ttk.Treeview(self.tab_routes, columns=columns, show="headings", height=15)
        
        self.routes_tree.heading("route_name", text="路线名称")
        self.routes_tree.heading("description", text="描述")
        self.routes_tree.heading("is_active", text="状态")
        
        self.routes_tree.column("route_name", width=120)
        self.routes_tree.column("description", width=200)
        self.routes_tree.column("is_active", width=60)
        
        scrollbar = ttk.Scrollbar(self.tab_routes, orient=tk.VERTICAL, command=self.routes_tree.yview)
        self.routes_tree.configure(yscrollcommand=scrollbar.set)
        
        self.routes_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_points_tab(self):
        btn_frame = ctk.CTkFrame(self.tab_points, fg_color="transparent")
        btn_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ctk.CTkButton(btn_frame, text="新增", command=self._add_point, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="编辑", command=self._edit_point, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="删除", command=self._delete_point, width=80).pack(side=tk.LEFT, padx=2)
        ctk.CTkButton(btn_frame, text="刷新", command=self._refresh_points, width=80).pack(side=tk.LEFT, padx=2)
        
        columns = ("point_name", "address", "contact_person", "contact_phone", "route_name")
        self.points_tree = ttk.Treeview(self.tab_points, columns=columns, show="headings", height=15)
        
        self.points_tree.heading("point_name", text="收货点名称")
        self.points_tree.heading("address", text="地址")
        self.points_tree.heading("contact_person", text="联系人")
        self.points_tree.heading("contact_phone", text="联系电话")
        self.points_tree.heading("route_name", text="所属路线")
        
        self.points_tree.column("point_name", width=100)
        self.points_tree.column("address", width=150)
        self.points_tree.column("contact_person", width=80)
        self.points_tree.column("contact_phone", width=100)
        self.points_tree.column("route_name", width=80)
        
        scrollbar = ttk.Scrollbar(self.tab_points, orient=tk.VERTICAL, command=self.points_tree.yview)
        self.points_tree.configure(yscrollcommand=scrollbar.set)
        
        self.points_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _refresh_cooler(self):
        for item in self.cooler_tree.get_children():
            self.cooler_tree.delete(item)
        
        boxes = self.db.get_all(CoolerBox)
        for box in boxes:
            status = "启用" if box.is_active else "停用"
            self.cooler_tree.insert("", tk.END, values=(
                box.box_number,
                box.device_id or "",
                box.description or "",
                status
            ), iid=box.id)
    
    def _refresh_drugs(self):
        for item in self.drugs_tree.get_children():
            self.drugs_tree.delete(item)
        
        batches = self.db.get_all(DrugBatch)
        for batch in batches:
            self.drugs_tree.insert("", tk.END, values=(
                batch.batch_number,
                batch.drug_name,
                batch.specification or "",
                batch.manufacturer or "",
                batch.quantity,
                batch.unit
            ), iid=batch.id)
    
    def _refresh_routes(self):
        for item in self.routes_tree.get_children():
            self.routes_tree.delete(item)
        
        routes = self.db.get_all(DeliveryRoute)
        for route in routes:
            status = "启用" if route.is_active else "停用"
            self.routes_tree.insert("", tk.END, values=(
                route.route_name,
                route.description or "",
                status
            ), iid=route.id)
    
    def _refresh_points(self):
        for item in self.points_tree.get_children():
            self.points_tree.delete(item)
        
        points = self.db.get_all(DeliveryPoint)
        routes_dict = {}
        for route in self.db.get_all(DeliveryRoute):
            routes_dict[route.id] = route.route_name
        
        for point in points:
            route_name = routes_dict.get(point.route_id, "") if point.route_id else ""
            self.points_tree.insert("", tk.END, values=(
                point.point_name,
                point.address or "",
                point.contact_person or "",
                point.contact_phone or "",
                route_name
            ), iid=point.id)
    
    def _refresh_all(self):
        self._refresh_cooler()
        self._refresh_drugs()
        self._refresh_routes()
        self._refresh_points()
    
    def _add_cooler(self):
        dialog = CoolerBoxDialog(self, self.db)
        dialog.wait_window()
        if dialog.result:
            self._refresh_cooler()
            self._notify_data_changed()
    
    def _edit_cooler(self):
        selected = self.cooler_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要编辑的冷藏箱", "warning")
            return
        
        box_id = int(selected[0])
        box = self.db.get_by_id(CoolerBox, box_id)
        if not box:
            return
        
        dialog = CoolerBoxDialog(self, self.db, box)
        dialog.wait_window()
        if dialog.result:
            self._refresh_cooler()
            self._notify_data_changed()
    
    def _delete_cooler(self):
        selected = self.cooler_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要删除的冷藏箱", "warning")
            return
        
        box_id = int(selected[0])
        box = self.db.get_by_id(CoolerBox, box_id)
        if not box:
            return
        
        if tk.messagebox.askyesno("确认", f"确定要删除冷藏箱 {box.box_number} 吗？"):
            self.db.delete(box)
            self._refresh_cooler()
            self._notify_data_changed()
    
    def _add_drug(self):
        dialog = DrugBatchDialog(self, self.db)
        dialog.wait_window()
        if dialog.result:
            self._refresh_drugs()
            self._notify_data_changed()
    
    def _edit_drug(self):
        selected = self.drugs_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要编辑的药品批号", "warning")
            return
        
        batch_id = int(selected[0])
        batch = self.db.get_by_id(DrugBatch, batch_id)
        if not batch:
            return
        
        dialog = DrugBatchDialog(self, self.db, batch)
        dialog.wait_window()
        if dialog.result:
            self._refresh_drugs()
            self._notify_data_changed()
    
    def _delete_drug(self):
        selected = self.drugs_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要删除的药品批号", "warning")
            return
        
        batch_id = int(selected[0])
        batch = self.db.get_by_id(DrugBatch, batch_id)
        if not batch:
            return
        
        if tk.messagebox.askyesno("确认", f"确定要删除药品批号 {batch.batch_number} 吗？"):
            self.db.delete(batch)
            self._refresh_drugs()
            self._notify_data_changed()
    
    def _add_route(self):
        dialog = DeliveryRouteDialog(self, self.db)
        dialog.wait_window()
        if dialog.result:
            self._refresh_routes()
            self._notify_data_changed()
    
    def _edit_route(self):
        selected = self.routes_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要编辑的配送路线", "warning")
            return
        
        route_id = int(selected[0])
        route = self.db.get_by_id(DeliveryRoute, route_id)
        if not route:
            return
        
        dialog = DeliveryRouteDialog(self, self.db, route)
        dialog.wait_window()
        if dialog.result:
            self._refresh_routes()
            self._notify_data_changed()
    
    def _delete_route(self):
        selected = self.routes_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要删除的配送路线", "warning")
            return
        
        route_id = int(selected[0])
        route = self.db.get_by_id(DeliveryRoute, route_id)
        if not route:
            return
        
        if tk.messagebox.askyesno("确认", f"确定要删除配送路线 {route.route_name} 吗？"):
            self.db.delete(route)
            self._refresh_routes()
            self._refresh_points()
            self._notify_data_changed()
    
    def _add_point(self):
        dialog = DeliveryPointDialog(self, self.db)
        dialog.wait_window()
        if dialog.result:
            self._refresh_points()
            self._notify_data_changed()
    
    def _edit_point(self):
        selected = self.points_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要编辑的收货点", "warning")
            return
        
        point_id = int(selected[0])
        point = self.db.get_by_id(DeliveryPoint, point_id)
        if not point:
            return
        
        dialog = DeliveryPointDialog(self, self.db, point)
        dialog.wait_window()
        if dialog.result:
            self._refresh_points()
            self._notify_data_changed()
    
    def _delete_point(self):
        selected = self.points_tree.selection()
        if not selected:
            MessageDialog(self, "提示", "请选择要删除的收货点", "warning")
            return
        
        point_id = int(selected[0])
        point = self.db.get_by_id(DeliveryPoint, point_id)
        if not point:
            return
        
        if tk.messagebox.askyesno("确认", f"确定要删除收货点 {point.point_name} 吗？"):
            self.db.delete(point)
            self._refresh_points()
            self._notify_data_changed()
    
    def _notify_data_changed(self):
        if self.on_data_changed:
            self.on_data_changed()
    
    def refresh(self):
        self._refresh_all()
