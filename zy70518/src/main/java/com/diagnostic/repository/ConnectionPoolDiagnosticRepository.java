package com.diagnostic.repository;

import com.diagnostic.entity.ConnectionPoolDiagnostic;
import com.diagnostic.enums.DiagnosticStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ConnectionPoolDiagnosticRepository extends JpaRepository<ConnectionPoolDiagnostic, Long> {

    List<ConnectionPoolDiagnostic> findByInstanceIdAndPoolNameOrderBySampleTimeDesc(
            String instanceId, String poolName);

    Page<ConnectionPoolDiagnostic> findByInstanceIdAndPoolNameAndStatusAndSuspectedLeak(
            String instanceId, String poolName, DiagnosticStatus status, Boolean suspectedLeak, Pageable pageable);

    @Query("SELECT d FROM ConnectionPoolDiagnostic d WHERE " +
           "(:instanceId IS NULL OR d.instanceId = :instanceId) AND " +
           "(:poolName IS NULL OR d.poolName = :poolName) AND " +
           "(:status IS NULL OR d.status = :status) AND " +
           "(:suspectedLeak IS NULL OR d.suspectedLeak = :suspectedLeak) AND " +
           "(:startTime IS NULL OR d.sampleTime >= :startTime) AND " +
           "(:endTime IS NULL OR d.sampleTime <= :endTime) " +
           "ORDER BY d.sampleTime DESC")
    Page<ConnectionPoolDiagnostic> findByConditions(
            @Param("instanceId") String instanceId,
            @Param("poolName") String poolName,
            @Param("status") DiagnosticStatus status,
            @Param("suspectedLeak") Boolean suspectedLeak,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    @Query("SELECT COUNT(d) FROM ConnectionPoolDiagnostic d WHERE " +
           "d.instanceId = :instanceId AND d.poolName = :poolName AND " +
           "d.suspectedLeak = true AND d.sampleTime >= :beforeTime")
    Long countConsecutiveLeakSamples(
            @Param("instanceId") String instanceId,
            @Param("poolName") String poolName,
            @Param("beforeTime") LocalDateTime beforeTime);

    @Query("SELECT d FROM ConnectionPoolDiagnostic d WHERE " +
           "d.instanceId = :instanceId AND d.poolName = :poolName AND " +
           "d.sampleTime BETWEEN :startTime AND :endTime " +
           "ORDER BY d.sampleTime ASC")
    List<ConnectionPoolDiagnostic> findByTimeRange(
            @Param("instanceId") String instanceId,
            @Param("poolName") String poolName,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    @Query("SELECT MAX(d.activeConnections) FROM ConnectionPoolDiagnostic d WHERE " +
           "d.instanceId = :instanceId AND d.poolName = :poolName AND " +
           "d.sampleTime BETWEEN :startTime AND :endTime")
    Integer findMaxActiveConnections(
            @Param("instanceId") String instanceId,
            @Param("poolName") String poolName,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    List<ConnectionPoolDiagnostic> findByStatus(DiagnosticStatus status);

    @Modifying
    @Transactional
    @Query("DELETE FROM ConnectionPoolDiagnostic d WHERE d.createdAt < :expireTime")
    void deleteExpiredRecords(@Param("expireTime") LocalDateTime expireTime);
}
