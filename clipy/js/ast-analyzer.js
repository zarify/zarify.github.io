// AST analyzer: robust variable analysis and normalized ctx access

let pyAst = null;

async function initializePyAst() {
    if (!pyAst) pyAst = await import('../vendor/py-ast/index.esm.js');
    return pyAst;
}

export class ASTAnalyzer {
    constructor() {
        this.cache = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await initializePyAst();
            this.initialized = true;
        }
        return this;
    }

    hashCode(str) {
        let h = 0;
        if (!str) return '0';
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            h = ((h << 5) - h) + c;
            h = h & h;
        }
        return String(h);
    }

    async parse(code) {
        if (!this.initialized) await this.initialize();
        const k = this.hashCode(code);
        if (this.cache.has(k)) return this.cache.get(k);
        try {
            const ast = pyAst.parse(code);
            if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(k, ast);
            return ast;
        } catch (e) {
            this.cache.set(k, null);
            return null;
        }
    }

    analyze(ast, expression) {
        if (!ast || !expression) return null;
        const [type, target] = expression.split(':');
        switch (type) {
            case 'variable_usage': return this.analyzeVariables(ast, target);
            case 'function_calls': return this.analyzeFunctionCalls(ast, target);
            case 'function_exists': return this.checkFunctionExists(ast, target);
            case 'control_flow': return this.analyzeControlFlow(ast, target);
            case 'function_count': return this.countFunctions(ast);
            case 'code_quality': return this.analyzeCodeQuality(ast, target);
            case 'class_analysis': return this.analyzeClasses(ast, target);
            case 'import_statements': return this.analyzeImports(ast, target);
            case 'magic_numbers': return this.analyzeMagicNumbers(ast, target);
            case 'exception_handling': return this.analyzeExceptionHandling(ast, target);
            case 'comprehensions': return this.analyzeComprehensions(ast, target);
            default: return this.genericQuery(ast, expression);
        }
    }

    checkFunctionExists(ast, functionName) {
        if (!ast || !ast.body) return null;

        // collect all function definitions matching the name
        const defs = [];
        const traverseDefs = (node) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) return node.forEach(traverseDefs);
            if (node.nodeType === 'FunctionDef' && (functionName === '*' || node.name === functionName)) {
                defs.push(node);
            }
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (c && typeof c === 'object') traverseDefs(c);
            }
        };
        traverseDefs(ast);
        if (defs.length === 0) return null;

        // Find call sites for a given function name across the AST
        const findCallSites = (root, name) => {
            const calls = [];
            const seen = new Set();
            const walk = (n) => {
                if (!n || typeof n !== 'object' || seen.has(n)) return;
                seen.add(n);
                if (Array.isArray(n)) return n.forEach(walk);
                if (n.nodeType === 'Call' && n.func) {
                    if (n.func.nodeType === 'Name' && n.func.id === name) calls.push(n.lineno || null);
                }
                for (const k of Object.keys(n)) {
                    const c = n[k];
                    if (c && typeof c === 'object') walk(c);
                }
            };
            walk(root);
            // normalize and dedupe
            const uniq = Array.from(new Set(calls.filter(Boolean))).sort((a, b) => a - b);
            return uniq;
        };

        const results = defs.map(fn => {
            const name = fn.name;
            const lineno = fn.lineno;
            const called = findCallSites(ast, name);
            // recursive if function calls itself within its body
            const recursive = (function () {
                const callsInBody = findCallSites(fn, name);
                return callsInBody.length > 0;
            })();
            const parameters = (fn.args && fn.args.args) ? fn.args.args.length : 0;
            return { name, lineno, parameters, called, recursive };
        });

        return results.length === 1 ? results[0] : results;
    }

    analyzeVariables(ast, variableName) {
        // If no variableName provided, return an array of reports for each variable
        if (!variableName) {
            // collect ALL variable names from Name nodes (both assignments and usages)
            const names = new Set();
            const collect = (n) => {
                if (!n || typeof n !== 'object') return;
                if (Array.isArray(n)) return n.forEach(collect);
                try {
                    // Collect ALL Name nodes - assignments, usages, parameters, etc.
                    if (n.nodeType === 'Name' && n.id) {
                        names.add(n.id);
                    }
                    // Also collect from assignment targets
                    if (n.nodeType === 'Assign' && Array.isArray(n.targets)) {
                        n.targets.forEach(t => {
                            if (t && t.nodeType === 'Name' && t.id) names.add(t.id);
                        });
                    }
                    if (n.nodeType === 'AnnAssign' && n.target && n.target.nodeType === 'Name' && n.target.id) {
                        names.add(n.target.id);
                    }
                    if (n.nodeType === 'AugAssign' && n.target && n.target.nodeType === 'Name' && n.target.id) {
                        names.add(n.target.id);
                    }
                    // Collect function parameters
                    if (n.nodeType === 'FunctionDef' && n.args && Array.isArray(n.args.args)) {
                        n.args.args.forEach(a => {
                            const aname = a.arg || a.argname || a.id;
                            if (aname) names.add(aname);
                        });
                    }
                    // Collect function names
                    if (n.nodeType === 'FunctionDef' && n.name) {
                        names.add(n.name);
                    }
                    // Collect class names
                    if (n.nodeType === 'ClassDef' && n.name) {
                        names.add(n.name);
                    }
                    // Collect import names
                    if (n.nodeType === 'Import' && Array.isArray(n.names)) {
                        n.names.forEach(alias => {
                            const name = alias.asname || alias.name;
                            if (name) names.add(name);
                        });
                    }
                    if (n.nodeType === 'ImportFrom' && Array.isArray(n.names)) {
                        n.names.forEach(alias => {
                            const name = alias.asname || alias.name;
                            if (name && name !== '*') names.add(name);
                        });
                    }
                } catch (e) {
                    // ignore
                }
                for (const k of Object.keys(n)) {
                    const c = n[k];
                    if (c && typeof c === 'object') collect(c);
                }
            };
            if (ast && Array.isArray(ast.body)) ast.body.forEach(collect);
            const reports = [];
            for (const name of names) {
                const r = this.analyzeVariables(ast, name) || { assigned: false, used: false, modified: false, assignments: [], usages: [] };
                reports.push({ name, report: r });
            }
            reports.sort((a, b) => a.name.localeCompare(b.name));
            return { variables: reports };
        }

        const analysis = { assigned: false, used: false, modified: false, assignments: [], usages: [], annotation: null, annotations: [] };
        const getCtx = (node) => node && node.ctx && (node.ctx.nodeType || node.ctx._type || node.ctx.type);

        // Helper to stringify simple annotation nodes (Name/Attribute/Subscript)
        const stringifyAnnotation = (ann) => {
            if (!ann) return null;
            try {
                if (ann.nodeType === 'Name') return ann.id;
                if (ann.nodeType === 'Attribute') return this.extractQualifiedName(ann);
                if (ann.nodeType === 'Subscript') {
                    // e.g., List[int] -> extract base and subscript
                    const base = ann.value ? stringifyAnnotation(ann.value) : null;
                    const slice = ann.slice ? (ann.slice.value ? stringifyAnnotation(ann.slice.value) : (ann.slice.id || ann.slice.value || null)) : null;
                    return base && slice ? `${base}[${slice}]` : (base || slice || null);
                }
                if (ann.nodeType === 'Constant' && typeof ann.value === 'string') return ann.value;
            } catch (e) {
                // ignore
            }
            return null;
        };

        const seen = new Set();

        // Helper: check if a subtree contains a Load reference to variableName
        const containsSelfReference = (root) => {
            if (!root || typeof root !== 'object') return false;
            const vseen = new Set();
            const check = (n) => {
                if (!n || typeof n !== 'object' || vseen.has(n)) return false;
                vseen.add(n);
                if (Array.isArray(n)) return n.some(check);
                if (n.nodeType === 'Name') {
                    const ctx = n.ctx && (n.ctx.nodeType || n.ctx._type || n.ctx.type);
                    if (ctx === 'Load' && (variableName === '*' || n.id === variableName)) return true;
                }
                for (const k of Object.keys(n)) {
                    const c = n[k];
                    if (c && typeof c === 'object' && check(c)) return true;
                }
                return false;
            };
            return check(root);
        };
        const traverse = (node, inheritedLineno, parentKey) => {
            if (!node || typeof node !== 'object' || seen.has(node)) return;
            seen.add(node);
            if (Array.isArray(node)) return node.forEach(n => traverse(n, inheritedLineno, parentKey));

            // Prefer the inherited (containing statement) lineno so nested
            // expression nodes (e.g. Name inside FormattedValue) report the
            // surrounding statement's line number.
            const thisLineno = inheritedLineno || node.lineno;

            if (node.nodeType === 'Assign' && Array.isArray(node.targets)) {
                node.targets.forEach(t => {
                    if (t && t.nodeType === 'Name' && (variableName === '*' || t.id === variableName)) {
                        analysis.assigned = true;
                        analysis.assignments.push({ name: t.id, lineno: thisLineno, col_offset: (t.col_offset !== undefined ? Number(t.col_offset) : (node.col_offset !== undefined ? Number(node.col_offset) : 0)) });
                    }
                    // If assigning to an attribute of the variable (e.g. obj.attr = ...)
                    if (t && t.nodeType === 'Attribute' && t.value && t.value.nodeType === 'Name' && (variableName === '*' || t.value.id === variableName)) {
                        // report as assigned to the attribute and mark base var as modified
                        const attrName = t.attr || t.attrname || '<attr>';
                        analysis.assignments.push({ name: `${t.value.id}.${attrName}`, lineno: thisLineno, col_offset: (t.col_offset !== undefined ? Number(t.col_offset) : (node.col_offset !== undefined ? Number(node.col_offset) : 0)) });
                        analysis.modified = true;
                    }
                });
                // If RHS references the variable being assigned (e.g. x = x + ...), mark as modified
                if (node.value && containsSelfReference(node.value)) {
                    analysis.modified = true;
                }
            }

            if (node.nodeType === 'AnnAssign' && node.target && node.target.nodeType === 'Name') {
                const t = node.target;
                if (variableName === '*' || t.id === variableName) {
                    analysis.assigned = true;
                    analysis.assignments.push({ name: t.id, lineno: thisLineno, col_offset: (t.col_offset !== undefined ? Number(t.col_offset) : (node.col_offset !== undefined ? Number(node.col_offset) : 0)) });
                    // capture annotation if present
                    if (node.annotation) {
                        const ann = stringifyAnnotation(node.annotation) || (node.annotation.id || null);
                        if (ann) {
                            analysis.annotation = ann;
                            analysis.annotations.push({ name: t.id, annotation: ann, lineno: thisLineno });
                        }
                    }
                }
                if (node.value && containsSelfReference(node.value)) {
                    analysis.modified = true;
                }
            }
            // AnnAssign where the target is an Attribute (e.g., obj.attr: int = ...)
            if (node.nodeType === 'AnnAssign' && node.target && node.target.nodeType === 'Attribute') {
                const t = node.target;
                if (t.value && t.value.nodeType === 'Name' && (variableName === '*' || t.value.id === variableName)) {
                    const attrName = t.attr || t.attrname || '<attr>';
                    analysis.assignments.push({ name: `${t.value.id}.${attrName}`, lineno: thisLineno, col_offset: (t.col_offset !== undefined ? Number(t.col_offset) : (node.col_offset !== undefined ? Number(node.col_offset) : 0)) });
                    analysis.modified = true;
                    if (node.annotation) {
                        const ann = stringifyAnnotation(node.annotation) || (node.annotation.id || null);
                        if (ann) analysis.annotations.push({ name: `${t.value.id}.${attrName}`, annotation: ann, lineno: thisLineno });
                    }
                }
            }

            if (node.nodeType === 'AugAssign' && node.target) {
                const t = node.target;
                if (t.nodeType === 'Name' && (variableName === '*' || t.id === variableName)) {
                    analysis.assigned = true;
                    analysis.modified = true;
                    analysis.assignments.push({ name: t.id, lineno: thisLineno, col_offset: (t.col_offset !== undefined ? Number(t.col_offset) : (node.col_offset !== undefined ? Number(node.col_offset) : 0)) });
                }
                // AugAssign to attribute (e.g., obj.attr += 1)
                if (t.nodeType === 'Attribute' && t.value && t.value.nodeType === 'Name' && (variableName === '*' || t.value.id === variableName)) {
                    const attrName = t.attr || t.attrname || '<attr>';
                    analysis.assignments.push({ name: `${t.value.id}.${attrName}`, lineno: thisLineno, col_offset: (t.col_offset !== undefined ? Number(t.col_offset) : (node.col_offset !== undefined ? Number(node.col_offset) : 0)) });
                    analysis.modified = true;
                }
            }

            if (node.nodeType === 'Name') {
                const ctx = getCtx(node);
                // Coerce to the containing statement line when available.
                const resolvedLineno = thisLineno;
                // Do not count Name nodes inside assignment targets as usages.
                const inTarget = parentKey === 'targets' || parentKey === 'target';
                if (ctx === 'Load' && !inTarget && (variableName === '*' || node.id === variableName)) {
                    analysis.used = true;
                    analysis.usages.push({ name: node.id, lineno: resolvedLineno, col_offset: (node.col_offset !== undefined ? Number(node.col_offset) : 0) });
                }
                if ((ctx === 'Store' || ctx === 'Del') && (variableName === '*' || node.id === variableName)) {
                    analysis.assigned = true;
                    analysis.assignments.push({ name: node.id, lineno: resolvedLineno, col_offset: (node.col_offset !== undefined ? Number(node.col_offset) : 0) });
                }
            }

            // Capture function parameter annotations
            if (node.nodeType === 'FunctionDef' && node.args && Array.isArray(node.args.args)) {
                node.args.args.forEach(a => {
                    const aname = a.arg || a.argname || a.id || null;
                    if (!aname) return;
                    if (a.annotation) {
                        const ann = stringifyAnnotation(a.annotation) || (a.annotation.id || null);
                        if (ann) {
                            analysis.annotations.push({ name: aname, annotation: ann, lineno: a.lineno || node.lineno });
                            if (variableName === '*' || variableName === aname) {
                                analysis.annotation = ann;
                            }
                        }
                    }
                });
            }

            if (node.nodeType === 'Call' && node.func && node.func.nodeType === 'Attribute') {
                const v = node.func.value;
                if (v && v.nodeType === 'Name' && (variableName === '*' || v.id === variableName)) analysis.modified = true;
            }

            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(item => traverse(item, thisLineno, k));
                else if (typeof c === 'object') traverse(c, thisLineno, k);
            }
        };

        if (ast && Array.isArray(ast.body)) ast.body.forEach(n => traverse(n, n.lineno, 'body'));

        // Deduplicate and normalize assignments/usages (unique by name+lineno+col_offset)
        const normalizeEntries = (arr) => {
            const seen = new Set();
            const out = [];
            for (const e of (arr || [])) {
                const ln = e && e.lineno ? Number(e.lineno) : 0;
                const co = e && e.col_offset ? Number(e.col_offset) : 0;
                const key = `${e.name}::${ln}::${co}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push({ name: e.name, lineno: ln, col_offset: co });
                }
            }
            out.sort((a, b) => a.lineno - b.lineno || a.col_offset - b.col_offset || a.name.localeCompare(b.name));
            return out;
        };

        analysis.assignments = normalizeEntries(analysis.assignments);
        analysis.usages = normalizeEntries(analysis.usages);

        // Remove usages that exactly match an assignment position (same name+lineno+col_offset)
        const assignKeys = new Set(analysis.assignments.map(a => `${a.name}::${a.lineno}::${a.col_offset}`));
        analysis.usages = analysis.usages.filter(u => !assignKeys.has(`${u.name}::${u.lineno}::${u.col_offset}`));

        return (analysis.assigned || analysis.used) ? analysis : null;
    }

    /**
     * Analyze control flow structures
     */
    analyzeControlFlow(ast, flowType) {
        const flows = {
            if_statement: 0,
            for_loop: 0,
            while_loop: 0,
            try_except: 0,
            with_statement: 0
        };

        const details = [];

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'If') {
                flows.if_statement++;
                details.push({ type: 'if', lineno: node.lineno });
            }
            if (node.nodeType === 'For') {
                flows.for_loop++;
                details.push({ type: 'for', lineno: node.lineno });
            }
            if (node.nodeType === 'While') {
                flows.while_loop++;
                details.push({ type: 'while', lineno: node.lineno });
            }
            if (node.nodeType === 'Try') {
                flows.try_except++;
                details.push({ type: 'try', lineno: node.lineno });
            }
            if (node.nodeType === 'With') {
                flows.with_statement++;
                details.push({ type: 'with', lineno: node.lineno });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
            if (node.finalbody && Array.isArray(node.finalbody)) {
                node.finalbody.forEach(traverse);
            }
            if (node.handlers && Array.isArray(node.handlers)) {
                node.handlers.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        if (flowType && flowType !== '*') {
            return flows[flowType] > 0 ? {
                type: flowType,
                count: flows[flowType],
                details: details.filter(d => d.type === flowType.replace('_statement', '').replace('_loop', ''))
            } : null;
        }

        // Return all flow analysis
        return Object.values(flows).some(count => count > 0) ? { flows, details } : null;
    }

    /**
     * Count total functions in code
     */
    countFunctions(ast) {
        let count = 0;
        const functions = [];

        // Manual traversal
        // helper to find call sites for a function name
        const findCallSites = (root, name) => {
            const calls = [];
            const seen = new Set();
            const walk = (n) => {
                if (!n || typeof n !== 'object' || seen.has(n)) return;
                seen.add(n);
                if (Array.isArray(n)) return n.forEach(walk);
                if (n.nodeType === 'Call' && n.func) {
                    if (n.func.nodeType === 'Name' && n.func.id === name) calls.push(n.lineno || null);
                }
                for (const k of Object.keys(n)) {
                    const c = n[k];
                    if (c && typeof c === 'object') walk(c);
                }
            };
            walk(root);
            return Array.from(new Set(calls.filter(Boolean))).sort((a, b) => a - b);
        };

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                count++;
                const name = node.name;
                const lineno = node.lineno;
                const parameters = (node.args && node.args.args) ? node.args.args.length : 0;
                const called = findCallSites(ast, name);
                const recursive = findCallSites(node, name).length > 0;
                functions.push({ name, lineno, parameters, called, recursive });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return count > 0 ? { count, functions } : null;
    }

    /**
     * Analyze function calls in the AST.
     * If target is provided (e.g. 'print' or a function name), return details for that function.
     * If no target, return an array of all called functions with counts and line numbers.
     */
    analyzeFunctionCalls(ast, target) {
        const callsByName = new Map();
        const definitionsByName = new Map();

        // collect function definitions to know if a function is user-defined
        const collectDefs = (node) => {
            if (!node) return;
            if (node.nodeType === 'FunctionDef') {
                const name = node.name;
                const params = (node.args && node.args.args) ? node.args.args.length : 0;
                const lineno = node.lineno;
                definitionsByName.set(name, { name, lineno, parameters: params });
            }
            for (const k of Object.keys(node || {})) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(collectDefs);
                else if (typeof c === 'object') collectDefs(c);
            }
        };

        if (ast && Array.isArray(ast.body)) ast.body.forEach(collectDefs);

        // traverse to find Call nodes
        const traverse = (node) => {
            if (!node) return;
            if (node.nodeType === 'Call') {
                let calledName = null;
                if (node.func) {
                    if (node.func.nodeType === 'Name') calledName = node.func.id;
                    else if (node.func.nodeType === 'Attribute') calledName = this.extractQualifiedName(node.func);
                }
                const lineno = node.lineno || null;
                const key = calledName || '<unknown>';
                if (!callsByName.has(key)) callsByName.set(key, { name: key, count: 0, lines: new Set(), callSites: [] });
                const entry = callsByName.get(key);
                entry.count++;
                if (lineno) entry.lines.add(lineno);
                entry.callSites.push({ lineno, args: (node.args || []).length });
            }

            for (const k of Object.keys(node || {})) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast && Array.isArray(ast.body)) ast.body.forEach(traverse);

        // normalize to arrays and add definition info
        const resultList = [];
        for (const [name, v] of callsByName.entries()) {
            const lines = Array.from(v.lines).sort((a, b) => a - b);
            const def = definitionsByName.get(name) || null;
            const isBuiltin = !!name && !def;
            resultList.push({
                name: name === '<unknown>' ? null : name,
                count: v.count,
                lines,
                callSites: v.callSites,
                defined: def,
                isBuiltin
            });
        }

        // If specific target requested, find and return detailed object
        if (target && target !== '*') {
            const found = resultList.find(r => r.name === target) || null;
            if (!found) {
                // If not found among calls but defined as function, return definition info with zero calls
                const def = definitionsByName.get(target);
                if (def) return { name: target, defined: def, count: 0, lines: [], callSites: [] };
                return null;
            }
            // enhance: include whether any calls occur within try blocks
            // simple heuristic: reuse analyzeExceptionHandling to check tryBlocks and whether call names appear inside
            const tryInfo = this.analyzeExceptionHandling(ast, '*');
            const withinTry = (tryInfo && tryInfo.tryBlocks) ? tryInfo.tryBlocks.some(tb => tb.calls && tb.calls.some(c => c.name === target)) : false;
            return Object.assign({}, found, { withinTry });
        }

        // sort resultList by name
        resultList.sort((a, b) => {
            if ((a.name || '') < (b.name || '')) return -1;
            if ((a.name || '') > (b.name || '')) return 1;
            return b.count - a.count;
        });

        return resultList.length > 0 ? { functions: resultList, count: resultList.length } : null;
    }

    /**
     * Check for docstrings in functions and classes
     */
    checkDocstrings(ast) {
        const analysis = {
            functions: { total: 0, withDocstring: 0 },
            classes: { total: 0, withDocstring: 0 },
            details: []
        };

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                analysis.functions.total++;
                const docstring = this.getDocstring(node);
                if (docstring) {
                    analysis.functions.withDocstring++;
                }
                analysis.details.push({
                    type: 'function',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });
            }

            if (node.nodeType === 'ClassDef') {
                analysis.classes.total++;
                const docstring = this.getDocstring(node);
                if (docstring) {
                    analysis.classes.withDocstring++;
                }
                analysis.details.push({
                    type: 'class',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        const hasAnyDocstring = analysis.functions.withDocstring > 0 || analysis.classes.withDocstring > 0;
        return hasAnyDocstring ? analysis : null;
    }

    /**
     * Get docstring from a function or class node
     */
    getDocstring(node) {
        if (node.body && node.body.length > 0) {
            const firstStmt = node.body[0];
            if (firstStmt.nodeType === 'Expr' &&
                firstStmt.value &&
                firstStmt.value.nodeType === 'Constant' &&
                typeof firstStmt.value.value === 'string') {
                return firstStmt.value.value;
            }
        }
        return null;
    }

    /**
     * Analyze code quality aspects
     */
    analyzeCodeQuality(ast, qualityCheck) {
        switch (qualityCheck) {
            case 'has_docstring':
                return this.checkDocstrings(ast);
            case 'no_hardcoded_values':
                return this.checkHardcodedValues(ast);
            case 'proper_naming':
                return this.checkNamingConventions ? this.checkNamingConventions(ast) : null;
            case 'complexity':
                return this.calculateComplexity(ast);
            default:
                return this.generalQualityCheck(ast);
        }
    }

    /**
     * Generic AST query for basic node type searches
     */
    genericQuery(ast, expression) {
        const results = [];
        const nodeType = expression;

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === nodeType) {
                results.push({
                    type: nodeType,
                    lineno: node.lineno,
                    details: this.extractNodeDetails(node)
                });
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return results.length > 0 ? { type: nodeType, count: results.length, results } : null;
    }

    /**
     * Extract relevant details from an AST node
     */
    extractNodeDetails(node) {
        const details = { nodeType: node.nodeType };

        if (node.name) details.name = node.name;
        if (node.id) details.id = node.id;
        if (node.lineno) details.lineno = node.lineno;
        if (node.col_offset !== undefined) details.col_offset = node.col_offset;

        return details;
    }

    /**
     * Custom advanced query (placeholder for future expansion)
     */
    customQuery(ast, queryExpression) {
        import('./logger.js').then(m => m.warn('Custom queries not yet implemented:', queryExpression)).catch(() => console.warn('Custom queries not yet implemented:', queryExpression))
        return null;
    }

    /**
     * Check for hardcoded values (numbers, strings) that might be better as constants
     */
    checkHardcodedValues(ast) {
        const hardcodedValues = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'Constant') {
                const value = node.value;
                if (typeof value === 'number' && ![0, 1, -1, 2, 10, 100].includes(value)) {
                    hardcodedValues.push({
                        value: value,
                        type: 'number',
                        lineno: node.lineno
                    });
                } else if (typeof value === 'string' && value.length > 10) {
                    hardcodedValues.push({
                        value: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
                        type: 'string',
                        lineno: node.lineno
                    });
                }
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return hardcodedValues.length > 0 ? { hardcodedValues } : null;
    }

    /**
     * Basic complexity calculation (simplified cyclomatic complexity)
     */
    calculateComplexity(ast) {
        let complexity = 1; // Base complexity

        const traverse = (node) => {
            if (!node) return;

            if (['If', 'For', 'While', 'Try'].includes(node.nodeType)) {
                complexity++;
            }
            if (node.nodeType === 'ExceptHandler') {
                complexity++;
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return { complexity };
    }

    /**
     * General code quality assessment
     */
    generalQualityCheck(ast) {
        return {
            functions: this.countFunctions(ast),
            docstrings: this.checkDocstrings(ast),
            complexity: this.calculateComplexity(ast),
            controlFlow: this.analyzeControlFlow(ast, '*')
        };
    }

    /**
     * Analyze classes, methods, and inheritance
     */
    analyzeClasses(ast, className) {
        const classes = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'ClassDef') {
                const name = node.name;
                const lineno = node.lineno;

                // Extract base classes (inheritance)
                const baseClasses = [];
                if (node.bases && Array.isArray(node.bases)) {
                    node.bases.forEach(base => {
                        if (base.nodeType === 'Name') {
                            baseClasses.push(base.id);
                        } else if (base.nodeType === 'Attribute') {
                            // Handle qualified names like package.ClassName
                            baseClasses.push(this.extractQualifiedName(base));
                        }
                    });
                }

                // Extract methods defined in this class
                const methods = [];
                if (node.body && Array.isArray(node.body)) {
                    node.body.forEach(stmt => {
                        if (stmt.nodeType === 'FunctionDef') {
                            const methodName = stmt.name;
                            const parameters = (stmt.args && stmt.args.args) ? stmt.args.args.length : 0;
                            const docstring = this.getDocstring(stmt);
                            const isPrivate = methodName.startsWith('_');
                            const isSpecial = methodName.startsWith('__') && methodName.endsWith('__');

                            methods.push({
                                name: methodName,
                                parameters: parameters,
                                lineno: stmt.lineno,
                                hasDocstring: !!docstring,
                                isPrivate: isPrivate,
                                isSpecial: isSpecial
                            });
                        }
                    });
                }

                const classInfo = {
                    name: name,
                    lineno: lineno,
                    baseClasses: baseClasses,
                    methods: methods,
                    methodCount: methods.length,
                    hasDocstring: !!this.getDocstring(node)
                };

                // If looking for a specific class, only include matches
                if (!className || className === '*' || name === className) {
                    classes.push(classInfo);
                }
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        if (className && className !== '*') {
            const found = classes.find(c => c.name === className);
            return found || null;
        }

        return classes.length > 0 ? { classes, count: classes.length } : null;
    }

    /**
     * Extract qualified name from Attribute node (e.g., package.ClassName)
     */
    extractQualifiedName(node) {
        if (!node) return '';

        if (node.nodeType === 'Name') {
            return node.id;
        } else if (node.nodeType === 'Attribute') {
            const base = this.extractQualifiedName(node.value);
            return base ? `${base}.${node.attr}` : node.attr;
        }
        return '';
    }

    /**
     * Analyze import statements
     */
    analyzeImports(ast, importTarget) {
        const imports = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'Import') {
                if (node.names && Array.isArray(node.names)) {
                    node.names.forEach(alias => {
                        const module = alias.name;
                        const asName = alias.asname;
                        imports.push({
                            type: 'import',
                            module: module,
                            alias: asName,
                            lineno: node.lineno,
                            qualified: false
                        });
                    });
                }
            }

            if (node.nodeType === 'ImportFrom') {
                const module = node.module;
                const level = node.level || 0; // For relative imports

                if (node.names && Array.isArray(node.names)) {
                    node.names.forEach(alias => {
                        const name = alias.name;
                        const asName = alias.asname;
                        imports.push({
                            type: 'from_import',
                            module: module,
                            name: name,
                            alias: asName,
                            level: level,
                            lineno: node.lineno,
                            qualified: true,
                            isWildcard: name === '*'
                        });
                    });
                }
            }

            // Recursively traverse (though imports are typically at module level)
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        // Filter by target if specified
        if (importTarget && importTarget !== '*') {
            const filtered = imports.filter(imp =>
                imp.module === importTarget ||
                imp.name === importTarget ||
                (imp.module && imp.module.includes(importTarget))
            );
            return filtered.length > 0 ? { imports: filtered, count: filtered.length } : null;
        }

        return imports.length > 0 ? { imports, count: imports.length } : null;
    }

    /**
     * Analyze magic numbers (hardcoded numbers that should be constants)
     */
    analyzeMagicNumbers(ast, threshold = '10') {
        const magicNumbers = [];
        const thresholdValue = threshold ? parseInt(threshold) : 10;

        // Common non-magic numbers that are typically acceptable
        const acceptableNumbers = new Set([0, 1, -1, 2, 10, 100]);

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'Constant' && typeof node.value === 'number') {
                const value = node.value;

                // Skip acceptable numbers and small numbers below threshold
                if (!acceptableNumbers.has(value) && Math.abs(value) >= thresholdValue) {
                    magicNumbers.push({
                        value: value,
                        lineno: node.lineno,
                        col_offset: node.col_offset
                    });
                }
            }

            // Also check for numbers in other contexts (Num node for older Python ASTs)
            if (node.nodeType === 'Num' && typeof node.n === 'number') {
                const value = node.n;
                if (!acceptableNumbers.has(value) && Math.abs(value) >= thresholdValue) {
                    magicNumbers.push({
                        value: value,
                        lineno: node.lineno,
                        col_offset: node.col_offset
                    });
                }
            }            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return magicNumbers.length > 0 ? {
            magicNumbers,
            count: magicNumbers.length,
            threshold: thresholdValue
        } : null;
    }

    /**
     * Analyze comprehensions (list/dict/set/generator) and report structure
     */
    analyzeComprehensions(ast, target) {
        const comps = [];

        const extractComp = (node) => {
            if (!node) return null;
            const type = node.nodeType || '<comp>';
            const lineno = node.lineno;
            const details = { type, lineno, generators: 0, targets: [], ifs: 0, elt: null };

            // generators are under "generators" or "comprehension" depending on AST
            const gens = node.generators || node.generator || node.generators || [];
            if (Array.isArray(gens) && gens.length > 0) {
                details.generators = gens.length;
                gens.forEach(g => {
                    // target of the comprehension (e.g., x in for x in y)
                    if (g && g.target) {
                        const tname = (g.target.id || g.target.arg || g.target.name) || this.extractQualifiedName(g.target);
                        if (tname) details.targets.push(tname);
                    }
                    if (g && g.ifs && Array.isArray(g.ifs)) details.ifs += g.ifs.length;
                });
            }

            // element expression (what is produced)
            if (node.elt) {
                details.elt = this.extractNodeDetails(node.elt);
            } else if (node.key) {
                // dict comp has key/value
                details.key = this.extractNodeDetails(node.key);
                details.value = this.extractNodeDetails(node.value);
            }

            return details;
        };

        const traverse = (node) => {
            if (!node) return;
            if (['ListComp', 'DictComp', 'SetComp', 'GeneratorExp'].includes(node.nodeType)) {
                const d = extractComp(node);
                if (d) comps.push(d);
            }
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) ast.body.forEach(traverse);

        if (target && target !== '*') {
            // filter by target appearing in targets
            const filtered = comps.filter(c => c.targets && c.targets.includes(target));
            return filtered.length > 0 ? { comprehensions: filtered, count: filtered.length } : null;
        }

        return comps.length > 0 ? { comprehensions: comps, count: comps.length } : null;
    }

    /**
     * Analyze exception handling and check if code is within try blocks
     */
    analyzeExceptionHandling(ast, target) {
        const tryBlocks = [];
        const exceptHandlers = [];
        let withinTryContext = false;

        // Track line ranges of try blocks for "withinTry" analysis
        const tryRanges = [];

        const traverse = (node, inTryBlock = false, ctx = null) => {
            if (!node) return;
            if (node.nodeType === 'Try') {
                const tryStart = node.lineno;
                let tryEnd = tryStart;

                // Calculate end line by examining body
                if (node.body && Array.isArray(node.body) && node.body.length > 0) {
                    const lastStmt = node.body[node.body.length - 1];
                    if (lastStmt.lineno) {
                        tryEnd = lastStmt.lineno;
                    }
                }

                tryRanges.push({ start: tryStart, end: tryEnd });

                const handlers = [];
                if (node.handlers && Array.isArray(node.handlers)) {
                    node.handlers.forEach(handler => {
                        const exceptionType = handler.type ?
                            (handler.type.id || this.extractQualifiedName(handler.type)) :
                            'Exception';
                        const handlerName = handler.name;

                        handlers.push({
                            exceptionType: exceptionType,
                            name: handlerName,
                            lineno: handler.lineno
                        });

                        exceptHandlers.push({
                            exceptionType: exceptionType,
                            name: handlerName,
                            lineno: handler.lineno,
                            tryLineno: tryStart
                        });
                    });
                }

                const hasFinally = node.finalbody && node.finalbody.length > 0;
                const hasElse = node.orelse && node.orelse.length > 0;

                // collect calls inside this try block
                const calls = [];

                tryBlocks.push({
                    lineno: tryStart,
                    endLineno: tryEnd,
                    handlers: handlers,
                    hasFinally: hasFinally,
                    hasElse: hasElse,
                    handlerCount: handlers.length,
                    calls: calls
                });

                // Traverse try body with try context and a calls context
                if (node.body && Array.isArray(node.body)) {
                    node.body.forEach(child => traverse(child, true, { calls, tryStart }));
                }

                // Traverse handlers
                if (node.handlers && Array.isArray(node.handlers)) {
                    node.handlers.forEach(handler => {
                        if (handler.body && Array.isArray(handler.body)) {
                            handler.body.forEach(child => traverse(child, false, null));
                        }
                    });
                }

                // Traverse else and finally
                if (node.orelse && Array.isArray(node.orelse)) {
                    node.orelse.forEach(child => traverse(child, false, null));
                }
                if (node.finalbody && Array.isArray(node.finalbody)) {
                    node.finalbody.forEach(child => traverse(child, false, null));
                }

                return; // Don't traverse children again
            }

            // Check if we're in a try context for specific target analysis
            if (inTryBlock && target && target !== '*') {
                // This is a simplified check - you might want to make this more sophisticated
                // to match specific patterns within try blocks
                withinTryContext = true;
            }

            // If this is a call and we're in a try context, record it
            if (node.nodeType === 'Call' && inTryBlock && ctx && Array.isArray(ctx.calls)) {
                let calledName = null;
                if (node.func) {
                    if (node.func.nodeType === 'Name') calledName = node.func.id;
                    else if (node.func.nodeType === 'Attribute') calledName = this.extractQualifiedName(node.func);
                }
                ctx.calls.push({ name: calledName, lineno: node.lineno });
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(child => traverse(child, inTryBlock));
                else if (typeof c === 'object') traverse(c, inTryBlock);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(node => traverse(node, false));
        }

        // If target is specified, check if that target is within a try block
        if (target && target !== '*') {
            return {
                withinTry: withinTryContext,
                tryBlocks: tryBlocks,
                exceptHandlers: exceptHandlers,
                tryRanges: tryRanges
            };
        }

        return (tryBlocks.length > 0 || exceptHandlers.length > 0) ? {
            tryBlocks: tryBlocks,
            exceptHandlers: exceptHandlers,
            tryCount: tryBlocks.length,
            handlerCount: exceptHandlers.length
        } : null;
    }
}

/**
 * Global AST analyzer instance for shared use
 */
let globalAnalyzer = null;

/**
 * Get or create global AST analyzer instance
 */
export async function getASTAnalyzer() {
    if (!globalAnalyzer) {
        globalAnalyzer = new ASTAnalyzer();
        await globalAnalyzer.initialize();
    }
    return globalAnalyzer;
}

/**
 * Convenience function for quick AST analysis
 * @param {string} code - Python source code
 * @param {string} expression - Analysis query expression
 * @returns {Promise<Object|null>} - Analysis result
 */
export async function analyzeCode(code, expression) {
    try {
        const analyzer = await getASTAnalyzer();
        const ast = await analyzer.parse(code);
        if (!ast) return null;
        return analyzer.analyze(ast, expression);
    } catch (error) {
        // Use centralized logger so we can silence in tests when desired
        try { const { error: logError } = await import('./logger.js'); logError('AST analysis failed:', error); } catch (_e) { console.error('AST analysis failed:', error); }
        return null;
    }
}

// Export for browser global access if needed
if (typeof window !== 'undefined') {
    window.ASTAnalyzer = ASTAnalyzer;
    window.analyzeCode = analyzeCode;
}
