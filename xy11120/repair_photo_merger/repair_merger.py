#!/usr/bin/env python3
import os
import sys
import shutil
import argparse
import re
from pathlib import Path
from datetime import datetime

class RepairPhotoMerger:
    def __init__(self, input_dir, output_dir, log_dir, verbose=False):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.log_dir = Path(log_dir)
        self.verbose = verbose
        self.stats = {'normal': 0, 'bad_format': 0, 'rework': 0, 'rerun': 0, 'empty': 0}
        self.errors = []
        
        self.wo_pattern = re.compile(r'^WO-\d{4}-\d{4}_')
        self.rework_pattern = re.compile(r'_(Rework|返工|rework)_')
        self.rerun_pattern = re.compile(r'_(复跑|RERUN|rerun)_')
        
    def log(self, message, level='INFO', source_file=None, line_no=None):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_msg = f"[{timestamp}] [{level}] {message}"
        if source_file and line_no:
            log_msg += f" | 来源: {source_file} #L{line_no}"
        
        log_file = self.log_dir / f"merge_{datetime.now().strftime('%Y%m%d')}.log"
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_msg + '\n')
        
        if self.verbose or level in ['ERROR', 'WARNING']:
            print(log_msg)
    
    def is_valid_workorder(self, filename):
        return bool(self.wo_pattern.match(filename))
    
    def is_rework(self, filename):
        return bool(self.rework_pattern.search(filename))
    
    def is_rerun(self, filename):
        return bool(self.rerun_pattern.search(filename))
    
    def is_empty_file(self, filepath):
        return os.path.getsize(filepath) == 0
    
    def process_file(self, filepath):
        filename = filepath.name
        caller_info = sys._getframe().f_lineno
        
        if self.is_empty_file(filepath):
            self.stats['empty'] += 1
            dest = self.output_dir / 'empty' / filename
            shutil.copy2(filepath, dest)
            self.log(f"空文件: {filename}", 'WARNING', 'repair_merger.py', caller_info)
            self.errors.append(f"{filename} (空文件) - repair_merger.py#L{caller_info}")
            return
        
        if self.is_rework(filename):
            self.stats['rework'] += 1
            dest = self.output_dir / 'bad' / filename
            shutil.copy2(filepath, dest)
            self.log(f"返工单: {filename}", 'WARNING', 'repair_merger.py', caller_info)
            self.errors.append(f"{filename} (返工单) - repair_merger.py#L{caller_info}")
            return
        
        if self.is_rerun(filename):
            self.stats['rerun'] += 1
            dest = self.output_dir / 'bad' / filename
            shutil.copy2(filepath, dest)
            self.log(f"可复跑输出: {filename}", 'WARNING', 'repair_merger.py', caller_info)
            self.errors.append(f"{filename} (可复跑输出) - repair_merger.py#L{caller_info}")
            return
        
        if not self.is_valid_workorder(filename):
            self.stats['bad_format'] += 1
            dest = self.output_dir / 'bad' / filename
            shutil.copy2(filepath, dest)
            self.log(f"工单号格式错误(缺横杠): {filename}", 'ERROR', 'repair_merger.py', caller_info)
            self.errors.append(f"{filename} (工单号缺横杠) - repair_merger.py#L{caller_info}")
            return
        
        self.stats['normal'] += 1
        dest = self.output_dir / 'normal' / filename
        shutil.copy2(filepath, dest)
        self.log(f"正常文件: {filename}", 'INFO', 'repair_merger.py', caller_info)
    
    def run(self):
        self.log("=== 维修服务站维修照片归并开始 ===", 'INFO')
        
        for root, _, files in os.walk(self.input_dir):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    filepath = Path(root) / file
                    self.process_file(filepath)
        
        self.print_summary()
        self.log("=== 维修服务站维修照片归并完成 ===", 'INFO')
    
    def print_summary(self):
        caller_info = sys._getframe().f_lineno
        print("\n" + "="*50)
        print("维修服务站维修照片归并 - 异常摘要")
        print("="*50)
        print(f"正常文件: {self.stats['normal']} 个")
        print(f"工单号缺横杠: {self.stats['bad_format']} 个")
        print(f"返工单: {self.stats['rework']} 个")
        print(f"可复跑输出: {self.stats['rerun']} 个")
        print(f"空文件: {self.stats['empty']} 个")
        print("\n异常文件列表 (运营同事可直接修正):")
        for err in self.errors:
            print(f"  - {err}")
        print("="*50 + "\n")
        
        summary_file = self.log_dir / f"summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("维修服务站维修照片归并 - 异常摘要\n")
            f.write("="*50 + "\n")
            f.write(f"正常文件: {self.stats['normal']} 个\n")
            f.write(f"工单号缺横杠: {self.stats['bad_format']} 个\n")
            f.write(f"返工单: {self.stats['rework']} 个\n")
            f.write(f"可复跑输出: {self.stats['rerun']} 个\n")
            f.write(f"空文件: {self.stats['empty']} 个\n\n")
            f.write("异常文件列表:\n")
            for err in self.errors:
                f.write(f"  - {err}\n")

def main():
    parser = argparse.ArgumentParser(description='维修服务站维修照片归并 CLI')
    parser.add_argument('--input', default='./input', help='输入目录')
    parser.add_argument('--output', default='./output', help='输出目录')
    parser.add_argument('--logs', default='./logs', help='日志目录')
    parser.add_argument('--verbose', action='store_true', help='详细日志模式')
    
    args = parser.parse_args()
    
    merger = RepairPhotoMerger(args.input, args.output, args.logs, args.verbose)
    merger.run()

if __name__ == '__main__':
    main()
