/**
 * Python Lexical Analyzer (Tokenizer)
 * Converts Python source code into a stream of tokens
 */
declare enum TokenType {
    NUMBER = "NUMBER",
    STRING = "STRING",
    NAME = "NAME",
    AND = "AND",
    AS = "AS",
    ASSERT = "ASSERT",
    ASYNC = "ASYNC",
    AWAIT = "AWAIT",
    BREAK = "BREAK",
    CLASS = "CLASS",
    CONTINUE = "CONTINUE",
    DEF = "DEF",
    DEL = "DEL",
    ELIF = "ELIF",
    ELSE = "ELSE",
    EXCEPT = "EXCEPT",
    FALSE = "FALSE",
    FINALLY = "FINALLY",
    FOR = "FOR",
    FROM = "FROM",
    GLOBAL = "GLOBAL",
    IF = "IF",
    IMPORT = "IMPORT",
    IN = "IN",
    IS = "IS",
    LAMBDA = "LAMBDA",
    MATCH = "MATCH",
    CASE = "CASE",
    NONE = "NONE",
    NONLOCAL = "NONLOCAL",
    NOT = "NOT",
    OR = "OR",
    PASS = "PASS",
    RAISE = "RAISE",
    RETURN = "RETURN",
    TRUE = "TRUE",
    TRY = "TRY",
    WHILE = "WHILE",
    WITH = "WITH",
    YIELD = "YIELD",
    PLUS = "PLUS",// +
    MINUS = "MINUS",// -
    STAR = "STAR",// *
    DOUBLESTAR = "DOUBLESTAR",// **
    SLASH = "SLASH",// /
    DOUBLESLASH = "DOUBLESLASH",// //
    PERCENT = "PERCENT",// %
    AT = "AT",// @
    VBAR = "VBAR",// |
    AMPER = "AMPER",// &
    CIRCUMFLEX = "CIRCUMFLEX",// ^
    TILDE = "TILDE",// ~
    LEFTSHIFT = "LEFTSHIFT",// <<
    RIGHTSHIFT = "RIGHTSHIFT",// >>
    LPAR = "LPAR",// (
    RPAR = "RPAR",// )
    LSQB = "LSQB",// [
    RSQB = "RSQB",// ]
    LBRACE = "LBRACE",// {
    RBRACE = "RBRACE",// }
    COMMA = "COMMA",// ,
    COLON = "COLON",// :
    DOT = "DOT",// .
    SEMI = "SEMI",// ;
    EQUAL = "EQUAL",// =
    RARROW = "RARROW",// ->
    EQEQUAL = "EQEQUAL",// ==
    NOTEQUAL = "NOTEQUAL",// !=
    LESS = "LESS",// <
    GREATER = "GREATER",// >
    LESSEQUAL = "LESSEQUAL",// <=
    GREATEREQUAL = "GREATEREQUAL",// >=
    PLUSEQUAL = "PLUSEQUAL",// +=
    MINEQUAL = "MINEQUAL",// -=
    STAREQUAL = "STAREQUAL",// *=
    SLASHEQUAL = "SLASHEQUAL",// /=
    PERCENTEQUAL = "PERCENTEQUAL",// %=
    AMPEREQUAL = "AMPEREQUAL",// &=
    VBAREQUAL = "VBAREQUAL",// |=
    CIRCUMFLEXEQUAL = "CIRCUMFLEXEQUAL",// ^=
    LEFTSHIFTEQUAL = "LEFTSHIFTEQUAL",// <<=
    RIGHTSHIFTEQUAL = "RIGHTSHIFTEQUAL",// >>=
    DOUBLESTAREQUAL = "DOUBLESTAREQUAL",// **=
    DOUBLESLASHEQUAL = "DOUBLESLASHEQUAL",// //=
    ATEQUAL = "ATEQUAL",// @=
    COLONEQUAL = "COLONEQUAL",// :=
    NEWLINE = "NEWLINE",
    INDENT = "INDENT",
    DEDENT = "DEDENT",
    COMMENT = "COMMENT",
    EOF = "EOF",
    ELLIPSIS = "ELLIPSIS",// ...
    FSTRING_START = "FSTRING_START",
    FSTRING_MIDDLE = "FSTRING_MIDDLE",
    FSTRING_END = "FSTRING_END"
}
interface Token {
    type: TokenType;
    value: string;
    lineno: number;
    col_offset: number;
    end_lineno: number;
    end_col_offset: number;
}
declare class Lexer {
    private source;
    private position;
    private tokens;
    private indentStack;
    private atLineStart;
    private parenLevel;
    private bracketLevel;
    private braceLevel;
    constructor(source: string);
    tokenize(): Token[];
    private scanToken;
    private scanNewline;
    private scanIndentation;
    private scanComment;
    private scanString;
    private scanFString;
    private scanNumber;
    private scanIdentifier;
    private isStringPrefix;
    private scanPrefixedString;
    private scanTwoCharOperator;
    private scanThreeCharOperator;
    private scanSingleCharOperator;
    private peek;
    private peekNext;
    private advance;
    private addToken;
    private addTokenAt;
    private isDigit;
    private isHexDigit;
    private isOctalDigit;
    private isBinaryDigit;
    private isAlpha;
    private isAlphaNumeric;
}

