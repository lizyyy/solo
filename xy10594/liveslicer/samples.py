from typing import Dict, List, Any
from .models import TimelineSegment, Subtitle, Product, Violation


def get_sample_data(category: str) -> Dict[str, Any]:
    if category == "beauty":
        return _get_beauty_sample()
    elif category == "food":
        return _get_food_sample()
    elif category == "fashion":
        return _get_fashion_sample()
    else:
        return _get_beauty_sample()


def _get_beauty_sample() -> Dict[str, Any]:
    return {
        "subtitle_offset": 2.5,
        "timeline_segments": [
            TimelineSegment(start_time=0.0, end_time=180.0, title="开场欢迎与品牌介绍", description="主播介绍直播间和品牌背景"),
            TimelineSegment(start_time=180.0, end_time=600.0, title="护肤流程演示", description="完整的护肤步骤演示"),
            TimelineSegment(start_time=600.0, end_time=900.0, title="彩妆教程", description="日常妆容教程"),
            TimelineSegment(start_time=900.0, end_time=1200.0, title="限时抢购环节", description="多款产品限时特惠"),
            TimelineSegment(start_time=1200.0, end_time=1500.0, title="用户问答", description="解答粉丝问题"),
        ],
        "subtitles": [
            Subtitle(id="sub-001", start_time=5.0, end_time=8.0, text="欢迎大家来到我的直播间"),
            Subtitle(id="sub-002", start_time=10.0, end_time=14.0, text="今天给大家带来我们家的明星产品"),
            Subtitle(id="sub-003", start_time=185.0, end_time=190.0, text="首先我们来做洁面，这款洗面奶非常温和"),
            Subtitle(id="sub-004", start_time=195.0, end_time=200.0, text="大家可以看到它的泡沫非常细腻"),
            Subtitle(id="sub-005", start_time=210.0, end_time=215.0, text="接下来是爽肤水，轻轻拍打吸收"),
            Subtitle(id="sub-006", start_time=250.0, end_time=255.0, text="这款精华液含有玻尿酸成分"),
            Subtitle(id="sub-007", start_time=320.0, end_time=325.0, text="保湿效果非常好，适合秋冬季节"),
            Subtitle(id="sub-008", start_time=620.0, end_time=625.0, text="现在我们来画底妆，先涂隔离"),
            Subtitle(id="sub-009", start_time=650.0, end_time=655.0, text="这款粉底液的遮瑕力中等偏上"),
            Subtitle(id="sub-010", start_time=700.0, end_time=705.0, text="绝对保证正品，大家可以放心购买"),
            Subtitle(id="sub-011", start_time=920.0, end_time=925.0, text="现在是限时抢购环节，价格非常优惠"),
            Subtitle(id="sub-012", start_time=950.0, end_time=955.0, text="买一送一，只限今天直播间"),
            Subtitle(id="sub-013", start_time=980.0, end_time=985.0, text="最后五分钟，倒计时开始"),
            Subtitle(id="sub-014", start_time=1250.0, end_time=1255.0, text="敏感肌可以使用这款产品吗"),
            Subtitle(id="sub-015", start_time=1260.0, end_time=1265.0, text="敏感肌也是可以的，我们的成分很温和"),
        ],
        "products": [
            Product(product_id="BEAUTY-001", name="氨基酸洁面乳", link_time=180.0, unlink_time=300.0, category="洁面"),
            Product(product_id="BEAUTY-002", name="玻尿酸精华液", link_time=240.0, unlink_time=400.0, category="精华"),
            Product(product_id="BEAUTY-003", name="保湿爽肤水", link_time=380.0, unlink_time=500.0, category="护肤水"),
            Product(product_id="BEAUTY-004", name="持久粉底液", link_time=600.0, unlink_time=750.0, category="底妆"),
            Product(product_id="BEAUTY-005", name="隔离霜", link_time=620.0, unlink_time=680.0, category="底妆"),
            Product(product_id="BEAUTY-006", name="丝绒口红", link_time=800.0, unlink_time=900.0, category="唇部"),
        ],
        "violations": [
            Violation(id="VIO-001", start_time=700.0, end_time=710.0, level="warning", reason="提及绝对化用语:绝对保证"),
            Violation(id="VIO-002", start_time=980.0, end_time=990.0, level="info", reason="使用倒计时话术诱导下单"),
        ],
    }


