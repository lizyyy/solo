package com.pottery.kilnqueue.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public class QueueRequestDTO {
    @NotBlank(message = "幂等键不能为空")
    private String idempotencyKey;

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "作品编号不能为空")
    private String workNo;

    private String workName;

    @NotBlank(message = "学员编号不能为空")
    private String studentNo;

    private String studentName;

    private String studentPhone;

    private Boolean isThickBody = false;

    private BigDecimal width;
    private BigDecimal height;
    private BigDecimal depth;

    private String glazeCodes;

    private String description;

    private String operator;

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getWorkNo() { return workNo; }
    public void setWorkNo(String workNo) { this.workNo = workNo; }
    public String getWorkName() { return workName; }
    public void setWorkName(String workName) { this.workName = workName; }
    public String getStudentNo() { return studentNo; }
    public void setStudentNo(String studentNo) { this.studentNo = studentNo; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getStudentPhone() { return studentPhone; }
    public void setStudentPhone(String studentPhone) { this.studentPhone = studentPhone; }
    public Boolean getIsThickBody() { return isThickBody; }
    public void setIsThickBody(Boolean isThickBody) { this.isThickBody = isThickBody; }
    public BigDecimal getWidth() { return width; }
    public void setWidth(BigDecimal width) { this.width = width; }
    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }
    public BigDecimal getDepth() { return depth; }
    public void setDepth(BigDecimal depth) { this.depth = depth; }
    public String getGlazeCodes() { return glazeCodes; }
    public void setGlazeCodes(String glazeCodes) { this.glazeCodes = glazeCodes; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
