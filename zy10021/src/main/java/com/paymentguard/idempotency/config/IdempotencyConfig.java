package com.paymentguard.idempotency.config;

import com.paymentguard.idempotency.filter.IdempotencyFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class IdempotencyConfig {

    @Bean
    public FilterRegistrationBean<IdempotencyFilter> idempotencyFilterRegistration(IdempotencyFilter filter) {
        FilterRegistrationBean<IdempotencyFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(filter);
        registration.addUrlPatterns("/api/payments/*", "/api/orders/*");
        registration.setName("idempotencyFilter");
        registration.setOrder(2);
        return registration;
    }
}
