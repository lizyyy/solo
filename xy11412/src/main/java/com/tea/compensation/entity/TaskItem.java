package com.tea.compensation.entity;

import com.tea.compensation.enums.TaskStatus;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "task_item", indexes = {
    @Index(name = "idx_task_id", columnList = "taskId"),
    @Index(name = "idx_item_no", columnList = "itemNo"),
    @Index(name = "idx_status", columnList = "status")
})
public class TaskItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    @Column(nullable = false, length = 64)
    private String batchNo;

    @Column(nullable = false, length = 64)
    private String itemNo;

    @Column(nullable = false, length = 100)
    private String materialName;

    @Column(length = 32)
    private String materialCode;

    @Column(precision = 15, scale = 2)
    private BigDecimal quantity;

    @Column(length = 16)
    private String unit;

    @Column(precision = 15, scale = 4)
    private BigDecimal unitPrice;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TaskStatus status;

    @Column(length = 500)
    private String failReason;

    @Column(length = 128)
    private String externalId;

    @Column(length = 2000)
    private String remark;

    @Column(length = 64)
    private String creator;

    @Column(length = 64)
    private String lastModifier;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;
}