/**
 * Python AST Types based on the ASDL grammar
 * This provides TypeScript interfaces for all Python AST nodes
 */
/**
 * Base interface for all AST nodes
 */
interface ASTNode {
    readonly nodeType: string;
    lineno?: number;
    col_offset?: number;
    end_lineno?: number;
    end_col_offset?: number;
    inlineComment?: Comment;
}
/**
 * Base interface for nodes that can have location attributes
 */
interface Located extends ASTNode {
    lineno: number;
    col_offset: number;
    end_lineno?: number;
    end_col_offset?: number;
}
/**
 * Comment node interface
 */
interface Comment extends Located {
    nodeType: "Comment";
    value: string;
    inline?: boolean;
}
type ModuleNode = Module | Interactive | Expression | FunctionType;
interface Module extends Located {
    nodeType: "Module";
    body: StmtNode[];
    comments?: Comment[];
}
interface Interactive extends Located {
    nodeType: "Interactive";
    body: StmtNode[];
}
interface Expression extends Located {
    nodeType: "Expression";
    body: ExprNode;
}
interface FunctionType extends Located {
    nodeType: "FunctionType";
    argtypes: ExprNode[];
    returns: ExprNode;
}
type StmtNode = FunctionDef | AsyncFunctionDef | ClassDef | Return | Delete | Assign | TypeAlias | AugAssign | AnnAssign | For | AsyncFor | While | If | With | AsyncWith | Match | Raise | Try | TryStar | Assert | Import | ImportFrom | Global | Nonlocal | Expr | Pass | Break | Continue | Comment;
interface FunctionDef extends Located {
    nodeType: "FunctionDef";
    name: string;
    args: Arguments;
    body: StmtNode[];
    decorator_list: ExprNode[];
    returns?: ExprNode;
    type_comment?: string;
    type_params: TypeParamNode[];
}
interface AsyncFunctionDef extends Located {
    nodeType: "AsyncFunctionDef";
    name: string;
    args: Arguments;
    body: StmtNode[];
    decorator_list: ExprNode[];
    returns?: ExprNode;
    type_comment?: string;
    type_params: TypeParamNode[];
}
interface ClassDef extends Located {
    nodeType: "ClassDef";
    name: string;
    bases: ExprNode[];
    keywords: Keyword[];
    body: StmtNode[];
    decorator_list: ExprNode[];
    type_params: TypeParamNode[];
}
interface Return extends Located {
    nodeType: "Return";
    value?: ExprNode;
}
interface Delete extends Located {
    nodeType: "Delete";
    targets: ExprNode[];
}
interface Assign extends Located {
    nodeType: "Assign";
    targets: ExprNode[];
    value: ExprNode;
    type_comment?: string;
}
interface TypeAlias extends Located {
    nodeType: "TypeAlias";
    name: ExprNode;
    type_params: TypeParamNode[];
    value: ExprNode;
}
interface AugAssign extends Located {
    nodeType: "AugAssign";
    target: ExprNode;
    op: OperatorNode;
    value: ExprNode;
}
interface AnnAssign extends Located {
    nodeType: "AnnAssign";
    target: ExprNode;
    annotation: ExprNode;
    value?: ExprNode;
    simple: number;
}
interface For extends Located {
    nodeType: "For";
    target: ExprNode;
    iter: ExprNode;
    body: StmtNode[];
    orelse: StmtNode[];
    type_comment?: string;
}
interface AsyncFor extends Located {
    nodeType: "AsyncFor";
    target: ExprNode;
    iter: ExprNode;
    body: StmtNode[];
    orelse: StmtNode[];
    type_comment?: string;
}
interface While extends Located {
    nodeType: "While";
    test: ExprNode;
    body: StmtNode[];
    orelse: StmtNode[];
}
interface If extends Located {
    nodeType: "If";
    test: ExprNode;
    body: StmtNode[];
    orelse: StmtNode[];
}
interface With extends Located {
    nodeType: "With";
    items: WithItem[];
    body: StmtNode[];
    type_comment?: string;
}
interface AsyncWith extends Located {
    nodeType: "AsyncWith";
    items: WithItem[];
    body: StmtNode[];
    type_comment?: string;
}
interface Match extends Located {
    nodeType: "Match";
    subject: ExprNode;
    cases: MatchCase[];
}
interface Raise extends Located {
    nodeType: "Raise";
    exc?: ExprNode;
    cause?: ExprNode;
}
interface Try extends Located {
    nodeType: "Try";
    body: StmtNode[];
    handlers: ExceptHandler[];
    orelse: StmtNode[];
    finalbody: StmtNode[];
}
interface TryStar extends Located {
    nodeType: "TryStar";
    body: StmtNode[];
    handlers: ExceptHandler[];
    orelse: StmtNode[];
    finalbody: StmtNode[];
}
interface Assert extends Located {
    nodeType: "Assert";
    test: ExprNode;
    msg?: ExprNode;
}
interface Import extends Located {
    nodeType: "Import";
    names: Alias[];
}
interface ImportFrom extends Located {
    nodeType: "ImportFrom";
    module?: string;
    names: Alias[];
    level?: number;
}
interface Global extends Located {
    nodeType: "Global";
    names: string[];
}
interface Nonlocal extends Located {
    nodeType: "Nonlocal";
    names: string[];
}
interface Expr extends Located {
    nodeType: "Expr";
    value: ExprNode;
}
interface Pass extends Located {
    nodeType: "Pass";
}
interface Break extends Located {
    nodeType: "Break";
}
interface Continue extends Located {
    nodeType: "Continue";
}
type ExprNode = BoolOp | NamedExpr | BinOp | UnaryOp | Lambda | IfExp | Dict | Set | ListComp | SetComp | DictComp | GeneratorExp | Await | Yield | YieldFrom | Compare | Call | FormattedValue | JoinedStr | Constant | Attribute | Subscript | Starred | Name | List | Tuple | Slice;
interface BoolOp extends Located {
    nodeType: "BoolOp";
    op: BoolOpNode;
    values: ExprNode[];
}
interface NamedExpr extends Located {
    nodeType: "NamedExpr";
    target: ExprNode;
    value: ExprNode;
}
interface BinOp extends Located {
    nodeType: "BinOp";
    left: ExprNode;
    op: OperatorNode;
    right: ExprNode;
}
interface UnaryOp extends Located {
    nodeType: "UnaryOp";
    op: UnaryOpNode;
    operand: ExprNode;
}
interface Lambda extends Located {
    nodeType: "Lambda";
    args: Arguments;
    body: ExprNode;
}
interface IfExp extends Located {
    nodeType: "IfExp";
    test: ExprNode;
    body: ExprNode;
    orelse: ExprNode;
}
interface Dict extends Located {
    nodeType: "Dict";
    keys: (ExprNode | null)[];
    values: ExprNode[];
}
interface Set extends Located {
    nodeType: "Set";
    elts: ExprNode[];
}
interface ListComp extends Located {
    nodeType: "ListComp";
    elt: ExprNode;
    generators: Comprehension[];
}
interface SetComp extends Located {
    nodeType: "SetComp";
    elt: ExprNode;
    generators: Comprehension[];
}
interface DictComp extends Located {
    nodeType: "DictComp";
    key: ExprNode;
    value: ExprNode;
    generators: Comprehension[];
}
interface GeneratorExp extends Located {
    nodeType: "GeneratorExp";
    elt: ExprNode;
    generators: Comprehension[];
}
interface Await extends Located {
    nodeType: "Await";
    value: ExprNode;
}
interface Yield extends Located {
    nodeType: "Yield";
    value?: ExprNode;
}
interface YieldFrom extends Located {
    nodeType: "YieldFrom";
    value: ExprNode;
}
interface Compare extends Located {
    nodeType: "Compare";
    left: ExprNode;
    ops: CmpOpNode[];
    comparators: ExprNode[];
}
interface Call extends Located {
    nodeType: "Call";
    func: ExprNode;
    args: ExprNode[];
    keywords: Keyword[];
}
interface FormattedValue extends Located {
    nodeType: "FormattedValue";
    value: ExprNode;
    conversion: number;
    format_spec?: ExprNode;
}
interface JoinedStr extends Located {
    nodeType: "JoinedStr";
    values: ExprNode[];
    kind?: string;
}
interface Constant extends Located {
    nodeType: "Constant";
    value: any;
    kind?: string;
}
interface Attribute extends Located {
    nodeType: "Attribute";
    value: ExprNode;
    attr: string;
    ctx: ExprContextNode;
}
interface Subscript extends Located {
    nodeType: "Subscript";
    value: ExprNode;
    slice: ExprNode;
    ctx: ExprContextNode;
}
interface Starred extends Located {
    nodeType: "Starred";
    value: ExprNode;
    ctx: ExprContextNode;
}
interface Name extends Located {
    nodeType: "Name";
    id: string;
    ctx: ExprContextNode;
}
interface List extends Located {
    nodeType: "List";
    elts: ExprNode[];
    ctx: ExprContextNode;
}
interface Tuple extends Located {
    nodeType: "Tuple";
    elts: ExprNode[];
    ctx: ExprContextNode;
}
interface Slice extends Located {
    nodeType: "Slice";
    lower?: ExprNode;
    upper?: ExprNode;
    step?: ExprNode;
}
type ExprContextNode = Load | Store | Del;
interface Load extends ASTNode {
    nodeType: "Load";
}
interface Store extends ASTNode {
    nodeType: "Store";
}
interface Del extends ASTNode {
    nodeType: "Del";
}
type BoolOpNode = And | Or;
interface And extends ASTNode {
    nodeType: "And";
}
interface Or extends ASTNode {
    nodeType: "Or";
}
type OperatorNode = Add | Sub | Mult | MatMult | Div | Mod | Pow | LShift | RShift | BitOr | BitXor | BitAnd | FloorDiv;
type Operator = OperatorNode;
interface Add extends ASTNode {
    nodeType: "Add";
}
interface Sub extends ASTNode {
    nodeType: "Sub";
}
interface Mult extends ASTNode {
    nodeType: "Mult";
}
interface MatMult extends ASTNode {
    nodeType: "MatMult";
}
interface Div extends ASTNode {
    nodeType: "Div";
}
interface Mod extends ASTNode {
    nodeType: "Mod";
}
interface Pow extends ASTNode {
    nodeType: "Pow";
}
interface LShift extends ASTNode {
    nodeType: "LShift";
}
interface RShift extends ASTNode {
    nodeType: "RShift";
}
interface BitOr extends ASTNode {
    nodeType: "BitOr";
}
interface BitXor extends ASTNode {
    nodeType: "BitXor";
}
interface BitAnd extends ASTNode {
    nodeType: "BitAnd";
}
interface FloorDiv extends ASTNode {
    nodeType: "FloorDiv";
}
type UnaryOpNode = Invert | Not | UAdd | USub;
interface Invert extends ASTNode {
    nodeType: "Invert";
}
interface Not extends ASTNode {
    nodeType: "Not";
}
interface UAdd extends ASTNode {
    nodeType: "UAdd";
}
interface USub extends ASTNode {
    nodeType: "USub";
}
type CmpOpNode = Eq | NotEq | Lt | LtE | Gt | GtE | Is | IsNot | In | NotIn;
interface Eq extends ASTNode {
    nodeType: "Eq";
}
interface NotEq extends ASTNode {
    nodeType: "NotEq";
}
interface Lt extends ASTNode {
    nodeType: "Lt";
}
interface LtE extends ASTNode {
    nodeType: "LtE";
}
interface Gt extends ASTNode {
    nodeType: "Gt";
}
interface GtE extends ASTNode {
    nodeType: "GtE";
}
interface Is extends ASTNode {
    nodeType: "Is";
}
interface IsNot extends ASTNode {
    nodeType: "IsNot";
}
interface In extends ASTNode {
    nodeType: "In";
}
interface NotIn extends ASTNode {
    nodeType: "NotIn";
}
interface Comprehension extends ASTNode {
    nodeType: "Comprehension";
    target: ExprNode;
    iter: ExprNode;
    ifs: ExprNode[];
    is_async: number;
}
interface ExceptHandler extends Located {
    nodeType: "ExceptHandler";
    type?: ExprNode;
    name?: string;
    body: StmtNode[];
}
interface Arguments extends ASTNode {
    nodeType: "Arguments";
    posonlyargs: Arg[];
    args: Arg[];
    vararg?: Arg;
    kwonlyargs: Arg[];
    kw_defaults: (ExprNode | null)[];
    kwarg?: Arg;
    defaults: ExprNode[];
}
interface Arg extends Located {
    nodeType: "Arg";
    arg: string;
    annotation?: ExprNode;
    type_comment?: string;
}
interface Keyword extends Located {
    nodeType: "Keyword";
    arg?: string;
    value: ExprNode;
}
interface Alias extends Located {
    nodeType: "Alias";
    name: string;
    asname?: string;
}
interface WithItem extends ASTNode {
    nodeType: "WithItem";
    context_expr: ExprNode;
    optional_vars?: ExprNode;
}
interface MatchCase extends ASTNode {
    nodeType: "MatchCase";
    pattern: PatternNode;
    guard?: ExprNode;
    body: StmtNode[];
}
type PatternNode = MatchValue | MatchSingleton | MatchSequence | MatchMapping | MatchClass | MatchStar | MatchAs | MatchOr;
interface MatchValue extends Located {
    nodeType: "MatchValue";
    value: ExprNode;
}
interface MatchSingleton extends Located {
    nodeType: "MatchSingleton";
    value: any;
}
interface MatchSequence extends Located {
    nodeType: "MatchSequence";
    patterns: PatternNode[];
}
interface MatchMapping extends Located {
    nodeType: "MatchMapping";
    keys: ExprNode[];
    patterns: PatternNode[];
    rest?: string;
}
interface MatchClass extends Located {
    nodeType: "MatchClass";
    cls: ExprNode;
    patterns: PatternNode[];
    kwd_attrs: string[];
    kwd_patterns: PatternNode[];
}
interface MatchStar extends Located {
    nodeType: "MatchStar";
    name?: string;
}
interface MatchAs extends Located {
    nodeType: "MatchAs";
    pattern?: PatternNode;
    name?: string;
}
interface MatchOr extends Located {
    nodeType: "MatchOr";
    patterns: PatternNode[];
}
type TypeParamNode = TypeVar | ParamSpec | TypeVarTuple;
interface TypeVar extends Located {
    nodeType: "TypeVar";
    name: string;
    bound?: ExprNode;
    default_value?: ExprNode;
}
interface ParamSpec extends Located {
    nodeType: "ParamSpec";
    name: string;
    default_value?: ExprNode;
}
interface TypeVarTuple extends Located {
    nodeType: "TypeVarTuple";
    name: string;
    default_value?: ExprNode;
}
type ASTNodeUnion = ModuleNode | StmtNode | ExprNode | ExprContextNode | BoolOpNode | OperatorNode | UnaryOpNode | CmpOpNode | PatternNode | TypeParamNode | Comprehension | ExceptHandler | Arguments | Arg | Keyword | Alias | WithItem | MatchCase | Comment;

