import flet as ft
from app.ui.main_window import MainWindow
from app.database.init_db import init_database


def main(page: ft.Page):
    page.title = "铜版蚀刻复核工具 - 版画工作室"
    page.theme_mode = ft.ThemeMode.LIGHT
    page.window.width = 1200
    page.window.height = 800
    page.window.min_width = 1000
    page.window.min_height = 600
    page.padding = 0
    page.spacing = 0

    init_database()

    main_window = MainWindow(page)
    page.add(main_window.build())


if __name__ == "__main__":
    ft.app(target=main)
