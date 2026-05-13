package com.quota.arbitration.repository;

import com.quota.arbitration.entity.CustomerQuota;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerQuotaRepository extends JpaRepository<CustomerQuota, Long> {
    Optional<CustomerQuota> findByCustomerId(String customerId);
    boolean existsByCustomerId(String customerId);
}
