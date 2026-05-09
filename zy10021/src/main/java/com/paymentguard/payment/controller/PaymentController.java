package com.paymentguard.payment.controller;

import com.paymentguard.common.dto.ApiResponse;
import com.paymentguard.common.dto.PaymentCallbackRequest;
import com.paymentguard.payment.entity.CallbackRecord;
import com.paymentguard.payment.entity.PaymentTransaction;
import com.paymentguard.payment.service.PaymentCallbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentCallbackService callbackService;

    @PostMapping("/callback")
    public ResponseEntity<ApiResponse<CallbackRecord>> handleCallback(
            @Valid @RequestBody PaymentCallbackRequest request,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey) {
        
        CallbackRecord record = callbackService.processCallback(request);
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("callbackStatus", record.getStatus());
        metadata.put("isDuplicate", record.getIsDuplicate());
        metadata.put("processingTimeMs", record.getProcessingTimeMs());
        
        HttpStatus status = record.getStatus().getCode() == CallbackStatus.SUCCESS.getCode() 
                ? HttpStatus.OK 
                : HttpStatus.ACCEPTED;
        
        return ResponseEntity.status(status)
                .body(ApiResponse.success(record, "回调处理完成", metadata));
    }

    @GetMapping("/callbacks/order/{orderId}")
    public ResponseEntity<ApiResponse<List<CallbackRecord>>> getCallbacksByOrder(
            @PathVariable String orderId) {
        List<CallbackRecord> records = callbackService.getCallbacksByOrder(orderId);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    @GetMapping("/callbacks/transaction/{transactionId}")
    public ResponseEntity<ApiResponse<List<CallbackRecord>>> getCallbacksByTransaction(
            @PathVariable String transactionId) {
        List<CallbackRecord> records = callbackService.getCallbacksByTransaction(transactionId);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    @GetMapping("/transactions/order/{orderId}")
    public ResponseEntity<ApiResponse<List<PaymentTransaction>>> getTransactionsByOrder(
            @PathVariable String orderId) {
        List<PaymentTransaction> transactions = callbackService.getTransactionsByOrder(orderId);
        return ResponseEntity.ok(ApiResponse.success(transactions));
    }
}
