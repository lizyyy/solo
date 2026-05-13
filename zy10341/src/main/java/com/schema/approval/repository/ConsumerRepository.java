package com.schema.approval.repository;

import com.schema.approval.entity.Consumer;
import com.schema.approval.entity.EventTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConsumerRepository extends JpaRepository<Consumer, Long> {
    List<Consumer> findByTopicAndIsActiveTrueAndNotifyOnSchemaChangeTrue(EventTopic topic);
    List<Consumer> findByTopic(EventTopic topic);
}
