from database import db_config


def init_database():
    print("正在创建数据库表...")
    db_config.create_tables()
    print("数据库表创建完成！")


if __name__ == "__main__":
    init_database()
