declare module 'json-source-map' {
  interface PointerLocation {
    value: {
      line: number;
      column: number;
      pos: number;
    };
    valueEnd: {
      line: number;
      column: number;
      pos: number;
    };
    key?: {
      line: number;
      column: number;
      pos: number;
    };
    keyEnd?: {
      line: number;
      column: number;
      pos: number;
    };
  }

  interface ParseResult {
    data: any;
    pointers: Record<string, PointerLocation>;
  }

  export function parse(json: string): ParseResult;
}
