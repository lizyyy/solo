package com.warehouse.charging.repository;

import com.warehouse.charging.enums.ReservationStatus;
import com.warehouse.charging.model.ChargingReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChargingReservationRepository extends JpaRepository<ChargingReservation, Long> {
    Optional<ChargingReservation> findByRequestId(String requestId);
    boolean existsByRequestId(String requestId);

    @Query("SELECT r FROM ChargingReservation r WHERE r.stationCode = :stationCode " +
           "AND r.status IN (:statuses)")
    List<ChargingReservation> findActiveReservationsByStation(
            @Param("stationCode") String stationCode,
            @Param("statuses") List<ReservationStatus> statuses);

    @Query("SELECT r FROM ChargingReservation r WHERE r.robotCode = :robotCode " +
           "AND r.status IN (:statuses)")
    List<ChargingReservation> findActiveReservationsByRobot(
            @Param("robotCode") String robotCode,
            @Param("statuses") List<ReservationStatus> statuses);

    List<ChargingReservation> findByStatusIn(List<ReservationStatus> statuses);

    @Query("SELECT r FROM ChargingReservation r WHERE r.createdAt BETWEEN :startTime AND :endTime")
    List<ChargingReservation> findByTimeRange(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);
}
