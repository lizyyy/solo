from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import json
import hashlib
from app.models import QueryCache, Dataset
from app.config import settings


class CacheManager:
    """查询缓存管理服务"""
    
    def __init__(self):
        self.default_ttl = settings.CACHE_TTL_SECONDS
        self.max_cache_size = settings.MAX_CACHE_SIZE
    
    def _generate_query_hash(self,
                              dataset_id: int,
                              group_by: List[str],
                              aggregations: List[Dict[str, Any]],
                              filters: Dict[str, Any] = None) -> str:
        """
        生成查询的唯一哈希
        
        Args:
            dataset_id: 数据集ID
            group_by: 分组字段
            aggregations: 聚合操作
            filters: 筛选条件
            
        Returns:
            SHA256哈希字符串
        """
        # 构建可哈希的查询对象
        query_obj = {
            'dataset_id': dataset_id,
            'group_by': sorted(group_by) if group_by else [],
            'aggregations': sorted(
                [json.dumps(agg, sort_keys=True, default=str) for agg in aggregations]
            ) if aggregations else [],
            'filters': json.dumps(filters, sort_keys=True, default=str) if filters else '{}'
        }
        
        # 序列化并哈希
        query_str = json.dumps(query_obj, sort_keys=True, default=str)
        return hashlib.sha256(query_str.encode('utf-8')).hexdigest()
    
    def get_cached_result(self,
                          db: Session,
                          dataset_id: int,
                          group_by: List[str],
                          aggregations: List[Dict[str, Any]],
                          filters: Dict[str, Any] = None) -> Optional[QueryCache]:
        """
        获取缓存的查询结果
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            group_by: 分组字段
            aggregations: 聚合操作
            filters: 筛选条件
            
        Returns:
            缓存的查询结果或None（如果未找到或已过期）
        """
        query_hash = self._generate_query_hash(
            dataset_id=dataset_id,
            group_by=group_by,
            aggregations=aggregations,
            filters=filters
        )
        
        # 查询缓存
        cache = db.query(QueryCache).filter(
            QueryCache.query_hash == query_hash,
            QueryCache.expires_at > datetime.utcnow()
        ).first()
        
        if cache:
            # 更新命中计数
            cache.hit_count += 1
            db.commit()
            db.refresh(cache)
        
        return cache
    
    def cache_result(self,
                    db: Session,
                    dataset_id: int,
                    group_by: List[str],
                    aggregations: List[Dict[str, Any]],
                    filters: Dict[str, Any],
                    result: List[Dict[str, Any]],
                    epsilon_used: float,
                    ttl_seconds: int = None) -> QueryCache:
        """
        缓存查询结果
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            group_by: 分组字段
            aggregations: 聚合操作
            filters: 筛选条件
            result: 查询结果
            epsilon_used: 消耗的epsilon
            ttl_seconds: 缓存有效期（秒）
            
        Returns:
            创建的缓存记录
        """
        if ttl_seconds is None:
            ttl_seconds = self.default_ttl
        
        query_hash = self._generate_query_hash(
            dataset_id=dataset_id,
            group_by=group_by,
            aggregations=aggregations,
            filters=filters
        )
        
        # 检查是否已存在
        existing = db.query(QueryCache).filter(
            QueryCache.query_hash == query_hash
        ).first()
        
        if existing:
            # 更新现有缓存
            existing.result = json.dumps(result, ensure_ascii=False, default=str)
            existing.epsilon_used = epsilon_used
            existing.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
            existing.hit_count = 0
            db.commit()
            db.refresh(existing)
            return existing
        
        # 检查缓存大小，清理过期缓存
        self._cleanup_cache(db, dataset_id)
        
        # 创建新缓存
        cache = QueryCache(
            dataset_id=dataset_id,
            query_hash=query_hash,
            query_type='aggregate',  # 默认为聚合查询
            query_parameters=json.dumps({
                'group_by': group_by,
                'aggregations': aggregations,
                'filters': filters
            }, ensure_ascii=False, default=str),
            result=json.dumps(result, ensure_ascii=False, default=str),
            epsilon_used=epsilon_used,
            expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds)
        )
        
        db.add(cache)
        db.commit()
        db.refresh(cache)
        
        return cache
    
    def _cleanup_cache(self, db: Session, dataset_id: int = None):
        """
        清理过期缓存和超出大小限制的缓存
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID（可选）
        """
        try:
            # 首先删除所有过期的缓存
            query = db.query(QueryCache)
            if dataset_id:
                query = query.filter(QueryCache.dataset_id == dataset_id)
            
            expired_count = query.filter(
                QueryCache.expires_at <= datetime.utcnow()
            ).delete(synchronize_session=False)
            
            # 检查是否超出大小限制
            count_query = db.query(QueryCache)
            if dataset_id:
                count_query = count_query.filter(QueryCache.dataset_id == dataset_id)
            
            total_count = count_query.count()
            
            if total_count > self.max_cache_size:
                # 删除最旧的和命中率最低的缓存
                to_delete = count_query.order_by(
                    QueryCache.hit_count.asc(),
                    QueryCache.created_at.asc()
                ).limit(total_count - self.max_cache_size).all()
                
                for cache in to_delete:
                    db.delete(cache)
            
            db.commit()
            
        except SQLAlchemyError:
            db.rollback()
    
    def invalidate_cache(self,
                         db: Session,
                         dataset_id: int,
                         query_hash: str = None) -> int:
        """
        使缓存失效
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            query_hash: 查询哈希（可选，如果不提供则使该数据集的所有缓存失效）
            
        Returns:
            失效的缓存数量
        """
        try:
            query = db.query(QueryCache).filter(
                QueryCache.dataset_id == dataset_id
            )
            
            if query_hash:
                query = query.filter(QueryCache.query_hash == query_hash)
            
            count = query.delete(synchronize_session=False)
            db.commit()
            
            return count
            
        except SQLAlchemyError:
            db.rollback()
            return 0
    
    def invalidate_all_caches(self, db: Session) -> int:
        """
        使所有缓存失效
        
        Args:
            db: 数据库会话
            
        Returns:
            失效的缓存数量
        """
        try:
            count = db.query(QueryCache).delete(synchronize_session=False)
            db.commit()
            return count
        except SQLAlchemyError:
            db.rollback()
            return 0
    
    def get_cache_stats(self,
                       db: Session,
                       dataset_id: int = None) -> Dict[str, Any]:
        """
        获取缓存统计信息
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID（可选）
            
        Returns:
            统计信息字典
        """
        query = db.query(QueryCache)
        
        if dataset_id:
            query = query.filter(QueryCache.dataset_id == dataset_id)
        
        caches = query.all()
        
        total_count = len(caches)
        total_hits = sum(cache.hit_count for cache in caches)
        
        # 计算过期数量
        now = datetime.utcnow()
        expired_count = sum(1 for cache in caches if cache.expires_at <= now)
        
        # 按数据集统计
        dataset_stats = {}
        for cache in caches:
            did = cache.dataset_id
            if did not in dataset_stats:
                dataset_stats[did] = {
                    'count': 0,
                    'total_hits': 0,
                    'total_epsilon_saved': 0
                }
            dataset_stats[did]['count'] += 1
            dataset_stats[did]['total_hits'] += cache.hit_count
            # 每次命中都节省了一次epsilon消耗
            dataset_stats[did]['total_epsilon_saved'] += cache.hit_count * cache.epsilon_used
        
        return {
            'total_cache_entries': total_count,
            'expired_entries': expired_count,
            'active_entries': total_count - expired_count,
            'total_hits': total_hits,
            'average_hits_per_entry': total_hits / total_count if total_count > 0 else 0,
            'dataset_statistics': dataset_stats
        }
    
    def parse_cached_result(self, cache: QueryCache) -> List[Dict[str, Any]]:
        """
        解析缓存的结果
        
        Args:
            cache: 缓存对象
            
        Returns:
            解析后的结果列表
        """
        try:
            return json.loads(cache.result)
        except (json.JSONDecodeError, TypeError):
            return []


cache_manager = CacheManager()
