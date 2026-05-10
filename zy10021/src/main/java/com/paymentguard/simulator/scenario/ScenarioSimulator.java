package com.paymentguard.simulator.scenario;

import com.paymentguard.common.dto.CreateOrderRequest;
import com.paymentguard.common.dto.PaymentCallbackRequest;
import com.paymentguard.common.dto.ScenarioConfig;
import com.paymentguard.common.enums.PaymentStatus;
import com.paymentguard.common.util.IdGenerator;
import com.paymentguard.common.util.JsonUtil;
import com.paymentguard.order.entity.Order;
import com.paymentguard.order.service.OrderService;
import com.paymentguard.payment.service.PaymentCallbackService;
import com.paymentguard.tracing.util.TraceContext;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScenarioSimulator {

    private final OrderService orderService;
    private final PaymentCallbackService callbackService;

    private final ConcurrentHashMap<String, ScenarioExecution> activeExecutions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Random random = new Random();

    @Async
    public ScenarioExecution startScenario(ScenarioConfig config) {
        String executionId = IdGenerator.generateTraceId();
        
        ScenarioExecution execution = ScenarioExecution.builder()
                .executionId(executionId)
                .config(config)
                .status(ScenarioStatus.RUNNING)
                .startTime(System.currentTimeMillis())
                .results(new ArrayList<>())
                .successCount(new AtomicInteger(0))
                .failureCount(new AtomicInteger(0))
                .duplicateCount(new AtomicInteger(0))
                .timeoutCount(new AtomicInteger(0))
                .build();
        
        activeExecutions.put(executionId, execution);
        
        log.info("Starting scenario: type={}, executionId={}", config.getScenarioType(), executionId);
        
        switch (config.getScenarioType()) {
            case HIGH_CONCURRENCY:
                runHighConcurrencyScenario(execution);
                break;
            case DUPLICATE_REQUEST:
                runDuplicateRequestScenario(execution);
                break;
            case SERVICE_TIMEOUT:
                runServiceTimeoutScenario(execution);
                break;
            case NETWORK_FAILURE:
                runNetworkFailureScenario(execution);
                break;
            case MESSAGE_REDELIVERY:
                runMessageRedeliveryScenario(execution);
                break;
            case MIXED:
                runMixedScenario(execution);
                break;
        }
        
        return execution;
    }

    private void runHighConcurrencyScenario(ScenarioExecution execution) {
        ScenarioConfig config = execution.getConfig();
        ExecutorService executor = Executors.newFixedThreadPool(config.getConcurrency());
        CountDownLatch latch = new CountDownLatch(config.getConcurrency());
        CyclicBarrier barrier = new CyclicBarrier(config.getConcurrency());

        String orderId = prepareOrder(config);
        execution.setTargetOrderId(orderId);

        for (int i = 0; i < config.getConcurrency(); i++) {
            final int requestId = i;
            executor.submit(() -> {
                try {
                    barrier.await();
                    executeCallback(execution, orderId, requestId, false);
                } catch (Exception e) {
                    log.error("High concurrency request failed: requestId={}", requestId, e);
                    execution.getFailureCount().incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        try {
            latch.await(config.getDurationSeconds(), TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            log.warn("High concurrency scenario interrupted", e);
        } finally {
            executor.shutdown();
            completeExecution(execution);
        }
    }

    private void runDuplicateRequestScenario(ScenarioExecution execution) {
        ScenarioConfig config = execution.getConfig();
        String orderId = prepareOrder(config);
        execution.setTargetOrderId(orderId);

        String transactionId = IdGenerator.generateTransactionId();

        for (int i = 0; i < config.getDuplicateCount(); i++) {
            try {
                executeCallback(execution, orderId, i, true, transactionId);
                Thread.sleep(random.nextInt(100));
            } catch (InterruptedException e) {
                log.warn("Duplicate request scenario interrupted", e);
                Thread.currentThread().interrupt();
                break;
            }
        }

        completeExecution(execution);
    }

    private void runServiceTimeoutScenario(ScenarioExecution execution) {
        ScenarioConfig config = execution.getConfig();
        ExecutorService executor = Executors.newFixedThreadPool(config.getConcurrency());
        List<Future<?>> futures = new ArrayList<>();

        String orderId = prepareOrder(config);
        execution.setTargetOrderId(orderId);

        for (int i = 0; i < config.getConcurrency(); i++) {
            final int requestId = i;
            futures.add(executor.submit(() -> {
                try {
                    if (random.nextInt(100) < config.getTimeoutRatePercent()) {
                        simulateTimeout(execution, requestId);
                    } else {
                        executeCallback(execution, orderId, requestId, false);
                    }
                } catch (Exception e) {
                    log.error("Timeout scenario request failed: requestId={}", requestId, e);
                    execution.getFailureCount().incrementAndGet();
                }
            }));
        }

        for (Future<?> future : futures) {
            try {
                future.get(config.getDurationSeconds(), TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                log.warn("Request timed out");
                execution.getTimeoutCount().incrementAndGet();
                future.cancel(true);
            } catch (Exception e) {
                log.error("Error waiting for future", e);
            }
        }

        executor.shutdown();
        completeExecution(execution);
    }

    private void runNetworkFailureScenario(ScenarioExecution execution) {
        ScenarioConfig config = execution.getConfig();
        String orderId = prepareOrder(config);
        execution.setTargetOrderId(orderId);

        int totalRequests = config.getConcurrency();
        int failureRate = config.getFailureRatePercent();

        for (int i = 0; i < totalRequests; i++) {
            final int requestId = i;
            boolean shouldFail = random.nextInt(100) < failureRate;

            try {
                if (shouldFail) {
                    simulateNetworkFailure(execution, requestId);
                } else {
                    executeCallback(execution, orderId, requestId, false);
                }
                Thread.sleep(random.nextInt(200));
            } catch (Exception e) {
                log.error("Network failure scenario error: requestId={}", requestId, e);
            }
        }

        completeExecution(execution);
    }

    private void runMessageRedeliveryScenario(ScenarioExecution execution) {
        ScenarioConfig config = execution.getConfig();
        String orderId = prepareOrder(config);
        execution.setTargetOrderId(orderId);

        String transactionId = IdGenerator.generateTransactionId();

        for (int i = 0; i < config.getMessageRedeliveryCount(); i++) {
            final int deliveryAttempt = i + 1;
            try {
                log.info("Message delivery attempt: {} for transactionId={}", deliveryAttempt, transactionId);
                executeCallback(execution, orderId, i, true, transactionId);
                Thread.sleep(1000 + random.nextInt(2000));
            } catch (InterruptedException e) {
                log.warn("Message redelivery scenario interrupted", e);
                Thread.currentThread().interrupt();
                break;
            }
        }

        completeExecution(execution);
    }

    private void runMixedScenario(ScenarioExecution execution) {
        ScenarioConfig config = execution.getConfig();
        ExecutorService executor = Executors.newFixedThreadPool(config.getConcurrency());
        String orderId = prepareOrder(config);
        execution.setTargetOrderId(orderId);

        for (int i = 0; i < config.getConcurrency(); i++) {
            final int requestId = i;
            executor.submit(new Runnable() {
                @Override
                public void run() {
                    int scenario = random.nextInt(4);
                    try {
                        switch (scenario) {
                            case 0:
                                executeCallback(execution, orderId, requestId, false);
                                break;
                            case 1:
                                executeCallback(execution, orderId, requestId, true);
                                break;
                            case 2:
                                simulateTimeout(execution, requestId);
                                break;
                            case 3:
                                simulateNetworkFailure(execution, requestId);
                                break;
                        }
                    } catch (Exception e) {
                        log.error("Mixed scenario request failed: requestId={}", requestId, e);
                        execution.getFailureCount().incrementAndGet();
                    }
                }
            });
        }

        executor.shutdown();
        try {
            executor.awaitTermination(config.getDurationSeconds(), TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            log.warn("Mixed scenario interrupted", e);
        }

        completeExecution(execution);
    }

    private String prepareOrder(ScenarioConfig config) {
        if (config.getOrderId() != null && orderService.orderExists(config.getOrderId())) {
            return config.getOrderId();
        }

        CreateOrderRequest createRequest = new CreateOrderRequest();
        createRequest.setProductName("Simulated Product");
        createRequest.setAmount(BigDecimal.valueOf(100.00 + random.nextInt(1000)));
        createRequest.setMerchantId("SIMULATOR_" + IdGenerator.generateRandomString(6));

        Order order = orderService.createOrder(createRequest);
        return order.getOrderId();
    }

    private void executeCallback(ScenarioExecution execution, String orderId, int requestId, boolean isDuplicate) {
        String transactionId = isDuplicate ? 
                IdGenerator.generateTransactionId() : 
                IdGenerator.generateTransactionId() + "_" + requestId;
        executeCallback(execution, orderId, requestId, isDuplicate, transactionId);
    }

    private void executeCallback(ScenarioExecution execution, String orderId, int requestId, 
                                  boolean isDuplicate, String transactionId) {
        TraceContext.initContext();
        try {
            PaymentCallbackRequest request = buildCallbackRequest(orderId, transactionId);
            
            long startTime = System.currentTimeMillis();
            com.paymentguard.payment.entity.CallbackRecord record = callbackService.processCallback(request);
            long duration = System.currentTimeMillis() - startTime;

            ScenarioResult result = ScenarioResult.builder()
                    .requestId(requestId)
                    .orderId(orderId)
                    .transactionId(transactionId)
                    .traceId(TraceContext.getTraceId())
                    .status(record.getStatus().name())
                    .isDuplicate(record.getIsDuplicate())
                    .processingTimeMs(duration)
                    .timestamp(System.currentTimeMillis())
                    .build();

            execution.getResults().add(result);

            if (record.getIsDuplicate()) {
                execution.getDuplicateCount().incrementAndGet();
            } else if ("SUCCESS".equals(record.getStatus().name())) {
                execution.getSuccessCount().incrementAndGet();
            } else {
                execution.getFailureCount().incrementAndGet();
            }

            log.debug("Callback executed: requestId={}, status={}, duration={}ms", 
                    requestId, record.getStatus(), duration);
        } catch (Exception e) {
            ScenarioResult result = ScenarioResult.builder()
                    .requestId(requestId)
                    .orderId(orderId)
                    .transactionId(transactionId)
                    .traceId(TraceContext.getTraceId())
                    .status("EXCEPTION")
                    .errorMessage(e.getMessage())
                    .timestamp(System.currentTimeMillis())
                    .build();
            execution.getResults().add(result);
            execution.getFailureCount().incrementAndGet();
            log.error("Callback execution failed: requestId={}", requestId, e);
        } finally {
            TraceContext.clearContext();
        }
    }

    private void simulateTimeout(ScenarioExecution execution, int requestId) {
        ScenarioResult result = ScenarioResult.builder()
                .requestId(requestId)
                .status("TIMEOUT")
                .errorMessage("Simulated service timeout")
                .timestamp(System.currentTimeMillis())
                .build();
        execution.getResults().add(result);
        execution.getTimeoutCount().incrementAndGet();
        log.debug("Simulated timeout: requestId={}", requestId);
    }

    private void simulateNetworkFailure(ScenarioExecution execution, int requestId) {
        ScenarioResult result = ScenarioResult.builder()
                .requestId(requestId)
                .status("NETWORK_FAILURE")
                .errorMessage("Simulated network failure")
                .timestamp(System.currentTimeMillis())
                .build();
        execution.getResults().add(result);
        execution.getFailureCount().incrementAndGet();
        log.debug("Simulated network failure: requestId={}", requestId);
    }

    private PaymentCallbackRequest buildCallbackRequest(String orderId, String transactionId) {
        Order order = orderService.getOrder(orderId);
        
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setTransactionId(transactionId);
        request.setOrderId(orderId);
        request.setAmount(order.getAmount());
        request.setCurrency(order.getCurrency());
        request.setStatus(PaymentStatus.SUCCESS);
        request.setPaymentMethod("ALIPAY");
        request.setChannelOrderId("CHANNEL_" + IdGenerator.generateRandomString(12));
        request.setBankOrderNo("BANK_" + IdGenerator.generateRandomString(16));
        request.setMerchantId(order.getMerchantId());
        request.setSuccessTime(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        request.setRawData(JsonUtil.toJson(request));
        
        return request;
    }

    private void completeExecution(ScenarioExecution execution) {
        execution.setStatus(ScenarioStatus.COMPLETED);
        execution.setEndTime(System.currentTimeMillis());
        log.info("Scenario completed: executionId={}, success={}, failed={}, duplicate={}, timeout={}",
                execution.getExecutionId(),
                execution.getSuccessCount().get(),
                execution.getFailureCount().get(),
                execution.getDuplicateCount().get(),
                execution.getTimeoutCount().get());
    }

    public ScenarioExecution getExecution(String executionId) {
        return activeExecutions.get(executionId);
    }

    public List<ScenarioExecution> getAllExecutions() {
        return new ArrayList<>(activeExecutions.values());
    }

    public enum ScenarioStatus {
        RUNNING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    @Data
    @Builder
    public static class ScenarioExecution {
        private String executionId;
        private ScenarioConfig config;
        private ScenarioStatus status;
        private String targetOrderId;
        private Long startTime;
        private Long endTime;
        private List<ScenarioResult> results;
        private AtomicInteger successCount;
        private AtomicInteger failureCount;
        private AtomicInteger duplicateCount;
        private AtomicInteger timeoutCount;

        public long getDurationMs() {
            if (endTime == null) {
                return System.currentTimeMillis() - startTime;
            }
            return endTime - startTime;
        }

        public int getTotalRequests() {
            return results != null ? results.size() : 0;
        }
    }

    @Data
    @Builder
    public static class ScenarioResult {
        private int requestId;
        private String orderId;
        private String transactionId;
        private String traceId;
        private String status;
        private Boolean isDuplicate;
        private Long processingTimeMs;
        private String errorMessage;
        private Long timestamp;
    }
}
