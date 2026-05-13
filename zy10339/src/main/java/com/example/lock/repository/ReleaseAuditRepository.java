package com.example.lock.repository;

import com.example.lock.entity.ReleaseAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReleaseAuditRepository extends JpaRepository<ReleaseAudit, Long> {

    List<ReleaseAudit> findByResourceIdOrderByReleasedAtDesc(String resourceId);

    List<ReleaseAudit> findByLockHolderOrderByReleasedAtDesc(String lockHolder);

    List<ReleaseAudit> findByReleasedAtBetweenOrderByReleasedAtDesc(LocalDateTime start, LocalDateTime end);

    List<ReleaseAudit> findByResourceIdAndReleasedAtBetweenOrderByReleasedAtDesc(String resourceId, LocalDateTime start, LocalDateTime end);
}