def _get_food_sample() -> Dict[str, Any]:
    return {
        "subtitle_offset": -1.0,
        "timeline_segments": [
            TimelineSegment(start_time=0.0, end_time=120.0, title="开播福利介绍", description="开播送福利活动"),
            TimelineSegment(start_time=120.0, end_time=400.0, title="零食试吃环节", description="多款零食现场试吃"),
            TimelineSegment(start_time=400.0, end_time=700.0, title="生鲜产品展示", description="海鲜和水果展示"),
            TimelineSegment(start_time=700.0, end_time=1000.0, title="烹饪教程", description="现场烹饪演示"),
            TimelineSegment(start_time=1000.0, end_time=1300.0, title="组合套餐推荐", description="优惠组合套餐"),
        ],
        "subtitles": [
            Subtitle(id="sub-101", start_time=3.0, end_time=7.0, text="今天开播福利，前100名下单有赠品"),
            Subtitle(id="sub-102", start_time=10.0, end_time=15.0, text="大家先点关注加粉丝团"),
            Subtitle(id="sub-103", start_time=130.0, end_time=135.0, text="这款坚果非常酥脆，大家听声音"),
            Subtitle(id="sub-104", start_time=150.0, end_time=155.0, text="生产日期都是最新的，保质期12个月"),
            Subtitle(id="sub-105", start_time=180.0, end_time=185.0, text="这是我们最畅销的口味"),
            Subtitle(id="sub-106", start_time=200.0, end_time=205.0, text="味道真的是绝了，大家一定要试试"),
            Subtitle(id="sub-107", start_time=420.0, end_time=425.0, text="这款大虾都是冷链运输，非常新鲜"),
            Subtitle(id="sub-108", start_time=450.0, end_time=455.0, text="个头很大，每只都有手掌那么大"),
            Subtitle(id="sub-109", start_time=500.0, end_time=505.0, text="这个是有机种植的，没有农药"),
            Subtitle(id="sub-110", start_time=720.0, end_time=725.0, text="现在我们来做一道蒜蓉大虾"),
            Subtitle(id="sub-111", start_time=780.0, end_time=785.0, text="这样做出来的虾肉质鲜嫩多汁"),
            Subtitle(id="sub-112", start_time=1050.0, end_time=1055.0, text="今天的组合套餐比单独购买便宜50元"),
            Subtitle(id="sub-113", start_time=1100.0, end_time=1105.0, text="买零食组合送收纳箱一个"),
        ],
        "products": [
            Product(product_id="FOOD-001", name="坚果礼盒装", link_time=125.0, unlink_time=250.0, category="零食"),
            Product(product_id="FOOD-002", name="进口大虾", link_time=410.0, unlink_time=550.0, category="生鲜"),
            Product(product_id="FOOD-003", name="有机草莓", link_time=480.0, unlink_time=600.0, category="水果"),
            Product(product_id="FOOD-004", name="秘制调味料", link_time=710.0, unlink_time=800.0, category="调料"),
            Product(product_id="FOOD-005", name="零食组合礼包", link_time=1020.0, unlink_time=1200.0, category="组合"),
        ],
        "violations": [
            Violation(id="VIO-101", start_time=200.0, end_time=210.0, level="warning", reason="使用极限词:绝了"),
            Violation(id="VIO-102", start_time=500.0, end_time=510.0, level="info", reason="宣传有机但未提供认证信息"),
        ],
    }


def _get_fashion_sample() -> Dict[str, Any]:
    return {
        "subtitle_offset": 0.0,
        "timeline_segments": [
            TimelineSegment(start_time=0.0, end_time=150.0, title="新品预告", description="新品款式预告"),
            TimelineSegment(start_time=150.0, end_time=450.0, title="春季外套专场", description="春季外套款式展示"),
            TimelineSegment(start_time=450.0, end_time=750.0, title="连衣裙系列", description="多款连衣裙展示"),
            TimelineSegment(start_time=750.0, end_time=1000.0, title="搭配教学", description="不同场合穿搭教学"),
            TimelineSegment(start_time=1000.0, end_time=1300.0, title="鞋包配饰", description="鞋包配饰专场"),
        ],
        "subtitles": [
            Subtitle(id="sub-201", start_time=5.0, end_time=10.0, text="欢迎来到直播间，今天有很多新品"),
            Subtitle(id="sub-202", start_time=20.0, end_time=25.0, text="先给大家过一下今天的款式"),
            Subtitle(id="sub-203", start_time=160.0, end_time=165.0, text="第一款是这件小香风外套"),
            Subtitle(id="sub-204", start_time=180.0, end_time=185.0, text="面料是羊毛混纺的，非常有质感"),
            Subtitle(id="sub-205", start_time=200.0, end_time=205.0, text="做工非常精细，没有多余线头"),
            Subtitle(id="sub-206", start_time=250.0, end_time=255.0, text="这件是今年最流行的款式"),
            Subtitle(id="sub-207", start_time=280.0, end_time=285.0, text="穿上显瘦效果非常好"),
            Subtitle(id="sub-208", start_time=470.0, end_time=475.0, text="现在看这款碎花连衣裙"),
            Subtitle(id="sub-209", start_time=500.0, end_time=505.0, text="雪纺面料，非常飘逸"),
            Subtitle(id="sub-210", start_time=550.0, end_time=555.0, text="最好看的颜色已经断码了"),
            Subtitle(id="sub-211", start_time=770.0, end_time=775.0, text="上班通勤可以这样搭配"),
            Subtitle(id="sub-212", start_time=820.0, end_time=825.0, text="周末约会的话换这一套"),
            Subtitle(id="sub-213", start_time=1030.0, end_time=1035.0, text="这款包包和刚才的外套很配"),
            Subtitle(id="sub-214", start_time=1080.0, end_time=1085.0, text="真皮材质，手感很好"),
        ],
        "products": [
            Product(product_id="FASHION-001", name="小香风外套", link_time=155.0, unlink_time=320.0, category="外套"),
            Product(product_id="FASHION-002", name="英伦风大衣", link_time=300.0, unlink_time=430.0, category="外套"),
            Product(product_id="FASHION-003", name="碎花连衣裙", link_time=460.0, unlink_time=600.0, category="连衣裙"),
            Product(product_id="FASHION-004", name="针织连衣裙", link_time=580.0, unlink_time=720.0, category="连衣裙"),
            Product(product_id="FASHION-005", name="真皮手提包", link_time=1020.0, unlink_time=1150.0, category="包袋"),
            Product(product_id="FASHION-006", name="短靴", link_time=1100.0, unlink_time=1250.0, category="鞋履"),
        ],
        "violations": [
            Violation(id="VIO-201", start_time=250.0, end_time=260.0, level="warning", reason="使用极限词:最流行"),
            Violation(id="VIO-202", start_time=550.0, end_time=560.0, level="info", reason="使用饥饿营销话术:断码"),
        ],
    }
