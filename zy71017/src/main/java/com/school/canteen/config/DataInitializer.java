package com.school.canteen.config;

import com.school.canteen.controller.DataController;
import com.school.canteen.dto.ReplacementRequestDto;
import com.school.canteen.dto.ValidationResult;
import com.school.canteen.entity.Allergen;
import com.school.canteen.entity.Dish;
import com.school.canteen.entity.Student;
import com.school.canteen.service.DataImportService;
import com.school.canteen.service.ReplacementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final DataImportService dataImportService;
    private final ReplacementService replacementService;

    @Bean
    @Profile("!test")
    public CommandLineRunner initData() {
        return args -> {
            log.info("开始初始化样例数据...");
            initAllergens();
            initDishes();
            initStudents();
            initScenarios();
            log.info("样例数据初始化完成!");
        };
    }

    private void initAllergens() {
        List<Allergen> allergens = Arrays.asList(
            createAllergen("EGG", "鸡蛋", "鸡蛋及蛋制品"),
            createAllergen("MILK", "牛奶", "牛奶及奶制品"),
            createAllergen("WHEAT", "小麦", "小麦及面制品"),
            createAllergen("SOY", "大豆", "大豆及豆制品"),
            createAllergen("PEANUT", "花生", "花生及花生制品"),
            createAllergen("FISH", "鱼类", "各种鱼类"),
            createAllergen("SHELLFISH", "贝类", "虾、蟹等贝类"),
            createAllergen("NUT", "坚果", "杏仁、核桃等坚果")
        );
        allergens.forEach(dataImportService::importAllergen);
    }

    private void initDishes() {
        importDish("D001", "番茄炒蛋", "经典家常菜", Arrays.asList("EGG"));
        importDish("D002", "红烧肉", "五花肉烧制", Arrays.asList());
        importDish("D003", "清蒸鱼", "新鲜鲈鱼", Arrays.asList("FISH"));
        importDish("D004", "麻婆豆腐", "豆制品川菜", Arrays.asList("SOY"));
        importDish("D005", "宫保鸡丁", "经典川菜", Arrays.asList("PEANUT"));
        importDish("D006", "牛奶炖蛋", "甜品", Arrays.asList("EGG", "MILK"));
        importDish("D007", "炒时蔬", "时令蔬菜", Arrays.asList());
        importDish("D008", "炸酱面", "面食", Arrays.asList("WHEAT", "SOY"));
        importDish("D009", "白米饭", "主食", Arrays.asList());
        importDish("D010", "豆浆", "豆制品饮品", Arrays.asList("SOY"));
        importDish("D011", "西红柿炖牛腩", "牛肉炖菜", Arrays.asList());
        importDish("D012", "虾仁炒蛋", "海鲜菜品", Arrays.asList("EGG", "SHELLFISH"));
    }

    private void initStudents() {
        importStudent("S001", "小明", "三年级", "一班",
            "明爸爸", "13800138001", "ming@test.com",
            Arrays.asList("EGG", "MILK"));

        importStudent("S002", "小红", "三年级", "一班",
            "红妈妈", "13800138002", "hong@test.com",
            Arrays.asList("FISH"));

        importStudent("S003", "小刚", "三年级", "二班",
            "刚爸爸", "13800138003", "gang@test.com",
            Arrays.asList("SOY", "PEANUT"));

        importStudent("S004", "小美", "三年级", "二班",
            "美妈妈", "13800138004", "mei@test.com",
            Arrays.asList("WHEAT"));

        importStudent("S005", "小华", "四年级", "一班",
            "华爸爸", "13800138005", "hua@test.com",
            Arrays.asList());

        importStudent("S006", "小丽", "四年级", "一班",
            "丽妈妈", "13800138006", "li@test.com",
            Arrays.asList("NUT", "EGG"));

        importStudent("S007", "小强", "四年级", "二班",
            "强爸爸", "13800138007", "qiang@test.com",
            Arrays.asList("SHELLFISH"));

        importStudent("S008", "小芳", "四年级", "二班",
            "芳妈妈", "13800138008", "fang@test.com",
            Arrays.asList("MILK"));
    }

    private void initScenarios() {
        log.info("=== 初始化场景数据 ===");
        LocalDate testDate = LocalDate.now().plusDays(1);

        log.info("场景1: 正常流程 - 无过敏原冲突的替换");
        ReplacementRequestDto normalDto = new ReplacementRequestDto();
        normalDto.setMealDate(testDate);
        normalDto.setMealType("LUNCH");
        normalDto.setOriginalDishId(3L);
        normalDto.setReplacementDishId(11L);
        normalDto.setReason("食材缺货，临时替换");
        normalDto.setCreatedBy("admin");
        var normalReq = replacementService.createReplacement(normalDto);
        ValidationResult normalResult = replacementService.validateReplacement(normalReq.getId());
        replacementService.processValidation(normalReq.getId(), normalResult);
        log.info("场景1创建完成: 请求ID={}, 状态={}", normalReq.getId(), normalResult.isValid());

        log.info("场景2: 冲突流程 - 含有过敏原冲突的替换");
        ReplacementRequestDto conflictDto = new ReplacementRequestDto();
        conflictDto.setMealDate(testDate);
        conflictDto.setMealType("LUNCH");
        conflictDto.setOriginalDishId(2L);
        conflictDto.setReplacementDishId(6L);
        conflictDto.setReason("菜品调整");
        conflictDto.setCreatedBy("admin");
        var conflictReq = replacementService.createReplacement(conflictDto);
        ValidationResult conflictResult = replacementService.validateReplacement(conflictReq.getId());
        replacementService.processValidation(conflictReq.getId(), conflictResult);
        log.info("场景2创建完成: 请求ID={}, 冲突={}", conflictReq.getId(), conflictResult.isHasAllergenConflict());

        log.info("场景3: 待确认流程 - 已发起家长确认的替换");
        ReplacementRequestDto pendingDto = new ReplacementRequestDto();
        pendingDto.setMealDate(testDate.minusDays(1));
        pendingDto.setMealType("DINNER");
        pendingDto.setOriginalDishId(5L);
        pendingDto.setReplacementDishId(12L);
        pendingDto.setReason("供餐优化");
        pendingDto.setCreatedBy("admin");
        var pendingReq = replacementService.createReplacement(pendingDto);
        ValidationResult pendingResult = replacementService.validateReplacement(pendingReq.getId());
        replacementService.processValidation(pendingReq.getId(), pendingResult);
        replacementService.reviewReplacement(pendingReq.getId(), true, "同意替换", "supervisor");
        replacementService.startConfirmation(pendingReq.getId(), "admin");
        log.info("场景3创建完成: 请求ID={}", pendingReq.getId());

        log.info("场景4: 已撤销流程 - 演示撤销功能");
        ReplacementRequestDto revokedDto = new ReplacementRequestDto();
        revokedDto.setMealDate(testDate.minusDays(2));
        revokedDto.setMealType("BREAKFAST");
        revokedDto.setOriginalDishId(1L);
        revokedDto.setReplacementDishId(6L);
        revokedDto.setReason("临时调整");
        revokedDto.setCreatedBy("admin");
        var revokedReq = replacementService.createReplacement(revokedDto);
        ValidationResult revokedResult = replacementService.validateReplacement(revokedReq.getId());
        replacementService.processValidation(revokedReq.getId(), revokedResult);
        replacementService.revokeReplacement(revokedReq.getId(), "取消临时调整", "admin");
        log.info("场景4创建完成: 请求ID={}, 状态={}", revokedReq.getId(), "REVOKED");

        log.info("场景5: 人工修正流程 - 含有冲突但人工复核通过");
        ReplacementRequestDto manualDto = new ReplacementRequestDto();
        manualDto.setMealDate(testDate);
        manualDto.setMealType("DINNER");
        manualDto.setOriginalDishId(4L);
        manualDto.setReplacementDishId(10L);
        manualDto.setReason("营养调整");
        manualDto.setCreatedBy("admin");
        var manualReq = replacementService.createReplacement(manualDto);
        ValidationResult manualResult = replacementService.validateReplacement(manualReq.getId());
        replacementService.processValidation(manualReq.getId(), manualResult);
        log.info("场景5创建完成: 请求ID={}, 等待复核", manualReq.getId());
    }

    private Allergen createAllergen(String code, String name, String desc) {
        Allergen a = new Allergen();
        a.setCode(code);
        a.setName(name);
        a.setDescription(desc);
        return a;
    }

    private void importDish(String code, String name, String desc, List<String> allergenCodes) {
        Dish dish = new Dish();
        dish.setCode(code);
        dish.setName(name);
        dish.setDescription(desc);
        dish.setActive(true);
        dataImportService.importDish(dish, allergenCodes);
    }

    private void importStudent(String no, String name, String grade, String className,
                                String parentName, String parentPhone, String parentEmail,
                                List<String> allergenCodes) {
        Student student = new Student();
        student.setStudentNo(no);
        student.setName(name);
        student.setGrade(grade);
        student.setClassName(className);
        student.setParentName(parentName);
        student.setParentPhone(parentPhone);
        student.setParentEmail(parentEmail);
        student.setActive(true);
        dataImportService.importStudent(student, allergenCodes);
    }
}
