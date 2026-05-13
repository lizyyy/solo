package com.api.inspection.entity;

import lombok.Data;

import javax.persistence.*;

@Data
@Entity
@Table(name = "failure_location")
public class FailureLocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "step_execution_id", nullable = false)
    private StepExecution stepExecution;

    @Column(nullable = false)
    private String locationType;

    @Column(nullable = false)
    private String location;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column
    private String expectedValue;

    @Column
    private String actualValue;
}