/**
 * Python Parser - Recursive Descent Parser for Python Source Code
 * Based on the Python ASDL grammar specification
 */

interface ParseOptions {
    filename?: string;
    comments?: boolean;
    feature_version?: number;
}
/**
 * Parse Python source code from a string
 */
declare function parse(source: string, options?: ParseOptions): Module;
/**
 * Parse Python source code from a file
 * Note: This is for Node.js environments. In browsers, you'll need to read the file content first.
 */
declare function parseFile(_filename: string, _options?: ParseOptions): Module;
declare function literalEval(source: string): any;
declare function copyLocation(newNode: ASTNode, oldNode: ASTNode): ASTNode;
declare function fixMissingLocations(node: ASTNode): ASTNode;
declare function incrementLineno(node: ASTNode, n?: number): ASTNode;

/**
 * Unparse an AST node back to Python source code
 */
declare function unparse(node: ASTNodeUnion, options?: {
    indent?: string;
}): string;

/**
 * Get the docstring from a function, class, or module node
 */
declare function getDocstring(node: ASTNodeUnion): string | null;
/**
 * Iterate over all fields of a node.
 */
declare function iterFields(node: ASTNodeUnion): Generator<[string, any]>;
/**
 * Iterate over all direct child nodes
 */
declare function iterChildNodes(node: ASTNodeUnion): Generator<ASTNodeUnion>;
/**
 * Check if a value is an AST node
 */
