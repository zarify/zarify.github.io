## 2025-09-06
- Fix: Saving drafts in authoring mode won't create multiple copies
- Test grouping added
  - Test running can rely on previous test success
  - Test groups can rely on previous group success
- **Note:** This will break previous test configuratons

## 2025-09-05
- Proof of concept Abstract Syntax Tree feedback and test options
  - AST feedback and test types added
  - Uses JS expressions to interrogate results

## 2025-09-04
- Saving and loading of drafts in authoring
- Download of user workspace to single file or zip
- Easier switching between authoring and user views
- URL parameter `?author` to enable switch from config load modal
- Enhancement: Author feedback config disables features that don't make sense for the context
- Fix: Runtime feedback works now
- Fix: stdin feedback works now

## 2025-08-31 - Initial Release
- Runing Python programs locally through WASM Micropython
- Terminal output
- Snapshots of user code in localStorage and IndexedDB
- Loading scenario config from server, URL, local file
- Runtime and edit-time feedback for user code
- Automated tests for user code from author config