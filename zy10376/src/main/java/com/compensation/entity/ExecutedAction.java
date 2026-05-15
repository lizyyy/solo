package com.compensation.entity;

import com.compensation.enums.ActionStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "executed_action", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"request_id", "actionId"})
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutedAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String actionId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private UndoRequest undoRequest;
    
    @Column(nullable = false, length = 128)
    private String actionName;
    
    @Column(nullable = false)
    private Integer actionOrder;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ActionStatus status;
    
    @Column(length = 2048)
    private String inputData;
    
    @Column(length = 2048)
    private String outputData;
    
    @Column(length = 2048)
    private String compensationContext;
    
    @Column(length = 128)
    private String executedBy;
    
    private LocalDateTime executedAt;
    
    private LocalDateTime completedAt;
    
    @OneToMany(mappedBy = "executedAction", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RevocableItem> revocableItems = new ArrayList<>();
    
    @OneToOne(mappedBy = "executedAction", cascade = CascadeType.ALL)
    private FailureReason failureReason;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ActionStatus.PENDING;
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
