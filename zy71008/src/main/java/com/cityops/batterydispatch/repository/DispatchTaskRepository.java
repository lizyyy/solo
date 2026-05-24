package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.DispatchTask;
import com.cityops.batterydispatch.enums.DispatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DispatchTaskRepository extends JpaRepository<DispatchTask, Long> {
    Optional<DispatchTask> findByTaskNo(String taskNo);

    Optional<DispatchTask> findByVehicleNoAndStatusIn(String vehicleNo, List<DispatchStatus> statuses);

    List<DispatchTask> findByBatteryNoAndStatusIn(String batteryNo, List<DispatchStatus> statuses);

    List<DispatchTask> findByAreaCode(String areaCode);

    List<DispatchTask> findByBatchNo(String batchNo);

    List<DispatchTask> findByStatusIn(List<DispatchStatus> statuses);

    List<DispatchTask> findByDispatcherNoAndStatusIn(String dispatcherNo, List<DispatchStatus> statuses);

    @Query("SELECT t FROM DispatchTask t WHERE t.createdAt BETWEEN :startTime AND :endTime")
    List<DispatchTask> findByTimeRange(LocalDateTime startTime, LocalDateTime endTime);

    boolean existsByVehicleNoAndStatusIn(String vehicleNo, List<DispatchStatus> statuses);

    boolean existsByBatteryNoAndStatusIn(String batteryNo, List<DispatchStatus> statuses);
}
