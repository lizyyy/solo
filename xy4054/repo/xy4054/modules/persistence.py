import pandas as pd
import numpy as np
from datetime import date, datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import json
import uuid
import shutil

from config.settings import STORAGE_CONFIG, EXPORT_CONFIG
from models.schemas import ValidationError


@dataclass
class SessionState:
    session_id: str = ""
    created_at: datetime = None
    updated_at: datetime = None
    
    elderly_df: pd.DataFrame = None
    dish_df: pd.DataFrame = None
    orders_df: pd.DataFrame = None
    servings_df: pd.DataFrame = None
    wastes_df: pd.DataFrame = None
    
    validation_errors: List[ValidationError] = None
    validation_warnings: List[ValidationError] = None
    
    analysis_filters: Dict[str, Any] = None
    manual_corrections: pd.DataFrame = None
    
    def __post_init__(self):
        if not self.session_id:
            self.session_id = str(uuid.uuid4())[:8]
        if not self.created_at:
            self.created_at = datetime.now()
        if not self.updated_at:
            self.updated_at = self.created_at
        if self.validation_errors is None:
            self.validation_errors = []
        if self.validation_warnings is None:
            self.validation_warnings = []
        if self.analysis_filters is None:
            self.analysis_filters = {}
        if self.manual_corrections is None:
            self.manual_corrections = pd.DataFrame()
    
    def to_dict(self) -> Dict[str, Any]:
        data = {
            'session_id': self.session_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'analysis_filters': self.analysis_filters,
            'has_elderly': self.elderly_df is not None and not self.elderly_df.empty,
            'has_dish': self.dish_df is not None and not self.dish_df.empty,
            'has_orders': self.orders_df is not None and not self.orders_df.empty,
            'has_servings': self.servings_df is not None and not self.servings_df.empty,
            'has_wastes': self.wastes_df is not None and not self.wastes_df.empty,
            'validation_errors_count': len(self.validation_errors),
            'validation_warnings_count': len(self.validation_warnings),
            'manual_corrections_count': len(self.manual_corrections) if self.manual_corrections is not None else 0
        }
        return data
    
    def get_date_range(self) -> Tuple[Optional[date], Optional[date]]:
        all_dates = []
        
        for df in [self.orders_df, self.servings_df, self.wastes_df]:
            if df is not None and not df.empty and 'date' in df.columns:
                all_dates.extend(df['date'].dropna().tolist())
        
        if not all_dates:
            return None, None
        
        return min(all_dates), max(all_dates)


