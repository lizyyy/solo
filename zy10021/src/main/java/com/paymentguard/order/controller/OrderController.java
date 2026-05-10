package com.paymentguard.order.controller;

import com.paymentguard.common.dto.ApiResponse;
import com.paymentguard.common.dto.CreateOrderRequest;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.service.OrderService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<ApiResponse<Order>> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        Order order = orderService.createOrder(request);
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("status", order.getStatus());
        metadata.put("amount", order.getAmount());
        
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(order, metadata));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<Order>> getOrder(@PathVariable String orderId) {
        Order order = orderService.getOrder(orderId);
        return ResponseEntity.ok(ApiResponse.success(order));
    }
}
