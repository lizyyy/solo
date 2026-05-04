jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});
