package com.metadata.repair.repository;

import com.metadata.repair.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    Optional<Attachment> findByFileId(String fileId);
    List<Attachment> findByBusinessNo(String businessNo);
    List<Attachment> findByMetadataCompleteFalse();
    boolean existsByFileId(String fileId);
}
