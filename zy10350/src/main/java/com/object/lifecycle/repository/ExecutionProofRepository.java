package com.object.lifecycle.repository;

import com.object.lifecycle.entity.ExecutionProof;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutionProofRepository extends JpaRepository<ExecutionProof, Long> {

    Optional<ExecutionProof> findByProofId(String proofId);

    List<ExecutionProof> findByRuleIdOrderByExecutionTimeDesc(String ruleId);

    List<ExecutionProof> findByObjectKeyAndBucketNameOrderByExecutionTimeDesc(String objectKey, String bucketName);

    List<ExecutionProof> findByExecutionTimeBetweenOrderByExecutionTimeDesc(LocalDateTime start, LocalDateTime end);
}
