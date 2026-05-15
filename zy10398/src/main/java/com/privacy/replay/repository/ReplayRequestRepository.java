package com.privacy.replay.repository;

import com.privacy.replay.model.ReplayRequest;
import com.privacy.replay.model.ReplayRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReplayRequestRepository extends JpaRepository<ReplayRequest, Long> {

    Optional<ReplayRequest> findByRequestId(String requestId);

    List<ReplayRequest> findByRequesterId(String requesterId);

    List<ReplayRequest> findByStatus(ReplayRequestStatus status);

    List<ReplayRequest> findByRequesterIdAndStatus(String requesterId, ReplayRequestStatus status);

    List<ReplayRequest> findByExpiredAtBeforeAndStatus(LocalDateTime dateTime, ReplayRequestStatus status);
}
