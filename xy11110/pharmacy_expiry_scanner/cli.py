#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from typing import List, Dict

from .config import load_config
from .utils import DateParser, setup_logger
from .core import FileImporter, DataProcessor, Exporter


def main():
    parser = argparse.ArgumentParser(
        description='社区药房药品效期扫描工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python -m pharmacy_expiry_scanner.cli samples/ output/
  python -m pharmacy_expiry_scanner.cli --input samples/ --output output/
  python -m pharmacy_expiry_scanner.cli samples/pharmacy_inventory_1.csv output/
        '''
    )
    
    parser.add_argument(
        'input_path',
        nargs='?',
        help='输入文件或目录路径'
    )
    
    parser.add_argument(
        'output_dir',
        nargs='?',
        default='output',
        help='输出目录路径 (默认: output)'
    )
    
    parser.add_argument(
        '--config',
        help='配置文件路径 (默认使用内置配置)'
    )
    
    parser.add_argument(
        '--format',
        choices=['csv', 'json', 'xlsx'],
        help='输出格式 (默认从配置文件读取)'
    )
    
    args = parser.parse_args()
    
    if not args.input_path:
        parser.print_help()
        sys.exit(1)
    
    logger = setup_logger()
    logger.info("=" * 50)
    logger.info("社区药房药品效期扫描工具启动")
    logger.info("=" * 50)
    
    try:
        config = load_config(args.config)
        
        if args.format:
            config['output']['format'] = args.format
        
        date_parser = DateParser(config['date_formats'])
        importer = FileImporter(config['field_mapping'], config['processing'])
        processor = DataProcessor(
            date_parser,
            config['expiry_rules'],
            config['processing']
        )
        exporter = Exporter(config['output'])
        
        input_path = Path(args.input_path)
        files_to_process = []
        
        if input_path.is_file():
            files_to_process.append(input_path)
        elif input_path.is_dir():
            for ext in ['*.csv', '*.xlsx', '*.xls']:
                files_to_process.extend(input_path.glob(ext))
        else:
            logger.error(f"无效的输入路径: {args.input_path}")
            sys.exit(1)
        
        if not files_to_process:
            logger.warning("未找到可处理的文件")
            sys.exit(0)
        
        logger.info(f"找到 {len(files_to_process)} 个文件待处理")
        
        all_records = []
        all_failed_records = []
        file_errors = {}
        
        for file_path in files_to_process:
            logger.info(f"正在处理: {file_path.name}")
            
            records, error = importer.import_file(str(file_path))
            
            if error:
                logger.error(f"文件处理失败: {error}")
                file_errors[file_path.name] = error
                
                if not config['processing'].get('continue_on_error', True):
                    logger.error("配置为遇到错误即停止，程序退出")
                    sys.exit(1)
                continue
            
            if records:
                processed, failed = processor.process(records)
                all_records.extend(processed)
                all_failed_records.extend(failed)
                
                logger.info(
                    f"文件 {file_path.name} 处理完成: "
                    f"成功 {len(processed)} 条, "
                    f"失败 {len(failed)} 条"
                )
        
        logger.info("=" * 50)
        logger.info("所有文件处理完成")
        logger.info(f"总计: 成功 {len(all_records)} 条, 失败 {len(all_failed_records)} 条")
        
        if all_records:
            exporter.export(
                all_records,
                all_failed_records,
                processor.get_warnings(),
                args.output_dir,
                file_errors
            )
        
        logger.info("=" * 50)
        logger.info("处理完成")
        
    except KeyboardInterrupt:
        logger.info("用户中断处理")
        sys.exit(1)
    except Exception as e:
        logger.exception(f"程序发生错误: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
