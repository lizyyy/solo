package com.privacy.replay.repository;

import com.privacy.replay.model.ReplayHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReplayHistoryRepository extends JpaRepository<ReplayHistory, Long> {

    List<ReplayHistory> findByRequesterIdOrderByExecutedAtDesc(String requesterId);

    List<ReplayHistory> findByRequestId(String requestId);

    List<ReplayHistory> findByExecutedAtBetween(LocalDateTime start, LocalDateTime end);

    List<ReplayHistory> findBySuccessFalse();
}
