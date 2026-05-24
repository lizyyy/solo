package com.airport.baggage.repository;

import com.airport.baggage.common.enums.CompensationStatus;
import com.airport.baggage.entity.CompensationOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CompensationOrderRepository extends JpaRepository<CompensationOrder, Long>, JpaSpecificationExecutor<CompensationOrder> {
    Optional<CompensationOrder> findByOrderNo(String orderNo);

    @Query("SELECT c FROM CompensationOrder c WHERE c.passenger.passengerId = :passengerId " +
           "AND c.status NOT IN ('REJECTED', 'CLOSED') AND c.createdAt >= :startTime")
    List<CompensationOrder> findActiveOrdersByPassenger(
            @Param("passengerId") String passengerId,
            @Param("startTime") LocalDateTime startTime);

    @Query("SELECT c FROM CompensationOrder c WHERE c.passenger.passengerId = :passengerId " +
           "AND c.createdAt >= :startTime")
    List<CompensationOrder> findOrdersByPassengerAndTime(
            @Param("passengerId") String passengerId,
            @Param("startTime") LocalDateTime startTime);

    List<CompensationOrder> findByStatusIn(List<CompensationStatus> statuses);

    List<CompensationOrder> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT c FROM CompensationOrder c WHERE c.status = :status " +
           "AND c.baggageArrived = false")
    List<CompensationOrder> findPendingArrivalOrders(@Param("status") CompensationStatus status);

    boolean existsByBaggageIdAndStatusNotIn(Long baggageId, List<CompensationStatus> statuses);
}
