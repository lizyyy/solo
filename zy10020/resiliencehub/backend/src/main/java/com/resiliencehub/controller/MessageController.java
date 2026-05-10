package com.resiliencehub.controller;

import com.resiliencehub.common.Result;
import com.resiliencehub.config.RabbitMQConfig;
import com.resiliencehub.message.DemoMessageListener;
import com.resiliencehub.message.MessageService;
import com.resiliencehub.tracing.TraceContext;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@RestController
@RequestMapping("/api/v1/message")
public class MessageController {
    
    private final RabbitTemplate rabbitTemplate;
    private final MessageService messageService;
    private final DemoMessageListener messageListener;
    private final ThreadPoolTaskExecutor messageExecutor;
    
    public MessageController(RabbitTemplate rabbitTemplate,
                             MessageService messageService,
                             DemoMessageListener messageListener,
                             @Qualifier("messageExecutor") ThreadPoolTaskExecutor messageExecutor) {
        this.rabbitTemplate = rabbitTemplate;
        this.messageService = messageService;
        this.messageListener = messageListener;
        this.messageExecutor = messageExecutor;
    }
    
    @PostMapping("/send/demo")
    public Result<?> sendDemoMessage(@RequestBody(required = false) Map<String, Object> payload) {
        Map<String, Object> finalPayload = payload != null ? new HashMap<>(payload) : new HashMap<>();
        finalPayload.putIfAbsent("message", "Demo message");
        finalPayload.putIfAbsent("timestamp", LocalDateTime.now().toString());
        finalPayload.putIfAbsent("traceId", TraceContext.getTraceId());
        
        String messageId = UUID.randomUUID().toString();
        
        Map<String, Object> response = new HashMap<>();
        response.put("messageId", messageId);
        response.put("queue", RabbitMQConfig.DEMO_QUEUE);
        response.put("exchange", RabbitMQConfig.DEMO_EXCHANGE);
        response.put("routingKey", RabbitMQConfig.DEMO_ROUTING_KEY);
        response.put("payload", finalPayload);
        response.put("traceId", TraceContext.getTraceId());
        
        try {
            rabbitTemplate.convertAndSend(
                RabbitMQConfig.DEMO_EXCHANGE,
                RabbitMQConfig.DEMO_ROUTING_KEY,
                finalPayload,
                message -> {
                    message.getMessageProperties().setMessageId(messageId);
                    message.getMessageProperties().setHeader("traceId", TraceContext.getTraceId());
                    message.getMessageProperties().setHeader("retry-count", 0);
                    return message;
                }
            );
            return Result.success(response);
        } catch (Exception e) {
            return Result.error("Failed to send message: " + e.getMessage());
        }
    }
    
    @PostMapping("/send/order")
    public Result<?> sendOrderMessage(@RequestBody(required = false) Map<String, Object> payload) {
        Map<String, Object> finalPayload = payload != null ? new HashMap<>(payload) : new HashMap<>();
        finalPayload.putIfAbsent("orderId", "ORD-" + System.currentTimeMillis());
        finalPayload.putIfAbsent("amount", 999.99);
        finalPayload.putIfAbsent("status", "NEW");
        finalPayload.putIfAbsent("timestamp", LocalDateTime.now().toString());
        finalPayload.putIfAbsent("traceId", TraceContext.getTraceId());
        
        String messageId = UUID.randomUUID().toString();
        
        Map<String, Object> response = new HashMap<>();
        response.put("messageId", messageId);
        response.put("queue", RabbitMQConfig.ORDER_QUEUE);
        response.put("exchange", RabbitMQConfig.ORDER_EXCHANGE);
        response.put("routingKey", RabbitMQConfig.ORDER_ROUTING_KEY);
        response.put("payload", finalPayload);
        response.put("traceId", TraceContext.getTraceId());
        
        try {
            rabbitTemplate.convertAndSend(
                RabbitMQConfig.ORDER_EXCHANGE,
                RabbitMQConfig.ORDER_ROUTING_KEY,
                finalPayload,
                message -> {
                    message.getMessageProperties().setMessageId(messageId);
                    message.getMessageProperties().setHeader("traceId", TraceContext.getTraceId());
                    message.getMessageProperties().setHeader("retry-count", 0);
                    return message;
                }
            );
            return Result.success(response);
        } catch (Exception e) {
            return Result.error("Failed to send message: " + e.getMessage());
        }
    }
    
