package com.schema.approval.repository;

import com.schema.approval.entity.EventTopic;
import com.schema.approval.entity.SchemaVersion;
import com.schema.approval.enums.SchemaStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SchemaVersionRepository extends JpaRepository<SchemaVersion, Long> {
    Optional<SchemaVersion> findByTopicAndVersion(EventTopic topic, Integer version);
    
    Optional<SchemaVersion> findByRequestId(String requestId);
    
    Optional<SchemaVersion> findByTopicAndIsLatestTrue(EventTopic topic);
    
    List<SchemaVersion> findByTopicOrderByVersionDesc(EventTopic topic);
    
    List<SchemaVersion> findByStatus(SchemaStatus status);
    
    @Query("SELECT MAX(s.version) FROM SchemaVersion s WHERE s.topic = :topic")
    Integer findMaxVersionByTopic(EventTopic topic);
    
    boolean existsByTopicAndVersion(EventTopic topic, Integer version);
    
    boolean existsByRequestId(String requestId);
}
