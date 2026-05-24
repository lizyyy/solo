package com.school.canteen.controller;

import com.school.canteen.entity.Allergen;
import com.school.canteen.entity.Dish;
import com.school.canteen.entity.Student;
import com.school.canteen.service.DataImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/data")
public class DataController {

    private static final Logger log = LoggerFactory.getLogger(DataController.class);

    private final DataImportService dataImportService;

    @Autowired
    public DataController(DataImportService dataImportService) {
        this.dataImportService = dataImportService;
    }

    @PostMapping("/allergens")
    public ResponseEntity<Allergen> importAllergen(@RequestBody Allergen allergen) {
        log.info("导入过敏原: {}", allergen.getCode());
        return ResponseEntity.ok(dataImportService.importAllergen(allergen));
    }

    @PostMapping("/dishes")
    public ResponseEntity<Dish> importDish(@RequestBody Map<String, Object> request) {
        String code = (String) request.get("code");
        String name = (String) request.get("name");
        String description = (String) request.getOrDefault("description", "");
        @SuppressWarnings("unchecked")
        List<String> allergenCodes = (List<String>) request.getOrDefault("allergenCodes", List.of());

        Dish dish = new Dish();
        dish.setCode(code);
        dish.setName(name);
        dish.setDescription(description);
        dish.setActive(true);

        log.info("导入菜品: {}", code);
        return ResponseEntity.ok(dataImportService.importDish(dish, allergenCodes));
    }

    @PostMapping("/students")
    public ResponseEntity<Student> importStudent(@RequestBody Map<String, Object> request) {
        String studentNo = (String) request.get("studentNo");
        String name = (String) request.get("name");
        String grade = (String) request.getOrDefault("grade", "");
        String className = (String) request.getOrDefault("className", "");
        String parentName = (String) request.getOrDefault("parentName", "");
        String parentPhone = (String) request.getOrDefault("parentPhone", "");
        String parentEmail = (String) request.getOrDefault("parentEmail", "");
        @SuppressWarnings("unchecked")
        List<String> allergenCodes = (List<String>) request.getOrDefault("allergenCodes", List.of());

        Student student = new Student();
        student.setStudentNo(studentNo);
        student.setName(name);
        student.setGrade(grade);
        student.setClassName(className);
        student.setParentName(parentName);
        student.setParentPhone(parentPhone);
        student.setParentEmail(parentEmail);
        student.setActive(true);

        log.info("导入学生: {}", studentNo);
        return ResponseEntity.ok(dataImportService.importStudent(student, allergenCodes));
    }

    @GetMapping("/allergens")
    public ResponseEntity<List<Allergen>> getAllergens() {
        return ResponseEntity.ok(dataImportService.getAllAllergens());
    }

    @GetMapping("/dishes")
    public ResponseEntity<List<Dish>> getDishes() {
        return ResponseEntity.ok(dataImportService.getAllDishes());
    }

    @GetMapping("/students")
    public ResponseEntity<List<Student>> getStudents() {
        return ResponseEntity.ok(dataImportService.getAllStudents());
    }
}
