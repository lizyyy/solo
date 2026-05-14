package com.manufacture.outsourcing.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "inspection_results")
@EntityListeners(AuditingEntityListener.class)
public class InspectionResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String resultNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private DeliveryBatch batch;

    @Column(nullable = false, length = 50)
    private String inspector;

    @Column(nullable = false)
    private LocalDateTime inspectionTime;

    @Column(precision = 18, scale = 2)
    private BigDecimal sampleQuantity;

    @Column(precision = 18, scale = 2)
    private BigDecimal qualifiedSample;

    @Column(precision = 18, scale = 2)
    private BigDecimal qualifiedQuantity;

    @Column(precision = 18, scale = 2)
    private BigDecimal unqualifiedQuantity;

    @Column(length = 20)
    private String inspectionConclusion;

    @Column(columnDefinition = "TEXT")
    private String defectDescription;

    @Column(columnDefinition = "TEXT")
    private String inspectionRemark;

    @Column(length = 20)
    private String processingSuggestion;

    @Column(length = 20)
    private String resultStatus;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(length = 50)
    private String compensationStep;

    @Column(columnDefinition = "TEXT")
    private String compensationError;

    @Column
    private Integer compensationRetryCount = 0;

    public static final String CONCLUSION_QUALIFIED = "合格";
    public static final String CONCLUSION_UNQUALIFIED = "不合格";
    public static final String CONCLUSION_PARTIAL = "让步接收";

    public static final String SUGGESTION_ACCEPT = "直接入库";
    public static final String SUGGESTION_DEDUCTION = "扣款接收";
    public static final String SUGGESTION_RETURN = "退货";
    public static final String SUGGESTION_REPLENISH = "要求补货";
    public static final String SUGGESTION_REWORK = "返工后复检";

    public static final String STATUS_PENDING = "待确认";
    public static final String STATUS_CONFIRMED = "已确认";
    public static final String STATUS_RECALLED = "已撤回";
    public static final String STATUS_COMPENSATION_FAILED = "补偿失败";
    public static final String STATUS_COMPENSATION_RETRY = "待重试补偿";
    public static final String STATUS_COMPLETED = "已完成";

    public static final String STEP_NONE = "未开始";
    public static final String STEP_DEDUCTION_CREATE = "创建扣款记录";
    public static final String STEP_DEDUCTION_APPROVE = "扣款审批";
    public static final String STEP_DEDUCTION_EXECUTE = "扣款执行";
    public static final String STEP_REPLENISH_CREATE = "创建补货任务";
    public static final String STEP_REPLENISH_NOTIFY = "通知供应商";
    public static final String STEP_REPLENISH_WAIT = "等待供应商确认";
    public static final String STEP_COMPLETED = "补偿完成";
}
