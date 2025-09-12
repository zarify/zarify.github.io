## 2025-09-12
- Feature: Files can be marked as read-only in authoring
  - Read-only files throw an OSError when user code tries to modify them or delete them
  - **Note:** These are Micropython errors, so maybe not ideal for teaching full fat Python
- Fix: File tabs are cleared when loading or reloading configs

## 2025-09-11
- Change: Removing reliance on localStorage in favour of indexedDB (issues with dual storage mechanisms - hopefully this didn't break things)
- Fix: Tab focus on loading to ensure `main.py` is selected.
- Fix: Files not get created from a default config correctly
- Fix: Tabs not getting deleted correctly when closed

## 2025-09-10
- Enhancement: Check AST matcher expressions for syntax and truthy values
- Enhancement: Test builder modal now has a sticky header like Feedback builder modals

## 2025-09-09
- Fix: Tests now receive the full user workspace, not just `main.py`
- Enhancement: Authoring now allows files to be added to each test
- Enhancement: Tests now allow for exact or partial matching

## 2025-09-07
- Feature: Student verification codes
  - Verification codes for students when all tests are passed
  - List of student IDs and verification codes in authoring with list of codes for current config
- Fix: Changed feedback panel IDs because they got hidden by some ad blockers 🫠

## 2025-09-06
- Fix: Saving drafts in authoring mode won't create multiple copies
- Enhancement: ctrl/cmd-enter to run code when the editor has focus
- Enhancement: Activity indicator on Feedback tab
- Minor UI tweaks to icons and buttons
- Feature: Test grouping added
  - Test running can rely on previous test success
  - Test groups can rely on previous group success
- **Note:** This will break previous test configuratons
- Expanded AST rules:
  - Class analysis
  - Import statements
  - Magic numbers
  - Exception handling
  - Type hints added to variable report
  - Comprehension checks

## 2025-09-05
- Feature: Proof of concept Abstract Syntax Tree feedback and test options
  - AST feedback and test types added
  - Uses JS expressions to interrogate results

## 2025-09-04
- Feature: Saving and loading of drafts in authoring
- Feature: Download of user workspace to single file or zip
- Enhancement: Easier switching between authoring and user views
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