package com.hazardous.waste.service;

import com.hazardous.waste.entity.TransferForm;
import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.ErrorCode;
import com.hazardous.waste.exception.BusinessException;
import com.hazardous.waste.repository.TransferFormRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TransferFormService {

    private final TransferFormRepository transferFormRepository;

    @Transactional
    public TransferForm createForm(TransferForm form) {
        if (transferFormRepository.existsByFormNo(form.getFormNo())) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "转运单号已存在: " + form.getFormNo());
        }
        return transferFormRepository.save(form);
    }

    public List<TransferForm> getAllForms() {
        return transferFormRepository.findAll();
    }

    public List<TransferForm> getUnusedForms() {
        return transferFormRepository.findByIsUsed(false);
    }

    public TransferForm getFormByNo(String formNo) {
        return transferFormRepository.findByFormNo(formNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "转运单不存在: " + formNo));
    }

    @Transactional
    public TransferForm signForm(String formNo, String receiver, String signature) {
        TransferForm form = getFormByNo(formNo);
        if (form.getIsSigned()) {
            throw new BusinessException(ErrorCode.DUPLICATE_REQUEST, "转运单已签收");
        }
        form.setReceiver(receiver);
        form.setReceiverSignature(signature);
        form.setReceiveTime(LocalDateTime.now());
        form.setIsSigned(true);
        return transferFormRepository.save(form);
    }

    @Transactional
    public TransferForm markUsed(String formNo, List<WasteRecord> records) {
        TransferForm form = getFormByNo(formNo);
        if (form.getIsUsed()) {
            throw new BusinessException(ErrorCode.TRANSFER_FORM_USED, "转运单已被使用: " + formNo);
        }
        form.setIsUsed(true);
        form.setTransferTime(LocalDateTime.now());
        form.setWasteRecords(records);
        return transferFormRepository.save(form);
    }
}
