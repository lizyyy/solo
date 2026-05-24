package com.school.canteen;

import com.school.canteen.dto.ReplacementRequestDto;
import com.school.canteen.dto.ValidationResult;
import com.school.canteen.entity.*;
import com.school.canteen.repository.*;
import com.school.canteen.service.ReplacementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CanteenAllergenApplicationTests {

    @Autowired
    private ReplacementService replacementService;

    @Autowired
    private DishRepository dishRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private AllergenRepository allergenRepository;

    @Autowired
    private ReplacementRequestRepository replacementRepository;

    @Autowired
    private ParentConfirmationRepository confirmationRepository;

    private Dish dishNoAllergen;
    private Dish dishWithEgg;
    private Dish dishWithMilk;
    private Dish dishWithEggAndMilk;
    private Student studentWithEggAllergy;
    private Student studentWithMilkAllergy;
    private Student studentNoAllergy;

    @BeforeEach
    void setUp() {
        Allergen egg = new Allergen();
        egg.setCode("TEST_EGG");
        egg.setName("鸡蛋");
        egg = allergenRepository.save(egg);

        Allergen milk = new Allergen();
        milk.setCode("TEST_MILK");
        milk.setName("牛奶");
        milk = allergenRepository.save(milk);

        dishNoAllergen = createDish("TEST_D001", "红烧肉", new HashSet<>());
        dishWithEgg = createDish("TEST_D002", "番茄炒蛋", new HashSet<>(Collections.singletonList(egg)));
        dishWithMilk = createDish("TEST_D003", "奶油蘑菇汤", new HashSet<>(Collections.singletonList(milk)));
        dishWithEggAndMilk = createDish("TEST_D004", "牛奶炖蛋", new HashSet<>(Arrays.asList(egg, milk)));

        studentWithEggAllergy = createStudent("TEST_S001", "小明", new HashSet<>(Collections.singletonList(egg)));
        studentWithMilkAllergy = createStudent("TEST_S002", "小红", new HashSet<>(Collections.singletonList(milk)));
        studentNoAllergy = createStudent("TEST_S003", "小华", new HashSet<>());
    }

    @Test
    void testNormalReplacement_NoAllergenConflict() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishWithEgg.getId());
        dto.setReplacementDishId(dishNoAllergen.getId());
        dto.setReason("测试正常替换");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);
        assertNotNull(request);
        assertEquals(ReplacementStatus.DRAFT, request.getStatus());

        ValidationResult result = replacementService.validateReplacement(request.getId());
        assertTrue(result.isValid());
        assertFalse(result.isHasAllergenConflict());

        replacementService.processValidation(request.getId(), result);

        ReplacementRequest updated = replacementService.getReplacement(request.getId());
        assertEquals(ReplacementStatus.VALIDATED, updated.getStatus());
    }

    @Test
    void testReplacementWithAllergenConflict() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishNoAllergen.getId());
        dto.setReplacementDishId(dishWithEggAndMilk.getId());
        dto.setReason("测试过敏原冲突");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);

        ValidationResult result = replacementService.validateReplacement(request.getId());
        assertTrue(result.isHasAllergenConflict());
        assertNotNull(result.getConflictDetail());
        assertTrue(result.getConflictDetail().getAffectedCount() >= 2);

        replacementService.processValidation(request.getId(), result);

        ReplacementRequest updated = replacementService.getReplacement(request.getId());
        assertEquals(ReplacementStatus.CONFLICT_DETECTED, updated.getStatus());
        assertFalse(updated.getAffectedStudents().isEmpty());
    }

    @Test
    void testReplacementWithSameAllergen() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishWithEgg.getId());
        dto.setReplacementDishId(dishWithEggAndMilk.getId());
        dto.setReason("测试含相同过敏原");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);

        ValidationResult result = replacementService.validateReplacement(request.getId());
        assertTrue(result.isHasAllergenConflict());
        assertTrue(result.getWarnings().stream().anyMatch(w -> w.contains("相同过敏原")));
    }

    @Test
    void testRevokeReplacement() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishNoAllergen.getId());
        dto.setReplacementDishId(dishWithEgg.getId());
        dto.setReason("测试撤销");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);
        ValidationResult result = replacementService.validateReplacement(request.getId());
        replacementService.processValidation(request.getId(), result);

        ReplacementRequest revoked = replacementService.revokeReplacement(
            request.getId(), "测试撤销原因", "tester");

        assertEquals(ReplacementStatus.REVOKED, revoked.getStatus());
        assertNotNull(revoked.getRevokedAt());
        assertTrue(revoked.getReason().contains("测试撤销原因"));
    }

    @Test
    void testManualReviewAndConfirmation() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishNoAllergen.getId());
        dto.setReplacementDishId(dishWithEgg.getId());
        dto.setReason("测试人工复核");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);
        ValidationResult result = replacementService.validateReplacement(request.getId());
        replacementService.processValidation(request.getId(), result);

        assertEquals(ReplacementStatus.CONFLICT_DETECTED,
            replacementService.getReplacement(request.getId()).getStatus());

        ReplacementRequest reviewed = replacementService.reviewReplacement(
            request.getId(), true, "家长已同意特殊安排", "supervisor");
        assertEquals(ReplacementStatus.VALIDATED, reviewed.getStatus());
        assertNotNull(reviewed.getReviewedBy());

        ReplacementRequest started = replacementService.startConfirmation(request.getId(), "admin");
        assertEquals(ReplacementStatus.PENDING_CONFIRMATION, started.getStatus());

        List<ParentConfirmation> confirmations = replacementService.getConfirmations(request.getId());
        assertFalse(confirmations.isEmpty());

        Long firstStudentId = confirmations.get(0).getStudent().getId();
        ParentConfirmation confirmed = replacementService.submitConfirmation(
            request.getId(), firstStudentId, "CONFIRMED", "家长同意", "parent_user");
        assertEquals("CONFIRMED", confirmed.getConfirmationStatus());
        assertNotNull(confirmed.getConfirmedAt());
    }

    @Test
    void testDuplicateConfirmationPrevention() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishNoAllergen.getId());
        dto.setReplacementDishId(dishWithEgg.getId());
        dto.setReason("测试回执去重");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);
        ValidationResult result = replacementService.validateReplacement(request.getId());
        replacementService.processValidation(request.getId(), result);
        replacementService.reviewReplacement(request.getId(), true, "同意", "sv");
        replacementService.startConfirmation(request.getId(), "admin");

        List<ParentConfirmation> confirmations = replacementService.getConfirmations(request.getId());
        Long firstStudentId = confirmations.get(0).getStudent().getId();

        replacementService.submitConfirmation(
            request.getId(), firstStudentId, "CONFIRMED", "同意", "parent");

        assertThrows(Exception.class, () -> {
            replacementService.submitConfirmation(
                request.getId(), firstStudentId, "REJECTED", "重复提交", "parent");
        });
    }

    @Test
    void testDuplicateReplacementDetection() {
        LocalDate mealDate = LocalDate.now().plusDays(1);
        String mealType = "LUNCH";

        ReplacementRequestDto dto1 = new ReplacementRequestDto();
        dto1.setMealDate(mealDate);
        dto1.setMealType(mealType);
        dto1.setOriginalDishId(dishNoAllergen.getId());
        dto1.setReplacementDishId(dishWithEgg.getId());
        dto1.setReason("第一个替换");
        dto1.setCreatedBy("test");

        ReplacementRequest request1 = replacementService.createReplacement(dto1);
        ValidationResult result1 = replacementService.validateReplacement(request1.getId());
        replacementService.processValidation(request1.getId(), result1);

        ReplacementRequestDto dto2 = new ReplacementRequestDto();
        dto2.setMealDate(mealDate);
        dto2.setMealType(mealType);
        dto2.setOriginalDishId(dishNoAllergen.getId());
        dto2.setReplacementDishId(dishWithMilk.getId());
        dto2.setReason("重复替换测试");
        dto2.setCreatedBy("test");

        ReplacementRequest request2 = replacementService.createReplacement(dto2);
        ValidationResult result2 = replacementService.validateReplacement(request2.getId());

        assertTrue(result2.isHasDuplicateReplacement());
        assertFalse(result2.isValid());
    }

    @Test
    void testLockAndComplete() {
        ReplacementRequestDto dto = new ReplacementRequestDto();
        dto.setMealDate(LocalDate.now().plusDays(1));
        dto.setMealType("LUNCH");
        dto.setOriginalDishId(dishWithEgg.getId());
        dto.setReplacementDishId(dishNoAllergen.getId());
        dto.setReason("测试锁定");
        dto.setCreatedBy("test");

        ReplacementRequest request = replacementService.createReplacement(dto);
        ValidationResult result = replacementService.validateReplacement(request.getId());
        replacementService.processValidation(request.getId(), result);

        ReplacementRequest started = replacementService.startConfirmation(request.getId(), "admin");
        assertEquals(ReplacementStatus.PENDING_CONFIRMATION, started.getStatus());

        ReplacementRequest completed = replacementService.completeReplacement(request.getId(), "admin");
        assertEquals(ReplacementStatus.COMPLETED, completed.getStatus());

        ReplacementRequest locked = replacementService.lockReplacement(request.getId(), "supervisor");
        assertTrue(locked.getLocked());
        assertEquals(ReplacementStatus.LOCKED, locked.getStatus());

        assertThrows(Exception.class, () -> {
            replacementService.revokeReplacement(request.getId(), "尝试撤销锁定的请求", "tester");
        });
    }

    private Dish createDish(String code, String name, Set<Allergen> allergens) {
        Dish dish = new Dish();
        dish.setCode(code);
        dish.setName(name);
        dish.setAllergens(allergens);
        dish.setActive(true);
        return dishRepository.save(dish);
    }

    private Student createStudent(String no, String name, Set<Allergen> allergens) {
        Student student = new Student();
        student.setStudentNo(no);
        student.setName(name);
        student.setGrade("测试年级");
        student.setClassName("测试班");
        student.setParentName("家长" + name);
        student.setParentPhone("13800000000");
        student.setParentEmail("test@test.com");
        student.setAllergens(allergens);
        student.setActive(true);
        return studentRepository.save(student);
    }
}
