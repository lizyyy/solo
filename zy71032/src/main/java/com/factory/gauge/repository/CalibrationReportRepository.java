package com.factory.gauge.repository;

import com.factory.gauge.entity.CalibrationReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CalibrationReportRepository extends JpaRepository<CalibrationReport, Long> {
    List<CalibrationReport> findByToolId(Long toolId);

    List<CalibrationReport> findByToolNo(String toolNo);

    List<CalibrationReport> findByCertificateNo(String certificateNo);

    Optional<CalibrationReport> findByCertificateNoAndVersion(String certificateNo, Integer version);

    @Query("SELECT MAX(c.version) FROM CalibrationReport c WHERE c.certificateNo = :certificateNo")
    Optional<Integer> findMaxVersionByCertificateNo(@Param("certificateNo") String certificateNo);

    @Query("SELECT c FROM CalibrationReport c WHERE c.createdAt BETWEEN :startTime AND :endTime")
    List<CalibrationReport> findByCreatedAtBetween(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    Optional<CalibrationReport> findTopByToolIdOrderByCreatedAtDesc(Long toolId);
}