class VersionManager:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.archive_dir = base_dir / STORAGE_CONFIG['archive_dir']
        self.max_versions = STORAGE_CONFIG['max_versions']
    
    def save_version(self, session: SessionState, data_type: str, df: pd.DataFrame) -> str:
        version_id = f"{data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        version_dir = self.archive_dir / session.session_id / version_id
        version_dir.mkdir(parents=True, exist_ok=True)
        
        file_format = STORAGE_CONFIG['file_format']
        if file_format == 'parquet':
            df.to_parquet(version_dir / f"{data_type}.parquet", index=False)
        else:
            df.to_csv(version_dir / f"{data_type}.csv", index=False, encoding='utf-8-sig')
        
        meta = {
            'version_id': version_id,
            'data_type': data_type,
            'session_id': session.session_id,
            'created_at': datetime.now().isoformat(),
            'row_count': len(df),
            'columns': list(df.columns)
        }
        with open(version_dir / 'meta.json', 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        
        self._cleanup_old_versions(session.session_id, data_type)
        
        return version_id
    
    def load_version(self, session_id: str, version_id: str, data_type: str) -> Optional[pd.DataFrame]:
        version_dir = self.archive_dir / session_id / version_id
        file_path = version_dir / f"{data_type}.parquet"
        
        if file_path.exists():
            return pd.read_parquet(file_path)
        
        csv_path = version_dir / f"{data_type}.csv"
        if csv_path.exists():
            return pd.read_csv(csv_path, encoding='utf-8-sig')
        
        return None
    
    def list_versions(self, session_id: str, data_type: Optional[str] = None) -> List[Dict[str, Any]]:
        session_dir = self.archive_dir / session_id
        if not session_dir.exists():
            return []
        
        versions = []
        for version_dir in session_dir.iterdir():
            if version_dir.is_dir():
                meta_path = version_dir / 'meta.json'
                if meta_path.exists():
                    with open(meta_path, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                    
                    if data_type is None or meta.get('data_type') == data_type:
                        versions.append(meta)
        
        return sorted(versions, key=lambda x: x['created_at'], reverse=True)
    
    def _cleanup_old_versions(self, session_id: str, data_type: str):
        versions = self.list_versions(session_id, data_type)
        if len(versions) > self.max_versions:
            for version in versions[self.max_versions:]:
                version_dir = self.archive_dir / session_id / version['version_id']
                if version_dir.exists():
                    shutil.rmtree(version_dir)


class DataManager:
    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent
        self.base_dir = base_dir
        self.data_dir = base_dir / "data" / "uploads"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.version_manager = VersionManager(base_dir)
        self.active_session: Optional[SessionState] = None
    
    def create_new_session(self) -> SessionState:
        self.active_session = SessionState()
        return self.active_session
    
    def load_session(self, session_id: str) -> Optional[SessionState]:
        session_file = self.data_dir / f"{session_id}_session.json"
        
        if not session_file.exists():
            return None
        
        with open(session_file, 'r', encoding='utf-8') as f:
            session_meta = json.load(f)
        
        session = SessionState(
            session_id=session_meta.get('session_id', session_id),
            created_at=datetime.fromisoformat(session_meta['created_at']) if session_meta.get('created_at') else None,
            updated_at=datetime.fromisoformat(session_meta['updated_at']) if session_meta.get('updated_at') else None,
            analysis_filters=session_meta.get('analysis_filters', {})
        )
        
        for data_type in ['elderly', 'dish', 'orders', 'servings', 'wastes']:
            df_path = self.data_dir / f"{session_id}_{data_type}.parquet"
            if df_path.exists():
                df = pd.read_parquet(df_path)
                if 'date' in df.columns:
                    df['date'] = pd.to_datetime(df['date']).dt.date
                setattr(session, f"{data_type}_df", df)
        
        corrections_path = self.data_dir / f"{session_id}_corrections.parquet"
        if corrections_path.exists():
            session.manual_corrections = pd.read_parquet(corrections_path)
        
        self.active_session = session
        return session
    
    def save_session(self, session: Optional[SessionState] = None) -> bool:
        if session is None:
            session = self.active_session
        
        if session is None:
            return False
        
        session.updated_at = datetime.now()
        
        session_meta = {
            'session_id': session.session_id,
            'created_at': session.created_at.isoformat() if session.created_at else None,
            'updated_at': session.updated_at.isoformat() if session.updated_at else None,
            'analysis_filters': session.analysis_filters
        }
        
        with open(self.data_dir / f"{session.session_id}_session.json", 'w', encoding='utf-8') as f:
            json.dump(session_meta, f, ensure_ascii=False, indent=2)
        
        data_frames = {
            'elderly': session.elderly_df,
            'dish': session.dish_df,
            'orders': session.orders_df,
            'servings': session.servings_df,
            'wastes': session.wastes_df
        }
        
        for data_type, df in data_frames.items():
            if df is not None and not df.empty:
                df.to_parquet(self.data_dir / f"{session.session_id}_{data_type}.parquet", index=False)
                self.version_manager.save_version(session, data_type, df)
        
        if session.manual_corrections is not None and not session.manual_corrections.empty:
            session.manual_corrections.to_parquet(
                self.data_dir / f"{session.session_id}_corrections.parquet", 
                index=False
            )
        
        return True
    
    def apply_manual_correction(self, correction: Dict[str, Any]) -> bool:
        if self.active_session is None:
            return False
        
        correction_record = pd.DataFrame([{
            'correction_id': str(uuid.uuid4())[:8],
            'correction_time': datetime.now(),
            'data_type': correction.get('data_type', ''),
            'elderly_id': correction.get('elderly_id', ''),
            'date': correction.get('date'),
            'meal_type': correction.get('meal_type', ''),
            'dish_code': correction.get('dish_code', ''),
            'original_value': correction.get('original_value'),
            'new_value': correction.get('new_value'),
            'correction_reason': correction.get('reason', ''),
            'operator': correction.get('operator', '')
        }])
        
        if self.active_session.manual_corrections is None:
            self.active_session.manual_corrections = correction_record
        else:
            self.active_session.manual_corrections = pd.concat(
                [self.active_session.manual_corrections, correction_record],
                ignore_index=True
            )
        
        data_type = correction.get('data_type', '')
        if data_type == 'serving' and self.active_session.servings_df is not None:
            mask = (
                (self.active_session.servings_df['elderly_id'] == correction['elderly_id']) &
                (self.active_session.servings_df['date'] == correction['date']) &
                (self.active_session.servings_df['meal_type'] == correction['meal_type']) &
                (self.active_session.servings_df['dish_code'] == correction['dish_code'])
            )
            if mask.any():
                idx = self.active_session.servings_df[mask].index[0]
                self.active_session.servings_df.loc[idx, 'actual_weight'] = correction['new_value']
                self.active_session.servings_df.loc[idx, 'is_manual'] = True
                self.active_session.servings_df.loc[idx, 'correction_reason'] = correction.get('reason', '')
        
        return True
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions = []
        for session_file in self.data_dir.glob("*_session.json"):
            with open(session_file, 'r', encoding='utf-8') as f:
                meta = json.load(f)
            sessions.append(meta)
        
        return sorted(sessions, key=lambda x: x['updated_at'], reverse=True)


def save_session(session: SessionState, data_manager: Optional[DataManager] = None) -> bool:
    if data_manager is None:
        data_manager = DataManager()
    return data_manager.save_session(session)


def load_session(session_id: str, data_manager: Optional[DataManager] = None) -> Optional[SessionState]:
    if data_manager is None:
        data_manager = DataManager()
    return data_manager.load_session(session_id)


def export_to_csv(df: pd.DataFrame, file_path: Path, **kwargs) -> bool:
    try:
        df.to_csv(file_path, index=False, encoding='utf-8-sig', **kwargs)
        return True
    except Exception:
        return False


def export_to_markdown(report_data: Dict[str, Any], file_path: Path) -> bool:
    try:
        template = EXPORT_CONFIG['markdown_template']
        
        def format_table(data: List[Dict], headers: List[str]) -> str:
            if not data:
                return "无数据"
            
            lines = []
            lines.append("| " + " | ".join(headers) + " |")
            lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
            
            for row in data:
                row_str = "| "
                for h in headers:
                    val = row.get(h.lower(), row.get(h, ""))
                    if isinstance(val, float):
                        val = f"{val:.2f}"
                    row_str += f"{val} | "
                lines.append(row_str)
            
            return "\n".join(lines)
        
        overall_stats = report_data.get('overall_stats', {})
        overall_table = format_table([overall_stats], list(overall_stats.keys()))
        
        nutrition_data = report_data.get('nutrition_overview', [])
        nutrition_table = format_table(nutrition_data, ['营养项', '实际摄入', '参考值', '偏差%'])
        
        waste_data = report_data.get('waste_ranking', [])
        waste_table = format_table(waste_data, ['菜品名称', '分类', '浪费率%', '少打次数'])
        
        under_data = report_data.get('under_served', [])
        under_table = format_table(under_data, ['菜品名称', '分类', '少打率%', '是否长期少打'])
        
        chronic_data = report_data.get('chronic_nutrition', [])
        chronic_table = format_table(chronic_data, ['慢病类型', '人数', '钠摄入', '蛋白质', '关键问题'])
        
        alert_data = report_data.get('nutrition_alerts', [])
        alert_table = format_table(alert_data, ['级别', '营养项', '老人数', '建议'])
        
        recommendations = report_data.get('recommendations', [])
        rec_text = "\n".join([f"- {r}" for r in recommendations]) if recommendations else "暂无特殊建议"
        
        markdown = template.format(
            generate_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            start_date=report_data.get('start_date', '未指定'),
            end_date=report_data.get('end_date', '未指定'),
            data_source=report_data.get('data_source', '配餐偏差复盘台'),
            overall_stats=overall_table,
            nutrition_overview=nutrition_table,
            waste_ranking=waste_table,
            under_served_analysis=under_table,
            chronic_nutrition=chronic_table,
            nutrition_alerts=alert_table,
            recommendations=rec_text
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        return True
    except Exception as e:
        print(f"导出Markdown失败: {e}")
        return False
