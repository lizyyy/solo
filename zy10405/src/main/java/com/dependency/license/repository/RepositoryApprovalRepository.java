package com.dependency.license.repository;

import com.dependency.license.model.RepositoryApproval;
import com.dependency.license.model.ApprovalStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RepositoryApprovalRepository extends JpaRepository<RepositoryApproval, Long> {
    List<RepositoryApproval> findByBatchId(Long batchId);
    List<RepositoryApproval> findByRepositoryId(Long repositoryId);
    List<RepositoryApproval> findByBatchIdAndStatus(Long batchId, ApprovalStatus status);
    Optional<RepositoryApproval> findByBatchIdAndRepositoryId(Long batchId, Long repositoryId);
    long countByBatchIdAndStatus(Long batchId, ApprovalStatus status);
}