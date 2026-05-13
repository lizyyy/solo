package com.example.readonlywindow.repository;

import com.example.readonlywindow.entity.RequestStatus;
import com.example.readonlywindow.entity.WriteRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WriteRequestRepository extends JpaRepository<WriteRequest, Long> {
    Optional<WriteRequest> findByRequestCode(String requestCode);
    List<WriteRequest> findByFreezeWindowId(Long windowId);
    List<WriteRequest> findByFreezeWindowIdAndStatus(Long windowId, RequestStatus status);
    List<WriteRequest> findByRequester(String requester);
    List<WriteRequest> findByStatus(RequestStatus status);
    boolean existsByRequestCode(String requestCode);
}
