import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from database import Device, Contract, PhotoRecord
import io


def parse_date(date_str):
    if pd.isna(date_str) or date_str == '':
        return None
    if isinstance(date_str, datetime):
        return date_str.date()
    if isinstance(date_str, pd.Timestamp):
        return date_str.date()
    try:
        return datetime.strptime(str(date_str), '%Y-%m-%d').date()
    except:
        try:
            return datetime.strptime(str(date_str), '%Y/%m/%d').date()
        except:
            return None


def import_devices_from_excel(db: Session, file_content: bytes):
    df = pd.read_excel(io.BytesIO(file_content))
    
    imported_count = 0
    for _, row in df.iterrows():
        device_code = str(row.get('设备编号', row.get('device_code', ''))).strip()
        if not device_code:
            continue
            
        existing = db.query(Device).filter(Device.device_code == device_code).first()
        
        device_data = {
            'device_code': device_code,
            'device_type': str(row.get('设备类型', row.get('device_type', ''))).strip(),
            'device_name': str(row.get('设备名称', row.get('device_name', ''))).strip(),
            'floor': str(row.get('楼层', row.get('floor', ''))).strip(),
            'area': str(row.get('区域', row.get('area', ''))).strip(),
            'location': str(row.get('位置', row.get('location', ''))).strip(),
            'install_date': parse_date(row.get('安装日期', row.get('install_date'))),
            'last_maintenance_date': parse_date(row.get('上次维保日期', row.get('last_maintenance_date'))),
            'next_maintenance_date': parse_date(row.get('下次维保日期', row.get('next_maintenance_date'))),
            'status': str(row.get('状态', row.get('status', 'normal'))).strip(),
        }
        
        if existing:
            for key, value in device_data.items():
                setattr(existing, key, value)
        else:
            device = Device(**device_data)
            db.add(device)
        
        imported_count += 1
    
    db.commit()
    return {'imported': imported_count}


def import_contracts_from_excel(db: Session, file_content: bytes):
    df = pd.read_excel(io.BytesIO(file_content))
    
    imported_count = 0
    for _, row in df.iterrows():
        contract_code = str(row.get('合同编号', row.get('contract_code', ''))).strip()
        if not contract_code:
            continue
            
        existing = db.query(Contract).filter(Contract.contract_code == contract_code).first()
        
        contract_data = {
            'contract_code': contract_code,
            'contract_name': str(row.get('合同名称', row.get('contract_name', ''))).strip(),
            'device_code': str(row.get('设备编号', row.get('device_code', ''))).strip(),
            'vendor': str(row.get('供应商', row.get('vendor', ''))).strip(),
            'start_date': parse_date(row.get('开始日期', row.get('start_date'))),
            'end_date': parse_date(row.get('结束日期', row.get('end_date'))),
            'maintenance_cycle': int(row.get('维保周期(月)', row.get('maintenance_cycle', 12)) or 12),
            'amount': float(row.get('金额', row.get('amount', 0)) or 0),
            'status': str(row.get('状态', row.get('status', 'active'))).strip(),
        }
        
        if existing:
            for key, value in contract_data.items():
                setattr(existing, key, value)
        else:
            contract = Contract(**contract_data)
            db.add(contract)
        
        imported_count += 1
    
    db.commit()
    return {'imported': imported_count}


def import_photos_from_excel(db: Session, file_content: bytes):
    df = pd.read_excel(io.BytesIO(file_content))
    
    imported_count = 0
    for _, row in df.iterrows():
        photo_code = str(row.get('照片编号', row.get('photo_code', ''))).strip()
        if not photo_code:
            continue
            
        existing = db.query(PhotoRecord).filter(PhotoRecord.photo_code == photo_code).first()
        
        photo_data = {
            'photo_code': photo_code,
            'device_code': str(row.get('设备编号', row.get('device_code', ''))).strip(),
            'photo_name': str(row.get('照片名称', row.get('photo_name', ''))).strip(),
            'upload_date': parse_date(row.get('上传日期', row.get('upload_date'))),
            'uploader': str(row.get('上传人', row.get('uploader', ''))).strip(),
            'file_path': str(row.get('文件路径', row.get('file_path', ''))).strip(),
        }
        
        if existing:
            for key, value in photo_data.items():
                setattr(existing, key, value)
        else:
            photo = PhotoRecord(**photo_data)
            db.add(photo)
        
        imported_count += 1
    
    db.commit()
    return {'imported': imported_count}


