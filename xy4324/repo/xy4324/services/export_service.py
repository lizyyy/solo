#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出服务（Markdown交接单、CSV台账）
"""

import csv
from typing import List, Dict, Optional
from datetime import datetime, date
from pathlib import Path

from config import get_config
from database import get_db


class ExportService:
    """导出服务"""
    
    def __init__(self):
        self.config = get_config()
        self.db = get_db()
    
    def export_booking_markdown(self, booking_id: int, file_path: str) -> bool:
        """
        导出预约的安全交接单（Markdown格式）
        
        Args:
            booking_id: 预约ID
            file_path: 导出文件路径
            
        Returns:
            是否成功
        """
        cursor = self.db.cursor()
        
        # 获取预约信息
        cursor.execute('''
            SELECT b.*,
                   c.grade || c.class_number as class_name,
                   c.teacher_name as class_teacher
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.id = ?
        ''', (booking_id,))
        
        booking = cursor.fetchone()
        if not booking:
            return False
        
        # 获取预约项目
        cursor.execute('''
            SELECT bi.*,
                   r.name as reagent_name,
                   r.category as reagent_category,
                   r.danger_level as reagent_danger_level,
                   r.concentration as reagent_concentration,
                   r.purity as reagent_purity,
                   r.unit as reagent_unit,
                   r.location as reagent_location,
                   r.shelf as reagent_shelf,
                   r.expiry_date as reagent_expiry
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ?
        ''', (booking_id,))
        
        items = cursor.fetchall()
        
        # 获取审批信息
        cursor.execute('''
            SELECT a.*
            FROM approvals a
            WHERE a.booking_id = ?
            ORDER BY a.approval_time DESC
            LIMIT 1
        ''', (booking_id,))
        
        approval = cursor.fetchone()
        
        # 生成Markdown内容
        content = self._generate_handover_document(booking, items, approval)
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True
    
    def _generate_handover_document(self, booking, items, approval) -> str:
        """生成安全交接单内容"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 危险等级名称映射
        danger_level_names = {
            1: "🔴 高危险",
            2: "🟠 中危险",
            3: "🟡 低危险",
            4: "🟢 一般"
        }
        
        # 类别名称映射
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        
        # 状态名称
        status_name = self.config.booking_status.get(
            booking['status'], {}
        ).get('name', booking['status'])
        
        lines = []
        
        # 标题
        lines.append("# 🧪 试剂领用安全交接单")
        lines.append("")
        lines.append(f"> 生成时间: {now}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 基本信息
        lines.append("## 📋 基本信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| **预约编号** | {booking['id']} |")
        lines.append(f"| **实验名称** | {booking['experiment_name']} |")
        lines.append(f"| **班级** | {booking['class_name']} |")
        lines.append(f"| **任课老师** | {booking['teacher_name'] or booking.get('class_teacher', '')} |")
        lines.append(f"| **学生人数** | {booking['student_count']} 人 |")
        lines.append(f"| **预约日期** | {booking['booking_date']} |")
        lines.append(f"| **实验日期** | {booking['experiment_date']} |")
        lines.append(f"| **当前状态** | {status_name} |")
        lines.append("")
        
        # 试剂清单
        lines.append("## 🧪 试剂清单")
        lines.append("")
        
        # 统计危险等级
        high_risk_count = sum(1 for i in items if i['reagent_danger_level'] == 1)
        medium_risk_count = sum(1 for i in items if i['reagent_danger_level'] == 2)
        
        if high_risk_count > 0 or medium_risk_count > 0:
            lines.append("### ⚠️ 危险试剂提醒")
            lines.append("")
            if high_risk_count > 0:
                lines.append(f"- **🔴 高危险试剂**: {high_risk_count} 种")
            if medium_risk_count > 0:
                lines.append(f"- **🟠 中危险试剂**: {medium_risk_count} 种")
            lines.append("")
            lines.append("> **注意**: 危险试剂需严格遵守安全操作规程，双人双锁管理。")
            lines.append("")
        
        # 试剂表格
        lines.append("### 📊 详细清单")
        lines.append("")
        lines.append("| 序号 | 试剂名称 | 危险等级 | 类别 | 浓度/纯度 | 单位 | 申请量 | 已发放 | 已归还 | 存放位置 | 货架 | 有效期 |")
        lines.append("|------|----------|----------|------|-----------|------|--------|--------|--------|----------|------|--------|")
        
        for idx, item in enumerate(items, 1):
            danger_display = danger_level_names.get(
                item['reagent_danger_level'],
                f"等级{item['reagent_danger_level']}"
            )
            category_display = category_names.get(
                item['reagent_category'],
                item['reagent_category']
            )
            
            concentration = []
            if item['reagent_concentration']:
                concentration.append(item['reagent_concentration'])
            if item['reagent_purity']:
                concentration.append(item['reagent_purity'])
            concentration_display = "/".join(concentration) if concentration else "-"
            
            lines.append(
                f"| {idx} | {item['reagent_name']} | {danger_display} | {category_display} | "
                f"{concentration_display} | {item['reagent_unit']} | {item['requested_quantity']} | "
                f"{item['issued_quantity'] or 0} | {item['returned_quantity'] or 0} | "
                f"{item['reagent_location'] or '-'} | {item['reagent_shelf'] or '-'} | "
                f"{item['reagent_expiry'] or '-'} |"
            )
        
        lines.append("")
        
        # 安全提示
        lines.append("## 🔒 安全注意事项")
        lines.append("")
        lines.append("### 领用前检查")
        lines.append("")
        lines.append("- [ ] 核对试剂名称、浓度、有效期是否与清单一致")
        lines.append("- [ ] 检查包装是否完好，有无泄漏")
        lines.append("- [ ] 确认危险等级标识清晰")
        lines.append("")
        
        lines.append("### 使用中注意")
        lines.append("")
        lines.append("- [ ] 危险试剂必须有老师在场指导使用")
        lines.append("- [ ] 不相容试剂分开存放、分开操作")
        lines.append("- [ ] 佩戴适当的个人防护装备（护目镜、手套、白大褂等）")
        lines.append("- [ ] 熟悉应急处理流程")
        lines.append("")
        
        lines.append("### 归还要求")
        lines.append("")
        lines.append("- [ ] 剩余试剂密封保存，标签清晰")
        lines.append("- [ ] 如实记录剩余量")
        lines.append("- [ ] 确认试剂状态完好")
        lines.append("- [ ] 清洁实验区域")
        lines.append("")
        
        # 审批信息
        if approval:
            lines.append("## ✅ 审批记录")
            lines.append("")
            approval_status = "已通过" if approval['status'] == 'approved' else "已拒绝"
            lines.append(f"- **审批人**: {approval['approver_name']}")
            lines.append(f"- **审批时间**: {approval['approval_time']}")
            lines.append(f"- **审批结果**: {approval_status}")
            if approval['comments']:
                lines.append(f"- **审批意见**: {approval['comments']}")
            lines.append("")
        
        # 交接签名区
        lines.append("## 📝 交接签名")
        lines.append("")
        lines.append("| 角色 | 签名 | 日期 |")
        lines.append("|------|------|------|")
        lines.append("| **领用人** | ________________ | ____________ |")
        lines.append("| **管理员** | ________________ | ____________ |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("> **本交接单由系统自动生成，一式两份，领用双方各执一份。**")
        lines.append("> **如有疑问，请联系实验室管理员。**")
        
        return "\n".join(lines)
    
    def export_inventory_csv(self, file_path: str, include_inactive: bool = False) -> bool:
        """
        导出库存台账（CSV格式）
        
        Args:
            file_path: 导出文件路径
            include_inactive: 是否包含已停用试剂
            
        Returns:
            是否成功
        """
        cursor = self.db.cursor()
        
        query = '''
            SELECT r.id, r.name, r.english_name, r.cas_number, r.formula,
                   r.category, r.danger_level, r.concentration, r.purity,
                   r.unit, r.total_quantity, r.available_quantity,
                   r.minimum_quantity, r.location, r.shelf,
                   r.expiry_date, r.manufacturer, r.batch_number,
                   r.remarks, r.is_active, r.created_at, r.updated_at
            FROM reagents r
        '''
        
        if not include_inactive:
            query += ' WHERE r.is_active = 1'
        
        query += ' ORDER BY r.danger_level ASC, r.name ASC'
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # 名称映射
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_level_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 表头
            writer.writerow([
                'ID', '试剂名称', '英文名称', 'CAS号', '分子式',
                '类别', '危险等级', '浓度', '纯度',
                '单位', '总数量', '可用数量',
                '安全库存', '存放位置', '货架',
                '有效期', '生产厂家', '批号',
                '备注', '状态', '创建时间', '更新时间'
            ])
            
            for row in rows:
                writer.writerow([
                    row['id'],
                    row['name'],
                    row['english_name'] or '',
                    row['cas_number'] or '',
                    row['formula'] or '',
                    category_names.get(row['category'], row['category']),
                    danger_level_names.get(row['danger_level'], f'等级{row["danger_level"]}'),
                    row['concentration'] or '',
                    row['purity'] or '',
                    row['unit'],
                    row['total_quantity'],
                    row['available_quantity'],
                    row['minimum_quantity'],
                    row['location'] or '',
                    row['shelf'] or '',
                    row['expiry_date'] or '',
                    row['manufacturer'] or '',
                    row['batch_number'] or '',
                    row['remarks'] or '',
                    '启用' if row['is_active'] else '停用',
                    row['created_at'],
                    row['updated_at']
                ])
        
        return True
    
    def export_bookings_csv(self, file_path: str, 
                            start_date: date = None, 
                            end_date: date = None) -> bool:
        """
        导出预约记录CSV
        
        Args:
            file_path: 导出文件路径
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            是否成功
        """
        cursor = self.db.cursor()
        
        query = '''
            SELECT b.id, b.experiment_name, 
                   c.grade || c.class_number as class_name,
                   b.teacher_name, b.booking_date, b.experiment_date,
                   b.student_count, b.status, b.remarks,
                   (SELECT COUNT(*) FROM booking_items WHERE booking_id = b.id) as item_count
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
        '''
        
        params = []
        conditions = []
        
        if start_date:
            conditions.append('b.experiment_date >= ?')
            params.append(start_date.isoformat())
        
        if end_date:
            conditions.append('b.experiment_date <= ?')
            params.append(end_date.isoformat())
        
        if conditions:
            query += ' WHERE ' + ' AND '.join(conditions)
        
        query += ' ORDER BY b.experiment_date DESC, b.created_at DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # 状态名称
        status_names = {k: v['name'] for k, v in self.config.booking_status.items()}
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '预约编号', '实验名称', '班级', '任课老师',
                '预约日期', '实验日期', '学生人数',
                '试剂种类数', '状态', '备注'
            ])
            
            for row in rows:
                writer.writerow([
                    row['id'],
                    row['experiment_name'],
                    row['class_name'],
                    row['teacher_name'] or '',
                    row['booking_date'],
                    row['experiment_date'],
                    row['student_count'],
                    row['item_count'],
                    status_names.get(row['status'], row['status']),
                    row['remarks'] or ''
                ])
        
        return True
    
    def get_export_dir(self) -> Path:
        """获取导出目录"""
        export_dir = self.config.export_dir
        if not export_dir.exists():
            export_dir.mkdir(parents=True, exist_ok=True)
        return export_dir
    
    def generate_filename(self, prefix: str, extension: str) -> str:
        """生成导出文件名"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}.{extension}"
