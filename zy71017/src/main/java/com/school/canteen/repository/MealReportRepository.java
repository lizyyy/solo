package com.school.canteen.repository;

import com.school.canteen.entity.MealReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MealReportRepository extends JpaRepository<MealReport, Long> {
    Optional<MealReport> findByReportNo(String reportNo);

    Optional<MealReport> findByMealDateAndMealType(LocalDate mealDate, String mealType);

    List<MealReport> findByMealDate(LocalDate mealDate);

    @Query("SELECT mr FROM MealReport mr WHERE mr.mealDate BETWEEN :startDate AND :endDate")
    List<MealReport> findByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    boolean existsByMealDateAndMealTypeAndFinalizedTrue(LocalDate mealDate, String mealType);
}
