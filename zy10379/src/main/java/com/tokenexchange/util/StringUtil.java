package com.tokenexchange.util;

import org.apache.commons.lang3.StringUtils;

/**
 * String 工具类 - 封装 Apache Commons Lang3 的 StringUtils
 * 确保 Java 8 兼容性
 */
public class StringUtil {

    /**
     * 检查字符串是否为空白
     * null、空字符串或仅包含空白字符都返回 true
     */
    public static boolean isBlank(String str) {
        return StringUtils.isBlank(str);
    }

    /**
     * 检查字符串是否不为空白
     */
    public static boolean isNotBlank(String str) {
        return StringUtils.isNotBlank(str);
    }

    /**
     * 检查字符串是否为空
     * null 或空字符串返回 true
     */
    public static boolean isEmpty(String str) {
        return StringUtils.isEmpty(str);
    }

    /**
     * 检查字符串是否不为空
     */
    public static boolean isNotEmpty(String str) {
        return StringUtils.isNotEmpty(str);
    }
}
