import csv
import os
from typing import List, Dict
from models import FoundItem, LostReport, ClaimRecord
from datetime import datetime


class CSVImporter:
    @staticmethod
    def import_found_items(filepath: str) -> List[FoundItem]:
        items = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                item = FoundItem(
                    title=row.get('title', row.get('物品名称', '')),
                    description=row.get('description', row.get('描述', row.get('物品描述', ''))),
                    location=row.get('location', row.get('拾获地点', row.get('地点', ''))),
                    found_date=row.get('found_date', row.get('拾获日期', row.get('日期', ''))),
                    finder=row.get('finder', row.get('拾获人', row.get('登记人', ''))),
                    tags=CSVImporter._parse_tags(row.get('tags', row.get('标签', ''))),
                    status=row.get('status', 'unclaimed'),
                    notes=row.get('notes', row.get('备注', ''))
                )
                items.append(item)
        return items
    
    @staticmethod
    def import_lost_reports(filepath: str) -> List[LostReport]:
        reports = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                report = LostReport(
                    title=row.get('title', row.get('物品名称', '')),
                    description=row.get('description', row.get('描述', row.get('物品描述', ''))),
                    location=row.get('location', row.get('遗失地点', row.get('地点', ''))),
                    lost_date=row.get('lost_date', row.get('遗失日期', row.get('日期', ''))),
                    reporter=row.get('reporter', row.get('报失人', row.get('姓名', ''))),
                    contact=row.get('contact', row.get('联系方式', row.get('电话', ''))),
                    tags=CSVImporter._parse_tags(row.get('tags', row.get('标签', ''))),
                    status=row.get('status', 'active'),
                    notes=row.get('notes', row.get('备注', ''))
                )
                reports.append(report)
        return reports
    
    @staticmethod
    def import_claim_records(filepath: str) -> List[ClaimRecord]:
        records = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = ClaimRecord(
                    item_id=row.get('item_id', row.get('物品ID', '')),
                    report_id=row.get('report_id', row.get('报失单ID', '')),
                    claimant=row.get('claimant', row.get('领取人', row.get('认领人', ''))),
                    claimant_contact=row.get('claimant_contact', row.get('联系方式', '')),
                    claim_date=row.get('claim_date', row.get('认领日期', row.get('日期', datetime.now().isoformat()))),
                    status=row.get('status', 'pending'),
                    notes=row.get('notes', row.get('备注', '')),
                    confirmed_by=row.get('confirmed_by', row.get('确认人', ''))
                )
                records.append(record)
        return records
    
    @staticmethod
    def _parse_tags(tags_str: str) -> List[str]:
        if not tags_str:
            return []
        separators = [',', '，', ';', '；', ' ', '\t']
        for sep in separators:
            if sep in tags_str:
                return [tag.strip() for tag in tags_str.split(sep) if tag.strip()]
        return [tags_str.strip()] if tags_str.strip() else []


class ImageImporter:
    @staticmethod
    def scan_image_directory(directory: str) -> List[Dict]:
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        images = []
        
        if not os.path.exists(directory):
            return images
            
        for filename in os.listdir(directory):
            filepath = os.path.join(directory, filename)
            if os.path.isfile(filepath):
                ext = os.path.splitext(filename)[1].lower()
                if ext in image_extensions:
                    images.append({
                        'filename': filename,
                        'filepath': filepath,
                        'size': os.path.getsize(filepath),
                        'modified_time': os.path.getmtime(filepath)
                    })
        
        return images
    
    @staticmethod
    def group_images_by_filename(images: List[Dict]) -> Dict[str, List[Dict]]:
        groups = {}
        for img in images:
            base_name = ImageImporter._extract_base_name(img['filename'])
            if base_name not in groups:
                groups[base_name] = []
            groups[base_name].append(img)
        return groups
    
    @staticmethod
    def _extract_base_name(filename: str) -> str:
        name, _ = os.path.splitext(filename)
        name = name.lower().strip()
        
        for suffix in ['_1', '_2', '_3', '-1', '-2', '-3', ' (1)', ' (2)', ' (3)']:
            if name.endswith(suffix):
                name = name[:-len(suffix)]
                break
                
        return name.strip()