def generate_sample_excel_files():
    devices_data = [
        {'设备编号': 'DEV001', '设备类型': '灭火器', '设备名称': '干粉灭火器', '楼层': '1F', '区域': '大堂', '位置': '正门左侧', '安装日期': '2023-01-15', '上次维保日期': '2024-01-10', '下次维保日期': '2025-01-10'},
        {'设备编号': 'DEV002', '设备类型': '灭火器', '设备名称': '干粉灭火器', '楼层': '1F', '区域': '大堂', '位置': '电梯口', '安装日期': '2023-01-15', '上次维保日期': '2023-07-10', '下次维保日期': '2024-01-10'},
        {'设备编号': 'DEV003', '设备类型': '喷淋', '设备名称': '消防喷淋头', '楼层': '2F', '区域': '办公区A', '位置': '走廊', '安装日期': '2022-06-20', '上次维保日期': '2024-03-15', '下次维保日期': '2024-09-15'},
        {'设备编号': 'DEV004', '设备类型': '喷淋', '设备名称': '消防喷淋头', '楼层': '2F', '区域': '办公区B', '位置': '会议室旁', '安装日期': '2022-06-20', '上次维保日期': '2024-02-20', '下次维保日期': '2024-08-20'},
        {'设备编号': 'DEV005', '设备类型': '报警主机', '设备名称': '火灾报警控制器', '楼层': '1F', '区域': '监控室', '位置': '控制台', '安装日期': '2021-11-01', '上次维保日期': '2024-04-01', '下次维保日期': '2024-10-01'},
        {'设备编号': 'DEV006', '设备类型': '灭火器', '设备名称': '二氧化碳灭火器', '楼层': '3F', '区域': '机房', '位置': '服务器旁', '安装日期': '2023-03-10', '上次维保日期': '2023-09-05', '下次维保日期': '2024-03-05'},
        {'设备编号': 'DEV007', '设备类型': '灭火器', '设备名称': '干粉灭火器', '楼层': 'B1', '区域': '停车场', '位置': '入口处', '安装日期': '2023-02-28', '上次维保日期': '2024-02-20', '下次维保日期': '2025-02-20'},
        {'设备编号': 'DEV008', '设备类型': '报警主机', '设备名称': '消防联动控制柜', '楼层': '1F', '区域': '监控室', '位置': '控制台', '安装日期': '2021-11-01', '上次维保日期': '2023-10-01', '下次维保日期': '2024-04-01'},
    ]
    
    contracts_data = [
        {'合同编号': 'CT2024001', '合同名称': '灭火器维保合同A', '设备编号': 'DEV001', '供应商': '安消科技', '开始日期': '2024-01-01', '结束日期': '2025-01-01', '维保周期(月)': 12, '金额': 5000},
        {'合同编号': 'CT2024002', '合同名称': '灭火器维保合同B', '设备编号': 'DEV002', '供应商': '安消科技', '开始日期': '2023-07-01', '结束日期': '2024-07-01', '维保周期(月)': 6, '金额': 3000},
        {'合同编号': 'CT2024003', '合同名称': '喷淋系统维保', '设备编号': 'DEV003', '供应商': '恒安消防', '开始日期': '2024-01-01', '结束日期': '2025-01-01', '维保周期(月)': 6, '金额': 8000},
        {'合同编号': 'CT2024004', '合同名称': '喷淋系统维保', '设备编号': 'DEV004', '供应商': '恒安消防', '开始日期': '2024-01-01', '结束日期': '2025-01-01', '维保周期(月)': 6, '金额': 8000},
        {'合同编号': 'CT2024005', '合同名称': '报警主机维保', '设备编号': 'DEV005', '供应商': '赛科电子', '开始日期': '2024-01-01', '结束日期': '2025-01-01', '维保周期(月)': 6, '金额': 12000},
        {'合同编号': 'CT2024006', '合同名称': '机房消防维保', '设备编号': 'DEV006', '供应商': '安消科技', '开始日期': '2023-09-01', '结束日期': '2024-09-01', '维保周期(月)': 6, '金额': 6000},
        {'合同编号': 'CT2024007', '合同名称': '灭火器维保合同C', '设备编号': 'DEV001', '供应商': '永安消防', '开始日期': '2024-06-01', '结束日期': '2025-06-01', '维保周期(月)': 12, '金额': 4800},
        {'合同编号': 'CT2024008', '合同名称': '报警主机维保', '设备编号': 'DEV008', '供应商': '赛科电子', '开始日期': '2023-10-01', '结束日期': '2024-10-01', '维保周期(月)': 6, '金额': 12000},
    ]
    
    photos_data = [
        {'照片编号': 'P001', '设备编号': 'DEV001', '照片名称': 'DEV001_20240110.jpg', '上传日期': '2024-01-10', '上传人': '张三', '文件路径': '/photos/DEV001/'},
        {'照片编号': 'P002', '设备编号': 'DEV003', '照片名称': 'DEV003_20240315.jpg', '上传日期': '2024-03-15', '上传人': '李四', '文件路径': '/photos/DEV003/'},
        {'照片编号': 'P003', '设备编号': 'DEV004', '照片名称': 'DEV004_20240220.jpg', '上传日期': '2024-02-20', '上传人': '李四', '文件路径': '/photos/DEV004/'},
        {'照片编号': 'P004', '设备编号': 'DEV005', '照片名称': 'DEV005_20240401.jpg', '上传日期': '2024-04-01', '上传人': '王五', '文件路径': '/photos/DEV005/'},
        {'照片编号': 'P005', '设备编号': 'DEV007', '照片名称': 'DEV007_20240220.jpg', '上传日期': '2024-02-20', '上传人': '张三', '文件路径': '/photos/DEV007/'},
    ]
    
    pd.DataFrame(devices_data).to_excel('sample_devices.xlsx', index=False)
    pd.DataFrame(contracts_data).to_excel('sample_contracts.xlsx', index=False)
    pd.DataFrame(photos_data).to_excel('sample_photos.xlsx', index=False)
    
    return {'devices': 'sample_devices.xlsx', 'contracts': 'sample_contracts.xlsx', 'photos': 'sample_photos.xlsx'}
