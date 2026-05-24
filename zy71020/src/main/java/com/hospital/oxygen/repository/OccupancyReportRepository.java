package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.OccupancyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OccupancyReportRepository extends JpaRepository<OccupancyReport, Long> {
    Optional<OccupancyReport> findByReportNumber(String reportNumber);
    List<OccupancyReport> findByWard(String ward);
    List<OccupancyReport> findByGeneratedBy(String generatedBy);

    @Query("SELECT or FROM OccupancyReport or WHERE or.reportDate BETWEEN :startTime AND :endTime")
    List<OccupancyReport> findByDateRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT or FROM OccupancyReport or WHERE or.ward = :ward AND or.reportDate BETWEEN :startTime AND :endTime ORDER BY or.reportDate DESC")
    List<OccupancyReport> findByWardAndDateRange(@Param("ward") String ward, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
}
