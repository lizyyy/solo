package com.agri.dronespray.repository;

import com.agri.dronespray.entity.Permission;
import com.agri.dronespray.entity.PermissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {

    Optional<Permission> findByPermissionNo(String permissionNo);

    List<Permission> findByStatus(PermissionStatus status);

    List<Permission> findByCreatedBy(String createdBy);

    @Query("SELECT p FROM Permission p WHERE p.plannedStartTime >= :startTime AND p.plannedEndTime <= :endTime")
    List<Permission> findByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT p FROM Permission p JOIN p.items i WHERE i.plot.id = :plotId AND p.status IN :statuses")
    List<Permission> findByPlotIdAndStatusIn(@Param("plotId") Long plotId, @Param("statuses") List<PermissionStatus> statuses);

    @Query("SELECT COUNT(p) > 0 FROM Permission p JOIN p.items i WHERE i.plot.id = :plotId " +
           "AND p.status IN ('APPROVED', 'COMPLETED', 'AMENDED') " +
           "AND p.plannedEndTime >= :thresholdTime")
    boolean existsRecentOperationForPlot(@Param("plotId") Long plotId, @Param("thresholdTime") LocalDateTime thresholdTime);
}
