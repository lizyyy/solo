package com.privacy.replay.repository;

import com.privacy.replay.model.PrivacyBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PrivacyBudgetRepository extends JpaRepository<PrivacyBudget, Long> {

    Optional<PrivacyBudget> findByBudgetId(String budgetId);

    Optional<PrivacyBudget> findByUserIdAndIsActiveTrue(String userId);

    List<PrivacyBudget> findByExpiredAtBeforeAndIsActiveTrue(LocalDateTime dateTime);
}
