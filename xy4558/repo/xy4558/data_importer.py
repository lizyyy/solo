#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站数据导入器
"""

import csv
import json
from typing import Dict, Any, List, Optional
from models import (
    DataStore, Deceased, Cabinet, TransportOrder, 
    TemperatureRecord, FarewellBooking, CremationSchedule, Document
)


class DataImporter:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
    
    def import_csv(self, file_path: str) -> None:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if not rows:
            return
        
        first_row = rows[0]
        
        if self._is_deceased_data(first_row):
            self._import_deceased_from_rows(rows)
        elif self._is_cabinet_data(first_row):
            self._import_cabinet_from_rows(rows)
        elif self._is_transport_data(first_row):
            self._import_transport_from_rows(rows)
        elif self._is_temperature_data(first_row):
            self._import_temperature_from_rows(rows)
        elif self._is_farewell_booking_data(first_row):
            self._import_farewell_booking_from_rows(rows)
        elif self._is_cremation_schedule_data(first_row):
            self._import_cremation_schedule_from_rows(rows)
        elif self._is_document_data(first_row):
            self._import_document_from_rows(rows)
        else:
            raise ValueError(f"无法识别的CSV数据格式: {list(first_row.keys())}")
    
    def import_json(self, file_path: str) -> None:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'deceased' in data:
            for deceased_data in data['deceased']:
                self._import_single_deceased(deceased_data)
        
        if 'cabinets' in data:
            for cabinet_data in data['cabinets']:
                self._import_single_cabinet(cabinet_data)
        
        if 'transport_orders' in data:
            for order_data in data['transport_orders']:
                self._import_single_transport(order_data)
        
        if 'temperature_records' in data:
            for record_data in data['temperature_records']:
                self._import_single_temperature(record_data)
        
        if 'farewell_bookings' in data:
            for booking_data in data['farewell_bookings']:
                self._import_single_farewell_booking(booking_data)
        
        if 'cremation_schedules' in data:
            for schedule_data in data['cremation_schedules']:
                self._import_single_cremation_schedule(schedule_data)
        
        if 'documents' in data:
            for doc_data in data['documents']:
                self._import_single_document(doc_data)
        
        if not any([
            'deceased' in data, 'cabinets' in data, 'transport_orders' in data,
            'temperature_records' in data, 'farewell_bookings' in data,
            'cremation_schedules' in data, 'documents' in data
        ]):
            if self._is_single_deceased(data):
                self._import_single_deceased(data)
            elif self._is_single_cabinet(data):
                self._import_single_cabinet(data)
            elif self._is_single_transport(data):
                self._import_single_transport(data)
            elif self._is_single_temperature(data):
                self._import_single_temperature(data)
            elif self._is_single_farewell_booking(data):
                self._import_single_farewell_booking(data)
            elif self._is_single_cremation_schedule(data):
                self._import_single_cremation_schedule(data)
            elif self._is_single_document(data):
                self._import_single_document(data)
            else:
                raise ValueError(f"无法识别的JSON数据格式")
    
    def _is_deceased_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        deceased_keys = {'name', 'gender', 'age', 'id_card', 'date_of_death'}
        return deceased_keys.issubset(keys) or 'deceased_id' in keys or '逝者姓名' in row
    
    def _is_cabinet_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        cabinet_keys = {'cabinet_id', 'status', 'min_temp', 'max_temp'}
        return cabinet_keys.issubset(keys) or '柜位编号' in row or 'cabinet id' in keys
    
    def _is_transport_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        transport_keys = {'order_id', 'pickup_location', 'pickup_time', 'transport_person'}
        return transport_keys.issubset(keys) or '接运单编号' in row or 'transport order' in keys
    
    def _is_temperature_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        temp_keys = {'record_id', 'cabinet_id', 'temperature', 'record_time'}
        return temp_keys.issubset(keys) or '温度记录' in row or 'temperature' in keys
    
    def _is_farewell_booking_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        booking_keys = {'booking_id', 'hall_id', 'date', 'start_time', 'end_time'}
        return booking_keys.issubset(keys) or '告别厅' in row or 'farewell hall' in keys
    
    def _is_cremation_schedule_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        schedule_keys = {'schedule_id', 'furnace_id', 'date', 'start_time', 'end_time'}
        return schedule_keys.issubset(keys) or '火化炉' in row or 'cremation' in keys
    
    def _is_document_data(self, row: Dict[str, str]) -> bool:
        keys = set(k.lower().strip() for k in row.keys())
        doc_keys = {'doc_id', 'doc_type', 'doc_name', 'status'}
        return doc_keys.issubset(keys) or '证件' in row or 'document' in keys
    
    def _is_single_deceased(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        deceased_keys = {'name', 'gender', 'age', 'id_card', 'date_of_death'}
        return deceased_keys.issubset(keys)
    
    def _is_single_cabinet(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        cabinet_keys = {'cabinet_id', 'status', 'min_temp', 'max_temp'}
        return cabinet_keys.issubset(keys)
    
    def _is_single_transport(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        transport_keys = {'order_id', 'pickup_location', 'pickup_time', 'transport_person'}
        return transport_keys.issubset(keys)
    
    def _is_single_temperature(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        temp_keys = {'record_id', 'cabinet_id', 'temperature', 'record_time'}
        return temp_keys.issubset(keys)
    
    def _is_single_farewell_booking(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        booking_keys = {'booking_id', 'hall_id', 'date', 'start_time', 'end_time'}
        return booking_keys.issubset(keys)
    
    def _is_single_cremation_schedule(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        schedule_keys = {'schedule_id', 'furnace_id', 'date', 'start_time', 'end_time'}
        return schedule_keys.issubset(keys)
    
    def _is_single_document(self, data: Dict[str, Any]) -> bool:
        keys = set(k.lower() for k in data.keys())
        doc_keys = {'doc_id', 'doc_type', 'doc_name', 'status'}
        return doc_keys.issubset(keys)
    
    def _import_deceased_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            deceased_data = self._normalize_row_keys(row)
            self._import_single_deceased(deceased_data)
    
    def _import_single_deceased(self, data: Dict[str, Any]) -> None:
        deceased = Deceased(
            deceased_id=str(data.get('deceased_id', '') or data.get('id', '')),
            name=str(data.get('name', '') or data.get('逝者姓名', '')),
            gender=str(data.get('gender', '') or data.get('性别', '')),
            age=int(data.get('age', 0) or data.get('年龄', 0)),
            id_card=str(data.get('id_card', '') or data.get('身份证号', '')),
            date_of_death=str(data.get('date_of_death', '') or data.get('死亡日期', '')),
            cause_of_death=str(data.get('cause_of_death', '') or data.get('死亡原因', '')),
            contact_person=str(data.get('contact_person', '') or data.get('联系人', '')),
            contact_phone=str(data.get('contact_phone', '') or data.get('联系电话', '')),
            cabinet_id=str(data.get('cabinet_id', '') or data.get('柜位编号', '') or None)
        )
        self.data_store.add_deceased(deceased)
    
    def _import_cabinet_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            cabinet_data = self._normalize_row_keys(row)
            self._import_single_cabinet(cabinet_data)
    
    def _import_single_cabinet(self, data: Dict[str, Any]) -> None:
        cabinet = Cabinet(
            cabinet_id=str(data.get('cabinet_id', '') or data.get('柜位编号', '')),
            location=str(data.get('location', '') or data.get('位置', '')),
            status=str(data.get('status', '') or data.get('状态', '空')),
            current_deceased_id=str(data.get('current_deceased_id', '') or None),
            min_temp=float(data.get('min_temp', -18.0) or data.get('最低温度', -18.0)),
            max_temp=float(data.get('max_temp', -15.0) or data.get('最高温度', -15.0))
        )
        self.data_store.add_cabinet(cabinet)
    
    def _import_transport_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            transport_data = self._normalize_row_keys(row)
            self._import_single_transport(transport_data)
    
    def _import_single_transport(self, data: Dict[str, Any]) -> None:
        order = TransportOrder(
            order_id=str(data.get('order_id', '') or data.get('接运单编号', '')),
            deceased_id=str(data.get('deceased_id', '') or data.get('逝者编号', '')),
            deceased_name=str(data.get('deceased_name', '') or data.get('逝者姓名', '')),
            pickup_location=str(data.get('pickup_location', '') or data.get('接运地点', '')),
            pickup_time=str(data.get('pickup_time', '') or data.get('接运时间', '')),
            transport_person=str(data.get('transport_person', '') or data.get('接运人员', '')),
            transport_phone=str(data.get('transport_phone', '') or data.get('接运电话', '')),
            received_by=str(data.get('received_by', '') or data.get('接收人', '') or None),
            received_time=str(data.get('received_time', '') or data.get('接收时间', '') or None),
            signature_status=str(data.get('signature_status', '') or data.get('签收状态', '未签收')),
            notes=str(data.get('notes', '') or data.get('备注', '') or None)
        )
        self.data_store.add_transport_order(order)
    
    def _import_temperature_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            temp_data = self._normalize_row_keys(row)
            self._import_single_temperature(temp_data)
    
    def _import_single_temperature(self, data: Dict[str, Any]) -> None:
        record = TemperatureRecord(
            record_id=str(data.get('record_id', '') or data.get('记录编号', '')),
            cabinet_id=str(data.get('cabinet_id', '') or data.get('柜位编号', '')),
            temperature=float(data.get('temperature', 0.0) or data.get('温度', 0.0)),
            record_time=str(data.get('record_time', '') or data.get('记录时间', '')),
            recorded_by=str(data.get('recorded_by', '') or data.get('记录人', '')),
            status=str(data.get('status', '') or data.get('状态', '正常'))
        )
        self.data_store.add_temperature_record(record)
    
    def _import_farewell_booking_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            booking_data = self._normalize_row_keys(row)
            self._import_single_farewell_booking(booking_data)
    
    def _import_single_farewell_booking(self, data: Dict[str, Any]) -> None:
        booking = FarewellBooking(
            booking_id=str(data.get('booking_id', '') or data.get('预约编号', '')),
            deceased_id=str(data.get('deceased_id', '') or data.get('逝者编号', '')),
            deceased_name=str(data.get('deceased_name', '') or data.get('逝者姓名', '')),
            hall_id=str(data.get('hall_id', '') or data.get('告别厅编号', '')),
            date=str(data.get('date', '') or data.get('日期', '')),
            start_time=str(data.get('start_time', '') or data.get('开始时间', '')),
            end_time=str(data.get('end_time', '') or data.get('结束时间', '')),
            booked_by=str(data.get('booked_by', '') or data.get('预约人', '')),
            contact_phone=str(data.get('contact_phone', '') or data.get('联系电话', '')),
            status=str(data.get('status', '') or data.get('状态', '已预约')),
            notes=str(data.get('notes', '') or data.get('备注', '') or None)
        )
        self.data_store.add_farewell_booking(booking)
    
    def _import_cremation_schedule_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            schedule_data = self._normalize_row_keys(row)
            self._import_single_cremation_schedule(schedule_data)
    
    def _import_single_cremation_schedule(self, data: Dict[str, Any]) -> None:
        schedule = CremationSchedule(
            schedule_id=str(data.get('schedule_id', '') or data.get('排期编号', '')),
            deceased_id=str(data.get('deceased_id', '') or data.get('逝者编号', '')),
            deceased_name=str(data.get('deceased_name', '') or data.get('逝者姓名', '')),
            furnace_id=str(data.get('furnace_id', '') or data.get('火化炉编号', '')),
            date=str(data.get('date', '') or data.get('日期', '')),
            start_time=str(data.get('start_time', '') or data.get('开始时间', '')),
            end_time=str(data.get('end_time', '') or data.get('结束时间', '')),
            scheduled_by=str(data.get('scheduled_by', '') or data.get('排期人', '')),
            status=str(data.get('status', '') or data.get('状态', '已排期')),
            notes=str(data.get('notes', '') or data.get('备注', '') or None)
        )
        self.data_store.add_cremation_schedule(schedule)
    
    def _import_document_from_rows(self, rows: List[Dict[str, str]]) -> None:
        for row in rows:
            doc_data = self._normalize_row_keys(row)
            self._import_single_document(doc_data)
    
    def _import_single_document(self, data: Dict[str, Any]) -> None:
        doc = Document(
            doc_id=str(data.get('doc_id', '') or data.get('证件编号', '')),
            deceased_id=str(data.get('deceased_id', '') or data.get('逝者编号', '')),
            deceased_name=str(data.get('deceased_name', '') or data.get('逝者姓名', '')),
            doc_type=str(data.get('doc_type', '') or data.get('证件类型', '')),
            doc_name=str(data.get('doc_name', '') or data.get('证件名称', '')),
            status=str(data.get('status', '') or data.get('状态', '未提交')),
            submitted_date=str(data.get('submitted_date', '') or data.get('提交日期', '') or None),
            notes=str(data.get('notes', '') or data.get('备注', '') or None)
        )
        self.data_store.add_document(doc)
    
    def _normalize_row_keys(self, row: Dict[str, str]) -> Dict[str, str]:
        normalized = {}
        for key, value in row.items():
            normalized_key = key.strip().lower().replace(' ', '_')
            normalized[normalized_key] = value.strip() if isinstance(value, str) else value
        return normalized
