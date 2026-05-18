#!/usr/bin/env python3
import os
import sys
import csv
import json
from typing import List, Dict, Tuple

EXIT_SUCCESS = 0
EXIT_PARTIAL_SUCCESS = 1
EXIT_FAILURE = 2

class AlertClusterProcessor:
    def __init__(self):
        self.errors: List[Dict] = []
        self.success_count = 0
        self.total_count = 0

    def log_error(self, file: str, line: int, message: str):
        self.errors.append({
            "来源文件": file,
            "行号": line,
            "错误摘要": message
        })

    def process_csv(self, filepath: str) -> bool:
        filename = os.path.basename(filepath)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                headers = next(reader, None)
                
                if not headers:
                    self.log_error(filename, 1, "空文件，无表头和数据")
                    return False
                
                row_count = 0
                has_storm = False
                has_recovery = False
                
                for line_num, row in enumerate(reader, start=2):
                    row_count += 1
                    
                    if len(row) != 7:
                        self.log_error(filename, line_num, f"列数不匹配: 期望7列，实际{len(row)}列")
                        continue
                    
                    alert_id, time_str, cp_id, alert_type, level, status, station = row
                    
                    if not cp_id:
                        self.log_error(filename, line_num, "充电桩ID为空")
                    if time_str == "无效时间":
                        self.log_error(filename, line_num, "时间格式无效")
                    if not alert_type:
                        self.log_error(filename, line_num, "告警类型为空")
                    if status not in ["触发", "恢复"]:
                        self.log_error(filename, line_num, f"无效状态值: {status}")
                    
                    if status == "恢复":
                        has_recovery = True
                
                if row_count == 0:
                    self.log_error(filename, 1, "只有表头，无告警数据")
                    return False
                
                print(f"  [CSV] {filename}: 处理{row_count}条告警记录")
                if has_recovery:
                    print(f"        -> 检测到恢复事件")
                return True
                
        except Exception as e:
            self.log_error(filename, 0, f"文件读取失败: {str(e)}")
            return False

    def process_json(self, filepath: str) -> bool:
        filename = os.path.basename(filepath)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            has_storm = data.get("告警风暴", False)
            has_recovery = len(data.get("恢复事件", [])) > 0
            can_rerun = data.get("可复跑", False)
            
            print(f"  [JSON] {filename}: 告警风暴={'是' if has_storm else '否'}, 恢复事件={'有' if has_recovery else '无'}, 可复跑={'是' if can_rerun else '否'}")
            
            if has_storm and (not has_recovery or can_rerun):
                print(f"        -> 检测到部分成功场景（有告警风暴但需确认恢复情况）")
            
            return True
            
        except json.JSONDecodeError as e:
            self.log_error(filename, e.lineno, f"JSON语法错误: {str(e)}")
            return False
        except Exception as e:
            self.log_error(filename, 0, f"文件处理失败: {str(e)}")
            return False

    def process_txt(self, filepath: str) -> bool:
        filename = os.path.basename(filepath)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            has_storm = False
            has_recovery = False
            has_rerun = False
            
            for line_num, line in enumerate(lines, start=1):
                if "告警风暴: 是" in line:
                    has_storm = True
                if "恢复事件" in line:
                    has_recovery = True
                if "可复跑标记: 是" in line:
                    has_rerun = True
            
            print(f"  [TXT] {filename}: {len(lines)}行, 告警风暴={'是' if has_storm else '否'}")
            
            if has_storm and has_rerun:
                print(f"        -> 检测到可复跑场景")
            
            return True
            
        except Exception as e:
            self.log_error(filename, 0, f"文件处理失败: {str(e)}")
            return False

    def process_file(self, filepath: str) -> bool:
        self.total_count += 1
        ext = os.path.splitext(filepath)[1].lower()
        
        if ext == '.csv':
            success = self.process_csv(filepath)
        elif ext == '.json':
            success = self.process_json(filepath)
        elif ext == '.txt':
            success = self.process_txt(filepath)
        else:
            self.log_error(os.path.basename(filepath), 0, f"不支持的文件格式: {ext}")
            success = False
        
        if success:
            self.success_count += 1
        
        return success

    def print_summary(self):
        print("\n" + "="*60)
        print("异常摘要 (运营同事不用打开源码也能修数据):")
        print("="*60)
        
        if not self.errors:
            print("无错误")
        else:
            for error in self.errors:
                print(f"来源文件: {error['来源文件']}")
                print(f"行号: {error['行号']}")
                print(f"错误摘要: {error['错误摘要']}")
                print("-" * 60)
        
        print(f"\n处理统计: 成功 {self.success_count}/{self.total_count} 文件")
        
        if self.success_count == 0:
            return EXIT_FAILURE
        elif self.success_count < self.total_count:
            print("  -> 部分成功，存在错误需要修复")
            return EXIT_PARTIAL_SUCCESS
        else:
            return EXIT_SUCCESS

def main():
    print("="*60)
    print("充电桩运维站充电告警聚类 CLI")
    print("="*60)
    
    processor = AlertClusterProcessor()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    directories = ["normal", "bad", "empty"]
    
    for directory in directories:
        dir_path = os.path.join(base_dir, directory)
        if not os.path.exists(dir_path):
            continue
        
        print(f"\n处理目录: {directory}/")
        files = sorted(os.listdir(dir_path))
        
        for filename in files:
            filepath = os.path.join(dir_path, filename)
            if os.path.isfile(filepath):
                processor.process_file(filepath)
    
    exit_code = processor.print_summary()
    
    print(f"\n程序退出码: {exit_code}")
    print(f"  0 = 全部成功")
    print(f"  1 = 部分成功（有告警风暴、恢复事件、可复跑输出需要确认）")
    print(f"  2 = 全部失败")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()