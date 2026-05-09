package com.example.config.repository;

import com.example.config.domain.ClientPushStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClientPushStatusRepository extends JpaRepository<ClientPushStatus, Long> {

    Optional<ClientPushStatus> findByReleaseIdAndInstanceId(String releaseId, String instanceId);

    List<ClientPushStatus> findByReleaseId(String releaseId);

    List<ClientPushStatus> findByReleaseIdAndStatus(String releaseId, ClientPushStatus.PushStatus status);

    @Query("SELECT COUNT(c) FROM ClientPushStatus c WHERE c.releaseId = :releaseId AND c.status = :status")
    long countByReleaseIdAndStatus(
            @Param("releaseId") String releaseId,
            @Param("status") ClientPushStatus.PushStatus status);

    @Query("SELECT c FROM ClientPushStatus c WHERE c.status IN :statuses AND c.nextRetryAt <= :now ORDER BY c.nextRetryAt ASC")
    List<ClientPushStatus> findRetryablePushStatuses(
            @Param("statuses") List<ClientPushStatus.PushStatus> statuses,
            @Param("now") LocalDateTime now);

    @Query("SELECT c FROM ClientPushStatus c WHERE c.instanceId = :instanceId ORDER BY c.updatedAt DESC")
    List<ClientPushStatus> findByInstanceIdOrderByUpdatedAtDesc(@Param("instanceId") String instanceId);
}
