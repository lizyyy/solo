package com.performancereview.repository;

import com.performancereview.entity.UploadedFile;
import com.performancereview.enums.FileUploadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UploadedFileRepository extends JpaRepository<UploadedFile, Long> {

    List<UploadedFile> findByIncidentIdOrderByUploadedAtDesc(Long incidentId);

    List<UploadedFile> findByStatusOrderByUploadedAtDesc(FileUploadStatus status);

    List<UploadedFile> findByFileTypeOrderByUploadedAtDesc(String fileType);
}
