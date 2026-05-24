#!/bin/bash
set -e

BASE_DIR="/Users/lzy/pro/solo/workspaces/zy71005/src/main/java/com/ortho/rework"

# Create directories
mkdir -p "$BASE_DIR"/{enums,entity,dto,repository,service,controller,config}

echo "Creating source files..."

# 1. Enums
cat > "$BASE_DIR/enums/ReworkStatus.java" << 'JAVAEOF'
package com.ortho.rework.enums;
public enum ReworkStatus {
    CREATED("已创建"),
    RECEIVED("已收件"),
    INSPECTED("已核验"),
    PROCESSING("处理中"),
    DOCTOR_CONFIRMED("医生已确认"),
    REVIEWED("已复查"),
    SHIPPED("已寄出"),
    CLOSED("已结案"),
    CANCELLED("已取消"),
    LOST("快递丢失");
    private final String description;
    ReworkStatus(String description) { this.description = description; }
    public String getDescription() { return description; }
}
JAVAEOF

cat > "$BASE_DIR/enums/OperationType.java" << 'JAVAEOF'
package com.ortho.rework.enums;
public enum OperationType {
    CREATE_REWORK("创建返工单"),
    RECEIVE("收件登记"),
    INSPECT("到件核验"),
    TECHNICIAN_NOTE("技师备注"),
    DOCTOR_CONFIRM("医生确认"),
    START_PROCESSING("开始处理"),
    REVIEW("复查"),
    SHIP("寄出"),
    CLOSE("结案"),
    CANCEL("取消"),
    MARK_LOST("标记丢失"),
    EXPORT_REPORT("导出报告"),
    DUPLICATE_ATTEMPT("重复操作拦截");
    private final String description;
    OperationType(String description) { this.description = description; }
    public String getDescription() { return description; }
}
JAVAEOF

# 2. Entities
cat > "$BASE_DIR/entity/Patient.java" << 'JAVAEOF'
package com.ortho.rework.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@Entity
@Table(name = "patients")
public class Patient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String patientNo;
    @Column(nullable = false)
    private String name;
    private String phone;
    private String doctorName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
JAVAEOF

cat > "$BASE_DIR/entity/ImpressionBatch.java" << 'JAVAEOF'
package com.ortho.rework.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@Entity
@Table(name = "impression_batches")
public class ImpressionBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String batchNo;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;
    private String impressionType;
    private LocalDateTime productionDate;
    private String originalBatchNo;
    private Integer reworkCount = 0;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
JAVAEOF

cat > "$BASE_DIR/entity/ReworkOrder.java" << 'JAVAEOF'
package com.ortho.rework.entity;
import com.ortho.rework.enums.ReworkStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@Entity
@Table(name = "rework_orders")
public class ReworkOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String reworkNo;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ImpressionBatch batch;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReworkStatus status;
    private String reworkReason;
    private String technicianNote;
    private LocalDateTime technicianNoteTime;
    private String technicianName;
    private String doctorConfirmation;
    private LocalDateTime doctorConfirmationTime;
    private String doctorName;
    private LocalDateTime receivedTime;
    private String receivedBy;
    private LocalDateTime inspectionTime;
    private String inspectionResult;
    private String inspectionRemark;
    private String inspectionBy;
    private LocalDateTime processingStartTime;
    private String processingBy;
    private LocalDateTime reviewTime;
    private String reviewResult;
    private String reviewBy;
    private LocalDateTime shippedTime;
    private String shippedBy;
    private LocalDateTime closedTime;
    private String closedBy;
    private String closeReason;
    private Boolean isDuplicate = false;
    private String duplicateRemark;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
JAVAEOF

cat > "$BASE_DIR/entity/ExpressOrder.java" << 'JAVAEOF'
package com.ortho.rework.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@Entity
@Table(name = "express_orders")
public class ExpressOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String expressNo;
    private String expressCompany;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rework_order_id")
    private ReworkOrder reworkOrder;
    private String sender;
    private String senderPhone;
    private String receiver;
    private String receiverPhone;
    private LocalDateTime sentTime;
    private LocalDateTime receivedTime;
    private String status;
    private Boolean isLost = false;
    private String lostRemark;
    private LocalDateTime lostMarkTime;
    private String lostMarkBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
JAVAEOF

cat > "$BASE_DIR/entity/AuditLog.java" << 'JAVAEOF'
package com.ortho.rework.entity;
import com.ortho.rework.enums.OperationType;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OperationType operationType;
    private String reworkNo;
    private String batchNo;
    private String patientNo;
    private String operator;
    @Column(length = 1000)
    private String remark;
    private String beforeStatus;
    private String afterStatus;
    private Boolean isDuplicateAttempt = false;
    private LocalDateTime operationTime;
    @PrePersist
    protected void onCreate() { operationTime = LocalDateTime.now(); }
}
JAVAEOF

cat > "$BASE_DIR/entity/ReworkReport.java" << 'JAVAEOF'
package com.ortho.rework.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
@Data
@Entity
@Table(name = "rework_reports")
public class ReworkReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String reportNo;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rework_order_id")
    private ReworkOrder reworkOrder;
    private LocalDateTime reportGeneratedTime;
    private String generatedBy;
    @Column(length = 2000)
    private String summary;
    private String technicianNote;
    private String doctorConfirmation;
    private String inspectionResult;
    private String reviewResult;
    private String closeReason;
    private Integer totalReworkCount;
    private Long totalProcessingDays;
    private LocalDateTime createdAt;
    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }
}
JAVAEOF

echo "Entities created..."
echo "Done!"
