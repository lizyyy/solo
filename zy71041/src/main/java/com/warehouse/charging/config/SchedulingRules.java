package com.warehouse.charging.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "charging.scheduling")
public class SchedulingRules {
    private int lowBatteryThreshold = 20;
    private int criticalBatteryThreshold = 10;
    private int maxWaitingMinutes = 30;
    private boolean enablePreemption = true;
    private boolean taskCompletionRequired = true;
    private int morningRushHourStart = 6;
    private int morningRushHourEnd = 10;

    public int getLowBatteryThreshold() { return lowBatteryThreshold; }
    public void setLowBatteryThreshold(int lowBatteryThreshold) { this.lowBatteryThreshold = lowBatteryThreshold; }
    public int getCriticalBatteryThreshold() { return criticalBatteryThreshold; }
    public void setCriticalBatteryThreshold(int criticalBatteryThreshold) { this.criticalBatteryThreshold = criticalBatteryThreshold; }
    public int getMaxWaitingMinutes() { return maxWaitingMinutes; }
    public void setMaxWaitingMinutes(int maxWaitingMinutes) { this.maxWaitingMinutes = maxWaitingMinutes; }
    public boolean isEnablePreemption() { return enablePreemption; }
    public void setEnablePreemption(boolean enablePreemption) { this.enablePreemption = enablePreemption; }
    public boolean isTaskCompletionRequired() { return taskCompletionRequired; }
    public void setTaskCompletionRequired(boolean taskCompletionRequired) { this.taskCompletionRequired = taskCompletionRequired; }
    public int getMorningRushHourStart() { return morningRushHourStart; }
    public void setMorningRushHourStart(int morningRushHourStart) { this.morningRushHourStart = morningRushHourStart; }
    public int getMorningRushHourEnd() { return morningRushHourEnd; }
    public void setMorningRushHourEnd(int morningRushHourEnd) { this.morningRushHourEnd = morningRushHourEnd; }
}