declare function isASTNode(value: any): value is ASTNodeUnion;
/**
 * Get source segment from source code using node location info
 */
declare function getSourceSegment(source: string, node: ASTNodeUnion, options?: {
    padded?: boolean;
}): string | null;
/**
 * Type for expression context values
 */
type ContextType = "Load" | "Store" | "Del";
/**
 * Type for constant values
 */
type ConstantValue = string | number | boolean | null;
/**
 * AST factory function types
 */
interface ASTFactory {
    Name(id: string, ctx?: ContextType): Extract<ExprNode, {
        nodeType: "Name";
    }>;
    Constant(value: ConstantValue, kind?: string): Extract<ExprNode, {
        nodeType: "Constant";
    }>;
    Call(func: ExprNode, args?: ExprNode[], keywords?: Keyword[]): Extract<ExprNode, {
        nodeType: "Call";
    }>;
    BinOp(left: ExprNode, op: Operator | string, right: ExprNode): Extract<ExprNode, {
        nodeType: "BinOp";
    }>;
    Assign(targets: ExprNode[], value: ExprNode, type_comment?: string): Extract<StmtNode, {
        nodeType: "Assign";
    }>;
    Expr(value: ExprNode): Extract<StmtNode, {
        nodeType: "Expr";
    }>;
    List(elts: ExprNode[], ctx?: ContextType): Extract<ExprNode, {
        nodeType: "List";
    }>;
    Tuple(elts: ExprNode[], ctx?: ContextType): Extract<ExprNode, {
        nodeType: "Tuple";
    }>;
    Attribute(value: ExprNode, attr: string, ctx?: ContextType): Extract<ExprNode, {
        nodeType: "Attribute";
    }>;
    Dict(keys: (ExprNode | null)[], values: ExprNode[]): Extract<ExprNode, {
        nodeType: "Dict";
    }>;
    NamedExpr(target: ExprNode, value: ExprNode): Extract<ExprNode, {
        nodeType: "NamedExpr";
    }>;
    Lambda(args: Arguments, body: ExprNode): Extract<ExprNode, {
        nodeType: "Lambda";
    }>;
    IfExp(test: ExprNode, body: ExprNode, orelse: ExprNode): Extract<ExprNode, {
        nodeType: "IfExp";
    }>;
    Await(value: ExprNode): Extract<ExprNode, {
        nodeType: "Await";
    }>;
    Yield(value?: ExprNode): Extract<ExprNode, {
        nodeType: "Yield";
    }>;
    YieldFrom(value: ExprNode): Extract<ExprNode, {
        nodeType: "YieldFrom";
    }>;
    Starred(value: ExprNode, ctx?: ContextType): Extract<ExprNode, {
        nodeType: "Starred";
    }>;
    Slice(lower?: ExprNode, upper?: ExprNode, step?: ExprNode): Extract<ExprNode, {
        nodeType: "Slice";
    }>;
    Delete(targets: ExprNode[]): Extract<StmtNode, {
        nodeType: "Delete";
    }>;
    Nonlocal(names: string[]): Extract<StmtNode, {
        nodeType: "Nonlocal";
    }>;
}
/**
 * Node factory functions for creating AST nodes
 */
