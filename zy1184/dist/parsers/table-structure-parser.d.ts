import { TableStructure, TableStructureParseOptions } from '../models';
export declare class TableStructureParser {
    private options;
    constructor(options?: TableStructureParseOptions);
    parse(content: string): TableStructure[];
    private parseJsonFormat;
    private parseJsonItem;
    private parseYamlFormat;
    private parseSqlFormat;
    private splitStatements;
    private parseCreateTableBody;
    private parseColumnDefinition;
    private extractDefaultValue;
    private parsePrimaryKeyConstraint;
    private parseForeignKeyConstraint;
    private parseIndexConstraint;
    private parseIndexStatement;
}
export declare function parseTableStructure(content: string, options?: TableStructureParseOptions): TableStructure[];
//# sourceMappingURL=table-structure-parser.d.ts.map