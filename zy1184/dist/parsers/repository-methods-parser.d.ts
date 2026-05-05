import { RepositoryMethodsConfig } from '../models';
export declare class RepositoryMethodsParser {
    parse(content: string): RepositoryMethodsConfig;
    private parseConfig;
    private parseRepository;
    private parseMethod;
    private parseOperationType;
    private parseParameter;
    private parseJoin;
    private parseJoinType;
    private parseCondition;
    private parseOrderBy;
    private parsePagination;
    private parsePreload;
    private parseExample;
}
export declare function parseRepositoryMethods(content: string): RepositoryMethodsConfig;
//# sourceMappingURL=repository-methods-parser.d.ts.map