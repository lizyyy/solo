#!/usr/bin/env python3
"""
批量短信退订清洗 CLI 工具

功能：
- 导入客户名单、退订名单、黑名单和最近发送记录
- 输出可发送清单、被过滤清单和原因统计
- 处理手机号格式错误、同一客户多手机号、超过频控、退订又重新订阅等情况
- 重复运行同一批输入结果稳定
- 人工白名单调整留痕
- 被过滤号码可单独复查和解释
"""

import argparse
import csv
import hashlib
import json
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 手机号正则（中国大陆手机号）
PHONE_PATTERN = re.compile(r'^1[3-9]\d{9}$')

# 过滤原因代码和描述
FILTER_REASONS = {
    'PHONE_INVALID': '手机号格式错误',
    'BLACKLIST': '黑名单号码',
    'UNSUBSCRIBED': '已退订',
    'FREQUENCY_EXCEEDED': '超过频控限制',
    'DUPLICATE_PHONE': '号码重复',
    'DUPLICATE_CUSTOMER': '同一客户多手机号',
    'WHITELIST_OVERRIDE': '白名单强制覆盖',
}


class SMSCleaner:
    """短信清洗核心类"""

    def __init__(
        self,
        customer_file: str,
        unsubscribe_file: str = None,
        blacklist_file: str = None,
        recent_send_file: str = None,
        whitelist_file: str = None,
        frequency_limit: int = 3,
        frequency_days: int = 7,
        output_dir: str = 'output',
        deduplicate_by_customer: bool = True,
    ):
        self.customer_file = customer_file
        self.unsubscribe_file = unsubscribe_file
        self.blacklist_file = blacklist_file
        self.recent_send_file = recent_send_file
        self.whitelist_file = whitelist_file
        self.frequency_limit = frequency_limit
        self.frequency_days = frequency_days
        self.output_dir = Path(output_dir)
        self.deduplicate_by_customer = deduplicate_by_customer

        # 数据存储
        self.customers: List[Dict] = []
        self.unsubscribes: Set[str] = set()
        self.blacklist: Set[str] = set()
        self.recent_sends: Dict[str, List[datetime]] = defaultdict(list)
        self.whitelist: Dict[str, str] = {}  # phone -> reason
        self.whitelist_log: List[Dict] = []

        # 结果统计
        self.stats = {
            'total_customers': 0,
            'valid_phones': 0,
            'filtered_phones': 0,
            'reasons': defaultdict(int),
        }

        # 结果数据
        self.sendable: List[Dict] = []
        self.filtered: List[Dict] = []

        # 创建输出目录
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def load_csv(self, file_path: str) -> List[Dict]:
        """加载CSV文件"""
        if not file_path or not os.path.exists(file_path):
            return []

        data = []
        try:
            with open(file_path, 'r', encoding='utf-8-sig', newline='') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    data.append({k.strip(): v.strip() for k, v in row.items()})
            logger.info(f"已加载 {len(data)} 条记录: {file_path}")
        except Exception as e:
            logger.error(f"加载文件失败 {file_path}: {e}")
            raise
        return data

    def load_unsubscribes(self):
        """加载退订名单"""
        if not self.unsubscribe_file:
            return

        data = self.load_csv(self.unsubscribe_file)
        # 查找手机号列
        phone_col = self._find_phone_column(data[0].keys()) if data else None

        for row in data:
            phone = self._normalize_phone(row.get(phone_col, '') if phone_col else list(row.values())[0])
            if phone:
                self.unsubscribes.add(phone)

        logger.info(f"退订名单: {len(self.unsubscribes)} 个号码")

    def load_blacklist(self):
        """加载黑名单"""
        if not self.blacklist_file:
            return

        data = self.load_csv(self.blacklist_file)
        phone_col = self._find_phone_column(data[0].keys()) if data else None

        for row in data:
            phone = self._normalize_phone(row.get(phone_col, '') if phone_col else list(row.values())[0])
            if phone:
                self.blacklist.add(phone)

        logger.info(f"黑名单: {len(self.blacklist)} 个号码")

    def load_recent_sends(self):
        """加载最近发送记录"""
        if not self.recent_send_file:
            return

        data = self.load_csv(self.recent_send_file)
        if not data:
            return

        # 查找列
        cols = data[0].keys()
        phone_col = self._find_phone_column(cols)
        time_col = self._find_time_column(cols)

        cutoff_time = datetime.now() - timedelta(days=self.frequency_days)

        for row in data:
            phone = self._normalize_phone(row.get(phone_col, '')) if phone_col else self._normalize_phone(list(row.values())[0])
            if not phone:
                continue

            send_time = None
            if time_col and row.get(time_col):
                try:
                    send_time = datetime.strptime(row[time_col], '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        send_time = datetime.strptime(row[time_col], '%Y-%m-%d')
                    except ValueError:
                        pass

            if send_time and send_time >= cutoff_time:
                self.recent_sends[phone].append(send_time)

        logger.info(f"最近发送记录: {len(self.recent_sends)} 个号码在 {self.frequency_days} 天内")

    def load_whitelist(self):
        """加载白名单"""
        if not self.whitelist_file or not os.path.exists(self.whitelist_file):
            return

        with open(self.whitelist_file, 'r', encoding='utf-8') as f:
            whitelist_data = json.load(f)

        for item in whitelist_data:
            phone = self._normalize_phone(item.get('phone', ''))
            if phone:
                self.whitelist[phone] = item.get('reason', '白名单')
                self.whitelist_log.append({
                    'timestamp': item.get('timestamp', ''),
                    'phone': phone,
                    'operator': item.get('operator', ''),
                    'reason': item.get('reason', ''),
                })

        logger.info(f"白名单: {len(self.whitelist)} 个号码")

    def load_customers(self):
        """加载客户名单"""
        data = self.load_csv(self.customer_file)
        self.stats['total_customers'] = len(data)

        if not data:
            logger.error("客户名单为空")
            return

        cols = data[0].keys()
        phone_col = self._find_phone_column(cols)
        name_col = self._find_name_column(cols)
        customer_id_col = self._find_customer_id_column(cols)

        for idx, row in enumerate(data, 1):
            customer = {
                'row_index': idx,
                'original_data': row.copy(),
                'phones': [],
                'customer_id': row.get(customer_id_col, f'CUST_{idx}') if customer_id_col else f'CUST_{idx}',
                'name': row.get(name_col, '') if name_col else '',
            }

            # 提取所有可能的手机号
            if phone_col:
                phone_text = row.get(phone_col, '')
                for p in self._extract_phones(phone_text):
                    customer['phones'].append(p)
            else:
                # 如果没有明确的手机号列，检查所有字段
                for value in row.values():
                    for p in self._extract_phones(str(value)):
                        if p not in customer['phones']:
                            customer['phones'].append(p)

            self.customers.append(customer)

        logger.info(f"客户名单: {len(self.customers)} 条记录")

    def _find_phone_column(self, cols) -> Optional[str]:
        """查找手机号列"""
        keywords = ['手机', '电话', 'phone', 'mobile', 'tel']
        for col in cols:
            for kw in keywords:
                if kw in col.lower():
                    return col
        return None

    def _find_name_column(self, cols) -> Optional[str]:
        """查找姓名列"""
        keywords = ['姓名', '客户名', '客户姓名', 'name', 'customer']
        for col in cols:
            for kw in keywords:
                if kw in col.lower():
                    return col
        return None

    def _find_customer_id_column(self, cols) -> Optional[str]:
        """查找客户ID列"""
        keywords = ['客户id', '客户编号', 'id', 'customer_id', 'cust_id']
        for col in cols:
            for kw in keywords:
                if kw in col.lower():
                    return col
        return None

    def _find_time_column(self, cols) -> Optional[str]:
        """查找时间列"""
        keywords = ['时间', '日期', '发送时间', 'time', 'date', 'send_time']
        for col in cols:
            for kw in keywords:
                if kw in col.lower():
                    return col
        return None

    def _normalize_phone(self, phone: str) -> str:
        """标准化手机号"""
        if not phone:
            return ''
        phone = str(phone).strip()
        phone = phone.replace(' ', '').replace('-', '').replace('+', '')
        if phone.startswith('86') and len(phone) == 13:
            phone = phone[2:]
        return phone

    def _extract_phones(self, text: str) -> List[str]:
        """从文本中提取手机号"""
        if not text:
            return []
        # 尝试分割多个手机号
        separators = [',', '，', ';', '；', '|', '/', '、', ' ']
        phones = []

        # 先尝试按分隔符分割
        for sep in separators:
            if sep in text:
                for part in text.split(sep):
                    phone = self._normalize_phone(part)
                    if self._validate_phone(phone):
                        phones.append(phone)
                if phones:
                    return list(set(phones))

        # 如果没有分隔符，正则匹配
        phone = self._normalize_phone(text)
        if self._validate_phone(phone):
            phones.append(phone)

        return list(set(phones))

    def _validate_phone(self, phone: str) -> bool:
        """验证手机号格式"""
        if not phone:
            return False
        return bool(PHONE_PATTERN.match(phone))

    def clean(self):
        """执行清洗流程"""
        logger.info("开始清洗...")
        print("\n" + "="*60)
        print("开始清洗流程")
        print("="*60)

        # 加载所有数据
        self.load_customers()
        self.load_unsubscribes()
        self.load_blacklist()
        self.load_recent_sends()
        self.load_whitelist()

        print(f"\n[输入统计]")
        print(f"  客户名单: {self.stats['total_customers']} 条")
        print(f"  退订名单: {len(self.unsubscribes)} 个号码")
        print(f"  黑名单: {len(self.blacklist)} 个号码")
        print(f"  白名单: {len(self.whitelist)} 个号码")

        # 处理每个客户
        seen_phones: Set[str] = set()
        seen_customers: Set[str] = set()

        for customer in self.customers:
            if not customer['phones']:
                # 没有手机号，全部过滤
                self._add_filtered(
                    customer,
                    'N/A',
                    'PHONE_INVALID',
                    '未找到有效手机号'
                )
                continue

            # 处理每个手机号
            for phone in customer['phones']:
                # 1. 检查手机号格式
                if not self._validate_phone(phone):
                    self._add_filtered(
                        customer,
                        phone,
                        'PHONE_INVALID',
                        f'格式错误: {phone}'
                    )
                    continue

                self.stats['valid_phones'] += 1

                # 2. 检查是否在白名单中
                is_whitelisted = phone in self.whitelist

                # 3. 检查黑名单（白名单跳过）
                if not is_whitelisted and phone in self.blacklist:
                    self._add_filtered(
                        customer,
                        phone,
                        'BLACKLIST',
                        '号码在黑名单中'
                    )
                    continue

                # 4. 检查退订（白名单跳过）
                if not is_whitelisted and phone in self.unsubscribes:
                    self._add_filtered(
                        customer,
                        phone,
                        'UNSUBSCRIBED',
                        '用户已退订'
                    )
                    continue

                # 5. 检查频控（白名单跳过）
                if not is_whitelisted:
                    recent_count = len(self.recent_sends.get(phone, []))
                    if recent_count >= self.frequency_limit:
                        self._add_filtered(
                            customer,
                            phone,
                            'FREQUENCY_EXCEEDED',
                            f'{self.frequency_days}天内已发送{recent_count}次，超过限制{self.frequency_limit}次'
                        )
                        continue

                # 6. 检查号码重复
                if phone in seen_phones:
                    self._add_filtered(
                        customer,
                        phone,
                        'DUPLICATE_PHONE',
                        '号码在本次任务中重复出现'
                    )
                    continue
                seen_phones.add(phone)

                # 7. 检查同一客户多手机号
                if self.deduplicate_by_customer and customer['customer_id'] in seen_customers:
                    self._add_filtered(
                        customer,
                        phone,
                        'DUPLICATE_CUSTOMER',
                        f'同一客户已保留其他手机号'
                    )
                    continue
                seen_customers.add(customer['customer_id'])

                # 通过所有检查
                self._add_sendable(customer, phone)

        # 输出统计
        self._print_stats()

        # 导出结果
        self._export_results()

        logger.info("清洗完成")

    def _add_sendable(self, customer: Dict, phone: str):
        """添加到可发送清单"""
        whitelist_note = self.whitelist.get(phone, '')
        self.sendable.append({
            'customer_id': customer['customer_id'],
            'name': customer['name'],
            'phone': phone,
            'whitelist': '是' if whitelist_note else '否',
            'whitelist_reason': whitelist_note,
            **customer['original_data'],
        })

    def _add_filtered(self, customer: Dict, phone: str, reason_code: str, reason_detail: str):
        """添加到过滤清单"""
        self.filtered.append({
            'customer_id': customer['customer_id'],
            'name': customer['name'],
            'phone': phone,
            'reason_code': reason_code,
            'reason': FILTER_REASONS.get(reason_code, reason_code),
            'detail': reason_detail,
            **customer['original_data'],
        })
        self.stats['reasons'][reason_code] += 1
        self.stats['filtered_phones'] += 1

    def _print_stats(self):
        """打印统计信息"""
        print("\n" + "="*60)
        print("清洗结果统计")
        print("="*60)

        total_valid = self.stats['valid_phones']
        sendable_count = len(self.sendable)
        filtered_count = len(self.filtered)

        print(f"\n[总体统计]")
        print(f"  客户总数: {self.stats['total_customers']} 条")
        print(f"  有效手机号: {total_valid} 个")
        print(f"  可发送: {sendable_count} 个 ({sendable_count/total_valid*100:.1f}%)" if total_valid > 0 else "  可发送: 0 个")
        print(f"  被过滤: {filtered_count} 个 ({filtered_count/total_valid*100:.1f}%)" if total_valid > 0 else "  被过滤: 0 个")

        print(f"\n[过滤原因分布]")
        for code, count in sorted(self.stats['reasons'].items(), key=lambda x: -x[1]):
            desc = FILTER_REASONS.get(code, code)
            pct = count / filtered_count * 100 if filtered_count > 0 else 0
            print(f"  {desc}: {count} 个 ({pct:.1f}%)")

        if self.whitelist_log:
            print(f"\n[白名单覆盖记录]")
            for item in self.whitelist_log:
                print(f"  {item['timestamp']} - {item['phone']}: {item['reason']} (操作员: {item['operator']})")

    def _generate_input_hash(self) -> str:
        """生成输入文件哈希，确保结果可重复"""
        files_to_hash = [self.customer_file]
        for f in [self.unsubscribe_file, self.blacklist_file, self.recent_send_file, self.whitelist_file]:
            if f and os.path.exists(f):
                files_to_hash.append(f)

        hasher = hashlib.sha256()
        for f in files_to_hash:
            with open(f, 'rb') as file:
                hasher.update(file.read())

        # 加入参数
        params = f"{self.frequency_limit}_{self.frequency_days}_{self.deduplicate_by_customer}"
        hasher.update(params.encode())

        return hasher.hexdigest()[:16]

    def _export_results(self):
        """导出结果"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        input_hash = self._generate_input_hash()
        prefix = f"{timestamp}_{input_hash}"

        # 可发送清单
        sendable_file = self.output_dir / f'{prefix}_可发送清单.csv'
        self._write_csv(sendable_file, self.sendable)
        logger.info(f"可发送清单已导出: {sendable_file}")

        # 被过滤清单
        filtered_file = self.output_dir / f'{prefix}_被过滤清单.csv'
        self._write_csv(filtered_file, self.filtered)
        logger.info(f"被过滤清单已导出: {filtered_file}")

        # 原因统计
        stats_file = self.output_dir / f'{prefix}_清洗统计.json'
        stats_data = {
            'timestamp': datetime.now().isoformat(),
            'input_hash': input_hash,
            'statistics': {
                'total_customers': self.stats['total_customers'],
                'valid_phones': self.stats['valid_phones'],
                'sendable_count': len(self.sendable),
                'filtered_count': len(self.filtered),
                'reasons': dict(self.stats['reasons']),
            },
            'parameters': {
                'frequency_limit': self.frequency_limit,
                'frequency_days': self.frequency_days,
                'deduplicate_by_customer': self.deduplicate_by_customer,
            },
            'files': {
                'customer': self.customer_file,
                'unsubscribe': self.unsubscribe_file,
                'blacklist': self.blacklist_file,
                'recent_send': self.recent_send_file,
                'whitelist': self.whitelist_file,
            },
            'whitelist_log': self.whitelist_log,
        }

        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats_data, f, ensure_ascii=False, indent=2)
        logger.info(f"统计信息已导出: {stats_file}")

        print(f"\n[导出文件]")
        print(f"  可发送清单: {sendable_file}")
        print(f"  被过滤清单: {filtered_file}")
        print(f"  清洗统计: {stats_file}")

    def _write_csv(self, file_path: Path, data: List[Dict]):
        """写入CSV文件"""
        if not data:
            # 空数据也要写表头
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                f.write('')
            return

        # 收集所有列
        all_keys = set()
        for row in data:
            all_keys.update(row.keys())

        # 优先排前几列
        priority_cols = ['customer_id', 'name', 'phone', 'whitelist', 'whitelist_reason', 
                        'reason_code', 'reason', 'detail']
        cols = priority_cols + [k for k in sorted(all_keys) if k not in priority_cols]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(data)


class WhitelistManager:
    """白名单管理器"""

    def __init__(self, whitelist_file: str = 'data/whitelist.json'):
        self.whitelist_file = Path(whitelist_file)
        self.whitelist_file.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> List[Dict]:
        """加载白名单"""
        if not self.whitelist_file.exists():
            return []
        with open(self.whitelist_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save(self, data: List[Dict]):
        """保存白名单"""
        with open(self.whitelist_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add(self, phone: str, reason: str, operator: str = 'manual') -> bool:
        """添加白名单"""
        phone = self._normalize_phone(phone)
        if not self._validate_phone(phone):
            logger.error(f"无效手机号: {phone}")
            return False

        whitelist = self.load()

        # 检查是否已存在
        for item in whitelist:
            if self._normalize_phone(item['phone']) == phone:
                item['reason'] = reason
                item['operator'] = operator
                item['updated_at'] = datetime.now().isoformat()
                logger.info(f"已更新白名单: {phone}")
                self.save(whitelist)
                return True

        # 添加新记录
        whitelist.append({
            'phone': phone,
            'reason': reason,
            'operator': operator,
            'timestamp': datetime.now().isoformat(),
        })
        self.save(whitelist)
        logger.info(f"已添加白名单: {phone}")
        return True

    def remove(self, phone: str) -> bool:
        """移除白名单"""
        phone = self._normalize_phone(phone)
        whitelist = self.load()
        original_len = len(whitelist)

        whitelist = [item for item in whitelist if self._normalize_phone(item['phone']) != phone]

        if len(whitelist) < original_len:
            self.save(whitelist)
            logger.info(f"已移除白名单: {phone}")
            return True
        else:
            logger.warning(f"白名单中未找到: {phone}")
            return False

    def list(self):
        """列出白名单"""
        whitelist = self.load()
        print(f"\n白名单 ({len(whitelist)} 个号码):")
        print("-"*60)
        for item in whitelist:
            print(f"  {item['phone']} - {item['reason']} (操作员: {item['operator']}, 时间: {item['timestamp']})")
        print("-"*60)

    def _normalize_phone(self, phone: str) -> str:
        if not phone:
            return ''
        phone = str(phone).strip()
        phone = phone.replace(' ', '').replace('-', '').replace('+', '')
        if phone.startswith('86') and len(phone) == 13:
            phone = phone[2:]
        return phone

    def _validate_phone(self, phone: str) -> bool:
        if not phone:
            return False
        return bool(PHONE_PATTERN.match(phone))


class FilteredReviewer:
    """被过滤号码复查器"""

    def __init__(self, filtered_file: str):
        self.filtered_file = filtered_file
        self.records: List[Dict] = []

    def load(self):
        """加载被过滤清单"""
        if not os.path.exists(self.filtered_file):
            logger.error(f"文件不存在: {self.filtered_file}")
            return

        with open(self.filtered_file, 'r', encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            self.records = list(reader)

        logger.info(f"已加载 {len(self.records)} 条被过滤记录")

    def list(self, reason_code: str = None):
        """列出被过滤记录"""
        print(f"\n被过滤记录 ({len(self.records)} 条):")
        print("="*80)

        filtered = self.records
        if reason_code:
            filtered = [r for r in self.records if r.get('reason_code') == reason_code]

        for idx, record in enumerate(filtered, 1):
            print(f"\n[{idx}] 手机号: {record.get('phone', 'N/A')}")
            print(f"    客户ID: {record.get('customer_id', 'N/A')}")
            print(f"    客户姓名: {record.get('name', 'N/A')}")
            print(f"    过滤原因: {record.get('reason', 'N/A')} ({record.get('reason_code', 'N/A')})")
            print(f"    详细说明: {record.get('detail', 'N/A')}")

    def explain(self, phone: str):
        """解释特定号码的过滤原因"""
        for record in self.records:
            if record.get('phone') == phone:
                print(f"\n{'='*60}")
                print(f"号码 {phone} 的过滤详情")
                print(f"{'='*60}")
                print(f"\n客户信息:")
                print(f"  客户ID: {record.get('customer_id', 'N/A')}")
                print(f"  姓名: {record.get('name', 'N/A')}")
                print(f"\n过滤原因:")
                print(f"  代码: {record.get('reason_code', 'N/A')}")
                print(f"  描述: {record.get('reason', 'N/A')}")
                print(f"  详情: {record.get('detail', 'N/A')}")
                print(f"\n原始数据:")
                for key, value in record.items():
                    if key not in ['customer_id', 'name', 'phone', 'reason', 'reason_code', 'detail']:
                        print(f"  {key}: {value}")
                return

        print(f"未找到号码 {phone} 的过滤记录")

    def stats(self):
        """统计分析"""
        reason_stats = defaultdict(int)
        for record in self.records:
            reason_stats[record.get('reason_code', 'UNKNOWN')] += 1

        print(f"\n{'='*60}")
        print("被过滤记录统计")
        print(f"{'='*60}")
        print(f"\n总计: {len(self.records)} 条")
        print(f"\n按原因分布:")
        for code, count in sorted(reason_stats.items(), key=lambda x: -x[1]):
            desc = FILTER_REASONS.get(code, code)
            print(f"  {desc} ({code}): {count} 条 ({count/len(self.records)*100:.1f}%)")


def create_samples():
    """创建样例数据"""
    data_dir = Path('data')
    data_dir.mkdir(parents=True, exist_ok=True)

    # 客户名单样例
    customers = [
        {'客户ID': 'C001', '姓名': '张三', '手机号': '13800000001'},
        {'客户ID': 'C002', '姓名': '李四', '手机号': '13800000002,13800000003'},
        {'客户ID': 'C003', '姓名': '王五', '手机号': '13800000004'},
        {'客户ID': 'C004', '姓名': '赵六', '手机号': '13800000005'},
        {'客户ID': 'C005', '姓名': '钱七', '手机号': '13800000006'},
        {'客户ID': 'C006', '姓名': '孙八', '手机号': '13800000007'},
        {'客户ID': 'C007', '姓名': '周九', '手机号': '13800000008'},
        {'客户ID': 'C008', '姓名': '吴十', '手机号': '1234567890'},  # 格式错误
        {'客户ID': 'C009', '姓名': '郑十一', '手机号': '13800000009'},
        {'客户ID': 'C010', '姓名': '王十二', '手机号': '13800000010'},
    ]

    customer_file = data_dir / '客户名单.csv'
    with open(customer_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['客户ID', '姓名', '手机号'])
        writer.writeheader()
        writer.writerows(customers)

    # 退订名单样例
    unsubscribes = [
        {'手机号': '13800000004'},
        {'手机号': '13800000005'},
    ]

    unsubscribe_file = data_dir / '退订名单.csv'
    with open(unsubscribe_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['手机号'])
        writer.writeheader()
        writer.writerows(unsubscribes)

    # 黑名单样例
    blacklist = [
        {'手机号': '13800000006'},
    ]

    blacklist_file = data_dir / '黑名单.csv'
    with open(blacklist_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['手机号'])
        writer.writeheader()
        writer.writerows(blacklist)

    # 最近发送记录样例
    recent_sends = [
        {'手机号': '13800000007', '发送时间': '2026-05-10 10:00:00'},
        {'手机号': '13800000007', '发送时间': '2026-05-08 14:30:00'},
        {'手机号': '13800000007', '发送时间': '2026-05-05 09:15:00'},
        {'手机号': '13800000009', '发送时间': '2026-05-09 16:00:00'},
    ]

    recent_file = data_dir / '最近发送记录.csv'
    with open(recent_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['手机号', '发送时间'])
        writer.writeheader()
        writer.writerows(recent_sends)

    # 白名单样例
    whitelist = [
        {
            'phone': '13800000005',
            'reason': '重要VIP客户，手动解除退订限制',
            'operator': '市场部-李经理',
            'timestamp': '2026-05-10T09:00:00',
        }
    ]

    whitelist_file = data_dir / 'whitelist.json'
    with open(whitelist_file, 'w', encoding='utf-8') as f:
        json.dump(whitelist, f, ensure_ascii=False, indent=2)

    logger.info(f"样例数据已创建在: {data_dir}")
    print(f"\n样例数据已创建:")
    print(f"  {customer_file}")
    print(f"  {unsubscribe_file}")
    print(f"  {blacklist_file}")
    print(f"  {recent_file}")
    print(f"  {whitelist_file}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='批量短信退订清洗 CLI 工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  # 使用样例数据运行
  python sms_cleaner.py clean --customer data/客户名单.csv --unsubscribe data/退订名单.csv \\
      --blacklist data/黑名单.csv --recent data/最近发送记录.csv --whitelist data/whitelist.json

  # 自定义频控参数
  python sms_cleaner.py clean --customer 客户.csv --frequency-limit 5 --frequency-days 14

  # 管理白名单
  python sms_cleaner.py whitelist --list
  python sms_cleaner.py whitelist --add 13800000001 --reason "VIP客户" --operator "张经理"
  python sms_cleaner.py whitelist --remove 13800000001

  # 复查被过滤号码
  python sms_cleaner.py review --file output/20260511_120000_abc123_被过滤清单.csv --stats
  python sms_cleaner.py review --file output/..._被过滤清单.csv --explain 13800000001

  # 创建样例数据
  python sms_cleaner.py sample
        '''
    )

    subparsers = parser.add_subparsers(dest='command', help='子命令')

    # clean 子命令
    clean_parser = subparsers.add_parser('clean', help='执行短信清洗')
    clean_parser.add_argument('--customer', required=True, help='客户名单CSV文件')
    clean_parser.add_argument('--unsubscribe', help='退订名单CSV文件')
    clean_parser.add_argument('--blacklist', help='黑名单CSV文件')
    clean_parser.add_argument('--recent', help='最近发送记录CSV文件')
    clean_parser.add_argument('--whitelist', help='白名单JSON文件')
    clean_parser.add_argument('--frequency-limit', type=int, default=3, help='频控次数限制 (默认: 3)')
    clean_parser.add_argument('--frequency-days', type=int, default=7, help='频控时间窗口 (默认: 7天)')
    clean_parser.add_argument('--output-dir', default='output', help='输出目录 (默认: output)')
    clean_parser.add_argument('--no-dedup-customer', action='store_true', help='不按客户去重（允许多手机号）')

    # whitelist 子命令
    wl_parser = subparsers.add_parser('whitelist', help='白名单管理')
    wl_parser.add_argument('--file', default='data/whitelist.json', help='白名单文件')
    wl_parser.add_argument('--list', action='store_true', help='列出所有白名单')
    wl_parser.add_argument('--add', help='添加白名单手机号')
    wl_parser.add_argument('--remove', help='移除白名单手机号')
    wl_parser.add_argument('--reason', help='白名单原因')
    wl_parser.add_argument('--operator', default='manual', help='操作员')

    # review 子命令
    review_parser = subparsers.add_parser('review', help='复查被过滤号码')
    review_parser.add_argument('--file', required=True, help='被过滤清单CSV文件')
    review_parser.add_argument('--list', action='store_true', help='列出所有记录')
    review_parser.add_argument('--stats', action='store_true', help='统计分析')
    review_parser.add_argument('--explain', help='解释特定号码的过滤原因')
    review_parser.add_argument('--reason', help='按原因代码过滤')

    # sample 子命令
    subparsers.add_parser('sample', help='创建样例数据')

    args = parser.parse_args()

    if args.command == 'clean':
        cleaner = SMSCleaner(
            customer_file=args.customer,
            unsubscribe_file=args.unsubscribe,
            blacklist_file=args.blacklist,
            recent_send_file=args.recent,
            whitelist_file=args.whitelist,
            frequency_limit=args.frequency_limit,
            frequency_days=args.frequency_days,
            output_dir=args.output_dir,
            deduplicate_by_customer=not args.no_dedup_customer,
        )
        cleaner.clean()

    elif args.command == 'whitelist':
        wm = WhitelistManager(args.file)
        if args.list:
            wm.list()
        elif args.add:
            if not args.reason:
                logger.error("添加白名单必须指定 --reason 参数")
                sys.exit(1)
            wm.add(args.add, args.reason, args.operator)
        elif args.remove:
            wm.remove(args.remove)
        else:
            wm.list()

    elif args.command == 'review':
        reviewer = FilteredReviewer(args.file)
        reviewer.load()
        if args.stats:
            reviewer.stats()
        elif args.explain:
            reviewer.explain(args.explain)
        elif args.list:
            reviewer.list(args.reason)
        else:
            reviewer.stats()

    elif args.command == 'sample':
        create_samples()

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
