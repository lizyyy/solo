package com.pottery.kilnqueue.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "firing_reports")
public class FiringReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String reportNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private KilnBatch batch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_id", nullable = false)
    private Work work;

    @Column(nullable = false)
    private String workNo;

    @Column(nullable = false)
    private String workName;

    private String studentName;

    private String studentNo;

    private String glazeCodes;

    private Integer positionX;

    private Integer positionY;

    private Integer positionZ;

    @Column(columnDefinition = "TEXT")
    private String firingResult;

    @Column(columnDefinition = "TEXT")
    private String issues;

    private Boolean success = true;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getReportNo() { return reportNo; }
    public void setReportNo(String reportNo) { this.reportNo = reportNo; }
    public KilnBatch getBatch() { return batch; }
    public void setBatch(KilnBatch batch) { this.batch = batch; }
    public Work getWork() { return work; }
    public void setWork(Work work) { this.work = work; }
    public String getWorkNo() { return workNo; }
    public void setWorkNo(String workNo) { this.workNo = workNo; }
    public String getWorkName() { return workName; }
    public void setWorkName(String workName) { this.workName = workName; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getStudentNo() { return studentNo; }
    public void setStudentNo(String studentNo) { this.studentNo = studentNo; }
    public String getGlazeCodes() { return glazeCodes; }
    public void setGlazeCodes(String glazeCodes) { this.glazeCodes = glazeCodes; }
    public Integer getPositionX() { return positionX; }
    public void setPositionX(Integer positionX) { this.positionX = positionX; }
    public Integer getPositionY() { return positionY; }
    public void setPositionY(Integer positionY) { this.positionY = positionY; }
    public Integer getPositionZ() { return positionZ; }
    public void setPositionZ(Integer positionZ) { this.positionZ = positionZ; }
    public String getFiringResult() { return firingResult; }
    public void setFiringResult(String firingResult) { this.firingResult = firingResult; }
    public String getIssues() { return issues; }
    public void setIssues(String issues) { this.issues = issues; }
    public Boolean getSuccess() { return success; }
    public void setSuccess(Boolean success) { this.success = success; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
