package com.school.canteen.repository;

import com.school.canteen.entity.ReplacementRequest;
import com.school.canteen.entity.ReplacementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReplacementRequestRepository extends JpaRepository<ReplacementRequest, Long> {
    Optional<ReplacementRequest> findByRequestNo(String requestNo);

    @Query("SELECT r FROM ReplacementRequest r WHERE r.mealDate = :mealDate AND r.mealType = :mealType AND r.locked = true")
    List<ReplacementRequest> findLockedReplacements(@Param("mealDate") LocalDate mealDate, @Param("mealType") String mealType);

    @Query("SELECT r FROM ReplacementRequest r WHERE r.mealDate = :mealDate AND r.mealType = :mealType AND r.status NOT IN ('REVOKED', 'REJECTED')")
    List<ReplacementRequest> findActiveReplacements(@Param("mealDate") LocalDate mealDate, @Param("mealType") String mealType);

    List<ReplacementRequest> findByMealDateAndMealType(LocalDate mealDate, String mealType);

    List<ReplacementRequest> findByStatus(ReplacementStatus status);

    boolean existsByMealDateAndMealTypeAndOriginalDishIdAndStatusNotIn(
        LocalDate mealDate,
        String mealType,
        Long originalDishId,
        List<ReplacementStatus> excludedStatuses
    );

    @Query("SELECT COUNT(r) FROM ReplacementRequest r WHERE r.mealDate = :mealDate AND r.mealType = :mealType AND r.status = 'COMPLETED'")
    long countCompletedByMeal(@Param("mealDate") LocalDate mealDate, @Param("mealType") String mealType);
}
