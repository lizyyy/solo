import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from database import Database
from utils import (
    validate_phone, validate_time_range, validate_people_count,
    export_to_csv, export_to_markdown, format_time_range,
    get_status_color
)

class ReservationApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("社区活动室预约管理系统")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 700)
        
        self.db = Database()
        self.selected_reservation_id: Optional[int] = None
        self.filter_conditions = {
            'date': '',
            'venue': '',
            'status': ''
        }
        
        self.setup_ui()
        self.load_data()
        self.show_today_notification()
    
    def setup_ui(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(
            title_frame, 
            text="社区活动室预约管理系统", 
            font=("Microsoft YaHei", 18, "bold")
        ).pack(side=tk.LEFT)
        
        btn_frame = ttk.Frame(title_frame)
        btn_frame.pack(side=tk.RIGHT)
        
        ttk.Button(btn_frame, text="新增预约", command=self.add_reservation).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="回收站", command=self.show_trash).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="导出CSV", command=self.export_csv).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="导出Markdown", command=self.export_markdown).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="刷新", command=self.load_data).pack(side=tk.LEFT, padx=5)
        
        filter_frame = ttk.LabelFrame(main_frame, text="筛选条件", padding="10")
        filter_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(filter_frame, text="日期:").pack(side=tk.LEFT, padx=(0, 5))
        
        self.date_var = tk.StringVar()
        date_combo = ttk.Combobox(filter_frame, textvariable=self.date_var, width=20, state='readonly')
        date_options = [''] + self.get_date_options()
        date_combo['values'] = date_options
        date_combo.pack(side=tk.LEFT, padx=(0, 15))
        date_combo.bind('<<ComboboxSelected>>', self.on_filter_change)
        
        ttk.Label(filter_frame, text="场地:").pack(side=tk.LEFT, padx=(0, 5))
        
        self.venue_var = tk.StringVar()
        venue_combo = ttk.Combobox(filter_frame, textvariable=self.venue_var, width=15, state='readonly')
        venue_options = [''] + self.db.get_all_venues()
        venue_combo['values'] = venue_options
        venue_combo.pack(side=tk.LEFT, padx=(0, 15))
        venue_combo.bind('<<ComboboxSelected>>', self.on_filter_change)
        
        ttk.Label(filter_frame, text="状态:").pack(side=tk.LEFT, padx=(0, 5))
        
        self.status_var = tk.StringVar()
        status_combo = ttk.Combobox(filter_frame, textvariable=self.status_var, width=12, state='readonly')
        status_options = [''] + self.db.get_all_statuses()
        status_combo['values'] = status_options
        status_combo.pack(side=tk.LEFT, padx=(0, 15))
        status_combo.bind('<<ComboboxSelected>>', self.on_filter_change)
        
        ttk.Button(filter_frame, text="重置筛选", command=self.reset_filter).pack(side=tk.LEFT, padx=5)
        
        ttk.Label(filter_frame, text="搜索:").pack(side=tk.LEFT, padx=(20, 5))
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(filter_frame, textvariable=self.search_var, width=20)
        search_entry.pack(side=tk.LEFT, padx=(0, 5))
        search_entry.bind('<KeyRelease>', self.on_search)
        
        ttk.Button(filter_frame, text="搜索", command=self.on_search_click).pack(side=tk.LEFT, padx=5)
        
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)
        
        left_frame = ttk.Frame(content_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        list_frame = ttk.LabelFrame(left_frame, text="预约列表", padding="5")
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ('id', 'activity_name', 'responsible_person', 'phone', 'venue', 
                  'time_range', 'people_count', 'status')
        self.tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=15)
        
        self.tree.heading('id', text='ID')
        self.tree.heading('activity_name', text='活动名称')
        self.tree.heading('responsible_person', text='负责人')
        self.tree.heading('phone', text='手机号')
        self.tree.heading('venue', text='场地')
        self.tree.heading('time_range', text='时间')
        self.tree.heading('people_count', text='人数')
        self.tree.heading('status', text='状态')
        
        self.tree.column('id', width=40, anchor='center')
        self.tree.column('activity_name', width=120)
        self.tree.column('responsible_person', width=80, anchor='center')
        self.tree.column('phone', width=110, anchor='center')
        self.tree.column('venue', width=80, anchor='center')
        self.tree.column('time_range', width=160)
        self.tree.column('people_count', width=50, anchor='center')
        self.tree.column('status', width=70, anchor='center')
        
        scrollbar_y = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        scrollbar_x = ttk.Scrollbar(list_frame, orient=tk.HORIZONTAL, command=self.tree.xview)
        self.tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.tree.bind('<<TreeviewSelect>>', self.on_select)
        self.tree.bind('<Double-1>', self.on_double_click)
        
        action_frame = ttk.Frame(left_frame)
        action_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(action_frame, text="编辑", command=self.edit_reservation).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="删除", command=self.delete_reservation).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="查看详情", command=self.view_detail).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="快速确认", command=self.quick_confirm).pack(side=tk.LEFT, padx=5)
        
        right_frame = ttk.Frame(content_frame, width=350)
        right_frame.pack(side=tk.RIGHT, fill=tk.Y)
        
        today_frame = ttk.LabelFrame(right_frame, text="今日预约", padding="10")
        today_frame.pack(fill=tk.X, pady=(0, 10))
        
        today_list_frame = ttk.Frame(today_frame)
        today_list_frame.pack(fill=tk.BOTH, expand=True)
        
        self.today_listbox = tk.Listbox(today_list_frame, height=6, font=("Microsoft YaHei", 9))
        today_scrollbar = ttk.Scrollbar(today_list_frame, orient=tk.VERTICAL, command=self.today_listbox.yview)
        self.today_listbox.configure(yscrollcommand=today_scrollbar.set)
        
        self.today_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        today_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        log_frame = ttk.LabelFrame(right_frame, text="操作日志", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True)
        
        log_list_frame = ttk.Frame(log_frame)
        log_list_frame.pack(fill=tk.BOTH, expand=True)
        
        self.log_listbox = tk.Listbox(log_list_frame, height=15, font=("Microsoft YaHei", 9))
        log_scrollbar = ttk.Scrollbar(log_list_frame, orient=tk.VERTICAL, command=self.log_listbox.yview)
        self.log_listbox.configure(yscrollcommand=log_scrollbar.set)
        
        self.log_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        log_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        status_frame = ttk.Frame(main_frame)
        status_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.status_label = ttk.Label(status_frame, text="就绪 | 共 0 条预约")
        self.status_label.pack(side=tk.LEFT)
        
        ttk.Label(
            status_frame, 
            text=f"当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            foreground='gray'
        ).pack(side=tk.RIGHT)
    
    def get_date_options(self) -> List[str]:
        today = datetime.now().date()
        dates = []
        for i in range(-3, 15):
            date = today + timedelta(days=i)
            if i == 0:
                dates.append(f"{date.strftime('%Y-%m-%d')} (今天)")
            elif i == 1:
                dates.append(f"{date.strftime('%Y-%m-%d')} (明天)")
            else:
                dates.append(date.strftime('%Y-%m-%d'))
        return dates
    
    def load_data(self):
        self.tree.delete(*self.tree.get_children())
        
        reservations = self.db.get_all_reservations()
        
        filtered_reservations = self.apply_filters(reservations)
        
        self.all_reservations = filtered_reservations
        
        for r in filtered_reservations:
            time_range = format_time_range(r['date_time_start'], r['date_time_end'])
            item = self.tree.insert('', tk.END, values=(
                r['id'],
                r['activity_name'],
                r['responsible_person'],
                r['phone'],
                r['venue'],
                time_range,
                r['people_count'],
                r['status']
            ))
        
        self.load_today_reservations()
        self.load_operation_logs()
        self.update_status(filtered_reservations)
    
    def apply_filters(self, reservations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        filtered = reservations
        
        if self.filter_conditions.get('date'):
            date_str = self.filter_conditions['date'].split()[0]
            filtered = [
                r for r in filtered 
                if r['date_time_start'].startswith(date_str)
            ]
        
        if self.filter_conditions.get('venue'):
            filtered = [
                r for r in filtered 
                if r['venue'] == self.filter_conditions['venue']
            ]
        
        if self.filter_conditions.get('status'):
            filtered = [
                r for r in filtered 
                if r['status'] == self.filter_conditions['status']
            ]
        
        return filtered
    
    def load_today_reservations(self):
        self.today_listbox.delete(0, tk.END)
        today_reservations = self.db.get_today_reservations()
        
        if not today_reservations:
            self.today_listbox.insert(tk.END, "  今日暂无预约")
        else:
            for r in today_reservations:
                time_str = r['date_time_start'].split()[1]
                self.today_listbox.insert(tk.END, f"  {time_str} - {r['activity_name']} ({r['status']})")
    
    def load_operation_logs(self):
        self.log_listbox.delete(0, tk.END)
        logs = self.db.get_operation_logs(50)
        
        for log in logs:
            time_str = log['created_at'].split()[1] if ' ' in log['created_at'] else log['created_at']
            self.log_listbox.insert(tk.END, f"  [{time_str}] {log['operation_type']}: {log['details']}")
    
    def update_status(self, reservations: List[Dict[str, Any]]):
        total = len(reservations)
        today = len(self.db.get_today_reservations())
        self.status_label.config(text=f"就绪 | 共 {total} 条预约 | 今日 {today} 条")
    
    def on_filter_change(self, event=None):
        date_val = self.date_var.get()
        venue_val = self.venue_var.get()
        status_val = self.status_var.get()
        
        self.filter_conditions['date'] = date_val
        self.filter_conditions['venue'] = venue_val
        self.filter_conditions['status'] = status_val
        
        self.load_data()
    
    def reset_filter(self):
        self.date_var.set('')
        self.venue_var.set('')
        self.status_var.set('')
        self.search_var.set('')
        self.filter_conditions = {'date': '', 'venue': '', 'status': ''}
        self.load_data()
    
    def on_search(self, event=None):
        pass
    
    def on_search_click(self):
        keyword = self.search_var.get().strip()
        if not keyword:
            self.load_data()
            return
        
        self.tree.delete(*self.tree.get_children())
        reservations = self.db.get_all_reservations()
        
        filtered = [
            r for r in reservations
            if keyword.lower() in r['activity_name'].lower()
            or keyword.lower() in r['responsible_person'].lower()
            or keyword in r['phone']
            or keyword.lower() in r['venue'].lower()
            or keyword.lower() in r.get('remarks', '').lower()
        ]
        
        for r in filtered:
            time_range = format_time_range(r['date_time_start'], r['date_time_end'])
            self.tree.insert('', tk.END, values=(
                r['id'],
                r['activity_name'],
                r['responsible_person'],
                r['phone'],
                r['venue'],
                time_range,
                r['people_count'],
                r['status']
            ))
        
        self.update_status(filtered)
    
    def on_select(self, event=None):
        selection = self.tree.selection()
        if selection:
            item = self.tree.item(selection[0])
            values = item['values']
            if values:
                self.selected_reservation_id = values[0]
        else:
            self.selected_reservation_id = None
    
    def on_double_click(self, event=None):
        self.view_detail()
    
    def show_today_notification(self):
        today_reservations = self.db.get_today_reservations()
        if today_reservations:
            count = len(today_reservations)
            messagebox.showinfo(
                "今日预约提醒",
                f"今天有 {count} 个预约，请查看详情安排工作。"
            )
    
    def add_reservation(self):
        AddEditDialog(self.root, self.db, "新增预约", None, self.load_data)
    
    def edit_reservation(self):
        if not self.selected_reservation_id:
            messagebox.showwarning("提示", "请先选择要编辑的预约")
            return
        
        reservation = self.db.get_reservation_by_id(self.selected_reservation_id)
        if not reservation:
            messagebox.showerror("错误", "预约不存在")
            return
        
        AddEditDialog(self.root, self.db, "编辑预约", reservation, self.load_data)
    
    def delete_reservation(self):
        if not self.selected_reservation_id:
            messagebox.showwarning("提示", "请先选择要删除的预约")
            return
        
        reservation = self.db.get_reservation_by_id(self.selected_reservation_id)
        if not reservation:
            messagebox.showerror("错误", "预约不存在")
            return
        
        if messagebox.askyesno(
            "确认删除",
            f"确定要删除预约「{reservation['activity_name']}」吗？\n\n"
            f"删除后可以在回收站恢复。"
        ):
            if self.db.soft_delete_reservation(self.selected_reservation_id):
                messagebox.showinfo("成功", "已删除到回收站")
                self.load_data()
                self.selected_reservation_id = None
            else:
                messagebox.showerror("错误", "删除失败")
    
    def view_detail(self):
        if not self.selected_reservation_id:
            messagebox.showwarning("提示", "请先选择要查看的预约")
            return
        
        reservation = self.db.get_reservation_by_id(self.selected_reservation_id)
        if not reservation:
            messagebox.showerror("错误", "预约不存在")
            return
        
        DetailDialog(self.root, reservation)
    
    def quick_confirm(self):
        if not self.selected_reservation_id:
            messagebox.showwarning("提示", "请先选择要确认的预约")
            return
        
        reservation = self.db.get_reservation_by_id(self.selected_reservation_id)
        if not reservation:
            messagebox.showerror("错误", "预约不存在")
            return
        
        if reservation['status'] == '已确认':
            messagebox.showinfo("提示", "该预约已经是确认状态")
            return
        
        data = reservation.copy()
        data['status'] = '已确认'
        
        if self.db.update_reservation(self.selected_reservation_id, data):
            messagebox.showinfo("成功", "预约已确认")
            self.load_data()
        else:
            messagebox.showerror("错误", "操作失败")
    
    def show_trash(self):
        TrashDialog(self.root, self.db, self.load_data)
    
    def export_csv(self):
        export_to_csv(self.all_reservations if hasattr(self, 'all_reservations') else [], self.root)
    
    def export_markdown(self):
        export_to_markdown(self.all_reservations if hasattr(self, 'all_reservations') else [], self.root)


class AddEditDialog:
    def __init__(self, parent, db: Database, title: str, 
                 reservation: Optional[Dict[str, Any]], on_save_callback):
        self.parent = parent
        self.db = db
        self.title = title
        self.reservation = reservation
        self.on_save_callback = on_save_callback
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("500x520")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        self.setup_ui()
        
        if reservation:
            self.fill_form()
        
        self.dialog.wait_window()
    
    def setup_ui(self):
        main_frame = ttk.Frame(self.dialog, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        row = 0
        
        ttk.Label(main_frame, text="活动名称 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.activity_name_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.activity_name_var, width=40).grid(
            row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0)
        )
        row += 1
        
        ttk.Label(main_frame, text="负责人 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.responsible_person_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.responsible_person_var, width=20).grid(
            row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0)
        )
        row += 1
        
        ttk.Label(main_frame, text="手机号 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.phone_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.phone_var, width=20).grid(
            row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0)
        )
        ttk.Label(main_frame, text="(11位手机号)", foreground='gray').grid(
            row=row, column=2, sticky=tk.W, padx=5
        )
        row += 1
        
        ttk.Label(main_frame, text="场地 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.venue_var = tk.StringVar()
        venue_frame = ttk.Frame(main_frame)
        venue_frame.grid(row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0))
        
        default_venues = ['多功能厅', '会议室A', '会议室B', '活动室A', '活动室B', '棋牌室']
        existing_venues = self.db.get_all_venues()
        all_venues = list(set(default_venues + existing_venues))
        all_venues.sort()
        
        self.venue_combo = ttk.Combobox(venue_frame, textvariable=self.venue_var, width=18, values=all_venues)
        self.venue_combo.pack(side=tk.LEFT)
        row += 1
        
        ttk.Label(main_frame, text="开始时间 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        time_frame = ttk.Frame(main_frame)
        time_frame.grid(row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0))
        
        self.start_time_var = tk.StringVar()
        ttk.Entry(time_frame, textvariable=self.start_time_var, width=18).pack(side=tk.LEFT)
        ttk.Label(time_frame, text="(如: 2026-05-06 09:00)", foreground='gray').pack(side=tk.LEFT, padx=5)
        row += 1
        
        ttk.Label(main_frame, text="结束时间 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        time_frame2 = ttk.Frame(main_frame)
        time_frame2.grid(row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0))
        
        self.end_time_var = tk.StringVar()
        ttk.Entry(time_frame2, textvariable=self.end_time_var, width=18).pack(side=tk.LEFT)
        ttk.Label(time_frame2, text="(如: 2026-05-06 11:00)", foreground='gray').pack(side=tk.LEFT, padx=5)
        row += 1
        
        ttk.Label(main_frame, text="人数 *:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.people_count_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.people_count_var, width=10).grid(
            row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0)
        )
        row += 1
        
        ttk.Label(main_frame, text="状态:").grid(row=row, column=0, sticky=tk.W, pady=5)
        self.status_var = tk.StringVar(value='待确认')
        status_combo = ttk.Combobox(
            main_frame, textvariable=self.status_var, width=12, 
            values=self.db.get_all_statuses(), state='readonly'
        )
        status_combo.grid(row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0))
        row += 1
        
        ttk.Label(main_frame, text="备注:").grid(row=row, column=0, sticky=tk.NW, pady=5)
        self.remarks_text = tk.Text(main_frame, width=35, height=4, font=("Microsoft YaHei", 10))
        self.remarks_text.grid(row=row, column=1, sticky=tk.W, pady=5, padx=(10, 0))
        row += 1
        
        btn_frame = ttk.Frame(main_frame)
        btn_frame.grid(row=row, column=0, columnspan=3, pady=20)
        
        ttk.Button(btn_frame, text="保存", command=self.save, width=10).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=self.dialog.destroy, width=10).pack(side=tk.LEFT, padx=10)
        
        hint_frame = ttk.LabelFrame(main_frame, text="快捷输入提示", padding="5")
        hint_frame.grid(row=row+1, column=0, columnspan=3, sticky=tk.EW, pady=10)
        
        ttk.Label(
            hint_frame, 
            text="快速填充今天: 点击后自动填充当前日期，时间格式为 YYYY-MM-DD HH:MM",
            foreground='gray'
        ).pack(anchor=tk.W)
        
        quick_frame = ttk.Frame(hint_frame)
        quick_frame.pack(anchor=tk.W, pady=5)
        
        ttk.Button(quick_frame, text="今天上午 9-11", command=lambda: self.fill_quick_time(9, 11), width=15).pack(side=tk.LEFT, padx=5)
        ttk.Button(quick_frame, text="今天下午 2-4", command=lambda: self.fill_quick_time(14, 16), width=15).pack(side=tk.LEFT, padx=5)
        ttk.Button(quick_frame, text="明天上午 9-11", command=lambda: self.fill_quick_time(9, 11, 1), width=15).pack(side=tk.LEFT, padx=5)
    
    def fill_quick_time(self, start_hour: int, end_hour: int, days_offset: int = 0):
        today = datetime.now().date() + timedelta(days=days_offset)
        start_time = datetime(today.year, today.month, today.day, start_hour, 0)
        end_time = datetime(today.year, today.month, today.day, end_hour, 0)
        
        self.start_time_var.set(start_time.strftime('%Y-%m-%d %H:%M'))
        self.end_time_var.set(end_time.strftime('%Y-%m-%d %H:%M'))
    
    def fill_form(self):
        if not self.reservation:
            return
        
        r = self.reservation
        self.activity_name_var.set(r.get('activity_name', ''))
        self.responsible_person_var.set(r.get('responsible_person', ''))
        self.phone_var.set(r.get('phone', ''))
        self.venue_var.set(r.get('venue', ''))
        self.start_time_var.set(r.get('date_time_start', ''))
        self.end_time_var.set(r.get('date_time_end', ''))
        self.people_count_var.set(str(r.get('people_count', '')))
        self.status_var.set(r.get('status', '待确认'))
        
        remarks = r.get('remarks', '')
        if remarks:
            self.remarks_text.insert(tk.END, remarks)
    
    def save(self):
        activity_name = self.activity_name_var.get().strip()
        responsible_person = self.responsible_person_var.get().strip()
        phone = self.phone_var.get().strip()
        venue = self.venue_var.get().strip()
        start_time = self.start_time_var.get().strip()
        end_time = self.end_time_var.get().strip()
        people_count = self.people_count_var.get().strip()
        status = self.status_var.get()
        remarks = self.remarks_text.get("1.0", tk.END).strip()
        
        if not activity_name:
            messagebox.showerror("错误", "请输入活动名称")
            return
        
        if not responsible_person:
            messagebox.showerror("错误", "请输入负责人")
            return
        
        if not validate_phone(phone):
            messagebox.showerror("错误", "请输入正确的11位手机号")
            return
        
        if not venue:
            messagebox.showerror("错误", "请选择或输入场地")
            return
        
        if not validate_time_range(start_time, end_time):
            messagebox.showerror("错误", "请输入正确的时间格式，且结束时间必须晚于开始时间\n格式: YYYY-MM-DD HH:MM")
            return
        
        if not validate_people_count(people_count):
            messagebox.showerror("错误", "请输入有效的人数（1-1000之间）")
            return
        
        exclude_id = self.reservation['id'] if self.reservation else None
        if self.db.check_time_conflict(venue, start_time, end_time, exclude_id):
            messagebox.showerror("错误", f"该场地在 {start_time} 至 {end_time} 已有预约，时间重叠！")
            return
        
        data = {
            'activity_name': activity_name,
            'responsible_person': responsible_person,
            'phone': phone,
            'venue': venue,
            'date_time_start': start_time,
            'date_time_end': end_time,
            'people_count': int(people_count),
            'remarks': remarks,
            'status': status
        }
        
        try:
            if self.reservation:
                self.db.update_reservation(self.reservation['id'], data)
                messagebox.showinfo("成功", "预约已更新")
            else:
                self.db.add_reservation(data)
                messagebox.showinfo("成功", "预约已添加")
            
            if self.on_save_callback:
                self.on_save_callback()
            
            self.dialog.destroy()
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {str(e)}")


