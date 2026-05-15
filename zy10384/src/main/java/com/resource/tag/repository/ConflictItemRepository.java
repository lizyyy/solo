package com.resource.tag.repository;

import com.resource.tag.model.ConflictItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConflictItemRepository extends JpaRepository<ConflictItem, Long> {
    List<ConflictItem> findByTaskId(String taskId);
    List<ConflictItem> findByTaskIdAndResolution(String taskId, ConflictItem.ConflictResolution resolution);
}
