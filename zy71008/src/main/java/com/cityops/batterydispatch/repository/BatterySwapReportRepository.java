package com.cityops.batterydispatch.repository;

import com.cityops.batterydispatch.entity.BatterySwapReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BatterySwapReportRepository extends JpaRepository<BatterySwapReport, Long> {
    Optional<BatterySwapReport> findByReportNo(String reportNo);

    Optional<BatterySwapReport> findByTaskNo(String taskNo);

    @Query("SELECT r FROM BatterySwapReport r WHERE r.createdAt BETWEEN :startTime AND :endTime")
    List<BatterySwapReport> findByTimeRange(LocalDateTime startTime, LocalDateTime endTime);

    List<BatterySwapReport> findByAreaCode(String areaCode);
}
