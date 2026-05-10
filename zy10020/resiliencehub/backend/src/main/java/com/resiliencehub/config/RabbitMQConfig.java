package com.resiliencehub.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {
    
    public static final String DEMO_EXCHANGE = "resiliencehub.demo.exchange";
    public static final String DEMO_QUEUE = "resiliencehub.demo.queue";
    public static final String DEMO_ROUTING_KEY = "demo.message";
    
    public static final String ORDER_EXCHANGE = "resiliencehub.order.exchange";
    public static final String ORDER_QUEUE = "resiliencehub.order.queue";
    public static final String ORDER_ROUTING_KEY = "order.created";
    
    @Bean
    public DirectExchange demoExchange() {
        return ExchangeBuilder
            .directExchange(DEMO_EXCHANGE)
            .durable(true)
            .build();
    }
    
    @Bean
    public Queue demoQueue() {
        return QueueBuilder
            .durable(DEMO_QUEUE)
            .withArgument("x-dead-letter-exchange", DEMO_EXCHANGE + ".dlx")
            .withArgument("x-dead-letter-routing-key", "dead.letter")
            .build();
    }
    
    @Bean
    public Binding demoBinding(Queue demoQueue, DirectExchange demoExchange) {
        return BindingBuilder
            .bind(demoQueue)
            .to(demoExchange)
            .with(DEMO_ROUTING_KEY);
    }
    
    @Bean
    public DirectExchange orderExchange() {
        return ExchangeBuilder
            .directExchange(ORDER_EXCHANGE)
            .durable(true)
            .build();
    }
    
    @Bean
    public Queue orderQueue() {
        return QueueBuilder
            .durable(ORDER_QUEUE)
            .withArgument("x-dead-letter-exchange", ORDER_EXCHANGE + ".dlx")
            .withArgument("x-dead-letter-routing-key", "dead.letter")
            .build();
    }
    
    @Bean
    public Binding orderBinding(Queue orderQueue, DirectExchange orderExchange) {
        return BindingBuilder
            .bind(orderQueue)
            .to(orderExchange)
            .with(ORDER_ROUTING_KEY);
    }
    
    @Bean
    public DirectExchange demoDeadLetterExchange() {
        return ExchangeBuilder
            .directExchange(DEMO_EXCHANGE + ".dlx")
            .durable(true)
            .build();
    }
    
    @Bean
    public Queue demoDeadLetterQueue() {
        return QueueBuilder
            .durable(DEMO_QUEUE + ".dlq")
            .build();
    }
    
    @Bean
    public Binding demoDeadLetterBinding(Queue demoDeadLetterQueue, DirectExchange demoDeadLetterExchange) {
        return BindingBuilder
            .bind(demoDeadLetterQueue)
            .to(demoDeadLetterExchange)
            .with("dead.letter");
    }
    
    @Bean
    public Jackson2JsonMessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
    
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, 
                                          Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack && correlationData != null) {
                System.err.println("Message NACK: " + correlationData.getId());
            }
        });
        template.setReturnsCallback(returned -> {
            System.err.println("Message returned: " + returned.getMessage() + 
                             ", routingKey: " + returned.getRoutingKey());
        });
        return template;
    }
    
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter messageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setConcurrentConsumers(5);
        factory.setMaxConcurrentConsumers(20);
        factory.setPrefetchCount(10);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        return factory;
    }
}
