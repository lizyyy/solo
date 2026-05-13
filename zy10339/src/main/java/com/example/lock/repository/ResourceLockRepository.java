package com.example.lock.repository;

import com.example.lock.entity.ResourceLock;
import com.example.lock.enums.LockStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ResourceLockRepository extends JpaRepository<ResourceLock, Long> {

    Optional<ResourceLock> findByResourceId(String resourceId);

    Optional<ResourceLock> findByRequestId(String requestId);

    List<ResourceLock> findByStatus(LockStatus status);

    @Query("SELECT l FROM ResourceLock l WHERE l.status = :status AND l.expireTime < :now")
    List<ResourceLock> findExpiredLocks(@Param("status") LockStatus status, @Param("now") LocalDateTime now);

    List<ResourceLock> findByLockHolder(String lockHolder);

    boolean existsByResourceId(String resourceId);

    boolean existsByRequestId(String requestId);
}
