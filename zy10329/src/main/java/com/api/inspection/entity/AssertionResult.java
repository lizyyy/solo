package com.api.inspection.entity;

import com.api.inspection.enums.AssertionType;
import lombok.Data;

import javax.persistence.*;

@Data
@Entity
@Table(name = "assertion_result")
public class AssertionResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "step_execution_id", nullable = false)
    private StepExecution stepExecution;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssertionType assertionType;

    @Column(nullable = false)
    private String expectedValue;

    @Column
    private String actualValue;

    @Column(nullable = false)
    private Boolean passed;

    @Column(length = 1000)
    private String errorMessage;
}
