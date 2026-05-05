const BenchmarkParser = {
  parseJson: function (jsonContent) {
    try {
      const benchmarks = [];
      const lines = jsonContent.trim().split('\n');
      
      let packageName = '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const obj = JSON.parse(line);
          
          if (obj.Package) {
            packageName = obj.Package;
          }
          
          if (obj.Action === 'output') {
            const output = obj.Output || '';
            const parsed = this.parseBenchmarkLine(output);
            if (parsed) {
              benchmarks.push(parsed);
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return {
        package: packageName,
        benchmarks
      };
    } catch (error) {
      throw new Error(`Failed to parse JSON benchmark: ${error.message}`);
    }
  },

  parseText: function (textContent) {
    try {
      const benchmarks = [];
      const lines = textContent.trim().split('\n');
      
      let packageName = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.startsWith('? ') || trimmed.startsWith('ok ') || trimmed.startsWith('FAIL ')) {
          continue;
        }
        
        if (trimmed.includes('Benchmark')) {
          const parsed = this.parseBenchmarkLine(trimmed);
          if (parsed) {
            benchmarks.push(parsed);
          }
        }
      }
      
      return {
        package: packageName,
        benchmarks
      };
    } catch (error) {
      throw new Error(`Failed to parse text benchmark: ${error.message}`);
    }
  },

  parseBenchmarkLine: function (line) {
    const trimmed = line.trim();
    
    if (!trimmed.startsWith('Benchmark')) {
      return null;
    }
    
    const result = {
      name: '',
      ns_op: null,
      b_op: null,
      allocs_op: null,
      mb_s: null
    };
    
    const nameMatch = trimmed.match(/^(Benchmark\S+)/);
    if (nameMatch) {
      result.name = nameMatch[1];
    }
    
    const nsMatch = trimmed.match(/(\d+\.?\d*)\s+ns\/op/);
    if (nsMatch) {
      result.ns_op = parseFloat(nsMatch[1]);
    }
    
    const bMatch = trimmed.match(/(\d+\.?\d*)\s+B\/op/);
    if (bMatch) {
      result.b_op = parseFloat(bMatch[1]);
    }
    
    const allocsMatch = trimmed.match(/(\d+\.?\d*)\s+allocs\/op/);
    if (allocsMatch) {
      result.allocs_op = parseFloat(allocsMatch[1]);
    }
    
    const mbMatch = trimmed.match(/(\d+\.?\d*)\s+MB\/s/);
    if (mbMatch) {
      result.mb_s = parseFloat(mbMatch[1]);
    }
    
    if (!result.name || (result.ns_op === null && result.b_op === null && result.allocs_op === null)) {
      return null;
    }
    
    return result;
  },

  autoParse: function (content) {
    try {
      const firstLine = content.trim().split('\n')[0] || '';
      
      if (firstLine.startsWith('{') && firstLine.includes('"Action"')) {
        return this.parseJson(content);
      }
      
      return this.parseText(content);
    } catch (error) {
      return this.parseText(content);
    }
  }
};

module.exports = BenchmarkParser;
