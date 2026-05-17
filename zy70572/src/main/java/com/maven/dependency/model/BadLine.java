package com.maven.dependency.model;

public class BadLine {
    private int lineNumber;
    private String lineContent;
    private String errorReason;
    private String context;

    public BadLine() {}

    public BadLine(int lineNumber, String lineContent, String errorReason) {
        this.lineNumber = lineNumber;
        this.lineContent = lineContent;
        this.errorReason = errorReason;
    }

    public int getLineNumber() { return lineNumber; }
    public void setLineNumber(int lineNumber) { this.lineNumber = lineNumber; }

    public String getLineContent() { return lineContent; }
    public void setLineContent(String lineContent) { this.lineContent = lineContent; }

    public String getErrorReason() { return errorReason; }
    public void setErrorReason(String errorReason) { this.errorReason = errorReason; }

    public String getContext() { return context; }
    public void setContext(String context) { this.context = context; }
}
