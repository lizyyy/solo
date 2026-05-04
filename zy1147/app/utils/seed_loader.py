import csv
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import async_session, init_db
from app.core.text_processor import TextProcessor
from app.models import SensitiveWord, Synonym, Whitelist, ContextRule, LexiconVersion


class SeedLoader:
    def __init__(self):
        self.text_processor = TextProcessor()
        self.seed_dir = settings.SEED_DIR
    
    async def load_all(self, db: AsyncSession, force: bool = False) -> Dict[str, Any]:
        result = {
            "sensitive_words": {"added": 0, "skipped": 0},
            "synonyms": {"added": 0, "skipped": 0},
            "whitelist": {"added": 0, "skipped": 0},
            "context_rules": {"added": 0, "skipped": 0}
        }
        
        sensitive_words_file = self.seed_dir / "sensitive_words.csv"
        if sensitive_words_file.exists():
            sw_result = await self.load_sensitive_words_from_csv(db, sensitive_words_file, force)
            result["sensitive_words"] = sw_result
        
        whitelist_file = self.seed_dir / "whitelist.csv"
        if whitelist_file.exists():
            wl_result = await self.load_whitelist_from_csv(db, whitelist_file, force)
            result["whitelist"] = wl_result
        
        return result
    
    async def load_sensitive_words_from_csv(
        self, 
        db: AsyncSession, 
        file_path: Path, 
        force: bool = False
    ) -> Dict[str, int]:
        added = 0
        skipped = 0
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                word = row.get('word') or row.get('敏感词') or row.get('term')
                if not word or not word.strip():
                    skipped += 1
                    continue
                
                word = word.strip()
                normalized_word = self.text_processor.normalize(word)
                pinyin = self.text_processor.to_pinyin(normalized_word)
                
                category = row.get('category', 'other')
                severity = row.get('severity', 'medium')
                description = row.get('description')
                suggestion = row.get('suggestion')
                
                existing = await db.execute(
                    select(SensitiveWord).where(
                        SensitiveWord.normalized_word == normalized_word
                    )
                )
                existing_word = existing.scalar_one_or_none()
                
                if existing_word:
                    if force:
                        existing_word.category = category
                        existing_word.severity = severity
                        if description:
                            existing_word.description = description
                        if suggestion:
                            existing_word.suggestion = suggestion
                        added += 1
                    else:
                        skipped += 1
                else:
                    new_word = SensitiveWord(
                        word=word,
                        normalized_word=normalized_word,
                        pinyin=pinyin,
                        category=category,
                        severity=severity,
                        description=description,
                        suggestion=suggestion
                    )
                    db.add(new_word)
                    added += 1
        
        await db.commit()
        return {"added": added, "skipped": skipped}
    
    async def load_whitelist_from_csv(
        self, 
        db: AsyncSession, 
        file_path: Path, 
        force: bool = False
    ) -> Dict[str, int]:
        added = 0
        skipped = 0
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                term = row.get('term') or row.get('词条')
                if not term or not term.strip():
                    skipped += 1
                    continue
                
                term = term.strip()
                normalized_term = self.text_processor.normalize(term)
                reason = row.get('reason')
                context = row.get('context')
                
                existing = await db.execute(
                    select(Whitelist).where(
                        Whitelist.normalized_term == normalized_term
                    )
                )
                existing_item = existing.scalar_one_or_none()
                
                if existing_item:
                    if force:
                        existing_item.reason = reason
                        existing_item.context = context
                        added += 1
                    else:
                        skipped += 1
                else:
                    new_item = Whitelist(
                        term=term,
                        normalized_term=normalized_term,
                        reason=reason,
                        context=context
                    )
                    db.add(new_item)
                    added += 1
        
        await db.commit()
        return {"added": added, "skipped": skipped}
    
    async def load_sensitive_words_from_json(
        self, 
        db: AsyncSession, 
        file_path: Path, 
        force: bool = False
    ) -> Dict[str, int]:
        added = 0
        skipped = 0
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        words = data.get('words', []) if isinstance(data, dict) else data
        
        for item in words:
            if isinstance(item, str):
                word = item
                category = "other"
                severity = "medium"
                description = None
                suggestion = None
            elif isinstance(item, dict):
                word = item.get('word') or item.get('term')
                category = item.get('category', 'other')
                severity = item.get('severity', 'medium')
                description = item.get('description')
                suggestion = item.get('suggestion')
            else:
                skipped += 1
                continue
            
            if not word or not word.strip():
                skipped += 1
                continue
            
            word = word.strip()
            normalized_word = self.text_processor.normalize(word)
            pinyin = self.text_processor.to_pinyin(normalized_word)
            
            existing = await db.execute(
                select(SensitiveWord).where(
                    SensitiveWord.normalized_word == normalized_word
                )
            )
            existing_word = existing.scalar_one_or_none()
            
            if existing_word:
                if force:
                    existing_word.category = category
                    existing_word.severity = severity
                    if description:
                        existing_word.description = description
                    if suggestion:
                        existing_word.suggestion = suggestion
                    added += 1
                else:
                    skipped += 1
            else:
                new_word = SensitiveWord(
                    word=word,
                    normalized_word=normalized_word,
                    pinyin=pinyin,
                    category=category,
                    severity=severity,
                    description=description,
                    suggestion=suggestion
                )
                db.add(new_word)
                added += 1
        
        await db.commit()
        return {"added": added, "skipped": skipped}


async def main():
    await init_db()
    
    async with async_session() as session:
        loader = SeedLoader()
        result = await loader.load_all(session, force=True)
        
        print("Seed 数据加载完成:")
        print(f"  敏感词: 新增 {result['sensitive_words']['added']}, 跳过 {result['sensitive_words']['skipped']}")
        print(f"  白名单: 新增 {result['whitelist']['added']}, 跳过 {result['whitelist']['skipped']}")


if __name__ == "__main__":
    asyncio.run(main())
