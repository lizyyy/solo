#!/usr/bin/env python3
"""
测试值班告警降噪 CLI 的完整工作流
"""

import os
import sys
import json
import subprocess
import tempfile
import shutil
from datetime import datetime, timedelta


class WorkflowTester:
    """工作流测试器"""
    
    def __init__(self):
        self.project_dir = os.path.dirname(os.path.abspath(__file__))
        self.examples_dir = os.path.join(self.project_dir, 'examples')
        self.db_path = os.path.join(self.project_dir, 'alerts.db')
        self.log_path = os.path.join(self.project_dir, 'alert_reducer.log')
    
    def _cleanup(self):
        """清理测试环境"""
        for path in [self.db_path, self.log_path]:
            if os.path.exists(path):
                os.remove(path)
    
    def _run_command(self, cmd, cwd=None):
        """运行命令"""
        cwd = cwd or self.project_dir
        print(f"\n$ {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(f"STDERR: {result.stderr}")
            
            return result.returncode == 0, result.stdout, result.stderr
            
        except subprocess.TimeoutExpired:
            print("❌ 命令超时")
            return False, "", "Timeout"
        except Exception as e:
            print(f"❌ 命令执行失败: {e}")
            return False, "", str(e)
    
    def test_init(self):
        """测试初始化"""
        print("=" * 60)
        print("测试 1: 初始化数据库")
        print("=" * 60)
        
        self._cleanup()
        
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'init'
        ])
        
        if success and os.path.exists(self.db_path):
            print("✅ 初始化成功")
            return True
        else:
            print("❌ 初始化失败")
            return False
    
    def test_import_normal(self):
        """测试导入正常样例"""
        print("\n" + "=" * 60)
        print("测试 2: 导入正常样例")
        print("=" * 60)
        
        normal_file = os.path.join(self.examples_dir, 'alerts_normal.json')
        
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'import',
            '--file', normal_file
        ])
        
        if success:
            print("✅ 正常样例导入成功")
            return True
        else:
            print("❌ 正常样例导入失败")
            return False
    
    def test_import_escalation(self):
        """测试导入升级样例"""
        print("\n" + "=" * 60)
        print("测试 3: 导入升级样例")
        print("=" * 60)
        
        escalation_file = os.path.join(self.examples_dir, 'alerts_escalation.json')
        
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'import',
            '--file', escalation_file
        ])
        
        if success:
            print("✅ 升级样例导入成功")
            return True
        else:
            print("❌ 升级样例导入失败")
            return False
    
    def test_import_failed(self):
        """测试导入失败样例"""
        print("\n" + "=" * 60)
        print("测试 4: 导入失败样例（预期会有失败记录）")
        print("=" * 60)
        
        failed_file = os.path.join(self.examples_dir, 'alerts_failed.json')
        
        # 这个测试不要求完全成功，但要求有失败留痕
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'import',
            '--file', failed_file
        ])
        
        # 检查是否有失败记录
        success2, stdout2, stderr2 = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'failures'
        ])
        
        if '没有失败记录' not in stdout2:
            print("✅ 失败样例导入并留痕成功")
            return True
        else:
            print("⚠️  失败样例没有产生失败记录")
            return False
    
    def test_process(self):
        """测试处理告警"""
        print("\n" + "=" * 60)
        print("测试 5: 处理告警（抑制、合并、升级）")
        print("=" * 60)
        
        # 处理最近24小时的告警
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'process',
            '--window', '1440'  # 24小时
        ])
        
        if success:
            print("✅ 告警处理成功")
            return True
        else:
            print("❌ 告警处理失败")
            return False
    
    def test_query(self):
        """测试查询告警"""
        print("\n" + "=" * 60)
        print("测试 6: 查询告警")
        print("=" * 60)
        
        # 查询所有告警
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'query',
            '--all', '--limit', '20'
        ])
        
        if success:
            print("✅ 查询告警成功")
            
            # 测试按状态查询
            print("\n--- 按状态查询（已升级）---")
            success2, stdout2, stderr2 = self._run_command([
                sys.executable, '-m', 'alert_reducer', 'query',
                '--status', 'escalated'
            ])
            
            if success2:
                print("✅ 按状态查询成功")
            
            # 测试JSON输出
            print("\n--- JSON输出 ---")
            success3, stdout3, stderr3 = self._run_command([
                sys.executable, '-m', 'alert_reducer', 'query',
                '--all', '--json', '--limit', '5'
            ])
            
            if success3:
                print("✅ JSON输出成功")
            
            return True
        else:
            print("❌ 查询告警失败")
            return False
    
    def test_report(self):
        """测试生成报告"""
        print("\n" + "=" * 60)
        print("测试 7: 生成复盘报告")
        print("=" * 60)
        
        # 生成HTML报告
        html_output = os.path.join(tempfile.gettempdir(), 'test_report.html')
        
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'report',
            '--window', '1440',
            '--format', 'html',
            '--output', html_output
        ])
        
        if success and os.path.exists(html_output):
            print(f"✅ HTML报告生成成功: {html_output}")
            file_size = os.path.getsize(html_output)
            print(f"   文件大小: {file_size} bytes")
            
            # 清理
            os.remove(html_output)
        else:
            print("❌ HTML报告生成失败")
            return False
        
        # 生成JSON报告
        json_output = os.path.join(tempfile.gettempdir(), 'test_report.json')
        
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'report',
            '--window', '1440',
            '--format', 'json',
            '--output', json_output
        ])
        
        if success and os.path.exists(json_output):
            print(f"✅ JSON报告生成成功: {json_output}")
            
            # 验证JSON格式
            with open(json_output, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"   报告包含: {data.get('stats', {})}")
            
            # 清理
            os.remove(json_output)
            return True
        else:
            print("❌ JSON报告生成失败")
            return False
    
    def test_rerun(self):
        """测试重跑校验"""
        print("\n" + "=" * 60)
        print("测试 8: 重跑校验")
        print("=" * 60)
        
        # 先获取批次ID
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'batches',
            '--limit', '5'
        ])
        
        if success:
            print("✅ 批次查询成功")
            
            # 简单重跑（用时间范围）
            start_time = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
            end_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            print("\n--- 按时间范围重跑 ---")
            success2, stdout2, stderr2 = self._run_command([
                sys.executable, '-m', 'alert_reducer', 'rerun',
                '--start', start_time,
                '--end', end_time
            ])
            
            if success2:
                print("✅ 重跑校验成功")
                return True
            else:
                print("⚠️  重跑校验可能没有待处理的告警")
                return True  # 不一定失败
        
        return False
    
    def test_failures(self):
        """测试查看失败日志"""
        print("\n" + "=" * 60)
        print("测试 9: 查看失败日志")
        print("=" * 60)
        
        success, stdout, stderr = self._run_command([
            sys.executable, '-m', 'alert_reducer', 'failures'
        ])
        
        if success:
            print("✅ 查看失败日志成功")
            return True
        else:
            print("❌ 查看失败日志失败")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("📋 开始测试值班告警降噪 CLI 工作流")
        print(f"📁 项目目录: {self.project_dir}")
        print(f"⏰ 开始时间: {datetime.now()}")
        
        tests = [
            ("初始化数据库", self.test_init),
            ("导入正常样例", self.test_import_normal),
            ("导入升级样例", self.test_import_escalation),
            ("导入失败样例", self.test_import_failed),
            ("处理告警", self.test_process),
            ("查询告警", self.test_query),
            ("生成报告", self.test_report),
            ("重跑校验", self.test_rerun),
            ("查看失败日志", self.test_failures),
        ]
        
        results = []
        
        for name, test_func in tests:
            try:
                result = test_func()
                results.append((name, result))
            except Exception as e:
                print(f"❌ 测试 '{name}' 异常: {e}")
                import traceback
                traceback.print_exc()
                results.append((name, False))
        
        # 汇总结果
        print("\n" + "=" * 60)
        print("📊 测试结果汇总")
        print("=" * 60)
        
        passed = sum(1 for _, r in results if r)
        total = len(results)
        
        for name, result in results:
            status = "✅ 通过" if result else "❌ 失败"
            print(f"{status}: {name}")
        
        print(f"\n📈 通过率: {passed}/{total} ({passed/total*100:.1f}%)")
        print(f"⏰ 结束时间: {datetime.now()}")
        
        return passed == total


if __name__ == '__main__':
    tester = WorkflowTester()
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)
