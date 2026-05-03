"""
命令行接口模块 - 提供友好的命令行界面
"""

import argparse
import os
import sys
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

import yaml

from .parser import FileScanner, TodoParser
from .normalizer import TodoNormalizer
from .validator import TodoValidator
from .reporter import ReportGenerator
from . import __version__

logger = logging.getLogger(__name__)


class MeetingTodoCLI:
    """会议纪要待办整理工具命令行接口"""
    
    DEFAULT_CONFIG_PATH = "config.yaml"
    
    def __init__(self):
        self.config: Optional[Dict[str, Any]] = None
        self.args: Optional[argparse.Namespace] = None
    
    def run(self, argv=None):
        """主入口"""
        # 解析命令行参数
        parser = self._create_argument_parser()
        self.args = parser.parse_args(argv)
        
        # 处理版本命令
        if hasattr(self.args, 'version') and self.args.version:
            self._print_version()
            return 0
        
        # 加载配置
        try:
            self._load_config()
        except Exception as e:
            print(f"❌ 配置加载失败: {str(e)}", file=sys.stderr)
            return 1
        
        # 设置日志
        self._setup_logging()
        
        # 执行主逻辑
        try:
            return self._execute()
        except Exception as e:
            logger.exception("执行过程中发生错误")
            print(f"\n❌ 错误: {str(e)}", file=sys.stderr)
            print("\n💡 建议检查：", file=sys.stderr)
            print("   - 输入目录是否存在且包含会议纪要文件", file=sys.stderr)
            print("   - 配置文件是否正确", file=sys.stderr)
            print("   - 文件编码是否为 UTF-8 或 GBK", file=sys.stderr)
            return 1
    
    def _create_argument_parser(self) -> argparse.ArgumentParser:
        """创建命令行参数解析器"""
        parser = argparse.ArgumentParser(
            description="会议纪要待办整理工具 - 自动提取并整理会议纪要中的待办事项",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  # 使用默认配置
  python -m meeting_todo_parser
  
  # 指定输入目录
  python -m meeting_todo_parser -i ./my_meetings
  
  # 指定输出目录
  python -m meeting_todo_parser -o ./my_reports
  
  # 显示版本
  python -m meeting_todo_parser --version

支持的待办格式:
  - [ ] 待办内容 @负责人 截止 2024-01-15
  * [ ] 待办内容 负责人: 张三 截止日期: 1月15日
  TODO: 待办内容 @李四 下周一完成
  待办: 待办内容 指派给: 王五 截止 明天
            """
        )
        
        parser.add_argument(
            "-c", "--config",
            default=self.DEFAULT_CONFIG_PATH,
            help=f"配置文件路径 (默认: {self.DEFAULT_CONFIG_PATH})"
        )
        
        parser.add_argument(
            "-i", "--input",
            default=None,
            help="输入目录路径（覆盖配置文件中的 input_dir）"
        )
        
        parser.add_argument(
            "-o", "--output",
            default=None,
            help="输出目录路径（覆盖配置文件中的 output_dir）"
        )
        
        parser.add_argument(
            "-v", "--verbose",
            action="store_true",
            help="显示详细日志"
        )
        
        parser.add_argument(
            "--version",
            action="store_true",
            help="显示版本信息"
        )
        
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="仅解析不生成输出文件（用于测试）"
        )
        
        return parser
    
    def _load_config(self):
        """加载配置文件"""
        config_path = self.args.config
        
        if not os.path.exists(config_path):
            # 尝试在脚本目录查找
            script_dir = os.path.dirname(os.path.abspath(__file__))
            parent_config = os.path.join(os.path.dirname(script_dir), config_path)
            if os.path.exists(parent_config):
                config_path = parent_config
            else:
                raise FileNotFoundError(
                    f"配置文件不存在: {config_path}\n"
                    f"请确保配置文件存在，或使用 -c 参数指定配置文件路径"
                )
        
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        # 命令行参数覆盖配置
        if self.args.input:
            self.config["input_dir"] = self.args.input
        
        if self.args.output:
            self.config["output_dir"] = self.args.output
    
    def _setup_logging(self):
        """设置日志"""
        log_config = self.config.get("logging", {})
        log_level = log_config.get("level", "INFO")
        
        if self.args.verbose:
            log_level = "DEBUG"
        
        logging.basicConfig(
            level=getattr(logging, log_level.upper(), logging.INFO),
            format=log_config.get("format", "%(asctime)s - %(levelname)s - %(message)s")
        )
    
    def _print_version(self):
        """打印版本信息"""
        print(f"会议纪要待办整理工具 v{__version__}")
        print(f"Python: {sys.version}")
    
    def _execute(self) -> int:
        """执行主逻辑"""
        print("📋 会议纪要待办整理工具")
        print("=" * 50)
        
        # 1. 扫描文件
        print("\n[1/5] 扫描文件...")
        scanner = FileScanner(self.config)
        
        try:
            input_dir = self.config.get("input_dir", "./meetings")
            files = scanner.scan(input_dir)
        except FileNotFoundError as e:
            raise RuntimeError(f"输入目录不存在: {e}")
        except NotADirectoryError as e:
            raise RuntimeError(f"路径不是有效目录: {e}")
        
        if not files:
            print(f"⚠️  在输入目录中未找到任何会议纪要文件")
            print(f"   输入目录: {input_dir}")
            print(f"   支持的格式: {', '.join(self.config.get('supported_extensions', ['.md', '.txt']))}")
            return 0
        
        print(f"   找到 {len(files)} 个文件:")
        for f in files[:5]:
            print(f"   - {os.path.basename(f)}")
        if len(files) > 5:
            print(f"   ... 还有 {len(files) - 5} 个文件")
        
        # 2. 解析待办
        print("\n[2/5] 解析待办事项...")
        parser = TodoParser(self.config)
        
        all_raw_items = []
        for file_path in files:
            try:
                items = parser.parse_file(file_path)
                all_raw_items.extend(items)
            except Exception as e:
                logger.warning(f"解析文件 {file_path} 失败: {str(e)}")
                print(f"   ⚠️  跳过文件: {os.path.basename(file_path)} ({str(e)})")
        
        if not all_raw_items:
            print("⚠️  未找到任何待办事项")
            return 0
        
        print(f"   共解析到 {len(all_raw_items)} 个待办项")
        
        # 3. 归一化
        print("\n[3/5] 归一化数据...")
        normalizer = TodoNormalizer(self.config)
        normalized_items = normalizer.normalize(all_raw_items)
        
        # 统计
        with_assignee = sum(1 for i in normalized_items if i.has_assignee)
        with_deadline = sum(1 for i in normalized_items if i.has_deadline)
        
        print(f"   归一化完成:")
        print(f"   - 有负责人: {with_assignee}/{len(normalized_items)}")
        print(f"   - 有截止日期: {with_deadline}/{len(normalized_items)}")
        
        # 4. 校验
        print("\n[4/5] 校验数据...")
        validator = TodoValidator(self.config)
        validation_result = validator.validate(normalized_items)
        
        print(f"   校验完成:")
        print(f"   - 有效项: {validation_result.valid_items}")
        print(f"   - 有错误: {validation_result.items_with_errors}")
        print(f"   - 有警告: {validation_result.items_with_warnings}")
        print(f"   - 无法识别: {len(validation_result.unrecognized_items)}")
        
        if self.args.dry_run:
            print("\n🏁 试运行结束，不生成输出文件")
            return 0
        
        # 5. 生成报告
        print("\n[5/5] 生成报告...")
        output_dir = self.config.get("output_dir", "./reports")
        os.makedirs(output_dir, exist_ok=True)
        
        # 生成 Markdown 报告
        reporter = ReportGenerator(self.config)
        report_path = reporter.generate(normalized_items, validation_result, output_dir)
        print(f"   ✓ 报告已生成: {report_path}")
        
        # 生成 warnings.json
        warnings_path = os.path.join(output_dir, "warnings.json")
        with open(warnings_path, 'w', encoding='utf-8') as f:
            json.dump(
                validation_result.to_dict(),
                f,
                ensure_ascii=False,
                indent=2,
                default=str
            )
        print(f"   ✓ 警告文件已生成: {warnings_path}")
        
        # 完成摘要
        print("\n" + "=" * 50)
        print("✅ 处理完成！")
        print("")
        print("📊 摘要:")
        print(f"   - 总待办数: {len(normalized_items)}")
        print(f"   - 有效待办: {validation_result.valid_items}")
        print(f"   - 无法识别: {len(validation_result.unrecognized_items)}")
        print("")
        print("📁 输出文件:")
        print(f"   - 报告: {report_path}")
        print(f"   - 警告: {warnings_path}")
        
        if validation_result.unrecognized_items:
            print("")
            print("⚠️  有无法识别的待办项，请检查 warnings.json 并补充负责人和截止日期")
        
        return 0


def main():
    """程序入口"""
    cli = MeetingTodoCLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
