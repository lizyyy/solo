package com.ci.cache.repository;

import com.ci.cache.model.EvictionApplication;
import com.ci.cache.model.EvictionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EvictionApplicationRepository extends JpaRepository<EvictionApplication, Long> {
    Optional<EvictionApplication> findByApplicationId(String applicationId);
    List<EvictionApplication> findByProjectName(String projectName);
    List<EvictionApplication> findByStatus(EvictionStatus status);
    List<EvictionApplication> findByStatusIn(List<EvictionStatus> statuses);

    @Query("SELECT e FROM EvictionApplication e WHERE e.status IN :statuses AND e.projectName = :projectName")
    List<EvictionApplication> findByStatusInAndProjectName(List<EvictionStatus> statuses, String projectName);

    @Query("SELECT e FROM EvictionApplication e WHERE e.status = 'PENDING' OR e.status = 'ANALYZING' OR e.status = 'APPROVED' OR e.status = 'EXECUTING'")
    List<EvictionApplication> findActiveApplications();

    boolean existsByApplicationId(String applicationId);
}
