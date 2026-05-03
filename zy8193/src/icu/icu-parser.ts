import { ParsedICUMessage, Placeholder } from '../types';

type ICUParseState = {
  index: number;
  message: string;
};

export class IcuParser {
  static parse(key: string, raw: string): ParsedICUMessage {
    try {
      const placeholders: Placeholder[] = [];
      const pluralForms: string[] = [];
      const selectForms: { [key: string]: string[] } = {};
      let hasPlural = false;
      let hasSelect = false;

      const state: ICUParseState = { index: 0, message: raw };
      
      while (state.index < raw.length) {
        const char = raw[state.index];
        
        if (char === '{') {
          const result = this.parsePlaceholder(state);
          
          if (result.placeholder) {
            placeholders.push(result.placeholder);
            
            if (result.placeholder.type === 'plural' || result.placeholder.type === 'selectordinal') {
              hasPlural = true;
              if (result.pluralForms) {
                for (const form of result.pluralForms) {
                  if (!pluralForms.includes(form)) {
                    pluralForms.push(form);
                  }
                }
              }
            } else if (result.placeholder.type === 'select') {
              hasSelect = true;
              if (result.selectForms) {
                for (const form of result.selectForms) {
                }
              }
            }
          }
        } else {
          state.index++;
        }
      }

      return {
        key,
        raw,
        placeholders,
        pluralForms,
        selectForms,
        hasPlural,
        hasSelect,
        isValid: true
      };
    } catch (error) {
      return {
        key,
        raw,
        placeholders: [],
        pluralForms: [],
        selectForms: {},
        hasPlural: false,
        hasSelect: false,
        isValid: false,
        parseError: (error as Error).message
      };
    }
  }

  private static parsePlaceholder(state: ICUParseState): { 
    placeholder?: Placeholder; 
    pluralForms?: string[];
    selectForms?: string[];
  } {
    const startIndex = state.index;
    state.index++;

    this.skipWhitespace(state);
    
    const name = this.parseIdentifier(state);
    
    if (!name) {
      throw new Error(`Invalid placeholder: missing identifier at position ${startIndex}`);
    }

    this.skipWhitespace(state);

    if (state.index >= state.message.length) {
      throw new Error(`Unclosed placeholder starting at position ${startIndex}`);
    }

    let type: Placeholder['type'] = 'simple';
    let pluralForms: string[] | undefined;
    let selectForms: string[] | undefined;

    if (state.message[state.index] === ',') {
      state.index++;
      this.skipWhitespace(state);
      
      const typeStr = this.parseIdentifier(state);
      this.skipWhitespace(state);

      switch (typeStr) {
        case 'plural':
          type = 'plural';
          pluralForms = this.parsePluralForms(state);
          break;
        case 'selectordinal':
          type = 'selectordinal';
          pluralForms = this.parsePluralForms(state);
          break;
        case 'select':
          type = 'select';
          selectForms = this.parseSelectForms(state);
          break;
        case 'number':
          type = 'number';
          this.parseOptionalStyle(state);
          break;
        case 'date':
          type = 'date';
          this.parseOptionalStyle(state);
          break;
        case 'time':
          type = 'time';
          this.parseOptionalStyle(state);
          break;
        default:
          type = 'simple';
          break;
      }
    }

    this.skipWhitespace(state);

    if (state.message[state.index] !== '}') {
      throw new Error(`Expected '}' at position ${state.index}, got '${state.message[state.index]}'`);
    }
    state.index++;

    const placeholder: Placeholder = {
      name,
      type,
      raw: state.message.substring(startIndex, state.index)
    };

    return { placeholder, pluralForms, selectForms };
  }

  private static parseIdentifier(state: ICUParseState): string {
    const start = state.index;
    
    while (state.index < state.message.length) {
      const char = state.message[state.index];
      
      if (/[a-zA-Z0-9_]/.test(char) || char === '-' || char === '$') {
        state.index++;
      } else {
        break;
      }
    }

    return state.message.substring(start, state.index);
  }

  private static parsePluralForms(state: ICUParseState): string[] {
    const forms: string[] = [];
    
    this.skipWhitespace(state);
    
    while (state.index < state.message.length && state.message[state.index] !== '}') {
      if (state.message[state.index] === ',') {
        state.index++;
        this.skipWhitespace(state);
        continue;
      }

      const form = this.parseIdentifier(state);
      
      if (form === 'offset') {
        this.skipWhitespace(state);
        if (state.message[state.index] === ':') {
          state.index++;
          this.skipWhitespace(state);
          this.parseNumber(state);
          this.skipWhitespace(state);
        }
        continue;
      }

      this.skipWhitespace(state);
      
      if (state.message[state.index] === '{') {
        this.parseNestedMessage(state);
      }

      if (form && !forms.includes(form) && form !== 'offset') {
        forms.push(form);
      }

      this.skipWhitespace(state);
    }

    return forms;
  }

  private static parseSelectForms(state: ICUParseState): string[] {
    const forms: string[] = [];
    
    this.skipWhitespace(state);
    
    while (state.index < state.message.length && state.message[state.index] !== '}') {
      if (state.message[state.index] === ',') {
        state.index++;
        this.skipWhitespace(state);
        continue;
      }

      const form = this.parseIdentifier(state);
      
      this.skipWhitespace(state);
      
      if (state.message[state.index] === '{') {
        this.parseNestedMessage(state);
      }

      if (form && !forms.includes(form)) {
        forms.push(form);
      }

      this.skipWhitespace(state);
    }

    return forms;
  }

  private static parseNestedMessage(state: ICUParseState): void {
    let braceCount = 0;
    
    while (state.index < state.message.length) {
      const char = state.message[state.index];
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          state.index++;
          return;
        }
      }
      state.index++;
    }
  }

  private static parseOptionalStyle(state: ICUParseState): void {
    if (state.message[state.index] === ',') {
      state.index++;
      this.skipWhitespace(state);
      this.parseIdentifier(state);
      this.skipWhitespace(state);
    }
  }

  private static parseNumber(state: ICUParseState): string {
    const start = state.index;
    
    while (state.index < state.message.length && /[0-9]/.test(state.message[state.index])) {
      state.index++;
    }

    return state.message.substring(start, state.index);
  }

  private static skipWhitespace(state: ICUParseState): void {
    while (state.index < state.message.length) {
      const char = state.message[state.index];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        state.index++;
      } else {
        break;
      }
    }
  }

  static normalizePlaceholderKey(p: Placeholder): string {
    return `${p.name}:${p.type}`;
  }

  static comparePlaceholders(a: Placeholder[], b: Placeholder[]): { 
    added: Placeholder[]; 
    removed: Placeholder[]; 
    typeMismatch: { name: string; aType: string; bType: string }[] 
  } {
    const aMap = new Map(a.map(p => [p.name, p]));
    const bMap = new Map(b.map(p => [p.name, p]));
    
    const added: Placeholder[] = [];
    const removed: Placeholder[] = [];
    const typeMismatch: { name: string; aType: string; bType: string }[] = [];

    for (const [name, placeholder] of aMap) {
      if (!bMap.has(name)) {
        removed.push(placeholder);
      } else {
        const bPlaceholder = bMap.get(name)!;
        if (placeholder.type !== bPlaceholder.type) {
          typeMismatch.push({
            name,
            aType: placeholder.type,
            bType: bPlaceholder.type
          });
        }
      }
    }

    for (const [name, placeholder] of bMap) {
      if (!aMap.has(name)) {
        added.push(placeholder);
      }
    }

    return { added, removed, typeMismatch };
  }
}
