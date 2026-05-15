package com.crossborder.approval.repository;

import com.crossborder.approval.model.entity.ApprovalChain;
import com.crossborder.approval.model.enums.ApprovalResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalChainRepository extends JpaRepository<ApprovalChain, Long> {

    List<ApprovalChain> findByApplicationIdOrderByApprovalLevel(Long applicationId);

    List<ApprovalChain> findByApplicationIdAndResult(Long applicationId, ApprovalResult result);

    List<ApprovalChain> findByApproverId(String approverId);
}
