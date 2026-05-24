package com.dormitory.maintenance.repository;

import com.dormitory.maintenance.entity.DormBuilding;
import com.dormitory.maintenance.entity.MaintenanceOrder;
import com.dormitory.maintenance.enums.MaintenanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MaintenanceOrderRepository extends JpaRepository<MaintenanceOrder, Long> {
    Optional<MaintenanceOrder> findByOrderNo(String orderNo);

    List<MaintenanceOrder> findByBatchNo(String batchNo);

    List<MaintenanceOrder> findByStatus(MaintenanceStatus status);

    List<MaintenanceOrder> findByBuilding(DormBuilding building);

    List<MaintenanceOrder> findByBuildingAndStatusIn(DormBuilding building, List<MaintenanceStatus> statuses);

    @Query("SELECT m FROM MaintenanceOrder m WHERE m.building = :building " +
           "AND m.status IN :statuses " +
           "AND ((m.scheduledStartTime <= :endTime AND m.scheduledEndTime >= :startTime) " +
           "OR (m.actualStartTime IS NOT NULL AND m.actualStartTime <= :endTime AND m.actualEndTime >= :startTime))")
    List<MaintenanceOrder> findOverlappingOrders(
            @Param("building") DormBuilding building,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("statuses") List<MaintenanceStatus> statuses);

    @Query("SELECT m FROM MaintenanceOrder m WHERE m.hasConflict = true")
    List<MaintenanceOrder> findAllOrdersWithConflict();

    @Query("SELECT m FROM MaintenanceOrder m WHERE m.status = :status " +
           "AND m.actualStartTime IS NOT NULL AND m.actualEndTime IS NULL " +
           "AND m.overTimeRequested = true AND m.overTimeApproved IS NULL")
    List<MaintenanceOrder> findOrdersWithPendingOverTimeApproval(@Param("status") MaintenanceStatus status);

    @Query("SELECT m FROM MaintenanceOrder m WHERE m.batchNo = :batchNo ORDER BY m.createdAt DESC")
    List<MaintenanceOrder> findByBatchNoOrderByCreatedAtDesc(@Param("batchNo") String batchNo);

    boolean existsByOrderNo(String orderNo);
}
