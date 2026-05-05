import flet as ft
from app.ui.import_page import ImportPage
from app.ui.review_page import ReviewPage
from app.ui.export_page import ExportPage


class MainWindow:
    def __init__(self, page: ft.Page):
        self.page = page
        self.current_view = 'import'
        
        self.import_page = ImportPage(page, self.on_page_change)
        self.review_page = ReviewPage(page, self.on_page_change)
        self.export_page = ExportPage(page, self.on_page_change)
        
        self.content_area = ft.Container(
            expand=True,
            padding=ft.padding.all(20),
        )

    def build(self):
        nav_items = [
            ft.NavigationRailDestination(
                icon=ft.icons.UPLOAD_FILE,
                selected_icon=ft.icons.UPLOAD_FILE,
                label='数据导入'
            ),
            ft.NavigationRailDestination(
                icon=ft.icons.CHECKLIST_ROUNDED,
                selected_icon=ft.icons.CHECKLIST_ROUNDED,
                label='版号复核'
            ),
            ft.NavigationRailDestination(
                icon=ft.icons.DOWNLOAD_FOR_OFFLINE,
                selected_icon=ft.icons.DOWNLOAD_FOR_OFFLINE,
                label='导出报表'
            )
        ]
        
        self.nav_rail = ft.NavigationRail(
            selected_index=0,
            label_type=ft.NavigationRailLabelType.ALL,
            min_width=100,
            min_extended_width=200,
            destinations=nav_items,
            on_change=self.on_nav_change,
            bgcolor=ft.colors.BLUE_GREY_50,
        )
        
        self._update_content('import')
        
        return ft.Row(
            [
                self.nav_rail,
                ft.VerticalDivider(width=1),
                self.content_area,
            ],
            expand=True,
        )

    def on_nav_change(self, e):
        index = e.control.selected_index
        views = ['import', 'review', 'export']
        if 0 <= index < len(views):
            self.current_view = views[index]
            self._update_content(self.current_view)

    def on_page_change(self, view_name):
        views = ['import', 'review', 'export']
        if view_name in views:
            index = views.index(view_name)
            self.nav_rail.selected_index = index
            self.current_view = view_name
            self._update_content(view_name)
            self.page.update()

    def _update_content(self, view_name):
        if view_name == 'import':
            content = self.import_page.build()
        elif view_name == 'review':
            content = self.review_page.build()
        elif view_name == 'export':
            content = self.export_page.build()
        else:
            content = ft.Text('页面加载中...')
        
        self.content_area.content = content
        self.page.update()
