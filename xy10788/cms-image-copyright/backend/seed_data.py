import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append('.')
from models import Image, ImageUsage, ReplacementRecord, CopyrightExtension, Base
from database import engine

DATABASE_URL = "sqlite:///./cms_copyright.db"
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    
    try:
        print("开始创建测试数据...")
        
        now = datetime.utcnow()
        
        normal_image = Image(
            original_url="https://example.com/images/normal-photo.jpg",
            file_name="normal-photo.jpg",
            file_path="normal-photo.jpg",
            copyright_holder="视觉中国",
            license_type="商业授权",
            copyright_expiry_date=now + timedelta(days=180),
            status="normal"
        )
        db.add(normal_image)
        db.flush()
        
        expiring_image = Image(
            original_url="https://example.com/images/expiring-soon-photo.jpg",
            file_name="expiring-soon-photo.jpg",
            file_path="expiring-soon-photo.jpg",
            copyright_holder="Getty Images",
            license_type="编辑授权",
            copyright_expiry_date=now + timedelta(days=15),
            status="expiring_soon"
        )
        db.add(expiring_image)
        db.flush()
        
        expired_image = Image(
            original_url="https://example.com/images/expired-photo.jpg",
            file_name="expired-photo.jpg",
            file_path="expired-photo.jpg",
            copyright_holder="Shutterstock",
            license_type="商业授权",
            copyright_expiry_date=now - timedelta(days=30),
            status="expired"
        )
        db.add(expired_image)
        db.flush()
        
        replacement_image = Image(
            original_url="https://example.com/images/replacement-photo.jpg",
            file_name="replacement-photo.jpg",
            file_path="replacement-photo.jpg",
            copyright_holder="Unsplash",
            license_type="免费授权",
            copyright_expiry_date=now + timedelta(days=365),
            status="normal"
        )
        db.add(replacement_image)
        db.flush()
        
        multi_use_image = Image(
            original_url="https://example.com/images/multi-use-photo.jpg",
            file_name="multi-use-photo.jpg",
            file_path="multi-use-photo.jpg",
            copyright_holder="Pixabay",
            license_type="CC0授权",
            copyright_expiry_date=now + timedelta(days=60),
            status="normal"
        )
        db.add(multi_use_image)
        db.flush()
        
        pages = [
            {"url": "https://example.com/articles/how-to-start-blogging", "title": "如何开始写博客"},
            {"url": "https://example.com/articles/travel-guide-2024", "title": "2024年旅行指南"},
            {"url": "https://example.com/articles/health-tips", "title": "健康小贴士"},
            {"url": "https://example.com/articles/tech-news", "title": "科技新闻"},
        ]
        
        usages_data = [
            (normal_image.id, 0, "文章头部"),
            (normal_image.id, 1, "侧边栏"),
            (expiring_image.id, 0, "封面图"),
            (expiring_image.id, 2, "配图"),
            (expired_image.id, 1, "文章尾部"),
            (expired_image.id, 3, "推荐位"),
            (multi_use_image.id, 0, "插图1"),
            (multi_use_image.id, 1, "插图2"),
            (multi_use_image.id, 2, "插图3"),
        ]
        
        for img_id, page_idx, location in usages_data:
            usage = ImageUsage(
                image_id=img_id,
                page_url=pages[page_idx]["url"],
                page_title=pages[page_idx]["title"],
                usage_location=location,
                is_active=True
            )
            db.add(usage)
        
        failed_replacement = ReplacementRecord(
            old_image_id=expired_image.id,
            new_image_id=replacement_image.id,
            page_url="https://example.com/articles/failed-replacement",
            old_url=expired_image.original_url,
            new_url=replacement_image.original_url,
            status="failed",
            initiated_by="张三",
            error_message="CMS API连接超时，替换失败",
            replacement_key="failed_demo_001"
        )
        db.add(failed_replacement)
        
        completed_replacement = ReplacementRecord(
            old_image_id=expired_image.id,
            new_image_id=normal_image.id,
            page_url=pages[3]["url"],
            old_url=expired_image.original_url,
            new_url=normal_image.original_url,
            status="completed",
            initiated_by="李四",
            replacement_key="completed_demo_001"
        )
        db.add(completed_replacement)
        
        extension = CopyrightExtension(
            image_id=expiring_image.id,
            previous_expiry_date=expiring_image.copyright_expiry_date,
            new_expiry_date=now + timedelta(days=180),
            extended_by="王五",
            reason="版权续约，延长授权期"
        )
        db.add(extension)
        
        db.commit()
        print("测试数据创建完成！")
        print(f"\n创建的图片:")
        print(f"  - ID {normal_image.id}: 正常授权图片 (180天后过期)")
        print(f"  - ID {expiring_image.id}: 即将过期图片 (15天后过期)")
        print(f"  - ID {expired_image.id}: 已过期图片 (已过期30天)")
        print(f"  - ID {replacement_image.id}: 替换用图片")
        print(f"  - ID {multi_use_image.id}: 多页面引用图片 (被3个页面引用)")
        print(f"\n已创建4个示例页面，包含多个图片引用关系")
        print(f"已创建1个失败的替换记录和1个成功的替换记录")
        print(f"已创建1个版权延长示例")
        
    except Exception as e:
        db.rollback()
        print(f"创建数据失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
