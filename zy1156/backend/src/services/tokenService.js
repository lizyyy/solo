const { get_encoding } = require('tiktoken');

let encoder = null;

function initEncoder(model = 'gpt-3.5-turbo') {
  if (!encoder) {
    try {
      encoder = get_encoding('cl100k_base');
    } catch (error) {
      console.error('Failed to initialize tiktoken encoder:', error);
      throw error;
    }
  }
  return encoder;
}

function countTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  const enc = initEncoder();
  try {
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    console.error('Token counting error:', error);
    return Math.ceil(text.length / 4);
  }
}

function countConversationTokens(conversations) {
  if (!Array.isArray(conversations)) {
    return 0;
  }
  
  let totalTokens = 0;
  conversations.forEach(msg => {
    if (msg.role) {
      totalTokens += countTokens(msg.role);
    }
    if (msg.content) {
      totalTokens += countTokens(msg.content);
    }
    totalTokens += 4;
  });
  
  totalTokens += 2;
  
  return totalTokens;
}

function countToolResultsTokens(toolResults) {
  if (!toolResults) return 0;
  
  const content = typeof toolResults === 'string' 
    ? toolResults 
    : JSON.stringify(toolResults, null, 2);
  
  return countTokens(content);
}

function estimateContextTokens({
  conversations = [],
  docs = '',
  toolResults = null,
  budgetYaml = ''
}) {
  let total = 0;
  
  total += countConversationTokens(conversations);
  total += countTokens(docs);
  total += countToolResultsTokens(toolResults);
  total += countTokens(budgetYaml);
  
  return total;
}

function truncateText(text, maxTokens, fromStart = false) {
  if (countTokens(text) <= maxTokens) {
    return { text, truncated: false, tokensRemoved: 0 };
  }
  
  const enc = initEncoder();
  const tokens = enc.encode(text);
  
  if (tokens.length <= maxTokens) {
    return { text, truncated: false, tokensRemoved: 0 };
  }
  
  let truncatedTokens;
  if (fromStart) {
    truncatedTokens = tokens.slice(0, maxTokens);
  } else {
    truncatedTokens = tokens.slice(tokens.length - maxTokens);
  }
  
  const truncatedText = enc.decode(truncatedTokens);
  const tokensRemoved = tokens.length - truncatedTokens.length;
  
  return {
    text: truncatedText,
    truncated: true,
    tokensRemoved
  };
}

function applyTokenBudget(contextData, strategy) {
  const { maxTokens, priorityRules = {} } = strategy;
  const {
    conversations = [],
    docs = '',
    toolResults = null,
    budgetConstraints = {}
  } = contextData;

  const result = {
    retained: {
      conversations: [],
      docs: '',
      toolResults: null,
      budgetConstraints: {}
    },
    lost: {
      conversations: [],
      docs: '',
      toolResults: null,
      budgetConstraints: {}
    },
    statistics: {
      totalOriginalTokens: 0,
      totalRetainedTokens: 0,
      totalLostTokens: 0
    }
  };

  const convTokens = countConversationTokens(conversations);
  const docsTokens = countTokens(docs);
  const toolTokens = countToolResultsTokens(toolResults);
  const budgetTokens = countTokens(JSON.stringify(budgetConstraints, null, 2));

  result.statistics.totalOriginalTokens = convTokens + docsTokens + toolTokens + budgetTokens;

  const priorities = {
    budget: priorityRules.budget || 100,
    systemPrompt: priorityRules.systemPrompt || 90,
    recentMessages: priorityRules.recentMessages || 80,
    toolResults: priorityRules.toolResults || 70,
    docs: priorityRules.docs || 60,
    oldMessages: priorityRules.oldMessages || 50
  };

  let remainingTokens = maxTokens;
  let retainedTokens = 0;

  result.retained.budgetConstraints = budgetConstraints;
  const budgetUsed = countTokens(JSON.stringify(budgetConstraints, null, 2));
  remainingTokens -= budgetUsed;
  retainedTokens += budgetUsed;

  const systemMessages = conversations.filter(m => m.role === 'system');
  const userMessages = conversations.filter(m => m.role === 'user');
  const assistantMessages = conversations.filter(m => m.role === 'assistant');
  const otherMessages = conversations.filter(m => !['system', 'user', 'assistant'].includes(m.role));

  for (const msg of systemMessages) {
    const msgTokens = countConversationTokens([msg]);
    if (remainingTokens >= msgTokens) {
      result.retained.conversations.push(msg);
      remainingTokens -= msgTokens;
      retainedTokens += msgTokens;
    } else {
      result.lost.conversations.push(msg);
    }
  }

  const allNonSystemMessages = [...userMessages, ...assistantMessages, ...otherMessages];
  allNonSystemMessages.sort((a, b) => {
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  for (const msg of allNonSystemMessages) {
    const msgTokens = countConversationTokens([msg]);
    if (remainingTokens >= msgTokens) {
      result.retained.conversations.push(msg);
      remainingTokens -= msgTokens;
      retainedTokens += msgTokens;
    } else {
      result.lost.conversations.push(msg);
    }
  }

  if (toolResults && remainingTokens > 0) {
    const toolStr = typeof toolResults === 'string' 
      ? toolResults 
      : JSON.stringify(toolResults, null, 2);
    const toolTokenCount = countTokens(toolStr);
    
    if (remainingTokens >= toolTokenCount) {
      result.retained.toolResults = toolResults;
      remainingTokens -= toolTokenCount;
      retainedTokens += toolTokenCount;
    } else {
      const truncated = truncateText(toolStr, remainingTokens, true);
      try {
        result.retained.toolResults = JSON.parse(truncated.text);
      } catch {
        result.retained.toolResults = truncated.text;
      }
      result.lost.toolResults = toolResults;
      retainedTokens += remainingTokens;
      remainingTokens = 0;
    }
  } else if (toolResults) {
    result.lost.toolResults = toolResults;
  }

  if (docs && remainingTokens > 0) {
    const docsTokenCount = countTokens(docs);
    
    if (remainingTokens >= docsTokenCount) {
      result.retained.docs = docs;
      remainingTokens -= docsTokenCount;
      retainedTokens += docsTokenCount;
    } else {
      const truncated = truncateText(docs, remainingTokens, true);
      result.retained.docs = truncated.text;
      result.lost.docs = docs;
      retainedTokens += remainingTokens;
      remainingTokens = 0;
    }
  } else if (docs) {
    result.lost.docs = docs;
  }

  result.retained.conversations.sort((a, b) => {
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  result.statistics.totalRetainedTokens = retainedTokens;
  result.statistics.totalLostTokens = result.statistics.totalOriginalTokens - retainedTokens;

  return result;
}

module.exports = {
  initEncoder,
  countTokens,
  countConversationTokens,
  countToolResultsTokens,
  estimateContextTokens,
  truncateText,
  applyTokenBudget
};
