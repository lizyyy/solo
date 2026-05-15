package com.schema.approval.controller;

import com.schema.approval.dto.ApiResponse;
import com.schema.approval.dto.ConsumerCreateRequest;
import com.schema.approval.entity.Consumer;
import com.schema.approval.service.ConsumerService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/consumers")
@RequiredArgsConstructor
public class ConsumerController {
    private final ConsumerService consumerService;

    @PostMapping
    public ResponseEntity<ApiResponse<Consumer>> createConsumer(
            @Valid @RequestBody ConsumerCreateRequest request) {
        Consumer consumer = consumerService.createConsumer(request);
        return ResponseEntity.ok(ApiResponse.success("Consumer created successfully", consumer));
    }

    @GetMapping("/topic/{topicName}")
    public ResponseEntity<ApiResponse<List<Consumer>>> getConsumersByTopic(
            @PathVariable String topicName) {
        List<Consumer> consumers = consumerService.getConsumersByTopic(topicName);
        return ResponseEntity.ok(ApiResponse.success(consumers));
    }
}
