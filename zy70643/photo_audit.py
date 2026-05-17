#!/usr/bin/env python3
import os
import re
import json
import hashlib
import argparse
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

PHOTO_TYPES = {
    'before': ['before', '前', '维修前', 'before_repair', 'repair_before'],
    'after': ['after', '后', '维修后', 'after_repair', 'repair_after'],
    'during': ['during', '中', '维修中', 'during_repair', 'repair_during'],
}

REQUIRED_TYPES = ['before', 'after']

class PhotoParser:
    @staticmethod
    def parse_filename(filename: str) -> Dict:
        name, ext = os.path.splitext(filename)
        ext = ext.lower()
        result = {
            'original': filename,
            'ext': ext,
            'customer_id': None,
            'order_id': None,
            'photo_type': None,
            'timestamp': None,
            'is_valid': False
        }
        
        customer_match = re.search(r'(C\d{6})', name, re.IGNORECASE)
        if customer_match:
            result['customer_id'] = customer_match.group(1).upper()
        
        order_match = re.search(r'(WO\d{6})', name, re.IGNORECASE)
        if order_match:
            result['order_id'] = order_match.group(1).upper()
        
        type_keywords = {
            'before': ['before', '维修前', '前'],
            'after': ['after', '维修后', '后'],
            'during': ['during', '维修中', '中']
        }
        
        name_lower = name.lower()
        for standard_type, keywords in type_keywords.items():
            for keyword in keywords:
                if keyword in name_lower or keyword in name:
                    result['photo_type'] = standard_type
                    break
            if result['photo_type']:
                break
        
        if result['customer_id'] and result['order_id'] and result['photo_type']:
            result['is_valid'] = True
        
        if not result['is_valid']:
            errors = []
            if not result['customer_id']:
                errors.append('缺少客户编号')
            if not result['order_id']:
                errors.append('缺少工单号')
            if not result['photo_type']:
                errors.append('缺少照片类型')
            result['parse_error'] = ', '.join(errors) if errors else '无法解析文件名格式'
        
        return result
    
    @staticmethod
    def _normalize_type(type_str: str) -> Optional[str]:
        type_lower = type_str.lower()
        for standard_type, aliases in PHOTO_TYPES.items():
            if type_lower in aliases or type_str in aliases:
                return standard_type
        return None

class FileScanner:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.photos = []
        self.duplicates = []
        self.file_hashes = defaultdict(list)
    
    def scan(self) -> Tuple[List[Dict], List[Dict]]:
        for root, _, files in os.walk(self.root_dir):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.heic')):
                    file_path = Path(root) / file
                    rel_path = file_path.relative_to(self.root_dir)
                    
                    parsed = PhotoParser.parse_filename(file)
                    parsed['full_path'] = str(file_path)
                    parsed['relative_path'] = str(rel_path)
                    parsed['directory'] = str(rel_path.parent)
                    parsed['size'] = file_path.stat().st_size
                    parsed['hash'] = self._get_file_hash(file_path)
                    
                    self.file_hashes[parsed['hash']].append(parsed)
                    self.photos.append(parsed)
        
        self._find_duplicates()
        return self.photos, self.duplicates
    
    def _get_file_hash(self, file_path: Path) -> str:
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def _find_duplicates(self):
        for file_hash, files in self.file_hashes.items():
            if len(files) > 1:
                self.duplicates.append({
                    'hash': file_hash,
                    'count': len(files),
                    'files': files
                })

class MissingPhotoDetector:
    def __init__(self, photos: List[Dict]):
        self.photos = photos
        self.orders = defaultdict(lambda: {'photos': [], 'customer_id': None})
        self.missing = []
        
    def analyze(self) -> Dict:
        for photo in self.photos:
            if photo['is_valid']:
                key = photo['order_id']
                self.orders[key]['photos'].append(photo)
                self.orders[key]['customer_id'] = photo['customer_id']
        
        for order_id, order_data in self.orders.items():
            existing_types = set(p['photo_type'] for p in order_data['photos'] if p['photo_type'])
            missing_types = [t for t in REQUIRED_TYPES if t not in existing_types]
            
            if missing_types:
                self.missing.append({
                    'order_id': order_id,
                    'customer_id': order_data['customer_id'],
                    'missing_types': missing_types,
                    'existing_types': list(existing_types),
                    'photos': order_data['photos']
                })
        
        return {
            'total_orders': len(self.orders),
            'orders_with_missing': len(self.missing),
            'missing_details': self.missing
        }

