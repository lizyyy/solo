import os
import json
import uuid
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pathlib import Path
from .models import (
    FilmRoll, Scanner, MaintenanceRecord, TemperatureHumidityLog,
    Reservation, Note, CheckResult, HandoverForm,
    CheckStatus, BlockReason
)
from .database import Database
from .query import QueryService
from .checker import BusinessChecker
from .exceptions import ExportError


class Exporter:
    """数据导出器 - 支持Markdown交接单和JSON审计包"""
    
    def __init__(self, db: Database):
        self.db = db
        self.query_service = QueryService(db)
        self.checker = BusinessChecker(db)
    
    # ==================== Markdown交接单导出 ====================
    
    def export_handover_form(self,
                              film_roll_id: str,
                              reader_name: str,
                              check_time: Optional[datetime] = None,
                              output_path: Optional[str] = None,
                              notes: Optional[str] = None,
                              created_by: Optional[str] = None) -> str:
        """
        导出Markdown交接单
        
        Args:
            film_roll_id: 胶片卷ID
            reader_name: 读者姓名
            check_time: 检查时间
            output_path: 输出文件路径
            notes: 备注
            created_by: 创建人
        
        Returns:
            生成的文件路径
        """
        # 获取胶片卷信息
        film_roll = self.query_service.get_film_roll_by_id(film_roll_id)
        if not film_roll:
            raise ExportError(f"Film roll not found: {film_roll_id}")
        
        # 执行检查
        check_result = self.checker.check_film_roll(film_roll_id, check_time, reader_name)
        
        # 创建交接单对象
        handover_form = HandoverForm(
            id=str(uuid.uuid4()),
            film_roll_id=film_roll_id,
            film_roll_title=film_roll.title,
            reader_name=reader_name,
            check_result=check_result,
            handover_time=check_time or datetime.now(),
            notes=notes,
            created_by=created_by
        )
        
        # 保存到数据库
        self.db.insert_handover_form(handover_form)
        
        # 生成Markdown内容
        markdown_content = self._generate_handover_markdown(handover_form, film_roll, check_result)
        
        # 确定输出路径
        if output_path is None:
            timestamp = (check_time or datetime.now()).strftime('%Y%m%d_%H%M%S')
            output_path = f"handover_{film_roll_id}_{timestamp}.md"
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 写入文件
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
        except Exception as e:
            raise ExportError(f"Failed to write handover form: {e}") from e
        
        return str(output_path)
    
    def _generate_handover_markdown(self,
                                     form: HandoverForm,
                                     film_roll: FilmRoll,
                                     check_result: CheckResult) -> str:
        """生成Markdown格式的交接单"""
        status_text = "可用" if check_result.status == CheckStatus.AVAILABLE else "拦截"
        status_icon = "✅" if check_result.status == CheckStatus.AVAILABLE else "❌"
        
        # 生成拦截原因列表
        block_reasons_md = ""
        if check_result.block_reasons:
            block_reasons_md = "\n### 拦截原因\n\n"
            for reason in check_result.block_reasons:
                reason_desc = self._get_block_reason_description(reason)
                block_reasons_md += f"- ❌ **{self._get_block_reason_title(reason)}**: {reason_desc}\n"
            
            # 添加详细信息
            if check_result.details:
                block_reasons_md += "\n#### 详细信息\n\n"
                for key, value in check_result.details.items():
                    block_reasons_md += f"**{key}**: {json.dumps(value, ensure_ascii=False, indent=2)}\n\n"
        
        # 生成胶片卷信息
        film_roll_md = f"""
### 胶片卷信息

| 字段 | 内容 |
|------|------|
| 卷号 | {film_roll.id} |
| 标题 | {film_roll.title} |
| 格式 | {film_roll.format or '-'} |
| 存储位置 | {film_roll.location or '-'} |
| 扫描仪要求 | {film_roll.scanner_requirements or '-'} |
"""
        
        # 生成预约信息
        reservations = self.query_service.get_reservations(film_roll_id=film_roll.id)
        reservations_md = ""
        if reservations:
            reservations_md = "\n### 相关预约\n\n"
            reservations_md += "| 读者 | 开始时间 | 结束时间 | 状态 |\n"
            reservations_md += "|------|----------|----------|------|\n"
            for r in reservations:
                reservations_md += f"| {r.reader_name} | {r.start_time.strftime('%Y-%m-%d %H:%M')} | {r.end_time.strftime('%Y-%m-%d %H:%M')} | {r.status} |\n"
        
        # 生成备注信息
        notes = self.query_service.get_notes(related_type='film_roll', related_id=film_roll.id)
        notes_md = ""
        if notes:
            notes_md = "\n### 历史备注\n\n"
            for note in notes:
                notes_md += f"**[{note.created_at.strftime('%Y-%m-%d %H:%M')}]** "
                if note.created_by:
                    notes_md += f"({note.created_by}) "
                notes_md += f": {note.content}\n\n"
        
        # 组合完整文档
        markdown = f"""# 缩微胶片借阅交接单

**交接单号**: {form.id}
**生成时间**: {form.created_at.strftime('%Y-%m-%d %H:%M:%S')}
{'**创建人**: ' + form.created_by if form.created_by else ''}

---

## 基本信息

| 项目 | 内容 |
|------|------|
| 胶片卷 | {film_roll.title} ({film_roll.id}) |
| 读者 | {form.reader_name} |
| 交接时间 | {form.handover_time.strftime('%Y-%m-%d %H:%M:%S')} |
| 检查状态 | {status_icon} **{status_text}** |

---

## 检查结果

{status_icon} **总体状态**: {status_text}
{block_reasons_md}
---
{film_roll_md}
{reservations_md}
{notes_md}
---

## 交接备注

{form.notes or '无'}

---

*此交接单由 Archive CLI 自动生成*
"""
        
        return markdown
    
    def _get_block_reason_title(self, reason: BlockReason) -> str:
        """获取拦截原因的标题"""
        titles = {
            BlockReason.MOLD_RISK: "霉斑风险",
            BlockReason.SCANNER_INCOMPATIBLE: "扫描仪不兼容",
            BlockReason.MAINTENANCE_EXPIRED: "维护过期",
            BlockReason.RESERVATION_CONFLICT: "预约冲突"
        }
        return titles.get(reason, str(reason))
    
    def _get_block_reason_description(self, reason: BlockReason) -> str:
        """获取拦截原因的描述"""
        descriptions = {
            BlockReason.MOLD_RISK: "库房温湿度长时间超过安全阈值，存在霉斑滋生风险",
            BlockReason.SCANNER_INCOMPATIBLE: "没有可用的扫描仪支持该胶片格式或型号要求",
            BlockReason.MAINTENANCE_EXPIRED: "有扫描仪未按时进行维护，可能影响扫描质量",
            BlockReason.RESERVATION_CONFLICT: "该胶片卷在指定时间已有其他预约"
        }
        return descriptions.get(reason, str(reason))
    
    # ==================== JSON审计包导出 ====================
    
    def export_audit_package(self,
                              output_path: Optional[str] = None,
                              include_types: Optional[List[str]] = None,
                              start_time: Optional[datetime] = None,
                              end_time: Optional[datetime] = None) -> str:
        """
        导出JSON审计包
        
        Args:
            output_path: 输出文件路径
            include_types: 要包含的数据类型
            start_time: 开始时间
            end_time: 结束时间
        
        Returns:
            生成的文件路径
        """
        if include_types is None:
            include_types = [
                'film_rolls', 'scanners', 'maintenance_records',
                'temp_humidity_logs', 'reservations', 'notes',
                'check_results', 'handover_forms'
            ]
        
        # 收集审计数据
        audit_data = {
            'package_info': {
                'id': str(uuid.uuid4()),
                'generated_at': datetime.now().isoformat(),
                'version': '0.1.0',
                'include_types': include_types,
                'time_range': {
                    'start': start_time.isoformat() if start_time else None,
                    'end': end_time.isoformat() if end_time else None
                }
            },
            'data': {}
        }
        
        # 收集各类数据
        if 'film_rolls' in include_types:
            audit_data['data']['film_rolls'] = self._collect_film_rolls()
        
        if 'scanners' in include_types:
            audit_data['data']['scanners'] = self._collect_scanners()
        
        if 'maintenance_records' in include_types:
            audit_data['data']['maintenance_records'] = self._collect_maintenance_records()
        
        if 'temp_humidity_logs' in include_types:
            audit_data['data']['temp_humidity_logs'] = self._collect_temp_humidity_logs(
                start_time, end_time
            )
        
        if 'reservations' in include_types:
            audit_data['data']['reservations'] = self._collect_reservations(
                start_time, end_time
            )
        
        if 'notes' in include_types:
            audit_data['data']['notes'] = self._collect_notes()
        
        if 'check_results' in include_types:
            audit_data['data']['check_results'] = self._collect_check_results(
                start_time, end_time
            )
        
        # 添加统计信息
        audit_data['statistics'] = self._generate_statistics(audit_data['data'])
        
        # 确定输出路径
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f"audit_package_{timestamp}.json"
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 写入文件
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(audit_data, f, ensure_ascii=False, indent=2, default=self._json_default)
        except Exception as e:
            raise ExportError(f"Failed to write audit package: {e}") from e
        
        return str(output_path)
    
    def _json_default(self, obj: Any) -> Any:
        """JSON序列化默认处理器"""
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    def _collect_film_rolls(self) -> List[Dict[str, Any]]:
        """收集胶片卷数据"""
        film_rolls = self.db.get_all_film_rolls()
        return [
            {
                'id': fr.id,
                'title': fr.title,
                'description': fr.description,
                'format': fr.format,
                'scanner_requirements': fr.scanner_requirements,
                'location': fr.location,
                'condition': fr.condition,
                'metadata': fr.metadata,
                'created_at': fr.created_at,
                'updated_at': fr.updated_at
            }
            for fr in film_rolls
        ]
    
    def _collect_scanners(self) -> List[Dict[str, Any]]:
        """收集扫描仪数据"""
        scanners = self.db.get_all_scanners()
        return [
            {
                'id': s.id,
                'name': s.name,
                'model': s.model,
                'supported_formats': s.supported_formats,
                'location': s.location,
                'status': s.status,
                'created_at': s.created_at,
                'updated_at': s.updated_at
            }
            for s in scanners
        ]
    
    def _collect_maintenance_records(self) -> List[Dict[str, Any]]:
        """收集维护记录数据"""
        # 获取所有扫描仪的维护记录
        scanners = self.db.get_all_scanners()
        all_records = []
        
        for scanner in scanners:
            records = self.db.get_maintenance_records_by_scanner(scanner.id)
            all_records.extend(records)
        
        return [
            {
                'id': r.id,
                'scanner_id': r.scanner_id,
                'maintenance_date': r.maintenance_date,
                'next_maintenance_date': r.next_maintenance_date,
                'technician': r.technician,
                'description': r.description,
                'status': r.status,
                'created_at': r.created_at
            }
            for r in all_records
        ]
    
    def _collect_temp_humidity_logs(self,
                                      start_time: Optional[datetime],
                                      end_time: Optional[datetime]) -> List[Dict[str, Any]]:
        """收集温湿度日志数据"""
        logs = self.db.get_temp_humidity_logs(start_time=start_time, end_time=end_time)
        return [
            {
                'id': log.id,
                'location': log.location,
                'timestamp': log.timestamp,
                'temperature': log.temperature,
                'humidity': log.humidity,
                'recorded_by': log.recorded_by,
                'notes': log.notes,
                'created_at': log.created_at
            }
            for log in logs
        ]
    
    def _collect_reservations(self,
                               start_time: Optional[datetime],
                               end_time: Optional[datetime]) -> List[Dict[str, Any]]:
        """收集预约单数据"""
        # 获取所有胶片卷的预约
        film_rolls = self.db.get_all_film_rolls()
        all_reservations = []
        
        for fr in film_rolls:
            reservations = self.db.get_reservations_by_film_roll(fr.id)
            all_reservations.extend(reservations)
        
        # 按时间过滤
        if start_time:
            all_reservations = [r for r in all_reservations if r.end_time >= start_time]
        if end_time:
            all_reservations = [r for r in all_reservations if r.start_time <= end_time]
        
        return [
            {
                'id': r.id,
                'film_roll_id': r.film_roll_id,
                'reader_name': r.reader_name,
                'reader_contact': r.reader_contact,
                'start_time': r.start_time,
                'end_time': r.end_time,
                'purpose': r.purpose,
                'status': r.status,
                'created_at': r.created_at,
                'updated_at': r.updated_at
            }
            for r in all_reservations
        ]
    
    def _collect_notes(self) -> List[Dict[str, Any]]:
        """收集备注数据（简化实现）"""
        # 注意：这里需要更完整的数据库查询支持
        return []
    
    def _collect_check_results(self,
                                start_time: Optional[datetime],
                                end_time: Optional[datetime]) -> List[Dict[str, Any]]:
        """收集检查结果数据"""
        # 获取所有胶片卷的最新检查结果
        film_rolls = self.db.get_all_film_rolls()
        results = []
        
        for fr in film_rolls:
            result = self.db.get_latest_check_result(fr.id)
            if result:
                # 按时间过滤
                if start_time and result.check_time < start_time:
                    continue
                if end_time and result.check_time > end_time:
                    continue
                
                results.append({
                    'id': result.id,
                    'film_roll_id': result.film_roll_id,
                    'check_time': result.check_time,
                    'status': result.status,
                    'block_reasons': [r.value for r in result.block_reasons],
                    'details': result.details,
                    'notes': result.notes,
                    'created_at': result.created_at
                })
        
        return results
    
    def _generate_statistics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """生成统计信息"""
        stats = {
            'film_rolls': {
                'count': len(data.get('film_rolls', [])),
                'formats': {}
            },
            'scanners': {
                'count': len(data.get('scanners', [])),
                'by_status': {}
            },
            'reservations': {
                'count': len(data.get('reservations', [])),
                'by_status': {}
            },
            'temp_humidity_logs': {
                'count': len(data.get('temp_humidity_logs', []))
            },
            'maintenance_records': {
                'count': len(data.get('maintenance_records', []))
            },
            'check_results': {
                'count': len(data.get('check_results', [])),
                'by_status': {}
            }
        }
        
        # 统计胶片卷格式
        for fr in data.get('film_rolls', []):
            fmt = fr.get('format', 'unknown')
            stats['film_rolls']['formats'][fmt] = stats['film_rolls']['formats'].get(fmt, 0) + 1
        
        # 统计扫描仪状态
        for s in data.get('scanners', []):
            status = s.get('status', 'unknown')
            stats['scanners']['by_status'][status] = stats['scanners']['by_status'].get(status, 0) + 1
        
        # 统计检查结果状态
        for cr in data.get('check_results', []):
            status = cr.get('status', 'unknown')
            if isinstance(status, CheckStatus):
                status = status.value
            stats['check_results']['by_status'][status] = stats['check_results']['by_status'].get(status, 0) + 1
        
        return stats
