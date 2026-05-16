package com.dns.preplay.exception;

import com.dns.preplay.model.enums.PreplayStatus;

public class InvalidStatusTransitionException extends RuntimeException {

    public InvalidStatusTransitionException(PreplayStatus current, PreplayStatus target) {
        super("无效的状态转换: " + current + " -> " + target);
    }
}
