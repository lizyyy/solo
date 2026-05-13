package com.quota.arbitration.repository;

import com.quota.arbitration.entity.DeductionDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeductionDetailRepository extends JpaRepository<DeductionDetail, Long> {
    List<DeductionDetail> findByApplicationId(Long applicationId);
    List<DeductionDetail> findByApplicationNo(String applicationNo);
    List<DeductionDetail> findByCustomerId(String customerId);
    boolean existsByTransactionNo(String transactionNo);
}
