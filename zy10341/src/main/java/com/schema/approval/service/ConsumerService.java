package com.schema.approval.service;

import com.schema.approval.dto.ConsumerCreateRequest;
import com.schema.approval.entity.Consumer;
import com.schema.approval.entity.EventTopic;
import com.schema.approval.repository.ConsumerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConsumerService {
    private final ConsumerRepository consumerRepository;
    private final EventTopicService eventTopicService;

    @Transactional
    public Consumer createConsumer(ConsumerCreateRequest request) {
        EventTopic topic = eventTopicService.getTopicOrThrow(request.getTopicName());

        Consumer consumer = new Consumer();
        consumer.setTopic(topic);
        consumer.setConsumerGroup(request.getConsumerGroup());
        consumer.setServiceName(request.getServiceName());
        consumer.setOwnerTeam(request.getOwnerTeam());
        consumer.setContactEmail(request.getContactEmail());
        consumer.setNotifyOnSchemaChange(request.getNotifyOnSchemaChange() != null ? request.getNotifyOnSchemaChange() : true);
        consumer.setIsActive(true);
        consumer.setCreatedBy(request.getCreatedBy());

        return consumerRepository.save(consumer);
    }

    public List<Consumer> getConsumersByTopic(String topicName) {
        EventTopic topic = eventTopicService.getTopicOrThrow(topicName);
        return consumerRepository.findByTopic(topic);
    }

    public List<Consumer> getActiveConsumersToNotify(EventTopic topic) {
        return consumerRepository.findByTopicAndIsActiveTrueAndNotifyOnSchemaChangeTrue(topic);
    }
}
