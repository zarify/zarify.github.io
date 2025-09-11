This directory holds local copies of third-party JS/CSS used by the app so it can run without CDN access.

Files expected/used by the project:
- codemirror.min.css
- codemirror.min.js
- codemirror-mode-python.min.js
- marked.min.js
- purify.min.js
- highlight.min.js
- highlight-github.min.css

How to populate:
1. Use the provided helper script from the project root:
   node scripts/fetch_vendors.js

2. The script will download the known files into `src/vendor` and will skip existing files.
   To force overwrite, pass `--force`.

Notes:
- Validate the downloaded files before deploying to production.
- Consider checking these files into git or using a package manager + build step if you want stricter control.
