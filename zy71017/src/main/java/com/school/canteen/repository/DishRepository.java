package com.school.canteen.repository;

import com.school.canteen.entity.Dish;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DishRepository extends JpaRepository<Dish, Long> {
    Optional<Dish> findByCode(String code);
    boolean existsByCode(String code);
    List<Dish> findByActiveTrue();

    @Query("SELECT d FROM Dish d JOIN d.allergens a WHERE a.id = :allergenId")
    List<Dish> findByAllergenId(@Param("allergenId") Long allergenId);
}
