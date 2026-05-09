package com.resiliencehub.message;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class MessageService {
    
    private final RabbitTemplate rabbitTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final Map<String, MessageConsumer> consumers = new ConcurrentHashMap<>();
    private final Map<String, MessageFaultConfig> faultConfigs = new ConcurrentHashMap<>();
    
    public MessageService(RabbitTemplate rabbitTemplate, RedisTemplate<String, Object> redisTemplate) {
        this.rabbitTemplate = rabbitTemplate;
        this.redisTemplate = redisTemplate;
    }
    
    public String sendMessage(String exchange, String routingKey, Object payload) {
        return sendMessage(exchange, routingKey, payload, new MessageOptions());
    }
    
    public String sendMessage(String exchange, String routingKey, Object payload, MessageOptions options) {
        String messageId = options.getMessageId() != null ? options.getMessageId() : UUID.randomUUID().toString();
        
        String jsonPayload = serializePayload(payload);
        
        MessageProperties properties = new MessageProperties();
        properties.setMessageId(messageId);
        properties.setTimestamp(java.sql.Timestamp.valueOf(LocalDateTime.now()));
        properties.setContentType("application/json");
        if (options.getExpiration() != null) {
            properties.setExpiration(options.getExpiration().toString());
        }
        if (options.getRetryCount() != null) {
            properties.setHeader("retry-count", options.getRetryCount());
        }
        if (options.getTraceId() != null) {
            properties.setHeader("traceId", options.getTraceId());
        }
        
        Message message = MessageBuilder
            .withBody(jsonPayload.getBytes(StandardCharsets.UTF_8))
            .andProperties(properties)
            .build();
        
        CorrelationData correlationData = new CorrelationData(messageId);
        
        try {
            rabbitTemplate.send(exchange, routingKey, message, correlationData);
            return messageId;
        } catch (Exception e) {
            if (options.isRetryOnFailure()) {
                return retrySend(exchange, routingKey, payload, options, 1);
            }
            throw new MessageException("Failed to send message", e);
        }
    }
    
    private String retrySend(String exchange, String routingKey, Object payload, 
                              MessageOptions options, int attempt) {
        if (attempt > options.getMaxRetries()) {
            throw new MessageException("Failed to send message after " + attempt + " retries");
        }
        
        try {
            Thread.sleep(options.getRetryDelayMs() * attempt);
            options.setRetryCount(attempt);
            return sendMessage(exchange, routingKey, payload, options);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MessageException("Retry interrupted", e);
        }
    }
    
    public void registerConsumer(String queueName, MessageConsumer consumer) {
        consumers.put(queueName, consumer);
    }
    
    public boolean isDuplicateMessage(String messageId) {
        String key = "message:dedup:" + messageId;
        Boolean exists = redisTemplate.hasKey(key);
        if (Boolean.TRUE.equals(exists)) {
            return true;
        }
        redisTemplate.opsForValue().set(key, System.currentTimeMillis(), 24, TimeUnit.HOURS);
        return false;
    }
    
    public void configureMessageFault(String queueName, MessageFaultConfig config) {
        faultConfigs.put(queueName, config);
    }
    
    public MessageFaultConfig getMessageFaultConfig(String queueName) {
        return faultConfigs.get(queueName);
    }
    
    public void processMessage(String queueName, String messageId, Object payload) {
        MessageFaultConfig faultConfig = faultConfigs.get(queueName);
        
        if (faultConfig != null) {
            applyMessageFaults(faultConfig, messageId);
        }
        
        if (isDuplicateMessage(messageId)) {
            throw new DuplicateMessageException("Duplicate message detected: " + messageId);
        }
        
        MessageConsumer consumer = consumers.get(queueName);
        if (consumer != null) {
            consumer.consume(payload);
        }
    }
    
    private void applyMessageFaults(MessageFaultConfig config, String messageId) {
        AtomicInteger retryCount = new AtomicInteger(0);
        String retryKey = "message:retry:" + messageId;
        Object existingCount = redisTemplate.opsForValue().get(retryKey);
        if (existingCount != null) {
            retryCount.set(Integer.parseInt(existingCount.toString()));
        }
        
        if (config.isForceFail()) {
            redisTemplate.opsForValue().set(retryKey, retryCount.incrementAndGet(), 1, TimeUnit.HOURS);
            throw new MessageException("Forced message failure");
        }
        
        if (config.getRetryProbability() > 0) {
            if (retryCount.get() < config.getMaxRetryCount() && 
                Math.random() < config.getRetryProbability()) {
                redisTemplate.opsForValue().set(retryKey, retryCount.incrementAndGet(), 1, TimeUnit.HOURS);
                throw new MessageRetryException("Simulating message retry, attempt: " + retryCount.get());
            }
        }
        
        if (config.getDuplicateProbability() > 0) {
            if (Math.random() < config.getDuplicateProbability()) {
                throw new DuplicateMessageException("Simulating duplicate message");
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
    
    private String serializePayload(Object payload) {
        if (payload instanceof String) {
            return (String) payload;
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(payload);
        } catch (Exception e) {
            return payload.toString();
        }
    }
    
    public interface MessageConsumer {
        void consume(Object payload) throws Exception;
    }
    
    public static class MessageOptions {
        private String messageId;
        private Integer retryCount = 0;
        private Integer maxRetries = 3;
        private long retryDelayMs = 1000;
        private boolean retryOnFailure = true;
        private Long expiration;
        private String traceId;
        
        public String getMessageId() { return messageId; }
        public void setMessageId(String messageId) { this.messageId = messageId; }
        public Integer getRetryCount() { return retryCount; }
        public void setRetryCount(Integer retryCount) { this.retryCount = retryCount; }
        public Integer getMaxRetries() { return maxRetries; }
        public void setMaxRetries(Integer maxRetries) { this.maxRetries = maxRetries; }
        public long getRetryDelayMs() { return retryDelayMs; }
        public void setRetryDelayMs(long retryDelayMs) { this.retryDelayMs = retryDelayMs; }
        public boolean isRetryOnFailure() { return retryOnFailure; }
        public void setRetryOnFailure(boolean retryOnFailure) { this.retryOnFailure = retryOnFailure; }
        public Long getExpiration() { return expiration; }
        public void setExpiration(Long expiration) { this.expiration = expiration; }
        public String getTraceId() { return traceId; }
        public void setTraceId(String traceId) { this.traceId = traceId; }
    }
    
    public static class MessageFaultConfig {
        private String queueName;
        private boolean forceFail = false;
        private double retryProbability = 0.0;
        private int maxRetryCount = 3;
        private double duplicateProbability = 0.0;
        private long delayMs = 0;
        private double processingErrorProbability = 0.0;
        
        public String getQueueName() { return queueName; }
        public void setQueueName(String queueName) { this.queueName = queueName; }
        public boolean isForceFail() { return forceFail; }
        public void setForceFail(boolean forceFail) { this.forceFail = forceFail; }
        public double getRetryProbability() { return retryProbability; }
        public void setRetryProbability(double retryProbability) { this.retryProbability = retryProbability; }
        public int getMaxRetryCount() { return maxRetryCount; }
        public void setMaxRetryCount(int maxRetryCount) { this.maxRetryCount = maxRetryCount; }
        public double getDuplicateProbability() { return duplicateProbability; }
        public void setDuplicateProbability(double duplicateProbability) { this.duplicateProbability = duplicateProbability; }
        public long getDelayMs() { return delayMs; }
        public void setDelayMs(long delayMs) { this.delayMs = delayMs; }
        public double getProcessingErrorProbability() { return processingErrorProbability; }
        public void setProcessingErrorProbability(double processingErrorProbability) { this.processingErrorProbability = processingErrorProbability; }
    }
    
    public static class MessageException extends RuntimeException {
        public MessageException(String message) { super(message); }
        public MessageException(String message, Throwable cause) { super(message, cause); }
    }
    
    public static class MessageRetryException extends MessageException {
        public MessageRetryException(String message) { super(message); }
    }
    
    public static class DuplicateMessageException extends MessageException {
        public DuplicateMessageException(String message) { super(message); }
    }
}
