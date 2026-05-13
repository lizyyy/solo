package com.example.readonlywindow.repository;

import com.example.readonlywindow.entity.ConflictRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConflictRecordRepository extends JpaRepository<ConflictRecord, Long> {
    Optional<ConflictRecord> findByConflictCode(String conflictCode);
    List<ConflictRecord> findByFreezeWindowId(Long windowId);
    List<ConflictRecord> findByFreezeWindowIdAndResolvedFalse(Long windowId);
    List<ConflictRecord> findByResourceName(String resourceName);
    boolean existsByConflictCode(String conflictCode);
}
