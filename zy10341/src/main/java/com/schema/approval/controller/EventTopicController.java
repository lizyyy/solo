package com.schema.approval.controller;

import com.schema.approval.dto.ApiResponse;
import com.schema.approval.dto.TopicCreateRequest;
import com.schema.approval.entity.EventTopic;
import com.schema.approval.service.EventTopicService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/topics")
@RequiredArgsConstructor
public class EventTopicController {
    private final EventTopicService eventTopicService;

    @PostMapping
    public ResponseEntity<ApiResponse<EventTopic>> createTopic(@Valid @RequestBody TopicCreateRequest request) {
        EventTopic topic = eventTopicService.createTopic(request);
        return ResponseEntity.ok(ApiResponse.success("Topic created successfully", topic));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<EventTopic>>> getAllTopics() {
        List<EventTopic> topics = eventTopicService.getAllTopics();
        return ResponseEntity.ok(ApiResponse.success(topics));
    }

    @GetMapping("/{topicName}")
    public ResponseEntity<ApiResponse<EventTopic>> getTopic(@PathVariable String topicName) {
        return eventTopicService.getTopic(topicName)
                .map(topic -> ResponseEntity.ok(ApiResponse.success(topic)))
                .orElse(ResponseEntity.notFound().build());
    }
}
