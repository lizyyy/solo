import csv
import json
import os
from datetime import datetime
from app.models.plate_model import PlateModel
from app.models.acid_bath_model import AcidBathModel
from app.models.color_separation_model import ColorSeparationModel
from app.models.test_print_model import TestPrintModel
from app.models.appointment_model import AppointmentModel


class ImportService:
    @staticmethod
    def import_plate_inventory_from_csv(file_path):
        plates = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                plate = {
                    'plate_number': row.get('版号', row.get('plate_number', '')).strip(),
                    'student_name': row.get('学生姓名', row.get('student_name', '')).strip(),
                    'plate_type': row.get('版材类型', row.get('plate_type', '')).strip(),
                    'plate_size': row.get('版材尺寸', row.get('plate_size', '')).strip(),
                    'estimated_etching_time': ImportService._parse_int(
                        row.get('预估蚀刻时间(分钟)', row.get('estimated_etching_time'))
                    )
                }
                if plate['plate_number']:
                    plates.append(plate)
        
        if plates:
            PlateModel.bulk_insert(plates)
        return len(plates)

    @staticmethod
    def import_acid_bath_from_csv(file_path):
        records = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = {
                    'bath_number': row.get('酸槽编号', row.get('bath_number', '')).strip(),
                    'concentration': ImportService._parse_float(
                        row.get('浓度(%)', row.get('concentration'))
                    ),
                    'temperature': ImportService._parse_float(
                        row.get('温度(℃)', row.get('temperature'))
                    ),
                    'ventilation_status': row.get('通风状态', row.get('ventilation_status', '')).strip(),
                    'record_time': ImportService._parse_datetime(
                        row.get('记录时间', row.get('record_time'))
                    )
                }
                if record['bath_number']:
                    records.append(record)
        
        if records:
            AcidBathModel.bulk_insert(records)
        return len(records)

    @staticmethod
    def import_color_separation_from_json(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        separations = []
        if isinstance(data, list):
            for item in data:
                separation = ImportService._parse_color_separation_item(item)
                if separation:
                    separations.append(separation)
        elif isinstance(data, dict):
            for plate_number, colors in data.items():
                if isinstance(colors, list):
                    for color_item in colors:
                        separation = ImportService._parse_color_separation_item(color_item)
                        if separation:
                            if not separation.get('plate_number'):
                                separation['plate_number'] = plate_number
                            separations.append(separation)
        
        if separations:
            ColorSeparationModel.bulk_insert(separations)
        return len(separations)

    @staticmethod
    def _parse_color_separation_item(item):
        if not isinstance(item, dict):
            return None
        
        return {
            'plate_number': item.get('版号', item.get('plate_number', '')).strip(),
            'color_name': item.get('颜色名称', item.get('color_name', '')).strip(),
            'color_order': ImportService._parse_int(
                item.get('套色顺序', item.get('color_order'))
            ),
            'etching_depth': ImportService._parse_float(
                item.get('蚀刻深度', item.get('etching_depth'))
            ),
            'notes': item.get('备注', item.get('notes', '')).strip()
        }

    @staticmethod
    def import_test_print_photos(photo_paths, plate_number, notes_list=None):
        photos = []
        for i, photo_path in enumerate(photo_paths):
            if os.path.exists(photo_path):
                photo = {
                    'plate_number': plate_number.strip(),
                    'photo_path': photo_path,
                    'notes': notes_list[i] if notes_list and i < len(notes_list) else '',
                    'print_order': i + 1
                }
                photos.append(photo)
        
        if photos:
            TestPrintModel.bulk_insert(photos)
        return len(photos)

    @staticmethod
    def import_appointments_from_csv(file_path):
        appointments = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                appointment = {
                    'plate_number': row.get('版号', row.get('plate_number', '')).strip(),
                    'student_name': row.get('学生姓名', row.get('student_name', '')).strip(),
                    'appointment_date': row.get('预约日期', row.get('appointment_date', '')).strip(),
                    'start_time': row.get('开始时间', row.get('start_time', '')).strip(),
                    'end_time': row.get('结束时间', row.get('end_time', '')).strip(),
                    'bath_number': row.get('酸槽编号', row.get('bath_number', '')).strip(),
                    'notes': row.get('备注', row.get('notes', '')).strip()
                }
                if appointment['plate_number']:
                    appointments.append(appointment)
        
        if appointments:
            AppointmentModel.bulk_insert(appointments)
        return len(appointments)

    @staticmethod
    def _parse_int(value):
        if value is None or value == '':
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_float(value):
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_datetime(value):
        if value is None or value == '':
            return None
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d'
        ]
        for fmt in formats:
            try:
                return datetime.strptime(str(value).strip(), fmt).strftime('%Y-%m-%d %H:%M:%S')
            except (ValueError, TypeError):
                continue
        return None
