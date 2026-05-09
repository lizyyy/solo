package com.paymentguard.simulator.scenario;

import com.paymentguard.common.dto.PaymentCallbackRequest;
import com.paymentguard.common.util.JsonUtil;
import com.paymentguard.tracing.util.TraceContext;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageQueueService {

    public static final String EXCHANGE = "payment.callback.exchange";
    public static final String QUEUE = "payment.callback.queue";
    public static final String DLQ = "payment.callback.dlq";
    public static final String ROUTING_KEY = "payment.callback";

    private final RabbitTemplate rabbitTemplate;
    private final Map<String, MessageProcessingRecord> processingRecords = new ConcurrentHashMap<>();
    private final AtomicInteger totalDeliveries = new AtomicInteger(0);
    private final AtomicInteger successfulProcessings = new AtomicInteger(0);
    private final AtomicInteger failedProcessings = new AtomicInteger(0);

    public void sendCallbackMessage(PaymentCallbackRequest request, String traceId) {
        String messageId = request.getTransactionId() + "_" + System.currentTimeMillis();
        
        MessageProcessingRecord record = MessageProcessingRecord.builder()
                .messageId(messageId)
                .transactionId(request.getTransactionId())
                .orderId(request.getOrderId())
                .traceId(traceId)
                .deliveryCount(0)
                .sentAt(System.currentTimeMillis())
                .build();
        processingRecords.put(messageId, record);
        
        rabbitTemplate.convertAndSend(EXCHANGE, ROUTING_KEY, request, message -> {
            MessageProperties props = message.getMessageProperties();
            props.setMessageId(messageId);
            props.setHeader("X-Trace-Id", traceId);
            props.setHeader("X-Transaction-Id", request.getTransactionId());
            return message;
        });
        
        log.info("Message sent to queue: messageId={}, transactionId={}, traceId={}",
                messageId, request.getTransactionId(), traceId);
    }

    @RabbitListener(queues = QUEUE)
    public void processCallbackMessage(PaymentCallbackRequest request, 
                                        com.rabbitmq.client.Channel channel,
                                        org.springframework.amqp.core.Message message) throws Exception {
        String messageId = message.getMessageProperties().getMessageId();
        String traceId = (String) message.getMessageProperties().getHeaders().get("X-Trace-Id");
        
        TraceContext.initContext(traceId);
        totalDeliveries.incrementAndGet();
        
        MessageProcessingRecord record = processingRecords.computeIfAbsent(messageId, 
                k -> MessageProcessingRecord.builder()
                        .messageId(k)
                        .deliveryCount(0)
                        .build());
        record.incrementDeliveryCount();
        
        log.info("Processing message: messageId={}, deliveryCount={}, transactionId={}, traceId={}",
                messageId, record.getDeliveryCount(), request.getTransactionId(), traceId);
        
        try {
            if (shouldSimulateRedelivery(record)) {
                log.info("Simulating message redelivery: messageId={}, deliveryCount={}",
                        messageId, record.getDeliveryCount());
                throw new RuntimeException("Simulated processing failure for redelivery test");
            }
            
            if (record.getDeliveryCount() > 1) {
                record.setRedelivered(true);
            }
            
            successfulProcessings.incrementAndGet();
            record.setProcessedAt(System.currentTimeMillis());
            record.setStatus("SUCCESS");
            
            channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
            log.info("Message processed successfully: messageId={}", messageId);
        } catch (Exception e) {
            failedProcessings.incrementAndGet();
            record.setStatus("FAILED");
            record.setErrorMessage(e.getMessage());
            
            if (record.getDeliveryCount() >= 3) {
                log.warn("Message failed after max retries, sending to DLQ: messageId={}", messageId);
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false);
            } else {
                log.warn("Message processing failed, will be redelivered: messageId={}, error={}",
                        messageId, e.getMessage());
                channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true);
            }
            throw e;
        } finally {
            TraceContext.clearContext();
        }
    }

    @RabbitListener(queues = DLQ)
    public void processDeadLetterMessage(org.springframework.amqp.core.Message message) {
        String messageId = message.getMessageProperties().getMessageId();
        log.warn("Message received in DLQ: messageId={}", messageId);
        
        MessageProcessingRecord record = processingRecords.get(messageId);
        if (record != null) {
            record.setStatus("DEAD_LETTER");
            record.setDeadLetteredAt(System.currentTimeMillis());
        }
    }

    private boolean shouldSimulateRedelivery(MessageProcessingRecord record) {
        return record.getDeliveryCount() < 2;
    }

    public MessageProcessingRecord getRecord(String messageId) {
        return processingRecords.get(messageId);
    }

    public MessageQueueStats getStats() {
        return MessageQueueStats.builder()
                .totalDeliveries(totalDeliveries.get())
                .successfulProcessings(successfulProcessings.get())
                .failedProcessings(failedProcessings.get())
                .totalMessages(processingRecords.size())
                .build();
    }

    @Configuration
    public static class MessageQueueConfig {

        @Bean
        public DirectExchange exchange() {
            return new DirectExchange(EXCHANGE, true, false);
        }

        @Bean
        public Queue queue() {
            return QueueBuilder.durable(QUEUE)
                    .deadLetterExchange(EXCHANGE)
                    .deadLetterRoutingKey(DLQ)
                    .build();
        }

        @Bean
        public Queue deadLetterQueue() {
            return QueueBuilder.durable(DLQ).build();
        }

        @Bean
        public Binding binding(Queue queue, DirectExchange exchange) {
            return BindingBuilder.bind(queue).to(exchange).with(ROUTING_KEY);
        }

        @Bean
        public Binding dlqBinding(Queue deadLetterQueue, DirectExchange exchange) {
            return BindingBuilder.bind(deadLetterQueue).to(exchange).with(DLQ);
        }
    }

    @Data
    @Builder
    public static class MessageProcessingRecord {
        private String messageId;
        private String transactionId;
        private String orderId;
        private String traceId;
        private AtomicInteger deliveryCount;
        private boolean redelivered;
        private String status;
        private String errorMessage;
        private Long sentAt;
        private Long processedAt;
        private Long deadLetteredAt;

        public void incrementDeliveryCount() {
            if (this.deliveryCount == null) {
                this.deliveryCount = new AtomicInteger(0);
            }
            this.deliveryCount.incrementAndGet();
        }

        public int getDeliveryCount() {
            return this.deliveryCount != null ? this.deliveryCount.get() : 0;
        }
    }

    @Data
    @Builder
    public static class MessageQueueStats {
        private int totalDeliveries;
        private int successfulProcessings;
        private int failedProcessings;
        private int totalMessages;
    }
}
