package com.schema.approval.repository;

import com.schema.approval.entity.EventTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EventTopicRepository extends JpaRepository<EventTopic, Long> {
    Optional<EventTopic> findByTopicName(String topicName);
    boolean existsByTopicName(String topicName);
}
