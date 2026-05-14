package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.CalculationRequest;
import com.feiyong.feecalc.enums.CalculationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CalculationRequestRepository extends JpaRepository<CalculationRequest, Long> {

    Optional<CalculationRequest> findByRequestNo(String requestNo);

    Optional<CalculationRequest> findByBizTypeAndBizNo(String bizType, String bizNo);

    List<CalculationRequest> findByUserIdOrderByCreatedAtDesc(String userId);

    List<CalculationRequest> findByStatus(CalculationStatus status);

    @Query("SELECT c FROM CalculationRequest c WHERE c.status = :status AND c.expiredAt < :now")
    List<CalculationRequest> findExpiredRequests(@Param("status") CalculationStatus status, @Param("now") LocalDateTime now);

    boolean existsByBizTypeAndBizNo(String bizType, String bizNo);

    List<CalculationRequest> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime start, LocalDateTime end);
}
