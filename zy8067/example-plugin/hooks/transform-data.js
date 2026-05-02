function handler(input) {
  return {
    transformed: input.data.map(item => item.toUpperCase()),
    count: input.data.length
  };
}