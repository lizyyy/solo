package com.identity.verification.repository;

import com.identity.verification.model.MergeSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MergeSuggestionRepository extends JpaRepository<MergeSuggestion, Long> {

    List<MergeSuggestion> findByTaskId(Long taskId);
}
