package com.portinspector.model;

import java.util.List;
import java.util.Map;

public class PortInspectionRule {
    private String version;
    private Map<String, RiskLevel> portRanges;
    private List<Integer> reservedPorts;
    private int thresholdConnections;
    private String description;

    public PortInspectionRule() {}

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public Map<String, RiskLevel> getPortRanges() { return portRanges; }
    public void setPortRanges(Map<String, RiskLevel> portRanges) { this.portRanges = portRanges; }
    public List<Integer> getReservedPorts() { return reservedPorts; }
    public void setReservedPorts(List<Integer> reservedPorts) { this.reservedPorts = reservedPorts; }
    public int getThresholdConnections() { return thresholdConnections; }
    public void setThresholdConnections(int thresholdConnections) { this.thresholdConnections = thresholdConnections; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
