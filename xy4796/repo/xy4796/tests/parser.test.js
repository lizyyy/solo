const BenchmarkParser = require('../services/parser');

describe('BenchmarkParser', () => {
  describe('parseBenchmarkLine', () => {
    test('should parse a standard benchmark line with all metrics', () => {
      const line = 'BenchmarkProcessData-8         	     100	  1250.5 ns/op	 256 B/op	   3 allocs/op	 128.5 MB/s';
      const result = BenchmarkParser.parseBenchmarkLine(line);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('BenchmarkProcessData-8');
      expect(result.ns_op).toBe(1250.5);
      expect(result.b_op).toBe(256);
      expect(result.allocs_op).toBe(3);
      expect(result.mb_s).toBe(128.5);
    });

    test('should parse a benchmark line without MB/s', () => {
      const line = 'BenchmarkParseRequest-8        	    1000	   450.75 ns/op	 128 B/op	   2 allocs/op';
      const result = BenchmarkParser.parseBenchmarkLine(line);
      
      expect(result).not.toBeNull();
      expect(result.name).toBe('BenchmarkParseRequest-8');
      expect(result.ns_op).toBe(450.75);
      expect(result.b_op).toBe(128);
      expect(result.allocs_op).toBe(2);
      expect(result.mb_s).toBeNull();
    });

    test('should return null for non-benchmark lines', () => {
      const line = 'PASS';
      const result = BenchmarkParser.parseBenchmarkLine(line);
      
      expect(result).toBeNull();
    });

    test('should return null for lines without metrics', () => {
      const line = 'BenchmarkTest-8         	     100';
      const result = BenchmarkParser.parseBenchmarkLine(line);
      
      expect(result).toBeNull();
    });
  });

  describe('parseText', () => {
    test('should parse text benchmark output', () => {
      const text = `goos: darwin
goarch: amd64
pkg: github.com/example/service
BenchmarkProcessData-8         	     100	  1250.5 ns/op	 256 B/op	   3 allocs/op	 128.5 MB/s
BenchmarkSerializeJSON-8       	     100	   850.25 ns/op	 512 B/op	   5 allocs/op	 256.0 MB/s
PASS
ok  	github.com/example/service	4.567s`;

      const result = BenchmarkParser.parseText(text);
      
      expect(result.benchmarks).toHaveLength(2);
      expect(result.benchmarks[0].name).toBe('BenchmarkProcessData-8');
      expect(result.benchmarks[1].name).toBe('BenchmarkSerializeJSON-8');
    });
  });

  describe('parseJson', () => {
    test('should parse JSON benchmark output', () => {
      const line1 = 'BenchmarkProcessData-8         	     100	  1250.5 ns/op	 256 B/op	   3 allocs/op	 128.5 MB/s\n';
      const jsonContent = JSON.stringify({
        Time: "2024-01-15T10:30:00.000000000+08:00",
        Action: "run",
        Package: "github.com/example/service",
        Test: "BenchmarkProcessData-8"
      }) + '\n' + JSON.stringify({
        Time: "2024-01-15T10:30:00.123456789+08:00",
        Action: "output",
        Package: "github.com/example/service",
        Test: "BenchmarkProcessData-8",
        Output: line1
      }) + '\n' + JSON.stringify({
        Time: "2024-01-15T10:30:00.123456790+08:00",
        Action: "pass",
        Package: "github.com/example/service",
        Test: "BenchmarkProcessData-8",
        Elapsed: 0.123
      });

      const result = BenchmarkParser.parseJson(jsonContent);
      
      expect(result.package).toBe('github.com/example/service');
      expect(result.benchmarks).toHaveLength(1);
      expect(result.benchmarks[0].name).toBe('BenchmarkProcessData-8');
    });
  });

  describe('autoParse', () => {
    test('should auto-detect JSON format', () => {
      const jsonContent = `{"Action":"output","Output":"BenchmarkTest-8         	     100	  100 ns/op	 100 B/op	   1 allocs/op\\n"}`;
      const result = BenchmarkParser.autoParse(jsonContent);
      
      expect(result.benchmarks).toBeDefined();
    });

    test('should auto-detect text format', () => {
      const textContent = `BenchmarkTest-8         	     100	  100 ns/op	 100 B/op	   1 allocs/op`;
      const result = BenchmarkParser.autoParse(textContent);
      
      expect(result.benchmarks).toHaveLength(1);
    });
  });
});
