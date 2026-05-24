package com.cityops.batterydispatch.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppConfig {
    private BatteryConfig battery = new BatteryConfig();
    private DispatchConfig dispatch = new DispatchConfig();

    @Data
    public static class BatteryConfig {
        private int lowBatteryThreshold = 20;
    }

    @Data
    public static class DispatchConfig {
        private boolean photoRequired = true;
    }
}
