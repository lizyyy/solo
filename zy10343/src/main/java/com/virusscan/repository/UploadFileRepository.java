package com.virusscan.repository;

import com.virusscan.entity.UploadFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UploadFileRepository extends JpaRepository<UploadFile, Long> {
    Optional<UploadFile> findByFileId(String fileId);
    Optional<UploadFile> findByFileHash(String fileHash);
    List<UploadFile> findByUploadedBy(String uploadedBy);
    List<UploadFile> findByUploadTimeBetween(LocalDateTime start, LocalDateTime end);
    boolean existsByFileId(String fileId);
    boolean existsByFileHash(String fileHash);
}