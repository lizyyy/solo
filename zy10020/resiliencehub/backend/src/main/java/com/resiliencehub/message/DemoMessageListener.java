package com.resiliencehub.message;

import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class DemoMessageListener {
    
    private static final Logger log = LoggerFactory.getLogger(DemoMessageListener.class);
    
    private final MessageService messageService;
    private final RedisTemplate<String, Object> redisTemplate;
    
    private final Map<String, MessageStatistics> stats = new ConcurrentHashMap<>();
    
    @Autowired
    public DemoMessageListener(MessageService messageService, 
                               RedisTemplate<String, Object> redisTemplate) {
        this.messageService = messageService;
        this.redisTemplate = redisTemplate;
        this.stats.put("demo", new MessageStatistics());
        this.stats.put("order", new MessageStatistics());
    }
    
    @RabbitListener(queues = "resiliencehub.demo.queue")
    public void onDemoMessage(@Payload Object payload,
                               Channel channel,
                               @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag,
                               @Header(value = "amqp_receivedMessageId", required = false) String messageId,
                               @Header(value = "retry-count", defaultValue = "0") Integer retryCount) {
        processMessage("demo", "resiliencehub.demo.queue", payload, channel, deliveryTag, messageId, retryCount);
    }
    
    @RabbitListener(queues = "resiliencehub.order.queue")
    public void onOrderMessage(@Payload Object payload,
                                Channel channel,
                                @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag,
                                @Header(value = "amqp_receivedMessageId", required = false) String messageId,
                                @Header(value = "retry-count", defaultValue = "0") Integer retryCount) {
        processMessage("order", "resiliencehub.order.queue", payload, channel, deliveryTag, messageId, retryCount);
    }
    
    private void processMessage(String type, String queueName, Object payload,
                                 Channel channel, long deliveryTag,
                                 String messageId, Integer retryCount) {
        MessageStatistics stat = stats.get(type);
        stat.totalReceived.incrementAndGet();
        
        String effectiveMessageId = messageId != null ? messageId : "msg-" + System.currentTimeMillis();
        
        log.info("[{}] Processing message: messageId={}, retryCount={}, payload={}", 
                 type, effectiveMessageId, retryCount, payload);
        
        try {
            MessageService.MessageFaultConfig faultConfig = messageService.getMessageFaultConfig(queueName);
            
            if (faultConfig != null) {
                applyMessageFaults(faultConfig, effectiveMessageId, retryCount, stat);
            }
            
            if (messageService.isDuplicateMessage(effectiveMessageId)) {
                stat.duplicateMessages.incrementAndGet();
                log.warn("[{}] Duplicate message detected: {}", type, effectiveMessageId);
                channel.basicAck(deliveryTag, false);
                return;
            }
            
            if (payload instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> payloadMap = (Map<String, Object>) payload;
                if (Boolean.TRUE.equals(payloadMap.get("simulateFailure"))) {
                    throw new RuntimeException("Simulated message processing failure");
                }
            }
            
            Thread.sleep(10 + (long)(Math.random() * 20));
            
            stat.processedSuccessfully.incrementAndGet();
            stat.lastProcessTime.set(System.currentTimeMillis());
            channel.basicAck(deliveryTag, false);
            log.info("[{}] Message processed successfully: {}", type, effectiveMessageId);
            
        } catch (MessageService.MessageRetryException e) {
            stat.retryMessages.incrementAndGet();
            log.warn("[{}] Message will be retried: {}, attempt: {}", type, effectiveMessageId, e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, true);
            } catch (Exception ex) {
                log.error("[{}] Failed to nack message: {}", type, effectiveMessageId, ex);
            }
        } catch (MessageService.DuplicateMessageException e) {
            stat.duplicateMessages.incrementAndGet();
            log.warn("[{}] Duplicate message (simulated): {}", type, effectiveMessageId);
            try {
                channel.basicAck(deliveryTag, false);
            } catch (Exception ex) {
                log.error("[{}] Failed to ack duplicate message: {}", type, effectiveMessageId, ex);
            }
        } catch (MessageService.MessageException e) {
            stat.failedMessages.incrementAndGet();
            log.error("[{}] Message failed (forced): {}", type, effectiveMessageId, e);
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception ex) {
                log.error("[{}] Failed to move message to DLQ: {}", type, effectiveMessageId, ex);
            }
        } catch (Exception e) {
            stat.failedMessages.incrementAndGet();
            log.error("[{}] Message processing failed: {}", type, effectiveMessageId, e);
            try {
                int maxRetries = 3;
                if (retryCount >= maxRetries) {
                    channel.basicNack(deliveryTag, false, false);
                    log.error("[{}] Message exhausted retries, moving to DLQ: {}", type, effectiveMessageId);
                } else {
                    channel.basicNack(deliveryTag, false, true);
                }
            } catch (Exception ex) {
                log.error("[{}] Failed to handle failed message: {}", type, effectiveMessageId, ex);
            }
        }
    }
    
    private void applyMessageFaults(MessageService.MessageFaultConfig config, 
                                     String messageId, 
                                     int retryCount,
                                     MessageStatistics stat) {
        String retryKey = "message:retry:" + messageId;
        Object existingCount = redisTemplate.opsForValue().get(retryKey);
        int currentRetryCount = existingCount != null ? 
            Integer.parseInt(existingCount.toString()) : retryCount;
        
        if (config.isForceFail()) {
            redisTemplate.opsForValue().set(retryKey, currentRetryCount + 1, 1, java.util.concurrent.TimeUnit.HOURS);
            throw new MessageService.MessageException("Forced message failure");
        }
        
        if (config.getRetryProbability() > 0) {
            if (currentRetryCount < config.getMaxRetryCount() && 
                Math.random() < config.getRetryProbability()) {
                redisTemplate.opsForValue().set(retryKey, currentRetryCount + 1, 1, java.util.concurrent.TimeUnit.HOURS);
                throw new MessageService.MessageRetryException("Simulating message retry, attempt: " + (currentRetryCount + 1));
            }
        }
        
        if (config.getDuplicateProbability() > 0) {
            if (Math.random() < config.getDuplicateProbability()) {
                throw new MessageService.DuplicateMessageException("Simulating duplicate message");
            }
        }
        
        if (config.getDelayMs() > 0) {
            try {
                Thread.sleep(config.getDelayMs());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
    
    public MessageStatistics getStatistics(String type) {
        return stats.getOrDefault(type, new MessageStatistics());
    }
    
    public void resetStatistics(String type) {
        stats.put(type, new MessageStatistics());
    }
    
    public static class MessageStatistics {
        public final AtomicLong totalReceived = new AtomicLong(0);
        public final AtomicLong processedSuccessfully = new AtomicLong(0);
        public final AtomicLong failedMessages = new AtomicLong(0);
        public final AtomicLong retryMessages = new AtomicLong(0);
        public final AtomicLong duplicateMessages = new AtomicLong(0);
        public final AtomicLong lastProcessTime = new AtomicLong(0);
        
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("totalReceived", totalReceived.get());
            map.put("processedSuccessfully", processedSuccessfully.get());
            map.put("failedMessages", failedMessages.get());
            map.put("retryMessages", retryMessages.get());
            map.put("duplicateMessages", duplicateMessages.get());
            map.put("lastProcessTime", lastProcessTime.get());
            return map;
        }
    }
}
