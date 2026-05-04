import json
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from sqlalchemy import and_

from .config import Config
from .database import db_session
from .models import (
    Pet, MedicationRecord, Note, CameraImage, AbnormalCall,
    Risk, RiskType, RiskStatus, Confirmation, ProcessedFile
)


class Exporter:
    def __init__(self, config: Config = None):
        self.config = config or Config()
        self.export_dir = self.config.export_dir

    def _ensure_export_dir(self):
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def _get_pet_data(self, session, pet: Pet, target_date: date) -> Dict[str, Any]:
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        meds = session.query(MedicationRecord).filter(
            and_(
                MedicationRecord.pet_id == pet.id,
                MedicationRecord.scheduled_time >= start_time,
                MedicationRecord.scheduled_time < end_time
            )
        ).all()
        
        notes = session.query(Note).filter(
            and_(
                Note.pet_id == pet.id,
                Note.created_at >= start_time,
                Note.created_at < end_time
            )
        ).all()
        
        images = session.query(CameraImage).filter(
            and_(
                CameraImage.pet_id == pet.id,
                CameraImage.capture_time >= start_time,
                CameraImage.capture_time < end_time
            )
        ).all()
        
        calls = session.query(AbnormalCall).filter(
            and_(
                AbnormalCall.pet_id == pet.id,
                AbnormalCall.call_time >= start_time,
                AbnormalCall.call_time < end_time
            )
        ).all()
        
        risks = session.query(Risk).filter(
            and_(
                Risk.pet_id == pet.id,
                Risk.detected_at >= start_time,
                Risk.detected_at < end_time
            )
        ).all()
        
        confirmations = session.query(Confirmation).filter(
            and_(
                Confirmation.pet_id == pet.id,
                Confirmation.confirmed_at >= start_time,
                Confirmation.confirmed_at < end_time
            )
        ).all()
        
        return {
            'pet': pet.to_dict(),
            'medications': [m.to_dict() for m in meds],
            'notes': [n.to_dict() for n in notes],
            'images': [i.to_dict() for i in images],
            'abnormal_calls': [c.to_dict() for c in calls],
            'risks': [r.to_dict() for r in risks],
            'confirmations': [c.to_dict() for c in confirmations]
        }

    def generate_markdown_handover(self, target_date: date = None) -> str:
        if target_date is None:
            target_date = date.today()
        
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        with db_session() as session:
            pets = session.query(Pet).filter(Pet.check_out_date.is_(None)).all()
            
            all_risks = session.query(Risk).filter(
                Risk.status.in_([RiskStatus.PENDING, RiskStatus.CONFIRMED])
            ).order_by(Risk.severity.desc()).all()
            
            today_risks = session.query(Risk).filter(
                and_(
                    Risk.detected_at >= start_time,
                    Risk.detected_at < end_time
                )
            ).all()
            
            today_files = session.query(ProcessedFile).filter(
                and_(
                    ProcessedFile.created_at >= start_time,
                    ProcessedFile.created_at < end_time
                )
            ).all()
            
            all_pet_data = {}
            for pet in pets:
                all_pet_data[pet.id] = self._get_pet_data(session, pet, target_date)
            
            markdown = f"""# 宠物寄养店交接单 - {target_date.strftime('%Y-%m-%d')}

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、当前入住宠物概览

| 宠物名 | 品种 | 笼号 | 入住日期 | 今日喂药次数 | 今日备注数 | 风险数 |
|--------|------|------|----------|--------------|------------|--------|
"""
            
            for pet in pets:
                data = all_pet_data.get(pet.id, {})
                med_count = len(data.get('medications', []))
                note_count = len(data.get('notes', []))
                risk_count = len(data.get('risks', []))
                markdown += f"| {pet.name} | {pet.breed or '-'} | {pet.cage_number or '-'} | {pet.check_in_date} | {med_count} | {note_count} | {risk_count} |\n"
            
            markdown += f"""
---

## 二、待处理风险 (共 {len(all_risks)} 项)

"""
            
            if all_risks:
                for risk in all_risks:
                    pet = session.query(Pet).filter(Pet.id == risk.pet_id).first()
                    pet_name = pet.name if pet else "未知"
                    status_emoji = "🔴" if risk.status == RiskStatus.PENDING else "🟡"
                    severity_stars = "⭐" * risk.severity
                    
                    markdown += f"""### {status_emoji} {risk.risk_type.value} - {pet_name}

- **状态**: {risk.status.value}
- **严重程度**: {severity_stars} ({risk.severity}/3)
- **检测时间**: {risk.detected_at.strftime('%Y-%m-%d %H:%M:%S') if risk.detected_at else '-'}
- **描述**: {risk.description}

"""
            else:
                markdown += "✅ 无待处理风险\n"
            
            markdown += f"""
---

## 三、今日处理文件统计

今日共处理 {len(today_files)} 个文件:

"""
            
            file_type_counts = {}
            for pf in today_files:
                ft = pf.file_type
                file_type_counts[ft] = file_type_counts.get(ft, 0) + 1
            
            for ft, count in file_type_counts.items():
                markdown += f"- {ft}: {count} 个文件\n"
            
            markdown += f"""
---

## 四、各宠物详细情况

"""
            
            for pet in pets:
                data = all_pet_data.get(pet.id, {})
                
                markdown += f"""### 🐾 {pet.name}

#### 基本信息
- 品种: {pet.breed or '-'}
- 笼号: {pet.cage_number or '-'}
- 主人: {pet.owner_name or '-'}
- 入住日期: {pet.check_in_date}
- 特殊需求: {pet.special_notes or '无'}

#### 今日喂药记录
"""
                
                meds = data.get('medications', [])
                if meds:
                    markdown += """| 药物名称 | 剂量 | 预定时间 | 状态 | 喂药人 |\n|----------|------|----------|------|--------|\n"""
                    for m in meds:
                        status = "✅ 已喂药" if m.get('is_administered') else "❌ 未喂药"
                        scheduled = m.get('scheduled_time', '')
                        if scheduled:
                            try:
                                scheduled = datetime.fromisoformat(scheduled).strftime('%H:%M')
                            except:
                                pass
                        markdown += f"| {m.get('medication_name', '-')} | {m.get('dosage', '-')} | {scheduled} | {status} | {m.get('administered_by', '-')} |\n"
                else:
                    markdown += "无今日喂药记录\n"
                
                markdown += """
#### 今日备注
"""
                
                notes = data.get('notes', [])
                if notes:
                    for n in notes:
                        confirmed = "✅ 已确认" if n.get('is_confirmed') else "⚠️ 未确认"
                        created_at = n.get('created_at', '')
                        if created_at:
                            try:
                                created_at = datetime.fromisoformat(created_at).strftime('%H:%M')
                            except:
                                pass
                        markdown += f"""**[{created_at}] {n.get('note_type', 'note')} ({confirmed})**
> {n.get('content', '')}
"""
                else:
                    markdown += "无今日备注\n"
                
                markdown += """
#### 今日异常叫声
"""
                
                calls = data.get('abnormal_calls', [])
                if calls:
                    night_calls = [c for c in calls if c.get('is_night_time')]
                    markdown += f"- 总异常叫声: {len(calls)} 次\n"
                    markdown += f"- 夜间异常叫声: {len(night_calls)} 次\n"
                else:
                    markdown += "无异常叫声记录\n"
                
                markdown += """
#### 今日风险
"""
                
                risks = data.get('risks', [])
                if risks:
                    for r in risks:
                        status = "🔴 待处理" if r.get('status') == 'pending' else ("🟡 已确认" if r.get('status') == 'confirmed' else "✅ 已解决")
                        markdown += f"- [{status}] {r.get('description', '')}\n"
                else:
                    markdown += "无今日风险\n"
                
                markdown += "\n---\n\n"
            
            markdown += f"""
---

## 五、交接签名

| 交班人 | 交班时间 | 接班人 | 接班时间 |
|--------|----------|--------|----------|
| ____________ | ____________ | ____________ | ____________ |

---

*此交接单由系统自动生成，如有疑问请检查系统原始记录*
"""
            
            return markdown

    def export_markdown_handover(self, target_date: date = None, filename: str = None) -> Path:
        self._ensure_export_dir()
        
        if target_date is None:
            target_date = date.today()
        
        if filename is None:
            filename = f"handover_{target_date.strftime('%Y%m%d')}.md"
        
        file_path = self.export_dir / filename
        
        markdown = self.generate_markdown_handover(target_date)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        return file_path

    def generate_json_audit(self, target_date: date = None) -> Dict[str, Any]:
        if target_date is None:
            target_date = date.today()
        
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        with db_session() as session:
            pets = session.query(Pet).filter(Pet.check_out_date.is_(None)).all()
            
            all_pet_data = {}
            for pet in pets:
                all_pet_data[pet.id] = self._get_pet_data(session, pet, target_date)
            
            all_risks = session.query(Risk).filter(
                and_(
                    Risk.detected_at >= start_time,
                    Risk.detected_at < end_time
                )
            ).all()
            
            all_confirmations = session.query(Confirmation).filter(
                and_(
                    Confirmation.confirmed_at >= start_time,
                    Confirmation.confirmed_at < end_time
                )
            ).all()
            
            all_files = session.query(ProcessedFile).filter(
                and_(
                    ProcessedFile.created_at >= start_time,
                    ProcessedFile.created_at < end_time
                )
            ).all()
            
            audit_data = {
                'audit_date': target_date.strftime('%Y-%m-%d'),
                'generated_at': datetime.now().isoformat(),
                'summary': {
                    'total_pets': len(pets),
                    'total_risks': len(all_risks),
                    'total_confirmations': len(all_confirmations),
                    'total_files_processed': len(all_files)
                },
                'pets': {},
                'risks': [],
                'confirmations': [],
                'processed_files': []
            }
            
            for pet_id, data in all_pet_data.items():
                pet_info = data.get('pet', {})
                audit_data['pets'][pet_info.get('name')] = data
            
            for risk in all_risks:
                audit_data['risks'].append(risk.to_dict())
            
            for conf in all_confirmations:
                audit_data['confirmations'].append(conf.to_dict())
            
            for pf in all_files:
                audit_data['processed_files'].append(pf.to_dict())
            
            return audit_data

    def export_json_audit(self, target_date: date = None, filename: str = None) -> Path:
        self._ensure_export_dir()
        
        if target_date is None:
            target_date = date.today()
        
        if filename is None:
            filename = f"audit_{target_date.strftime('%Y%m%d')}.json"
        
        file_path = self.export_dir / filename
        
        audit_data = self.generate_json_audit(target_date)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)
        
        return file_path

    def export_all(self, target_date: date = None) -> Dict[str, Path]:
        if target_date is None:
            target_date = date.today()
        
        results = {}
        
        md_path = self.export_markdown_handover(target_date)
        results['markdown_handover'] = md_path
        
        json_path = self.export_json_audit(target_date)
        results['json_audit'] = json_path
        
        return results
