package com.notebook.artifact.repository;

import com.notebook.artifact.model.ExceptionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExceptionRecordRepository extends JpaRepository<ExceptionRecord, Long> {
    
    List<ExceptionRecord> findByNotebookExecutionId(String executionId);
    
    List<ExceptionRecord> findByResolvedFalse();
    
    List<ExceptionRecord> findByResolvedTrue();
}
