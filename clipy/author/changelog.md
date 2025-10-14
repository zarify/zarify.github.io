## 2025-10-14
- Fix: Feedback rules get recalculated on problem change
- Fix: Config state is cleaned on problem change
- Fix: AST docstring test works now
- Change: Removed in-memory mirror of workspace. Just using IDB now.
- Feature: Feedback and tests can use markdown now
- Feature: Errors from config loads now displayed to user

## 2025-10-09
- Feature: Success indicators for lists of problems
  - When a problem's test suite is passed a check will appear in the config list drop-down
  - When all problems with tests in a list are passed a check will appear in the config list title in the top-left
  - Problems with no tests are indicated by a `-`
  - Problems with unpassed tests are indicated by a checkbox
  - Problems with passed tests are indicated by a tick

## 2025-10-07
- Feature: Persistent playground config

## 2025-10-06
- Fix: replaced record-replay with lower level micropython implementation instead of higher level python instrumentation
  - Broke almost everything about record-replay and had to fix it again 🤪

## 2025-10-02
- Fix: record/replay instrumentation and multi-file workspaces
- Feature: pre and post files (optional) can be added to tests to modify what is being tested

## 2025-09-30
- Feature: record/replay after a program run
  - Step through code execution and show variable state at the line that was executed

## 2025-09-29
- Fix: Runtime reset between runs is now more robust
- Enhancement: First test, first test group, and first-test-in-test-group run when it makes sense to do so, even if they are not marked to always run
- Enhancement: File tab manager improved
  - Added ability to rename files
  - Additional files are hidden in an overflow button
  - `main.py` is always shown
  - Last active file is always shown

## 2025-09-22
- Fix: Page header now correctly shows config list name with config name
- Feature: Verification tab in authoring can now load lists of configs

## 2025-09-19
- Enhancement: Added `function_calls` AST rule, covering things like builtin function calls
- Feature: Added dependencies for feedback rules
  - Other feedback rule must match
  - Other feedback rule must not match
- Feature: Success indicators for problem configs
  - Snapshot history shows when problem was last solved
  - Indicator in page header to show solve state
  - Drop-down menu in config lists show solve state
- Fix: The reset config button should now... reset the config

## 2025-09-18
- Enhancement: Messages are now optional for feedback items, improved styling
- Fix: `stderr` feedback rules work now

## 2025-09-17
- Feature: Loading of a config list file so a problem sequence can be navigated through by the user.
  - Loaded configs show their name in the title area of the page
  - Loaded config lists show the config list name in the title area of the page
  - Loading a config list file presents individual problems in a drop-down in the top-right of the page
- Fix: Snapshot storage and clearing had a busted linkage between browser storage and the in-memory storage. Hopefully fixed it.
- Fix: The Run tests button is now visibly disabled when there are no tests

## 2025-09-15
- Added validation to authoring for config ID and config version
- Added [admonitions extension](https://github.com/xiefucai/marked-admonition-extension) for Markdown rendering

## 2025-09-13
- Fix: Loading a config now correctly stores the current config
- Fix: Reset of the config correctly loads the current config

## 2025-09-12
- Feature: Files can be marked as read-only in authoring
  - Read-only files throw an OSError when user code tries to modify them or delete them
  - **Note:** These are Micropython errors, so maybe not ideal for teaching full fat Python
- Fix: File tabs are cleared when loading or reloading configs

## 2025-09-11
- Change: Removing reliance on localStorage in favour of indexedDB (issues with dual storage mechanisms - hopefully this didn't break things - Future me: hahaha it broke things!)
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