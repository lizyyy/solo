#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import sqlite3
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import Counter
import uuid

class DeviceAuditCLI:
    """远程设备指令审计CLI工具"""
    
    def __init__(self, work_dir: str = None):
        self.work_dir = work_dir or os.path.join(os.path.expanduser("~"), ".device_audit")
        self.db_path = os.path.join(self.work_dir, "audit.db")
        self.config_path = os.path.join(self.work_dir, "config.json")
        self.data_path = os.path.join(self.work_dir, "data")
        self._init_database()
    
    def _init_database(self):
        """初始化数据库"""
        os.makedirs(self.work_dir, exist_ok=True)
        os.makedirs(self.data_path, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                ip TEXT,
                status TEXT DEFAULT 'unknown',
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS device_group_mapping (
                device_id TEXT,
                group_id TEXT,
                PRIMARY KEY (device_id, group_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS command_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                is_dangerous BOOLEAN DEFAULT 0,
                params_json TEXT,
                created_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS batches (
                id TEXT PRIMARY KEY,
                command_template_id TEXT,
                params_json TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                created_by TEXT DEFAULT 'system',
                FOREIGN KEY (command_template_id) REFERENCES command_templates(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS executions (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                attempt_count INTEGER DEFAULT 0,
                max_attempts INTEGER DEFAULT 3,
                last_error TEXT,
                request_log TEXT,
                response_log TEXT,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (batch_id) REFERENCES batches(id),
                FOREIGN KEY (device_id) REFERENCES devices(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                batch_id TEXT,
                execution_id TEXT,
                device_id TEXT,
                action TEXT NOT NULL,
                before_data TEXT,
                after_data TEXT,
                operator TEXT DEFAULT 'system',
                reason TEXT,
                created_at TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def _get_config(self) -> Dict:
        """获取配置"""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _save_config(self, config: Dict):
        """保存配置"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    
    def _execute_sql(self, sql: str, params: tuple = None) -> list:
        """执行SQL查询"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        result = cursor.fetchall()
        conn.commit()
        conn.close()
        return result
    
    def _insert(self, table: str, data: Dict):
        """插入数据"""
        keys = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        sql = f"INSERT INTO {table} ({keys}) VALUES ({placeholders})"
        self._execute_sql(sql, tuple(data.values()))
    
    def _update(self, table: str, data: Dict, condition: Dict):
        """更新数据"""
        set_clause = ', '.join([f"{k}=?" for k in data.keys()])
        where_clause = ' AND '.join([f"{k}=?" for k in condition.keys()])
        sql = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
        self._execute_sql(sql, tuple(data.values()) + tuple(condition.values()))
    
    def _generate_id(self, prefix: str = "") -> str:
        """生成唯一ID"""
        return f"{prefix}{uuid.uuid4().hex[:8]}"
    
    # ========== 命令实现 ==========
    
    def init(self, args):
        """初始化命令"""
        print("=" * 60)
        print("初始化远程设备指令审计环境")
        print("=" * 60)
        
        self._init_database()
        
        config = self._get_config()
        config['work_dir'] = self.work_dir
        config['max_retries'] = 3
        config['skip_offline'] = True
        config['idempotent_check'] = True
        self._save_config(config)
        
        print(f"✓ 工作目录: {self.work_dir}")
        print(f"✓ 数据库文件: {self.db_path}")
        print(f"✓ 数据目录: {self.data_path}")
        print()
        print("初始化完成！使用 'device_audit_cli.py import --examples' 导入样例数据")
    
    def import_data(self, args):
        """导入数据命令"""
        print("=" * 60)
        print("导入数据")
        print("=" * 60)
        
        if args.examples:
            self._import_example_data()
            return
        
        if args.devices:
            self._import_devices(args.devices)
        
        if args.groups:
            self._import_groups(args.groups)
        
        if args.templates:
            self._import_templates(args.templates)
    
    def _import_example_data(self):
        """导入样例数据"""
        print("\n正在导入样例数据...")
        
        devices = [
            {"id": "GW-001", "name": "主网关-机房A", "type": "gateway", "ip": "192.168.1.1", "status": "online"},
            {"id": "GW-002", "name": "备用网关-机房A", "type": "gateway", "ip": "192.168.1.2", "status": "online"},
            {"id": "GW-003", "name": "网关-机房B", "type": "gateway", "ip": "192.168.1.3", "status": "offline"},
            {"id": "CAM-001", "name": "摄像头-入口", "type": "camera", "ip": "192.168.1.10", "status": "online"},
            {"id": "CAM-002", "name": "摄像头-走廊", "type": "camera", "ip": "192.168.1.11", "status": "online"},
            {"id": "CAM-003", "name": "摄像头-仓库", "type": "camera", "ip": "192.168.1.12", "status": "online"},
            {"id": "SEN-001", "name": "温度传感器-车间", "type": "sensor", "ip": "192.168.1.20", "status": "online"},
            {"id": "SEN-002", "name": "湿度传感器-仓库", "type": "sensor", "ip": "192.168.1.21", "status": "online"},
            {"id": "SEN-003", "name": "压力传感器-管道", "type": "sensor", "ip": "192.168.1.22", "status": "online"},
        ]
        
        groups = [
            {"id": "GRP-ALL", "name": "全部设备", "description": "所有边缘设备"},
            {"id": "GRP-GW", "name": "网关设备", "description": "网络网关设备"},
            {"id": "GRP-CAM", "name": "摄像头设备", "description": "监控摄像头"},
            {"id": "GRP-SEN", "name": "传感器设备", "description": "环境传感器"},
            {"id": "GRP-ROOM-A", "name": "机房A设备", "description": "机房A的所有设备"},
        ]
        
        group_mappings = [
            # GRP-ALL
            ("GW-001", "GRP-ALL"), ("GW-002", "GRP-ALL"), ("GW-003", "GRP-ALL"),
            ("CAM-001", "GRP-ALL"), ("CAM-002", "GRP-ALL"), ("CAM-003", "GRP-ALL"),
            ("SEN-001", "GRP-ALL"), ("SEN-002", "GRP-ALL"), ("SEN-003", "GRP-ALL"),
            # GRP-GW
            ("GW-001", "GRP-GW"), ("GW-002", "GRP-GW"), ("GW-003", "GRP-GW"),
            # GRP-CAM
            ("CAM-001", "GRP-CAM"), ("CAM-002", "GRP-CAM"), ("CAM-003", "GRP-CAM"),
            # GRP-SEN
            ("SEN-001", "GRP-SEN"), ("SEN-002", "GRP-SEN"), ("SEN-003", "GRP-SEN"),
            # GRP-ROOM-A
            ("GW-001", "GRP-ROOM-A"), ("GW-002", "GRP-ROOM-A"),
        ]
        
        templates = [
            {
                "id": "TPL-PING", "name": "设备心跳检测", "type": "status",
                "content": "ping -c 3 {target_ip}",
                "is_dangerous": 0,
                "params_json": '{"required": ["target_ip"]}'
            },
            {
                "id": "TPL-CONFIG-SYNC", "name": "同步配置文件", "type": "config",
                "content": "scp /local/config.json {device_ip}:/etc/config.json",
                "is_dangerous": 1,
                "params_json": '{"required": ["device_ip"]}'
            },
            {
                "id": "TPL-REBOOT", "name": "重启设备", "type": "system",
                "content": "reboot",
                "is_dangerous": 1,
                "params_json": '{"required": []}'
            },
            {
                "id": "TPL-CAM-SNAPSHOT", "name": "摄像头快照", "type": "camera",
                "content": "capture --output {output_path}",
                "is_dangerous": 0,
                "params_json": '{"required": ["output_path"]}'
            },
            {
                "id": "TPL-SEN-READ", "name": "读取传感器数据", "type": "sensor",
                "content": "read-sensor --type {sensor_type}",
                "is_dangerous": 0,
                "params_json": '{"required": ["sensor_type"]}'
            },
        ]
        
        # 清空旧数据
        self._execute_sql("DELETE FROM device_group_mapping")
        self._execute_sql("DELETE FROM devices")
        self._execute_sql("DELETE FROM groups")
        self._execute_sql("DELETE FROM command_templates")
        
        now = datetime.now().isoformat()
        
        for device in devices:
            self._insert("devices", {
                **device,
                "created_at": now,
                "updated_at": now
            })
        
        for group in groups:
            self._insert("groups", {
                **group,
                "created_at": now
            })
        
        for device_id, group_id in group_mappings:
            self._insert("device_group_mapping", {
                "device_id": device_id,
                "group_id": group_id
            })
        
        for template in templates:
            self._insert("command_templates", {
                **template,
                "created_at": now
            })
        
        print(f"✓ 导入 {len(devices)} 个设备")
        print(f"✓ 导入 {len(groups)} 个分组")
        print(f"✓ 导入 {len(templates)} 个指令模板")
        
        print("\n" + "=" * 60)
        print("样例数据导入完成！")
        print("=" * 60)
        print("\n可用设备:")
        for d in devices:
            status_emoji = "✅" if d['status'] == 'online' else "❌"
            print(f"  {status_emoji} {d['id']} - {d['name']} ({d['type']}) - {d['ip']}")
        
        print("\n可用分组:")
        for g in groups:
            print(f"  📁 {g['id']} - {g['name']}")
        
        print("\n可用指令模板:")
        for t in templates:
            danger_emoji = "⚠️" if t['is_dangerous'] else "🔓"
            print(f"  {danger_emoji} {t['id']} - {t['name']}")
    
    def _import_devices(self, file_path: str):
        """从文件导入设备"""
        with open(file_path, 'r', encoding='utf-8') as f:
            devices = json.load(f)
        
        now = datetime.now().isoformat()
        count = 0
        
        for device in devices:
            self._insert("devices", {
                "id": device['id'],
                "name": device['name'],
                "type": device['type'],
                "ip": device.get('ip'),
                "status": device.get('status', 'unknown'),
                "created_at": now,
                "updated_at": now
            })
            count += 1
        
        print(f"✓ 导入 {count} 个设备")
    
    def _import_groups(self, file_path: str):
        """从文件导入分组"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        now = datetime.now().isoformat()
        count = 0
        
        for group in data.get('groups', []):
            self._insert("groups", {
                "id": group['id'],
                "name": group['name'],
                "description": group.get('description'),
                "created_at": now
            })
            
            for device_id in group.get('devices', []):
                self._insert("device_group_mapping", {
                    "device_id": device_id,
                    "group_id": group['id']
                })
            count += 1
        
        print(f"✓ 导入 {count} 个分组")
    
    def _import_templates(self, file_path: str):
        """从文件导入指令模板"""
        with open(file_path, 'r', encoding='utf-8') as f:
            templates = json.load(f)
        
        now = datetime.now().isoformat()
        count = 0
        
        for template in templates:
            self._insert("command_templates", {
                "id": template['id'],
                "name": template['name'],
                "type": template['type'],
                "content": template['content'],
                "is_dangerous": template.get('is_dangerous', 0),
                "params_json": json.dumps(template.get('params', {}), ensure_ascii=False),
                "created_at": now
            })
            count += 1
        
        print(f"✓ 导入 {count} 个指令模板")
    
    def check(self, args):
        """检查命令"""
        print("=" * 60)
        print("数据检查")
        print("=" * 60)
        
        issues = []
        
        devices = self._execute_sql("SELECT * FROM devices")
        print(f"\n设备数量: {len(devices)}")
        
        groups = self._execute_sql("SELECT * FROM groups")
        print(f"分组数量: {len(groups)}")
        
        templates = self._execute_sql("SELECT * FROM command_templates")
        print(f"指令模板数量: {len(templates)}")
        
        # 检查离线设备
        offline_devices = self._execute_sql("SELECT * FROM devices WHERE status = 'offline'")
        if offline_devices:
            print(f"\n⚠️  离线设备 ({len(offline_devices)}个):")
            for d in offline_devices:
                print(f"   - {d['id']}: {d['name']}")
            issues.append(f"{len(offline_devices)} 个设备离线")
        
        # 检查无IP设备
        no_ip = self._execute_sql("SELECT * FROM devices WHERE ip IS NULL OR ip = ''")
        if no_ip:
            print(f"\n⚠️  无IP地址设备 ({len(no_ip)}个):")
            for d in no_ip:
                print(f"   - {d['id']}: {d['name']}")
            issues.append(f"{len(no_ip)} 个设备无IP地址")
        
        # 检查空分组
        for g in groups:
            mapping = self._execute_sql(
                "SELECT * FROM device_group_mapping WHERE group_id = ?",
                (g['id'],)
            )
            if not mapping:
                print(f"\n⚠️  空分组: {g['id']} - {g['name']}")
                issues.append(f"分组 {g['name']} 为空")
        
        # 检查重复设备
        device_ids = [d['id'] for d in devices]
        duplicates = [k for k, v in Counter(device_ids).items() if v > 1]
        if duplicates:
            print(f"\n❌ 重复设备ID: {duplicates}")
            issues.append(f"存在重复设备ID: {duplicates}")
        
        print("\n" + "=" * 60)
        if issues:
            print(f"检查完成，发现 {len(issues)} 个问题")
            for i, issue in enumerate(issues, 1):
                print(f"  {i}. {issue}")
        else:
            print("检查通过，未发现问题")
        print("=" * 60)
    
    def detail(self, args):
        """详情命令"""
        print("=" * 60)
        if args.device:
            print(f"设备详情: {args.device}")
            self._show_device_detail(args.device)
        elif args.template:
            print(f"指令模板详情: {args.template}")
            self._show_template_detail(args.template)
        elif args.batch:
            print(f"批次详情: {args.batch}")
            self._show_batch_detail(args.batch)
        print("=" * 60)
    
    def _show_device_detail(self, device_id: str):
        """显示设备详情"""
        device = self._execute_sql(
            "SELECT * FROM devices WHERE id = ?",
            (device_id,)
        )
        
        if not device:
            print(f"\n❌ 设备 {device_id} 不存在")
            return
        
        d = device[0]
        print(f"\n基本信息:")
        print(f"  ID: {d['id']}")
        print(f"  名称: {d['name']}")
        print(f"  类型: {d['type']}")
        print(f"  IP: {d['ip']}")
        status_emoji = "✅" if d['status'] == 'online' else "❌"
        print(f"  状态: {status_emoji} {d['status']}")
        
        groups = self._execute_sql("""
            SELECT g.* FROM groups g
            JOIN device_group_mapping m ON g.id = m.group_id
            WHERE m.device_id = ?
        """, (device_id,))
        
        if groups:
            print(f"\n所属分组 ({len(groups)}个):")
            for g in groups:
                print(f"  📁 {g['name']} ({g['id']})")
        
        executions = self._execute_sql("""
            SELECT e.*, b.command_template_id, ct.name as template_name
            FROM executions e
            JOIN batches b ON e.batch_id = b.id
            JOIN command_templates ct ON b.command_template_id = ct.id
            WHERE e.device_id = ?
            ORDER BY e.created_at DESC
            LIMIT 10
        """, (device_id,))
        
        if executions:
            print(f"\n最近执行记录 (最近10条):")
            for e in executions:
                status_color = {
                    'success': '✅',
                    'failed': '❌',
                    'pending': '⏳',
                    'skipped': '⏭️',
                    'manual': '👤'
                }
                emoji = status_color.get(e['status'], '❓')
                print(f"  {emoji} [{e['created_at']}] {e['template_name']} - {e['status']}")
                if e['last_error']:
                    print(f"       错误: {e['last_error']}")
        
        audit_logs = self._execute_sql("""
            SELECT * FROM audit_logs
            WHERE device_id = ?
            ORDER BY created_at DESC
            LIMIT 5
        """, (device_id,))
        
        if audit_logs:
            print(f"\n审计日志 (最近5条):")
            for log in audit_logs:
                print(f"  [{log['created_at']}] {log['operator']}: {log['action']}")
                if log['reason']:
                    print(f"       原因: {log['reason']}")
    
    def _show_template_detail(self, template_id: str):
        """显示指令模板详情"""
        template = self._execute_sql(
            "SELECT * FROM command_templates WHERE id = ?",
            (template_id,)
        )
        
        if not template:
            print(f"\n❌ 指令模板 {template_id} 不存在")
            return
        
        t = template[0]
        danger_emoji = "⚠️ 危险指令" if t['is_dangerous'] else "🔓 安全指令"
        print(f"\n{danger_emoji}")
        print(f"  ID: {t['id']}")
        print(f"  名称: {t['name']}")
        print(f"  类型: {t['type']}")
        print(f"  内容: {t['content']}")
        
        if t['params_json']:
            params = json.loads(t['params_json'])
            if params.get('required'):
                print(f"\n必需参数:")
                for p in params['required']:
                    print(f"  - {p}")
    
    def _show_batch_detail(self, batch_id: str):
        """显示批次详情"""
        batch = self._execute_sql("""
            SELECT b.*, ct.name as template_name, ct.is_dangerous
            FROM batches b
            JOIN command_templates ct ON b.command_template_id = ct.id
            WHERE b.id = ?
        """, (batch_id,))
        
        if not batch:
            print(f"\n❌ 批次 {batch_id} 不存在")
            return
        
        b = batch[0]
        print(f"\n基本信息:")
        print(f"  批次ID: {b['id']}")
        print(f"  指令模板: {b['template_name']}")
        print(f"  创建者: {b['created_by']}")
        print(f"  创建时间: {b['created_at']}")
        print(f"  状态: {b['status']}")
        
        if b['params_json']:
            print(f"\n参数: {b['params_json']}")
        
        executions = self._execute_sql("""
            SELECT e.*, d.name as device_name, d.type as device_type, d.status as device_status
            FROM executions e
            JOIN devices d ON e.device_id = d.id
            WHERE e.batch_id = ?
            ORDER BY e.status, d.id
        """, (batch_id,))
        
        if executions:
            print(f"\n执行记录 ({len(executions)}条):")
            print("-" * 60)
            
            status_counter = Counter(e['status'] for e in executions)
            print(f"统计: 成功={status_counter.get('success',0)} 失败={status_counter.get('failed',0)} "
                  f"跳过={status_counter.get('skipped',0)} 待处理={status_counter.get('pending',0)} "
                  f"人工={status_counter.get('manual',0)}")
            print("-" * 60)
            
            for e in executions:
                status_color = {
                    'success': '✅',
                    'failed': '❌',
                    'pending': '⏳',
                    'skipped': '⏭️',
                    'manual': '👤'
                }
                emoji = status_color.get(e['status'], '❓')
                print(f"\n{emoji} 设备: {e['device_id']} ({e['device_name']})")
                print(f"   状态: {e['status']}")
                print(f"   尝试次数: {e['attempt_count']}/{e['max_attempts']}")
                if e['last_error']:
                    print(f"   错误: {e['last_error']}")
    
    def create_batch(self, args):
        """创建批次命令"""
        print("=" * 60)
        print("创建指令批次")
        print("=" * 60)
        
        # 检查模板
        template = self._execute_sql(
            "SELECT * FROM command_templates WHERE id = ?",
            (args.template,)
        )
        if not template:
            print(f"\n❌ 指令模板 {args.template} 不存在")
            return
        
        t = template[0]
        
        # 检查危险指令
        if t['is_dangerous']:
            print(f"\n⚠️  警告: 这是一个危险指令")
            print(f"   指令名称: {t['name']}")
            print(f"   指令内容: {t['content']}")
            if not args.force:
                confirm = input("\n是否确认执行此危险指令? (yes/no): ")
                if confirm.lower() != 'yes':
                    print("❌ 用户取消执行")
                    return
        
        # 获取目标设备
        device_ids = []
        if args.devices:
            device_ids = args.devices.split(',')
        elif args.group:
            mappings = self._execute_sql(
                "SELECT device_id FROM device_group_mapping WHERE group_id = ?",
                (args.group,)
            )
            device_ids = [m['device_id'] for m in mappings]
        
        if not device_ids:
            print("\n❌ 未指定目标设备")
            return
        
        print(f"\n目标设备: {len(device_ids)} 个")
        
        # 检查参数
        params = {}
        if args.params:
            try:
                params = json.loads(args.params)
            except json.JSONDecodeError:
                print("\n❌ 参数格式错误，必须是JSON格式")
                return
        
        # 检查必需参数
        if t['params_json']:
            required = json.loads(t['params_json']).get('required', [])
            missing = [p for p in required if p not in params]
            if missing:
                print(f"\n❌ 缺少必需参数: {', '.join(missing)}")
                return
        
        # 检查幂等性 - 同批次重复下发
        existing_batches = self._execute_sql("""
            SELECT b.* FROM batches b
            WHERE b.command_template_id = ? 
            AND b.params_json = ?
            AND b.status IN ('pending', 'running')
        """, (t['id'], json.dumps(params, ensure_ascii=False)))
        
        if existing_batches:
            print(f"\n⚠️  发现相同的待执行批次:")
            for b in existing_batches:
                print(f"   批次ID: {b['id']}, 创建时间: {b['created_at']}")
            if not args.force:
                confirm = input("\n是否确认重复下发? (yes/no): ")
                if confirm.lower() != 'yes':
                    print("⏭️  跳过重复批次")
                    return
        
        # 创建批次
        batch_id = self._generate_id("BATCH-")
        now = datetime.now().isoformat()
        
        self._insert("batches", {
            "id": batch_id,
            "command_template_id": t['id'],
            "params_json": json.dumps(params, ensure_ascii=False),
            "status": "pending",
            "created_at": now,
            "created_by": args.operator or "system"
        })
        
        # 创建执行记录
        config = self._get_config()
        skip_offline = config.get('skip_offline', True)
        max_attempts = config.get('max_retries', 3)
        
        created_count = 0
        skipped_count = 0
        
        for device_id in device_ids:
            # 检查设备
            device = self._execute_sql(
                "SELECT * FROM devices WHERE id = ?",
                (device_id,)
            )
            if not device:
                print(f"⚠️  设备 {device_id} 不存在，跳过")
                continue
            
            d = device[0]
            
            # 检查离线设备
            if skip_offline and d['status'] == 'offline':
                execution_id = self._generate_id("EXEC-")
                self._insert("executions", {
                    "id": execution_id,
                    "batch_id": batch_id,
                    "device_id": device_id,
                    "status": "skipped",
                    "attempt_count": 0,
                    "max_attempts": max_attempts,
                    "last_error": "设备离线",
                    "created_at": now,
                    "updated_at": now
                })
                # 审计日志
                self._insert("audit_logs", {
                    "id": self._generate_id("LOG-"),
                    "batch_id": batch_id,
                    "execution_id": execution_id,
                    "device_id": device_id,
                    "action": "skip",
                    "before_data": json.dumps({"status": "pending"}, ensure_ascii=False),
                    "after_data": json.dumps({"status": "skipped", "reason": "device offline"}, ensure_ascii=False),
                    "operator": "system",
                    "reason": "设备离线，自动跳过",
                    "created_at": now
                })
                skipped_count += 1
                continue
            
            # 检查幂等性 - 同批次同设备
            existing = self._execute_sql("""
                SELECT * FROM executions
                WHERE batch_id = ? AND device_id = ?
            """, (batch_id, device_id))
            
            if existing:
                print(f"⚠️  设备 {device_id} 已存在于批次中，跳过")
                continue
            
            execution_id = self._generate_id("EXEC-")
            self._insert("executions", {
                "id": execution_id,
                "batch_id": batch_id,
                "device_id": device_id,
                "status": "pending",
                "attempt_count": 0,
                "max_attempts": max_attempts,
                "request_log": json.dumps({
                    "template_id": t['id'],
                    "template_content": t['content'],
                    "params": params
                }, ensure_ascii=False),
                "created_at": now,
                "updated_at": now
            })
            created_count += 1
        
        print(f"\n✓ 批次创建成功: {batch_id}")
        print(f"  - 待执行: {created_count} 个")
        print(f"  - 已跳过: {skipped_count} 个")
        
        # 记录审计日志
        self._insert("audit_logs", {
            "id": self._generate_id("LOG-"),
            "batch_id": batch_id,
            "execution_id": None,
            "device_id": None,
            "action": "create_batch",
            "before_data": None,
            "after_data": json.dumps({
                "template_id": t['id'],
                "template_name": t['name'],
                "device_count": len(device_ids),
                "params": params
            }, ensure_ascii=False),
            "operator": args.operator or "system",
            "reason": "创建新指令批次",
            "created_at": now
        })
        
        print(f"\n使用 'device_audit_cli.py run --batch {batch_id}' 开始执行")
    
    def run_batch(self, args):
        """执行批次命令"""
        print("=" * 60)
        print("执行指令批次")
        print("=" * 60)
        
        batch = self._execute_sql("""
            SELECT b.*, ct.content as template_content, ct.name as template_name
            FROM batches b
            JOIN command_templates ct ON b.command_template_id = ct.id
            WHERE b.id = ?
        """, (args.batch,))
        
        if not batch:
            print(f"\n❌ 批次 {args.batch} 不存在")
            return
        
        b = batch[0]
        
        if b['status'] == 'completed':
            print(f"\n⚠️  批次已完成，不会重复执行")
            return
        
        # 更新批次状态
        self._update("batches", {"status": "running"}, {"id": b['id']})
        
        print(f"\n批次: {b['id']}")
        print(f"指令: {b['template_name']}")
        
        # 获取待执行的执行记录
        executions = self._execute_sql("""
            SELECT e.*, d.name as device_name, d.status as device_status
            FROM executions e
            JOIN devices d ON e.device_id = d.id
            WHERE e.batch_id = ? AND e.status IN ('pending', 'failed')
        """, (b['id'],))
        
        print(f"\n待执行设备: {len(executions)} 个")
        print("-" * 60)
        
        success_count = 0
        failed_count = 0
        
        for exec in executions:
            print(f"\n执行设备: {exec['device_id']} ({exec['device_name']})")
            
            # 幂等性检查 - 检查是否已经成功过
            if exec['status'] == 'failed' and exec['attempt_count'] >= exec['max_attempts']:
                print(f"  ❌ 已达到最大重试次数 ({exec['attempt_count']}/{exec['max_attempts']})")
                failed_count += 1
                continue
            
            # 模拟执行
            from random import random
            success_rate = 0.7  # 70%成功率
            is_success = random() < success_rate
            
            attempt_count = exec['attempt_count'] + 1
            now = datetime.now().isoformat()
            
            if is_success:
                # 成功
                self._update("executions", {
                    "status": "success",
                    "attempt_count": attempt_count,
                    "response_log": json.dumps({
                        "success": True,
                        "timestamp": now,
                        "output": "Command executed successfully"
                    }, ensure_ascii=False),
                    "last_error": None,
                    "updated_at": now
                }, {"id": exec['id']})
                
                print(f"  ✅ 成功 (尝试 {attempt_count}次)")
                success_count += 1
                
                # 审计日志
                self._insert("audit_logs", {
                    "id": self._generate_id("LOG-"),
                    "batch_id": b['id'],
                    "execution_id": exec['id'],
                    "device_id": exec['device_id'],
                    "action": "execute_success",
                    "before_data": json.dumps({"status": exec['status']}, ensure_ascii=False),
                    "after_data": json.dumps({"status": "success", "attempt": attempt_count}, ensure_ascii=False),
                    "operator": "system",
                    "reason": "指令执行成功",
                    "created_at": now
                })
            else:
                # 失败
                error_msg = f"模拟执行失败 (随机故障)"
                new_status = 'failed' if attempt_count >= exec['max_attempts'] else 'failed'
                
                self._update("executions", {
                    "status": new_status,
                    "attempt_count": attempt_count,
                    "response_log": json.dumps({
                        "success": False,
                        "timestamp": now,
                        "error": error_msg
                    }, ensure_ascii=False),
                    "last_error": error_msg,
                    "updated_at": now
                }, {"id": exec['id']})
                
                if attempt_count >= exec['max_attempts']:
                    print(f"  ❌ 失败 (达到最大重试次数)")
                else:
                    print(f"  ❌ 失败 (尝试 {attempt_count}次，可重试)")
                failed_count += 1
                
                # 审计日志
                self._insert("audit_logs", {
                    "id": self._generate_id("LOG-"),
                    "batch_id": b['id'],
                    "execution_id": exec['id'],
                    "device_id": exec['device_id'],
                    "action": "execute_failed",
                    "before_data": json.dumps({"status": exec['status'], "attempts": exec['attempt_count']}, ensure_ascii=False),
                    "after_data": json.dumps({"status": new_status, "attempts": attempt_count, "error": error_msg}, ensure_ascii=False),
                    "operator": "system",
                    "reason": error_msg,
                    "created_at": now
                })
        
        # 更新批次状态
        all_executions = self._execute_sql(
            "SELECT * FROM executions WHERE batch_id = ?",
            (b['id'],)
        )
        status_counter = Counter(e['status'] for e in all_executions)
        
        if status_counter.get('pending', 0) == 0 and status_counter.get('running', 0) == 0:
            self._update("batches", {"status": "completed"}, {"id": b['id']})
        
        print("\n" + "=" * 60)
        print("执行完成")
        print("=" * 60)
        print(f"成功: {success_count}")
        print(f"失败: {failed_count}")
        print(f"\n使用 'device_audit_cli.py detail --batch {b['id']}' 查看详情")
    
    def manual_fix(self, args):
        """人工修正命令"""
        print("=" * 60)
        print("人工修正执行记录")
        print("=" * 60)
        
        execution = self._execute_sql(
            "SELECT * FROM executions WHERE id = ?",
            (args.execution,)
        )
        
        if not execution:
            print(f"\n❌ 执行记录 {args.execution} 不存在")
            return
        
        e = execution[0]
        
        print(f"\n当前状态: {e['status']}")
        print(f"尝试次数: {e['attempt_count']}/{e['max_attempts']}")
        if e['last_error']:
            print(f"错误信息: {e['last_error']}")
        
        if not args.force:
            confirm = input(f"\n确认将状态从 '{e['status']}' 改为 '{args.status}'? (yes/no): ")
            if confirm.lower() != 'yes':
                print("❌ 取消操作")
                return
        
        now = datetime.now().isoformat()
        before_data = {
            "status": e['status'],
            "attempt_count": e['attempt_count'],
            "last_error": e['last_error']
        }
        
        self._update("executions", {
            "status": args.status,
            "updated_at": now
        }, {"id": e['id']})
        
        after_data = {
            "status": args.status,
            "attempt_count": e['attempt_count'],
            "manual_operator": args.operator or "unknown"
        }
        
        # 审计日志 - 必须记录前后差异
        self._insert("audit_logs", {
            "id": self._generate_id("LOG-"),
            "batch_id": e['batch_id'],
            "execution_id": e['id'],
            "device_id": e['device_id'],
            "action": "manual_fix",
            "before_data": json.dumps(before_data, ensure_ascii=False),
            "after_data": json.dumps(after_data, ensure_ascii=False),
            "operator": args.operator or "unknown",
            "reason": args.reason or "人工修正",
            "created_at": now
        })
        
        print(f"\n✓ 人工修正已记录")
        print(f"  操作者: {args.operator or 'unknown'}")
        print(f"  原因: {args.reason or '人工修正'}")
        print(f"  状态变化: {e['status']} → {args.status}")
    
    def report(self, args):
        """生成报告命令"""
        print("=" * 60)
        print("审计报告")
        print("=" * 60)
        
        if args.batch:
            self._generate_batch_report(args.batch)
        else:
            self._generate_overall_report()
    
    def _generate_overall_report(self):
        """生成总体报告"""
        # 设备统计
        total_devices = self._execute_sql("SELECT COUNT(*) as cnt FROM devices")[0]['cnt']
        online_devices = self._execute_sql("SELECT COUNT(*) as cnt FROM devices WHERE status = 'online'")[0]['cnt']
        offline_devices = self._execute_sql("SELECT COUNT(*) as cnt FROM devices WHERE status = 'offline'")[0]['cnt']
        
        # 批次统计
        total_batches = self._execute_sql("SELECT COUNT(*) as cnt FROM batches")[0]['cnt']
        
        # 执行统计
        status_stats = self._execute_sql("""
            SELECT status, COUNT(*) as cnt FROM executions GROUP BY status
        """)
        status_counter = {s['status']: s['cnt'] for s in status_stats}
        
        # 人工处理统计
        manual_fixes = self._execute_sql("""
            SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'manual_fix'
        """)[0]['cnt']
        
        print("\n【设备统计】")
        print(f"  设备总数: {total_devices}")
        print(f"  在线: {online_devices} ✅")
        print(f"  离线: {offline_devices} ❌")
        
        print("\n【批次统计】")
        print(f"  总批次数: {total_batches}")
        
        print("\n【执行统计】")
        print(f"  成功: {status_counter.get('success', 0)} ✅")
        print(f"  失败: {status_counter.get('failed', 0)} ❌")
        print(f"  跳过: {status_counter.get('skipped', 0)} ⏭️")
        print(f"  待处理: {status_counter.get('pending', 0)} ⏳")
        print(f"  人工处理: {status_counter.get('manual', 0)} 👤")
        print(f"  人工修正记录: {manual_fixes}")
        
        # 最近批次
        recent_batches = self._execute_sql("""
            SELECT b.*, ct.name as template_name
            FROM batches b
            JOIN command_templates ct ON b.command_template_id = ct.id
            ORDER BY b.created_at DESC
            LIMIT 5
        """)
        
        if recent_batches:
            print("\n【最近批次】")
            for b in recent_batches:
                print(f"  {b['id']}: {b['template_name']} - {b['status']} ({b['created_at']})")
        
        # 需要关注的设备
        failed_executions = self._execute_sql("""
            SELECT e.*, d.name as device_name, b.id as batch_id
            FROM executions e
            JOIN devices d ON e.device_id = d.id
            JOIN batches b ON e.batch_id = b.id
            WHERE e.status = 'failed'
            ORDER BY e.updated_at DESC
            LIMIT 5
        """)
        
        if failed_executions:
            print("\n【需要关注 - 失败设备】")
            for e in failed_executions:
                print(f"  🚨 {e['device_id']} ({e['device_name']})")
                print(f"     批次: {e['batch_id']}")
                if e['last_error']:
                    print(f"     错误: {e['last_error']}")
    
    def _generate_batch_report(self, batch_id: str):
        """生成批次报告"""
        batch = self._execute_sql("""
            SELECT b.*, ct.name as template_name, ct.is_dangerous
            FROM batches b
            JOIN command_templates ct ON b.command_template_id = ct.id
            WHERE b.id = ?
        """, (batch_id,))
        
        if not batch:
            print(f"\n❌ 批次 {batch_id} 不存在")
            return
        
        b = batch[0]
        
        executions = self._execute_sql("""
            SELECT e.*, d.name as device_name, d.type as device_type, d.ip as device_ip
            FROM executions e
            JOIN devices d ON e.device_id = d.id
            WHERE e.batch_id = ?
            ORDER BY e.status, d.id
        """, (batch_id,))
        
        status_counter = Counter(e['status'] for e in executions)
        total = len(executions)
        success = status_counter.get('success', 0)
        failed = status_counter.get('failed', 0)
        skipped = status_counter.get('skipped', 0)
        pending = status_counter.get('pending', 0)
        manual = status_counter.get('manual', 0)
        
        print(f"\n批次信息:")
        print(f"  ID: {b['id']}")
        print(f"  指令: {b['template_name']}")
        print(f"  危险级别: {'⚠️ 危险' if b['is_dangerous'] else '🔓 安全'}")
        print(f"  创建者: {b['created_by']}")
        print(f"  创建时间: {b['created_at']}")
        print(f"  状态: {b['status']}")
        
        print("\n【执行概览】")
        print(f"  设备总数: {total}")
        print(f"  成功: {success} ✅  ({(success/total*100):.1f}%)")
        print(f"  失败: {failed} ❌  ({(failed/total*100):.1f}%)")
        print(f"  跳过: {skipped} ⏭️  ({(skipped/total*100):.1f}%)")
        print(f"  待处理: {pending} ⏳  ({(pending/total*100):.1f}%)")
        print(f"  人工处理: {manual} 👤  ({(manual/total*100):.1f}%)")
        
        # 成功率检查
        if failed > 0:
            print("\n【失败设备详情】")
            for e in executions:
                if e['status'] == 'failed':
                    print(f"\n  ❌ {e['device_id']} ({e['device_name']})")
                    print(f"     IP: {e['device_ip']}")
                    print(f"     类型: {e['device_type']}")
                    print(f"     尝试次数: {e['attempt_count']}/{e['max_attempts']}")
                    print(f"     错误: {e['last_error'] or '未知错误'}")
        
        if skipped > 0:
            print("\n【跳过设备详情】")
            for e in executions:
                if e['status'] == 'skipped':
                    print(f"\n  ⏭️  {e['device_id']} ({e['device_name']})")
                    print(f"     原因: {e['last_error'] or '未知原因'}")
        
        if manual > 0:
            print("\n【人工处理设备】")
            for e in executions:
                if e['status'] == 'manual':
                    print(f"\n  👤 {e['device_id']} ({e['device_name']})")
        
        # 审计日志
        audit_logs = self._execute_sql("""
            SELECT * FROM audit_logs
            WHERE batch_id = ?
            ORDER BY created_at ASC
        """, (batch_id,))
        
        if audit_logs:
            print("\n【审计日志】")
            for log in audit_logs:
                print(f"  [{log['created_at']}] {log['operator']}: {log['action']}")
                if log['reason']:
                    print(f"     原因: {log['reason']}")
        
        # 闭环检查
        print("\n【业务闭环检查】")
        if pending == 0:
            if failed == 0 and manual == 0:
                print("  ✅ 完全成功，业务闭环")
            elif failed > 0:
                print(f"  ⚠️  存在 {failed} 个失败设备，需要人工干预")
                print("     建议: 使用 'manual-fix' 命令人工修正")
            elif manual > 0:
                print(f"  👤 存在 {manual} 个人工处理的设备")
                print("     状态: 已记录人工处理，可视为闭环")
        else:
            print(f"  ⏳ 还有 {pending} 个设备待执行")
            print("     建议: 继续执行或检查设备状态")


def main():
    parser = argparse.ArgumentParser(description="远程设备指令审计CLI工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # init 命令
    init_parser = subparsers.add_parser("init", help="初始化环境")
    
    # import 命令
    import_parser = subparsers.add_parser("import", help="导入数据")
    import_parser.add_argument("--devices", help="设备清单JSON文件")
    import_parser.add_argument("--groups", help="分组JSON文件")
    import_parser.add_argument("--templates", help="指令模板JSON文件")
    import_parser.add_argument("--examples", action="store_true", help="导入样例数据")
    
    # check 命令
    check_parser = subparsers.add_parser("check", help="检查数据有效性")
    
    # detail 命令
    detail_parser = subparsers.add_parser("detail", help="查看详情")
    detail_parser.add_argument("--device", help="设备ID")
    detail_parser.add_argument("--template", help="指令模板ID")
    detail_parser.add_argument("--batch", help="批次ID")
    
    # create-batch 命令
    batch_parser = subparsers.add_parser("create-batch", help="创建指令批次")
    batch_parser.add_argument("--template", required=True, help="指令模板ID")
    batch_parser.add_argument("--devices", help="目标设备ID列表，逗号分隔")
    batch_parser.add_argument("--group", help="目标分组ID")
    batch_parser.add_argument("--params", help="参数JSON")
    batch_parser.add_argument("--operator", help="操作者")
    batch_parser.add_argument("--force", action="store_true", help="强制执行危险指令")
    
    # run 命令
    run_parser = subparsers.add_parser("run", help="执行批次")
    run_parser.add_argument("--batch", required=True, help="批次ID")
    
    # manual-fix 命令
    fix_parser = subparsers.add_parser("manual-fix", help="人工修正执行记录")
    fix_parser.add_argument("--execution", required=True, help="执行记录ID")
    fix_parser.add_argument("--status", required=True, choices=["success", "failed", "skipped", "manual"], help="新状态")
    fix_parser.add_argument("--reason", help="修正原因")
    fix_parser.add_argument("--operator", help="操作者")
    fix_parser.add_argument("--force", action="store_true", help="强制修改，不确认")
    
    # report 命令
    report_parser = subparsers.add_parser("report", help="生成审计报告")
    report_parser.add_argument("--batch", help="指定批次ID")
    
    args = parser.parse_args()
    
    cli = DeviceAuditCLI()
    
    if args.command == "init":
        cli.init(args)
    elif args.command == "import":
        cli.import_data(args)
    elif args.command == "check":
        cli.check(args)
    elif args.command == "detail":
        cli.detail(args)
    elif args.command == "create-batch":
        cli.create_batch(args)
    elif args.command == "run":
        cli.run_batch(args)
    elif args.command == "manual-fix":
        cli.manual_fix(args)
    elif args.command == "report":
        cli.report(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
