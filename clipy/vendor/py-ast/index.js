'use strict';

/**
 * Python Lexical Analyzer (Tokenizer)
 * Converts Python source code into a stream of tokens
 */
exports.TokenType = void 0;
(function (TokenType) {
    // Literals
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["NAME"] = "NAME";
    // Keywords
    TokenType["AND"] = "AND";
    TokenType["AS"] = "AS";
    TokenType["ASSERT"] = "ASSERT";
    TokenType["ASYNC"] = "ASYNC";
    TokenType["AWAIT"] = "AWAIT";
    TokenType["BREAK"] = "BREAK";
    TokenType["CLASS"] = "CLASS";
    TokenType["CONTINUE"] = "CONTINUE";
    TokenType["DEF"] = "DEF";
    TokenType["DEL"] = "DEL";
    TokenType["ELIF"] = "ELIF";
    TokenType["ELSE"] = "ELSE";
    TokenType["EXCEPT"] = "EXCEPT";
    TokenType["FALSE"] = "FALSE";
    TokenType["FINALLY"] = "FINALLY";
    TokenType["FOR"] = "FOR";
    TokenType["FROM"] = "FROM";
    TokenType["GLOBAL"] = "GLOBAL";
    TokenType["IF"] = "IF";
    TokenType["IMPORT"] = "IMPORT";
    TokenType["IN"] = "IN";
    TokenType["IS"] = "IS";
    TokenType["LAMBDA"] = "LAMBDA";
    TokenType["MATCH"] = "MATCH";
    TokenType["CASE"] = "CASE";
    TokenType["NONE"] = "NONE";
    TokenType["NONLOCAL"] = "NONLOCAL";
    TokenType["NOT"] = "NOT";
    TokenType["OR"] = "OR";
    TokenType["PASS"] = "PASS";
    TokenType["RAISE"] = "RAISE";
    TokenType["RETURN"] = "RETURN";
    TokenType["TRUE"] = "TRUE";
    TokenType["TRY"] = "TRY";
    TokenType["WHILE"] = "WHILE";
    TokenType["WITH"] = "WITH";
    TokenType["YIELD"] = "YIELD";
    // Operators
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["DOUBLESTAR"] = "DOUBLESTAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["DOUBLESLASH"] = "DOUBLESLASH";
    TokenType["PERCENT"] = "PERCENT";
    TokenType["AT"] = "AT";
    TokenType["VBAR"] = "VBAR";
    TokenType["AMPER"] = "AMPER";
    TokenType["CIRCUMFLEX"] = "CIRCUMFLEX";
    TokenType["TILDE"] = "TILDE";
    TokenType["LEFTSHIFT"] = "LEFTSHIFT";
    TokenType["RIGHTSHIFT"] = "RIGHTSHIFT";
    // Delimiters
    TokenType["LPAR"] = "LPAR";
    TokenType["RPAR"] = "RPAR";
    TokenType["LSQB"] = "LSQB";
    TokenType["RSQB"] = "RSQB";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["COMMA"] = "COMMA";
    TokenType["COLON"] = "COLON";
    TokenType["DOT"] = "DOT";
    TokenType["SEMI"] = "SEMI";
    TokenType["EQUAL"] = "EQUAL";
    TokenType["RARROW"] = "RARROW";
    // Comparison operators
    TokenType["EQEQUAL"] = "EQEQUAL";
    TokenType["NOTEQUAL"] = "NOTEQUAL";
    TokenType["LESS"] = "LESS";
    TokenType["GREATER"] = "GREATER";
    TokenType["LESSEQUAL"] = "LESSEQUAL";
    TokenType["GREATEREQUAL"] = "GREATEREQUAL";
    // Assignment operators
    TokenType["PLUSEQUAL"] = "PLUSEQUAL";
    TokenType["MINEQUAL"] = "MINEQUAL";
    TokenType["STAREQUAL"] = "STAREQUAL";
    TokenType["SLASHEQUAL"] = "SLASHEQUAL";
    TokenType["PERCENTEQUAL"] = "PERCENTEQUAL";
    TokenType["AMPEREQUAL"] = "AMPEREQUAL";
    TokenType["VBAREQUAL"] = "VBAREQUAL";
    TokenType["CIRCUMFLEXEQUAL"] = "CIRCUMFLEXEQUAL";
    TokenType["LEFTSHIFTEQUAL"] = "LEFTSHIFTEQUAL";
    TokenType["RIGHTSHIFTEQUAL"] = "RIGHTSHIFTEQUAL";
    TokenType["DOUBLESTAREQUAL"] = "DOUBLESTAREQUAL";
    TokenType["DOUBLESLASHEQUAL"] = "DOUBLESLASHEQUAL";
    TokenType["ATEQUAL"] = "ATEQUAL";
    TokenType["COLONEQUAL"] = "COLONEQUAL";
    // Special tokens
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["INDENT"] = "INDENT";
    TokenType["DEDENT"] = "DEDENT";
    TokenType["COMMENT"] = "COMMENT";
    TokenType["EOF"] = "EOF";
    TokenType["ELLIPSIS"] = "ELLIPSIS";
    // String formatting
    TokenType["FSTRING_START"] = "FSTRING_START";
    TokenType["FSTRING_MIDDLE"] = "FSTRING_MIDDLE";
    TokenType["FSTRING_END"] = "FSTRING_END";
})(exports.TokenType || (exports.TokenType = {}));
const KEYWORDS = new Map([
    ["and", exports.TokenType.AND],
    ["as", exports.TokenType.AS],
    ["assert", exports.TokenType.ASSERT],
    ["async", exports.TokenType.ASYNC],
    ["await", exports.TokenType.AWAIT],
    ["break", exports.TokenType.BREAK],
    ["class", exports.TokenType.CLASS],
    ["continue", exports.TokenType.CONTINUE],
    ["def", exports.TokenType.DEF],
    ["del", exports.TokenType.DEL],
    ["elif", exports.TokenType.ELIF],
    ["else", exports.TokenType.ELSE],
    ["except", exports.TokenType.EXCEPT],
    ["False", exports.TokenType.FALSE],
    ["finally", exports.TokenType.FINALLY],
    ["for", exports.TokenType.FOR],
    ["from", exports.TokenType.FROM],
    ["global", exports.TokenType.GLOBAL],
    ["if", exports.TokenType.IF],
    ["import", exports.TokenType.IMPORT],
    ["in", exports.TokenType.IN],
    ["is", exports.TokenType.IS],
    ["lambda", exports.TokenType.LAMBDA],
    ["match", exports.TokenType.MATCH],
    ["case", exports.TokenType.CASE],
    ["None", exports.TokenType.NONE],
    ["nonlocal", exports.TokenType.NONLOCAL],
    ["not", exports.TokenType.NOT],
    ["or", exports.TokenType.OR],
    ["pass", exports.TokenType.PASS],
    ["raise", exports.TokenType.RAISE],
    ["return", exports.TokenType.RETURN],
    ["True", exports.TokenType.TRUE],
    ["try", exports.TokenType.TRY],
    ["while", exports.TokenType.WHILE],
    ["with", exports.TokenType.WITH],
    ["yield", exports.TokenType.YIELD],
]);
class Lexer {
    constructor(source) {
        this.tokens = [];
        this.indentStack = [0];
        this.atLineStart = true;
        this.parenLevel = 0;
        this.bracketLevel = 0;
        this.braceLevel = 0;
        this.source = source;
        this.position = { line: 1, column: 0, index: 0 };
    }
    tokenize() {
        this.tokens = [];
        this.position = { line: 1, column: 0, index: 0 };
        this.indentStack = [0];
        this.atLineStart = true;
        this.parenLevel = 0;
        this.bracketLevel = 0;
        this.braceLevel = 0;
        while (this.position.index < this.source.length) {
            this.scanToken();
        }
        // Add final dedents
        while (this.indentStack.length > 1) {
            this.indentStack.pop();
            this.addToken(exports.TokenType.DEDENT, "");
        }
        this.addToken(exports.TokenType.EOF, "");
        return this.tokens;
    }
    scanToken() {
        const c = this.peek();
        if (c === "\n") {
            this.scanNewline();
            return;
        }
        if (this.atLineStart) {
            this.scanIndentation();
            this.atLineStart = false;
            // After scanning indentation, we need to scan the token at the current position
            // So we recursively call scanToken to handle the actual token
            if (this.position.index < this.source.length) {
                this.scanToken();
            }
            return;
        }
        // Skip whitespace (except newlines)
        if (c === " " || c === "\t" || c === "\r") {
            this.advance();
            return;
        }
        // Comments
        if (c === "#") {
            this.scanComment();
            return;
        }
        // String literals
        if (c === '"' || c === "'") {
            this.scanString();
            return;
        }
        // Numbers
        if (this.isDigit(c)) {
            this.scanNumber();
            return;
        }
        // Identifiers and keywords - check for f-strings first
        if (this.isAlpha(c) || c === "_") {
            // Check for f-string
            if (c.toLowerCase() === "f" &&
                this.position.index + 1 < this.source.length) {
                const nextChar = this.peekNext();
                if (nextChar === '"' || nextChar === "'") {
                    this.scanFString();
                    return;
                }
            }
            this.scanIdentifier();
            return;
        }
        // Three-character operators (check before two-character to avoid conflicts)
        const threeChar = this.source.slice(this.position.index, this.position.index + 3);
        if (this.scanThreeCharOperator(threeChar)) {
            return;
        }
        // Two-character operators
        const twoChar = this.source.slice(this.position.index, this.position.index + 2);
        if (this.scanTwoCharOperator(twoChar)) {
            return;
        }
        // Single-character operators and delimiters
        this.scanSingleCharOperator(c);
    }
    scanNewline() {
        const start = { ...this.position }; // Create a copy
        this.advance(); // consume '\n'
        // Only emit NEWLINE if we're not inside parentheses/brackets/braces
        if (this.parenLevel === 0 &&
            this.bracketLevel === 0 &&
            this.braceLevel === 0) {
            this.addTokenAt(exports.TokenType.NEWLINE, "\n", start);
        }
        this.atLineStart = true;
    }
    scanIndentation() {
        let indent = 0;
        while (this.position.index < this.source.length) {
            const c = this.peek();
            if (c === " ") {
                indent++;
                this.advance();
            }
            else if (c === "\t") {
                indent += 8; // Tab counts as 8 spaces
                this.advance();
            }
            else {
                break;
            }
        }
        // Skip empty lines and comment-only lines
        const c = this.peek();
        if (c === "\n" || c === "#" || this.position.index >= this.source.length) {
            return;
        }
        // Skip indentation tracking when inside parentheses, brackets, or braces
        if (this.parenLevel > 0 || this.bracketLevel > 0 || this.braceLevel > 0) {
            return;
        }
        const currentIndent = this.indentStack[this.indentStack.length - 1];
        if (indent > currentIndent) {
            this.indentStack.push(indent);
            this.addToken(exports.TokenType.INDENT, "");
        }
        else if (indent < currentIndent) {
            while (this.indentStack.length > 1 &&
                this.indentStack[this.indentStack.length - 1] > indent) {
                this.indentStack.pop();
                this.addToken(exports.TokenType.DEDENT, "");
            }
            if (this.indentStack[this.indentStack.length - 1] !== indent) {
                throw new Error(`Indentation error at line ${this.position.line}`);
            }
        }
    }
    scanComment() {
        const start = { ...this.position }; // Create a copy
        this.advance(); // consume '#'
        let value = "#";
        while (this.position.index < this.source.length && this.peek() !== "\n") {
            value += this.peek();
            this.advance();
        }
        this.addTokenAt(exports.TokenType.COMMENT, value, start);
    }
    scanString() {
        const start = { ...this.position }; // Create a copy
        const quote = this.peek();
        this.advance(); // consume opening quote
        // Check for triple quotes
        const isTripleQuote = this.peek() === quote && this.peekNext() === quote;
        if (isTripleQuote) {
            this.advance(); // consume second quote
            this.advance(); // consume third quote
        }
        let value = quote;
        if (isTripleQuote) {
            value += quote + quote;
        }
        let stringClosed = false;
        while (this.position.index < this.source.length) {
            const c = this.peek();
            if (c === "\\") {
                value += c;
                this.advance();
                if (this.position.index < this.source.length) {
                    value += this.peek();
                    this.advance();
                }
                continue;
            }
            if (isTripleQuote) {
                if (c === quote &&
                    this.peekNext() === quote &&
                    this.peek(2) === quote) {
                    value += quote + quote + quote;
                    this.advance(); // consume first quote
                    this.advance(); // consume second quote
                    this.advance(); // consume third quote
                    stringClosed = true;
                    break;
                }
            }
            else {
                if (c === quote) {
                    value += quote;
                    this.advance();
                    stringClosed = true;
                    break;
                }
                if (c === "\n") {
                    throw new Error(`Unterminated string literal at line ${this.position.line}`);
                }
            }
            value += c;
            this.advance();
        }
        // If we reached end of source without closing the string, it's an error
        if (!stringClosed) {
            if (isTripleQuote) {
                throw new Error(`Unterminated triple-quoted string literal at line ${start.line}`);
            }
            else {
                throw new Error(`Unterminated string literal at line ${start.line}`);
            }
        }
        this.addTokenAt(exports.TokenType.STRING, value, start);
    }
    scanFString() {
        const start = { ...this.position }; // Create a copy
        // Consume 'f'
        let value = this.peek();
        this.advance();
        // Get the quote character
        const quote = this.peek();
        value += quote;
        this.advance();
        // Check for triple quotes
        const isTripleQuote = this.peek() === quote && this.peekNext() === quote;
        if (isTripleQuote) {
            value += quote + quote;
            this.advance(); // consume second quote
            this.advance(); // consume third quote
        }
        let braceLevel = 0;
        let stringClosed = false;
        while (this.position.index < this.source.length) {
            const c = this.peek();
            // Handle escape sequences
            if (c === "\\") {
                value += c;
                this.advance();
                if (this.position.index < this.source.length) {
                    value += this.peek();
                    this.advance();
                }
                continue;
            }
            // Track braces to handle nested expressions
            if (c === "{") {
                braceLevel++;
                value += c;
                this.advance();
                continue;
            }
            if (c === "}") {
                if (braceLevel > 0) {
                    braceLevel--;
                }
                value += c;
                this.advance();
                continue;
            }
            // Check for closing quote only when not inside braces
            if (braceLevel === 0) {
                if (isTripleQuote) {
                    if (c === quote &&
                        this.peekNext() === quote &&
                        this.peek(2) === quote) {
                        value += quote + quote + quote;
                        this.advance(); // consume first quote
                        this.advance(); // consume second quote
                        this.advance(); // consume third quote
                        stringClosed = true;
                        break;
                    }
                }
                else {
                    if (c === quote) {
                        value += quote;
                        this.advance();
                        stringClosed = true;
                        break;
                    }
                    if (c === "\n") {
                        throw new Error(`Unterminated f-string literal at line ${this.position.line}`);
                    }
                }
            }
            value += c;
            this.advance();
        }
        // If we reached end of source without closing the f-string, it's an error
        if (!stringClosed) {
            if (isTripleQuote) {
                throw new Error(`Unterminated triple-quoted f-string literal at line ${start.line}`);
            }
            else {
                throw new Error(`Unterminated f-string literal at line ${start.line}`);
            }
        }
        this.addTokenAt(exports.TokenType.STRING, value, start);
    }
    scanNumber() {
        const start = { ...this.position }; // Create a copy
        let value = "";
        // Handle different number formats (decimal, hex, octal, binary)
        if (this.peek() === "0" && this.position.index + 1 < this.source.length) {
            const next = this.peekNext().toLowerCase();
            if (next === "x" || next === "o" || next === "b") {
                value += this.peek(); // '0'
                this.advance();
                value += this.peek(); // 'x', 'o', or 'b'
                this.advance();
                const isHex = next === "x";
                const isOctal = next === "o";
                const isBinary = next === "b";
                while (this.position.index < this.source.length) {
                    const c = this.peek().toLowerCase();
                    if ((isHex && this.isHexDigit(c)) ||
                        (isOctal && this.isOctalDigit(c)) ||
                        (isBinary && this.isBinaryDigit(c))) {
                        value += this.peek();
                        this.advance();
                    }
                    else if (c === "_") {
                        // Skip underscores in numbers
                        this.advance();
                    }
                    else {
                        break;
                    }
                }
                this.addTokenAt(exports.TokenType.NUMBER, value, start);
                return;
            }
        }
        // Regular decimal number
        while (this.position.index < this.source.length &&
            (this.isDigit(this.peek()) || this.peek() === "_")) {
            if (this.peek() !== "_") {
                value += this.peek();
            }
            this.advance();
        }
        // Handle decimal point
        if (this.peek() === "." &&
            this.position.index + 1 < this.source.length &&
            this.isDigit(this.peekNext())) {
            value += this.peek();
            this.advance();
            while (this.position.index < this.source.length &&
                (this.isDigit(this.peek()) || this.peek() === "_")) {
                if (this.peek() !== "_") {
                    value += this.peek();
                }
                this.advance();
            }
        }
        // Handle scientific notation
        if (this.peek().toLowerCase() === "e") {
            value += this.peek();
            this.advance();
            if (this.peek() === "+" || this.peek() === "-") {
                value += this.peek();
                this.advance();
            }
            while (this.position.index < this.source.length &&
                (this.isDigit(this.peek()) || this.peek() === "_")) {
                if (this.peek() !== "_") {
                    value += this.peek();
                }
                this.advance();
            }
        }
        // Handle complex numbers
        if (this.peek().toLowerCase() === "j") {
            value += this.peek();
            this.advance();
        }
        this.addTokenAt(exports.TokenType.NUMBER, value, start);
    }
    scanIdentifier() {
        const start = { ...this.position }; // Create a copy
        let value = "";
        while (this.position.index < this.source.length &&
            (this.isAlphaNumeric(this.peek()) || this.peek() === "_")) {
            value += this.peek();
            this.advance();
        }
        // Check if this is a string prefix (f, r, b, u, fr, rf, br, rb)
        if (this.isStringPrefix(value) &&
            (this.peek() === '"' || this.peek() === "'")) {
            // This is a prefixed string, scan the string part
            this.scanPrefixedString(value, start);
            return;
        }
        const tokenType = KEYWORDS.get(value) || exports.TokenType.NAME;
        this.addTokenAt(tokenType, value, start);
    }
    isStringPrefix(value) {
        const lowerValue = value.toLowerCase();
        return ["f", "r", "b", "u", "fr", "rf", "br", "rb"].includes(lowerValue);
    }
    scanPrefixedString(prefix, start) {
        const quote = this.peek();
        this.advance(); // consume opening quote
        // Check for triple quotes
        const isTripleQuote = this.peek() === quote && this.peekNext() === quote;
        if (isTripleQuote) {
            this.advance(); // consume second quote
            this.advance(); // consume third quote
        }
        let value = prefix + quote;
        if (isTripleQuote) {
            value += quote + quote;
        }
        while (this.position.index < this.source.length) {
            const c = this.peek();
            if (c === "\\") {
                value += c;
                this.advance();
                if (this.position.index < this.source.length) {
                    value += this.peek();
                    this.advance();
                }
                continue;
            }
            if (isTripleQuote) {
                if (c === quote &&
                    this.peekNext() === quote &&
                    this.peek(2) === quote) {
                    value += quote + quote + quote;
                    this.advance(); // consume first quote
                    this.advance(); // consume second quote
                    this.advance(); // consume third quote
                    break;
                }
            }
            else {
                if (c === quote) {
                    value += quote;
                    this.advance();
                    break;
                }
                if (c === "\n") {
                    throw new Error(`Unterminated string literal at line ${this.position.line}`);
                }
            }
            value += c;
            this.advance();
        }
        this.addTokenAt(exports.TokenType.STRING, value, start);
    }
    scanTwoCharOperator(twoChar) {
        const start = { ...this.position }; // Create a copy
        let tokenType = null;
        switch (twoChar) {
            case "**":
                tokenType = exports.TokenType.DOUBLESTAR;
                break;
            case "//":
                tokenType = exports.TokenType.DOUBLESLASH;
                break;
            case "<<":
                tokenType = exports.TokenType.LEFTSHIFT;
                break;
            case ">>":
                tokenType = exports.TokenType.RIGHTSHIFT;
                break;
            case "==":
                tokenType = exports.TokenType.EQEQUAL;
                break;
            case "!=":
                tokenType = exports.TokenType.NOTEQUAL;
                break;
            case "<=":
                tokenType = exports.TokenType.LESSEQUAL;
                break;
            case ">=":
                tokenType = exports.TokenType.GREATEREQUAL;
                break;
            case "+=":
                tokenType = exports.TokenType.PLUSEQUAL;
                break;
            case "-=":
                tokenType = exports.TokenType.MINEQUAL;
                break;
            case "*=":
                tokenType = exports.TokenType.STAREQUAL;
                break;
            case "/=":
                tokenType = exports.TokenType.SLASHEQUAL;
                break;
            case "%=":
                tokenType = exports.TokenType.PERCENTEQUAL;
                break;
            case "&=":
                tokenType = exports.TokenType.AMPEREQUAL;
                break;
            case "|=":
                tokenType = exports.TokenType.VBAREQUAL;
                break;
            case "^=":
                tokenType = exports.TokenType.CIRCUMFLEXEQUAL;
                break;
            case "@=":
                tokenType = exports.TokenType.ATEQUAL;
                break;
            case ":=":
                tokenType = exports.TokenType.COLONEQUAL;
                break;
            case "->":
                tokenType = exports.TokenType.RARROW;
                break;
        }
        if (tokenType) {
            this.advance();
            this.advance();
            this.addTokenAt(tokenType, twoChar, start);
            return true;
        }
        return false;
    }
    scanThreeCharOperator(threeChar) {
        const start = { ...this.position }; // Create a copy
        let tokenType = null;
        switch (threeChar) {
            case "...":
                tokenType = exports.TokenType.ELLIPSIS;
                break;
            case "<<=":
                tokenType = exports.TokenType.LEFTSHIFTEQUAL;
                break;
            case ">>=":
                tokenType = exports.TokenType.RIGHTSHIFTEQUAL;
                break;
            case "**=":
                tokenType = exports.TokenType.DOUBLESTAREQUAL;
                break;
            case "//=":
                tokenType = exports.TokenType.DOUBLESLASHEQUAL;
                break;
            case "^=":
                tokenType = exports.TokenType.CIRCUMFLEXEQUAL;
                break;
        }
        if (tokenType) {
            this.advance();
            this.advance();
            this.advance();
            this.addTokenAt(tokenType, threeChar, start);
            return true;
        }
        return false;
    }
    scanSingleCharOperator(c) {
        const start = { ...this.position }; // Create a copy
        let tokenType;
        switch (c) {
            case "+":
                tokenType = exports.TokenType.PLUS;
                break;
            case "-":
                tokenType = exports.TokenType.MINUS;
                break;
            case "*":
                tokenType = exports.TokenType.STAR;
                break;
            case "/":
                tokenType = exports.TokenType.SLASH;
                break;
            case "%":
                tokenType = exports.TokenType.PERCENT;
                break;
            case "@":
                tokenType = exports.TokenType.AT;
                break;
            case "|":
                tokenType = exports.TokenType.VBAR;
                break;
            case "&":
                tokenType = exports.TokenType.AMPER;
                break;
            case "^":
                tokenType = exports.TokenType.CIRCUMFLEX;
                break;
            case "~":
                tokenType = exports.TokenType.TILDE;
                break;
            case "(":
                tokenType = exports.TokenType.LPAR;
                this.parenLevel++;
                break;
            case ")":
                tokenType = exports.TokenType.RPAR;
                this.parenLevel--;
                break;
            case "[":
                tokenType = exports.TokenType.LSQB;
                this.bracketLevel++;
                break;
            case "]":
                tokenType = exports.TokenType.RSQB;
                this.bracketLevel--;
                break;
            case "{":
                tokenType = exports.TokenType.LBRACE;
                this.braceLevel++;
                break;
            case "}":
                tokenType = exports.TokenType.RBRACE;
                this.braceLevel--;
                break;
            case ",":
                tokenType = exports.TokenType.COMMA;
                break;
            case ":":
                tokenType = exports.TokenType.COLON;
                break;
            case ".":
                tokenType = exports.TokenType.DOT;
                break;
            case ";":
                tokenType = exports.TokenType.SEMI;
                break;
            case "=":
                tokenType = exports.TokenType.EQUAL;
                break;
            case "<":
                tokenType = exports.TokenType.LESS;
                break;
            case ">":
                tokenType = exports.TokenType.GREATER;
                break;
            case "\\":
                // Handle line continuation
                if (this.peek(1) === "\n") {
                    this.advance(); // consume '\\'
                    this.advance(); // consume '\n'
                    this.position.line++;
                    this.position.column = 0;
                    return; // Don't emit a token, just continue
                }
                else {
                    throw new Error(`Unexpected character '${c}' at line ${this.position.line}, column ${this.position.column}`);
                }
            default:
                throw new Error(`Unexpected character '${c}' at line ${this.position.line}, column ${this.position.column}`);
        }
        this.advance();
        this.addTokenAt(tokenType, c, start);
    }
    peek(offset = 0) {
        const index = this.position.index + offset;
        return index < this.source.length ? this.source[index] : "";
    }
    peekNext() {
        return this.peek(1);
    }
    advance() {
        const c = this.peek();
        if (c === "\n") {
            this.position.line++;
            this.position.column = 0;
        }
        else {
            this.position.column++;
        }
        this.position.index++;
        return c;
    }
    addToken(type, value) {
        this.addTokenAt(type, value, this.position);
    }
    addTokenAt(type, value, start) {
        this.tokens.push({
            type,
            value,
            lineno: start.line,
            col_offset: start.column,
            end_lineno: this.position.line,
            end_col_offset: this.position.column,
        });
    }
    isDigit(c) {
        return c >= "0" && c <= "9";
    }
    isHexDigit(c) {
        return this.isDigit(c) || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
    }
    isOctalDigit(c) {
        return c >= "0" && c <= "7";
    }
    isBinaryDigit(c) {
        return c === "0" || c === "1";
    }
    isAlpha(c) {
        // Support Unicode letters using regex
        return /^[\p{L}]$/u.test(c);
    }
    isAlphaNumeric(c) {
        return this.isAlpha(c) || this.isDigit(c);
    }
}

