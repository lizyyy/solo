import flet as ft
from app.services.review_service import ReviewService
from app.models.plate_model import PlateModel
from app.models.review_model import ReviewIssueModel, ManualDecisionModel, ProcessingNoteModel
from app.models.color_separation_model import ColorSeparationModel
from app.models.appointment_model import AppointmentModel
from app.models.test_print_model import TestPrintModel


class ReviewPage:
    def __init__(self, page: ft.Page, on_page_change):
        self.page = page
        self.on_page_change = on_page_change
        self.plates = []
        self.current_plate_number = None
        self.issues_list = ft.Column(spacing=10, scroll=ft.ScrollMode.AUTO)
        self.notes_list = ft.Column(spacing=10, scroll=ft.ScrollMode.AUTO)
        self.plate_info_card = ft.Container()
        self.status_message = ft.Text('', color=ft.colors.GREEN)
        self.stats_text = ft.Text('')

    def build(self):
        self._load_data()
        
        title = ft.Text('版号复核', size=24, weight=ft.FontWeight.BOLD)
        subtitle = ft.Text('检查每块版的问题，进行人工改判和添加备注', size=14, color=ft.colors.GREY_600)
        
        run_review_btn = ft.ElevatedButton(
            '运行复核检查',
            icon=ft.icons.REFRESH,
            on_click=self._run_review,
            style=ft.ButtonStyle(
                color=ft.colors.WHITE,
                bgcolor=ft.colors.BLUE_600,
            )
        )
        
        stats_card = ft.Card(
            content=ft.Container(
                content=ft.Row([
                    ft.Icon(ft.icons.ANALYTICS, size=30, color=ft.colors.BLUE_600),
                    self.stats_text,
                ]),
                padding=20,
            ),
            elevation=2,
        )
        
        plate_selector = ft.Dropdown(
            label='选择版号',
            hint_text='请选择要复核的版号',
            on_change=self._on_plate_selected,
            expand=True,
        )
        self.plate_selector = plate_selector
        self._update_plate_selector()
        
        left_panel = ft.Column([
            ft.Text('版号列表', size=16, weight=ft.FontWeight.BOLD),
            plate_selector,
            ft.Divider(),
            self.plate_info_card,
        ], spacing=15)
        
        right_panel = ft.Column([
            ft.Text('检测问题', size=16, weight=ft.FontWeight.BOLD),
            self.issues_list,
            ft.Divider(),
            ft.Text('处理备注', size=16, weight=ft.FontWeight.BOLD),
            self._build_notes_section(),
            self.notes_list,
        ], spacing=15, expand=True, scroll=ft.ScrollMode.AUTO)
        
        nav_buttons = ft.Row([
            ft.ElevatedButton(
                '返回数据导入',
                icon=ft.icons.ARROW_BACK,
                on_click=lambda _: self.on_page_change('import'),
            ),
            ft.ElevatedButton(
                '前往导出报表',
                icon=ft.icons.ARROW_FORWARD,
                on_click=lambda _: self.on_page_change('export'),
                style=ft.ButtonStyle(
                    color=ft.colors.WHITE,
                    bgcolor=ft.colors.BLUE_600,
                )
            ),
        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN)
        
        return ft.Column([
            title,
            subtitle,
            ft.Divider(),
            ft.Row([run_review_btn, self.status_message], spacing=20),
            stats_card,
            ft.Divider(),
            ft.Row([
                ft.Container(
                    content=left_panel,
                    width=350,
                ),
                ft.VerticalDivider(),
                ft.Container(
                    content=right_panel,
                    expand=True,
                ),
            ], expand=True),
            ft.Divider(),
            nav_buttons,
        ], spacing=20)

    def _build_notes_section(self):
        self.note_input = ft.TextField(
            label='添加备注',
            hint_text='输入处理备注...',
            multiline=True,
            min_lines=2,
            expand=True,
        )
        
        self.note_type_dropdown = ft.Dropdown(
            label='备注类型',
            options=[
                ft.dropdown.Option('general', '通用备注'),
                ft.dropdown.Option('decision', '改判说明'),
                ft.dropdown.Option('warning', '警告标记'),
                ft.dropdown.Option('info', '补充信息'),
            ],
            value='general',
            width=150,
        )
        
        add_note_btn = ft.ElevatedButton(
            '添加',
            icon=ft.icons.ADD,
            on_click=self._add_note,
        )
        
        return ft.Row([
            self.note_input,
            ft.Column([self.note_type_dropdown, add_note_btn], spacing=10),
        ], spacing=10)

    def _load_data(self):
        self.plates = PlateModel.get_all()
        issues = ReviewIssueModel.get_all()
        decisions = ManualDecisionModel.get_all()
        
        resolved_issue_ids = set(d['issue_id'] for d in decisions if d['issue_id'])
        error_count = sum(1 for i in issues if i['severity'] == 'error' and i['id'] not in resolved_issue_ids)
        warning_count = sum(1 for i in issues if i['severity'] == 'warning' and i['id'] not in resolved_issue_ids)
        resolved_count = len(resolved_issue_ids)
        
        self.stats_text.value = f'版材总数: {len(self.plates)} | 待处理错误: {error_count} | 待处理警告: {warning_count} | 已处理: {resolved_count}'
        self.stats_text.size = 14

    def _update_plate_selector(self):
        if not self.plates:
            self.plate_selector.options = []
            self.plate_selector.value = None
            return
        
        options = []
        for plate in self.plates:
            issues = ReviewIssueModel.get_by_plate_number(plate['plate_number'])
            decisions = ManualDecisionModel.get_by_plate_number(plate['plate_number'])
            resolved_issue_ids = set(d['issue_id'] for d in decisions if d['issue_id'])
            
            has_error = any(i['severity'] == 'error' and i['id'] not in resolved_issue_ids for i in issues)
            has_warning = any(i['severity'] == 'warning' and i['id'] not in resolved_issue_ids for i in issues)
            
            status_icon = '✅'
            if has_error:
                status_icon = '🔴'
            elif has_warning:
                status_icon = '🟡'
            
            label = f"{status_icon} {plate['plate_number']} - {plate['student_name'] or '未命名'}"
            options.append(ft.dropdown.Option(plate['plate_number'], label))
        
        self.plate_selector.options = options
        if options and not self.plate_selector.value:
            self.plate_selector.value = options[0].key

    def _on_plate_selected(self, e):
        self.current_plate_number = e.control.value
        self._update_plate_details()

    def _update_plate_details(self):
        if not self.current_plate_number:
            self.plate_info_card.content = ft.Text('请选择一个版号')
            self.issues_list.controls = []
            self.notes_list.controls = []
            self.page.update()
            return
        
        plate = PlateModel.get_by_plate_number(self.current_plate_number)
        if not plate:
            return
        
        separations = ColorSeparationModel.get_by_plate_number(self.current_plate_number)
        appointments = AppointmentModel.get_by_plate_number(self.current_plate_number)
        photos = TestPrintModel.get_by_plate_number(self.current_plate_number)
        
        info_content = ft.Column([
            ft.Text('基本信息', weight=ft.FontWeight.BOLD),
            ft.Text(f'版号: {plate["plate_number"]}'),
            ft.Text(f'学生: {plate["student_name"] or "-"}'),
            ft.Text(f'类型: {plate["plate_type"] or "-"}'),
            ft.Text(f'尺寸: {plate["plate_size"] or "-"}'),
            ft.Text(f'预估时间: {plate["estimated_etching_time"] or "-"} 分钟'),
            ft.Divider(),
            ft.Text(f'套色层数: {len(separations)}'),
            ft.Text(f'预约记录: {len(appointments)}'),
            ft.Text(f'试印照片: {len(photos)}'),
        ], spacing=5)
        
        self.plate_info_card.content = info_content
        
        self._update_issues_list()
        self._update_notes_list()
        
        self.page.update()

    def _update_issues_list(self):
        issues = ReviewIssueModel.get_by_plate_number(self.current_plate_number)
        decisions = ManualDecisionModel.get_by_plate_number(self.current_plate_number)
        resolved_issue_ids = set(d['issue_id'] for d in decisions if d['issue_id'])
        
        self.issues_list.controls = []
        
        if not issues:
            self.issues_list.controls.append(
                ft.Card(
                    content=ft.Container(
                        content=ft.Row([
                            ft.Icon(ft.icons.CHECK_CIRCLE, color=ft.colors.GREEN, size=30),
                            ft.Text('暂无检测问题', color=ft.colors.GREEN),
                        ]),
                        padding=20,
                    )
                )
            )
            return
        
        for issue in issues:
            is_resolved = issue['id'] in resolved_issue_ids
            severity_color = ft.colors.RED if issue['severity'] == 'error' else ft.colors.ORANGE
            issue_type_name = ReviewService.get_issue_type_name(issue['issue_type'])
            
            decision = next((d for d in decisions if d['issue_id'] == issue['id']), None)
            
            issue_card = ft.Card(
                content=ft.Container(
                    content=ft.Column([
                        ft.Row([
                            ft.Icon(
                                ft.icons.ERROR if issue['severity'] == 'error' else ft.icons.WARNING,
                                color=severity_color,
                                size=24,
                            ),
                            ft.Text(issue_type_name, weight=ft.FontWeight.BOLD, color=severity_color),
                            ft.Container(expand=True),
                            ft.Chip(
                                label=ft.Text('已处理' if is_resolved else '待处理'),
                                bgcolor=ft.colors.GREEN_100 if is_resolved else ft.colors.RED_100,
                                color=ft.colors.GREEN if is_resolved else ft.colors.RED,
                            ),
                        ]),
                        ft.Text(issue['issue_description'], size=12),
                        ft.Divider(),
                        self._build_decision_section(issue, decision, is_resolved),
                    ]),
                    padding=15,
                ),
                elevation=2,
            )
            
            self.issues_list.controls.append(issue_card)

    def _build_decision_section(self, issue, decision, is_resolved):
        if is_resolved and decision:
            return ft.Column([
                ft.Text('改判记录:', size=12, weight=ft.FontWeight.BOLD),
                ft.Text(f'类型: {decision["decision_type"]}', size=12),
                ft.Text(f'原因: {decision["decision_reason"]}', size=12),
                ft.Text(f'处理人: {decision["handler_name"] or "-"}', size=12),
                ft.Text(f'时间: {decision["decision_time"]}', size=12, color=ft.colors.GREY_600),
            ], spacing=3)
        
        decision_type = ft.Dropdown(
            label='改判类型',
            options=[
                ft.dropdown.Option('approve', '通过（风险可控）'),
                ft.dropdown.Option('reject', '驳回（需要修改）'),
                ft.dropdown.Option('postpone', '延期处理'),
            ],
            width=200,
        )
        
        decision_reason = ft.TextField(
            label='改判原因',
            hint_text='请输入改判原因...',
            multiline=True,
            min_lines=2,
            expand=True,
        )
        
        handler_name = ft.TextField(
            label='处理人',
            hint_text='姓名',
            width=150,
        )
        
        def on_submit(e):
            if not decision_type.value or not decision_reason.value.strip():
                self._show_status('请选择改判类型并填写原因', is_error=True)
                return
            
            ManualDecisionModel.create(
                plate_number=self.current_plate_number,
                issue_id=issue['id'],
                decision_type=decision_type.value,
                decision_reason=decision_reason.value.strip(),
                handler_name=handler_name.value.strip() or None,
            )
            
            self._show_status('改判记录已保存')
            self._update_issues_list()
            self._load_data()
            self._update_plate_selector()
        
        submit_btn = ft.ElevatedButton(
            '确认改判',
            icon=ft.icons.CHECK,
            on_click=on_submit,
        )
        
        return ft.Column([
            ft.Row([
                decision_type,
                handler_name,
            ], spacing=10),
            decision_reason,
            ft.Row([submit_btn], alignment=ft.MainAxisAlignment.END),
        ], spacing=10)

    def _update_notes_list(self):
        notes = ProcessingNoteModel.get_by_plate_number(self.current_plate_number)
        self.notes_list.controls = []
        
        if not notes:
            self.notes_list.controls.append(ft.Text('暂无备注', color=ft.colors.GREY_500, size=12))
            return
        
        for note in notes:
            note_type_display = {
                'general': '通用备注',
                'decision': '改判说明',
                'warning': '警告标记',
                'info': '补充信息',
            }.get(note['note_type'], '通用备注')
            
            note_bg = {
                'general': ft.colors.GREY_100,
                'decision': ft.colors.BLUE_50,
                'warning': ft.colors.ORANGE_50,
                'info': ft.colors.GREEN_50,
            }.get(note['note_type'], ft.colors.GREY_100)
            
            note_card = ft.Card(
                content=ft.Container(
                    content=ft.Column([
                        ft.Row([
                            ft.Text(note_type_display, size=12, weight=ft.FontWeight.BOLD),
                            ft.Container(expand=True),
                            ft.Text(note['created_at'], size=10, color=ft.colors.GREY_500),
                            ft.IconButton(
                                icon=ft.icons.DELETE,
                                icon_size=16,
                                tooltip='删除备注',
                                on_click=lambda e, nid=note['id']: self._delete_note(nid),
                            ),
                        ]),
                        ft.Text(note['note_content'], size=12),
                    ]),
                    padding=10,
                    bgcolor=note_bg,
                ),
                elevation=0,
            )
            
            self.notes_list.controls.append(note_card)

    def _add_note(self, e):
        if not self.current_plate_number:
            self._show_status('请先选择一个版号', is_error=True)
            return
        
        content = self.note_input.value.strip()
        if not content:
            self._show_status('请输入备注内容', is_error=True)
            return
        
        ProcessingNoteModel.create(
            plate_number=self.current_plate_number,
            note_content=content,
            note_type=self.note_type_dropdown.value,
        )
        
        self.note_input.value = ''
        self._show_status('备注已添加')
        self._update_notes_list()

    def _delete_note(self, note_id):
        ProcessingNoteModel.delete(note_id)
        self._show_status('备注已删除')
        self._update_notes_list()

    def _run_review(self, e):
        issues = ReviewService.run_full_review()
        self._load_data()
        self._update_plate_selector()
        
        if issues:
            error_count = sum(1 for i in issues if i['severity'] == 'error')
            warning_count = sum(1 for i in issues if i['severity'] == 'warning')
            self._show_status(f'复核完成：发现 {error_count} 个错误，{warning_count} 个警告')
        else:
            self._show_status('复核完成：未发现问题')
        
        if self.current_plate_number:
            self._update_plate_details()

    def _show_status(self, message, is_error=False):
        self.status_message.value = message
        self.status_message.color = ft.colors.RED if is_error else ft.colors.GREEN
        self.page.update()
