import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
from typing import List, Dict, Callable
from order_state_machine import OrderItem, OrderStatus, ExceptionType

class OrderGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("社区团购团长核对工具")
        self.root.geometry("1200x700")
        
        self.on_scan_callback: Callable[[str], None] = None
        self.on_status_change_callback: Callable[[str, OrderStatus], None] = None
        self.on_notes_change_callback: Callable[[str, str], None] = None
        self.on_shelf_change_callback: Callable[[str, str], None] = None
        self.on_export_callback: Callable[[], None] = None
        
        self.current_view = 'shelf'
        self.selected_shelf = ''
        self.orders: List[OrderItem] = []
        self.shelves: List[str] = []
        
        self._create_widgets()
        
    def _create_widgets(self):
        self.main_frame = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        self.left_panel = ttk.Frame(self.main_frame, width=250)
        self.main_frame.add(self.left_panel, weight=1)
        
        self.right_panel = ttk.Frame(self.main_frame)
        self.main_frame.add(self.right_panel, weight=4)
        
        self._create_left_panel()
        self._create_right_panel()
        self._create_bottom_panel()
        
    def _create_left_panel(self):
        ttk.Label(self.left_panel, text="视图切换", font=('Arial', 12, 'bold')).pack(pady=5)
        
        view_frame = ttk.Frame(self.left_panel)
        view_frame.pack(fill=tk.X, padx=5)
        
        self.shelf_view_btn = ttk.Button(view_frame, text="按货架", command=lambda: self._switch_view('shelf'))
        self.shelf_view_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        self.order_view_btn = ttk.Button(view_frame, text="按订单", command=lambda: self._switch_view('order'))
        self.order_view_btn.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=2)
        
        ttk.Label(self.left_panel, text="货架列表", font=('Arial', 12, 'bold')).pack(pady=5)
        
        self.shelf_listbox = tk.Listbox(self.left_panel, selectmode=tk.SINGLE)
        self.shelf_listbox.pack(fill=tk.BOTH, expand=True, padx=5, pady=2)
        self.shelf_listbox.bind('<<ListboxSelect>>', self._on_shelf_select)
        
        ttk.Label(self.left_panel, text="统计", font=('Arial', 12, 'bold')).pack(pady=5)
        
        self.stats_frame = ttk.Frame(self.left_panel)
        self.stats_frame.pack(fill=tk.X, padx=5)
        
        self.pending_label = ttk.Label(self.stats_frame, text="待拣: 0", foreground='orange')
        self.pending_label.pack(anchor=tk.W)
        
        self.scanned_label = ttk.Label(self.stats_frame, text="已扫: 0", foreground='green')
        self.scanned_label.pack(anchor=tk.W)
        
        self.exception_label = ttk.Label(self.stats_frame, text="异常: 0", foreground='red')
        self.exception_label.pack(anchor=tk.W)
        
    def _create_right_panel(self):
        self.right_notebook = ttk.Notebook(self.right_panel)
        
        self.pending_frame = ttk.Frame(self.right_notebook)
        self.scanned_frame = ttk.Frame(self.right_notebook)
        self.exception_frame = ttk.Frame(self.right_notebook)
        
        self.right_notebook.add(self.pending_frame, text='待拣')
        self.right_notebook.add(self.scanned_frame, text='已扫')
        self.right_notebook.add(self.exception_frame, text='异常')
        
        self.pending_tree = self._create_order_tree(self.pending_frame)
        self.scanned_tree = self._create_order_tree(self.scanned_frame)
        self.exception_tree = self._create_order_tree(self.exception_frame)
        
        self.right_notebook.pack(fill=tk.BOTH, expand=True)
        
        self.pending_tree.bind('<Double-1>', lambda e: self._on_order_double_click(self.pending_tree))
        self.scanned_tree.bind('<Double-1>', lambda e: self._on_order_double_click(self.scanned_tree))
        self.exception_tree.bind('<Double-1>', lambda e: self._on_order_double_click(self.exception_tree))
        
    def _create_order_tree(self, parent):
        tree = ttk.Treeview(parent, columns=('order_id', 'product', 'sku', 'shelf', 'customer', 'phone', 'notes'), show='headings')
        tree.heading('order_id', text='订单号')
        tree.heading('product', text='商品')
        tree.heading('sku', text='SKU')
        tree.heading('shelf', text='货架')
        tree.heading('customer', text='顾客')
        tree.heading('phone', text='电话')
        tree.heading('notes', text='备注')
        
        tree.column('order_id', width=100)
        tree.column('product', width=150)
        tree.column('sku', width=100)
        tree.column('shelf', width=60)
        tree.column('customer', width=100)
        tree.column('phone', width=100)
        tree.column('notes', width=150)
        
        tree.pack(fill=tk.BOTH, expand=True)
        return tree
    
    def _create_bottom_panel(self):
        bottom_frame = ttk.Frame(self.root)
        bottom_frame.pack(fill=tk.X, pady=5)
        
        scan_frame = ttk.Frame(bottom_frame)
        scan_frame.pack(side=tk.LEFT, padx=10)
        
        ttk.Label(scan_frame, text="扫码输入:").pack(side=tk.LEFT, padx=5)
        self.scan_entry = ttk.Entry(scan_frame, width=30)
        self.scan_entry.pack(side=tk.LEFT, padx=5)
        self.scan_entry.bind('<Return>', self._on_scan_enter)
        
        self.scan_btn = ttk.Button(scan_frame, text="扫码", command=self._on_scan)
        self.scan_btn.pack(side=tk.LEFT, padx=5)
        
        action_frame = ttk.Frame(bottom_frame)
        action_frame.pack(side=tk.RIGHT, padx=10)
        
        self.mark_exception_btn = ttk.Button(action_frame, text="标记异常", command=self._mark_selected_exception)
        self.mark_exception_btn.pack(side=tk.LEFT, padx=5)
        
        self.mark_pending_btn = ttk.Button(action_frame, text="重置待拣", command=self._mark_selected_pending)
        self.mark_pending_btn.pack(side=tk.LEFT, padx=5)
        
        self.edit_notes_btn = ttk.Button(action_frame, text="编辑备注", command=self._edit_selected_notes)
        self.edit_notes_btn.pack(side=tk.LEFT, padx=5)
        
        self.export_btn = ttk.Button(action_frame, text="导出报告", command=self._on_export)
        self.export_btn.pack(side=tk.LEFT, padx=5)
        
        self.message_label = ttk.Label(bottom_frame, text="", foreground='blue')
        self.message_label.pack(side=tk.LEFT, padx=20)
        
    def _switch_view(self, view: str):
        self.current_view = view
        if view == 'shelf':
            self.shelf_view_btn.config(state='disabled')
            self.order_view_btn.config(state='normal')
            self.shelf_listbox.config(state='normal')
            self._populate_shelf_list()
        else:
            self.shelf_view_btn.config(state='normal')
            self.order_view_btn.config(state='disabled')
            self.shelf_listbox.config(state='disabled')
            self.selected_shelf = ''
            self._refresh_order_trees()
            
    def _populate_shelf_list(self):
        self.shelf_listbox.delete(0, tk.END)
        for shelf in self.shelves:
            self.shelf_listbox.insert(tk.END, shelf)
            
    def _on_shelf_select(self, event):
        selection = self.shelf_listbox.curselection()
        if selection:
            self.selected_shelf = self.shelf_listbox.get(selection[0])
            self._refresh_order_trees()
            
    def _refresh_order_trees(self):
        for tree in [self.pending_tree, self.scanned_tree, self.exception_tree]:
            for item in tree.get_children():
                tree.delete(item)
                
        filtered_orders = self.orders
        if self.current_view == 'shelf' and self.selected_shelf:
            filtered_orders = [o for o in self.orders if o.shelf_code == self.selected_shelf]
            
        for order in filtered_orders:
            values = (order.order_id, order.product_name, order.sku, order.shelf_code, 
                      order.customer_name, order.phone, order.notes)
            
            if order.status == OrderStatus.PENDING:
                self.pending_tree.insert('', tk.END, values=values)
            elif order.status == OrderStatus.SCANNED:
                self.scanned_tree.insert('', tk.END, values=values)
            elif order.status == OrderStatus.EXCEPTION:
                self.exception_tree.insert('', tk.END, values=values)
                
    def _on_scan_enter(self, event):
        self._on_scan()
        
    def _on_scan(self):
        sku = self.scan_entry.get().strip()
        if sku and self.on_scan_callback:
            self.on_scan_callback(sku)
            self.scan_entry.delete(0, tk.END)
            
    def _on_order_double_click(self, tree):
        selection = tree.selection()
        if selection:
            item = tree.item(selection[0])
            order_id = item['values'][0]
            self._show_order_details(order_id)
            
    def _show_order_details(self, order_id):
        order = next((o for o in self.orders if o.order_id == order_id), None)
        if not order:
            return
            
        details = f"""订单号: {order.order_id}
商品: {order.product_name}
SKU: {order.sku}
数量: {order.quantity}
货架: {order.shelf_code}
顾客: {order.customer_name}
电话: {order.phone}
状态: {self._get_status_str(order.status)}
扫描次数: {order.scan_count}
扫描时间: {order.last_scan_time or '未扫描'}
扫描员: {order.scanner_id or '未知'}
备注: {order.notes or '无'}"""
        
        messagebox.showinfo("订单详情", details)
        
    def _mark_selected_exception(self):
        order_id = self._get_selected_order_id()
        if order_id and self.on_status_change_callback:
            exception_type = simpledialog.askstring("标记异常", "请选择异常类型:\n1-缺货\n2-错拿\n3-重复扫描\n4-其他")
            if exception_type:
                type_map = {'1': ExceptionType.MISSING, '2': ExceptionType.WRONG_PICK, 
                           '3': ExceptionType.DUPLICATE, '4': ExceptionType.OTHER}
                self.on_status_change_callback(order_id, OrderStatus.EXCEPTION)
                
                notes = simpledialog.askstring("添加备注", "请输入备注:")
                if notes and self.on_notes_change_callback:
                    self.on_notes_change_callback(order_id, notes)
                    
                self._refresh_order_trees()
                
    def _mark_selected_pending(self):
        order_id = self._get_selected_order_id()
        if order_id and self.on_status_change_callback:
            self.on_status_change_callback(order_id, OrderStatus.PENDING)
            self._refresh_order_trees()
            
    def _edit_selected_notes(self):
        order_id = self._get_selected_order_id()
        if order_id and self.on_notes_change_callback:
            notes = simpledialog.askstring("编辑备注", "请输入备注:")
            if notes:
                self.on_notes_change_callback(order_id, notes)
                self._refresh_order_trees()
                
    def _get_selected_order_id(self) -> str:
        for tree in [self.pending_tree, self.scanned_tree, self.exception_tree]:
            selection = tree.selection()
            if selection:
                return tree.item(selection[0])['values'][0]
        return ''
        
    def _on_export(self):
        if self.on_export_callback:
            self.on_export_callback()
            messagebox.showinfo("导出成功", "报告已导出")
            
    def _get_status_str(self, status: OrderStatus) -> str:
        if status == OrderStatus.PENDING:
            return '待拣货'
        elif status == OrderStatus.SCANNED:
            return '已扫描'
        elif status == OrderStatus.EXCEPTION:
            return '异常'
        elif status == OrderStatus.COMPLETED:
            return '已完成'
        return '未知'
        
    def set_scan_callback(self, callback: Callable[[str], None]):
        self.on_scan_callback = callback
        
    def set_status_change_callback(self, callback: Callable[[str, OrderStatus], None]):
        self.on_status_change_callback = callback
        
    def set_notes_change_callback(self, callback: Callable[[str, str], None]):
        self.on_notes_change_callback = callback
        
    def set_shelf_change_callback(self, callback: Callable[[str, str], None]):
        self.on_shelf_change_callback = callback
        
    def set_export_callback(self, callback: Callable[[], None]):
        self.on_export_callback = callback
        
    def update_orders(self, orders: List[OrderItem]):
        self.orders = orders
        self._refresh_order_trees()
        
    def update_shelves(self, shelves: List[str]):
        self.shelves = shelves
        if self.current_view == 'shelf':
            self._populate_shelf_list()
            
    def update_stats(self, stats: Dict[str, int]):
        self.pending_label.config(text=f"待拣: {stats.get('PENDING', 0)}")
        self.scanned_label.config(text=f"已扫: {stats.get('SCANNED', 0)}")
        self.exception_label.config(text=f"异常: {stats.get('EXCEPTION', 0)}")
        
    def show_message(self, message: str, color: str = 'blue'):
        self.message_label.config(text=message, foreground=color)
        self.root.after(3000, lambda: self.message_label.config(text=''))