class ReportGenerator:
    def __init__(self, photos: List[Dict], duplicates: List[Dict], missing: Dict):
        self.photos = photos
        self.duplicates = duplicates
        self.missing = missing
        self.timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    def generate_json(self, output_path: str) -> str:
        report = {
            'report_info': {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0'
            },
            'summary': {
                'total_photos': len(self.photos),
                'valid_photos': len([p for p in self.photos if p['is_valid']]),
                'invalid_photos': len([p for p in self.photos if not p['is_valid']]),
                'total_duplicate_groups': len(self.duplicates),
                'total_duplicate_files': sum(d['count'] for d in self.duplicates),
                'total_orders': self.missing['total_orders'],
                'orders_with_missing': self.missing['orders_with_missing']
            },
            'missing_photos': self.missing['missing_details'],
            'duplicates': self.duplicates,
            'invalid_files': [p for p in self.photos if not p['is_valid']]
        }
        
        output_file = Path(output_path) / f'photo_audit_report_{self.timestamp}.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return str(output_file)
    
    def generate_text(self, output_path: str) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("           售后照片清点缺图归档报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        total_photos = len(self.photos)
        valid_photos = len([p for p in self.photos if p['is_valid']])
        invalid_photos = len([p for p in self.photos if not p['is_valid']])
        duplicate_groups = len(self.duplicates)
        total_orders = self.missing['total_orders']
        missing_orders = self.missing['orders_with_missing']
        
        lines.append("【概览统计】")
        lines.append("-" * 40)
        lines.append(f"总照片数: {total_photos}")
        lines.append(f"有效照片: {valid_photos}")
        lines.append(f"无效照片: {invalid_photos}")
        lines.append(f"重复文件组: {duplicate_groups}")
        lines.append(f"总工单: {total_orders}")
        lines.append(f"缺图工单: {missing_orders}")
        lines.append("")
        
        if self.missing['missing_details']:
            lines.append("【缺图明细】")
            lines.append("-" * 40)
            for idx, item in enumerate(self.missing['missing_details'], 1):
                lines.append(f"{idx}. 工单: {item['order_id']} (客户: {item['customer_id']})")
                lines.append(f"   缺少类型: {', '.join(item['missing_types'])}")
                lines.append(f"   已有类型: {', '.join(item['existing_types'])}")
                lines.append("")
        
        if self.duplicates:
            lines.append("【重复文件】")
            lines.append("-" * 40)
            for idx, dup in enumerate(self.duplicates, 1):
                lines.append(f"{idx}. 重复组 (共{dup['count']}个文件)")
                for f in dup['files']:
                    lines.append(f"   - {f['relative_path']}")
                lines.append("")
        
        invalid_files = [p for p in self.photos if not p['is_valid']]
        if invalid_files:
            lines.append("【无效文件】")
            lines.append("-" * 40)
            for idx, f in enumerate(invalid_files, 1):
                lines.append(f"{idx}. {f['relative_path']}")
                lines.append(f"   原因: {f.get('parse_error', '未知错误')}")
            lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        output_file = Path(output_path) / f'photo_audit_report_{self.timestamp}.txt'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(output_file)

def main():
    parser = argparse.ArgumentParser(description='售后照片清点缺图归档报告排查CLI')
    parser.add_argument('directory', help='照片根目录')
    parser.add_argument('-o', '--output', default='.', help='报告输出目录')
    parser.add_argument('--json-only', action='store_true', help='仅输出JSON报告')
    parser.add_argument('--text-only', action='store_true', help='仅输出文本报告')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.directory):
        print(f"错误: 目录不存在: {args.directory}")
        return 1
    
    os.makedirs(args.output, exist_ok=True)
    
    print(f"开始扫描目录: {args.directory}")
    scanner = FileScanner(args.directory)
    photos, duplicates = scanner.scan()
    print(f"扫描完成，共发现 {len(photos)} 个照片文件")
    
    detector = MissingPhotoDetector(photos)
    missing = detector.analyze()
    print(f"分析完成: {missing['total_orders']} 个工单, {missing['orders_with_missing']} 个工单缺图")
    
    reporter = ReportGenerator(photos, duplicates, missing)
    
    if not args.text_only:
        json_path = reporter.generate_json(args.output)
        print(f"JSON报告已生成: {json_path}")
    
    if not args.json_only:
        text_path = reporter.generate_text(args.output)
        print(f"文本报告已生成: {text_path}")
    
    return 0

if __name__ == '__main__':
    exit(main())
