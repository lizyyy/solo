from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from app import Base, DataBatch, DeleteSync, RecallValidation
import random

DATABASE_URL = 'sqlite:///vector_index.db'
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

owners = ['张三', '李四', '王五', '赵六', '钱七']
versions = ['v1.0.0', 'v1.1.0', 'v1.2.0', 'v2.0.0', 'v2.1.0']
statuses = ['pending', 'indexing', 'completed', 'failed', 'validating']

sample_batches = [
    {
        'batch_name': '商品向量批次-2024-05-01',
        'embedding_version': 'v2.0.0',
        'owner': '张三',
        'status': 'completed',
        'total_records': 15000,
        'indexed_records': 15000,
        'delete_syncs': [
            {'record_id': 'PROD_001234', 'status': 'success'},
            {'record_id': 'PROD_005678', 'status': 'failed', 'fail_reason': '记录不存在于ES索引中'},
            {'record_id': 'PROD_009012', 'status': 'failed', 'fail_reason': '权限不足，无法删除'},
        ],
        'recall_validations': [
            {'query': 'iPhone 15 Pro Max', 'expected_result': 'PROD_001', 'actual_result': 'PROD_001', 'is_valid': True},
            {'query': '华为Mate 60', 'expected_result': 'PROD_002', 'actual_result': 'PROD_003', 'is_valid': False},
            {'query': '小米14 Ultra', 'expected_result': 'PROD_004', 'actual_result': 'PROD_004', 'is_valid': True},
        ]
    },
    {
        'batch_name': '用户向量批次-2024-05-02',
        'embedding_version': 'v1.2.0',
        'owner': '李四',
        'status': 'indexing',
        'total_records': 50000,
        'indexed_records': 32000,
        'delete_syncs': [
            {'record_id': 'USER_100001', 'status': 'success'},
            {'record_id': 'USER_100002', 'status': 'pending'},
            {'record_id': 'USER_100003', 'status': 'failed', 'fail_reason': '用户ID格式错误'},
            {'record_id': 'USER_100004', 'status': 'success'},
        ],
        'recall_validations': [
            {'query': '金融理财用户', 'expected_result': 'USER_GROUP_A', 'actual_result': 'USER_GROUP_A', 'is_valid': True},
            {'query': '电商活跃用户', 'expected_result': 'USER_GROUP_B', 'actual_result': None, 'is_valid': None},
        ]
    },
    {
        'batch_name': '内容向量批次-2024-05-03',
        'embedding_version': 'v2.1.0',
        'owner': '王五',
        'status': 'validating',
        'total_records': 25000,
        'indexed_records': 25000,
        'delete_syncs': [
            {'record_id': 'CONTENT_0001', 'status': 'success'},
            {'record_id': 'CONTENT_0002', 'status': 'success'},
        ],
        'recall_validations': [
            {'query': '人工智能教程', 'expected_result': 'CONTENT_001', 'actual_result': 'CONTENT_001', 'is_valid': True},
            {'query': 'Python编程入门', 'expected_result': 'CONTENT_002', 'actual_result': 'CONTENT_005', 'is_valid': False},
            {'query': '机器学习实战', 'expected_result': 'CONTENT_003', 'actual_result': 'CONTENT_003', 'is_valid': True},
            {'query': '深度学习框架', 'expected_result': 'CONTENT_004', 'actual_result': None, 'is_valid': None},
        ]
    },
    {
        'batch_name': '搜索日志批次-2024-05-04',
        'embedding_version': 'v1.1.0',
        'owner': '赵六',
        'status': 'failed',
        'total_records': 100000,
        'indexed_records': 45000,
        'delete_syncs': [],
        'recall_validations': []
    },
    {
        'batch_name': '推荐结果批次-2024-05-05',
        'embedding_version': 'v2.0.0',
        'owner': '钱七',
        'status': 'pending',
        'total_records': 30000,
        'indexed_records': 0,
        'delete_syncs': [
            {'record_id': 'REC_50001', 'status': 'pending'},
            {'record_id': 'REC_50002', 'status': 'pending'},
            {'record_id': 'REC_50003', 'status': 'failed', 'fail_reason': '连接超时，重试3次失败'},
        ],
        'recall_validations': []
    },
]

for batch_data in sample_batches:
    batch = DataBatch(
        batch_name=batch_data['batch_name'],
        embedding_version=batch_data['embedding_version'],
        owner=batch_data['owner'],
        status=batch_data['status'],
        total_records=batch_data['total_records'],
        indexed_records=batch_data['indexed_records'],
        created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
        updated_at=datetime.utcnow() - timedelta(days=random.randint(0, 5))
    )
    db.add(batch)
    db.flush()
    
    for d_data in batch_data.get('delete_syncs', []):
        delete_sync = DeleteSync(
            batch_id=batch.id,
            record_id=d_data['record_id'],
            status=d_data['status'],
            fail_reason=d_data.get('fail_reason'),
            handler=random.choice(owners) if d_data['status'] in ['success', 'failed'] else None,
            handled_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48)) if d_data['status'] in ['success', 'failed'] else None,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 10))
        )
        db.add(delete_sync)
    
    for v_data in batch_data.get('recall_validations', []):
        validation = RecallValidation(
            batch_id=batch.id,
            query=v_data['query'],
            expected_result=v_data['expected_result'],
            actual_result=v_data['actual_result'],
            is_valid=v_data['is_valid'],
            handler=random.choice(owners) if v_data['is_valid'] is not None else None,
            handled_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48)) if v_data['is_valid'] is not None else None,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 10))
        )
        db.add(validation)

db.commit()
print("数据库初始化完成，已插入示例数据！")
