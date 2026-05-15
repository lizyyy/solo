package com.portinspector.model;

import java.time.LocalDateTime;
import java.util.Map;

public class InspectionSample {
    private String sampleId;
    private String batchId;
    private String sourceFile;
    private int rowNumber;
    private String ipAddress;
    private int port;
    private String protocol;
    private String processName;
    private int connectionCount;
    private String supplier;
    private String supplierOriginal;
    private String supplierCorrected;
    private String department;
    private String businessLine;
    private LocalDateTime inspectionTime;
    private Map<String, Object> rawData;

    public InspectionSample() {}

    public String getSampleId() { return sampleId; }
    public void setSampleId(String sampleId) { this.sampleId = sampleId; }
    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public String getSourceFile() { return sourceFile; }
    public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
    public int getRowNumber() { return rowNumber; }
    public void setRowNumber(int rowNumber) { this.rowNumber = rowNumber; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    public String getProtocol() { return protocol; }
    public void setProtocol(String protocol) { this.protocol = protocol; }
    public String getProcessName() { return processName; }
    public void setProcessName(String processName) { this.processName = processName; }
    public int getConnectionCount() { return connectionCount; }
    public void setConnectionCount(int connectionCount) { this.connectionCount = connectionCount; }
    public String getSupplier() { return supplier; }
    public void setSupplier(String supplier) { this.supplier = supplier; }
    public String getSupplierOriginal() { return supplierOriginal; }
    public void setSupplierOriginal(String supplierOriginal) { this.supplierOriginal = supplierOriginal; }
    public String getSupplierCorrected() { return supplierCorrected; }
    public void setSupplierCorrected(String supplierCorrected) { this.supplierCorrected = supplierCorrected; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getBusinessLine() { return businessLine; }
    public void setBusinessLine(String businessLine) { this.businessLine = businessLine; }
    public LocalDateTime getInspectionTime() { return inspectionTime; }
    public void setInspectionTime(LocalDateTime inspectionTime) { this.inspectionTime = inspectionTime; }
    public Map<String, Object> getRawData() { return rawData; }
    public void setRawData(Map<String, Object> rawData) { this.rawData = rawData; }
}
