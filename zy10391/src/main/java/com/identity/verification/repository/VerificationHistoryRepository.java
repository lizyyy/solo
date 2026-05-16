package com.identity.verification.repository;

import com.identity.verification.model.VerificationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VerificationHistoryRepository extends JpaRepository<VerificationHistory, Long> {

    List<VerificationHistory> findByTaskIdOrderByCreatedAtAsc(Long taskId);

    List<VerificationHistory> findByTaskIdOrderByCreatedAtDesc(Long taskId);
}
