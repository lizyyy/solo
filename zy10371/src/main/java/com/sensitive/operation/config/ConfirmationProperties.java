package com.sensitive.operation.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.confirmation")
public class ConfirmationProperties {

    private int defaultExpireMinutes = 1440;
    private int highRiskExpireMinutes = 60;
    private int requiredConfirmers = 2;
}
