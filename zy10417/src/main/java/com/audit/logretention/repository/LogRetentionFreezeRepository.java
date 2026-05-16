package com.audit.logretention.repository;

import com.audit.logretention.entity.LogRetentionFreeze;
import com.audit.logretention.enums.FreezeReason;
import com.audit.logretention.enums.FreezeStatus;
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
public interface LogRetentionFreezeRepository extends JpaRepository<LogRetentionFreeze, Long> {

    Optional<LogRetentionFreeze> findByRequestId(String requestId);

    boolean existsByRequestId(String requestId);

    List<LogRetentionFreeze> findByLogTopicAndStatusIn(String logTopic, List<FreezeStatus> statuses);

    @Query("SELECT f FROM LogRetentionFreeze f WHERE f.logTopic = :logTopic " +
           "AND f.status IN ('ACTIVE', 'PENDING_REVIEW') " +
           "AND ((f.startTime <= :endTime) AND (f.endTime >= :startTime))")
    List<LogRetentionFreeze> findOverlappingFreezes(
            @Param("logTopic") String logTopic,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    @Query("SELECT f FROM LogRetentionFreeze f " +
           "WHERE (:requestId IS NULL OR f.requestId LIKE %:requestId%) " +
           "AND (:logTopic IS NULL OR f.logTopic LIKE %:logTopic%) " +
           "AND (:status IS NULL OR f.status = :status) " +
           "AND (:freezeReason IS NULL OR f.freezeReason = :freezeReason) " +
           "AND (:applicant IS NULL OR f.applicant LIKE %:applicant%) " +
           "AND (:startTimeFrom IS NULL OR f.startTime >= :startTimeFrom) " +
           "AND (:startTimeTo IS NULL OR f.startTime <= :startTimeTo)")
    Page<LogRetentionFreeze> findByConditions(
            @Param("requestId") String requestId,
            @Param("logTopic") String logTopic,
            @Param("status") FreezeStatus status,
            @Param("freezeReason") FreezeReason freezeReason,
            @Param("applicant") String applicant,
            @Param("startTimeFrom") LocalDateTime startTimeFrom,
            @Param("startTimeTo") LocalDateTime startTimeTo,
            Pageable pageable
    );

    List<LogRetentionFreeze> findByStatus(FreezeStatus status);

    List<LogRetentionFreeze> findByStatusIn(List<FreezeStatus> statuses);
}