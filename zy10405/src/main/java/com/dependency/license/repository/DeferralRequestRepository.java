package com.dependency.license.repository;

import com.dependency.license.model.DeferralRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeferralRequestRepository extends JpaRepository<DeferralRequest, Long> {
    List<DeferralRequest> findByApprovalId(Long approvalId);
    List<DeferralRequest> findByApprovalBatchId(Long batchId);
    List<DeferralRequest> findByApprovedIsNull();
}