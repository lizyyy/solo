package com.grayscale.rollback.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "rollback.system")
@Data
public class RollbackSystemConfig {
    
    private List<Integer> canaryStages = List.of(10, 30, 50, 100);
    
    private Integer stageWaitSeconds = 60;
    
    private Integer lockTimeoutSeconds = 30;
    
    private Integer idempotentTtlSeconds = 86400;
    
    private Integer cacheTtlSeconds = 300;
}
