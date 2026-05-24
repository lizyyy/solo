package com.factory.gauge.repository;

import com.factory.gauge.entity.MeasuringTool;
import com.factory.gauge.entity.enums.GaugeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MeasuringToolRepository extends JpaRepository<MeasuringTool, Long> {
    Optional<MeasuringTool> findByToolNo(String toolNo);

    List<MeasuringTool> findByStatus(GaugeStatus status);

    @Query("SELECT m FROM MeasuringTool m WHERE m.validUntilDate < :date AND m.status = 'NORMAL'")
    List<MeasuringTool> findExpiredTools(@Param("date") LocalDate date);

    @Query("SELECT m FROM MeasuringTool m WHERE m.validUntilDate <= :warningDate AND m.validUntilDate > :date AND m.status = 'NORMAL'")
    List<MeasuringTool> findExpiringTools(@Param("date") LocalDate date, @Param("warningDate") LocalDate warningDate);

    List<MeasuringTool> findByCalibrationCertificateNoAndCertificateVersion(String certificateNo, Integer version);

    boolean existsByToolNo(String toolNo);
}
