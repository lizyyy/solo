package com.example.config.repository;

import com.example.config.domain.ConfigRelease;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigReleaseRepository extends JpaRepository<ConfigRelease, Long> {

    Optional<ConfigRelease> findByReleaseId(String releaseId);

    List<ConfigRelease> findByNamespaceOrderByCreatedAtDesc(String namespace);

    List<ConfigRelease> findByStatusIn(List<ConfigRelease.ReleaseStatus> statuses);

    @Query("SELECT r FROM ConfigRelease r WHERE r.namespace = :namespace AND r.configKey = :configKey ORDER BY r.createdAt DESC")
    List<ConfigRelease> findByNamespaceAndConfigKeyOrderByCreatedAtDesc(
            @Param("namespace") String namespace,
            @Param("configKey") String configKey);

    @Query("SELECT r FROM ConfigRelease r WHERE r.createdAt >= :from AND r.createdAt <= :to ORDER BY r.createdAt DESC")
    List<ConfigRelease> findByTimeRange(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("SELECT r FROM ConfigRelease r WHERE r.status IN :statuses AND r.createdAt >= :from ORDER BY r.createdAt ASC")
    List<ConfigRelease> findPendingOrInProgress(
            @Param("statuses") List<ConfigRelease.ReleaseStatus> statuses,
            @Param("from") LocalDateTime from);
}
