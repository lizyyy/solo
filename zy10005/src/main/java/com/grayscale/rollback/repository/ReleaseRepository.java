package com.grayscale.rollback.repository;

import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.ReleaseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReleaseRepository extends JpaRepository<Release, String> {
    
    List<Release> findByStatusIn(List<ReleaseStatus> statuses);
    
    List<Release> findByServiceName(String serviceName);
    
    Optional<Release> findFirstByServiceNameOrderByCreatedAtDesc(String serviceName);
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Release r WHERE r.id = :id")
    Optional<Release> findByIdWithLock(@Param("id") String id);
    
    @Query("SELECT r FROM Release r WHERE r.status IN (:statuses) ORDER BY r.createdAt ASC")
    List<Release> findActiveReleases(@Param("statuses") List<ReleaseStatus> statuses);
}
