import flet as ft
import os
from datetime import datetime
from app.services.export_service import ExportService
from app.models.plate_model import PlateModel
from app.models.review_model import ReviewIssueModel, ManualDecisionModel


class ExportPage:
    def __init__(self, page: ft.Page, on_page_change):
        self.page = page
        self.on_page_change = on_page_change
        self.status_message = ft.Text('', color=ft.colors.GREEN)
        self.stats_text = ft.Text('')

    def build(self):
        self._load_stats()
        
        title = ft.Text('导出报表', size=24, weight=ft.FontWeight.BOLD)
        subtitle = ft.Text('导出开工清单和审计明细', size=14, color=ft.colors.GREY_600)
        
        stats_card = ft.Card(
            content=ft.Container(
                content=ft.Row([
                    ft.Icon(ft.icons.SUMMARIZE, size=30, color=ft.colors.BLUE_600),
                    self.stats_text,
                ]),
                padding=20,
            ),
            elevation=2,
        )
        
        markdown_picker = ft.FilePicker(on_result=self._on_markdown_save)
        json_picker = ft.FilePicker(on_result=self._on_json_save)
        
        self.page.overlay.extend([markdown_picker, json_picker])
        
        export_cards = ft.Column([
            self._create_export_card(
                'Markdown 开工清单',
                '导出包含酸槽状态、版材信息、问题列表、处理备注的完整开工清单',
                ft.icons.FILE_PRESENT,
                ft.colors.BLUE_600,
                lambda _: markdown_picker.save_file(
                    allowed_extensions=['md'],
                    file_name=f'铜版蚀刻开工清单_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
                )
            ),
            self._create_export_card(
                'JSON 审计明细',
                '导出完整的审计数据，包括所有版材信息、问题记录、改判历史和统计信息',
                ft.icons.DATA_OBJECT,
                ft.colors.GREEN_600,
                lambda _: json_picker.save_file(
                    allowed_extensions=['json'],
                    file_name=f'铜版蚀刻审计明细_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                )
            ),
        ], spacing=20)
        
        back_button = ft.ElevatedButton(
            '返回版号复核',
            icon=ft.icons.ARROW_BACK,
            on_click=lambda _: self.on_page_change('review'),
        )
        
        return ft.Column([
            title,
            subtitle,
            ft.Divider(),
            stats_card,
            ft.Divider(),
            ft.Text('导出选项', size=18, weight=ft.FontWeight.BOLD),
            export_cards,
            self.status_message,
            ft.Divider(),
            ft.Row([back_button], alignment=ft.MainAxisAlignment.START),
        ], spacing=20, scroll=ft.ScrollMode.AUTO)

    def _create_export_card(self, title, description, icon, color, on_click):
        return ft.Card(
            content=ft.Container(
                content=ft.Row([
                    ft.Container(
                        content=ft.Icon(icon, size=40, color=ft.colors.WHITE),
                        bgcolor=color,
                        padding=15,
                        border_radius=10,
                    ),
                    ft.Column([
                        ft.Text(title, size=16, weight=ft.FontWeight.BOLD),
                        ft.Text(description, size=12, color=ft.colors.GREY_600),
                    ], expand=True),
                    ft.ElevatedButton(
                        '导出',
                        icon=ft.icons.DOWNLOAD,
                        on_click=on_click,
                        style=ft.ButtonStyle(
                            color=ft.colors.WHITE,
                            bgcolor=color,
                        )
                    ),
                ]),
                padding=20,
            ),
            elevation=2,
        )

    def _load_stats(self):
        plates = PlateModel.get_all()
        issues = ReviewIssueModel.get_all()
        decisions = ManualDecisionModel.get_all()
        
        resolved_issue_ids = set(d['issue_id'] for d in decisions if d['issue_id'])
        unresolved_issues = [i for i in issues if i['id'] not in resolved_issue_ids]
        
        self.stats_text.value = f'待导出版材: {len(plates)} | 问题总数: {len(issues)} | 已处理: {len(resolved_issue_ids)} | 待处理: {len(unresolved_issues)}'
        self.stats_text.size = 14

    def _show_status(self, message, is_error=False):
        self.status_message.value = message
        self.status_message.color = ft.colors.RED if is_error else ft.colors.GREEN
        self.page.update()

    def _on_markdown_save(self, e: ft.FilePickerResultEvent):
        if not e.path:
            return
        
        try:
            count = ExportService.export_markdown_checklist(e.path)
            self._show_status(f'成功导出 Markdown 开工清单，包含 {count} 块版材')
        except Exception as ex:
            self._show_status(f'导出失败: {str(ex)}', is_error=True)

    def _on_json_save(self, e: ft.FilePickerResultEvent):
        if not e.path:
            return
        
        try:
            count = ExportService.export_json_audit(e.path)
            self._show_status(f'成功导出 JSON 审计明细，包含 {count} 块版材')
        except Exception as ex:
            self._show_status(f'导出失败: {str(ex)}', is_error=True)
