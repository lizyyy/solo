from database import Base, engine
import models


def init_database():
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成，已创建所有表：")
    print("  - inspection_photos (巡检照片)")
    print("  - cad_layers (CAD图层，含备注)")
    print("  - rescue_profiles (应急救援楼层剖面)")
    print("  - change_history (变更历史)")
    print("  - import_batches (导入批次)")


if __name__ == "__main__":
    init_database()
