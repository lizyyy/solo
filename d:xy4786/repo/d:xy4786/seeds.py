from typing import List, Dict, Any

SEED_DATA = {
    "migrations": [
        {
            "version": "v1.0.0",
            "description": "基础数据结构初始化 - 包含窗口、过敏原、角色基础数据"
        },
        {
            "version": "v1.1.0",
            "description": "套餐数据扩展 - 增加套餐与窗口、过敏原的关联"
        },
        {
            "version": "v1.2.0",
            "description": "角色权限优化 - 调整默认角色的权限配置"
        }
    ],
    "windows": [
        {
            "code": "WIN001",
            "name": "早餐窗口",
            "description": "供应早餐食品",
            "floor": 1,
            "status": "active"
        },
        {
            "code": "WIN002",
            "name": "中餐窗口",
            "description": "供应午餐套餐",
            "floor": 1,
            "status": "active"
        },
        {
            "code": "WIN003",
            "name": "晚餐窗口",
            "description": "供应晚餐套餐",
            "floor": 1,
            "status": "active"
        },
        {
            "code": "WIN004",
            "name": "特色餐窗口",
            "description": "供应特色小吃",
            "floor": 2,
            "status": "active"
        },
        {
            "code": "WIN005",
            "name": "清真窗口",
            "description": "清真食品专用窗口",
            "floor": 2,
            "status": "active"
        }
    ],
    "allergens": [
        {
            "code": "ALLER001",
            "name": "花生",
            "description": "含花生或花生油成分",
            "icon": "🥜"
        },
        {
            "code": "ALLER002",
            "name": "海鲜",
            "description": "含海鲜类成分",
            "icon": "🦐"
        },
        {
            "code": "ALLER003",
            "name": "乳制品",
            "description": "含牛奶或奶制品",
            "icon": "🥛"
        },
        {
            "code": "ALLER004",
            "name": "小麦",
            "description": "含小麦或面筋",
            "icon": "🌾"
        },
        {
            "code": "ALLER005",
            "name": "大豆",
            "description": "含大豆或豆制品",
            "icon": "🫘"
        },
        {
            "code": "ALLER006",
            "name": "坚果",
            "description": "含坚果类成分",
            "icon": "🌰"
        }
    ],
    "roles": [
        {
            "code": "ROLE_ADMIN",
            "name": "系统管理员",
            "description": "拥有系统所有权限",
            "permissions": ["all:read", "all:write", "all:delete", "system:manage"],
            "is_default": 0
        },
        {
            "code": "ROLE_STAFF",
            "name": "食堂员工",
            "description": "食堂日常运营人员",
            "permissions": ["order:read", "order:update", "inventory:read"],
            "is_default": 1
        },
        {
            "code": "ROLE_STUDENT",
            "name": "学生用户",
            "description": "普通点餐用户",
            "permissions": ["order:read", "order:create", "menu:read"],
            "is_default": 1
        },
        {
            "code": "ROLE_KITCHEN",
            "name": "后厨人员",
            "description": "负责餐品制作",
            "permissions": ["order:read", "inventory:read", "inventory:update"],
            "is_default": 0
        }
    ],
    "packages": [
        {
            "code": "PKG001",
            "name": "营养早餐A",
            "description": "包含：包子、鸡蛋、豆浆",
            "price": 8.5,
            "window_code": "WIN001",
            "allergens": ["ALLER004", "ALLER003"],
            "status": "active"
        },
        {
            "code": "PKG002",
            "name": "营养早餐B",
            "description": "包含：油条、豆腐脑",
            "price": 6.0,
            "window_code": "WIN001",
            "allergens": ["ALLER004", "ALLER005"],
            "status": "active"
        },
        {
            "code": "PKG003",
            "name": "经典午餐A",
            "description": "包含：红烧肉、青菜、米饭",
            "price": 15.0,
            "window_code": "WIN002",
            "allergens": ["ALLER004"],
            "status": "active"
        },
        {
            "code": "PKG004",
            "name": "经典午餐B",
            "description": "包含：宫保鸡丁、青菜、米饭",
            "price": 14.0,
            "window_code": "WIN002",
            "allergens": ["ALLER001", "ALLER004"],
            "status": "active"
        },
        {
            "code": "PKG005",
            "name": "晚餐套餐A",
            "description": "包含：面条、小菜",
            "price": 12.0,
            "window_code": "WIN003",
            "allergens": ["ALLER004"],
            "status": "active"
        },
        {
            "code": "PKG006",
            "name": "晚餐套餐B",
            "description": "包含：炒饭、汤",
            "price": 13.0,
            "window_code": "WIN003",
            "allergens": ["ALLER004"],
            "status": "active"
        },
        {
            "code": "PKG007",
            "name": "特色小吃A",
            "description": "包含：煎饺",
            "price": 10.0,
            "window_code": "WIN004",
            "allergens": ["ALLER004", "ALLER005"],
            "status": "active"
        },
        {
            "code": "PKG008",
            "name": "清真套餐A",
            "description": "包含：清真拉面",
            "price": 15.0,
            "window_code": "WIN005",
            "allergens": ["ALLER004"],
            "status": "active"
        }
    ]
}


def get_seed_by_type(seed_type: str) -> List[Dict[str, Any]]:
    type_mapping = {
        "migration": SEED_DATA["migrations"],
        "window": SEED_DATA["windows"],
        "allergen": SEED_DATA["allergens"],
        "role": SEED_DATA["roles"],
        "package": SEED_DATA["packages"]
    }
    return type_mapping.get(seed_type, [])


def get_all_seed_types() -> List[str]:
    return ["migration", "window", "allergen", "role", "package"]
