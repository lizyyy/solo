interface AssertionResult {
    name: string;
    passed: boolean;
    actual: any;
    expected: any;
}
declare function runZhangmingLeaveTest(): {
    allPassed: boolean;
    results: AssertionResult[];
};
export { runZhangmingLeaveTest };
