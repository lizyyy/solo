import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
from datetime import datetime, time as dt_time
from typing import Optional, List, Dict, Any
from uuid import uuid4
import sys
import os

from models import (
    ConferenceProject, Term, AgendaItem, Mark, MarkType,
    ValidationError, ImportResult
)
from importer import TermImporter, AgendaImporter, SpeakerImporter
from timeline import TimelineScheduler, FlashCardManager, Reminder, ReminderType
from storage import StorageManager, QuickSaveManager
from exporter import ExportManager


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        
        self.title("术语闪卡时间轴 - 同传志愿者工具")
        self.geometry("1400x900")
        self.minsize(1200, 800)
        
        self.storage = StorageManager()
        self.quicksave = QuickSaveManager(self.storage)
        
        self.current_project: Optional[ConferenceProject] = None
        self.scheduler: Optional[TimelineScheduler] = None
        self.flashcard_manager: Optional[FlashCardManager] = None
        
        self._setup_styles()
        self._create_menu()
        self._create_main_layout()
        
        self._show_project_list()
        
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        
        self._start_auto_save_timer()
    
    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        style.configure('Title.TLabel', font=('Microsoft YaHei UI', 18, 'bold'))
        style.configure('Header.TLabel', font=('Microsoft YaHei UI', 12, 'bold'))
        style.configure('Card.TFrame', background='#ffffff')
        style.configure('Accent.TButton', font=('Microsoft YaHei UI', 10))
        style.configure('Danger.TButton', foreground='#dc3545', font=('Microsoft YaHei UI', 10))
        style.configure('Success.TButton', foreground='#28a745', font=('Microsoft YaHei UI', 10))
        
        style.configure('Stuck.TLabel', foreground='#dc3545', font=('Microsoft YaHei UI', 10))
        style.configure('Mistranslation.TLabel', foreground='#ffc107', font=('Microsoft YaHei UI', 10))
        style.configure('Confirmed.TLabel', foreground='#28a745', font=('Microsoft YaHei UI', 10))
        
        style.configure('Timer.TLabel', font=('Consolas', 24, 'bold'))
        style.configure('TermCN.TLabel', font=('Microsoft YaHei UI', 28, 'bold'))
        style.configure('TermEN.TLabel', font=('Arial', 20))
    
    def _create_menu(self):
        menubar = tk.Menu(self)
        self.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建项目", command=self._new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="打开项目", command=self._open_project, accelerator="Ctrl+O")
        file_menu.add_separator()
        file_menu.add_command(label="保存项目", command=self._save_project, accelerator="Ctrl+S")
        file_menu.add_command(label="导出项目", command=self._export_project)
        file_menu.add_separator()
        file_menu.add_command(label="导入项目", command=self._import_project)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self._on_close)
        
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        edit_menu.add_command(label="导入术语表", command=self._import_terms)
        edit_menu.add_command(label="导入议程", command=self._import_agenda)
        edit_menu.add_command(label="导入嘉宾名单", command=self._import_speakers)
        
        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="视图", menu=view_menu)
        view_menu.add_command(label="项目列表", command=self._show_project_list)
        view_menu.add_command(label="现场模式", command=self._show_live_mode)
        view_menu.add_command(label="复盘页面", command=self._show_review_mode)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="快捷键说明", command=self._show_shortcuts)
        help_menu.add_command(label="关于", command=self._show_about)
        
        self.bind('<Control-n>', lambda e: self._new_project())
        self.bind('<Control-o>', lambda e: self._open_project())
        self.bind('<Control-s>', lambda e: self._save_project())
    
    def _create_main_layout(self):
        self.main_container = ttk.Frame(self)
        self.main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.status_bar = ttk.Frame(self)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM, padx=5, pady=2)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪", anchor=tk.W)
        self.status_label.pack(side=tk.LEFT)
        
        self.time_label = ttk.Label(self.status_bar, text="", anchor=tk.E)
        self.time_label.pack(side=tk.RIGHT)
        
        self._update_clock()
    
    def _update_clock(self):
        now = datetime.now()
        self.time_label.config(text=now.strftime("%Y-%m-%d %H:%M:%S"))
        self.after(1000, self._update_clock)
    
    def _clear_main_container(self):
        for widget in self.main_container.winfo_children():
            widget.destroy()
    
    def _update_status(self, message: str):
        self.status_label.config(text=message)
    
    def _show_project_list(self):
        self._clear_main_container()
        
        projects = self.storage.list_projects()
        
        header_frame = ttk.Frame(self.main_container)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        title_label = ttk.Label(header_frame, text="术语闪卡时间轴", style='Title.TLabel')
        title_label.pack(side=tk.LEFT)
        
        btn_frame = ttk.Frame(header_frame)
        btn_frame.pack(side=tk.RIGHT)
        
        ttk.Button(btn_frame, text="新建项目", command=self._new_project, style='Accent.TButton').pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="导入项目", command=self._import_project).pack(side=tk.LEFT, padx=5)
        
        if not projects:
            empty_frame = ttk.Frame(self.main_container)
            empty_frame.pack(fill=tk.BOTH, expand=True)
            
            ttk.Label(empty_frame, text="还没有项目", style='Header.TLabel').pack(pady=20)
            ttk.Label(empty_frame, text="点击「新建项目」开始，或「导入项目」加载已有项目").pack()
            
            ttk.Button(empty_frame, text="新建项目", command=self._new_project, style='Accent.TButton').pack(pady=20)
            return
        
        list_frame = ttk.LabelFrame(self.main_container, text="最近项目", padding=10)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ('name', 'updated', 'terms', 'agenda', 'marks')
        tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=15)
        
        tree.heading('name', text='项目名称')
        tree.heading('updated', text='最后修改')
        tree.heading('terms', text='术语数')
        tree.heading('agenda', text='议程数')
        tree.heading('marks', text='标记数')
        
        tree.column('name', width=300)
        tree.column('updated', width=180)
        tree.column('terms', width=80, anchor=tk.CENTER)
        tree.column('agenda', width=80, anchor=tk.CENTER)
        tree.column('marks', width=80, anchor=tk.CENTER)
        
        for project in projects:
            try:
                updated = datetime.fromisoformat(project['updated_at'])
                updated_str = updated.strftime('%Y-%m-%d %H:%M')
            except:
                updated_str = project['updated_at']
            
            tree.insert('', tk.END, iid=project['id'], values=(
                project['name'],
                updated_str,
                project['term_count'],
                project['agenda_count'],
                project['mark_count']
            ))
        
        tree.pack(fill=tk.BOTH, expand=True)
        
        def on_double_click(event):
            selection = tree.selection()
            if selection:
                self._load_project(selection[0])
        
        tree.bind('<Double-1>', on_double_click)
        
        btn_frame2 = ttk.Frame(list_frame)
        btn_frame2.pack(fill=tk.X, pady=(10, 0))
        
        def open_selected():
            selection = tree.selection()
            if selection:
                self._load_project(selection[0])
        
        def delete_selected():
            selection = tree.selection()
            if selection:
                project_name = tree.item(selection[0])['values'][0]
                if messagebox.askyesno("确认删除", f"确定要删除项目「{project_name}」吗？\n删除后可在备份目录恢复。"):
                    if self.storage.delete_project(selection[0]):
                        messagebox.showinfo("删除成功", "项目已删除")
                        self._show_project_list()
        
        ttk.Button(btn_frame2, text="打开选中", command=open_selected, style='Accent.TButton').pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame2, text="删除选中", command=delete_selected, style='Danger.TButton').pack(side=tk.LEFT, padx=5)
    
    def _new_project(self):
        name = simpledialog.askstring("新建项目", "请输入项目名称:", initialvalue=f"会议_{datetime.now().strftime('%Y%m%d')}")
        
        if not name:
            return
        
        now = datetime.now()
        self.current_project = ConferenceProject(
            id=str(uuid4()),
            name=name,
            created_at=now,
            updated_at=now,
            terms=[],
            agenda=[],
            marks=[],
            speakers=[],
            topics=[]
        )
        
        self.scheduler = TimelineScheduler(self.current_project)
        self.flashcard_manager = FlashCardManager(self.current_project)
        
        self._save_project()
        self._update_status(f"已创建项目: {name}")
        self._show_live_mode()
    
    def _load_project(self, project_id: str):
        project = self.storage.load_project(project_id)
        if not project:
            messagebox.showerror("错误", "无法加载项目")
            return
        
        self.current_project = project
        self.scheduler = TimelineScheduler(self.current_project)
        self.flashcard_manager = FlashCardManager(self.current_project)
        
        self._update_status(f"已加载项目: {project.name}")
        self._show_live_mode()
    
    def _open_project(self):
        file_path = filedialog.askopenfilename(
            title="选择项目文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            project_id = self.storage.import_project_from_file(file_path)
            if project_id:
                self._load_project(project_id)
            else:
                messagebox.showerror("错误", "无法导入项目文件")
    
    def _save_project(self):
        if not self.current_project:
            return
        
        if self.storage.save_project(self.current_project):
            self.quicksave._pending_project = None
            self._update_status("已保存")
        else:
            messagebox.showerror("错误", "保存失败")
    
    def _export_project(self):
        if not self.current_project:
            messagebox.showwarning("警告", "请先打开或创建项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出项目",
            defaultextension=".json",
            initialfile=f"{self.current_project.name}.json",
            filetypes=[("JSON文件", "*.json")]
        )
        
        if file_path:
            if self.storage.export_project_to_file(self.current_project.id, file_path):
                messagebox.showinfo("导出成功", f"项目已导出到: {file_path}")
            else:
                messagebox.showerror("错误", "导出失败")
    
    def _import_project(self):
        file_path = filedialog.askopenfilename(
            title="导入项目",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            project_id = self.storage.import_project_from_file(file_path)
            if project_id:
                messagebox.showinfo("导入成功", "项目已导入")
                self._load_project(project_id)
            else:
                messagebox.showerror("错误", "无法导入项目文件")
    
    def _import_terms(self):
        if not self.current_project:
            messagebox.showwarning("警告", "请先打开或创建项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择术语表 CSV 文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        result = TermImporter.import_from_csv(file_path)
        
        if result.errors:
            error_msg = "导入时发现以下问题:\n\n"
            for err in result.errors[:10]:
                row_info = f"第 {err.row_number} 行: " if err.row_number else ""
                error_msg += f"{row_info}{err.message}\n"
            
            if len(result.errors) > 10:
                error_msg += f"\n... 还有 {len(result.errors) - 10} 个问题"
            
            if not messagebox.askyesno("导入警告", f"{error_msg}\n\n是否继续导入有效数据？"):
                return
        
        if result.data:
            self.current_project.terms = result.data
            self.quicksave.mark_dirty(self.current_project)
            self._update_status(f"已导入 {result.count} 个术语")
            messagebox.showinfo("导入成功", f"成功导入 {result.count} 个术语")
    
    def _import_agenda(self):
        if not self.current_project:
            messagebox.showwarning("警告", "请先打开或创建项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择议程文本文件",
            filetypes=[("文本文件", "*.txt"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        result = AgendaImporter.import_from_text(file_path)
        
        if result.errors:
            error_msg = "导入时发现以下问题:\n\n"
            for err in result.errors[:10]:
                row_info = f"第 {err.row_number} 行: " if err.row_number else ""
                error_msg += f"{row_info}{err.message}\n"
            
            if len(result.errors) > 10:
                error_msg += f"\n... 还有 {len(result.errors) - 10} 个问题"
            
            messagebox.showinfo("导入提示", error_msg)
        
        if result.data:
            self.current_project.agenda = result.data
            self.current_project.speakers = self.current_project.get_unique_speakers()
            self.current_project.topics = self.current_project.get_unique_topics()
            
            if self.scheduler:
                self.scheduler.set_project(self.current_project)
            
            self.quicksave.mark_dirty(self.current_project)
            self._update_status(f"已导入 {result.count} 个议程项")
            messagebox.showinfo("导入成功", f"成功导入 {result.count} 个议程项")
    
    def _import_speakers(self):
        if not self.current_project:
            messagebox.showwarning("警告", "请先打开或创建项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择嘉宾名单文件",
            filetypes=[("文本文件", "*.txt"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        result = SpeakerImporter.import_from_text(file_path)
        
        if result.data:
            self.current_project.speakers = result.data
            self.quicksave.mark_dirty(self.current_project)
            self._update_status(f"已导入 {result.count} 位嘉宾")
            messagebox.showinfo("导入成功", f"成功导入 {result.count} 位嘉宾")
    
    def _show_live_mode(self):
        if not self.current_project:
            messagebox.showwarning("警告", "请先打开或创建项目")
            return
        
        self._clear_main_container()
        
        self.live_frame = ttk.Frame(self.main_container)
        self.live_frame.pack(fill=tk.BOTH, expand=True)
        
        self._create_live_toolbar()
        self._create_live_content()
        self._create_live_status()
        
        self._setup_live_shortcuts()
        
        if self.scheduler:
            self.scheduler.on_reminder = self._on_reminder
            self.scheduler.on_agenda_change = self._on_agenda_change
            self.scheduler.on_time_update = self._on_time_update
            self.scheduler.start()
        
        self._update_live_display()
    
    def _create_live_toolbar(self):
        toolbar = ttk.Frame(self.live_frame)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(toolbar, text=f"项目: {self.current_project.name}", style='Header.TLabel').pack(side=tk.LEFT)
        
        btn_frame = ttk.Frame(toolbar)
        btn_frame.pack(side=tk.RIGHT)
        
        self.import_terms_btn = ttk.Button(btn_frame, text="导入术语表", command=self._import_terms)
        self.import_terms_btn.pack(side=tk.LEFT, padx=2)
        
        self.import_agenda_btn = ttk.Button(btn_frame, text="导入议程", command=self._import_agenda)
        self.import_agenda_btn.pack(side=tk.LEFT, padx=2)
        
        ttk.Button(btn_frame, text="复盘页面", command=self._show_review_mode).pack(side=tk.LEFT, padx=2)
    
    def _create_live_content(self):
        content_paned = ttk.PanedWindow(self.live_frame, orient=tk.HORIZONTAL)
        content_paned.pack(fill=tk.BOTH, expand=True)
        
        left_frame = ttk.Frame(content_paned)
        content_paned.add(left_frame, weight=2)
        
        right_frame = ttk.Frame(content_paned)
        content_paned.add(right_frame, weight=1)
        
        self._create_flashcard_area(left_frame)
        self._create_agenda_timeline(right_frame)
        self._create_mark_buttons(left_frame)
    
    def _create_flashcard_area(self, parent):
        card_frame = ttk.LabelFrame(parent, text="术语闪卡", padding=20)
        card_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.card_display = ttk.Frame(card_frame)
        self.card_display.pack(fill=tk.BOTH, expand=True)
        
        self.term_cn_label = ttk.Label(self.card_display, text="点击「下一张」开始", style='TermCN.TLabel')
        self.term_cn_label.pack(pady=20)
        
        self.term_en_label = ttk.Label(self.card_display, text="", style='TermEN.TLabel')
        self.term_en_label.pack(pady=10)
        
        self.term_info_label = ttk.Label(self.card_display, text="")
        self.term_info_label.pack(pady=10)
        
        nav_frame = ttk.Frame(card_frame)
        nav_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(nav_frame, text="上一张 (←)", command=self._prev_card).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="下一张 (→)", command=self._next_card).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="随机洗牌", command=self._shuffle_cards).pack(side=tk.LEFT, padx=5)
        
        self.card_progress_label = ttk.Label(nav_frame, text="0/0")
        self.card_progress_label.pack(side=tk.RIGHT, padx=5)
        
        search_frame = ttk.Frame(card_frame)
        search_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(search_frame, text="搜索:").pack(side=tk.LEFT, padx=5)
        self.search_entry = ttk.Entry(search_frame)
        self.search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        self.search_entry.bind('<Return>', lambda e: self._search_terms())
        ttk.Button(search_frame, text="搜索", command=self._search_terms).pack(side=tk.LEFT, padx=5)
    
    def _create_agenda_timeline(self, parent):
        agenda_frame = ttk.LabelFrame(parent, text="议程时间轴", padding=10)
        agenda_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.current_agenda_label = ttk.Label(agenda_frame, text="当前: 无", style='Header.TLabel')
        self.current_agenda_label.pack(anchor=tk.W, pady=5)
        
        self.agenda_progress_var = tk.DoubleVar()
        self.agenda_progress = ttk.Progressbar(agenda_frame, variable=self.agenda_progress_var, maximum=100)
        self.agenda_progress.pack(fill=tk.X, pady=5)
        
        self.agenda_progress_label = ttk.Label(agenda_frame, text="进度: 0%")
        self.agenda_progress_label.pack(anchor=tk.W)
        
        columns = ('time', 'title', 'speaker')
        self.agenda_tree = ttk.Treeview(agenda_frame, columns=columns, show='headings', height=12)
        
        self.agenda_tree.heading('time', text='时间')
        self.agenda_tree.heading('title', text='议程')
        self.agenda_tree.heading('speaker', text='嘉宾')
        
        self.agenda_tree.column('time', width=100)
        self.agenda_tree.column('title', width=200)
        self.agenda_tree.column('speaker', width=80)
        
        self.agenda_tree.pack(fill=tk.BOTH, expand=True)
        
        self._refresh_agenda_list()
    
    def _create_mark_buttons(self, parent):
        mark_frame = ttk.LabelFrame(parent, text="现场标记 (快捷键)", padding=15)
        mark_frame.pack(fill=tk.X, pady=(0, 10))
        
        btn_grid = ttk.Frame(mark_frame)
        btn_grid.pack(fill=tk.X)
        
        stuck_frame = ttk.Frame(btn_grid)
        stuck_frame.pack(side=tk.LEFT, padx=10)
        ttk.Button(stuck_frame, text="卡词 (F1)", command=self._mark_stuck, style='Danger.TButton', width=15).pack()
        ttk.Label(stuck_frame, text="忘记术语时标记", foreground='gray').pack()
        
        mistranslation_frame = ttk.Frame(btn_grid)
        mistranslation_frame.pack(side=tk.LEFT, padx=10)
        ttk.Button(mistranslation_frame, text="误译 (F2)", command=self._mark_mistranslation, width=15).pack()
        ttk.Label(mistranslation_frame, text="译错时标记", foreground='gray').pack()
        
        confirmed_frame = ttk.Frame(btn_grid)
        confirmed_frame.pack(side=tk.LEFT, padx=10)
        ttk.Button(confirmed_frame, text="已确认 (F3)", command=self._mark_confirmed, style='Success.TButton', width=15).pack()
        ttk.Label(confirmed_frame, text="关键译法确认", foreground='gray').pack()
        
        info_frame = ttk.Frame(mark_frame)
        info_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Label(info_frame, text="快速标记术语:").pack(side=tk.LEFT)
        self.quick_term_entry = ttk.Entry(info_frame, width=30)
        self.quick_term_entry.pack(side=tk.LEFT, padx=5)
        self.quick_term_entry.bind('<Return>', lambda e: self._quick_mark_stuck())
        
        ttk.Label(info_frame, text="嘉宾:").pack(side=tk.LEFT, padx=(20, 5))
        self.speaker_combo = ttk.Combobox(info_frame, width=15, state='readonly')
        self.speaker_combo.pack(side=tk.LEFT)
        
        self._refresh_speaker_combo()
    
    def _create_live_status(self):
        status_frame = ttk.Frame(self.live_frame)
        status_frame.pack(fill=tk.X)
        
        left_status = ttk.Frame(status_frame)
        left_status.pack(side=tk.LEFT)
        
        self.stuck_count_label = ttk.Label(left_status, text="卡词: 0", style='Stuck.TLabel')
        self.stuck_count_label.pack(side=tk.LEFT, padx=10)
        
        self.mistranslation_count_label = ttk.Label(left_status, text="误译: 0", style='Mistranslation.TLabel')
        self.mistranslation_count_label.pack(side=tk.LEFT, padx=10)
        
        self.confirmed_count_label = ttk.Label(left_status, text="已确认: 0", style='Confirmed.TLabel')
        self.confirmed_count_label.pack(side=tk.LEFT, padx=10)
        
        right_status = ttk.Frame(status_frame)
        right_status.pack(side=tk.RIGHT)
        
        self.timer_label = ttk.Label(right_status, text="--:--:--", style='Timer.TLabel')
        self.timer_label.pack()
    
    def _setup_live_shortcuts(self):
        self.bind('<F1>', lambda e: self._mark_stuck())
        self.bind('<F2>', lambda e: self._mark_mistranslation())
        self.bind('<F3>', lambda e: self._mark_confirmed())
        self.bind('<Left>', lambda e: self._prev_card())
        self.bind('<Right>', lambda e: self._next_card())
    
    def _update_live_display(self):
        self._update_mark_counts()
        self._update_card_display()
        self._refresh_agenda_list()
        self._refresh_speaker_combo()
    
    def _update_mark_counts(self):
        if not self.current_project:
            return
        
        stuck_count = len([m for m in self.current_project.marks if m.mark_type == MarkType.STUCK])
        mistranslation_count = len([m for m in self.current_project.marks if m.mark_type == MarkType.MISTRANSLATION])
        confirmed_count = len([m for m in self.current_project.marks if m.mark_type == MarkType.CONFIRMED])
        
        self.stuck_count_label.config(text=f"卡词: {stuck_count}")
        self.mistranslation_count_label.config(text=f"误译: {mistranslation_count}")
        self.confirmed_count_label.config(text=f"已确认: {confirmed_count}")
    
    def _update_card_display(self):
        if not self.flashcard_manager:
            return
        
        term = self.flashcard_manager.get_current_term()
        progress = self.flashcard_manager.get_card_progress()
        
        if term:
            self.term_cn_label.config(text=term.chinese)
            self.term_en_label.config(text=term.english)
            info_parts = []
            if term.category:
                info_parts.append(f"分类: {term.category}")
            if term.difficulty:
                info_parts.append(f"难度: {'★' * term.difficulty}")
            if term.notes:
                info_parts.append(f"备注: {term.notes}")
            self.term_info_label.config(text=" | ".join(info_parts))
        else:
            self.term_cn_label.config(text="暂无术语")
            self.term_en_label.config(text="请先导入术语表")
            self.term_info_label.config(text="")
        
        self.card_progress_label.config(text=f"{progress['current']}/{progress['total']}")
    
    def _next_card(self):
        if self.flashcard_manager:
            self.flashcard_manager.next_card()
            self._update_card_display()
    
    def _prev_card(self):
        if self.flashcard_manager:
            self.flashcard_manager.previous_card()
            self._update_card_display()
    
    def _shuffle_cards(self):
        if self.flashcard_manager:
            self.flashcard_manager.shuffle_cards()
            self._update_card_display()
            messagebox.showinfo("洗牌完成", "术语闪卡已随机洗牌")
    
    def _search_terms(self):
        if not self.flashcard_manager:
            return
        
        query = self.search_entry.get().strip()
        if not query:
            return
        
        results = self.flashcard_manager.search_terms(query)
        if results:
            result_text = "\n".join([f"{t.chinese} - {t.english}" for t in results[:10]])
            if len(results) > 10:
                result_text += f"\n... 还有 {len(results) - 10} 个结果"
            messagebox.showinfo(f"搜索结果 ({len(results)}个)", result_text)
        else:
            messagebox.showinfo("搜索结果", "未找到匹配的术语")
    
    def _refresh_agenda_list(self):
        if not self.current_project:
            return
        
        for item in self.agenda_tree.get_children():
            self.agenda_tree.delete(item)
        
        now = datetime.now().time()
        
        for item in self.current_project.agenda:
            time_str = f"{item.start_time.strftime('%H:%M')} - {item.end_time.strftime('%H:%M')}"
            
            tag = 'future'
            if item.start_time <= now <= item.end_time:
                tag = 'current'
            elif now > item.end_time:
                tag = 'past'
            
            self.agenda_tree.insert('', tk.END, values=(
                time_str,
                item.title,
                item.speaker or "-"
            ), tags=(tag,))
        
        self.agenda_tree.tag_configure('current', background='#e8f5e9')
        self.agenda_tree.tag_configure('past', foreground='gray')
    
    def _refresh_speaker_combo(self):
        if not self.current_project:
            return
        
        speakers = [""] + self.current_project.get_unique_speakers()
        self.speaker_combo['values'] = speakers
        if speakers:
            self.speaker_combo.current(0)
    
    def _create_mark(self, mark_type: MarkType) -> Mark:
        now = datetime.now()
        
        current_agenda = None
        if self.scheduler:
            current_agenda = self.scheduler.get_current_agenda_item()
        
        selected_speaker = self.speaker_combo.get() or None
        
        current_term = None
        if self.flashcard_manager:
            current_term = self.flashcard_manager.get_current_term()
        
        quick_term = self.quick_term_entry.get().strip()
        
        mark = Mark(
            id=str(uuid4()),
            mark_type=mark_type,
            timestamp=now,
            term_id=current_term.id if current_term else None,
            term_text=quick_term or (current_term.chinese if current_term else None),
            agenda_item_id=current_agenda.id if current_agenda else None,
            agenda_item_title=current_agenda.title if current_agenda else None,
            speaker=selected_speaker,
            notes="",
            correction=""
        )
        
        return mark
    
    def _mark_stuck(self):
        if not self.current_project:
            return
        
        mark = self._create_mark(MarkType.STUCK)
        self.current_project.add_mark(mark)
        self.quicksave.mark_dirty(self.current_project)
        
        self._update_mark_counts()
        self.quick_term_entry.delete(0, tk.END)
        
        self._show_mark_toast("卡词", mark)
    
    def _mark_mistranslation(self):
        if not self.current_project:
            return
        
        mark = self._create_mark(MarkType.MISTRANSLATION)
        
        correction = simpledialog.askstring("记录误译", "请输入正确译法 (可选):")
        if correction:
            mark.correction = correction
        
        self.current_project.add_mark(mark)
        self.quicksave.mark_dirty(self.current_project)
        
        self._update_mark_counts()
        self.quick_term_entry.delete(0, tk.END)
        
        self._show_mark_toast("误译", mark)
    
    def _mark_confirmed(self):
        if not self.current_project:
            return
        
        mark = self._create_mark(MarkType.CONFIRMED)
        self.current_project.add_mark(mark)
        self.quicksave.mark_dirty(self.current_project)
        
        self._update_mark_counts()
        self.quick_term_entry.delete(0, tk.END)
        
        self._show_mark_toast("已确认", mark)
    
    def _quick_mark_stuck(self):
        if self.quick_term_entry.get().strip():
            self._mark_stuck()
    
    def _show_mark_toast(self, mark_type: str, mark: Mark):
        toast = tk.Toplevel(self)
        toast.overrideredirect(True)
        toast.attributes('-topmost', True)
        
        colors = {
            "卡词": "#dc3545",
            "误译": "#ffc107",
            "已确认": "#28a745"
        }
        
        bg_color = colors.get(mark_type, "#6c757d")
        
        frame = tk.Frame(toast, bg=bg_color, padx=20, pady=10)
        frame.pack()
        
        tk.Label(frame, text=f"✓ {mark_type}", bg=bg_color, fg='white', font=('Microsoft YaHei UI', 12, 'bold')).pack()
        if mark.term_text:
            tk.Label(frame, text=mark.term_text, bg=bg_color, fg='white', font=('Microsoft YaHei UI', 10)).pack()
        
        toast.update()
        x = self.winfo_x() + (self.winfo_width() - toast.winfo_width()) // 2
        y = self.winfo_y() + 100
        toast.geometry(f"+{x}+{y}")
        
        toast.after(1500, toast.destroy)
    
    def _on_reminder(self, reminder: Reminder):
        self.after(0, lambda: self._show_reminder_popup(reminder))
    
    def _show_reminder_popup(self, reminder: Reminder):
        if reminder.reminder_type == ReminderType.AGENDA_START:
            title = "议程开始"
            message = f"议程即将开始:\n{reminder.agenda_item_title}"
        elif reminder.reminder_type == ReminderType.AGENDA_END:
            title = "议程结束"
            message = f"当前议程即将结束:\n{reminder.agenda_item_title}"
        elif reminder.reminder_type == ReminderType.TERM_REMINDER:
            title = "术语提醒"
            message = f"相关术语:\n{reminder.term_text}"
        else:
            title = "提醒"
            message = reminder.message
        
        popup = tk.Toplevel(self)
        popup.title(title)
        popup.geometry("400x150")
        popup.attributes('-topmost', True)
        
        frame = ttk.Frame(popup, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text=title, style='Header.TLabel').pack(pady=5)
        ttk.Label(frame, text=message).pack(pady=10)
        
        ttk.Button(frame, text="知道了", command=popup.destroy).pack(pady=10)
    
    def _on_agenda_change(self, old_item: Optional[AgendaItem], new_item: Optional[AgendaItem]):
        self.after(0, lambda: self._update_current_agenda(new_item))
    
    def _update_current_agenda(self, item: Optional[AgendaItem]):
        if item:
            self.current_agenda_label.config(text=f"当前: {item.title}")
            if item.speaker and self.speaker_combo['values']:
                speakers = list(self.speaker_combo['values'])
                if item.speaker in speakers:
                    self.speaker_combo.current(speakers.index(item.speaker))
        else:
            self.current_agenda_label.config(text="当前: 无")
        
        self._refresh_agenda_list()
    
    def _on_time_update(self, now: datetime):
        self.after(0, lambda: self._update_live_time(now))
    
    def _update_live_time(self, now: datetime):
        self.timer_label.config(text=now.strftime("%H:%M:%S"))
        
        if self.scheduler:
            progress = self.scheduler.get_agenda_progress()
            self.agenda_progress_var.set(progress['progress_percent'])
            self.agenda_progress_label.config(text=f"进度: {progress['progress_percent']:.1f}% ({progress['completed_items']}/{progress['total_items']})")
    
    def _show_review_mode(self):
        if not self.current_project:
            messagebox.showwarning("警告", "请先打开或创建项目")
            return
        
        self._clear_main_container()
        
        self.review_frame = ttk.Frame(self.main_container)
        self.review_frame.pack(fill=tk.BOTH, expand=True)
        
        self._create_review_toolbar()
        self._create_review_content()
        
        self._refresh_review_data()
    
    def _create_review_toolbar(self):
        toolbar = ttk.Frame(self.review_frame)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(toolbar, text=f"复盘分析 - {self.current_project.name}", style='Header.TLabel').pack(side=tk.LEFT)
        
        btn_frame = ttk.Frame(toolbar)
        btn_frame.pack(side=tk.RIGHT)
        
        ttk.Button(btn_frame, text="返回现场模式", command=self._show_live_mode).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="保存项目", command=self._save_project).pack(side=tk.LEFT, padx=5)
    
    def _create_review_content(self):
        content_paned = ttk.PanedWindow(self.review_frame, orient=tk.VERTICAL)
        content_paned.pack(fill=tk.BOTH, expand=True)
        
        top_frame = ttk.Frame(content_paned)
        content_paned.add(top_frame, weight=1)
        
        bottom_frame = ttk.Frame(content_paned)
        content_paned.add(bottom_frame, weight=1)
        
        self._create_review_filters(top_frame)
        self._create_review_marks_list(top_frame)
        self._create_review_statistics(bottom_frame)
        self._create_review_exports(bottom_frame)
    
    def _create_review_filters(self, parent):
        filter_frame = ttk.LabelFrame(parent, text="筛选条件", padding=10)
        filter_frame.pack(fill=tk.X, pady=(0, 10))
        
        filter_grid = ttk.Frame(filter_frame)
        filter_grid.pack(fill=tk.X)
        
        ttk.Label(filter_grid, text="嘉宾:").grid(row=0, column=0, padx=5, pady=5)
        self.review_speaker_combo = ttk.Combobox(filter_grid, width=15, state='readonly')
        self.review_speaker_combo.grid(row=0, column=1, padx=5, pady=5)
        
        ttk.Label(filter_grid, text="主题:").grid(row=0, column=2, padx=5, pady=5)
        self.review_topic_combo = ttk.Combobox(filter_grid, width=20, state='readonly')
        self.review_topic_combo.grid(row=0, column=3, padx=5, pady=5)
        
        ttk.Label(filter_grid, text="标记类型:").grid(row=0, column=4, padx=5, pady=5)
        self.review_type_combo = ttk.Combobox(filter_grid, width=12, state='readonly')
        self.review_type_combo['values'] = ["全部", "卡词", "误译", "已确认"]
        self.review_type_combo.current(0)
        self.review_type_combo.grid(row=0, column=5, padx=5, pady=5)
        
        ttk.Button(filter_grid, text="应用筛选", command=self._apply_filters).grid(row=0, column=6, padx=20, pady=5)
        ttk.Button(filter_grid, text="重置", command=self._reset_filters).grid(row=0, column=7, padx=5, pady=5)
        
        speakers = ["全部"] + self.current_project.get_unique_speakers()
        self.review_speaker_combo['values'] = speakers
        self.review_speaker_combo.current(0)
        
        topics = ["全部"] + self.current_project.get_unique_topics()
        self.review_topic_combo['values'] = topics
        self.review_topic_combo.current(0)
    
    def _create_review_marks_list(self, parent):
        marks_frame = ttk.LabelFrame(parent, text="标记记录", padding=10)
        marks_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ('time', 'type', 'term', 'speaker', 'agenda', 'correction', 'notes')
        self.review_tree = ttk.Treeview(marks_frame, columns=columns, show='headings', height=10)
        
        self.review_tree.heading('time', text='时间')
        self.review_tree.heading('type', text='类型')
        self.review_tree.heading('term', text='术语')
        self.review_tree.heading('speaker', text='嘉宾')
        self.review_tree.heading('agenda', text='议程')
        self.review_tree.heading('correction', text='正确译法')
        self.review_tree.heading('notes', text='备注')
        
        self.review_tree.column('time', width=140)
        self.review_tree.column('type', width=70)
        self.review_tree.column('term', width=150)
        self.review_tree.column('speaker', width=80)
        self.review_tree.column('agenda', width=150)
        self.review_tree.column('correction', width=100)
        self.review_tree.column('notes', width=150)
        
        scrollbar = ttk.Scrollbar(marks_frame, orient=tk.VERTICAL, command=self.review_tree.yview)
        self.review_tree.configure(yscrollcommand=scrollbar.set)
        
        self.review_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        btn_frame = ttk.Frame(marks_frame)
        btn_frame.pack(fill=tk.X, pady=(5, 0))
        
        ttk.Button(btn_frame, text="编辑选中", command=self._edit_mark).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="删除选中", command=self._delete_mark, style='Danger.TButton').pack(side=tk.LEFT, padx=5)
    
    def _create_review_statistics(self, parent):
        stats_frame = ttk.LabelFrame(parent, text="统计分析", padding=10)
        stats_frame.pack(fill=tk.BOTH, expand=True)
        
        stats_paned = ttk.PanedWindow(stats_frame, orient=tk.HORIZONTAL)
        stats_paned.pack(fill=tk.BOTH, expand=True)
        
        summary_frame = ttk.Frame(stats_paned)
        stats_paned.add(summary_frame, weight=1)
        
        self.stats_text = tk.Text(summary_frame, height=12, width=40, font=('Consolas', 10))
        self.stats_text.pack(fill=tk.BOTH, expand=True)
        
        freq_frame = ttk.Frame(stats_paned)
        stats_paned.add(freq_frame, weight=1)
        
        ttk.Label(freq_frame, text="高频问题术语", style='Header.TLabel').pack(anchor=tk.W)
        
        columns = ('term', 'count')
        self.freq_tree = ttk.Treeview(freq_frame, columns=columns, show='headings', height=8)
        self.freq_tree.heading('term', text='术语')
        self.freq_tree.heading('count', text='出现次数')
        self.freq_tree.column('term', width=200)
        self.freq_tree.column('count', width=80, anchor=tk.CENTER)
        self.freq_tree.pack(fill=tk.BOTH, expand=True)
    
    def _create_review_exports(self, parent):
        export_frame = ttk.LabelFrame(parent, text="导出", padding=10)
        export_frame.pack(fill=tk.X, pady=(10, 0))
        
        export_grid = ttk.Frame(export_frame)
        export_grid.pack(fill=tk.X)
        
        ttk.Label(export_grid, text="导出格式:").grid(row=0, column=0, padx=5, pady=5)
        
        ttk.Button(export_grid, text="Markdown 复盘报告", command=self._export_markdown, style='Accent.TButton').grid(row=0, column=1, padx=10, pady=5)
        ttk.Button(export_grid, text="CSV 错词清单", command=self._export_error_csv).grid(row=0, column=2, padx=10, pady=5)
        ttk.Button(export_grid, text="JSON 审计包", command=self._export_audit_json).grid(row=0, column=3, padx=10, pady=5)
        
        ttk.Label(export_grid, text="提示: 导出内容将应用当前筛选条件", foreground='gray').grid(row=0, column=4, padx=20, pady=5)
    
    def _apply_filters(self):
        self._refresh_review_data()
    
    def _reset_filters(self):
        self.review_speaker_combo.current(0)
        self.review_topic_combo.current(0)
        self.review_type_combo.current(0)
        self._refresh_review_data()
    
    def _get_filtered_marks(self) -> List[Mark]:
        if not self.current_project:
            return []
        
        marks = self.current_project.marks
        
        speaker = self.review_speaker_combo.get()
        if speaker and speaker != "全部":
            marks = [m for m in marks if m.speaker == speaker]
        
        topic = self.review_topic_combo.get()
        if topic and topic != "全部":
            marks = [m for m in marks if m.agenda_item_title and topic in m.agenda_item_title]
        
        mark_type = self.review_type_combo.get()
        if mark_type == "卡词":
            marks = [m for m in marks if m.mark_type == MarkType.STUCK]
        elif mark_type == "误译":
            marks = [m for m in marks if m.mark_type == MarkType.MISTRANSLATION]
        elif mark_type == "已确认":
            marks = [m for m in marks if m.mark_type == MarkType.CONFIRMED]
        
        return marks
    
    def _refresh_review_data(self):
        if not self.current_project:
            return
        
        marks = self._get_filtered_marks()
        
        for item in self.review_tree.get_children():
            self.review_tree.delete(item)
        
        type_labels = {
            MarkType.STUCK: "卡词",
            MarkType.MISTRANSLATION: "误译",
            MarkType.CONFIRMED: "已确认"
        }
        
        type_tags = {
            MarkType.STUCK: "stuck",
            MarkType.MISTRANSLATION: "mistranslation",
            MarkType.CONFIRMED: "confirmed"
        }
        
        for mark in marks:
            self.review_tree.insert('', tk.END, iid=mark.id, values=(
                mark.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                type_labels.get(mark.mark_type, "未知"),
                mark.term_text or "-",
                mark.speaker or "-",
                mark.agenda_item_title or "-",
                mark.correction or "-",
                mark.notes or "-"
            ), tags=(type_tags.get(mark.mark_type, ""),))
        
        self.review_tree.tag_configure('stuck', foreground='#dc3545')
        self.review_tree.tag_configure('mistranslation', foreground='#ffc107')
        self.review_tree.tag_configure('confirmed', foreground='#28a745')
        
        self._update_statistics()
        self._update_frequent_terms()
    
    def _update_statistics(self):
        self.stats_text.delete(1.0, tk.END)
        
        if not self.current_project:
            return
        
        marks = self._get_filtered_marks()
        
        total_count = len(marks)
        stuck_count = len([m for m in marks if m.mark_type == MarkType.STUCK])
        mistranslation_count = len([m for m in marks if m.mark_type == MarkType.MISTRANSLATION])
        confirmed_count = len([m for m in marks if m.mark_type == MarkType.CONFIRMED])
        
        stats = f"""会议复盘统计
{'=' * 40}

项目名称: {self.current_project.name}
会议日期: {self.current_project.created_at.strftime('%Y-%m-%d')}

总标记数: {total_count}
  ├─ 卡词次数: {stuck_count}
  ├─ 误译次数: {mistranslation_count}
  └─ 已确认: {confirmed_count}

术语总数: {len(self.current_project.terms)}
议程项数: {len(self.current_project.agenda)}
"""
        
        if total_count > 0:
            speaker_stats = {}
            for mark in marks:
                if mark.speaker:
                    if mark.speaker not in speaker_stats:
                        speaker_stats[mark.speaker] = {"total": 0, "stuck": 0, "mistranslation": 0}
                    speaker_stats[mark.speaker]["total"] += 1
                    if mark.mark_type == MarkType.STUCK:
                        speaker_stats[mark.speaker]["stuck"] += 1
                    elif mark.mark_type == MarkType.MISTRANSLATION:
                        speaker_stats[mark.speaker]["mistranslation"] += 1
            
            if speaker_stats:
                stats += "\n按嘉宾统计:\n"
                for speaker, data in sorted(speaker_stats.items(), key=lambda x: x[1]["total"], reverse=True):
                    stats += f"  {speaker}: 总计{data['total']}次 (卡词{data['stuck']}, 误译{data['mistranslation']})\n"
        
        self.stats_text.insert(tk.END, stats)
    
    def _update_frequent_terms(self):
        for item in self.freq_tree.get_children():
            self.freq_tree.delete(item)
        
        if not self.current_project:
            return
        
        marks = self._get_filtered_marks()
        
        from collections import Counter
        term_counter = Counter()
        
        for mark in marks:
            if mark.term_text and mark.mark_type in [MarkType.STUCK, MarkType.MISTRANSLATION]:
                term_counter[mark.term_text] += 1
        
        for term, count in term_counter.most_common(20):
            self.freq_tree.insert('', tk.END, values=(term, count))
    
    def _edit_mark(self):
        selection = self.review_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要编辑的标记")
            return
        
        mark_id = selection[0]
        mark = None
        for m in self.current_project.marks:
            if m.id == mark_id:
                mark = m
                break
        
        if not mark:
            return
        
        edit_window = tk.Toplevel(self)
        edit_window.title("编辑标记")
        edit_window.geometry("400x300")
        
        frame = ttk.Frame(edit_window, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="术语:").grid(row=0, column=0, sticky=tk.W, pady=5)
        term_entry = ttk.Entry(frame, width=40)
        term_entry.insert(0, mark.term_text or "")
        term_entry.grid(row=0, column=1, pady=5)
        
        ttk.Label(frame, text="正确译法:").grid(row=1, column=0, sticky=tk.W, pady=5)
        correction_entry = ttk.Entry(frame, width=40)
        correction_entry.insert(0, mark.correction or "")
        correction_entry.grid(row=1, column=1, pady=5)
        
        ttk.Label(frame, text="备注:").grid(row=2, column=0, sticky=tk.NW, pady=5)
        notes_text = tk.Text(frame, width=40, height=5)
        notes_text.insert(tk.END, mark.notes or "")
        notes_text.grid(row=2, column=1, pady=5)
        
        def save_changes():
            mark.term_text = term_entry.get().strip()
            mark.correction = correction_entry.get().strip()
            mark.notes = notes_text.get(1.0, tk.END).strip()
            self.quicksave.mark_dirty(self.current_project)
            self._refresh_review_data()
            edit_window.destroy()
        
        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=3, column=0, columnspan=2, pady=20)
        
        ttk.Button(btn_frame, text="保存", command=save_changes, style='Accent.TButton').pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=edit_window.destroy).pack(side=tk.LEFT, padx=10)
    
    def _delete_mark(self):
        selection = self.review_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要删除的标记")
            return
        
        if not messagebox.askyesno("确认删除", "确定要删除选中的标记吗？"):
            return
        
        mark_id = selection[0]
        self.current_project.marks = [m for m in self.current_project.marks if m.id != mark_id]
        self.quicksave.mark_dirty(self.current_project)
        
        self._refresh_review_data()
        self._update_live_display()
    
    def _export_markdown(self):
        if not self.current_project:
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 Markdown 复盘报告",
            defaultextension=".md",
            initialfile=f"{self.current_project.name}_复盘报告.md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        speaker = self.review_speaker_combo.get()
        topic = self.review_topic_combo.get()
        
        filter_speaker = speaker if speaker != "全部" else None
        filter_topic = topic if topic != "全部" else None
        
        exporter = ExportManager(self.current_project)
        if exporter.export_markdown(file_path, filter_speaker=filter_speaker, filter_topic=filter_topic):
            messagebox.showinfo("导出成功", f"复盘报告已导出到:\n{file_path}")
        else:
            messagebox.showerror("导出失败", "无法导出文件")
    
    def _export_error_csv(self):
        if not self.current_project:
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 CSV 错词清单",
            defaultextension=".csv",
            initialfile=f"{self.current_project.name}_错词清单.csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        speaker = self.review_speaker_combo.get()
        topic = self.review_topic_combo.get()
        
        filter_speaker = speaker if speaker != "全部" else None
        filter_topic = topic if topic != "全部" else None
        
        exporter = ExportManager(self.current_project)
        if exporter.export_error_terms_csv(file_path, filter_speaker=filter_speaker, filter_topic=filter_topic):
            messagebox.showinfo("导出成功", f"错词清单已导出到:\n{file_path}")
        else:
            messagebox.showerror("导出失败", "无法导出文件")
    
    def _export_audit_json(self):
        if not self.current_project:
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 JSON 审计包",
            defaultextension=".json",
            initialfile=f"{self.current_project.name}_审计包.json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        exporter = ExportManager(self.current_project)
        if exporter.export_audit_json(file_path):
            messagebox.showinfo("导出成功", f"审计包已导出到:\n{file_path}")
        else:
            messagebox.showerror("导出失败", "无法导出文件")
    
    def _show_shortcuts(self):
        shortcuts = """快捷键说明:

全局:
  Ctrl+N  新建项目
  Ctrl+O  打开项目
  Ctrl+S  保存项目

现场模式:
  F1      标记卡词
  F2      标记误译
  F3      标记已确认
  ←       上一张闪卡
  →       下一张闪卡
  Enter   在快速标记框中回车卡词
"""
        messagebox.showinfo("快捷键说明", shortcuts)
    
    def _show_about(self):
        about = """术语闪卡时间轴 v1.0

专为同传志愿者设计的本地桌面工具

功能:
- 导入并校验术语表、议程、嘉宾名单
- 按议程时间生成提醒卡片
- 现场模式支持快捷键标记
- 复盘页面支持多维度筛选
- 支持 Markdown/CSV/JSON 导出

数据本地存储，保护隐私安全。
"""
        messagebox.showinfo("关于", about)
    
    def _start_auto_save_timer(self):
        self._auto_save_timer()
    
    def _auto_save_timer(self):
        if self.current_project:
            self.quicksave.auto_save_if_needed()
        
        self.after(10000, self._auto_save_timer)
    
    def _on_close(self):
        if self.scheduler:
            self.scheduler.stop()
        
        if self.quicksave._pending_project:
            if messagebox.askyesno("未保存的更改", "您有未保存的更改，是否保存？"):
                self._save_project()
        
        self.destroy()


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
