package com.statuspage.controller;

import com.statuspage.dto.ApiResponse;
import com.statuspage.model.Subscriber;
import com.statuspage.service.SubscriberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/subscribers")
@RequiredArgsConstructor
public class SubscriberController {
    private final SubscriberService subscriberService;

    @PostMapping
    public ResponseEntity<ApiResponse<Subscriber>> createSubscriber(
            @RequestParam String subscriberId,
            @RequestParam String name,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String organization) {
        Subscriber subscriber = subscriberService.createSubscriber(subscriberId, name, email, phone, organization);
        return ResponseEntity.ok(ApiResponse.success("订阅方创建成功", subscriber));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Subscriber>>> getAllSubscribers() {
        List<Subscriber> subscribers = subscriberService.getAllSubscribers();
        return ResponseEntity.ok(ApiResponse.success(subscribers));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<Subscriber>>> getActiveSubscribers() {
        List<Subscriber> subscribers = subscriberService.getActiveSubscribers();
        return ResponseEntity.ok(ApiResponse.success(subscribers));
    }

    @GetMapping("/{subscriberId}")
    public ResponseEntity<ApiResponse<Subscriber>> getSubscriber(@PathVariable String subscriberId) {
        Subscriber subscriber = subscriberService.getSubscriber(subscriberId);
        return ResponseEntity.ok(ApiResponse.success(subscriber));
    }

    @PutMapping("/{subscriberId}")
    public ResponseEntity<ApiResponse<Subscriber>> updateSubscriber(
            @PathVariable String subscriberId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String organization,
            @RequestParam(required = false) Boolean active) {
        Subscriber subscriber = subscriberService.updateSubscriber(subscriberId, name, email, phone, organization, active);
        return ResponseEntity.ok(ApiResponse.success("订阅方更新成功", subscriber));
    }

    @DeleteMapping("/{subscriberId}")
    public ResponseEntity<ApiResponse<Void>> deleteSubscriber(@PathVariable String subscriberId) {
        subscriberService.deleteSubscriber(subscriberId);
        return ResponseEntity.ok(ApiResponse.success("订阅方删除成功", null));
    }
}