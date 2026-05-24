package com.bus.notify.dto;

public class ResultDTO<T> {
    private boolean success;
    private String code;
    private String message;
    private T data;
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public T getData() { return data; }
    public void setData(T data) { this.data = data; }
    
    public static <T> ResultDTO<T> success(T data) {
        ResultDTO<T> result = new ResultDTO<>();
        result.setSuccess(true);
        result.setCode("200");
        result.setMessage("操作成功");
        result.setData(data);
        return result;
    }
    
    public static <T> ResultDTO<T> success(String message, T data) {
        ResultDTO<T> result = new ResultDTO<>();
        result.setSuccess(true);
        result.setCode("200");
        result.setMessage(message);
        result.setData(data);
        return result;
    }
    
    public static <T> ResultDTO<T> fail(String message) {
        ResultDTO<T> result = new ResultDTO<>();
        result.setSuccess(false);
        result.setCode("500");
        result.setMessage(message);
        return result;
    }
    
    public static <T> ResultDTO<T> fail(String code, String message) {
        ResultDTO<T> result = new ResultDTO<>();
        result.setSuccess(false);
        result.setCode(code);
        result.setMessage(message);
        return result;
    }
}
