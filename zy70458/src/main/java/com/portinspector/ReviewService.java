package com.portinspector;

import com.portinspector.model.InspectionResult;

import java.time.LocalDateTime;
import java.util.Optional;

public class ReviewService {
    private final DataStorage storage;

    public ReviewService(DataStorage storage) {
        this.storage = storage;
    }

    public InspectionResult markReviewed(String sampleId, String reviewer, String notes) {
        Optional<InspectionResult> resultOpt = storage.getResult(sampleId);
        if (!resultOpt.isPresent()) {
            throw new IllegalArgumentException("样本不存在: " + sampleId);
        }

        InspectionResult result = resultOpt.get();
        result.setReviewed(true);
        result.setReviewer(reviewer);
        result.setReviewTime(LocalDateTime.now());
        result.setReviewNotes(notes);

        storage.saveResult(result);
        return result;
    }
}
