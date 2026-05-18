#!/usr/bin/env python3
import os
import sys
import json
import yaml
import argparse
from datetime import datetime
from typing import Dict, List, Optional
import re

from exif_checker import ExifChecker
from duplicate_detector import DuplicateDetector
from store_validator import StoreValidator


class PhotoCheckCLI:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.exif_checker = ExifChecker(self.config['photo_check'])
        self.duplicate_detector = DuplicateDetector(self.config['photo_check'])
        self.store_validator = StoreValidator(self.config['photo_check'])
        self.results = {
            'scan_time': None,
            'input_directory': None,
            'total_files': 0,
            'processed_files': 0,
            'failed_files': 0,
            'photo_records': [],
            'exif_issues': [],
            'duplicate_issues': [],
            'similar_photo_issues': [],
            'relocation_issues': [],
            'time_issues': [],
            'summary': {}
        }

    def _load_config(self, config_path: str) -> Dict:
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"加载配置文件失败: {e}")
            sys.exit(1)

    def _extract_store_id_from_filename(self, filename: str) -> Optional[str]:
        patterns = [
            r'([A-Z]{2}-\d{3})',
            r'store[_-]?(\w+)',
            r'门店[_-]?(\w+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1).upper()
        return None

    def process_single_photo(self, file_path: str) -> Dict:
        filename = os.path.basename(file_path)
        record = {
            'filename': filename,
            'filepath': file_path,
            'file_size': os.path.getsize(file_path),
            'store_id': self._extract_store_id_from_filename(filename),
            'status': 'pending',
            'error': None,
            'image_hash': None,
            'exif_data': {},
            'exif_warnings': []
        }

        try:
            exif_result = self.exif_checker.check_exif_compliance(file_path)
            record['exif_data'] = exif_result['exif_data']
            record['exif_warnings'] = exif_result['warnings']
            record['missing_exif_fields'] = exif_result['missing_fields']
            record['has_exif'] = exif_result['has_exif']

            if not exif_result['has_exif'] or exif_result['missing_fields']:
                for warning in exif_result['warnings']:
                    self.results['exif_issues'].append({
                        'filename': filename,
                        'type': 'exif_missing',
                        'severity': 'high',
                        'description': warning
                    })

            img_hash = self.duplicate_detector.compute_hash(file_path)
            if img_hash:
                record['image_hash'] = self.duplicate_detector.hash_to_string(img_hash)

            has_critical_error = any('解析失败' in w or 'cannot identify' in w.lower() for w in record['exif_warnings'])
            if has_critical_error:
                record['status'] = 'failed'
                record['error'] = record['exif_warnings'][0] if record['exif_warnings'] else '文件解析失败'
                self.results['failed_files'] += 1
            else:
                record['status'] = 'success'
                self.results['processed_files'] += 1

        except Exception as e:
            record['status'] = 'failed'
            record['error'] = str(e)
            self.results['failed_files'] += 1

        return record

    def process_directory(self, directory: str) -> Dict:
        self.results['scan_time'] = datetime.now().isoformat()
        self.results['input_directory'] = os.path.abspath(directory)

        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
        image_files = []

        for root, _, files in os.walk(directory):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in image_extensions:
                    image_files.append(os.path.join(root, file))

        self.results['total_files'] = len(image_files)
        image_files.sort()

        for file_path in image_files:
            record = self.process_single_photo(file_path)
            self.results['photo_records'].append(record)

        duplicate_results = self.duplicate_detector.analyze_photo_batch(self.results['photo_records'])
        self.results['duplicate_issues'] = duplicate_results['duplicates']
        self.results['similar_photo_issues'] = duplicate_results['similar_photos']

        store_validation = self.store_validator.batch_validate_stores(self.results['photo_records'])
        self.results['time_issues'] = store_validation['time_issues']
        
        for validation in store_validation['location_validations']:
            if validation.get('relocation_detected'):
                self.results['relocation_issues'].append({
                    'filename': validation['filename'],
                    'store_id': validation['store_id'],
                    'type': 'store_relocation',
                    'severity': 'high',
                    'distance_meters': validation['distance_meters'],
                    'warnings': validation['warnings']
                })

        self._generate_summary()
        return self.results

    def _generate_summary(self):
        success_records = [r for r in self.results['photo_records'] if r['status'] == 'success']
        failed_records = [r for r in self.results['photo_records'] if r['status'] == 'failed']

        exif_missing_count = len([r for r in success_records if not r.get('has_exif') or r.get('missing_exif_fields')])
        photos_with_gps = len([r for r in success_records if r.get('exif_data', {}).get('GPS')])

        self.results['summary'] = {
            'total_files': self.results['total_files'],
            'successfully_processed': len(success_records),
            'failed_to_process': len(failed_records),
            'exif_missing_or_incomplete': exif_missing_count,
            'photos_with_valid_gps': photos_with_gps,
            'duplicate_photos_found': len(self.results['duplicate_issues']),
            'similar_photos_found': len(self.results['similar_photo_issues']),
            'store_relocation_detected': len(self.results['relocation_issues']),
            'time_consistency_issues': len(self.results['time_issues']),
            'failed_files_list': [r['filename'] for r in failed_records],
            'failed_files_details': [{'filename': r['filename'], 'error': r['error']} for r in failed_records]
        }

    def print_report(self):
        summary = self.results['summary']
        
        print("\n" + "="*70)
        print("           便利店加盟督导巡店照片查重报告")
        print("="*70)
        print(f"扫描时间: {self.results['scan_time']}")
        print(f"扫描目录: {self.results['input_directory']}")
        print("-"*70)
        
        print(f"\n【处理统计】")
        print(f"  总文件数: {summary['total_files']}")
        print(f"  成功处理: {summary['successfully_processed']}")
        print(f"  处理失败: {summary['failed_to_process']}")
        if summary['failed_files_list']:
            print(f"  失败文件: {', '.join(summary['failed_files_list'])}")
        
        print(f"\n【EXIF检查】")
        print(f"  EXIF缺失或不完整: {summary['exif_missing_or_incomplete']} 张")
        print(f"  含有效GPS信息: {summary['photos_with_valid_gps']} 张")
        
        print(f"\n【重复照片检测】")
        print(f"  完全重复: {summary['duplicate_photos_found']} 组")
        print(f"  高度相似: {summary['similar_photos_found']} 组")
        
        print(f"\n【门店验证】")
        print(f"  门店迁址异常: {summary['store_relocation_detected']} 张")
        print(f"  时间一致性问题: {summary['time_consistency_issues']} 组")
        
        if self.results['exif_issues']:
            print(f"\n【EXIF问题详情】")
            for issue in self.results['exif_issues'][:5]:
                print(f"  - {issue['filename']}: {issue['description']}")
            if len(self.results['exif_issues']) > 5:
                print(f"  ... 还有 {len(self.results['exif_issues']) - 5} 条")
        
        if self.results['duplicate_issues']:
            print(f"\n【完全重复照片】")
            for issue in self.results['duplicate_issues']:
                print(f"  - {issue['photo1']} <-> {issue['photo2']} (门店: {issue['store_id']})")
        
        if self.results['similar_photo_issues']:
            print(f"\n【高度相似照片】")
            for issue in self.results['similar_photo_issues']:
                print(f"  - {issue['photo1']} <-> {issue['photo2']} (相似度: {issue['similarity_score']}%)")
        
        if self.results['relocation_issues']:
            print(f"\n【门店迁址异常】")
            for issue in self.results['relocation_issues']:
                print(f"  - {issue['filename']}: 距离预期位置 {issue['distance_meters']} 米")
        
        if self.results['time_issues']:
            print(f"\n【时间一致性问题】")
            for issue in self.results['time_issues']:
                print(f"  - {issue['description']}")
        
        print("\n" + "="*70)

    def save_results(self, output_path: str, format: str = 'json'):
        def datetime_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2, default=datetime_serializer)
        print(f"\n结果已保存到: {os.path.abspath(output_path)}")


