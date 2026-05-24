package com.airport.baggage.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

@Configuration
@ConfigurationProperties(prefix = "compensation.rules")
public class CompensationRulesConfig {
    private BigDecimal maxAmount = new BigDecimal("1500");
    private BigDecimal minAmount = new BigDecimal("100");
    private int duplicateCheckDays = 30;

    public BigDecimal getMaxAmount() { return maxAmount; }
    public void setMaxAmount(BigDecimal maxAmount) { this.maxAmount = maxAmount; }
    public BigDecimal getMinAmount() { return minAmount; }
    public void setMinAmount(BigDecimal minAmount) { this.minAmount = minAmount; }
    public int getDuplicateCheckDays() { return duplicateCheckDays; }
    public void setDuplicateCheckDays(int duplicateCheckDays) { this.duplicateCheckDays = duplicateCheckDays; }
}
