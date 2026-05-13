package com.evidence.entity;

import com.evidence.enums.ActionType;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "evidence_action")
public class EvidenceAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ActionType actionType;

    @Column(length = 128)
    private String actionName;

    @Column(columnDefinition = "TEXT")
    private String actionDetail;

    @Column(length = 256)
    private String externalRefNo;

    @Column(columnDefinition = "TEXT")
    private String receiptData;

    @Column(nullable = false)
    private LocalDateTime actionTime;

    @Column(length = 64)
    private String operator;

    @Column(length = 2048)
    private String extendInfo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evidence_chain_id", nullable = false)
    private EvidenceChain evidenceChain;

    @PrePersist
    protected void onCreate() {
        if (actionTime == null) {
            actionTime = LocalDateTime.now();
        }
    }
}
