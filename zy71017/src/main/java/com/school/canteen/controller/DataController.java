package com.school.canteen.controller;

import com.school.canteen.dto.ApiResponse;
import com.school.canteen.entity.Allergen;
import com.school.canteen.entity.Dish;
import com.school.canteen.entity.Student;
import com.school.canteen.service.DataImportService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/data")
@RequiredArgsConstructor
public class DataController {

    private final DataImportService dataImportService;

    @PostMapping("/allergens")
    public ApiResponse<Allergen> importAllergen(@RequestBody Allergen allergen) {
        return ApiResponse.success(dataImportService.importAllergen(allergen));
    }

    @GetMapping("/allergens")
    public ApiResponse<List<Allergen>> getAllAllergens() {
        return ApiResponse.success(dataImportService.getAllAllergens());
    }

    @PostMapping("/dishes")
    public ApiResponse<Dish> importDish(@RequestBody DishImportDto dto) {
        Dish dish = new Dish();
        dish.setCode(dto.getCode());
        dish.setName(dto.getName());
        dish.setDescription(dto.getDescription());
        dish.setActive(dto.getActive() != null ? dto.getActive() : true);
        return ApiResponse.success(dataImportService.importDish(dish, dto.getAllergenCodes()));
    }

    @GetMapping("/dishes")
    public ApiResponse<List<Dish>> getAllDishes() {
        return ApiResponse.success(dataImportService.getAllDishes());
    }

    @PostMapping("/students")
    public ApiResponse<Student> importStudent(@RequestBody StudentImportDto dto) {
        Student student = new Student();
        student.setStudentNo(dto.getStudentNo());
        student.setName(dto.getName());
        student.setGrade(dto.getGrade());
        student.setClassName(dto.getClassName());
        student.setParentName(dto.getParentName());
        student.setParentPhone(dto.getParentPhone());
        student.setParentEmail(dto.getParentEmail());
        student.setActive(dto.getActive() != null ? dto.getActive() : true);
        return ApiResponse.success(dataImportService.importStudent(student, dto.getAllergenCodes()));
    }

    @GetMapping("/students")
    public ApiResponse<List<Student>> getAllStudents() {
        return ApiResponse.success(dataImportService.getAllStudents());
    }

    @Data
    public static class DishImportDto {
        private String code;
        private String name;
        private String description;
        private Boolean active;
        private List<String> allergenCodes;
    }

    @Data
    public static class StudentImportDto {
        private String studentNo;
        private String name;
        private String grade;
        private String className;
        private String parentName;
        private String parentPhone;
        private String parentEmail;
        private Boolean active;
        private List<String> allergenCodes;
    }
}
