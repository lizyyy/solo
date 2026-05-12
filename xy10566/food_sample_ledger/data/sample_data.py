from ..models import (
    Dish,
    Batch,
    FridgeLocation,
    SampleBox,
    FoodSample,
    DailyMenu,
)
from ..utils.storage import Storage
from ..utils.validators import BusinessRules
from datetime import datetime, timedelta


def create_sample_dishes() -> list:
    return [
        Dish(
            name="皮蛋瘦肉粥",
            category="粥类",
            meal_type="早餐",
            supplier="粮油配送中心",
            responsible_person="李师傅",
        ),
        Dish(
            name="小笼包",
            category="面点",
            meal_type="早餐",
            supplier="面点供应商A",
            responsible_person="王师傅",
        ),
        Dish(
            name="茶叶蛋",
            category="蛋类",
            meal_type="早餐",
            supplier="禽蛋公司",
            responsible_person="李师傅",
        ),
        Dish(
            name="西红柿炒鸡蛋",
            category="热菜",
            meal_type="午餐",
            supplier="蔬菜配送中心",
            responsible_person="张大厨",
        ),
        Dish(
            name="糖醋里脊",
            category="热菜",
            meal_type="午餐",
            supplier="肉类供应商B",
            responsible_person="张大厨",
        ),
        Dish(
            name="紫菜蛋花汤",
            category="汤类",
            meal_type="午餐",
            supplier="干货商行",
            responsible_person="张大厨",
        ),
        Dish(
            name="清炒时蔬",
            category="热菜",
            meal_type="晚餐",
            supplier="有机蔬菜基地",
            responsible_person="陈师傅",
        ),
        Dish(
            name="红烧排骨",
            category="热菜",
            meal_type="晚餐",
            supplier="肉类供应商C",
            responsible_person="陈师傅",
        ),
        Dish(
            name="玉米排骨汤",
            category="汤类",
            meal_type="晚餐",
            supplier="综合供应商",
            responsible_person="陈师傅",
        ),
    ]


def create_sample_batches(dishes: list) -> list:
    batches = []
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    day_before = today - timedelta(days=2)

    for i, dish in enumerate(dishes):
        prod_date = yesterday if i < 3 else (day_before if i < 6 else yesterday)
        exp_date = prod_date + timedelta(days=7)
        batches.append(
            Batch(
                batch_number=f"BATCH-{dish.meal_type[0]}{i+1:02d}-{today.strftime('%Y%m%d')}",
                dish_id=dish.id,
                dish_name=dish.name,
                ingredient_name=f"{dish.name}原料",
                production_date=prod_date.strftime("%Y-%m-%d"),
                expiration_date=exp_date.strftime("%Y-%m-%d"),
                quantity=50.0,
                unit="kg",
                supplier=dish.supplier,
            )
        )
    return batches


def create_sample_fridge_locations() -> list:
    fridges = []
    fridge_names = ["留样冰箱A", "留样冰箱B"]
    compartments = ["冷藏区A", "冷藏区B"]
    shelves = ["上层", "中层", "下层"]
    positions = ["左", "中", "右"]

    for fridge_name in fridge_names:
        for compartment in compartments:
            for shelf in shelves:
                for position in positions:
                    fridges.append(
                        FridgeLocation(
                            fridge_id=fridge_name.replace(" ", "-"),
                            fridge_name=fridge_name,
                            compartment=compartment,
                            shelf=shelf,
                            position=position,
                            is_occupied=False,
                        )
                    )
    return fridges


def create_sample_boxes() -> list:
    boxes = []
    for i in range(1, 20):
        boxes.append(
            SampleBox(
                box_code=f"BOX-{i:03d}",
                capacity=500.0,
                is_available=True,
            )
        )
    return boxes


def create_daily_menus(dishes: list) -> list:
    today = datetime.now().strftime("%Y-%m-%d")
    breakfast_dishes = [d.id for d in dishes if d.meal_type == "早餐"]
    lunch_dishes = [d.id for d in dishes if d.meal_type == "午餐"]
    dinner_dishes = [d.id for d in dishes if d.meal_type == "晚餐"]

    return [
        DailyMenu(
            date=today,
            meal_type="早餐",
            dish_ids=breakfast_dishes,
        ),
        DailyMenu(
            date=today,
            meal_type="午餐",
            dish_ids=lunch_dishes,
        ),
        DailyMenu(
            date=today,
            meal_type="晚餐",
            dish_ids=dinner_dishes,
        ),
    ]


def populate_sample_data(storage: Storage, include_overdue_sample: bool = False) -> dict:
    dishes = create_sample_dishes()
    for dish in dishes:
        storage.save(dish)

    batches = create_sample_batches(dishes)
    for batch in batches:
        storage.save(batch)

    fridge_locations = create_sample_fridge_locations()
    for location in fridge_locations:
        storage.save(location)

    sample_boxes = create_sample_boxes()
    for box in sample_boxes:
        storage.save(box)

    menus = create_daily_menus(dishes)
    for menu in menus:
        storage.save(menu)

    created_samples = []
    now = datetime.now()

    for i, (dish, batch, box, location) in enumerate(
        zip(dishes[:5], batches[:5], sample_boxes[:5], fridge_locations[:5])
    ):
        if include_overdue_sample and i == 0:
            sampling_time = (now - timedelta(days=3)).isoformat()
        else:
            sampling_time = (now - timedelta(hours=i * 4)).isoformat()

        scheduled_destruction = BusinessRules.calculate_scheduled_destruction_time(
            sampling_time, 48
        )

        sample = FoodSample(
            dish_id=dish.id,
            dish_name=dish.name,
            batch_id=batch.id,
            batch_number=batch.batch_number,
            sample_weight=250.0 if i != 1 else 150.0,
            sample_box_code=box.box_code,
            fridge_location_id=location.id,
            fridge_full_location=f"{location.fridge_name}/{location.compartment}/{location.shelf}/{location.position}",
            sampling_time=sampling_time,
            sampler=dish.responsible_person,
            retention_period_hours=48,
            scheduled_destruction_time=scheduled_destruction,
            is_destroyed=False,
            status="active",
        )

        storage.save(sample)

        box.is_available = False
        box.current_sample_id = sample.id
        storage.save(box)

        location.is_occupied = True
        location.current_sample_id = sample.id
        storage.save(location)

        created_samples.append(sample)

    return {
        "dishes": dishes,
        "batches": batches,
        "fridge_locations": fridge_locations,
        "sample_boxes": sample_boxes,
        "menus": menus,
        "samples": created_samples,
    }
