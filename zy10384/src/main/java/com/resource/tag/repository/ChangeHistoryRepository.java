package com.resource.tag.repository;

import com.resource.tag.model.ChangeHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChangeHistoryRepository extends JpaRepository<ChangeHistory, Long> {
    List<ChangeHistory> findByTaskIdOrderByCreatedAtDesc(String taskId);
    List<ChangeHistory> findByNodeIdOrderByCreatedAtDesc(String nodeId);
}