/**
 * Python Parser - Recursive Descent Parser for Python Source Code
 * Based on the Python ASDL grammar specification
 */
class Parser {
    constructor(source, options = {}) {
        this.current = 0;
        this.lastNonCommentTokenLine = 0; // Track the line of the last non-comment, non-newline token
        this.pendingComments = []; // Temporary storage for comments during expression parsing
        const lexer = new Lexer(source);
        this.tokens = lexer.tokenize();
        this.includeComments = options.comments ?? false;
        // Filter out comments unless needed
        if (!this.includeComments) {
            this.tokens = this.tokens.filter((token) => token.type !== exports.TokenType.COMMENT);
        }
    }
    parse() {
        this.current = 0;
        return this.parseFileInput();
    }
    // ==== Top level parser ====
    parseFileInput() {
        const body = [];
        // Skip leading newlines
        while (this.match(exports.TokenType.NEWLINE)) {
            // Skip
        }
        while (!this.isAtEnd()) {
            if (this.match(exports.TokenType.NEWLINE)) {
                continue;
            }
            // Handle comments that were collected during token peeking
            if (this.includeComments && this.pendingComments.length > 0) {
                for (const comment of this.pendingComments) {
                    // If this is an inline comment and we have a previous statement, attach it
                    if (comment.inline && body.length > 0) {
                        const lastStmt = body[body.length - 1];
                        // Add the comment as metadata to the last statement
                        if (!lastStmt.inlineComment) {
                            lastStmt.inlineComment = comment;
                        }
                    }
                    else {
                        // For standalone comments, add as separate statement
                        body.push(comment);
                    }
                }
                // Clear pending comments after processing
                this.pendingComments = [];
            }
            // Parse comments as proper statement nodes when includeComments is enabled
            if (this.includeComments && this.check(exports.TokenType.COMMENT)) {
                const comment = this.parseCommentStatement();
                // If this is an inline comment and we have a previous statement, attach it
                if (comment.inline && body.length > 0) {
                    const lastStmt = body[body.length - 1];
                    // Add the comment as metadata to the last statement
                    if (!lastStmt.inlineComment) {
                        lastStmt.inlineComment = comment;
                    }
                }
                else {
                    // For standalone comments, add as separate statement
                    body.push(comment);
                }
                continue;
            }
            const stmt = this.parseStatement();
            if (stmt) {
                body.push(stmt);
                // Process any comments that were collected during statement parsing
                if (this.includeComments && this.pendingComments.length > 0) {
                    for (const comment of this.pendingComments) {
                        if (comment.inline) {
                            // Attach inline comment to the statement we just parsed
                            if (!stmt.inlineComment) {
                                stmt.inlineComment = comment;
                            }
                        }
                        else {
                            // Add standalone comment as separate statement
                            body.push(comment);
                        }
                    }
                    // Clear pending comments after processing
                    this.pendingComments = [];
                }
            }
        }
        // Handle any remaining pending comments after the main parsing loop
        if (this.includeComments && this.pendingComments.length > 0) {
            for (const comment of this.pendingComments) {
                if (comment.inline && body.length > 0) {
                    // Attach inline comment to the last statement
                    const lastStmt = body[body.length - 1];
                    if (!lastStmt.inlineComment) {
                        lastStmt.inlineComment = comment;
                    }
                }
                else {
                    // Add standalone comment as separate statement
                    body.push(comment);
                }
            }
            // Clear pending comments after processing
            this.pendingComments = [];
        }
        const result = {
            nodeType: "Module",
            body,
            lineno: 1,
            col_offset: 0,
        };
        // If comments are enabled, collect all comments and add them to the module
        if (this.includeComments) {
            result.comments = this.collectAllComments(result);
        }
        return result;
    }
    // Parse a comment as a statement node
    parseCommentStatement() {
        const token = this.consume(exports.TokenType.COMMENT, "Expected comment");
        // Check if this is an inline comment (on the same line as previous content)
        const isInline = token.lineno === this.lastNonCommentTokenLine;
        return {
            nodeType: "Comment",
            value: token.value,
            lineno: token.lineno,
            col_offset: token.col_offset,
            end_lineno: token.end_lineno,
            end_col_offset: token.end_col_offset,
            inline: isInline,
        };
    }
    // Collect all comments from the AST (both standalone and inline)
    collectAllComments(module) {
        const comments = [];
        const collectFromBody = (body) => {
            for (const stmt of body) {
                if (stmt.nodeType === "Comment") {
                    comments.push(stmt);
                }
                else {
                    // Check for inline comments attached to this statement
                    if (stmt.inlineComment) {
                        comments.push(stmt.inlineComment);
                    }
                    // Recursively collect from nested bodies
                    this.collectFromStatement(stmt, comments);
                }
            }
        };
        collectFromBody(module.body);
        // Also include any pending comments from expression parsing
        comments.push(...this.pendingComments);
        return comments;
    }
    // Helper to collect comments from nested statement bodies
    collectFromStatement(stmt, comments) {
        switch (stmt.nodeType) {
            case "FunctionDef":
            case "AsyncFunctionDef":
                this.collectFromBody(stmt.body, comments);
                break;
            case "ClassDef":
                this.collectFromBody(stmt.body, comments);
                break;
            case "If":
                this.collectFromBody(stmt.body, comments);
                this.collectFromBody(stmt.orelse, comments);
                break;
            case "For":
            case "AsyncFor":
                this.collectFromBody(stmt.body, comments);
                this.collectFromBody(stmt.orelse, comments);
                break;
            case "While":
                this.collectFromBody(stmt.body, comments);
                this.collectFromBody(stmt.orelse, comments);
                break;
            case "With":
            case "AsyncWith":
                this.collectFromBody(stmt.body, comments);
                break;
            case "Try":
                this.collectFromBody(stmt.body, comments);
                if (stmt.handlers) {
                    for (const handler of stmt.handlers) {
                        this.collectFromBody(handler.body, comments);
                    }
                }
                this.collectFromBody(stmt.orelse, comments);
                this.collectFromBody(stmt.finalbody, comments);
                break;
            case "Match":
                if (stmt.cases) {
                    for (const case_ of stmt.cases) {
                        this.collectFromBody(case_.body, comments);
                    }
                }
                break;
        }
    }
    // Helper to collect comments from a statement body
    collectFromBody(body, comments) {
        for (const stmt of body) {
            if (stmt.nodeType === "Comment") {
                comments.push(stmt);
            }
            else {
                if (stmt.inlineComment) {
                    comments.push(stmt.inlineComment);
                }
                this.collectFromStatement(stmt, comments);
            }
        }
    } // ==== Statement parsers ====
    parseStatement() {
        // Handle indentation
        if (this.check(exports.TokenType.INDENT)) {
            // INDENT tokens should only appear after compound statements
            throw this.error("unexpected indent");
        }
        if (this.match(exports.TokenType.DEDENT)) {
            return null;
        }
        // Check for decorators first
        if (this.check(exports.TokenType.AT)) {
            return this.parseDecorated();
        }
        return this.parseSimpleStmt() || this.parseCompoundStmt();
    }
    parseSimpleStmt() {
        const stmt = this.parseSmallStmt();
        // Handle multiple statements on one line
        while (this.match(exports.TokenType.SEMI)) {
            if (!this.check(exports.TokenType.NEWLINE) && !this.isAtEnd()) {
                // Additional statements on the same line would go here
                // For simplicity, we'll just parse the first one
                break;
            }
        }
        this.match(exports.TokenType.NEWLINE); // Optional newline
        return stmt;
    }
    parseSmallStmt() {
        const start = this.peek();
        // Check if this is a compound statement keyword - let parseCompoundStmt handle it
        if (this.check(exports.TokenType.DEF) ||
            this.check(exports.TokenType.CLASS) ||
            this.check(exports.TokenType.IF) ||
            this.check(exports.TokenType.WHILE) ||
            this.check(exports.TokenType.FOR) ||
            this.check(exports.TokenType.TRY) ||
            this.check(exports.TokenType.WITH) ||
            this.check(exports.TokenType.ASYNC) ||
            this.check(exports.TokenType.MATCH)) {
            return null;
        }
        // Handle pass statement
        if (this.match(exports.TokenType.PASS)) {
            return {
                nodeType: "Pass",
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle break statement
        if (this.match(exports.TokenType.BREAK)) {
            return {
                nodeType: "Break",
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle continue statement
        if (this.match(exports.TokenType.CONTINUE)) {
            return {
                nodeType: "Continue",
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle return statement
        if (this.match(exports.TokenType.RETURN)) {
            let value;
            if (!this.check(exports.TokenType.NEWLINE) &&
                !this.check(exports.TokenType.SEMI) &&
                !this.isAtEnd()) {
                value = this.parseTestList();
            }
            return {
                nodeType: "Return",
                value,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle delete statement
        if (this.match(exports.TokenType.DEL)) {
            const targets = [];
            targets.push(this.parseExpr());
            while (this.match(exports.TokenType.COMMA)) {
                targets.push(this.parseExpr());
            }
            return {
                nodeType: "Delete",
                targets,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle global statement
        if (this.match(exports.TokenType.GLOBAL)) {
            const names = [];
            names.push(this.consume(exports.TokenType.NAME, "Expected name after 'global'").value);
            while (this.match(exports.TokenType.COMMA)) {
                names.push(this.consume(exports.TokenType.NAME, "Expected name after ','").value);
            }
            return {
                nodeType: "Global",
                names,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle nonlocal statement
        if (this.match(exports.TokenType.NONLOCAL)) {
            const names = [];
            names.push(this.consume(exports.TokenType.NAME, "Expected name after 'nonlocal'").value);
            while (this.match(exports.TokenType.COMMA)) {
                names.push(this.consume(exports.TokenType.NAME, "Expected name after ','").value);
            }
            return {
                nodeType: "Nonlocal",
                names,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle import statement
        if (this.match(exports.TokenType.IMPORT)) {
            const names = [];
            do {
                let name = this.consume(exports.TokenType.NAME, "Expected module name").value;
                // Handle dotted names like 'os.path'
                while (this.match(exports.TokenType.DOT)) {
                    name += `.${this.consume(exports.TokenType.NAME, "Expected name after '.'").value}`;
                }
                let asname;
                if (this.match(exports.TokenType.AS)) {
                    asname = this.consume(exports.TokenType.NAME, "Expected name after 'as'").value;
                }
                names.push({ name, asname });
            } while (this.match(exports.TokenType.COMMA));
            return {
                nodeType: "Import",
                names: names.map((n) => ({
                    nodeType: "Alias",
                    name: n.name,
                    asname: n.asname,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                })),
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle from import statement
        if (this.match(exports.TokenType.FROM)) {
            let level = 0;
            // Handle relative imports (.., ., ..., etc.)
            while (this.match(exports.TokenType.DOT)) {
                level++;
            }
            // Handle ellipsis (...) as three dots
            if (this.match(exports.TokenType.ELLIPSIS)) {
                level += 3;
            }
            let module;
            if (this.check(exports.TokenType.NAME)) {
                module = this.advance().value;
                // Handle dotted module names
                while (this.match(exports.TokenType.DOT)) {
                    module += `.${this.consume(exports.TokenType.NAME, "Expected name after '.'").value}`;
                }
            }
            this.consume(exports.TokenType.IMPORT, "Expected 'import' after module name");
            const names = [];
            // Handle parenthesized import lists
            const hasParens = this.match(exports.TokenType.LPAR);
            if (this.match(exports.TokenType.STAR)) {
                names.push({ name: "*" });
            }
            else {
                // Parse the first name
                const firstName = this.consume(exports.TokenType.NAME, "Expected name").value;
                let firstAsname;
                if (this.match(exports.TokenType.AS)) {
                    firstAsname = this.consume(exports.TokenType.NAME, "Expected name after 'as'").value;
                }
                names.push({ name: firstName, asname: firstAsname });
                // Parse additional names if there are commas
                while (this.match(exports.TokenType.COMMA)) {
                    // Skip any newlines after comma (for multiline imports)
                    while (this.match(exports.TokenType.NEWLINE)) {
                        // Skip newlines
                    }
                    // Check if we've reached the end (trailing comma case)
                    if (hasParens && this.check(exports.TokenType.RPAR))
                        break;
                    if (!hasParens && (this.check(exports.TokenType.NEWLINE) || this.isAtEnd()))
                        break;
                    const name = this.consume(exports.TokenType.NAME, "Expected name").value;
                    let asname;
                    if (this.match(exports.TokenType.AS)) {
                        asname = this.consume(exports.TokenType.NAME, "Expected name after 'as'").value;
                    }
                    names.push({ name, asname });
                }
            }
            if (hasParens) {
                this.consume(exports.TokenType.RPAR, "Expected ')' after import list");
            }
            return {
                nodeType: "ImportFrom",
                module,
                names: names.map((n) => ({
                    nodeType: "Alias",
                    name: n.name,
                    asname: n.asname,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                })),
                level,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle raise statement
        if (this.match(exports.TokenType.RAISE)) {
            let exc;
            let cause;
            if (!this.check(exports.TokenType.NEWLINE) &&
                !this.check(exports.TokenType.SEMI) &&
                !this.check(exports.TokenType.DEDENT) &&
                !this.check(exports.TokenType.COMMENT) &&
                !this.isAtEnd()) {
                exc = this.parseTest();
                if (this.match(exports.TokenType.FROM)) {
                    cause = this.parseTest();
                }
            }
            return {
                nodeType: "Raise",
                exc,
                cause,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle assert statement
        if (this.match(exports.TokenType.ASSERT)) {
            const test = this.parseTest();
            let msg;
            if (this.match(exports.TokenType.COMMA)) {
                msg = this.parseTest();
            }
            return {
                nodeType: "Assert",
                test,
                msg,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Handle type alias statement (Python 3.12+)
        if (this.check(exports.TokenType.NAME) && this.peek().value === "type") {
            const start = this.peek();
            this.advance(); // consume 'type'
            const nameToken = this.consume(exports.TokenType.NAME, "Expected type alias name").value;
            // Type parameters (optional)
            const type_params = this.parseTypeParams();
            this.consume(exports.TokenType.EQUAL, "Expected '=' in type alias");
            const value = this.parseTest();
            return {
                nodeType: "TypeAlias",
                name: {
                    nodeType: "Name",
                    id: nameToken,
                    ctx: { nodeType: "Store" },
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                },
                type_params,
                value,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Expression statement (including assignments)
        const expr = this.parseTestListWithStar();
        // Check for assignment operators
        if (this.match(exports.TokenType.EQUAL)) {
            // Regular assignment - handle multiple assignment
            const targets = [expr];
            this.validateAssignmentTarget(expr);
            let value = this.parseTestList();
            // Collect any comments that were gathered during value parsing
            const expressionComments = [];
            if (this.includeComments && this.pendingComments.length > 0) {
                expressionComments.push(...this.pendingComments);
                this.pendingComments = [];
            }
            // Check for chained assignments like x = y = z
            while (this.match(exports.TokenType.EQUAL)) {
                this.validateAssignmentTarget(value);
                targets.push(value);
                value = this.parseTestList();
                // Collect any additional comments from chained assignment parsing
                if (this.includeComments && this.pendingComments.length > 0) {
                    expressionComments.push(...this.pendingComments);
                    this.pendingComments = [];
                }
            }
            const assignNode = {
                nodeType: "Assign",
                targets,
                value,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
            // Attach all collected expression comments
            if (expressionComments.length > 0) {
                // For now, attach the first inline comment as inlineComment
                // and store the rest as a special property
                const inlineComments = expressionComments.filter((c) => c.inline);
                const standaloneComments = expressionComments.filter((c) => !c.inline);
                if (inlineComments.length > 0) {
                    assignNode.inlineComment = inlineComments[0];
                }
                // Store additional comments for unparsing
                if (inlineComments.length > 1 || standaloneComments.length > 0) {
                    assignNode.expressionComments = expressionComments;
                }
            }
            return assignNode;
        }
        else if (this.matchAugAssign()) {
            // Augmented assignment
            this.validateAssignmentTarget(expr);
            const op = this.parseAugAssignOp();
            const value = this.parseTest();
            return {
                nodeType: "AugAssign",
                target: expr,
                op,
                value,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        else if (this.match(exports.TokenType.COLON)) {
            // Annotated assignment
            const annotation = this.parseTest();
            let value;
            if (this.match(exports.TokenType.EQUAL)) {
                value = this.parseTestList();
            }
            return {
                nodeType: "AnnAssign",
                target: expr,
                annotation,
                value,
                simple: this.isSimpleTarget(expr) ? 1 : 0,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Expression statement
        return {
            nodeType: "Expr",
            value: expr,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseCompoundStmt() {
        const start = this.peek();
        // Handle decorators
        if (this.check(exports.TokenType.AT)) {
            return this.parseDecorated();
        }
        if (this.match(exports.TokenType.IF)) {
            return this.parseIfStmt(start);
        }
        else if (this.match(exports.TokenType.WHILE)) {
            return this.parseWhileStmt(start);
        }
        else if (this.match(exports.TokenType.FOR)) {
            return this.parseForStmt(start);
        }
        else if (this.match(exports.TokenType.TRY)) {
            return this.parseTryStmt(start);
        }
        else if (this.match(exports.TokenType.WITH)) {
            return this.parseWithStmt(start);
        }
        else if (this.match(exports.TokenType.DEF)) {
            return this.parseFunctionDef(start);
        }
        else if (this.match(exports.TokenType.CLASS)) {
            return this.parseClassDef(start);
        }
        else if (this.match(exports.TokenType.ASYNC)) {
            return this.parseAsyncStmt(start);
        }
        else if (this.match(exports.TokenType.MATCH)) {
            return this.parseMatchStmt(start);
        }
        return null;
    }
    parseDecorated() {
        const decorators = this.parseDecorators();
        if (this.match(exports.TokenType.DEF)) {
            return this.parseFunctionDef(this.previous(), decorators);
        }
        else if (this.match(exports.TokenType.CLASS)) {
            return this.parseClassDef(this.previous(), decorators);
        }
        else if (this.match(exports.TokenType.ASYNC)) {
            if (this.match(exports.TokenType.DEF)) {
                return this.parseAsyncFunctionDef(this.previous(), decorators);
            }
        }
        // Handle type alias statement
        if (this.check(exports.TokenType.NAME) && this.checkNext(exports.TokenType.LSQB)) {
            // Possible type alias with type parameters
            const nameStart = this.peek();
            const nameToken = this.advance();
            // Parse type parameters
            const type_params = this.parseTypeParams();
            this.consume(exports.TokenType.EQUAL, "Expected '=' in type alias");
            const value = this.parseTest();
            return {
                nodeType: "TypeAlias",
                name: {
                    nodeType: "Name",
                    id: nameToken.value,
                    ctx: { nodeType: "Store" },
                    lineno: nameToken.lineno,
                    col_offset: nameToken.col_offset,
                },
                type_params,
                value,
                lineno: nameStart.lineno,
                col_offset: nameStart.col_offset,
            };
        }
        throw new Error("Invalid decorator target");
    }
    parseDecorators() {
        const decorators = [];
        while (this.match(exports.TokenType.AT)) {
            const decorator = this.parseTest();
            decorators.push(decorator);
            this.match(exports.TokenType.NEWLINE);
        }
        return decorators;
    }
    parseIfStmt(start) {
        const test = this.parseTest();
        this.consume(exports.TokenType.COLON, "Expected ':' after if condition");
        const body = this.parseSuite();
        let orelse = [];
        if (this.match(exports.TokenType.ELIF)) {
            // Convert elif to nested if-else
            orelse = [this.parseIfStmt(this.previous())];
        }
        else if (this.match(exports.TokenType.ELSE)) {
            this.consume(exports.TokenType.COLON, "Expected ':' after else");
            orelse = this.parseSuite();
        }
        return {
            nodeType: "If",
            test,
            body,
            orelse,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseWhileStmt(start) {
        const test = this.parseTest();
        this.consume(exports.TokenType.COLON, "Expected ':' after while condition");
        const body = this.parseSuite();
        let orelse = [];
        if (this.match(exports.TokenType.ELSE)) {
            this.consume(exports.TokenType.COLON, "Expected ':' after else");
            orelse = this.parseSuite();
        }
        return {
            nodeType: "While",
            test,
            body,
            orelse,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseForStmt(start) {
        const target = this.parseExprList();
        this.consume(exports.TokenType.IN, "Expected 'in' in for statement");
        const iter = this.parseTestList();
        this.consume(exports.TokenType.COLON, "Expected ':' after for clause");
        const body = this.parseSuite();
        let orelse = [];
        if (this.match(exports.TokenType.ELSE)) {
            this.consume(exports.TokenType.COLON, "Expected ':' after else");
            orelse = this.parseSuite();
        }
        return {
            nodeType: "For",
            target,
            iter,
            body,
            orelse,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseFunctionDef(start, decorators = []) {
        const name = this.consume(exports.TokenType.NAME, "Expected function name").value;
        // Type parameters (Python 3.12+)
        const type_params = this.parseTypeParams();
        this.consume(exports.TokenType.LPAR, "Expected '(' after function name");
        const args = this.parseParameters();
        this.consume(exports.TokenType.RPAR, "Expected ')' after parameters");
        let returns;
        if (this.match(exports.TokenType.RARROW)) {
            returns = this.parseTest();
        }
        this.consume(exports.TokenType.COLON, "Expected ':' after function header");
        const body = this.parseSuite();
        return {
            nodeType: "FunctionDef",
            name,
            args,
            body,
            decorator_list: decorators,
            returns,
            type_params,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseAsyncFunctionDef(start, decorators = []) {
        const name = this.consume(exports.TokenType.NAME, "Expected function name").value;
        // Type parameters (Python 3.12+)
        const type_params = this.parseTypeParams();
        this.consume(exports.TokenType.LPAR, "Expected '(' after function name");
        const args = this.parseParameters();
        this.consume(exports.TokenType.RPAR, "Expected ')' after parameters");
        let returns;
        if (this.match(exports.TokenType.RARROW)) {
            returns = this.parseTest();
        }
        this.consume(exports.TokenType.COLON, "Expected ':' after function header");
        const body = this.parseSuite();
        return {
            nodeType: "AsyncFunctionDef",
            name,
            args,
            body,
            decorator_list: decorators,
            returns,
            type_params,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseClassDef(start, decorators = []) {
        const name = this.consume(exports.TokenType.NAME, "Expected class name").value;
        // Type parameters (Python 3.12+)
        const type_params = this.parseTypeParams();
        const bases = [];
        const keywords = [];
        if (this.match(exports.TokenType.LPAR)) {
            if (!this.check(exports.TokenType.RPAR)) {
                // Parse base classes and keyword arguments
                do {
                    if (this.check(exports.TokenType.RPAR))
                        break;
                    // Check if this is a keyword argument (name=value)
                    const savedPos = this.current;
                    if (this.check(exports.TokenType.NAME)) {
                        const nameToken = this.advance();
                        if (this.match(exports.TokenType.EQUAL)) {
                            // This is a keyword argument
                            const value = this.parseTest();
                            keywords.push({
                                nodeType: "Keyword",
                                arg: nameToken.value,
                                value,
                                lineno: nameToken.lineno,
                                col_offset: nameToken.col_offset,
                            });
                        }
                        else {
                            // This is a base class, rewind and parse as expression
                            this.current = savedPos;
                            bases.push(this.parseTest());
                        }
                    }
                    else {
                        // Not a name, parse as base class expression
                        bases.push(this.parseTest());
                    }
                } while (this.match(exports.TokenType.COMMA));
            }
            this.consume(exports.TokenType.RPAR, "Expected ')' after class bases");
        }
        this.consume(exports.TokenType.COLON, "Expected ':' after class header");
        const body = this.parseSuite();
        return {
            nodeType: "ClassDef",
            name,
            bases,
            keywords,
            body,
            decorator_list: decorators,
            type_params,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseTryStmt(start) {
        this.consume(exports.TokenType.COLON, "Expected ':' after try");
        const body = this.parseSuite();
        const handlers = [];
        let orelse = [];
        let finalbody = [];
        // Parse except clauses
        let hasStarHandler = false;
        let hasRegularHandler = false;
        while (this.match(exports.TokenType.EXCEPT)) {
            const handlerStart = this.previous();
            let type;
            let name;
            // Check for except* syntax
            if (this.match(exports.TokenType.STAR)) {
                hasStarHandler = true;
                if (hasRegularHandler) {
                    throw this.error("cannot have both 'except' and 'except*' on the same 'try'");
                }
                if (!this.check(exports.TokenType.COLON)) {
                    type = this.parseTest();
                    if (this.match(exports.TokenType.AS)) {
                        name = this.consume(exports.TokenType.NAME, "Expected name after 'as'").value;
                    }
                }
            }
            else {
                hasRegularHandler = true;
                if (hasStarHandler) {
                    throw this.error("cannot have both 'except' and 'except*' on the same 'try'");
                }
                if (!this.check(exports.TokenType.COLON)) {
                    type = this.parseTest();
                    if (this.match(exports.TokenType.AS)) {
                        name = this.consume(exports.TokenType.NAME, "Expected name after 'as'").value;
                    }
                }
            }
            this.consume(exports.TokenType.COLON, "Expected ':' after except clause");
            const handlerBody = this.parseSuite();
            handlers.push({
                nodeType: "ExceptHandler",
                type,
                name,
                body: handlerBody,
                lineno: handlerStart.lineno,
                col_offset: handlerStart.col_offset,
            });
        }
        if (this.match(exports.TokenType.ELSE)) {
            this.consume(exports.TokenType.COLON, "Expected ':' after else");
            orelse = this.parseSuite();
        }
        if (this.match(exports.TokenType.FINALLY)) {
            this.consume(exports.TokenType.COLON, "Expected ':' after finally");
            finalbody = this.parseSuite();
        }
        return {
            nodeType: hasStarHandler ? "TryStar" : "Try",
            body,
            handlers,
            orelse,
            finalbody,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseWithStmt(start) {
        const items = [];
        // Parse with items
        do {
            const context_expr = this.parseTest();
            let optional_vars;
            if (this.match(exports.TokenType.AS)) {
                optional_vars = this.parseExpr();
            }
            items.push({
                nodeType: "WithItem",
                context_expr,
                optional_vars,
            });
        } while (this.match(exports.TokenType.COMMA));
        this.consume(exports.TokenType.COLON, "Expected ':' after with clause");
        const body = this.parseSuite();
        return {
            nodeType: "With",
            items,
            body,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseAsyncStmt(start) {
        if (this.match(exports.TokenType.DEF)) {
            // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for object spreading
            const funcDef = this.parseFunctionDef(this.previous());
            return {
                ...funcDef,
                nodeType: "AsyncFunctionDef",
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        else if (this.match(exports.TokenType.FOR)) {
            // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for object spreading
            const forStmt = this.parseForStmt(this.previous());
            return {
                ...forStmt,
                nodeType: "AsyncFor",
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        else if (this.match(exports.TokenType.WITH)) {
            // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for object spreading
            const withStmt = this.parseWithStmt(this.previous());
            return {
                ...withStmt,
                nodeType: "AsyncWith",
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        throw this.error("Invalid async statement");
    }
    parseMatchStmt(start) {
        const subject = this.parseTest();
        this.consume(exports.TokenType.COLON, "Expected ':' after match subject");
        // Match statements must always be multi-line with proper indentation
        this.consume(exports.TokenType.NEWLINE, "Expected newline after match:");
        // Skip comment tokens and newlines that might appear before the indent
        // (These comments belong to the match statement level, not the case level)
        while (this.check(exports.TokenType.COMMENT) || this.check(exports.TokenType.NEWLINE)) {
            this.advance();
        }
        this.consume(exports.TokenType.INDENT, "Expected indented block");
        const cases = [];
        while (!this.check(exports.TokenType.DEDENT) && !this.isAtEnd()) {
            if (this.match(exports.TokenType.NEWLINE)) {
                continue;
            }
            // When includeComments is true, comments will be parsed as statements in parseSuite
            // For now, skip comments at the case level (this could be enhanced later)
            if (!this.includeComments) {
                while (this.check(exports.TokenType.COMMENT)) {
                    this.advance();
                }
            }
            if (this.match(exports.TokenType.CASE)) {
                this.previous(); // consume case token
                const pattern = this.parsePattern();
                let guard;
                if (this.match(exports.TokenType.IF)) {
                    guard = this.parseTest();
                }
                this.consume(exports.TokenType.COLON, "Expected ':' after case pattern");
                const body = this.parseSuite();
                cases.push({
                    nodeType: "MatchCase",
                    pattern,
                    guard,
                    body,
                });
            }
            else {
                throw this.error("Expected 'case' in match statement");
            }
        }
        this.consume(exports.TokenType.DEDENT, "Expected dedent");
        return {
            nodeType: "Match",
            subject,
            cases,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parsePattern() {
        return this.parseOrPattern();
    }
    parseOrPattern() {
        const patterns = [];
        const start = this.peek();
        patterns.push(this.parseBasicPattern());
        while (this.match(exports.TokenType.VBAR)) {
            patterns.push(this.parseBasicPattern());
        }
        if (patterns.length === 1) {
            return patterns[0];
        }
        return {
            nodeType: "MatchOr",
            patterns,
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseBasicPattern() {
        const start = this.peek();
        // Check for expressions that could be class patterns (like int(), str(), etc.)
        if (this.check(exports.TokenType.NAME)) {
            const nameToken = this.peek();
            // Look ahead to see if this is a function call pattern
            if (this.peekNext().type === exports.TokenType.LPAR) {
                // Parse the class name
                const className = this.advance(); // consume the name
                this.advance(); // consume the (
                const patterns = [];
                const kwd_attrs = [];
                const kwd_patterns = [];
                if (!this.check(exports.TokenType.RPAR)) {
                    do {
                        // Check for keyword patterns
                        if (this.check(exports.TokenType.NAME) &&
                            this.peekNext().type === exports.TokenType.EQUAL) {
                            const kwdName = this.advance().value;
                            this.advance(); // consume =
                            const kwdPattern = this.parsePattern();
                            kwd_attrs.push(kwdName);
                            kwd_patterns.push(kwdPattern);
                        }
                        else {
                            // Positional pattern
                            patterns.push(this.parsePattern());
                        }
                    } while (this.match(exports.TokenType.COMMA) && !this.check(exports.TokenType.RPAR));
                }
                this.consume(exports.TokenType.RPAR, "Expected ')' in class pattern");
                const cls = {
                    nodeType: "Name",
                    id: className.value,
                    ctx: this.createLoad(),
                    lineno: className.lineno,
                    col_offset: className.col_offset,
                };
                return {
                    nodeType: "MatchClass",
                    cls,
                    patterns,
                    kwd_attrs,
                    kwd_patterns,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            // Wildcard pattern (_)
            if (nameToken.value === "_") {
                this.advance(); // consume the _
                return {
                    nodeType: "MatchAs",
                    pattern: undefined,
                    name: "_",
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            // Regular name pattern (variable binding)
            this.advance(); // consume the name
            return {
                nodeType: "MatchAs",
                pattern: undefined,
                name: nameToken.value,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // List pattern [...]
        if (this.match(exports.TokenType.LSQB)) {
            const patterns = [];
            if (!this.check(exports.TokenType.RSQB)) {
                patterns.push(this.parsePattern());
                while (this.match(exports.TokenType.COMMA)) {
                    if (this.check(exports.TokenType.RSQB))
                        break;
                    patterns.push(this.parsePattern());
                }
            }
            this.consume(exports.TokenType.RSQB, "Expected ']' after list pattern");
            return {
                nodeType: "MatchSequence",
                patterns,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Tuple pattern (...)
        if (this.match(exports.TokenType.LPAR)) {
            const patterns = [];
            if (!this.check(exports.TokenType.RPAR)) {
                patterns.push(this.parsePattern());
                while (this.match(exports.TokenType.COMMA)) {
                    if (this.check(exports.TokenType.RPAR))
                        break;
                    patterns.push(this.parsePattern());
                }
            }
            this.consume(exports.TokenType.RPAR, "Expected ')' after tuple pattern");
            return {
                nodeType: "MatchSequence",
                patterns,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Dictionary pattern {...}
        if (this.match(exports.TokenType.LBRACE)) {
            const keys = [];
            const patterns = [];
            let rest;
            if (!this.check(exports.TokenType.RBRACE)) {
                do {
                    if (this.match(exports.TokenType.DOUBLESTAR)) {
                        // **rest pattern
                        rest = this.consume(exports.TokenType.NAME, "Expected name after '**'").value;
                        break;
                    }
                    // Parse key expression
                    const key = this.parseTest();
                    this.consume(exports.TokenType.COLON, "Expected ':' in mapping pattern");
                    // Parse value pattern
                    const pattern = this.parsePattern();
                    keys.push(key);
                    patterns.push(pattern);
                } while (this.match(exports.TokenType.COMMA) && !this.check(exports.TokenType.RBRACE));
            }
            this.consume(exports.TokenType.RBRACE, "Expected '}' after mapping pattern");
            return {
                nodeType: "MatchMapping",
                keys,
                patterns,
                rest,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        if (this.match(exports.TokenType.NUMBER, exports.TokenType.STRING, exports.TokenType.TRUE, exports.TokenType.FALSE, exports.TokenType.NONE)) {
            const token = this.previous();
            // biome-ignore lint/suspicious/noExplicitAny: Value can be string, number, boolean, or null
            let value;
            switch (token.type) {
                case exports.TokenType.NUMBER:
                    value = this.parseNumber(token.value);
                    break;
                case exports.TokenType.STRING:
                    value = this.parseString(token.value);
                    break;
                case exports.TokenType.TRUE:
                    value = true;
                    break;
                case exports.TokenType.FALSE:
                    value = false;
                    break;
                case exports.TokenType.NONE:
                    value = null;
                    break;
                default:
                    value = token.value;
            }
            return {
                nodeType: "MatchValue",
                value: {
                    nodeType: "Constant",
                    value,
                    lineno: token.lineno,
                    col_offset: token.col_offset,
                },
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Wildcard pattern
        if (this.match(exports.TokenType.STAR)) {
            let name;
            if (this.check(exports.TokenType.NAME)) {
                name = this.advance().value;
            }
            return {
                nodeType: "MatchStar",
                name,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Default fallback - create a wildcard
        return {
            nodeType: "MatchAs",
            pattern: undefined,
            name: "_",
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    // ==== Expression parsers ====
    parseTestList() {
        const expr = this.parseTest();
        if (this.match(exports.TokenType.COMMA)) {
            const elts = [expr];
            // Handle trailing commas and additional elements
            while (!this.check(exports.TokenType.NEWLINE) &&
                !this.isAtEnd() &&
                !this.check(exports.TokenType.RPAR) &&
                !this.check(exports.TokenType.RSQB) &&
                !this.check(exports.TokenType.RBRACE)) {
                elts.push(this.parseTest());
                if (!this.match(exports.TokenType.COMMA))
                    break;
            }
            return {
                nodeType: "Tuple",
                elts,
                ctx: this.createLoad(),
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseTest() {
        const expr = this.parseOrTest();
        if (this.match(exports.TokenType.IF)) {
            const test = this.parseOrTest();
            this.consume(exports.TokenType.ELSE, "Expected 'else' in conditional expression");
            const orelse = this.parseTest();
            return {
                nodeType: "IfExp",
                test,
                body: expr,
                orelse,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseArgument() {
        // Parse an argument that could be a generator expression
        const start = this.current;
        const expr = this.parseTest();
        // Check if this is a generator expression by looking for 'for' keyword
        if (this.check(exports.TokenType.FOR)) {
            this.advance(); // consume 'for'
            const generators = this.parseComprehensionsAfterFor();
            return {
                nodeType: "GeneratorExp",
                elt: expr,
                generators,
                lineno: this.tokens[start].lineno,
                col_offset: this.tokens[start].col_offset,
            };
        }
        return expr;
    }
    parseOrTest() {
        // Check for lambda expression first
        if (this.match(exports.TokenType.LAMBDA)) {
            const start = this.previous();
            let args;
            if (this.check(exports.TokenType.COLON)) {
                // Lambda with no parameters
                args = {
                    nodeType: "Arguments",
                    posonlyargs: [],
                    args: [],
                    vararg: undefined,
                    kwonlyargs: [],
                    kw_defaults: [],
                    kwarg: undefined,
                    defaults: [],
                };
            }
            else {
                args = this.parseLambdaParameters();
            }
            this.consume(exports.TokenType.COLON, "Expected ':' after lambda parameters");
            const body = this.parseTest();
            return {
                nodeType: "Lambda",
                args,
                body,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        const expr = this.parseAndTest();
        if (this.match(exports.TokenType.OR)) {
            const values = [expr];
            do {
                values.push(this.parseAndTest());
            } while (this.match(exports.TokenType.OR));
            return {
                nodeType: "BoolOp",
                op: { nodeType: "Or" },
                values,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseAndTest() {
        const expr = this.parseNotTest();
        // Check for named expression (walrus operator :=)
        if (this.match(exports.TokenType.COLONEQUAL)) {
            const value = this.parseAndTest();
            return {
                nodeType: "NamedExpr",
                target: expr,
                value,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        if (this.match(exports.TokenType.AND)) {
            const values = [expr];
            do {
                values.push(this.parseNotTest());
            } while (this.match(exports.TokenType.AND));
            return {
                nodeType: "BoolOp",
                op: { nodeType: "And" },
                values,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseNotTest() {
        if (this.match(exports.TokenType.NOT)) {
            const start = this.previous();
            const operand = this.parseNotTest();
            return {
                nodeType: "UnaryOp",
                op: { nodeType: "Not" },
                operand,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        return this.parseComparison();
    }
    parseComparison() {
        const expr = this.parseExpr();
        if (this.matchComparison()) {
            const ops = [];
            const comparators = [];
            do {
                ops.push(this.parseCompOp());
                comparators.push(this.parseExpr());
            } while (this.matchComparison());
            return {
                nodeType: "Compare",
                left: expr,
                ops,
                comparators,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseExpr() {
        return this.parseOrExpr();
    }
    parseOrExpr() {
        let expr = this.parseXorExpr();
        while (this.match(exports.TokenType.VBAR)) {
            const op = { nodeType: "BitOr" };
            const right = this.parseXorExpr();
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseXorExpr() {
        let expr = this.parseAndExpr();
        while (this.match(exports.TokenType.CIRCUMFLEX)) {
            const op = { nodeType: "BitXor" };
            const right = this.parseAndExpr();
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseAndExpr() {
        let expr = this.parseShiftExpr();
        while (this.match(exports.TokenType.AMPER)) {
            const op = { nodeType: "BitAnd" };
            const right = this.parseShiftExpr();
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseShiftExpr() {
        let expr = this.parseArithExpr();
        while (this.match(exports.TokenType.LEFTSHIFT, exports.TokenType.RIGHTSHIFT)) {
            const opToken = this.previous();
            const op = opToken.type === exports.TokenType.LEFTSHIFT
                ? { nodeType: "LShift" }
                : { nodeType: "RShift" };
            const right = this.parseArithExpr();
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseArithExpr() {
        let expr = this.parseTerm();
        while (this.match(exports.TokenType.PLUS, exports.TokenType.MINUS)) {
            const opToken = this.previous();
            const op = opToken.type === exports.TokenType.PLUS
                ? { nodeType: "Add" }
                : { nodeType: "Sub" };
            const right = this.parseTerm();
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseTerm() {
        let expr = this.parseFactor();
        while (this.match(exports.TokenType.STAR, exports.TokenType.AT, exports.TokenType.SLASH, exports.TokenType.DOUBLESLASH, exports.TokenType.PERCENT)) {
            const opToken = this.previous();
            let op;
            switch (opToken.type) {
                case exports.TokenType.STAR:
                    op = { nodeType: "Mult" };
                    break;
                case exports.TokenType.AT:
                    op = { nodeType: "MatMult" };
                    break;
                case exports.TokenType.SLASH:
                    op = { nodeType: "Div" };
                    break;
                case exports.TokenType.DOUBLESLASH:
                    op = { nodeType: "FloorDiv" };
                    break;
                case exports.TokenType.PERCENT:
                    op = { nodeType: "Mod" };
                    break;
                default:
                    throw this.error("Unexpected operator");
            }
            const right = this.parseFactor();
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseFactor() {
        // Handle await expressions at factor level (unary)
        if (this.match(exports.TokenType.AWAIT)) {
            const start = this.previous();
            const value = this.parseFactor();
            return {
                nodeType: "Await",
                value,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        if (this.match(exports.TokenType.PLUS, exports.TokenType.MINUS, exports.TokenType.TILDE)) {
            const start = this.previous();
            let op;
            switch (start.type) {
                case exports.TokenType.PLUS:
                    op = { nodeType: "UAdd" };
                    break;
                case exports.TokenType.MINUS:
                    op = { nodeType: "USub" };
                    break;
                case exports.TokenType.TILDE:
                    op = { nodeType: "Invert" };
                    break;
                default:
                    throw this.error("Unexpected unary operator");
            }
            const operand = this.parseFactor();
            return {
                nodeType: "UnaryOp",
                op,
                operand,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        return this.parsePower();
    }
    parsePower() {
        let expr = this.parseAtomWithTrailers();
        if (this.match(exports.TokenType.DOUBLESTAR)) {
            const op = { nodeType: "Pow" };
            const right = this.parseFactor(); // Right associative
            expr = {
                nodeType: "BinOp",
                left: expr,
                op,
                right,
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseAtomWithTrailers() {
        let expr = this.parseAtom();
        // Handle subscripts, attributes, and function calls
        while (true) {
            if (this.match(exports.TokenType.DOT)) {
                const attr = this.consume(exports.TokenType.NAME, "Expected attribute name").value;
                expr = {
                    nodeType: "Attribute",
                    value: expr,
                    attr,
                    ctx: this.createLoad(),
                    lineno: expr.lineno || 1,
                    col_offset: expr.col_offset || 0,
                };
            }
            else if (this.match(exports.TokenType.LSQB)) {
                const slice = this.parseSubscriptList();
                this.consume(exports.TokenType.RSQB, "Expected ']'");
                expr = {
                    nodeType: "Subscript",
                    value: expr,
                    slice,
                    ctx: this.createLoad(),
                    lineno: expr.lineno || 1,
                    col_offset: expr.col_offset || 0,
                };
            }
            else if (this.match(exports.TokenType.LPAR)) {
                // Function call
                const args = [];
                const keywords = [];
                if (!this.check(exports.TokenType.RPAR)) {
                    do {
                        if (this.check(exports.TokenType.RPAR))
                            break;
                        // Check for keyword arguments
                        if (this.check(exports.TokenType.NAME) && this.checkNext(exports.TokenType.EQUAL)) {
                            const argName = this.advance().value;
                            this.advance(); // consume '='
                            const value = this.parseTest();
                            keywords.push({
                                nodeType: "Keyword",
                                arg: argName,
                                value,
                                lineno: this.previous().lineno,
                                col_offset: this.previous().col_offset,
                            });
                        }
                        else if (this.match(exports.TokenType.DOUBLESTAR)) {
                            // **kwargs
                            const value = this.parseTest();
                            keywords.push({
                                nodeType: "Keyword",
                                arg: undefined,
                                value,
                                lineno: this.previous().lineno,
                                col_offset: this.previous().col_offset,
                            });
                        }
                        else if (this.match(exports.TokenType.STAR)) {
                            // *args
                            const value = this.parseTest();
                            args.push({
                                nodeType: "Starred",
                                value,
                                ctx: this.createLoad(),
                                lineno: this.previous().lineno,
                                col_offset: this.previous().col_offset,
                            });
                        }
                        else {
                            const arg = this.parseArgument();
                            args.push(arg);
                        }
                    } while (this.match(exports.TokenType.COMMA));
                }
                this.consume(exports.TokenType.RPAR, "Expected ')' after arguments");
                expr = {
                    nodeType: "Call",
                    func: expr,
                    args,
                    keywords,
                    lineno: expr.lineno || 1,
                    col_offset: expr.col_offset || 0,
                };
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseAtom() {
        const start = this.peek();
        // Handle yield expressions
        if (this.match(exports.TokenType.YIELD)) {
            if (this.match(exports.TokenType.FROM)) {
                const value = this.parseTest();
                return {
                    nodeType: "YieldFrom",
                    value,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            else {
                let value;
                if (!this.check(exports.TokenType.NEWLINE) &&
                    !this.check(exports.TokenType.RPAR) &&
                    !this.check(exports.TokenType.RSQB) &&
                    !this.check(exports.TokenType.RBRACE) &&
                    !this.check(exports.TokenType.COMMA) &&
                    !this.isAtEnd()) {
                    value = this.parseTestList();
                }
                return {
                    nodeType: "Yield",
                    value,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
        }
        if (this.match(exports.TokenType.NAME)) {
            const token = this.previous();
            return {
                nodeType: "Name",
                id: token.value,
                ctx: this.createLoad(),
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.NUMBER)) {
            const token = this.previous();
            return {
                nodeType: "Constant",
                value: this.parseNumber(token.value),
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.STRING)) {
            const token = this.previous();
            const value = this.parseString(token.value);
            // Check if this is an f-string
            if (token.value.toLowerCase().startsWith('f"') ||
                token.value.toLowerCase().startsWith("f'")) {
                // Parse f-string with proper interpolation handling
                return this.parseFString(token);
            }
            // Determine the quote style from the original token
            const quoteStyle = this.getStringQuoteStyle(token.value);
            return {
                nodeType: "Constant",
                value,
                kind: quoteStyle,
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.TRUE)) {
            const token = this.previous();
            return {
                nodeType: "Constant",
                value: true,
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.FALSE)) {
            const token = this.previous();
            return {
                nodeType: "Constant",
                value: false,
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.NONE)) {
            const token = this.previous();
            return {
                nodeType: "Constant",
                value: null,
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.ELLIPSIS)) {
            const token = this.previous();
            return {
                nodeType: "Constant",
                value: "...", // Ellipsis representation
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
        if (this.match(exports.TokenType.LPAR)) {
            if (this.match(exports.TokenType.RPAR)) {
                // Empty tuple
                return {
                    nodeType: "Tuple",
                    elts: [],
                    ctx: this.createLoad(),
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            const expr = this.parseTestOrStarred();
            // Check for generator expression
            const isAsyncGenerator = this.check(exports.TokenType.ASYNC) && this.checkNext(exports.TokenType.FOR);
            const isGenerator = this.check(exports.TokenType.FOR) || isAsyncGenerator;
            if (isGenerator) {
                let generators;
                if (isAsyncGenerator) {
                    // Handle async generator: consume ASYNC, then handle like normal but mark first as async
                    this.advance(); // consume ASYNC
                    this.consume(exports.TokenType.FOR, "Expected 'for' after async");
                    // Parse first comprehension manually with async=1
                    const target = this.parseExprList();
                    this.consume(exports.TokenType.IN, "Expected 'in' in comprehension");
                    const iter = this.parseOrTest();
                    const ifs = [];
                    while (this.match(exports.TokenType.IF)) {
                        ifs.push(this.parseOrTest());
                    }
                    const firstComprehension = {
                        nodeType: "Comprehension",
                        target,
                        iter,
                        ifs,
                        is_async: 1,
                    };
                    // Parse additional comprehensions using existing logic
                    const additionalComprehensions = [];
                    while (this.check(exports.TokenType.FOR) || this.check(exports.TokenType.ASYNC)) {
                        let next_is_async = 0;
                        if (this.check(exports.TokenType.ASYNC)) {
                            this.advance(); // consume 'async'
                            next_is_async = 1;
                        }
                        if (!this.check(exports.TokenType.FOR)) {
                            break;
                        }
                        this.consume(exports.TokenType.FOR, "Expected 'for' in comprehension");
                        const nextTarget = this.parseExprList();
                        this.consume(exports.TokenType.IN, "Expected 'in' in comprehension");
                        const nextIter = this.parseOrTest();
                        const nextIfs = [];
                        while (this.match(exports.TokenType.IF)) {
                            nextIfs.push(this.parseOrTest());
                        }
                        additionalComprehensions.push({
                            nodeType: "Comprehension",
                            target: nextTarget,
                            iter: nextIter,
                            ifs: nextIfs,
                            is_async: next_is_async,
                        });
                    }
                    generators = [firstComprehension, ...additionalComprehensions];
                }
                else {
                    // Normal generator: consume FOR and use existing method
                    this.advance(); // consume FOR
                    generators = this.parseComprehensionsAfterFor();
                }
                this.consume(exports.TokenType.RPAR, "Expected ')' after generator expression");
                return {
                    nodeType: "GeneratorExp",
                    elt: expr,
                    generators,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            // Check for tuple
            if (this.match(exports.TokenType.COMMA)) {
                const elts = [expr];
                while (!this.check(exports.TokenType.RPAR) && !this.isAtEnd()) {
                    elts.push(this.parseTestOrStarred());
                    if (!this.match(exports.TokenType.COMMA))
                        break;
                }
                this.consume(exports.TokenType.RPAR, "Expected ')' after tuple");
                return {
                    nodeType: "Tuple",
                    elts,
                    ctx: this.createLoad(),
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            this.consume(exports.TokenType.RPAR, "Expected ')' after expression");
            return expr;
        }
        if (this.match(exports.TokenType.LSQB)) {
            return this.parseListOrListComp(start);
        }
        if (this.match(exports.TokenType.LBRACE)) {
            return this.parseDictOrSetOrComp(start);
        }
        throw this.error("Unexpected token in expression");
    }
    // ==== Helper parsers ====
    parseSuite() {
        // Handle comments that appear immediately after colon but before newline
        const postColonComments = [];
        if (this.includeComments) {
            while (this.check(exports.TokenType.COMMENT)) {
                const comment = this.parseCommentStatement();
                postColonComments.push(comment);
            }
        }
        if (this.match(exports.TokenType.NEWLINE)) {
            // Skip any additional newlines before the indent
            while (this.match(exports.TokenType.NEWLINE)) {
                // Continue skipping newlines
            }
            // Skip any newlines before INDENT
            while (this.check(exports.TokenType.NEWLINE)) {
                this.advance();
            }
            // When includeComments is enabled, collect any comments before INDENT
            const preIndentComments = [];
            if (this.includeComments) {
                while (this.check(exports.TokenType.COMMENT)) {
                    const comment = this.parseCommentStatement();
                    preIndentComments.push(comment);
                    // Skip newlines after comments
                    while (this.check(exports.TokenType.NEWLINE)) {
                        this.advance();
                    }
                }
            } // Require proper indentation - must have INDENT token for block structure
            if (!this.match(exports.TokenType.INDENT)) {
                throw this.error("Expected indented block");
            }
            const stmts = [];
            // Add post-colon comments first
            stmts.push(...postColonComments);
            // Then add pre-indent comments
            stmts.push(...preIndentComments);
            while (!this.check(exports.TokenType.DEDENT) && !this.isAtEnd()) {
                if (this.match(exports.TokenType.NEWLINE)) {
                    continue;
                }
                // Handle comments that were collected during token peeking
                if (this.includeComments && this.pendingComments.length > 0) {
                    for (const comment of this.pendingComments) {
                        // If this is an inline comment and we have a previous statement, attach it
                        if (comment.inline && stmts.length > 0) {
                            const lastStmt = stmts[stmts.length - 1];
                            // Add the comment as metadata to the last statement
                            if (!lastStmt.inlineComment) {
                                lastStmt.inlineComment = comment;
                            }
                        }
                        else {
                            // For standalone comments, add as separate statement
                            stmts.push(comment);
                        }
                    }
                    // Clear pending comments after processing
                    this.pendingComments = [];
                }
                // Parse comments as statement nodes when includeComments is enabled (fallback for direct comment tokens)
                if (this.includeComments && this.check(exports.TokenType.COMMENT)) {
                    const comment = this.parseCommentStatement();
                    // If this is an inline comment and we have a previous statement, attach it
                    if (comment.inline && stmts.length > 0) {
                        const lastStmt = stmts[stmts.length - 1];
                        // Add the comment as metadata to the last statement
                        if (!lastStmt.inlineComment) {
                            lastStmt.inlineComment = comment;
                        }
                    }
                    else {
                        // For standalone comments, add as separate statement
                        stmts.push(comment);
                    }
                    continue;
                }
                const stmt = this.parseStatement();
                if (stmt) {
                    stmts.push(stmt);
                    // Process any comments that were collected during statement parsing
                    if (this.includeComments && this.pendingComments.length > 0) {
                        for (const comment of this.pendingComments) {
                            if (comment.inline) {
                                // Attach inline comment to the statement we just parsed
                                if (!stmt.inlineComment) {
                                    stmt.inlineComment = comment;
                                }
                            }
                            else {
                                // Add standalone comment as separate statement
                                stmts.push(comment);
                            }
                        }
                        // Clear pending comments after processing
                        this.pendingComments = [];
                    }
                }
            }
            // Consume DEDENT
            if (!this.match(exports.TokenType.DEDENT)) {
                throw this.error("Expected dedent to close block");
            }
            return stmts;
        }
        else {
            // Simple statement on the same line
            const stmt = this.parseSimpleStmt();
            return stmt ? [stmt] : [];
        }
    }
    parseParameters() {
        const posonlyargs = [];
        const args = [];
        let vararg;
        const kwonlyargs = [];
        const kw_defaults = [];
        let kwarg;
        const defaults = [];
        let seenStar = false;
        if (!this.check(exports.TokenType.RPAR)) {
            do {
                // Skip comments and newlines at the start of each parameter
                while (this.check(exports.TokenType.COMMENT) || this.check(exports.TokenType.NEWLINE)) {
                    this.advance();
                }
                // Check for end of parameter list
                if (this.check(exports.TokenType.RPAR)) {
                    break;
                }
                if (this.match(exports.TokenType.SLASH)) {
                    // Positional-only separator
                    // Move all current args to posonlyargs
                    posonlyargs.push(...args);
                    args.length = 0;
                }
                else if (this.match(exports.TokenType.STAR)) {
                    seenStar = true;
                    if (this.check(exports.TokenType.NAME)) {
                        const name = this.advance().value;
                        let annotation;
                        if (this.match(exports.TokenType.COLON)) {
                            annotation = this.parseTestOrStarred();
                        }
                        vararg = {
                            nodeType: "Arg",
                            arg: name,
                            annotation,
                            lineno: this.previous().lineno,
                            col_offset: this.previous().col_offset,
                        };
                    }
                    // After *, all following params are keyword-only
                }
                else if (this.match(exports.TokenType.DOUBLESTAR)) {
                    const name = this.consume(exports.TokenType.NAME, "Expected parameter name").value;
                    let annotation;
                    if (this.match(exports.TokenType.COLON)) {
                        annotation = this.parseTestOrStarred();
                    }
                    kwarg = {
                        nodeType: "Arg",
                        arg: name,
                        annotation,
                        lineno: this.previous().lineno,
                        col_offset: this.previous().col_offset,
                    };
                }
                else {
                    const name = this.consume(exports.TokenType.NAME, "Expected parameter name").value;
                    let annotation;
                    if (this.match(exports.TokenType.COLON)) {
                        annotation = this.parseTestOrStarred();
                    }
                    let defaultValue;
                    if (this.match(exports.TokenType.EQUAL)) {
                        defaultValue = this.parseTest();
                    }
                    const arg = {
                        nodeType: "Arg",
                        arg: name,
                        annotation,
                        lineno: this.previous().lineno,
                        col_offset: this.previous().col_offset,
                    };
                    if (seenStar) {
                        // After *, these are keyword-only
                        kwonlyargs.push(arg);
                        kw_defaults.push(defaultValue || null);
                    }
                    else {
                        // Regular positional arguments
                        args.push(arg);
                        if (defaultValue) {
                            defaults.push(defaultValue);
                        }
                    }
                }
            } while (this.match(exports.TokenType.COMMA) && !this.check(exports.TokenType.RPAR));
        }
        return {
            nodeType: "Arguments",
            posonlyargs,
            args,
            vararg,
            kwonlyargs,
            kw_defaults,
            kwarg,
            defaults,
        };
    }
    parseLambdaParameters() {
        const args = [];
        const defaults = [];
        // Parse lambda parameters: name, name=default, name, name=default, ...
        do {
            if (!this.check(exports.TokenType.NAME)) {
                break;
            }
            const name = this.advance().value;
            const arg = {
                nodeType: "Arg",
                arg: name,
                annotation: undefined,
                lineno: this.previous().lineno,
                col_offset: this.previous().col_offset,
            };
            args.push(arg);
            // Check for default value
            if (this.match(exports.TokenType.EQUAL)) {
                const defaultValue = this.parseTest();
                defaults.push(defaultValue);
            }
        } while (this.match(exports.TokenType.COMMA) && !this.check(exports.TokenType.COLON));
        return {
            nodeType: "Arguments",
            posonlyargs: [],
            args,
            vararg: undefined,
            kwonlyargs: [],
            kw_defaults: [],
            kwarg: undefined,
            defaults,
        };
    }
    parseExprList() {
        const expr = this.parseExpr();
        if (this.match(exports.TokenType.COMMA)) {
            const elts = [expr];
            if (!this.check(exports.TokenType.IN)) {
                elts.push(this.parseExpr());
                while (this.match(exports.TokenType.COMMA)) {
                    if (this.check(exports.TokenType.IN))
                        break;
                    elts.push(this.parseExpr());
                }
            }
            return {
                nodeType: "Tuple",
                elts,
                ctx: this.createStore(),
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    parseSubscriptList() {
        const first = this.parseSubscript();
        if (this.match(exports.TokenType.COMMA)) {
            const elts = [first];
            if (!this.check(exports.TokenType.RSQB)) {
                elts.push(this.parseSubscript());
                while (this.match(exports.TokenType.COMMA)) {
                    if (this.check(exports.TokenType.RSQB))
                        break;
                    elts.push(this.parseSubscript());
                }
            }
            return {
                nodeType: "Tuple",
                elts,
                ctx: this.createLoad(),
                lineno: first.lineno || 1,
                col_offset: first.col_offset || 0,
            };
        }
        return first;
    }
    parseSubscript() {
        if (this.match(exports.TokenType.COLON)) {
            // Slice with no lower bound
            let upper;
            let step;
            if (!this.check(exports.TokenType.COLON) &&
                !this.check(exports.TokenType.RSQB) &&
                !this.check(exports.TokenType.COMMA)) {
                upper = this.parseTest();
            }
            if (this.match(exports.TokenType.COLON)) {
                if (!this.check(exports.TokenType.RSQB) && !this.check(exports.TokenType.COMMA)) {
                    step = this.parseTest();
                }
            }
            return {
                nodeType: "Slice",
                lower: undefined,
                upper,
                step,
                lineno: this.previous().lineno,
                col_offset: this.previous().col_offset,
            };
        }
        const first = this.parseTestOrStarred();
        if (this.match(exports.TokenType.COLON)) {
            // Slice
            let upper;
            let step;
            if (!this.check(exports.TokenType.COLON) &&
                !this.check(exports.TokenType.RSQB) &&
                !this.check(exports.TokenType.COMMA)) {
                upper = this.parseTest();
            }
            if (this.match(exports.TokenType.COLON)) {
                if (!this.check(exports.TokenType.RSQB) && !this.check(exports.TokenType.COMMA)) {
                    step = this.parseTest();
                }
            }
            return {
                nodeType: "Slice",
                lower: first,
                upper,
                step,
                lineno: first.lineno || 1,
                col_offset: first.col_offset || 0,
            };
        }
        return first;
    }
    parseListOrListComp(start) {
        if (this.match(exports.TokenType.RSQB)) {
            // Empty list
            return {
                nodeType: "List",
                elts: [],
                ctx: this.createLoad(),
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        const first = this.parseTestOrStarred();
        // Check for list comprehension
        if (this.check(exports.TokenType.FOR) || this.check(exports.TokenType.ASYNC)) {
            const generators = this.parseComprehensions();
            this.consume(exports.TokenType.RSQB, "Expected ']' after list comprehension");
            return {
                nodeType: "ListComp",
                elt: first,
                generators,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        // Regular list
        const elts = [first];
        while (this.match(exports.TokenType.COMMA)) {
            // Skip comments after comma when includeComments is enabled
            if (this.includeComments) {
                while (this.check(exports.TokenType.COMMENT)) {
                    this.advance();
                }
            }
            if (this.check(exports.TokenType.RSQB))
                break;
            elts.push(this.parseTestOrStarred());
        }
        this.consume(exports.TokenType.RSQB, "Expected ']' after list");
        return {
            nodeType: "List",
            elts,
            ctx: this.createLoad(),
            lineno: start.lineno,
            col_offset: start.col_offset,
        };
    }
    parseDictOrSetOrComp(start) {
        if (this.match(exports.TokenType.RBRACE)) {
            // Empty dict
            return {
                nodeType: "Dict",
                keys: [],
                values: [],
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        const first = this.parseTest();
        if (this.match(exports.TokenType.COLON)) {
            // Dictionary
            const firstValue = this.parseTest();
            // Check for dict comprehension
            if (this.match(exports.TokenType.FOR)) {
                const generators = this.parseComprehensionsAfterFor();
                this.consume(exports.TokenType.RBRACE, "Expected '}' after dict comprehension");
                return {
                    nodeType: "DictComp",
                    key: first,
                    value: firstValue,
                    generators,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            // Regular dictionary
            const keys = [first];
            const values = [firstValue];
            while (this.match(exports.TokenType.COMMA)) {
                if (this.check(exports.TokenType.RBRACE))
                    break; // Handle trailing comma
                keys.push(this.parseTest());
                this.consume(exports.TokenType.COLON, "Expected ':' in dictionary");
                values.push(this.parseTest());
            }
            this.consume(exports.TokenType.RBRACE, "Expected '}' after dictionary");
            return {
                nodeType: "Dict",
                keys,
                values,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        else {
            // Set
            // Check for set comprehension
            if (this.match(exports.TokenType.FOR)) {
                const generators = this.parseComprehensionsAfterFor();
                this.consume(exports.TokenType.RBRACE, "Expected '}' after set comprehension");
                return {
                    nodeType: "SetComp",
                    elt: first,
                    generators,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                };
            }
            // Regular set
            const elts = [first];
            while (this.match(exports.TokenType.COMMA)) {
                if (this.check(exports.TokenType.RBRACE))
                    break;
                elts.push(this.parseTest());
            }
            this.consume(exports.TokenType.RBRACE, "Expected '}' after set");
            return {
                nodeType: "Set",
                elts,
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
    }
    parseComprehensions() {
        const comprehensions = [];
        do {
            // Check for async comprehensions
            let is_async = 0;
            if (this.check(exports.TokenType.ASYNC)) {
                this.advance(); // consume 'async'
                is_async = 1;
            }
            if (!this.check(exports.TokenType.FOR)) {
                break;
            }
            this.consume(exports.TokenType.FOR, "Expected 'for' in comprehension");
            const target = this.parseExprList();
            this.consume(exports.TokenType.IN, "Expected 'in' in comprehension");
            const iter = this.parseOrTest();
            const ifs = [];
            while (this.match(exports.TokenType.IF)) {
                ifs.push(this.parseOrTest());
            }
            comprehensions.push({
                nodeType: "Comprehension",
                target,
                iter,
                ifs,
                is_async,
            });
        } while (this.check(exports.TokenType.FOR) || this.check(exports.TokenType.ASYNC));
        return comprehensions;
    }
    parseComprehensionsAfterFor() {
        const comprehensions = [];
        let is_async = 0; // First comprehension is not async for now
        // Parse first comprehension (FOR already consumed)
        const target = this.parseExprList();
        this.consume(exports.TokenType.IN, "Expected 'in' in comprehension");
        const iter = this.parseOrTest();
        const ifs = [];
        while (this.match(exports.TokenType.IF)) {
            ifs.push(this.parseOrTest());
        }
        comprehensions.push({
            nodeType: "Comprehension",
            target,
            iter,
            ifs,
            is_async,
        });
        // Parse additional comprehensions
        while (this.check(exports.TokenType.FOR) || this.check(exports.TokenType.ASYNC)) {
            // Check for async comprehensions
            is_async = 0;
            if (this.check(exports.TokenType.ASYNC)) {
                this.advance(); // consume 'async'
                is_async = 1;
            }
            if (!this.check(exports.TokenType.FOR)) {
                break;
            }
            this.consume(exports.TokenType.FOR, "Expected 'for' in comprehension");
            const target = this.parseExprList();
            this.consume(exports.TokenType.IN, "Expected 'in' in comprehension");
            const iter = this.parseOrTest();
            const ifs = [];
            while (this.match(exports.TokenType.IF)) {
                ifs.push(this.parseOrTest());
            }
            comprehensions.push({
                nodeType: "Comprehension",
                target,
                iter,
                ifs,
                is_async,
            });
        }
        return comprehensions;
    }
    // ==== Utility methods ====
    matchAugAssign() {
        return (this.check(exports.TokenType.PLUSEQUAL) ||
            this.check(exports.TokenType.MINEQUAL) ||
            this.check(exports.TokenType.STAREQUAL) ||
            this.check(exports.TokenType.SLASHEQUAL) ||
            this.check(exports.TokenType.PERCENTEQUAL) ||
            this.check(exports.TokenType.AMPEREQUAL) ||
            this.check(exports.TokenType.VBAREQUAL) ||
            this.check(exports.TokenType.CIRCUMFLEXEQUAL) ||
            this.check(exports.TokenType.LEFTSHIFTEQUAL) ||
            this.check(exports.TokenType.RIGHTSHIFTEQUAL) ||
            this.check(exports.TokenType.DOUBLESTAREQUAL) ||
            this.check(exports.TokenType.DOUBLESLASHEQUAL) ||
            this.check(exports.TokenType.ATEQUAL));
    }
    parseAugAssignOp() {
        const token = this.advance();
        switch (token.type) {
            case exports.TokenType.PLUSEQUAL:
                return { nodeType: "Add" };
            case exports.TokenType.MINEQUAL:
                return { nodeType: "Sub" };
            case exports.TokenType.STAREQUAL:
                return { nodeType: "Mult" };
            case exports.TokenType.SLASHEQUAL:
                return { nodeType: "Div" };
            case exports.TokenType.PERCENTEQUAL:
                return { nodeType: "Mod" };
            case exports.TokenType.AMPEREQUAL:
                return { nodeType: "BitAnd" };
            case exports.TokenType.VBAREQUAL:
                return { nodeType: "BitOr" };
            case exports.TokenType.CIRCUMFLEXEQUAL:
                return { nodeType: "BitXor" };
            case exports.TokenType.LEFTSHIFTEQUAL:
                return { nodeType: "LShift" };
            case exports.TokenType.RIGHTSHIFTEQUAL:
                return { nodeType: "RShift" };
            case exports.TokenType.DOUBLESTAREQUAL:
                return { nodeType: "Pow" };
            case exports.TokenType.DOUBLESLASHEQUAL:
                return { nodeType: "FloorDiv" };
            case exports.TokenType.ATEQUAL:
                return { nodeType: "MatMult" };
            default:
                throw this.error("Invalid augmented assignment operator");
        }
    }
    matchComparison() {
        return (this.check(exports.TokenType.LESS) ||
            this.check(exports.TokenType.GREATER) ||
            this.check(exports.TokenType.EQEQUAL) ||
            this.check(exports.TokenType.GREATEREQUAL) ||
            this.check(exports.TokenType.LESSEQUAL) ||
            this.check(exports.TokenType.NOTEQUAL) ||
            this.check(exports.TokenType.IN) ||
            this.check(exports.TokenType.IS) ||
            (this.check(exports.TokenType.NOT) && this.checkNext(exports.TokenType.IN)) ||
            (this.check(exports.TokenType.IS) && this.checkNext(exports.TokenType.NOT)));
    }
    parseCompOp() {
        if (this.match(exports.TokenType.LESS))
            return { nodeType: "Lt" };
        if (this.match(exports.TokenType.GREATER))
            return { nodeType: "Gt" };
        if (this.match(exports.TokenType.EQEQUAL))
            return { nodeType: "Eq" };
        if (this.match(exports.TokenType.GREATEREQUAL))
            return { nodeType: "GtE" };
        if (this.match(exports.TokenType.LESSEQUAL))
            return { nodeType: "LtE" };
        if (this.match(exports.TokenType.NOTEQUAL))
            return { nodeType: "NotEq" };
        if (this.match(exports.TokenType.IN))
            return { nodeType: "In" };
        if (this.match(exports.TokenType.IS)) {
            if (this.match(exports.TokenType.NOT)) {
                return { nodeType: "IsNot" };
            }
            return { nodeType: "Is" };
        }
        if (this.match(exports.TokenType.NOT)) {
            this.consume(exports.TokenType.IN, "Expected 'in' after 'not'");
            return { nodeType: "NotIn" };
        }
        throw this.error("Expected comparison operator");
    }
    isSimpleTarget(expr) {
        return expr.nodeType === "Name";
    }
    createLoad() {
        return { nodeType: "Load" };
    }
    createStore() {
        return { nodeType: "Store" };
    }
    parseNumber(value) {
        // Handle different number formats
        if (value.startsWith("0x") || value.startsWith("0X")) {
            return parseInt(value, 16);
        }
        else if (value.startsWith("0o") || value.startsWith("0O")) {
            return parseInt(value.slice(2), 8);
        }
        else if (value.startsWith("0b") || value.startsWith("0B")) {
            return parseInt(value.slice(2), 2);
        }
        else if (value.includes(".") ||
            value.includes("e") ||
            value.includes("E")) {
            return parseFloat(value);
        }
        else {
            return parseInt(value, 10);
        }
    }
    parseString(value) {
        // Check for string prefixes (f, r, b, u, etc.)
        let prefix = "";
        let actualValue = value;
        // Extract prefix if present
        const prefixMatch = value.match(/^([fFrRbBuU]+)/);
        if (prefixMatch) {
            prefix = prefixMatch[1].toLowerCase();
            actualValue = value.slice(prefix.length);
        }
        // Remove quotes
        const quote = actualValue[0];
        let content = actualValue.slice(1, -1);
        // Handle triple quotes
        if (actualValue.startsWith('"""') || actualValue.startsWith("'''")) {
            content = actualValue.slice(3, -3);
        }
        // For raw strings, don't process escape sequences
        if (prefix.includes("r")) {
            return content;
        }
        // Basic escape sequence handling for non-raw strings
        content = content
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\r/g, "\r")
            .replace(/\\\\/g, "\\")
            .replace(new RegExp(`\\\\${quote}`, "g"), quote);
        return content;
    }
    getStringQuoteStyle(tokenValue) {
        // Extract any prefix (f, r, b, u, etc.)
        const prefixMatch = tokenValue.match(/^([fFrRbBuU]*)/);
        const prefix = prefixMatch ? prefixMatch[1] : "";
        const withoutPrefix = tokenValue.slice(prefix.length);
        // Determine quote style
        if (withoutPrefix.startsWith('"""')) {
            return `${prefix}"""`;
        }
        else if (withoutPrefix.startsWith("'''")) {
            return `${prefix}'''`;
        }
        else if (withoutPrefix.startsWith('"')) {
            return `${prefix}"`;
        }
        else if (withoutPrefix.startsWith("'")) {
            return `${prefix}'`;
        }
        // Default fallback to double quotes
        return `${prefix}"`;
    }
    parseFString(token) {
        // Extract the content inside the f-string quotes
        let content = token.value;
        // Determine and store the original quote style
        const quoteStyle = this.getStringQuoteStyle(token.value);
        // Remove f-string prefix and quotes
        if (content.toLowerCase().startsWith('f"')) {
            content = content.slice(2, -1); // Remove f" and "
        }
        else if (content.toLowerCase().startsWith("f'")) {
            content = content.slice(2, -1); // Remove f' and '
        }
        const values = [];
        let i = 0;
        let literalStart = 0;
        while (i < content.length) {
            if (content[i] === "{") {
                // Add any literal content before this expression
                if (i > literalStart) {
                    const literalValue = content.slice(literalStart, i);
                    if (literalValue) {
                        values.push({
                            nodeType: "Constant",
                            value: literalValue,
                            lineno: token.lineno,
                            col_offset: token.col_offset + literalStart + 2, // +2 for f" prefix
                        });
                    }
                }
                // Parse the expression recursively
                const { exprText, nextPos } = this.parseExpressionInFString(content, i);
                const formattedValue = this.parseFormattedValue(exprText, token);
                values.push(formattedValue);
                i = nextPos;
                literalStart = i;
            }
            else {
                i++;
            }
        }
        // Add any remaining literal content
        if (literalStart < content.length) {
            const literalValue = content.slice(literalStart);
            if (literalValue) {
                values.push({
                    nodeType: "Constant",
                    value: literalValue,
                    lineno: token.lineno,
                    col_offset: token.col_offset + literalStart + 2,
                });
            }
        }
        return {
            nodeType: "JoinedStr",
            values,
            kind: quoteStyle,
            lineno: token.lineno,
            col_offset: token.col_offset,
        };
    }
    /**
     * Parse an expression within an f-string, handling nested contexts properly.
     * Returns the expression text and the position after the closing brace.
     */
    parseExpressionInFString(content, startPos) {
        if (content[startPos] !== "{") {
            throw new Error(`Expected '{' at position ${startPos}`);
        }
        let i = startPos + 1;
        let braceLevel = 1;
        let result = "";
        while (i < content.length && braceLevel > 0) {
            const char = content[i];
            // Handle nested f-strings
            if (char === "f" && i + 1 < content.length) {
                const nextChar = content[i + 1];
                if (nextChar === '"' || nextChar === "'") {
                    // Found nested f-string, parse it recursively
                    const { fStringContent, nextPos } = this.parseNestedFString(content, i);
                    result += fStringContent;
                    i = nextPos;
                    continue;
                }
            }
            // Handle regular strings
            if (char === '"' || char === "'") {
                const { stringContent, nextPos } = this.parseStringLiteral(content, i);
                result += stringContent;
                i = nextPos;
                continue;
            }
            // Handle braces
            if (char === "{") {
                braceLevel++;
                result += char;
            }
            else if (char === "}") {
                braceLevel--;
                if (braceLevel > 0) {
                    result += char;
                }
            }
            else {
                result += char;
            }
            i++;
        }
        if (braceLevel !== 0) {
            throw new Error(`Unmatched '{' in f-string at position ${startPos}`);
        }
        return { exprText: result, nextPos: i };
    }
    /**
     * Parse a nested f-string within an expression.
     */
    parseNestedFString(content, startPos) {
        const quote = content[startPos + 1];
        let i = startPos + 2; // Skip 'f' and quote
        let braceLevel = 0;
        let result = content.slice(startPos, startPos + 2); // Include 'f' and opening quote
        while (i < content.length) {
            const char = content[i];
            if (char === "{") {
                braceLevel++;
                result += char;
            }
            else if (char === "}") {
                braceLevel--;
                result += char;
            }
            else if (char === quote && braceLevel === 0) {
                result += char;
                return { fStringContent: result, nextPos: i + 1 };
            }
            else {
                result += char;
            }
            i++;
        }
        throw new Error(`Unterminated f-string starting at position ${startPos}`);
    }
    /**
     * Parse a regular string literal within an expression.
     */
    parseStringLiteral(content, startPos) {
        const quote = content[startPos];
        let i = startPos + 1;
        let escaped = false;
        let result = quote;
        while (i < content.length) {
            const char = content[i];
            if (escaped) {
                escaped = false;
                result += char;
            }
            else if (char === "\\") {
                escaped = true;
                result += char;
            }
            else if (char === quote) {
                result += char;
                return { stringContent: result, nextPos: i + 1 };
            }
            else {
                result += char;
            }
            i++;
        }
        throw new Error(`Unterminated string starting at position ${startPos}`);
    }
    parseFormattedValue(exprText, token) {
        // Split expression and format spec if present
        let expression = exprText;
        let formatSpec;
        let conversion = -1;
        // Check for conversion specifiers (!r, !s, !a)
        const conversionMatch = expression.match(/^(.+?)!(r|s|a)(?::(.*))?$/);
        if (conversionMatch) {
            expression = conversionMatch[1];
            const conversionType = conversionMatch[2];
            conversion =
                conversionType === "r" ? 114 : conversionType === "s" ? 115 : 97;
            if (conversionMatch[3]) {
                // Has format spec after conversion
                formatSpec = {
                    nodeType: "JoinedStr",
                    values: [
                        {
                            nodeType: "Constant",
                            value: conversionMatch[3],
                            lineno: token.lineno,
                            col_offset: token.col_offset,
                        },
                    ],
                    lineno: token.lineno,
                    col_offset: token.col_offset,
                };
            }
        }
        else {
            // Check for format spec without conversion
            const formatMatch = expression.match(/^(.+?):(.*)$/);
            if (formatMatch) {
                expression = formatMatch[1];
                formatSpec = {
                    nodeType: "JoinedStr",
                    values: [
                        {
                            nodeType: "Constant",
                            value: formatMatch[2],
                            lineno: token.lineno,
                            col_offset: token.col_offset,
                        },
                    ],
                    lineno: token.lineno,
                    col_offset: token.col_offset,
                };
            }
        }
        // Parse the expression using a mini-parser
        const exprAst = this.parseExpressionFromString(expression.trim(), token);
        return {
            nodeType: "FormattedValue",
            value: exprAst,
            conversion,
            format_spec: formatSpec,
            lineno: token.lineno,
            col_offset: token.col_offset,
        };
    }
    parseExpressionFromString(exprText, token) {
        try {
            // Create a mini-lexer/parser for the expression
            const tempParser = new Parser(exprText);
            const expr = tempParser.parseExpr();
            return expr;
        }
        catch (_error) {
            // Fallback: treat as a simple name if parsing fails
            return {
                nodeType: "Name",
                id: exprText,
                ctx: { nodeType: "Load" },
                lineno: token.lineno,
                col_offset: token.col_offset,
            };
        }
    }
    // ==== Parser utilities ====
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        const token = this.peek();
        return token.type === type;
    }
    // Helper method to peek while skipping comments
    checkNext(type) {
        if (this.current + 1 >= this.tokens.length)
            return false;
        return this.tokens[this.current + 1].type === type;
    }
    isAtEnd() {
        // When parsing comments as statement nodes, check the actual current token
        const token = this.peek();
        return token.type === exports.TokenType.EOF;
    }
    peek() {
        // Skip over comment tokens and collect them
        let currentIndex = this.current;
        while (currentIndex < this.tokens.length &&
            this.tokens[currentIndex].type === exports.TokenType.COMMENT) {
            // Create comment node directly without using parseCommentStatement to avoid recursion
            const commentToken = this.tokens[currentIndex];
            const comment = {
                nodeType: "Comment",
                value: commentToken.value,
                inline: commentToken.lineno === this.lastNonCommentTokenLine,
                lineno: commentToken.lineno,
                col_offset: commentToken.col_offset,
            };
            this.pendingComments.push(comment);
            // Advance past this comment token
            currentIndex++;
            this.current = currentIndex;
        }
        if (this.current >= this.tokens.length) {
            // Return EOF token if we've gone past the end
            return {
                type: exports.TokenType.EOF,
                value: "",
                lineno: this.tokens[this.tokens.length - 1]?.lineno || 1,
                col_offset: this.tokens[this.tokens.length - 1]?.col_offset || 0,
                end_lineno: this.tokens[this.tokens.length - 1]?.end_lineno || 1,
                end_col_offset: this.tokens[this.tokens.length - 1]?.end_col_offset || 0,
            };
        }
        return this.tokens[this.current];
    }
    peekNext() {
        if (this.current + 1 >= this.tokens.length) {
            // Return EOF token if we've gone past the end
            return {
                type: exports.TokenType.EOF,
                value: "",
                lineno: this.tokens[this.tokens.length - 1]?.lineno || 1,
                col_offset: this.tokens[this.tokens.length - 1]?.col_offset || 0,
                end_lineno: this.tokens[this.tokens.length - 1]?.end_lineno || 1,
                end_col_offset: this.tokens[this.tokens.length - 1]?.end_col_offset || 0,
            };
        }
        return this.tokens[this.current + 1];
    }
    advance() {
        if (!this.isAtEnd()) {
            this.current++;
        }
        const token = this.previous();
        // Track the line number of non-comment, non-newline tokens
        if (token.type !== exports.TokenType.COMMENT && token.type !== exports.TokenType.NEWLINE) {
            this.lastNonCommentTokenLine = token.end_lineno || token.lineno;
        }
        return token;
    }
    previous() {
        return this.tokens[this.current - 1];
    }
    consume(type, message) {
        if (this.check(type)) {
            return this.advance();
        }
        throw this.error(message);
    }
    error(message) {
        const token = this.peek();
        const error = new Error(`${message} at line ${token.lineno}, column ${token.col_offset}`);
        error.lineno = token.lineno;
        error.col_offset = token.col_offset;
        error.end_lineno = token.end_lineno;
        error.end_col_offset = token.end_col_offset;
        return error;
    }
    validateAssignmentTarget(expr) {
        switch (expr.nodeType) {
            case "Name":
            case "Attribute":
            case "Subscript":
            case "List":
            case "Tuple":
                // These are valid assignment targets
                break;
            case "Starred":
                // Starred expressions are valid in assignment contexts
                this.validateAssignmentTarget(expr.value);
                break;
            case "Constant":
                throw this.error(`cannot assign to literal`);
            case "BinOp":
            case "UnaryOp":
            case "Call":
            case "Compare":
                throw this.error(`cannot assign to expression`);
            default:
                throw this.error(`cannot assign to ${expr.nodeType}`);
        }
        // For containers, validate all elements
        if (expr.nodeType === "List" || expr.nodeType === "Tuple") {
            for (const elt of expr.elts) {
                this.validateAssignmentTarget(elt);
            }
        }
    }
    parseTestOrStarred() {
        if (this.match(exports.TokenType.STAR)) {
            const start = this.previous();
            const value = this.parseExpr();
            return {
                nodeType: "Starred",
                value,
                ctx: this.createLoad(),
                lineno: start.lineno,
                col_offset: start.col_offset,
            };
        }
        return this.parseTest();
    }
    parseTestListWithStar() {
        const expr = this.parseTestOrStarred();
        if (this.match(exports.TokenType.COMMA)) {
            const elts = [expr];
            // Handle trailing commas and additional elements
            while (!this.check(exports.TokenType.NEWLINE) &&
                !this.isAtEnd() &&
                !this.check(exports.TokenType.RPAR) &&
                !this.check(exports.TokenType.RSQB) &&
                !this.check(exports.TokenType.RBRACE)) {
                elts.push(this.parseTestOrStarred());
                if (!this.match(exports.TokenType.COMMA))
                    break;
            }
            return {
                nodeType: "Tuple",
                elts,
                ctx: this.createLoad(),
                lineno: expr.lineno || 1,
                col_offset: expr.col_offset || 0,
            };
        }
        return expr;
    }
    // ==== Type parameter parsing ====
    parseTypeParams() {
        const params = [];
        if (!this.match(exports.TokenType.LSQB)) {
            return params;
        }
        do {
            const start = this.peek();
            // Check for ParamSpec (**P)
            if (this.match(exports.TokenType.DOUBLESTAR)) {
                const name = this.consume(exports.TokenType.NAME, "Expected parameter name after '**'").value;
                let default_value;
                if (this.match(exports.TokenType.EQUAL)) {
                    default_value = this.parseTestOrStarred();
                }
                params.push({
                    nodeType: "ParamSpec",
                    name,
                    default_value,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                });
            }
            // Check for TypeVarTuple (*Ts)
            else if (this.match(exports.TokenType.STAR)) {
                const name = this.consume(exports.TokenType.NAME, "Expected parameter name after '*'").value;
                let default_value;
                if (this.match(exports.TokenType.EQUAL)) {
                    default_value = this.parseTestOrStarred();
                }
                params.push({
                    nodeType: "TypeVarTuple",
                    name,
                    default_value,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                });
            }
            // Regular TypeVar (T, T: bound, T = default)
            else {
                const name = this.consume(exports.TokenType.NAME, "Expected type parameter name").value;
                let bound;
                let default_value;
                // Parse bound (T: SomeBound)
                if (this.match(exports.TokenType.COLON)) {
                    bound = this.parseTest();
                }
                // Parse default value (T = SomeDefault)
                if (this.match(exports.TokenType.EQUAL)) {
                    default_value = this.parseTestOrStarred();
                }
                params.push({
                    nodeType: "TypeVar",
                    name,
                    bound,
                    default_value,
                    lineno: start.lineno,
                    col_offset: start.col_offset,
                });
            }
        } while (this.match(exports.TokenType.COMMA));
        this.consume(exports.TokenType.RSQB, "Expected ']' after type parameters");
        return params;
    }
}
// ==== Main parse functions ====
/**
 * Parse Python source code from a string
 */
function parse(source, options = {}) {
    const parser = new Parser(source, options);
    return parser.parse();
}
/**
 * Parse Python source code from a file
 * Note: This is for Node.js environments. In browsers, you'll need to read the file content first.
 */
function parseFile(_filename, _options = {}) {
    // This would need to be implemented based on the environment
    // For now, just provide the interface
    throw new Error("parseFile not implemented - read file content and use parse() instead");
}
// ==== Additional utility functions ====
// biome-ignore lint/suspicious/noExplicitAny: Function evaluates Python literals which can be any type
function literalEval(source) {
    // For literal evaluation, we just parse the source and evaluate the first expression
    const ast = parse(source);
    // Find the first expression statement
    for (const stmt of ast.body) {
        if (stmt.nodeType === "Expr") {
            return evaluateLiteral(stmt.value);
        }
    }
    throw new Error("No expression found to evaluate");
}
// biome-ignore lint/suspicious/noExplicitAny: Function evaluates Python literals which can be any type
function evaluateLiteral(node) {
    switch (node.nodeType) {
        case "Constant":
            return node.value;
        case "List":
            return node.elts.map(evaluateLiteral);
        case "Tuple":
            return node.elts.map(evaluateLiteral);
        case "Dict": {
            // biome-ignore lint/suspicious/noExplicitAny: Dictionary values can be any type
            const result = {};
            for (let i = 0; i < node.keys.length; i++) {
                const key = node.keys[i];
                if (key === null) {
                    throw new Error("Cannot evaluate dict unpacking in literal");
                }
                const keyValue = evaluateLiteral(key);
                const value = evaluateLiteral(node.values[i]);
                result[keyValue] = value;
            }
            return result;
        }
        case "Set":
            return new Set(node.elts.map(evaluateLiteral));
        case "UnaryOp":
            if (node.op.nodeType === "UAdd") {
                return +evaluateLiteral(node.operand);
            }
            else if (node.op.nodeType === "USub") {
                return -evaluateLiteral(node.operand);
            }
            break;
        case "BinOp":
            if (node.op.nodeType === "Add") {
                return evaluateLiteral(node.left) + evaluateLiteral(node.right);
            }
            else if (node.op.nodeType === "Sub") {
                return evaluateLiteral(node.left) - evaluateLiteral(node.right);
            }
            break;
    }
    throw new Error(`Cannot evaluate ${node.nodeType} in literal context`);
}
function copyLocation(newNode, oldNode) {
    newNode.lineno = oldNode.lineno;
    newNode.col_offset = oldNode.col_offset;
    newNode.end_lineno = oldNode.end_lineno;
    newNode.end_col_offset = oldNode.end_col_offset;
    return newNode;
}
function fixMissingLocations(node) {
    function fix(
    // biome-ignore lint/suspicious/noExplicitAny: Supposed to be any
    node, parentLineno = 1, parentColOffset = 0, parentEndLineno = 1, parentEndColOffset = 0) {
        if (!node || typeof node !== "object")
            return;
        // Set missing location attributes from parent
        if (node.lineno === undefined && "lineno" in node) {
            node.lineno = parentLineno;
        }
        if (node.col_offset === undefined && "col_offset" in node) {
            node.col_offset = parentColOffset;
        }
        if (node.end_lineno === undefined && "end_lineno" in node) {
            node.end_lineno = parentEndLineno;
        }
        if (node.end_col_offset === undefined && "end_col_offset" in node) {
            node.end_col_offset = parentEndColOffset;
        }
        // Recursively fix child nodes
        for (const [, value] of Object.entries(node)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    fix(item, node.lineno || parentLineno, node.col_offset || parentColOffset, node.end_lineno || parentEndLineno, node.end_col_offset || parentEndColOffset);
                }
            }
            else if (value && typeof value === "object" && "nodeType" in value) {
                fix(value, node.lineno || parentLineno, node.col_offset || parentColOffset, node.end_lineno || parentEndLineno, node.end_col_offset || parentEndColOffset);
            }
        }
    }
    fix(node);
    return node;
}
function incrementLineno(node, n = 1) {
    // biome-ignore lint/suspicious/noExplicitAny: Function needs to traverse any AST node structure
    function increment(node) {
        if (!node || typeof node !== "object")
            return;
        // Increment line numbers
        if (typeof node.lineno === "number") {
            node.lineno += n;
        }
        if (typeof node.end_lineno === "number") {
            node.end_lineno += n;
        }
        // Recursively increment child nodes
        for (const [, value] of Object.entries(node)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    increment(item);
                }
            }
            else if (value && typeof value === "object") {
                increment(value);
            }
        }
    }
    increment(node);
    return node;
}

/**
 * AST Visitor Implementation
 * Provides visitor pattern for traversing Python AST nodes
 */
/**
 * Generic visitor that can traverse any AST node
 */
function walk(node) {
    function* walkNode(current) {
        yield current;
        // Visit all child nodes
        for (const [key, value] of Object.entries(current)) {
            if (key === "nodeType")
                continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === "object" && "nodeType" in item) {
                        yield* walkNode(item);
                    }
                }
            }
            else if (value && typeof value === "object" && "nodeType" in value) {
                yield* walkNode(value);
            }
        }
    }
    return walkNode(node);
}
/**
 * Base visitor class for traversing AST nodes
 */
class NodeVisitor {
    /**
     * Visit a node - dispatches to specific visit method
     */
    // biome-ignore lint/suspicious/noExplicitAny: Visitor pattern requires dynamic return types
    visit(node) {
        const methodName = `visit${node.nodeType}`;
        const methodNameUnderscore = `visit_${node.nodeType}`;
        const method = 
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic method lookup requires any
        this[methodName] || this[methodNameUnderscore];
        if (method && typeof method === "function") {
            return method.call(this, node);
        }
        else {
            return this.genericVisit(node);
        }
    }
    /**
     * Called if no explicit visitor function exists for a node
     */
    genericVisit(node) {
        for (const [key, value] of Object.entries(node)) {
            if (key === "nodeType")
                continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === "object" && "nodeType" in item) {
                        this.visit(item);
                    }
                }
            }
            else if (value && typeof value === "object" && "nodeType" in value) {
                this.visit(value);
            }
        }
    }
}
/**
 * Visitor that can transform AST nodes
 */
class NodeTransformer extends NodeVisitor {
    /**
     * Called if no explicit visitor function exists for a node
     */
    genericVisit(node) {
        // biome-ignore lint/suspicious/noExplicitAny: Generic node cloning requires any for dynamic properties
        const newNode = { ...node };
        for (const [key, value] of Object.entries(node)) {
            if (key === "nodeType")
                continue;
            if (Array.isArray(value)) {
                // biome-ignore lint/suspicious/noExplicitAny: Array can contain various AST node types
                const newArray = [];
                for (const item of value) {
                    if (item && typeof item === "object" && "nodeType" in item) {
                        const result = this.visit(item);
                        if (result !== null && result !== undefined) {
                            if (Array.isArray(result)) {
                                newArray.push(...result);
                            }
                            else {
                                newArray.push(result);
                            }
                        }
                    }
                    else {
                        newArray.push(item);
                    }
                }
                newNode[key] = newArray;
            }
            else if (value && typeof value === "object" && "nodeType" in value) {
                const result = this.visit(value);
                newNode[key] = result;
            }
        }
        return newNode;
    }
}

var Precedence;
(function (Precedence) {
    Precedence[Precedence["TUPLE"] = 0] = "TUPLE";
    Precedence[Precedence["YIELD"] = 1] = "YIELD";
    Precedence[Precedence["TEST"] = 2] = "TEST";
    Precedence[Precedence["OR"] = 3] = "OR";
    Precedence[Precedence["AND"] = 4] = "AND";
    Precedence[Precedence["NOT"] = 5] = "NOT";
    Precedence[Precedence["CMP"] = 6] = "CMP";
    Precedence[Precedence["EXPR"] = 7] = "EXPR";
    Precedence[Precedence["BOR"] = 7] = "BOR";
    Precedence[Precedence["BXOR"] = 8] = "BXOR";
    Precedence[Precedence["BAND"] = 9] = "BAND";
    Precedence[Precedence["SHIFT"] = 10] = "SHIFT";
    Precedence[Precedence["ARITH"] = 11] = "ARITH";
    Precedence[Precedence["TERM"] = 12] = "TERM";
    Precedence[Precedence["FACTOR"] = 13] = "FACTOR";
    Precedence[Precedence["POWER"] = 14] = "POWER";
    Precedence[Precedence["AWAIT"] = 15] = "AWAIT";
    Precedence[Precedence["ATOM"] = 16] = "ATOM";
})(Precedence || (Precedence = {}));
/**
 * Detect indentation style from the AST by looking at function/class definitions
 */
function detectIndentStyle(node) {
    // Default to 4 spaces if we can't detect
    let detectedIndent = "    ";
    // biome-ignore lint/suspicious/noExplicitAny: AST traversal requires handling dynamic structures
    function traverse(n) {
        if (!n || typeof n !== "object")
            return;
        // Look for indented blocks (functions, classes, if statements, etc.)
        if (n.nodeType === "FunctionDef" ||
            n.nodeType === "AsyncFunctionDef" ||
            n.nodeType === "ClassDef" ||
            n.nodeType === "If" ||
            n.nodeType === "For" ||
            n.nodeType === "While" ||
            n.nodeType === "With" ||
            n.nodeType === "Try") {
            // Check if we have body with statements that have col_offset info
            if (n.body && Array.isArray(n.body) && n.body.length > 0) {
                const firstBodyStmt = n.body[0];
                if (firstBodyStmt &&
                    typeof firstBodyStmt.col_offset === "number" &&
                    typeof n.col_offset === "number") {
                    const indentSize = firstBodyStmt.col_offset - n.col_offset;
                    if (indentSize > 0 && indentSize <= 8) {
                        // Reasonable indent sizes
                        if (indentSize === 1) {
                            detectedIndent = "\t"; // Tab
                        }
                        else {
                            detectedIndent = " ".repeat(indentSize); // Spaces
                        }
                        return; // Found it, stop searching
                    }
                }
            }
        }
        // Recursively search through the AST
        for (const value of Object.values(n)) {
            if (Array.isArray(value)) {
                value.forEach(traverse);
            }
            else if (value && typeof value === "object") {
                traverse(value);
            }
        }
    }
    traverse(node);
    return detectedIndent;
}
/**
 * Unparse an AST node back to Python source code
 */
function unparse(node, options = {}) {
    const detectedIndent = options.indent || detectIndentStyle(node);
    const context = {
        precedence: Precedence.TUPLE,
        source: [],
        indent: 0,
        indentString: detectedIndent,
        isFirstStatement: true,
    };
    const unparser = new Unparser(context);
    unparser.visit(node);
    return context.source.join("");
}
class Unparser extends NodeVisitor {
    constructor(context) {
        super();
        this.context = context;
    }
    // Override visit to handle inline comments for statement nodes
    // biome-ignore lint/suspicious/noExplicitAny: Visitor pattern requires dynamic return types
    visit(node) {
        const result = super.visit(node);
        // After visiting a statement node, check for inline comments
        if ("inlineComment" in node && node.inlineComment) {
            this.write("  ", node.inlineComment.value);
        }
        return result;
    }
    write(...text) {
        this.context.source.push(...text);
    }
    fill(text = "") {
        if (this.context.isFirstStatement) {
            // For the first statement, don't add a leading newline
            this.context.isFirstStatement = false;
            if (this.context.indent > 0) {
                this.write(this.context.indentString.repeat(this.context.indent), text);
            }
            else {
                this.write(text);
            }
        }
        else {
            this.write("\n", this.context.indentString.repeat(this.context.indent), text);
        }
    }
    interleave(inter, f, seq) {
        for (let i = 0; i < seq.length; i++) {
            if (i > 0) {
                this.write(inter);
            }
            f(seq[i]);
        }
    }
    withPrecedence(precedence, node) {
        const oldPrecedence = this.context.precedence;
        this.context.precedence = precedence;
        this.visit(node);
        this.context.precedence = oldPrecedence;
    }
    requireParens(precedence, node) {
        return this.getPrecedence(node) < precedence;
    }
    getPrecedence(node) {
        switch (node.nodeType) {
            case "Tuple":
                return Precedence.TUPLE;
            case "Yield":
            case "YieldFrom":
                return Precedence.YIELD;
            case "IfExp":
                return Precedence.TEST;
            case "BoolOp":
                return node.op.nodeType === "Or" ? Precedence.OR : Precedence.AND;
            case "UnaryOp":
                return node.op.nodeType === "Not" ? Precedence.NOT : Precedence.FACTOR;
            case "Compare":
                return Precedence.CMP;
            case "BinOp":
                return this.getBinOpPrecedence(node.op);
            case "Await":
                return Precedence.AWAIT;
            default:
                return Precedence.ATOM;
        }
    }
    getBinOpPrecedence(op) {
        switch (op.nodeType) {
            case "BitOr":
                return Precedence.BOR;
            case "BitXor":
                return Precedence.BXOR;
            case "BitAnd":
                return Precedence.BAND;
            case "LShift":
            case "RShift":
                return Precedence.SHIFT;
            case "Add":
            case "Sub":
                return Precedence.ARITH;
            case "Mult":
            case "MatMult":
            case "Div":
            case "Mod":
            case "FloorDiv":
                return Precedence.TERM;
            case "Pow":
                return Precedence.POWER;
            default:
                return Precedence.ATOM;
        }
    }
    // Module visitors
    visit_Module(node) {
        for (const stmt of node.body) {
            this.visit(stmt);
        }
    }
    visit_Interactive(node) {
        for (const stmt of node.body) {
            this.visit(stmt);
        }
    }
    visit_Expression(node) {
        this.visit(node.body);
    }
    // Helper method to write decorators
    writeDecorators(decorators) {
        for (const decorator of decorators) {
            this.fill("@");
            this.visit(decorator);
        }
    }
    // Helper method to choose quotes for f-strings to avoid conflicts
    // Helper method to choose quotes for f-strings - preserve original style
    chooseFStringQuotes(node) {
        // If we have the original quote style, use it exactly
        if (node.kind) {
            // Extract quote from the kind (e.g., 'f"' -> '"', "f'" -> "'")
            const prefixMatch = node.kind.match(/^([fFrRbBuU]*)(.*)/);
            const quote = prefixMatch ? prefixMatch[2] : '"';
            return [node.kind, quote];
        }
        // Default to double quotes if no original style info
        return ['f"', '"'];
    }
    // Statement visitors
    visit_FunctionDef(node) {
        this.writeDecorators(node.decorator_list);
        this.fill("def ");
        this.write(node.name);
        this.writeTypeParams(node.type_params);
        this.write("(");
        this.visit_arguments(node.args);
        this.write(")");
        if (node.returns) {
            this.write(" -> ");
            this.visit(node.returns);
        }
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_ClassDef(node) {
        this.writeDecorators(node.decorator_list);
        this.fill("class ");
        this.write(node.name);
        this.writeTypeParams(node.type_params);
        if (node.bases.length > 0 || node.keywords.length > 0) {
            this.write("(");
            this.interleave(", ", (base) => this.visit(base), node.bases);
            if (node.bases.length > 0 && node.keywords.length > 0) {
                this.write(", ");
            }
            this.interleave(", ", (kw) => this.visit(kw), node.keywords);
            this.write(")");
        }
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_Return(node) {
        this.fill("return");
        if (node.value) {
            this.write(" ");
            this.visit(node.value);
        }
    }
    visit_Assign(node) {
        this.fill();
        this.interleave(" = ", (target) => this.visit(target), node.targets);
        this.write(" = ");
        this.visit(node.value);
        // Handle additional expression comments (avoid duplicating inlineComment)
        const assignNode = node;
        if (assignNode.expressionComments) {
            // Find comments that aren't already handled as inlineComment
            const inlineCommentValue = assignNode.inlineComment?.value;
            const additionalComments = assignNode.expressionComments.filter((comment) => comment.value !== inlineCommentValue);
            for (const comment of additionalComments) {
                if (comment.inline) {
                    this.write("  ", comment.value);
                }
                else {
                    this.write("\n", comment.value);
                }
            }
        }
    }
    visit_AugAssign(node) {
        this.fill();
        this.visit(node.target);
        this.write(" ", this.getAugAssignOp(node.op), " ");
        this.visit(node.value);
    }
    getAugAssignOp(op) {
        switch (op.nodeType) {
            case "Add":
                return "+=";
            case "Sub":
                return "-=";
            case "Mult":
                return "*=";
            case "MatMult":
                return "@=";
            case "Div":
                return "/=";
            case "Mod":
                return "%=";
            case "Pow":
                return "**=";
            case "LShift":
                return "<<=";
            case "RShift":
                return ">>=";
            case "BitOr":
                return "|=";
            case "BitXor":
                return "^=";
            case "BitAnd":
                return "&=";
            case "FloorDiv":
                return "//=";
            default:
                return "?=";
        }
    }
    visit_For(node) {
        this.fill("for ");
        this.visit(node.target);
        this.write(" in ");
        this.visit(node.iter);
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
        if (node.orelse.length > 0) {
            this.fill("else:");
            this.context.indent++;
            for (const stmt of node.orelse) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
    }
    visit_While(node) {
        this.fill("while ");
        this.visit(node.test);
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
        if (node.orelse.length > 0) {
            this.fill("else:");
            this.context.indent++;
            for (const stmt of node.orelse) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
    }
    visit_If(node) {
        this.fill("if ");
        this.visit(node.test);
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
        if (node.orelse.length > 0) {
            if (node.orelse.length === 1 && node.orelse[0].nodeType === "If") {
                this.fill("elif ");
                const elifNode = node.orelse[0];
                this.visit(elifNode.test);
                this.write(":");
                this.context.indent++;
                for (const stmt of elifNode.body) {
                    this.visit(stmt);
                }
                this.context.indent--;
                if (elifNode.orelse.length > 0) {
                    this.fill("else:");
                    this.context.indent++;
                    for (const stmt of elifNode.orelse) {
                        this.visit(stmt);
                    }
                    this.context.indent--;
                }
            }
            else {
                this.fill("else:");
                this.context.indent++;
                for (const stmt of node.orelse) {
                    this.visit(stmt);
                }
                this.context.indent--;
            }
        }
    }
    visit_Pass(_node) {
        this.fill("pass");
    }
    visit_Break(_node) {
        this.fill("break");
    }
    visit_Continue(_node) {
        this.fill("continue");
    }
    visit_Comment(node) {
        if (node.inline) {
            // For inline comments, append to current line with a space
            this.write("  ", node.value);
        }
        else {
            // For standalone comments, start a new line
            this.fill(node.value);
        }
    }
    visit_Delete(node) {
        this.fill("del ");
        this.interleave(", ", (target) => this.visit(target), node.targets);
    }
    visit_Nonlocal(node) {
        this.fill("nonlocal ");
        this.interleave(", ", (name) => this.write(name), node.names);
    }
    visit_TypeAlias(node) {
        this.fill("type ");
        this.visit(node.name);
        if (node.type_params.length > 0) {
            this.write("[");
            this.interleave(", ", (param) => this.visit(param), node.type_params);
            this.write("]");
        }
        this.write(" = ");
        this.visit(node.value);
    }
    visit_Match(node) {
        this.fill("match ");
        this.visit(node.subject);
        this.write(":");
        this.context.indent++;
        for (const case_ of node.cases) {
            this.visit(case_);
        }
        this.context.indent--;
    }
    visit_MatchCase(node) {
        this.fill("case ");
        this.visit(node.pattern);
        if (node.guard) {
            this.write(" if ");
            this.visit(node.guard);
        }
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_Expr(node) {
        this.fill();
        this.visit(node.value);
    }
    visit_Import(node) {
        this.fill("import ");
        this.interleave(", ", (alias) => this.visit(alias), node.names);
    }
    visit_ImportFrom(node) {
        this.fill("from ");
        if (node.level && node.level > 0) {
            this.write(".".repeat(node.level));
        }
        if (node.module) {
            this.write(node.module);
        }
        this.write(" import ");
        this.interleave(", ", (alias) => this.visit(alias), node.names);
    }
    visit_Global(node) {
        this.fill("global ");
        this.interleave(", ", (name) => this.write(name), node.names);
    }
    visit_Raise(node) {
        this.fill("raise");
        if (node.exc) {
            this.write(" ");
            this.visit(node.exc);
            if (node.cause) {
                this.write(" from ");
                this.visit(node.cause);
            }
        }
    }
    visit_Try(node) {
        this.fill("try:");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
        for (const handler of node.handlers) {
            this.visit(handler);
        }
        if (node.orelse.length > 0) {
            this.fill("else:");
            this.context.indent++;
            for (const stmt of node.orelse) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
        if (node.finalbody.length > 0) {
            this.fill("finally:");
            this.context.indent++;
            for (const stmt of node.finalbody) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
    }
    visit_TryStar(node) {
        this.fill("try:");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
        for (const handler of node.handlers) {
            // Handle except* syntax for TryStar nodes
            this.fill("except*");
            if (handler.type) {
                this.write(" ");
                this.visit(handler.type);
                if (handler.name) {
                    this.write(" as ");
                    this.write(handler.name);
                }
            }
            this.write(":");
            this.context.indent++;
            for (const stmt of handler.body) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
        if (node.orelse.length > 0) {
            this.fill("else:");
            this.context.indent++;
            for (const stmt of node.orelse) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
        if (node.finalbody.length > 0) {
            this.fill("finally:");
            this.context.indent++;
            for (const stmt of node.finalbody) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
    }
    visit_Assert(node) {
        this.fill("assert ");
        this.visit(node.test);
        if (node.msg) {
            this.write(", ");
            this.visit(node.msg);
        }
    }
    visit_With(node) {
        this.fill("with ");
        this.interleave(", ", (item) => this.visit(item), node.items);
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_AsyncWith(node) {
        this.fill("async with ");
        this.interleave(", ", (item) => this.visit(item), node.items);
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_AsyncFor(node) {
        this.fill("async for ");
        this.visit(node.target);
        this.write(" in ");
        this.visit(node.iter);
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
        if (node.orelse.length > 0) {
            this.fill("else:");
            this.context.indent++;
            for (const stmt of node.orelse) {
                this.visit(stmt);
            }
            this.context.indent--;
        }
    }
    visit_AsyncFunctionDef(node) {
        this.writeDecorators(node.decorator_list);
        this.fill("async def ");
        this.write(node.name);
        this.writeTypeParams(node.type_params);
        this.write("(");
        this.visit_arguments(node.args);
        this.write(")");
        if (node.returns) {
            this.write(" -> ");
            this.visit(node.returns);
        }
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_AnnAssign(node) {
        this.fill();
        this.visit(node.target);
        this.write(": ");
        this.visit(node.annotation);
        if (node.value) {
            this.write(" = ");
            this.visit(node.value);
        }
    }
    // Expression visitors
    visit_BinOp(node) {
        const precedence = this.getBinOpPrecedence(node.op);
        const needParens = this.requireParens(precedence, node);
        if (needParens)
            this.write("(");
        // Check if left operand needs parentheses
        const leftNeedsParens = this.requireParens(precedence, node.left);
        if (leftNeedsParens)
            this.write("(");
        this.withPrecedence(precedence, node.left);
        if (leftNeedsParens)
            this.write(")");
        this.write(" ", this.getBinOpSymbol(node.op), " ");
        // Check if right operand needs parentheses
        // For right-associative operators or same precedence, we need to be more careful
        const rightNeedsParens = this.requireParens(precedence, node.right) ||
            (this.getPrecedence(node.right) === precedence &&
                this.isLeftAssociative(node.op));
        if (rightNeedsParens)
            this.write("(");
        this.withPrecedence(precedence, node.right);
        if (rightNeedsParens)
            this.write(")");
        if (needParens)
            this.write(")");
    }
    isLeftAssociative(op) {
        // Most binary operators are left-associative, except power
        return op.nodeType !== "Pow";
    }
    getBinOpSymbol(op) {
        switch (op.nodeType) {
            case "Add":
                return "+";
            case "Sub":
                return "-";
            case "Mult":
                return "*";
            case "MatMult":
                return "@";
            case "Div":
                return "/";
            case "Mod":
                return "%";
            case "Pow":
                return "**";
            case "LShift":
                return "<<";
            case "RShift":
                return ">>";
            case "BitOr":
                return "|";
            case "BitXor":
                return "^";
            case "BitAnd":
                return "&";
            case "FloorDiv":
                return "//";
            default:
                return "?";
        }
    }
    visit_UnaryOp(node) {
        const precedence = Precedence.FACTOR;
        const needParens = this.requireParens(precedence, node);
        if (needParens)
            this.write("(");
        this.write(this.getUnaryOpSymbol(node.op));
        if (node.op.nodeType === "Not")
            this.write(" ");
        this.withPrecedence(precedence, node.operand);
        if (needParens)
            this.write(")");
    }
    getUnaryOpSymbol(op) {
        switch (op.nodeType) {
            case "Invert":
                return "~";
            case "Not":
                return "not";
            case "UAdd":
                return "+";
            case "USub":
                return "-";
            default:
                return "?";
        }
    }
    visit_BoolOp(node) {
        const precedence = node.op.nodeType === "Or" ? Precedence.OR : Precedence.AND;
        const needParens = this.requireParens(precedence, node);
        const opSymbol = node.op.nodeType === "Or" ? " or " : " and ";
        if (needParens)
            this.write("(");
        this.interleave(opSymbol, (value) => this.withPrecedence(precedence, value), node.values);
        if (needParens)
            this.write(")");
    }
    visit_Compare(node) {
        const precedence = Precedence.CMP;
        const needParens = this.requireParens(precedence, node);
        if (needParens)
            this.write("(");
        this.withPrecedence(precedence, node.left);
        for (let i = 0; i < node.ops.length; i++) {
            this.write(" ", this.getCmpOpSymbol(node.ops[i]), " ");
            this.withPrecedence(precedence, node.comparators[i]);
        }
        if (needParens)
            this.write(")");
    }
    visit_NamedExpr(node) {
        const needParens = this.requireParens(Precedence.TEST, node);
        if (needParens)
            this.write("(");
        this.visit(node.target);
        this.write(" := ");
        this.visit(node.value);
        if (needParens)
            this.write(")");
    }
    visit_Lambda(node) {
        this.write("lambda");
        if (node.args.args.length > 0 || node.args.vararg || node.args.kwarg) {
            this.write(" ");
            this.visit_arguments(node.args);
        }
        this.write(": ");
        this.visit(node.body);
    }
    visit_IfExp(node) {
        const precedence = Precedence.TEST;
        const needParens = this.requireParens(precedence, node);
        if (needParens)
            this.write("(");
        this.withPrecedence(precedence, node.body);
        this.write(" if ");
        this.withPrecedence(precedence, node.test);
        this.write(" else ");
        this.withPrecedence(precedence, node.orelse);
        if (needParens)
            this.write(")");
    }
    visit_Await(node) {
        this.write("await ");
        this.withPrecedence(Precedence.AWAIT, node.value);
    }
    visit_Yield(node) {
        this.write("yield");
        if (node.value) {
            this.write(" ");
            this.visit(node.value);
        }
    }
    visit_YieldFrom(node) {
        this.write("yield from ");
        this.visit(node.value);
    }
    visit_Starred(node) {
        this.write("*");
        this.visit(node.value);
    }
    visit_Slice(node) {
        if (node.lower) {
            this.visit(node.lower);
        }
        this.write(":");
        if (node.upper) {
            this.visit(node.upper);
        }
        if (node.step) {
            this.write(":");
            this.visit(node.step);
        }
    }
    visit_JoinedStr(node) {
        const [openQuote, closeQuote] = this.chooseFStringQuotes(node);
        this.write(openQuote);
        this.writeJoinedStrContent(node);
        this.write(closeQuote);
    }
    writeJoinedStrContent(node) {
        for (const value of node.values) {
            if (value.nodeType === "Constant") {
                this.write(String(value.value));
            }
            else if (value.nodeType === "FormattedValue") {
                this.write("{");
                this.visit(value.value);
                if (value.conversion !== -1) {
                    if (value.conversion === 115)
                        this.write("!s");
                    else if (value.conversion === 114)
                        this.write("!r");
                    else if (value.conversion === 97)
                        this.write("!a");
                }
                if (value.format_spec) {
                    this.write(":");
                    if (value.format_spec.nodeType === "JoinedStr") {
                        this.writeJoinedStrContent(value.format_spec);
                    }
                    else {
                        this.visit(value.format_spec);
                    }
                }
                this.write("}");
            }
            else {
                this.visit(value);
            }
        }
    }
    visit_FormattedValue(node) {
        this.write("{");
        this.visit(node.value);
        if (node.conversion !== -1) {
            if (node.conversion === 115)
                this.write("!s");
            else if (node.conversion === 114)
                this.write("!r");
            else if (node.conversion === 97)
                this.write("!a");
        }
        if (node.format_spec) {
            this.write(":");
            if (node.format_spec.nodeType === "JoinedStr") {
                this.writeJoinedStrContent(node.format_spec);
            }
            else {
                this.visit(node.format_spec);
            }
        }
        this.write("}");
    }
    getCmpOpSymbol(op) {
        switch (op.nodeType) {
            case "Eq":
                return "==";
            case "NotEq":
                return "!=";
            case "Lt":
                return "<";
            case "LtE":
                return "<=";
            case "Gt":
                return ">";
            case "GtE":
                return ">=";
            case "Is":
                return "is";
            case "IsNot":
                return "is not";
            case "In":
                return "in";
            case "NotIn":
                return "not in";
            default:
                return "?";
        }
    }
    visit_Call(node) {
        this.visit(node.func);
        this.write("(");
        this.interleave(", ", (arg) => this.visit(arg), node.args);
        if (node.args.length > 0 && node.keywords.length > 0) {
            this.write(", ");
        }
        this.interleave(", ", (kw) => this.visit(kw), node.keywords);
        this.write(")");
    }
    visit_Keyword(node) {
        if (node.arg) {
            this.write(node.arg, "=");
        }
        else {
            this.write("**");
        }
        this.visit(node.value);
    }
    visit_Constant(node) {
        this.write(this.formatConstant(node.value, node.kind));
    }
    // biome-ignore lint/suspicious/noExplicitAny: Could be of any type
    formatConstant(value, kind) {
        if (value === null)
            return "None";
        if (value === true)
            return "True";
        if (value === false)
            return "False";
        if (value === "...")
            return "..."; // Handle ellipsis
        if (typeof value === "string") {
            return this.formatString(value, kind);
        }
        if (typeof value === "number") {
            return value.toString();
        }
        return String(value);
    }
    formatString(value, kind) {
        // If we have quote style information, use it
        if (kind) {
            // Extract prefix and quote info
            const prefixMatch = kind.match(/^([fFrRbBuU]*)(.*)/);
            const prefix = prefixMatch ? prefixMatch[1] : "";
            const quoteStyle = prefixMatch ? prefixMatch[2] : '"""';
            // For multiline strings, preserve triple quotes
            if (quoteStyle === '"""' || quoteStyle === "'''") {
                // Check if the string contains newlines
                if (value.includes("\n")) {
                    return `${prefix}${quoteStyle}${value}${quoteStyle}`;
                }
                // If it doesn't have newlines but was originally triple-quoted, preserve that
                return `${prefix}${quoteStyle}${value}${quoteStyle}`;
            }
            // For regular strings, use the original quote style
            if (quoteStyle === '"') {
                return `${prefix}"${this.escapeString(value, '"')}"`;
            }
            else if (quoteStyle === "'") {
                return `${prefix}'${this.escapeString(value, "'")}'`;
            }
        }
        // Default to double quotes if no kind information
        return `"${this.escapeString(value, '"')}"`;
    }
    escapeString(value, quote) {
        return value
            .replace(/\\/g, "\\\\")
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t")
            .replace(new RegExp(`\\${quote}`, "g"), `\\${quote}`);
    }
    visit_Name(node) {
        this.write(node.id);
    }
    visit_Attribute(node) {
        this.visit(node.value);
        this.write(".", node.attr);
    }
    visit_Subscript(node) {
        this.visit(node.value);
        this.write("[");
        // Special handling for tuples in subscripts - don't add parentheses
        if (node.slice.nodeType === "Tuple") {
            this.interleave(", ", (elt) => this.visit(elt), node.slice.elts);
        }
        else {
            this.visit(node.slice);
        }
        this.write("]");
    }
    visit_List(node) {
        this.write("[");
        this.interleave(", ", (elt) => this.visit(elt), node.elts);
        this.write("]");
    }
    visit_Tuple(node) {
        this.write("(");
        this.interleave(", ", (elt) => this.visit(elt), node.elts);
        if (node.elts.length === 1) {
            this.write(",");
        }
        this.write(")");
    }
    visit_Dict(node) {
        this.write("{");
        for (let i = 0; i < node.keys.length; i++) {
            if (i > 0)
                this.write(", ");
            const key = node.keys[i];
            if (key) {
                this.visit(key);
                this.write(": ");
            }
            else {
                this.write("**");
            }
            this.visit(node.values[i]);
        }
        this.write("}");
    }
    visit_Set(node) {
        this.write("{");
        this.interleave(", ", (elt) => this.visit(elt), node.elts);
        this.write("}");
    }
    visit_ListComp(node) {
        this.write("[");
        this.visit(node.elt);
        for (const generator of node.generators) {
            this.visit(generator);
        }
        this.write("]");
    }
    visit_SetComp(node) {
        this.write("{");
        this.visit(node.elt);
        for (const generator of node.generators) {
            this.visit(generator);
        }
        this.write("}");
    }
    visit_DictComp(node) {
        this.write("{");
        this.visit(node.key);
        this.write(": ");
        this.visit(node.value);
        for (const generator of node.generators) {
            this.visit(generator);
        }
        this.write("}");
    }
    visit_GeneratorExp(node) {
        this.write("(");
        this.visit(node.elt);
        for (const generator of node.generators) {
            this.visit(generator);
        }
        this.write(")");
    }
    visit_Comprehension(node) {
        if (node.is_async) {
            this.write(" async for ");
        }
        else {
            this.write(" for ");
        }
        this.visit(node.target);
        this.write(" in ");
        this.visit(node.iter);
        for (const if_ of node.ifs) {
            this.write(" if ");
            this.visit(if_);
        }
    }
    // Handle helper types
    visit_ExceptHandler(node) {
        this.fill("except");
        if (node.type) {
            this.write(" ");
            this.visit(node.type);
            if (node.name) {
                this.write(" as ");
                this.write(node.name);
            }
        }
        this.write(":");
        this.context.indent++;
        for (const stmt of node.body) {
            this.visit(stmt);
        }
        this.context.indent--;
    }
    visit_Alias(node) {
        this.write(node.name);
        if (node.asname) {
            this.write(" as ");
            this.write(node.asname);
        }
    }
    visit_WithItem(node) {
        this.visit(node.context_expr);
        if (node.optional_vars) {
            this.write(" as ");
            this.visit(node.optional_vars);
        }
    }
    // Handle arguments
    visit_arguments(node) {
        const all_args = [...node.posonlyargs, ...node.args];
        for (let i = 0; i < all_args.length; i++) {
            if (i > 0)
                this.write(", ");
            this.visit(all_args[i]);
            // Add default values - they apply to the rightmost arguments
            const defaultIndex = i - (all_args.length - node.defaults.length);
            if (defaultIndex >= 0 && defaultIndex < node.defaults.length) {
                this.write("=");
                this.visit(node.defaults[defaultIndex]);
            }
            // Add positional-only separator
            if (i === node.posonlyargs.length - 1 && node.posonlyargs.length > 0) {
                this.write(", /");
            }
        }
        if (node.vararg) {
            if (all_args.length > 0)
                this.write(", ");
            this.write("*");
            this.visit(node.vararg);
        }
        if (node.kwonlyargs.length > 0) {
            if (!node.vararg && all_args.length > 0)
                this.write(", *");
            for (let i = 0; i < node.kwonlyargs.length; i++) {
                this.write(", ");
                this.visit(node.kwonlyargs[i]);
                if (i < node.kw_defaults.length && node.kw_defaults[i]) {
                    this.write("=");
                    const defaultValue = node.kw_defaults[i];
                    if (defaultValue) {
                        this.visit(defaultValue);
                    }
                }
            }
        }
        if (node.kwarg) {
            if (all_args.length > 0 || node.vararg || node.kwonlyargs.length > 0) {
                this.write(", ");
            }
            this.write("**");
            this.visit(node.kwarg);
        }
    }
    visit_Arg(node) {
        this.write(node.arg);
        if (node.annotation) {
            this.write(": ");
            this.visit(node.annotation);
        }
    }
    // Pattern visitors
    visit_MatchValue(node) {
        this.visit(node.value);
    }
    visit_MatchSingleton(node) {
        if (node.value === null)
            this.write("None");
        else if (node.value === true)
            this.write("True");
        else if (node.value === false)
            this.write("False");
        else
            this.write(String(node.value));
    }
    visit_MatchSequence(node) {
        this.write("[");
        this.interleave(", ", (pattern) => this.visit(pattern), node.patterns);
        this.write("]");
    }
    visit_MatchMapping(node) {
        this.write("{");
        for (let i = 0; i < node.keys.length; i++) {
            if (i > 0)
                this.write(", ");
            this.visit(node.keys[i]);
            this.write(": ");
            this.visit(node.patterns[i]);
        }
        if (node.rest) {
            if (node.keys.length > 0)
                this.write(", ");
            this.write("**");
            this.write(node.rest);
        }
        this.write("}");
    }
    visit_MatchClass(node) {
        this.visit(node.cls);
        this.write("(");
        this.interleave(", ", (pattern) => this.visit(pattern), node.patterns);
        for (let i = 0; i < node.kwd_attrs.length; i++) {
            if (node.patterns.length > 0 || i > 0)
                this.write(", ");
            this.write(node.kwd_attrs[i]);
            this.write("=");
            this.visit(node.kwd_patterns[i]);
        }
        this.write(")");
    }
    visit_MatchStar(node) {
        this.write("*");
        if (node.name) {
            this.write(node.name);
        }
    }
    visit_MatchAs(node) {
        if (node.pattern) {
            this.visit(node.pattern);
            this.write(" as ");
        }
        if (node.name) {
            this.write(node.name);
        }
    }
    visit_MatchOr(node) {
        this.interleave(" | ", (pattern) => this.visit(pattern), node.patterns);
    }
    // Helper method for type parameters
    writeTypeParams(type_params) {
        if (type_params && type_params.length > 0) {
            this.write("[");
            this.interleave(", ", (param) => this.visit(param), type_params);
            this.write("]");
        }
    }
    // Type parameter visitors
    visit_TypeVar(node) {
        this.write(node.name);
        if (node.bound) {
            this.write(": ");
            this.visit(node.bound);
        }
        if (node.default_value) {
            this.write(" = ");
            this.visit(node.default_value);
        }
    }
    visit_ParamSpec(node) {
        this.write("**");
        this.write(node.name);
        if (node.default_value) {
            this.write(" = ");
            this.visit(node.default_value);
        }
    }
    visit_TypeVarTuple(node) {
        this.write("*");
        this.write(node.name);
        if (node.default_value) {
            this.write(" = ");
            this.visit(node.default_value);
        }
    }
    // FunctionType module visitor
    visit_FunctionType(node) {
        this.write("(");
        this.interleave(", ", (arg) => this.visit(arg), node.argtypes);
        this.write(") -> ");
        this.visit(node.returns);
    }
}

/**
 * Get the docstring from a function, class, or module node
 */
function getDocstring(node) {
    if (node.nodeType !== "FunctionDef" &&
        node.nodeType !== "AsyncFunctionDef" &&
        node.nodeType !== "ClassDef" &&
        node.nodeType !== "Module") {
        return null;
    }
    const body = "body" in node ? node.body : [];
    if (body.length === 0)
        return null;
    const firstStmt = body[0];
    if (firstStmt.nodeType !== "Expr")
        return null;
    const value = firstStmt.value;
    if (value.nodeType === "Constant" && typeof value.value === "string") {
        return value.value;
    }
    return null;
}
/**
 * Iterate over all fields of a node.
 */
// biome-ignore lint/suspicious/noExplicitAny: Generator yields node field values which can be any type
function* iterFields(node) {
    for (const [key, value] of Object.entries(node)) {
        if (key !== "nodeType" &&
            key !== "lineno" &&
            key !== "col_offset" &&
            key !== "end_lineno" &&
            key !== "end_col_offset") {
            yield [key, value];
        }
    }
}
/**
 * Iterate over all direct child nodes
 */
function* iterChildNodes(node) {
    for (const [, value] of iterFields(node)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                if (isASTNode(item)) {
                    yield item;
                }
            }
        }
        else if (isASTNode(value)) {
            yield value;
        }
    }
}
/**
 * Check if a value is an AST node
 */
// biome-ignore lint/suspicious/noExplicitAny: Type guard function needs to accept any value
function isASTNode(value) {
    return value && typeof value === "object" && "nodeType" in value;
}
/**
 * Get source segment from source code using node location info
 */
function getSourceSegment(source, node, options = {}) {
    const { padded = false } = options;
    if (!("lineno" in node) ||
        !("col_offset" in node) ||
        !("end_lineno" in node) ||
        !("end_col_offset" in node) ||
        node.lineno === undefined ||
        node.col_offset === undefined ||
        node.end_lineno === undefined ||
        node.end_col_offset === undefined) {
        return null;
    }
    const lines = source.split("\n");
    const startLine = node.lineno - 1; // Convert to 0-based
    const endLine = node.end_lineno - 1;
    const startCol = node.col_offset;
    const endCol = node.end_col_offset;
    if (startLine === endLine) {
        return lines[startLine]?.slice(startCol, endCol) || null;
    }
    const result = [];
    // First line
    if (lines[startLine]) {
        let firstLine = lines[startLine].slice(startCol);
        if (padded) {
            firstLine = " ".repeat(startCol) + firstLine;
        }
        result.push(firstLine);
    }
    // Middle lines
    for (let i = startLine + 1; i < endLine; i++) {
        if (lines[i] !== undefined) {
            result.push(lines[i]);
        }
    }
    // Last line
    if (lines[endLine]) {
        result.push(lines[endLine].slice(0, endCol));
    }
    return result.join("\n");
}
/**
 * Node factory functions for creating AST nodes
 */
const ast = {
    /**
     * Create a Name node
     */
    Name(id, ctx = "Load") {
        return {
            nodeType: "Name",
            id,
            ctx: { nodeType: ctx },
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Constant node
     */
    Constant(value, kind) {
        return {
            nodeType: "Constant",
            value,
            kind,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Call node
     */
    Call(func, args = [], keywords = []) {
        return {
            nodeType: "Call",
            func,
            args,
            keywords,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a BinOp node
     */
    BinOp(left, op, right) {
        // Handle string operator shorthand
        // biome-ignore lint/suspicious/noExplicitAny: String operator names need to be cast to operator node type
        const operatorNode = typeof op === "string" ? { nodeType: op } : op;
        return {
            nodeType: "BinOp",
            left,
            op: operatorNode,
            right,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create an Assign node
     */
    Assign(targets, value, type_comment) {
        return {
            nodeType: "Assign",
            targets,
            value,
            type_comment,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create an Expr node (expression statement)
     */
    Expr(value) {
        return {
            nodeType: "Expr",
            value,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a List node
     */
    List(elts, ctx = "Load") {
        return {
            nodeType: "List",
            elts,
            ctx: { nodeType: ctx },
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Tuple node
     */
    Tuple(elts, ctx = "Load") {
        return {
            nodeType: "Tuple",
            elts,
            ctx: { nodeType: ctx },
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create an Attribute node
     */
    Attribute(value, attr, ctx = "Load") {
        return {
            nodeType: "Attribute",
            value,
            attr,
            ctx: { nodeType: ctx },
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Dict node
     */
    Dict(keys, values) {
        return {
            nodeType: "Dict",
            keys,
            values,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a NamedExpr node (walrus operator)
     */
    NamedExpr(target, value) {
        return {
            nodeType: "NamedExpr",
            target,
            value,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Lambda node
     */
    Lambda(args, body) {
        return {
            nodeType: "Lambda",
            args,
            body,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create an IfExp node (conditional expression)
     */
    IfExp(test, body, orelse) {
        return {
            nodeType: "IfExp",
            test,
            body,
            orelse,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create an Await node
     */
    Await(value) {
        return {
            nodeType: "Await",
            value,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Yield node
     */
    Yield(value) {
        return {
            nodeType: "Yield",
            value,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a YieldFrom node
     */
    YieldFrom(value) {
        return {
            nodeType: "YieldFrom",
            value,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Starred node
     */
    Starred(value, ctx = "Load") {
        return {
            nodeType: "Starred",
            value,
            ctx: { nodeType: ctx },
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Slice node
     */
    Slice(lower, upper, step) {
        return {
            nodeType: "Slice",
            lower,
            upper,
            step,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Delete statement
     */
    Delete(targets) {
        return {
            nodeType: "Delete",
            targets,
            lineno: 1,
            col_offset: 0,
        };
    },
    /**
     * Create a Nonlocal statement
     */
    Nonlocal(names) {
        return {
            nodeType: "Nonlocal",
            names,
            lineno: 1,
            col_offset: 0,
        };
    },
};

// Export all types
// Export lexer
/**
 * Parse Python source code and return an AST (simplified API)
 * @param source The Python source code to parse
 * @param options Optional parsing options
 */
function parsePython(source, options) {
    return parse(source, options);
}
/**
 * Parse Python source code and return an AST
 * @param source The Python source code to parse
 * @param filename The filename (optional, defaults to '<unknown>')
 */
function parseModule(source, filename) {
    return parse(source, { filename });
}
/**
 * Convert an AST back to Python source code
 * @param node The AST node to unparse
 * @param indent The indentation string (default: 4 spaces)
 */
function toSource(node, indent = "    ") {
    return unparse(node, { indent });
}
/**
 * Dump an AST node to a formatted string for debugging
 */
function dump(node, options = {}) {
    const { annotateFields = true, includeAttributes = false, indent = null, showEmpty = false, } = options;
    // biome-ignore lint/suspicious/noExplicitAny: Supposed to be any
    function formatNode(node, level = 0) {
        if (!node || typeof node !== "object") {
            return JSON.stringify(node);
        }
        if (Array.isArray(node)) {
            if (node.length === 0 && !showEmpty) {
                return "[]";
            }
            const items = node.map((item) => formatNode(item, level + 1));
            if (indent !== null) {
                const indentStr = typeof indent === "string" ? indent : " ".repeat(indent);
                const currentIndent = indentStr.repeat(level + 1);
                const parentIndent = indentStr.repeat(level);
                return `[\n${currentIndent}${items.join(`,\n${currentIndent}`)}\n${parentIndent}]`;
            }
            return `[${items.join(", ")}]`;
        }
        if (!("nodeType" in node)) {
            return JSON.stringify(node);
        }
        const fields = [];
        const nodeType = node.nodeType;
        for (const [key, value] of Object.entries(node)) {
            if (key === "nodeType")
                continue;
            if (!includeAttributes &&
                (key === "lineno" ||
                    key === "col_offset" ||
                    key === "end_lineno" ||
                    key === "end_col_offset")) {
                continue;
            }
            if (!showEmpty &&
                (value === null ||
                    value === undefined ||
                    (Array.isArray(value) && value.length === 0))) {
                continue;
            }
            const formattedValue = formatNode(value, level + 1);
            if (annotateFields) {
                fields.push(`${key}=${formattedValue}`);
            }
            else {
                fields.push(formattedValue);
            }
        }
        const fieldsStr = fields.join(", ");
        if (indent !== null && fields.length > 1) {
            const indentStr = typeof indent === "string" ? indent : " ".repeat(indent);
            const currentIndent = indentStr.repeat(level + 1);
            const parentIndent = indentStr.repeat(level);
            return `${nodeType}(\n${currentIndent}${fields.join(`,\n${currentIndent}`)}\n${parentIndent})`;
        }
        return `${nodeType}(${fieldsStr})`;
    }
    return formatNode(node);
}
// Version information
const version = "1.0.0";

exports.Lexer = Lexer;
exports.NodeTransformer = NodeTransformer;
exports.NodeVisitor = NodeVisitor;
exports.ast = ast;
exports.copyLocation = copyLocation;
exports.dump = dump;
exports.fixMissingLocations = fixMissingLocations;
exports.getDocstring = getDocstring;
exports.getSourceSegment = getSourceSegment;
exports.incrementLineno = incrementLineno;
exports.isASTNode = isASTNode;
exports.iterChildNodes = iterChildNodes;
exports.iterFields = iterFields;
exports.literalEval = literalEval;
exports.parse = parse;
exports.parseFile = parseFile;
exports.parseModule = parseModule;
exports.parsePython = parsePython;
exports.toSource = toSource;
exports.unparse = unparse;
exports.version = version;
exports.walk = walk;
//# sourceMappingURL=index.js.map
