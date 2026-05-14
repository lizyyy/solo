import sqlite3
from datetime import datetime, timedelta
import random
import hashlib
import uuid

DATABASE = 'watermark_export.db'


def init_sample_data():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    field_permissions = [
        ('user_name', '用户名', False, 1),
        ('user_email', '用户邮箱', False, 2),
        ('user_phone', '用户手机号', True, 2),
        ('user_idcard', '用户身份证号', True, 3),
        ('user_address', '用户地址', True, 2),
        ('order_id', '订单号', False, 1),
        ('order_amount', '订单金额', False, 2),
        ('payment_info', '支付信息', True, 3),
        ('login_ip', '登录IP', True, 2),
        ('device_info', '设备信息', False, 1),
    ]
    
    for field_name, description, requires_approval, sensitivity_level in field_permissions:
        try:
            cursor.execute('''
                INSERT INTO field_permissions (field_name, description, requires_approval, sensitivity_level)
                VALUES (?, ?, ?, ?)
            ''', (field_name, description, requires_approval, sensitivity_level))
        except sqlite3.IntegrityError:
            pass
    
    watermark_rules = [
        ('标准水印', '导出人:{applicant} | 负责人:{responsible_person} | {datetime}', 0.3, 14),
        ('密集水印', '{applicant} | {datetime} | 禁止外传', 0.2, 12),
        ('简洁水印', '内部资料 {responsible_person}', 0.4, 16),
    ]
    
    for rule_name, content_template, opacity, font_size in watermark_rules:
        try:
            cursor.execute('''
                INSERT INTO watermark_rules (rule_name, content_template, opacity, font_size)
                VALUES (?, ?, ?, ?)
            ''', (rule_name, content_template, opacity, font_size))
        except sqlite3.IntegrityError:
            pass
    
    applicants = ['张三', '李四', '王五', '赵六', '钱七']
    responsible_persons = ['张经理', '李主管', '王总监', '赵负责人']
    purposes = ['数据分析', '报表统计', '审计核查', '业务核对', '客户服务']
    field_options = [
        ['user_name', 'user_email', 'order_id'],
        ['user_name', 'user_phone', 'order_amount'],
        ['user_idcard', 'payment_info'],
        ['user_address', 'login_ip', 'device_info'],
        ['user_name', 'order_id', 'order_amount'],
    ]
    
    for i in range(15):
        applicant = random.choice(applicants)
        responsible_person = random.choice(responsible_persons)
        fields = random.choice(field_options)
        purpose = random.choice(purposes)
        field_names = ','.join(fields)
        
        sensitivity_levels = []
        for f in fields:
            cursor.execute('SELECT requires_approval, sensitivity_level FROM field_permissions WHERE field_name = ?', (f,))
            row = cursor.fetchone()
            if row:
                sensitivity_levels.append((row[0], row[1]))
        
        requires_approval = any(s[0] for s in sensitivity_levels)
        high_sensitivity = any(s[1] >= 3 for s in sensitivity_levels)
        
        if high_sensitivity:
            status = 'rejected'
            reject_reason = '包含高敏感字段，需要特殊审批流程'
            watermark_rule_id = None
            approved_at = None
        elif requires_approval:
            status = random.choice(['pending', 'approved', 'rejected'])
            reject_reason = '需要人工审批' if status == 'rejected' else None
            watermark_rule_id = 1 if status == 'approved' else None
            approved_at = (datetime.now() - timedelta(days=random.randint(0, 7))).isoformat() if status == 'approved' else None
        else:
            status = 'approved'
            reject_reason = None
            watermark_rule_id = 1
            approved_at = (datetime.now() - timedelta(days=random.randint(0, 7))).isoformat()
        
        created_at = (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
        
        cursor.execute('''
            INSERT INTO export_applications 
            (applicant, responsible_person, fields, purpose, status, watermark_rule_id, reject_reason, created_at, approved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (applicant, responsible_person, field_names, purpose, status, watermark_rule_id, reject_reason, created_at, approved_at))
        
        application_id = cursor.lastrowid
        
        if status == 'approved':
            download_count = random.randint(0, 5)
            for _ in range(download_count):
                success = random.random() > 0.15
                failure_reason = None if success else random.choice(['申请未批准', '网络错误', '权限已撤销', '文件生成失败'])
                download_time = (datetime.fromisoformat(approved_at) + timedelta(hours=random.randint(1, 72))).isoformat()
                
                cursor.execute('''
                    INSERT INTO download_records (application_id, downloader, download_time, success, failure_reason, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    application_id,
                    applicant,
                    download_time,
                    success,
                    failure_reason,
                    f'192.168.{random.randint(1, 255)}.{random.randint(1, 255)}'
                ))
    
    conn.commit()
    conn.close()
    print("初始化数据完成！")


if __name__ == '__main__':
    init_sample_data()