class DetailDialog:
    def __init__(self, parent, reservation: Dict[str, Any]):
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("预约详情")
        self.dialog.geometry("450x400")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        self.show_details(reservation)
        
        self.dialog.wait_window()
    
    def show_details(self, r: Dict[str, Any]):
        main_frame = ttk.Frame(self.dialog, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(
            main_frame, 
            text=r.get('activity_name', '未知活动'), 
            font=("Microsoft YaHei", 16, "bold")
        ).pack(anchor=tk.W, pady=(0, 15))
        
        status_color = get_status_color(r.get('status', ''))
        status_frame = ttk.Frame(main_frame)
        status_frame.pack(anchor=tk.W, pady=(0, 15))
        
        ttk.Label(status_frame, text="状态: ").pack(side=tk.LEFT)
        status_label = tk.Label(
            status_frame, 
            text=r.get('status', '未知'),
            font=("Microsoft YaHei", 11, "bold"),
            fg=status_color
        )
        status_label.pack(side=tk.LEFT)
        
        info_frame = ttk.LabelFrame(main_frame, text="基本信息", padding="10")
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        info = [
            ("ID", r.get('id', '')),
            ("负责人", r.get('responsible_person', '')),
            ("联系电话", r.get('phone', '')),
            ("场地", r.get('venue', '')),
            ("开始时间", r.get('date_time_start', '')),
            ("结束时间", r.get('date_time_end', '')),
            ("参与人数", f"{r.get('people_count', 0)} 人"),
        ]
        
        for label, value in info:
            row_frame = ttk.Frame(info_frame)
            row_frame.pack(fill=tk.X, pady=2)
            ttk.Label(row_frame, text=f"{label}:", width=10).pack(side=tk.LEFT)
            ttk.Label(row_frame, text=str(value)).pack(side=tk.LEFT)
        
        if r.get('remarks'):
            remarks_frame = ttk.LabelFrame(main_frame, text="备注", padding="10")
            remarks_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
            
            remarks_text = tk.Text(remarks_frame, height=4, font=("Microsoft YaHei", 10), wrap=tk.WORD)
            remarks_text.insert(tk.END, r.get('remarks', ''))
            remarks_text.config(state=tk.DISABLED)
            remarks_text.pack(fill=tk.BOTH, expand=True)
        
        ttk.Button(main_frame, text="关闭", command=self.dialog.destroy, width=10).pack(pady=10)


class TrashDialog:
    def __init__(self, parent, db: Database, on_restore_callback):
        self.db = db
        self.on_restore_callback = on_restore_callback
        
        self.dialog = tk.Toplevel(parent)
        self.dialog.title("回收站")
        self.dialog.geometry("700x500")
        self.dialog.resizable(True, True)
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        self.setup_ui()
        self.load_deleted()
        
        self.dialog.wait_window()
    
    def setup_ui(self):
        main_frame = ttk.Frame(self.dialog, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(
            main_frame, 
            text="已删除的预约（可恢复）", 
            font=("Microsoft YaHei", 12, "bold")
        ).pack(anchor=tk.W, pady=(0, 10))
        
        list_frame = ttk.Frame(main_frame)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ('id', 'activity_name', 'responsible_person', 'venue', 
                  'time_range', 'deleted_at')
        self.tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=15)
        
        self.tree.heading('id', text='ID')
        self.tree.heading('activity_name', text='活动名称')
        self.tree.heading('responsible_person', text='负责人')
        self.tree.heading('venue', text='场地')
        self.tree.heading('time_range', text='时间')
        self.tree.heading('deleted_at', text='删除时间')
        
        self.tree.column('id', width=50, anchor='center')
        self.tree.column('activity_name', width=150)
        self.tree.column('responsible_person', width=80, anchor='center')
        self.tree.column('venue', width=100, anchor='center')
        self.tree.column('time_range', width=160)
        self.tree.column('deleted_at', width=150, anchor='center')
        
        scrollbar_y = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar_y.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(15, 0))
        
        ttk.Button(btn_frame, text="恢复选中", command=self.restore_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="刷新", command=self.load_deleted).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="关闭", command=self.dialog.destroy).pack(side=tk.RIGHT, padx=5)
        
        self.status_label = ttk.Label(btn_frame, text="共 0 条已删除记录")
        self.status_label.pack(side=tk.LEFT, padx=20)
    
    def load_deleted(self):
        self.tree.delete(*self.tree.get_children())
        deleted = self.db.get_deleted_reservations()
        
        for r in deleted:
            time_range = format_time_range(r['date_time_start'], r['date_time_end'])
            deleted_at = r.get('updated_at', r.get('created_at', ''))
            self.tree.insert('', tk.END, values=(
                r['id'],
                r['activity_name'],
                r['responsible_person'],
                r['venue'],
                time_range,
                deleted_at
            ))
        
        self.status_label.config(text=f"共 {len(deleted)} 条已删除记录")
    
    def restore_selected(self):
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("提示", "请先选择要恢复的预约")
            return
        
        item = self.tree.item(selection[0])
        values = item['values']
        if not values:
            return
        
        reservation_id = values[0]
        activity_name = values[1]
        
        if messagebox.askyesno("确认恢复", f"确定要恢复预约「{activity_name}」吗？"):
            if self.db.restore_reservation(reservation_id):
                messagebox.showinfo("成功", "预约已恢复")
                self.load_deleted()
                if self.on_restore_callback:
                    self.on_restore_callback()
            else:
                messagebox.showerror("错误", "恢复失败")


def main():
    root = tk.Tk()
    
    try:
        root.tk.call('source', 'azure.tcl')
        root.tk.call('set_theme', 'light')
    except Exception:
        pass
    
    app = ReservationApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
