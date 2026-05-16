package com.diagnostic.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "diagnostic.leak")
public class DiagnosticProperties {
    private Threshold threshold = new Threshold();
    private Archive archive = new Archive();

    @Data
    public static class Threshold {
        private int activeConnection = 80;
        private int connectionUsageTime = 300;
        private int consecutiveSamples = 3;
    }

    @Data
    public static class Archive {
        private int retentionDays = 30;
        private int sampleIntervalMinutes = 5;
    }
}