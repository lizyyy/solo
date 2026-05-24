package com.school.canteen.service;

import com.school.canteen.entity.Allergen;
import com.school.canteen.entity.Dish;
import com.school.canteen.entity.Student;
import com.school.canteen.repository.AllergenRepository;
import com.school.canteen.repository.DishRepository;
import com.school.canteen.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataImportService {

    private final AllergenRepository allergenRepository;
    private final DishRepository dishRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public Allergen importAllergen(Allergen allergen) {
        if (allergenRepository.existsByCode(allergen.getCode())) {
            Allergen existing = allergenRepository.findByCode(allergen.getCode()).get();
            existing.setName(allergen.getName());
            existing.setDescription(allergen.getDescription());
            return allergenRepository.save(existing);
        }
        return allergenRepository.save(allergen);
    }

    @Transactional
    public Dish importDish(Dish dish, List<String> allergenCodes) {
        Set<Allergen> allergens = new HashSet<>();
        for (String code : allergenCodes) {
            allergenRepository.findByCode(code).ifPresent(allergens::add);
        }

        if (dishRepository.existsByCode(dish.getCode())) {
            Dish existing = dishRepository.findByCode(dish.getCode()).get();
            existing.setName(dish.getName());
            existing.setDescription(dish.getDescription());
            existing.setAllergens(allergens);
            existing.setActive(dish.getActive());
            return dishRepository.save(existing);
        }

        dish.setAllergens(allergens);
        return dishRepository.save(dish);
    }

    @Transactional
    public Student importStudent(Student student, List<String> allergenCodes) {
        Set<Allergen> allergens = new HashSet<>();
        for (String code : allergenCodes) {
            allergenRepository.findByCode(code).ifPresent(allergens::add);
        }

        if (studentRepository.existsByStudentNo(student.getStudentNo())) {
            Student existing = studentRepository.findByStudentNo(student.getStudentNo()).get();
            existing.setName(student.getName());
            existing.setGrade(student.getGrade());
            existing.setClassName(student.getClassName());
            existing.setParentName(student.getParentName());
            existing.setParentPhone(student.getParentPhone());
            existing.setParentEmail(student.getParentEmail());
            existing.setAllergens(allergens);
            existing.setActive(student.getActive());
            return studentRepository.save(existing);
        }

        student.setAllergens(allergens);
        return studentRepository.save(student);
    }

    @Transactional(readOnly = true)
    public List<Allergen> getAllAllergens() {
        return allergenRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Dish> getAllDishes() {
        return dishRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Student> getAllStudents() {
        return studentRepository.findAll();
    }
}
