package com.manufacture.outsourcing.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "operation_logs", indexes = {
    @Index(name = "idx_log_entity", columnList = "entityType, entityId"),
    @Index(name = "idx_log_operator", columnList = "operator"),
    @Index(name = "idx_log_created", columnList = "createdAt")
})
@EntityListeners(AuditingEntityListener.class)
public class OperationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String entityType;

    @Column(nullable = false)
    private Long entityId;

    @Column(length = 100)
    private String entityNo;

    @Column(length = 50)
    private String operator;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(length = 20)
    private String fromStatus;

    @Column(length = 20)
    private String toStatus;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(length = 200)
    private String summary;

    @Column(nullable = false)
    private Boolean success;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "LONGTEXT")
    private String beforeData;

    @Column(columnDefinition = "LONGTEXT")
    private String afterData;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 500)
    private String requestTrace;

    public static final String ENTITY_ORDER = "外协订单";
    public static final String ENTITY_BATCH = "到货批次";
    public static final String ENTITY_INSPECTION = "验收记录";
    public static final String ENTITY_DEDUCTION = "扣款记录";
    public static final String ENTITY_REPLENISHMENT = "补货任务";
    public static final String ENTITY_SUPPLIER = "供应商";
    public static final String ENTITY_RULE = "扣款规则";

    public static final String ACTION_CREATE = "创建";
    public static final String ACTION_UPDATE = "更新";
    public static final String ACTION_SUBMIT = "提交";
    public static final String ACTION_APPROVE = "审批";
    public static final String ACTION_REJECT = "驳回";
    public static final String ACTION_CONFIRM = "确认";
    public static final String ACTION_CANCEL = "取消";
    public static final String ACTION_COMPLETE = "完成";
    public static final String ACTION_RETRY = "重试";
    public static final String ACTION_ROLLBACK = "回滚";
    public static final String ACTION_NOTIFY = "通知";
    public static final String ACTION_COMPENSATION = "补偿处理";
}