declare const ast: ASTFactory;

/**
 * AST Visitor Implementation
 * Provides visitor pattern for traversing Python AST nodes
 */

/**
 * Generic visitor that can traverse any AST node
 */
declare function walk(node: ASTNodeUnion): Generator<ASTNodeUnion>;
/**
 * Base visitor class for traversing AST nodes
 */
declare class NodeVisitor {
    /**
     * Visit a node - dispatches to specific visit method
     */
    visit(node: ASTNodeUnion): any;
    /**
     * Called if no explicit visitor function exists for a node
     */
    genericVisit(node: ASTNodeUnion): void;
}
/**
 * Visitor that can transform AST nodes
 */
declare class NodeTransformer extends NodeVisitor {
    /**
     * Called if no explicit visitor function exists for a node
     */
    genericVisit(node: ASTNodeUnion): ASTNodeUnion;
}

/**
 * Parse Python source code and return an AST (simplified API)
 * @param source The Python source code to parse
 * @param options Optional parsing options
 */
declare function parsePython(source: string, options?: {
    filename?: string;
    comments?: boolean;
}): Module;
/**
 * Parse Python source code and return an AST
 * @param source The Python source code to parse
 * @param filename The filename (optional, defaults to '<unknown>')
 */
declare function parseModule(source: string, filename?: string): Module;
/**
 * Convert an AST back to Python source code
 * @param node The AST node to unparse
 * @param indent The indentation string (default: 4 spaces)
 */
declare function toSource(node: ASTNodeUnion, indent?: string): string;
/**
 * Dump an AST node to a formatted string for debugging
 */
declare function dump(node: ASTNodeUnion, options?: {
    annotateFields?: boolean;
    includeAttributes?: boolean;
    indent?: string | number;
    showEmpty?: boolean;
}): string;
declare const version = "1.0.0";

export { Lexer, NodeTransformer, NodeVisitor, TokenType, ast, copyLocation, dump, fixMissingLocations, getDocstring, getSourceSegment, incrementLineno, isASTNode, iterChildNodes, iterFields, literalEval, parse, parseFile, parseModule, parsePython, toSource, unparse, version, walk };
export type { ASTNode, ASTNodeUnion, Alias, Arg, Arguments, Assign, Attribute, BoolOpNode, Call, ClassDef, CmpOpNode, Comment, Comprehension, Constant, ExceptHandler, ExprContextNode, ExprNode, Expression, FunctionDef, FunctionType, Interactive, Keyword, Load, Located, Module, Name, OperatorNode, ParseOptions, StmtNode, Store, UnaryOpNode, WithItem };
