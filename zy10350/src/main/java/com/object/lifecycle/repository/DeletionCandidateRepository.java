package com.object.lifecycle.repository;

import com.object.lifecycle.entity.DeletionCandidate;
import com.object.lifecycle.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DeletionCandidateRepository extends JpaRepository<DeletionCandidate, Long> {

    List<DeletionCandidate> findByStatus(TaskStatus status);

    List<DeletionCandidate> findByRuleId(Long ruleId);

    List<DeletionCandidate> findByStatusAndScheduledDeletionDateBefore(TaskStatus status, LocalDateTime date);

    boolean existsByRuleIdAndObjectKeyAndBucketName(Long ruleId, String objectKey, String bucketName);
}
