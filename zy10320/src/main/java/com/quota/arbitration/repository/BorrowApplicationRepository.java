package com.quota.arbitration.repository;

import com.quota.arbitration.entity.BorrowApplication;
import com.quota.arbitration.enums.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BorrowApplicationRepository extends JpaRepository<BorrowApplication, Long> {
    Optional<BorrowApplication> findByApplicationNo(String applicationNo);
    boolean existsByApplicationNo(String applicationNo);
    List<BorrowApplication> findByCustomerId(String customerId);
    List<BorrowApplication> findByStatus(ApplicationStatus status);
    List<BorrowApplication> findByCustomerIdAndStatus(String customerId, ApplicationStatus status);
}
