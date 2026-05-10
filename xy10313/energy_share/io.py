import csv
import json
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
from .models import (
    House, OccupancyStatus, CommonMeterBill, Reduction,
    RecordStatus
)


class DataImporter:
    """数据导入器"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def _parse_date(self, value):
        if not value or value.strip() == '':
            return None
        formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
        return None
    
    def _parse_float(self, value):
        if value is None or str(value).strip() == '':
            return None
        try:
            return float(str(value).strip())
        except ValueError:
            return None
    
    def _parse_bool(self, value):
        if value is None:
            return False
        v = str(value).strip().lower()
        return v in ['1', 'true', 'yes', '是', '空置', '空', '空房']
    
    def import_houses(self, file_path: str) -> Dict:
        count = 0
        errors = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    room = row.get('room_number', row.get('房号', row.get('house_id')))
                    if not room:
                        errors.append("缺少房号")
                        continue
                    
                    existing = self.session.query(House).filter_by(room_number=room.strip()).first()
                    if existing:
                        existing.owner_name = row.get('owner_name', row.get('业主', existing.owner_name))
                        area = self._parse_float(row.get('area', row.get('面积', existing.area)))
                        if area is not None:
                            existing.area = area
                        count += 1
                    else:
                        house = House(
                            room_number=room.strip(),
                            owner_name=row.get('owner_name', row.get('业主', '')),
                            area=self._parse_float(row.get('area', row.get('面积')))
                        )
                        self.session.add(house)
                        count += 1
                except Exception as e:
                    errors.append(f"房号 {row.get('room_number')}: {str(e)}")
        
        self.session.commit()
        return {"success": count, "errors": errors}
    
    def import_occupancy_status(self, file_path: str) -> Dict:
        count = 0
        errors = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    room = row.get('room_number', row.get('房号'))
                    if not room:
                        errors.append("缺少房号")
                        continue
                    
                    house = self.session.query(House).filter_by(room_number=room.strip()).first()
                    if not house:
                        errors.append(f"房号 {room} 不存在")
                        continue
                    
                    start_date = self._parse_date(row.get('start_date', row.get('开始日期')))
                    if not start_date:
                        errors.append(f"房号 {room} 缺少开始日期")
                        continue
                    
                    is_vacant = self._parse_bool(row.get('is_vacant', row.get('是否空置', 0)))
                    
                    status = OccupancyStatus(
                        house_id=house.id,
                        start_date=start_date,
                        end_date=self._parse_date(row.get('end_date', row.get('结束日期'))),
                        is_vacant=is_vacant,
                        created_by=row.get('created_by', 'import')
                    )
                    self.session.add(status)
                    count += 1
                except Exception as e:
                    errors.append(f"房号 {row.get('room_number')}: {str(e)}")
        
        self.session.commit()
        return {"success": count, "errors": errors}
    
    def import_meter_bill(self, file_path: str) -> Dict:
        count = 0
        errors = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    billing_month = row.get('billing_month', row.get('账单月份'))
                    if not billing_month:
                        errors.append("缺少账单月份")
                        continue
                    
                    existing = self.session.query(CommonMeterBill).filter_by(
                        billing_month=billing_month.strip()
                    ).first()
                    
                    if existing:
                        if existing.record_status == RecordStatus.CONFIRMED.value:
                            errors.append(f"月份 {billing_month} 的账单已确认，不能重复导入")
                            continue
                    
                    electricity_kwh = self._parse_float(row.get('electricity_kwh', row.get('用电量(度)', row.get('电量', 0))))
                    electricity_price = self._parse_float(row.get('electricity_unit_price', row.get('电价', 0.8)))
                    water_tons = self._parse_float(row.get('water_tons', row.get('用水量(吨)', 0)))
                    water_price = self._parse_float(row.get('water_unit_price', row.get('水价', 0)))
                    
                    total_amount = self._parse_float(row.get('total_amount', row.get('总金额')))
                    if total_amount is None:
                        total_amount = (electricity_kwh or 0) * (electricity_price or 0) + \
                                      (water_tons or 0) * (water_price or 0)
                    
                    if existing:
                        existing.electricity_kwh = electricity_kwh
                        existing.electricity_unit_price = electricity_price
                        existing.water_tons = water_tons
                        existing.water_unit_price = water_price
                        existing.total_amount = total_amount
                        existing.meter_reading_start = self._parse_float(row.get('meter_reading_start', row.get('起始读数')))
                        existing.meter_reading_end = self._parse_float(row.get('meter_reading_end', row.get('终止读数')))
                        existing.record_status = RecordStatus.DRAFT.value
                    else:
                        bill = CommonMeterBill(
                            billing_month=billing_month.strip(),
                            electricity_kwh=electricity_kwh or 0,
                            electricity_unit_price=electricity_price or 0,
                            water_tons=water_tons or 0,
                            water_unit_price=water_price or 0,
                            total_amount=total_amount,
                            meter_reading_start=self._parse_float(row.get('meter_reading_start', row.get('起始读数'))),
                            meter_reading_end=self._parse_float(row.get('meter_reading_end', row.get('终止读数'))),
                            record_status=RecordStatus.DRAFT.value
                        )
                        self.session.add(bill)
                    
                    count += 1
                except Exception as e:
                    errors.append(f"月份 {row.get('billing_month')}: {str(e)}")
        
        self.session.commit()
        return {"success": count, "errors": errors}
    
    def import_reductions(self, file_path: str) -> Dict:
        count = 0
        errors = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    room = row.get('room_number', row.get('房号'))
                    if not room:
                        errors.append("缺少房号")
                        continue
                    
                    house = self.session.query(House).filter_by(room_number=room.strip()).first()
                    if not house:
                        errors.append(f"房号 {room} 不存在")
                        continue
                    
                    reduction = Reduction(
                        house_id=house.id,
                        billing_month=row.get('billing_month', row.get('适用月份')),
                        reduction_type=row.get('reduction_type', row.get('减免类型')),
                        reduction_percent=self._parse_float(row.get('reduction_percent', row.get('减免比例(%)'))),
                        reduction_amount=self._parse_float(row.get('reduction_amount', row.get('减免金额'))),
                        reason=row.get('reason', row.get('原因', row.get('备注'))),
                        valid_from=self._parse_date(row.get('valid_from', row.get('生效日期'))),
                        valid_to=self._parse_date(row.get('valid_to', row.get('失效日期'))),
                        created_by=row.get('created_by', 'import')
                    )
                    self.session.add(reduction)
                    count += 1
                except Exception as e:
                    errors.append(f"房号 {row.get('room_number')}: {str(e)}")
        
        self.session.commit()
        return {"success": count, "errors": errors}


class DataExporter:
    """数据导出器"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def export_bill_details(self, billing_month: str, output_path: str):
        from .models import BillDetail, House, CommonMeterBill
        
        bill = self.session.query(CommonMeterBill).filter_by(billing_month=billing_month).first()
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        details = self.session.query(BillDetail).filter_by(billing_month=billing_month).all()
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '房号', '业主姓名', '房屋面积(㎡)', '分摊权重(%)', '是否空置',
                '分摊金额(元)', '减免金额(元)', '最终应缴(元)', '计算说明'
            ])
            
            for detail in details:
                house = self.session.query(House).filter_by(id=detail.house_id).first()
                writer.writerow([
                    house.room_number if house else '',
                    house.owner_name if house else '',
                    f"{detail.area or 0:.2f}",
                    f"{(detail.area_weight or 0) * 100:.4f}",
                    '是' if detail.is_vacant else '否',
                    f"{detail.original_share_amount:.2f}",
                    f"{detail.reduction_amount or 0:.2f}",
                    f"{detail.final_amount:.2f}",
                    detail.calculation_note or ''
                ])
    
    def export_owner_report(self, billing_month: str, output_path: str):
        from .models import BillDetail, House, CommonMeterBill, Reduction
        
        bill = self.session.query(CommonMeterBill).filter_by(billing_month=billing_month).first()
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        details = self.session.query(BillDetail).filter_by(billing_month=billing_month).all()
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            f.write(f"物业公区能耗分摊明细单\n")
            f.write(f"账单月份: {billing_month}\n")
            f.write(f"公区总用电量: {bill.electricity_kwh or 0} 度\n")
            f.write(f"公区总用水量: {bill.water_tons or 0} 吨\n")
            f.write(f"公区总费用: {bill.total_amount:.2f} 元\n")
            f.write(f"账单状态: {bill.record_status}\n\n")
            f.write("=" * 80 + "\n\n")
            
            for detail in details:
                house = self.session.query(House).filter_by(id=detail.house_id).first()
                if house:
                    f.write(f"房号: {house.room_number}\n")
                    f.write(f"业主: {house.owner_name or ''}\n")
                    f.write(f"房屋面积: {house.area or 0:.2f} ㎡\n")
                    f.write(f"空置状态: {'空置' if detail.is_vacant else '正常入住'}\n")
                    f.write(f"分摊权重: {(detail.area_weight or 0) * 100:.4f}%\n")
                    f.write(f"分摊金额: {detail.original_share_amount:.2f} 元\n")
                    if detail.reduction_amount and detail.reduction_amount > 0:
                        f.write(f"减免金额: {detail.reduction_amount:.2f} 元\n")
                    f.write(f"最终应缴: {detail.final_amount:.2f} 元\n")
                    if detail.calculation_note:
                        f.write(f"计算说明:\n")
                        for part in detail.calculation_note.split('；'):
                            f.write(f"  - {part}\n")
                    f.write("-" * 80 + "\n\n")
