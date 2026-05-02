import pytest
from datetime import date
from app.rules_engine import AllergenRulesEngine, BatchRulesEngine, SubstitutionRulesEngine
from app.models import Child, MenuItem, Ingredient, SubstitutionRequest, BatchStatus, SubstitutionStatus


class TestAllergenRulesEngine:
    def test_parse_allergens_empty(self):
        assert AllergenRulesEngine.parse_allergens(None) == []
        assert AllergenRulesEngine.parse_allergens("") == []
    
    def test_parse_allergens_comma(self):
        result = AllergenRulesEngine.parse_allergens("坚果、牛奶,鸡蛋;乳制品")
        assert len(result) == 4
        assert "坚果" in result
        assert "牛奶" in result
        assert "鸡蛋" in result
        assert "乳制品" in result
    
    def test_match_allergens_nut(self):
        child_allergens = ["坚果", "花生"]
        dish_allergens = ["坚果类", "花生"]
        
        matched = AllergenRulesEngine.match_allergens(child_allergens, dish_allergens)
        
        assert "坚果类" in matched
        assert "花生" in matched
    
    def test_match_allergens_dairy(self):
        child_allergens = ["乳制品", "牛奶"]
        dish_allergens = ["牛奶", "奶酪"]
        
        matched = AllergenRulesEngine.match_allergens(child_allergens, dish_allergens)
        
        assert "乳制品" in matched
    
    def test_check_forbidden_foods(self):
        child_forbidden = ["芒果", "菠萝"]
        dish_ingredients = ["芒果", "苹果", "香蕉"]
        
        matched = AllergenRulesEngine.check_forbidden_foods(child_forbidden, dish_ingredients)
        
        assert "芒果" in matched
    
    def test_check_compatibility_conflict(self):
        child = Child(
            id=1,
            name="测试儿童",
            student_id="TEST001",
            class_name="测试班",
            allergens="坚果、乳制品",
            forbidden_foods=None,
            is_active=True
        )
        
        menu_item = MenuItem(
            id=1,
            menu_date=date(2026, 5, 2),
            meal_type="午餐",
            dish_name="坚果牛奶粥",
            ingredients="大米、坚果、牛奶",
            allergens="坚果类、乳制品"
        )
        
        result = AllergenRulesEngine.check_child_dish_compatibility(child, menu_item)
        
        assert result["has_conflict"] == True
        assert result["has_allergen_conflict"] == True
        assert result["risk_level"] == "高风险"
        assert "坚果类" in result["matched_allergens"]
        assert "乳制品" in result["matched_allergens"]
    
    def test_check_compatibility_safe(self):
        child = Child(
            id=1,
            name="测试儿童",
            student_id="TEST001",
            class_name="测试班",
            allergens="坚果",
            forbidden_foods=None,
            is_active=True
        )
        
        menu_item = MenuItem(
            id=1,
            menu_date=date(2026, 5, 2),
            meal_type="午餐",
            dish_name="清炒西兰花",
            ingredients="西兰花、大蒜",
            allergens=None
        )
        
        result = AllergenRulesEngine.check_child_dish_compatibility(child, menu_item)
        
        assert result["has_conflict"] == False
        assert result["risk_level"] == "低风险"
        assert result["recommendation"] == "可正常分餐"


class TestBatchRulesEngine:
    def test_check_batch_recall_active(self):
        ingredient = Ingredient(
            id=1,
            name="牛奶",
            batch_number="BATCH001",
            status=BatchStatus.ACTIVE
        )
        
        assert BatchRulesEngine.check_batch_recall(ingredient) == False
    
    def test_check_batch_recall_recalled(self):
        ingredient = Ingredient(
            id=1,
            name="牛奶",
            batch_number="BATCH001",
            status=BatchStatus.RECALLED,
            recall_reason="质量问题"
        )
        
        assert BatchRulesEngine.check_batch_recall(ingredient) == True
    
    def test_check_batch_expired_not_expired(self):
        ingredient = Ingredient(
            id=1,
            name="牛奶",
            batch_number="BATCH001",
            expiry_date=date(2026, 12, 31)
        )
        
        check_date = date(2026, 5, 2)
        assert BatchRulesEngine.check_batch_expired(ingredient, check_date) == False
    
    def test_check_batch_expired_is_expired(self):
        ingredient = Ingredient(
            id=1,
            name="牛奶",
            batch_number="BATCH001",
            expiry_date=date(2026, 4, 30)
        )
        
        check_date = date(2026, 5, 2)
        assert BatchRulesEngine.check_batch_expired(ingredient, check_date) == True


class TestSubstitutionRulesEngine:
    def test_can_approve_pending(self):
        request = SubstitutionRequest(
            id=1,
            status=SubstitutionStatus.PENDING,
            substitution_dish="白米粥"
        )
        
        can_approve, message = SubstitutionRulesEngine.can_approve_substitution(request)
        
        assert can_approve == True
    
    def test_can_approve_already_approved(self):
        request = SubstitutionRequest(
            id=1,
            status=SubstitutionStatus.APPROVED,
            substitution_dish="白米粥"
        )
        
        can_approve, message = SubstitutionRulesEngine.can_approve_substitution(request)
        
        assert can_approve == False
        assert "待审批" in message
    
    def test_can_approve_no_substitution_dish(self):
        request = SubstitutionRequest(
            id=1,
            status=SubstitutionStatus.PENDING,
            substitution_dish=None
        )
        
        can_approve, message = SubstitutionRulesEngine.can_approve_substitution(request)
        
        assert can_approve == False
        assert "替餐菜品不能为空" in message
    
    def test_valid_transitions_pending(self):
        transitions = SubstitutionRulesEngine.get_valid_status_transitions(SubstitutionStatus.PENDING)
        
        assert SubstitutionStatus.APPROVED in transitions
        assert SubstitutionStatus.REJECTED in transitions
        assert SubstitutionStatus.IMPLEMENTED not in transitions
    
    def test_valid_transitions_approved(self):
        transitions = SubstitutionRulesEngine.get_valid_status_transitions(SubstitutionStatus.APPROVED)
        
        assert SubstitutionStatus.IMPLEMENTED in transitions
        assert SubstitutionStatus.REJECTED in transitions
    
    def test_valid_transitions_implemented(self):
        transitions = SubstitutionRulesEngine.get_valid_status_transitions(SubstitutionStatus.IMPLEMENTED)
        
        assert len(transitions) == 0
