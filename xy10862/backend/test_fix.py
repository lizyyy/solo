#!/usr/bin/env python3
"""测试修复是否正常工作"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Task, Lock, ExecutionLog, AbnormalQueue, TaskStatus, LockStatus
from app.lock_service import MutexLockService
from datetime import datetime, timedelta

# 创建数据库连接
engine = create_engine("sqlite:///./mutex_lock_test.db")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_1_abnormal_queue_relationship():
    """测试 1: AbnormalQueue 的 task 关系是否正常"""
    print("\n" + "="*60)
    print("测试 1: AbnormalQueue 的 task 关系")
    print("="*60)
    
    db = SessionLocal()
    try:
        # 创建任务
        task = Task(name="test_task_1", description="Test task")
        db.add(task)
        db.commit()
        db.refresh(task)
        
        # 创建异常记录
        abnormal = AbnormalQueue(
            task_id=task.id,
            instance_id="test-instance",
            abnormal_type="test_type",
            description="Test abnormal"
        )
        db.add(abnormal)
        db.commit()
        db.refresh(abnormal)
        
        # 验证可以通过关系访问 task.name
        task_name = abnormal.task.name
        print(f"  ✅ abnormal.task.name = {task_name}")
        print(f"  ✅ 测试 1 通过: AbnormalQueue.task 关系正常工作")
        
        return True
    except Exception as e:
        print(f"  ❌ 测试 1 失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

def test_2_duplicate_execution_detection():
    """测试 2: 重复执行检测是否在抢锁流程中被调用"""
    print("\n" + "="*60)
    print("测试 2: 重复执行检测功能")
    print("="*60)
    
    db = SessionLocal()
    service = MutexLockService(db)
    
    try:
        task_name = "test_task_2"
        instance_1 = "instance-A"
        instance_2 = "instance-B"
        
        # 1. 实例 A 抢锁并成功执行
        print(f"  步骤 1: {instance_1} 抢锁...")
        success, msg, lock = service.acquire_lock(task_name, instance_1)
        print(f"    结果: {success}, {msg}")
        assert success == True, "第一次抢锁应该成功"
        
        # 2. 实例 A 释放锁（成功完成）
        print(f"  步骤 2: {instance_1} 释放锁（成功完成）...")
        success, msg = service.release_lock(task_name, instance_1, success=True, result="Done")
        print(f"    结果: {success}, {msg}")
        
        # 3. 实例 B 在 5 分钟内尝试抢锁，应该被重复执行检测拦截
        print(f"  步骤 3: {instance_2} 在短时间内尝试抢锁...")
        success, msg, lock = service.acquire_lock(task_name, instance_2)
        print(f"    结果: {success}, {msg}")
        
        if "Duplicate" in msg or "duplicate" in msg:
            print(f"  ✅ 测试 2 通过: 重复执行检测正常工作")
            
            # 验证有重复标记的执行日志
            dup_log = db.query(ExecutionLog).filter(
                ExecutionLog.instance_id == instance_2,
                ExecutionLog.is_duplicate == True
            ).first()
            if dup_log:
                print(f"  ✅ 验证: 执行日志正确标记为重复")
            return True
        else:
            print(f"  ❌ 测试 2 失败: 未被重复执行检测拦截")
            return False
            
    except Exception as e:
        print(f"  ❌ 测试 2 失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

def test_3_lock_timeout_abnormal():
    """测试 3: 锁超时产生异常记录后能否正常查询"""
    print("\n" + "="*60)
    print("测试 3: 锁超时异常记录查询")
    print("="*60)
    
    db = SessionLocal()
    service = MutexLockService(db)
    
    try:
        task_name = "test_task_3"
        instance_id = "instance-timeout"
        
        # 1. 抢锁
        print(f"  步骤 1: 抢锁...")
        success, msg, lock = service.acquire_lock(task_name, instance_id)
        print(f"    结果: {success}, {msg}")
        
        # 2. 手动将锁设置为已过期（模拟超时）
        print(f"  步骤 2: 模拟锁超时...")
        lock.expires_at = datetime.utcnow() - timedelta(seconds=10)
        db.commit()
        
        # 3. 清理超时锁（会产生异常记录）
        print(f"  步骤 3: 清理超时锁...")
        service.cleanup_expired_locks()
        
        # 4. 查询异常队列（这就是 main.py 中会报错的操作）
        print(f"  步骤 4: 查询异常队列（验证不会 500）...")
        abnormals = db.query(AbnormalQueue).all()
        
        for item in abnormals:
            # 这就是 main.py:187 和 main.py:290 会执行的操作
            task_name = item.task.name
            print(f"    异常记录: task.name={task_name}, type={item.abnormal_type}")
        
        print(f"  ✅ 测试 3 通过: 异常队列查询正常，不会 500")
        return True
        
    except Exception as e:
        print(f"  ❌ 测试 3 失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

def test_4_force_release_abnormal():
    """测试 4: 强制释放锁产生异常记录后能否正常查询"""
    print("\n" + "="*60)
    print("测试 4: 强制释放锁异常记录查询")
    print("="*60)
    
    db = SessionLocal()
    service = MutexLockService(db)
    
    try:
        task_name = "test_task_4"
        instance_id = "instance-force"
        
        # 1. 抢锁
        print(f"  步骤 1: 抢锁...")
        success, msg, lock = service.acquire_lock(task_name, instance_id)
        print(f"    结果: {success}, {msg}")
        
        # 2. 强制释放锁（会产生异常记录）
        print(f"  步骤 2: 强制释放锁...")
        success, msg = service.force_release_lock(lock.id, "Test force release")
        print(f"    结果: {success}, {msg}")
        
        # 3. 查询异常队列
        print(f"  步骤 3: 查询异常队列...")
        abnormals = db.query(AbnormalQueue).all()
        
        for item in abnormals:
            task_name = item.task.name
            print(f"    异常记录: task.name={task_name}, type={item.abnormal_type}")
        
        print(f"  ✅ 测试 4 通过: 强制释放锁后的异常队列查询正常")
        return True
        
    except Exception as e:
        print(f"  ❌ 测试 4 失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

def main():
    print("\n" + "="*60)
    print("  定时任务互斥锁 API - 修复验证测试")
    print("="*60)
    
    # 清理旧的测试数据库
    if os.path.exists("./mutex_lock_test.db"):
        os.remove("./mutex_lock_test.db")
    
    results = []
    results.append(test_1_abnormal_queue_relationship())
    results.append(test_2_duplicate_execution_detection())
    results.append(test_3_lock_timeout_abnormal())
    results.append(test_4_force_release_abnormal())
    
    print("\n" + "="*60)
    print("  测试结果汇总")
    print("="*60)
    passed = sum(results)
    total = len(results)
    print(f"  通过: {passed}/{total}")
    
    if passed == total:
        print("\n  ✅ 所有测试通过！修复成功！")
        # 清理测试数据库
        if os.path.exists("./mutex_lock_test.db"):
            os.remove("./mutex_lock_test.db")
        return 0
    else:
        print("\n  ❌ 部分测试失败！")
        return 1

if __name__ == "__main__":
    sys.exit(main())
