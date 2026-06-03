package com.xxx.financial.util;

import com.xxx.financial.enums.ApproverType;
import org.apache.commons.lang3.StringUtils;

public class PinyinDetector {

    private static final String PINYIN_PATTERN = "^[a-zA-Z\\s·]+$";

    public static ApproverType detectApproverType(String approver) {
        if (StringUtils.isBlank(approver)) {
            return ApproverType.EMPTY;
        }

        String trimmed = approver.trim();

        if (trimmed.matches(PINYIN_PATTERN)) {
            return ApproverType.PINYIN_ONLY;
        }

        if (containsChinese(trimmed)) {
            return ApproverType.FULL_NAME;
        }

        return ApproverType.PINYIN_ONLY;
    }

    public static boolean isPinyinOnly(String approver) {
        if (StringUtils.isBlank(approver)) {
            return false;
        }
        return detectApproverType(approver) == ApproverType.PINYIN_ONLY;
    }

    private static boolean containsChinese(String str) {
        for (char c : str.toCharArray()) {
            if (Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN) {
                return true;
            }
        }
        return false;
    }
}
