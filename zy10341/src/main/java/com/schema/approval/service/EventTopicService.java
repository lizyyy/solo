package com.schema.approval.service;

import com.schema.approval.dto.TopicCreateRequest;
import com.schema.approval.entity.EventTopic;
import com.schema.approval.exception.BusinessException;
import com.schema.approval.exception.ErrorCode;
import com.schema.approval.repository.EventTopicRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventTopicService {
    private final EventTopicRepository eventTopicRepository;

    @Transactional
    public EventTopic createTopic(TopicCreateRequest request) {
        if (eventTopicRepository.existsByTopicName(request.getTopicName())) {
            throw new BusinessException(
                "Topic already exists: " + request.getTopicName(),
                ErrorCode.TOPIC_ALREADY_EXISTS
            );
        }

        EventTopic topic = new EventTopic();
        topic.setTopicName(request.getTopicName());
        topic.setDescription(request.getDescription());
        topic.setCompatibilityLevel(request.getCompatibilityLevel());
        topic.setOwnerTeam(request.getOwnerTeam());
        topic.setBusinessDomain(request.getBusinessDomain());
        topic.setCreatedBy(request.getCreatedBy());

        return eventTopicRepository.save(topic);
    }

    public Optional<EventTopic> getTopic(String topicName) {
        return eventTopicRepository.findByTopicName(topicName);
    }

    public List<EventTopic> getAllTopics() {
        return eventTopicRepository.findAll();
    }

    public EventTopic getTopicOrThrow(String topicName) {
        return eventTopicRepository.findByTopicName(topicName)
                .orElseThrow(() -> new BusinessException(
                    "Topic not found: " + topicName,
                    ErrorCode.TOPIC_NOT_FOUND
                ));
    }
}
