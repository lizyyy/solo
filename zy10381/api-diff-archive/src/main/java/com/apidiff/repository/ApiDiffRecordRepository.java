package com.apidiff.repository;

import com.apidiff.entity.ApiDiffRecord;
import com.apidiff.entity.enums.ConfirmationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ApiDiffRecordRepository extends JpaRepository<ApiDiffRecord, Long> {

    Optional<ApiDiffRecord> findByRequestHash(String requestHash);

    boolean existsByRequestHash(String requestHash);

    Page<ApiDiffRecord> findByStatus(ConfirmationStatus status, Pageable pageable);

    Page<ApiDiffRecord> findByApiPathContaining(String apiPath, Pageable pageable);

    @Query("SELECT r FROM ApiDiffRecord r WHERE r.hasDifferences = true")
    Page<ApiDiffRecord> findAllWithDifferences(Pageable pageable);

    @Query("SELECT r FROM ApiDiffRecord r WHERE r.createdAt BETWEEN :startTime AND :endTime")
    Page<ApiDiffRecord> findByCreatedAtBetween(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    @Query("SELECT r FROM ApiDiffRecord r WHERE " +
           "(:status IS NULL OR r.status = :status) AND " +
           "(:apiPath IS NULL OR r.apiPath LIKE %:apiPath%) AND " +
           "(:hasDifferences IS NULL OR r.hasDifferences = :hasDifferences) AND " +
           "(:startTime IS NULL OR r.createdAt >= :startTime) AND " +
           "(:endTime IS NULL OR r.createdAt <= :endTime)")
    Page<ApiDiffRecord> findByConditions(
            @Param("status") ConfirmationStatus status,
            @Param("apiPath") String apiPath,
            @Param("hasDifferences") Boolean hasDifferences,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    @Query("SELECT r FROM ApiDiffRecord r WHERE r.status IN :statuses")
    List<ApiDiffRecord> findByStatusIn(@Param("statuses") List<ConfirmationStatus> statuses);
}
