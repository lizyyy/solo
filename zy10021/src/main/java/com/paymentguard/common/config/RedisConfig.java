package com.paymentguard.common.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory,
                                                        ObjectMapper objectMapper) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        ObjectMapper redisObjectMapper = objectMapper.copy();
        redisObjectMapper.activateDefaultTyping(
                redisObjectMapper.getPolymorphicTypeValidator(),
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );
        
        Jackson2JsonRedisSerializer<Object> serializer = new Jackson2JsonRedisSerializer<>(redisObjectMapper, Object.class);
        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setValueSerializer(serializer);
        template.setHashValueSerializer(serializer);
        
        template.afterPropertiesSet();
        return template;
    }
}
