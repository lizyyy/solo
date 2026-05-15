package com.virusscan.repository;

import com.virusscan.entity.FailureReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FailureReasonRepository extends JpaRepository<FailureReason, Long> {
    Optional<FailureReason> findByFailureId(String failureId);
    List<FailureReason> findByTaskId(String taskId);
    List<FailureReason> findByFileId(String fileId);
    List<FailureReason> findByErrorCode(String errorCode);
    List<FailureReason> findByFailureTimeBetween(LocalDateTime start, LocalDateTime end);
    boolean existsByFailureId(String failureId);
}