def main():
    parser = argparse.ArgumentParser(
        description='便利店加盟督导巡店照片查重工具 - 检查EXIF缺失、重复照片、门店迁址',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s ./photos                           # 检查指定目录
  %(prog)s ./photos -c ./my_config.yaml       # 使用自定义配置
  %(prog)s ./photos -o result.json            # 保存结果到JSON
  %(prog)s ./photos --no-print                # 不打印报告，只输出文件
        """
    )
    parser.add_argument('directory', help='包含巡店照片的目录路径')
    parser.add_argument('-c', '--config', default='config.yaml', help='配置文件路径 (默认: config.yaml)')
    parser.add_argument('-o', '--output', help='输出JSON结果文件路径')
    parser.add_argument('--no-print', action='store_true', help='不打印报告到控制台')
    
    args = parser.parse_args()

    if not os.path.isdir(args.directory):
        print(f"错误: 目录不存在 - {args.directory}")
        sys.exit(1)

    if not os.path.exists(args.config):
        print(f"警告: 配置文件不存在 - {args.config}，使用默认配置")

    cli = PhotoCheckCLI(args.config)
    cli.process_directory(args.directory)

    if not args.no_print:
        cli.print_report()

    if args.output:
        cli.save_results(args.output)
    elif not args.no_print:
        default_output = f"photo_check_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        cli.save_results(default_output)


if __name__ == '__main__':
    main()
