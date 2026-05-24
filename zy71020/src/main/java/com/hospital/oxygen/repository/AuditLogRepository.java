package com.hospital.oxygen.repository;

import com.hospital.oxygen.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByResourceType(String resourceType);
    List<AuditLog> findByResourceId(String resourceId);
    List<AuditLog> findByOperator(String operator);
    List<AuditLog> findByIsDuplicateTrue();

    @Query("SELECT al FROM AuditLog al WHERE al.createdAt BETWEEN :startTime AND :endTime")
    List<AuditLog> findByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT COUNT(al) FROM AuditLog al WHERE al.isDuplicate = true AND al.createdAt BETWEEN :startTime AND :endTime")
    long countDuplicateOperations(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
}
