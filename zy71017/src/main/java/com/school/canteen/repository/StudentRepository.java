package com.school.canteen.repository;

import com.school.canteen.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {
    Optional<Student> findByStudentNo(String studentNo);
    boolean existsByStudentNo(String studentNo);
    List<Student> findByActiveTrue();

    @Query("SELECT s FROM Student s JOIN s.allergens a WHERE a.id IN :allergenIds")
    Set<Student> findByAllergenIds(@Param("allergenIds") List<Long> allergenIds);

    @Query("SELECT COUNT(s) FROM Student s WHERE s.active = true")
    long countActiveStudents();
}
