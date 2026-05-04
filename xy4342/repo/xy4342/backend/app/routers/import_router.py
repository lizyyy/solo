from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import csv
import json
from datetime import datetime
import os
import aiofiles

from ..database import get_db, UPLOAD_DIR, SKETCHES_DIR
from .. import models, schemas

router = APIRouter()

@router.post("/storyboard/csv", response_model=schemas.ImportResult)
async def import_storyboard_csv(
    file: UploadFile = File(...),
    chapter_number: int = Form(1),
    chapter_title: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        content_str = content.decode('utf-8-sig')
        
        reader = csv.DictReader(content_str.splitlines())
        
        chapter = db.query(models.Chapter).filter(
            models.Chapter.chapter_number == chapter_number
        ).first()
        
        if not chapter:
            chapter = models.Chapter(
                chapter_number=chapter_number,
                chapter_title=chapter_title or f"第 {chapter_number} 章"
            )
            db.add(chapter)
            db.commit()
            db.refresh(chapter)
        
        existing_panels = db.query(models.Panel).filter(
            models.Panel.chapter_id == chapter.id
        ).all()
        for panel in existing_panels:
            db.delete(panel)
        db.commit()
        
        panel_count = 0
        for row in reader:
            try:
                panel = models.Panel(
                    chapter_id=chapter.id,
                    panel_number=int(row.get('panel_number', 0) or row.get('格数', 0)),
                    page_number=int(row.get('page_number', 0) or row.get('页数', 0)),
                    time_of_day=row.get('time_of_day') or row.get('时间段'),
                    location=row.get('location') or row.get('场景'),
                    characters_present=row.get('characters_present') or row.get('出场角色'),
                    costumes=row.get('costumes') or row.get('服装'),
                    props=row.get('props') or row.get('道具'),
                    action=row.get('action') or row.get('动作'),
                    sketch_path=row.get('sketch_path') or row.get('草图路径'),
                    notes=row.get('notes') or row.get('备注')
                )
                db.add(panel)
                panel_count += 1
            except ValueError as e:
                continue
        
        db.commit()
        
        return schemas.ImportResult(
            success=True,
            message=f"成功导入 {panel_count} 格分镜",
            details={"chapter_id": chapter.id, "panel_count": panel_count}
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@router.post("/characters/json", response_model=schemas.ImportResult)
async def import_characters_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        
        existing = db.query(models.Character).all()
        for c in existing:
            db.delete(c)
        db.commit()
        
        characters = []
        if isinstance(data, list):
            for item in data:
                aliases_val = item.get('aliases') or item.get('别名')
                costume_default_val = item.get('costume_default') or item.get('默认服装')
                costume_variants_val = item.get('costume_variants') or item.get('服装变种')
                props_default_val = item.get('props_default') or item.get('默认道具')
                
                char = models.Character(
                    name=item.get('name') or item.get('姓名'),
                    full_name=item.get('full_name') or item.get('全名'),
                    aliases=json.dumps(aliases_val, ensure_ascii=False) if isinstance(aliases_val, (list, dict)) else aliases_val,
                    costume_default=json.dumps(costume_default_val, ensure_ascii=False) if isinstance(costume_default_val, (list, dict)) else costume_default_val,
                    costume_variants=json.dumps(costume_variants_val, ensure_ascii=False) if isinstance(costume_variants_val, (list, dict)) else costume_variants_val,
                    props_default=json.dumps(props_default_val, ensure_ascii=False) if isinstance(props_default_val, (list, dict)) else props_default_val,
                    description=item.get('description') or item.get('描述')
                )
                db.add(char)
                characters.append(char.name)
        elif isinstance(data, dict):
            for key, item in data.items():
                aliases_val = item.get('aliases', [])
                costume_default_val = item.get('costume_default')
                costume_variants_val = item.get('costume_variants', {})
                props_default_val = item.get('props_default', [])
                
                char = models.Character(
                    name=item.get('name') or key,
                    full_name=item.get('full_name'),
                    aliases=json.dumps(aliases_val, ensure_ascii=False) if isinstance(aliases_val, (list, dict)) else aliases_val,
                    costume_default=json.dumps(costume_default_val, ensure_ascii=False) if isinstance(costume_default_val, (list, dict)) else costume_default_val,
                    costume_variants=json.dumps(costume_variants_val, ensure_ascii=False) if isinstance(costume_variants_val, (list, dict)) else costume_variants_val,
                    props_default=json.dumps(props_default_val, ensure_ascii=False) if isinstance(props_default_val, (list, dict)) else props_default_val,
                    description=item.get('description')
                )
                db.add(char)
                characters.append(char.name)
        
        db.commit()
        
        return schemas.ImportResult(
            success=True,
            message=f"成功导入 {len(characters)} 个角色设定",
            details={"characters": characters}
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@router.post("/dialogues/text", response_model=schemas.ImportResult)
async def import_dialogues(
    file: UploadFile = File(...),
    chapter_number: int = Form(1),
    db: Session = Depends(get_db)
):
    try:
        chapter = db.query(models.Chapter).filter(
            models.Chapter.chapter_number == chapter_number
        ).first()
        
        if not chapter:
            chapter = models.Chapter(
                chapter_number=chapter_number,
                chapter_title=f"第 {chapter_number} 章"
            )
            db.add(chapter)
            db.commit()
            db.refresh(chapter)
        
        existing_dialogues = db.query(models.Dialogue).filter(
            models.Dialogue.chapter_id == chapter.id
        ).all()
        for d in existing_dialogues:
            db.delete(d)
        db.commit()
        
        content = await file.read()
        lines = content.decode('utf-8').splitlines()
        
        dialogue_count = 0
        current_panel = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('【') and '格' in line:
                import re
                match = re.search(r'【.*?(\d+).*?格】', line)
                if match:
                    current_panel = int(match.group(1))
                continue
            
            if ':' in line or '：' in line:
                separator = ':' if ':' in line else '：'
                parts = line.split(separator, 1)
                if len(parts) == 2:
                    speaker_part = parts[0].strip()
                    content_part = parts[1].strip()
                    
                    address_to = None
                    if '对' in speaker_part and '说' in speaker_part:
                        import re
                        addr_match = re.search(r'对(.+?)说', speaker_part)
                        if addr_match:
                            address_to = addr_match.group(1).strip()
                        speaker = speaker_part.split('对')[0].strip()
                    else:
                        speaker = speaker_part
                    
                    dialogue = models.Dialogue(
                        chapter_id=chapter.id,
                        speaker=speaker,
                        address_to=address_to,
                        content=content_part,
                        panel_number=current_panel
                    )
                    db.add(dialogue)
                    dialogue_count += 1
        
        db.commit()
        
        return schemas.ImportResult(
            success=True,
            message=f"成功导入 {dialogue_count} 条对白",
            details={"chapter_id": chapter.id, "dialogue_count": dialogue_count}
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")

@router.post("/sketch", response_model=schemas.ImportResult)
async def upload_sketch(
    file: UploadFile = File(...),
    chapter_number: int = Form(1),
    panel_number: int = Form(1),
    db: Session = Depends(get_db)
):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_ext = os.path.splitext(file.filename)[1] if file.filename else '.png'
        new_filename = f"ch{chapter_number}_p{panel_number}_{timestamp}{file_ext}"
        
        file_path = os.path.join(SKETCHES_DIR, new_filename)
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        chapter = db.query(models.Chapter).filter(
            models.Chapter.chapter_number == chapter_number
        ).first()
        
        if chapter:
            panel = db.query(models.Panel).filter(
                models.Panel.chapter_id == chapter.id,
                models.Panel.panel_number == panel_number
            ).first()
            
            if panel:
                panel.sketch_path = f"/sketches/{new_filename}"
                db.commit()
        
        return schemas.ImportResult(
            success=True,
            message=f"草图上传成功: {new_filename}",
            details={"path": file_path, "url": f"/sketches/{new_filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"上传失败: {str(e)}")

@router.post("/batch")
async def import_batch(
    storyboard_csv: UploadFile = File(None),
    characters_json: UploadFile = File(None),
    dialogues_txt: UploadFile = File(None),
    chapter_number: int = Form(1),
    chapter_title: str = Form(None),
    db: Session = Depends(get_db)
):
    results = {}
    
    if storyboard_csv:
        try:
            from .import_router import import_storyboard_csv
            from fastapi.datastructures import UploadFile
            result = await import_storyboard_csv(
                file=storyboard_csv,
                chapter_number=chapter_number,
                chapter_title=chapter_title,
                db=db
            )
            results['storyboard'] = result
        except Exception as e:
            results['storyboard'] = {"success": False, "message": str(e)}
    
    if characters_json:
        try:
            result = await import_characters_json(file=characters_json, db=db)
            results['characters'] = result
        except Exception as e:
            results['characters'] = {"success": False, "message": str(e)}
    
    if dialogues_txt:
        try:
            result = await import_dialogues(
                file=dialogues_txt,
                chapter_number=chapter_number,
                db=db
            )
            results['dialogues'] = result
        except Exception as e:
            results['dialogues'] = {"success": False, "message": str(e)}
    
    return results
