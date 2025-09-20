/*
 * Lightweight vendored admonition extension.
 * This file implements a minimal marked extension that recognizes blocks:
 *
 * !!! type optional title text
 * body...
 * !!!
 *
 * It tokenizes the title with marked's inline lexer so inline code/backticks
 * are handled correctly. The factory returns an object with `extensions` to
 * match marked's expected shape. It also exposes `window.markedAdmonitionExtension`
 * and will auto-register if `marked.use` exists on load.
 */
(function (global) {
    'use strict'

    const admonitionTypes = [
        'abstract', 'attention', 'bug', 'caution', 'danger', 'error', 'example', 'failure', 'hint', 'info', 'note', 'question', 'quote', 'success', 'tip', 'warning'
    ];

    // start: !!! TYPE [title...]
    const startReg = new RegExp(`^!!!\\s+(${admonitionTypes.join('|')})(?:\\s+)?(.*)$`);
    const endReg = /^!!!\s*$/;

    const plugin = {
        name: 'admonition',
        level: 'block',
        start(src) {
            // return earliest index where an admonition may start
            const m = src.match(new RegExp(`(^|[\\r\\n])!!!\\s+(${admonitionTypes.join('|')})(?:\\s+)?(.*)`));
            return m ? m.index : undefined;
        },
        tokenizer(src, _tokens) {
            const lines = src.split(/\n/);
            if (!lines.length) return;

            if (!startReg.test(lines[0])) return;

            // find the matching closing '!!!' line
            let startLine = 0;
            let endLine = -1;
            for (let i = 0; i < lines.length; i++) {
                if (startReg.test(lines[i])) {
                    startLine = i;
                } else if (endReg.test(lines[i])) {
                    endLine = i;
                    break;
                }
            }

            if (endLine === -1) return;

            const header = startReg.exec(lines[startLine]) || [];
            const type = header[1] || '';
            const title = header[2] || '';
            const text = lines.slice(startLine + 1, endLine).join('\n');
            const raw = lines.slice(startLine, endLine + 1).join('\n');

            const token = {
                type: 'admonition',
                raw,
                icon: type,
                title,
                text,
                titleTokens: [],
                tokens: [],
                childTokens: ['title', 'text']
            };

            // Use marked's inline and block lexers so inline code in title is handled
            // and the body is tokenized normally.
            try {
                this.lexer.inlineTokens(token.title, token.titleTokens);
                this.lexer.blockTokens(token.text, token.tokens);
            } catch (e) {
                // if lexers are not present, fall back to raw text
            }

            return token;
        },
        renderer(token) {
            const nodeName = 'div';
            const className = 'admonition';
            const titleNode = 'p';

            // Defensive: filter any null/undefined tokens that may have slipped in
            const titleTokens = Array.isArray(token.titleTokens) ? token.titleTokens.filter(t => t != null) : [];
            const bodyTokens = Array.isArray(token.tokens) ? token.tokens.filter(t => t != null) : [];

            let titleHtml = '';
            try {
                if (titleTokens.length) titleHtml = this.parser.parseInline(titleTokens);
            } catch (e) {
                // fallback: escape raw title text
                titleHtml = (token.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            let bodyHtml = '';
            try {
                if (bodyTokens.length) bodyHtml = this.parser.parse(bodyTokens);
            } catch (e) {
                bodyHtml = (token.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            }

            return `<${nodeName} class="${className} ${className}-${token.icon}">` +
                `<${titleNode} class="${className}-title">${titleHtml}</${titleNode}>` +
                `${bodyHtml}` +
                `</${nodeName}>`;
        }
    };

    function factory() {
        return { extensions: [plugin] };
    }

    try {
        if (typeof global !== 'undefined') {
            global.markedAdmonitionExtension = factory;
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof global !== 'undefined' && global.marked && typeof global.marked.use === 'function') {
            // register by passing the extension object (marked accepts both shapes)
            try { global.marked.use(factory()); } catch (e) { /* ignore */ }
        }
    } catch (e) { /* ignore */ }

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));