    @PostMapping("/send/batch")
    public Result<?> sendBatchMessages(
            @RequestParam(defaultValue = "demo") String queueType,
            @RequestParam(defaultValue = "10") int count,
            @RequestParam(defaultValue = "false") boolean simulateDuplicates,
            @RequestParam(defaultValue = "false") boolean simulateFailure) {
        
        String exchange = "demo".equalsIgnoreCase(queueType) ? 
            RabbitMQConfig.DEMO_EXCHANGE : RabbitMQConfig.ORDER_EXCHANGE;
        String routingKey = "demo".equalsIgnoreCase(queueType) ? 
            RabbitMQConfig.DEMO_ROUTING_KEY : RabbitMQConfig.ORDER_ROUTING_KEY;
        
        String baseId = UUID.randomUUID().toString().substring(0, 8);
        
        String[] preGeneratedIds = new String[count];
        int uniqueCount = 0;
        for (int i = 0; i < count; i++) {
            if (simulateDuplicates && i > 0 && i % 3 == 0) {
                preGeneratedIds[i] = preGeneratedIds[i - 1];
            } else {
                preGeneratedIds[i] = "batch-" + baseId + "-" + i;
                uniqueCount++;
            }
        }
        
        List<String> messageIds = new ArrayList<>();
        for (String id : preGeneratedIds) {
            if (!messageIds.contains(id)) {
                messageIds.add(id);
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("queueType", queueType);
        response.put("totalMessages", count);
        response.put("uniqueMessages", uniqueCount);
        response.put("duplicateMessages", count - uniqueCount);
        response.put("simulateDuplicates", simulateDuplicates);
        response.put("simulateFailure", simulateFailure);
        response.put("traceId", TraceContext.getTraceId());
        
        CountDownLatch doneLatch = new CountDownLatch(count);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        AtomicInteger duplicateSentCount = new AtomicInteger(0);
        
        IntStream.range(0, count).forEach(i -> {
            messageExecutor.submit(() -> {
                try {
                    String messageId = preGeneratedIds[i];
                    
                    if (simulateDuplicates && i > 0 && i % 3 == 0) {
                        duplicateSentCount.incrementAndGet();
                    }
                    
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("message", "Batch message " + i);
                    payload.put("batchId", baseId);
                    payload.put("index", i);
                    payload.put("isDuplicate", simulateDuplicates && i > 0 && i % 3 == 0);
                    payload.put("timestamp", LocalDateTime.now().toString());
                    
                    if (simulateFailure && i > 0 && i % 5 == 0) {
                        payload.put("simulateFailure", true);
                    }
                    
                    rabbitTemplate.convertAndSend(
                        exchange,
                        routingKey,
                        payload,
                        message -> {
                            message.getMessageProperties().setMessageId(messageId);
                            message.getMessageProperties().setHeader("traceId", TraceContext.getTraceId());
                            message.getMessageProperties().setHeader("retry-count", 0);
                            return message;
                        }
                    );
                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        });
        
        try {
            doneLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        response.put("successCount", successCount.get());
        response.put("failCount", failCount.get());
        response.put("duplicateSentCount", duplicateSentCount.get());
        response.put("sampleMessageIds", messageIds.subList(0, Math.min(20, messageIds.size())));
        
        return Result.success(response);
    }
    
    @PostMapping("/send/concurrent")
    public Result<?> sendConcurrentMessages(
            @RequestParam(defaultValue = "demo") String queueType,
            @RequestParam(defaultValue = "100") int totalMessages,
            @RequestParam(defaultValue = "10") int concurrentProducers,
            @RequestParam(defaultValue = "0.1") double duplicateProbability) {
        
        String exchange = "demo".equalsIgnoreCase(queueType) ? 
            RabbitMQConfig.DEMO_EXCHANGE : RabbitMQConfig.ORDER_EXCHANGE;
        String routingKey = "demo".equalsIgnoreCase(queueType) ? 
            RabbitMQConfig.DEMO_ROUTING_KEY : RabbitMQConfig.ORDER_ROUTING_KEY;
        
        String baseId = UUID.randomUUID().toString().substring(0, 8);
        int actualMessageCount = totalMessages / concurrentProducers * concurrentProducers;
        
        String[] preGeneratedIds = new String[actualMessageCount];
        List<String> uniqueIds = new ArrayList<>();
        Set<String> idSet = new HashSet<>();
        int duplicatePlanned = 0;
        
        Random random = new Random();
        for (int i = 0; i < actualMessageCount; i++) {
            if (Math.random() < duplicateProbability && !uniqueIds.isEmpty()) {
                int randomIndex = random.nextInt(uniqueIds.size());
                preGeneratedIds[i] = uniqueIds.get(randomIndex);
                duplicatePlanned++;
            } else {
                String newId = "concurrent-" + baseId + "-" + i;
                preGeneratedIds[i] = newId;
                uniqueIds.add(newId);
                idSet.add(newId);
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("queueType", queueType);
        response.put("totalMessages", actualMessageCount);
        response.put("concurrentProducers", concurrentProducers);
        response.put("duplicateProbability", duplicateProbability);
        response.put("uniqueMessages", uniqueIds.size());
        response.put("duplicatePlanned", duplicatePlanned);
        response.put("traceId", TraceContext.getTraceId());
        
        int messagesPerProducer = actualMessageCount / concurrentProducers;
        
        AtomicInteger sentCount = new AtomicInteger(0);
        AtomicInteger actualDuplicateSent = new AtomicInteger(0);
        AtomicInteger failCount = new AtomicInteger(0);
        
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(concurrentProducers);
        
        long startTime = System.currentTimeMillis();
        
        IntStream.range(0, concurrentProducers).forEach(producerIdx -> {
            messageExecutor.submit(() -> {
                try {
                    startLatch.await();
                    
                    int startIdx = producerIdx * messagesPerProducer;
                    int endIdx = startIdx + messagesPerProducer;
                    
                    for (int i = startIdx; i < endIdx; i++) {
                        try {
                            String messageId = preGeneratedIds[i];
                            boolean isDuplicate = !idSet.contains(messageId);
                            
                            if (isDuplicate) {
                                actualDuplicateSent.incrementAndGet();
                            }
                            
                            Map<String, Object> payload = new HashMap<>();
                            payload.put("producerId", producerIdx);
                            payload.put("messageIndex", i - startIdx);
                            payload.put("globalIndex", i);
                            payload.put("isDuplicate", isDuplicate);
                            payload.put("timestamp", LocalDateTime.now().toString());
                            
                            rabbitTemplate.convertAndSend(
                                exchange,
                                routingKey,
                                payload,
                                message -> {
                                    message.getMessageProperties().setMessageId(messageId);
                                    message.getMessageProperties().setHeader("traceId", TraceContext.getTraceId());
                                    message.getMessageProperties().setHeader("retry-count", 0);
                                    return message;
                                }
                            );
                            sentCount.incrementAndGet();
                        } catch (Exception e) {
                            failCount.incrementAndGet();
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        });
        
        startLatch.countDown();
        
        try {
            doneLatch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        long duration = System.currentTimeMillis() - startTime;
        
        response.put("sentCount", sentCount.get());
        response.put("actualDuplicateSent", actualDuplicateSent.get());
        response.put("failCount", failCount.get());
        response.put("durationMs", duration);
        response.put("messagesPerSecond", duration > 0 ? (double) sentCount.get() / (duration / 1000.0) : 0);
        response.put("sampleMessageIds", uniqueIds.subList(0, Math.min(20, uniqueIds.size())));
        
        return Result.success(response);
    }
    
    @GetMapping("/stats")
    public Result<?> getMessageStats() {
        Map<String, Object> response = new HashMap<>();
        response.put("demo", messageListener.getStatistics("demo").toMap());
        response.put("order", messageListener.getStatistics("order").toMap());
        response.put("traceId", TraceContext.getTraceId());
        return Result.success(response);
    }
    
    @PostMapping("/stats/reset")
    public Result<?> resetMessageStats(@RequestParam(required = false) String type) {
        if (type == null || "all".equalsIgnoreCase(type)) {
            messageListener.resetStatistics("demo");
            messageListener.resetStatistics("order");
        } else {
            messageListener.resetStatistics(type.toLowerCase());
        }
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Statistics reset for: " + (type == null ? "all" : type));
        response.put("traceId", TraceContext.getTraceId());
        return Result.success(response);
    }
}
