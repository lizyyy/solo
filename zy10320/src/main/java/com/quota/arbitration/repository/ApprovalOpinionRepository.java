package com.quota.arbitration.repository;

import com.quota.arbitration.entity.ApprovalOpinion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApprovalOpinionRepository extends JpaRepository<ApprovalOpinion, Long> {
    List<ApprovalOpinion> findByApplicationId(Long applicationId);
    List<ApprovalOpinion> findByApplicationNo(String applicationNo);
}
