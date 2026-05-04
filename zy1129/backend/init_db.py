import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import async_session, init_db, Base, engine
from app.data.seed_data import create_seed_data


async def init_database(with_seed: bool = True):
    print("初始化数据库...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    print("数据库表创建完成！")
    
    if with_seed:
        print("正在创建种子数据...")
        async with async_session() as session:
            await create_seed_data(session)
        print("种子数据创建完成！")
    
    print("\n数据库初始化完成！")
    print("可以使用以下命令启动服务：")
    print("  uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="初始化保险系统数据库")
    parser.add_argument("--no-seed", action="store_true", help="不创建种子数据")
    
    args = parser.parse_args()
    
    asyncio.run(init_database(with_seed=not args.no_seed))
