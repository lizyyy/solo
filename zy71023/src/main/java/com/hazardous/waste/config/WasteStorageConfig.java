package com.hazardous.waste.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "waste.storage")
public class WasteStorageConfig {
    private int maxStorageDays = 90;
    private List<String> allowedCategories;

    public int getMaxStorageDays() { return maxStorageDays; }
    public void setMaxStorageDays(int maxStorageDays) { this.maxStorageDays = maxStorageDays; }
    public List<String> getAllowedCategories() { return allowedCategories; }
    public void setAllowedCategories(List<String> allowedCategories) { this.allowedCategories = allowedCategories; }
}
