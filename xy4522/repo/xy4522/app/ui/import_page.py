import flet as ft
from app.services.import_service import ImportService
from app.models.plate_model import PlateModel
from app.models.acid_bath_model import AcidBathModel
from app.models.appointment_model import AppointmentModel
from app.models.color_separation_model import ColorSeparationModel
from app.models.test_print_model import TestPrintModel


class ImportPage:
    def __init__(self, page: ft.Page, on_page_change):
        self.page = page
        self.on_page_change = on_page_change
        self.status_message = ft.Text('', color=ft.colors.GREEN)
        self.plate_count = ft.Text('0')
        self.bath_count = ft.Text('0')
        self.appointment_count = ft.Text('0')
        self.separation_count = ft.Text('0')
        self.photo_count = ft.Text('0')

    def build(self):
        self._update_counts()
        
        title = ft.Text('数据导入', size=24, weight=ft.FontWeight.BOLD)
        subtitle = ft.Text('导入版画工作室所需的各类数据文件', size=14, color=ft.colors.GREY_600)
        
        stats_card = ft.Card(
            content=ft.Container(
                content=ft.Column([
                    ft.Text('当前数据统计', size=16, weight=ft.FontWeight.BOLD),
                    ft.Divider(),
                    ft.Row([
                        ft.Column([ft.Text('版材数量'), self.plate_count], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                        ft.VerticalDivider(),
                        ft.Column([ft.Text('酸槽记录'), self.bath_count], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                        ft.VerticalDivider(),
                        ft.Column([ft.Text('预约记录'), self.appointment_count], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                        ft.VerticalDivider(),
                        ft.Column([ft.Text('套色信息'), self.separation_count], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                        ft.VerticalDivider(),
                        ft.Column([ft.Text('试印照片'), self.photo_count], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                    ], alignment=ft.MainAxisAlignment.SPACE_EVENLY),
                ]),
                padding=20,
            ),
            elevation=2,
        )
        
        plate_picker = ft.FilePicker(on_result=self._on_plate_file_selected)
        bath_picker = ft.FilePicker(on_result=self._on_bath_file_selected)
        color_picker = ft.FilePicker(on_result=self._on_color_file_selected)
        photo_picker = ft.FilePicker(on_result=self._on_photo_file_selected)
        appointment_picker = ft.FilePicker(on_result=self._on_appointment_file_selected)
        
        self.page.overlay.extend([plate_picker, bath_picker, color_picker, photo_picker, appointment_picker])
        
        import_cards = ft.Column([
            self._create_import_card(
                '版材清单 CSV',
                '导入包含版号、学生姓名、版材类型、尺寸、预估蚀刻时间的CSV文件',
                ft.icons.INVENTORY_2,
                lambda _: plate_picker.pick_files(allow_multiple=False, allowed_extensions=['csv'])
            ),
            self._create_import_card(
                '酸槽浓度/温度记录 CSV',
                '导入包含酸槽编号、浓度、温度、通风状态的CSV文件',
                ft.icons.SCIENCE,
                lambda _: bath_picker.pick_files(allow_multiple=False, allowed_extensions=['csv'])
            ),
            self._create_import_card(
                '草图套色 JSON',
                '导入包含套色顺序、颜色名称、蚀刻深度的JSON文件',
                ft.icons.PALETTE,
                lambda _: color_picker.pick_files(allow_multiple=False, allowed_extensions=['json'])
            ),
            self._create_import_card(
                '试印照片',
                '选择试印照片（仅保存路径引用）',
                ft.icons.IMAGE,
                lambda _: photo_picker.pick_files(allow_multiple=True, allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'bmp'])
            ),
            self._create_import_card(
                '学生预约表 CSV',
                '导入包含版号、预约日期、时间、酸槽编号的CSV文件',
                ft.icons.CALENDAR_MONTH,
                lambda _: appointment_picker.pick_files(allow_multiple=False, allowed_extensions=['csv'])
            ),
        ], spacing=15)
        
        status_bar = ft.Container(
            content=ft.Row([
                self.status_message,
            ], alignment=ft.MainAxisAlignment.CENTER),
            padding=ft.padding.symmetric(vertical=10),
        )
        
        next_button = ft.ElevatedButton(
            '前往版号复核',
            icon=ft.icons.ARROW_FORWARD,
            on_click=lambda _: self.on_page_change('review'),
            style=ft.ButtonStyle(
                color=ft.colors.WHITE,
                bgcolor=ft.colors.BLUE_600,
            )
        )
        
        return ft.Column([
            title,
            subtitle,
            ft.Divider(),
            stats_card,
            ft.Divider(),
            ft.Text('导入数据文件', size=18, weight=ft.FontWeight.BOLD),
            import_cards,
            status_bar,
            ft.Divider(),
            ft.Row([next_button], alignment=ft.MainAxisAlignment.END),
        ], spacing=20, scroll=ft.ScrollMode.AUTO)

    def _create_import_card(self, title, description, icon, on_click):
        return ft.Card(
            content=ft.Container(
                content=ft.Row([
                    ft.Icon(icon, size=40, color=ft.colors.BLUE_600),
                    ft.Column([
                        ft.Text(title, size=16, weight=ft.FontWeight.BOLD),
                        ft.Text(description, size=12, color=ft.colors.GREY_600),
                    ], expand=True),
                    ft.ElevatedButton('选择文件', on_click=on_click),
                ]),
                padding=20,
            ),
            elevation=2,
        )

    def _update_counts(self):
        plates = PlateModel.get_all()
        baths = AcidBathModel.get_all()
        appointments = AppointmentModel.get_all()
        separations = ColorSeparationModel.get_all()
        photos = TestPrintModel.get_all()
        
        self.plate_count.value = str(len(plates))
        self.bath_count.value = str(len(baths))
        self.appointment_count.value = str(len(appointments))
        self.separation_count.value = str(len(separations))
        self.photo_count.value = str(len(photos))

    def _show_status(self, message, is_error=False):
        self.status_message.value = message
        self.status_message.color = ft.colors.RED if is_error else ft.colors.GREEN
        self._update_counts()
        self.page.update()

    def _on_plate_file_selected(self, e: ft.FilePickerResultEvent):
        if not e.files:
            return
        try:
            count = ImportService.import_plate_inventory_from_csv(e.files[0].path)
            self._show_status(f'成功导入 {count} 条版材记录')
        except Exception as ex:
            self._show_status(f'导入失败: {str(ex)}', is_error=True)

    def _on_bath_file_selected(self, e: ft.FilePickerResultEvent):
        if not e.files:
            return
        try:
            count = ImportService.import_acid_bath_from_csv(e.files[0].path)
            self._show_status(f'成功导入 {count} 条酸槽记录')
        except Exception as ex:
            self._show_status(f'导入失败: {str(ex)}', is_error=True)

    def _on_color_file_selected(self, e: ft.FilePickerResultEvent):
        if not e.files:
            return
        try:
            count = ImportService.import_color_separation_from_json(e.files[0].path)
            self._show_status(f'成功导入 {count} 条套色记录')
        except Exception as ex:
            self._show_status(f'导入失败: {str(ex)}', is_error=True)

    def _on_photo_file_selected(self, e: ft.FilePickerResultEvent):
        if not e.files:
            return
        
        def on_dialog_close(e):
            if e.control.text == '确认导入':
                plate_number = plate_input.value.strip()
                if not plate_number:
                    self._show_status('请输入版号', is_error=True)
                    return
                try:
                    paths = [f.path for f in e.files] if hasattr(e, 'files') else []
                    if not paths:
                        paths = [f.path for f in photo_files]
                    count = ImportService.import_test_print_photos(paths, plate_number)
                    self._show_status(f'成功导入 {count} 张试印照片')
                except Exception as ex:
                    self._show_status(f'导入失败: {str(ex)}', is_error=True)
            self.page.dialog.open = False
            self.page.update()
        
        photo_files = e.files
        plate_input = ft.TextField(
            label='版号',
            hint_text='请输入这些照片对应的版号',
            expand=True
        )
        
        dialog = ft.AlertDialog(
            title=ft.Text('输入版号'),
            content=ft.Column([
                ft.Text(f'已选择 {len(e.files)} 张照片，请输入对应的版号：'),
                plate_input,
            ], tight=True),
            actions=[
                ft.TextButton('取消', on_click=on_dialog_close),
                ft.TextButton('确认导入', on_click=on_dialog_close),
            ],
            actions_alignment=ft.MainAxisAlignment.END,
        )
        
        self.page.dialog = dialog
        dialog.open = True
        self.page.update()

    def _on_appointment_file_selected(self, e: ft.FilePickerResultEvent):
        if not e.files:
            return
        try:
            count = ImportService.import_appointments_from_csv(e.files[0].path)
            self._show_status(f'成功导入 {count} 条预约记录')
        except Exception as ex:
            self._show_status(f'导入失败: {str(ex)}', is_error=True)
