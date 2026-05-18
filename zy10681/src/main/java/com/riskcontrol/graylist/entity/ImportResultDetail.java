package com.riskcontrol.graylist.entity;

import com.riskcontrol.graylist.enums.ImportResultType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "import_result_detail", indexes = {
    @Index(name = "idx_batch_no_detail", columnList = "batchNo"),
    @Index(name = "idx_result_type", columnList = "resultType")
})
public class ImportResultDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String batchNo;

    private Integer rowNumber;

    @Column(length = 64)
    private String customerId;

    @Column(length = 128)
    private String customerName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ImportResultType resultType;

    @Column(length = 512)
    private String errorMessage;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
