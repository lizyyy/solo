package com.quota.arbitration.repository;

import com.quota.arbitration.entity.SharedPool;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SharedPoolRepository extends JpaRepository<SharedPool, Long> {
    Optional<SharedPool> findByPoolCode(String poolCode);
    boolean existsByPoolCode(String poolCode);
}
