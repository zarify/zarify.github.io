// Tab overflow management component
// Handles smart tab display with main.py always visible + active file + overflow dropdown
import { $ } from './utils.js'
import { MAIN_FILE } from './vfs-client.js'
import { showInputModal } from './modals.js'

export class TabOverflowManager {
    // Supports either (containerId, options) or (containerId, tabManager, options)
    constructor(containerId, tabManagerOrOptions = {}, maybeOptions = {}) {
        this.containerId = containerId

        // Detect if second argument is a tabManager (has list/getActive)
        if (tabManagerOrOptions && typeof tabManagerOrOptions.list === 'function' && typeof tabManagerOrOptions.getActive === 'function') {
            this.tabManager = tabManagerOrOptions
            const options = maybeOptions || {}
            this.onTabSelect = options.onTabSelect || (() => { })
            this.onTabClose = options.onTabClose || (() => { })
            this.onTabRename = options.onTabRename || (() => { })
            this.isFileReadOnly = options.isFileReadOnly || (() => false)
            this.showInputModal = options.showInputModal || null
            this.alwaysVisible = options.alwaysVisible || [MAIN_FILE]
        } else {
            const options = tabManagerOrOptions || {}
            this.tabManager = null
            this.onTabSelect = options.onTabSelect || (() => { })
            this.onTabClose = options.onTabClose || (() => { })
            this.onTabRename = options.onTabRename || (() => { })
            this.isFileReadOnly = options.isFileReadOnly || (() => false)
            this.showInputModal = options.showInputModal || null
            this.alwaysVisible = options.alwaysVisible || [MAIN_FILE]
        }

        this.dropdownOpen = false
        this.lastEditedFile = null
    }

    init() {
        // Set up dropdown modal event handlers if modal exists
        this.setupModalHandlers()
    }

    setupModalHandlers() {
        const modal = $('file-dropdown-modal')
        if (!modal) return

        // Set up event listeners
        const closeBtn = $('file-dropdown-close')
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeDropdown())
        }

        const searchInput = $('file-search-input')
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterFiles(e.target.value))
        }

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeDropdown()
        })

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dropdownOpen) {
                this.closeDropdown()
            }
        })
    }

    createDropdownModal() {
        const modal = document.createElement('div')
        modal.id = 'file-dropdown-modal'
        modal.className = 'modal'
        modal.setAttribute('role', 'dialog')
        modal.setAttribute('aria-hidden', 'true')
        modal.setAttribute('aria-labelledby', 'file-dropdown-title')

        modal.innerHTML = `
            <div class="modal-content file-dropdown-content">
                <div class="modal-header">
                    <h3 id="file-dropdown-title">Files</h3>
                    <button id="file-dropdown-close" class="btn modal-close-btn">×</button>
                </div>
                <div class="modal-body">
                    <div id="file-dropdown-search" style="margin-bottom: 12px;">
                        <input id="file-search-input" type="text" placeholder="Search files..." 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div id="file-dropdown-list" class="file-dropdown-list"></div>
                </div>
            </div>
        `

        document.body.appendChild(modal)

        // Set up event handlers
        this.setupModalHandlers()
        return modal
    }

    render(openTabs, activeTab) {
        const container = $(this.containerId)
        if (!container) return

        // If no explicit openTabs provided, try to read from attached tabManager
        const files = Array.isArray(openTabs) ? openTabs : (this.tabManager ? (this.tabManager.list ? this.tabManager.list() : []) : [])
        const active = activeTab || (this.tabManager && this.tabManager.getActive ? this.tabManager.getActive() : null)

        // Track the last edited file (excluding main.py)
        if (active && active !== MAIN_FILE) {
            this.lastEditedFile = active
        }

        // Always show main.py, active file, and last edited file (if different)
        const alwaysVisible = [MAIN_FILE]

        // Add active file if different from main.py
        if (active && active !== MAIN_FILE && !alwaysVisible.includes(active)) {
            alwaysVisible.push(active)
        }

        // Add last edited file if it exists in the current file list
        // If lastEditedFile doesn't exist (e.g., after rename), don't add it
        if (this.lastEditedFile &&
            this.lastEditedFile !== MAIN_FILE &&
            this.lastEditedFile !== active &&
            !alwaysVisible.includes(this.lastEditedFile) &&
            files.includes(this.lastEditedFile)) {
            alwaysVisible.push(this.lastEditedFile)
        }

        // Remaining files that can overflow
        const overflowFiles = files.filter(f => !alwaysVisible.includes(f))

        container.innerHTML = ''

        // Render always-visible tabs
        alwaysVisible.forEach(file => {
            if (files.includes(file)) {
                this.renderTab(container, file, active === file)
            }
        })

        // Render overflow dropdown if needed
        if (overflowFiles.length > 0) {
            this.renderOverflowButton(container, overflowFiles, active)
        }
    }

    // Return the visible files that would be rendered for the current state.
    getVisibleFiles(openTabs, activeTab) {
        const files = Array.isArray(openTabs) ? openTabs : (this.tabManager ? (this.tabManager.list ? this.tabManager.list() : []) : [])
        const active = activeTab || (this.tabManager && this.tabManager.getActive ? this.tabManager.getActive() : null)

        const alwaysVisible = [MAIN_FILE]
        if (active && active !== MAIN_FILE && !alwaysVisible.includes(active)) alwaysVisible.push(active)
        if (this.lastEditedFile && this.lastEditedFile !== MAIN_FILE && this.lastEditedFile !== active && !alwaysVisible.includes(this.lastEditedFile) && files.includes(this.lastEditedFile)) {
            alwaysVisible.push(this.lastEditedFile)
        }

        // Visible files are alwaysVisible that exist in files, plus an overflow indicator if others exist
        const visible = []
        alwaysVisible.forEach(f => { if (files.includes(f)) visible.push(f) })
        return visible
    }

    renderTab(container, filePath, isActive) {
        const tab = document.createElement('div')
        const isReadOnly = this.isFileReadOnly(filePath)

        tab.className = 'tab' + (isActive ? ' active' : '') + (isReadOnly ? ' readonly' : '')
        tab.setAttribute('role', 'tab')
        tab.setAttribute('data-file-path', filePath)

        const displayName = this.getDisplayName(filePath)
        const fileIcon = this.getFileIcon(filePath)

        tab.innerHTML = `
            <span class="file-icon" aria-hidden="true">${fileIcon}</span>
            <span class="tab-label">${displayName}</span>
        `

        // Add rename functionality for active tab
        if (isActive && !isReadOnly && filePath !== MAIN_FILE) {
            const renameBtn = document.createElement('button')
            renameBtn.className = 'tab-action-btn rename-btn'
            renameBtn.title = 'Rename file'
            renameBtn.innerHTML = '✏️'
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                this.handleRename(filePath)
            })
            tab.appendChild(renameBtn)
        }

        // Add close button (except for main.py and read-only files)
        if (filePath !== MAIN_FILE && !isReadOnly) {
            const closeBtn = document.createElement('button')
            closeBtn.className = 'tab-action-btn close'
            closeBtn.title = 'Close'
            closeBtn.innerHTML = '×'
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                this.onTabClose(filePath)
            })
            tab.appendChild(closeBtn)
        }

        tab.addEventListener('click', () => this.onTabSelect(filePath))
        container.appendChild(tab)
    }

    renderOverflowButton(container, overflowFiles, activeTab) {
        const btn = document.createElement('button')
        btn.className = 'tab overflow-btn'
        btn.title = 'More files'

        const count = overflowFiles.length
        const activeInOverflow = overflowFiles.includes(activeTab)

        btn.innerHTML = `
            <span class="overflow-icon">📁</span>
            <span class="overflow-text">${count} more${activeInOverflow ? ' (active)' : ''}</span>
        `

        btn.addEventListener('click', () => this.openDropdown(overflowFiles, activeTab))
        container.appendChild(btn)
    }

    openDropdown(overflowFiles, activeTab) {
        this.dropdownOpen = true
        const modal = $('file-dropdown-modal')

        // If modal doesn't exist (e.g. on author page before DOM modal is present), create it
        let _modal = modal
        if (!_modal) {
            _modal = this.createDropdownModal()
        }

        // Clear search
        const searchInput = $('file-search-input')
        if (searchInput) searchInput.value = ''

        // Render file list
        this.renderFileList(overflowFiles, activeTab)

        // Show modal with flex centering (not block)
        if (_modal) {
            _modal.setAttribute('aria-hidden', 'false')
            _modal.style.display = 'flex'
        }

        // Focus search input
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100)
        }
    }

    closeDropdown() {
        this.dropdownOpen = false
        const modal = $('file-dropdown-modal')
        if (!modal) return
        modal.setAttribute('aria-hidden', 'true')
        modal.style.display = 'none'
    }

    renderFileList(files, activeTab) {
        const list = $('file-dropdown-list')
        if (!list) return

        list.innerHTML = ''

        files.forEach(file => {
            const item = document.createElement('div')
            item.className = 'file-dropdown-item' + (file === activeTab ? ' active' : '')

            const fileIcon = this.getFileIcon(file)
            const displayName = this.getDisplayName(file)
            const dirHint = this.getDirectoryHint(file)
            const isReadOnly = this.isFileReadOnly(file)

            item.innerHTML = `
                <div class="file-item-main">
                    <span class="file-icon" aria-hidden="true">${fileIcon}</span>
                    <div class="file-info">
                        <div class="file-name">${displayName}${isReadOnly ? ' <em>(read-only)</em>' : ''}</div>
                        ${dirHint ? `<div class="file-path">${dirHint}</div>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    ${!isReadOnly ? `<button class="file-action-btn close-btn" title="Close file">×</button>` : ''}
                </div>
            `

            // Click to select file
            item.querySelector('.file-item-main').addEventListener('click', () => {
                this.onTabSelect(file)
                this.closeDropdown()
            })

            // Close button
            const closeBtn = item.querySelector('.close-btn')
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation()
                    this.onTabClose(file)
                })
            }

            list.appendChild(item)
        })
    }

    filterFiles(query) {
        const items = document.querySelectorAll('.file-dropdown-item')
        const searchTerm = query.toLowerCase()

        items.forEach(item => {
            const fileName = item.querySelector('.file-name').textContent.toLowerCase()
            const filePath = item.querySelector('.file-path')?.textContent.toLowerCase() || ''

            const matches = fileName.includes(searchTerm) || filePath.includes(searchTerm)
            item.style.display = matches ? 'block' : 'none'
        })
    }

    async handleRename(filePath) {
        const currentName = filePath.split('/').pop()
        const directory = filePath.substring(0, filePath.lastIndexOf('/'))

        // Title is sufficient in this context; avoid redundant descriptive text
        const inputFn = this.showInputModal || showInputModal
        const newName = await inputFn('Rename File', '', currentName)

        if (newName && newName !== currentName) {
            const newPath = directory + '/' + newName

            const renameSuccess = await this.onTabRename(filePath, newPath)

            // The onTabRename callback (renameFile) will handle updating lastEditedFile
            // We don't need to do it here anymore since it's done in renameFile
        }
    }

    getDisplayName(filePath) {
        return filePath.startsWith('/') ? filePath.slice(1) : filePath
    }

    getDirectoryHint(filePath) {
        const parts = filePath.split('/')
        if (parts.length <= 2) return null // No directory or just one level

        return parts.slice(0, -1).join('/') // Everything except filename
    }

    getFileIcon(filePath) {
        const ext = filePath.split('.').pop().toLowerCase()

        const iconMap = {
            'py': '🐍',
            'js': '📜',
            'json': '📋',
            'md': '📄',
            'txt': '📝',
            'csv': '📊',
            'html': '🌐',
            'css': '🎨',
            'xml': '📰',
            'yml': '⚙️',
            'yaml': '⚙️'
        }

        return iconMap[ext] || '📄'
    }
}

// CSS styles for the overflow system
export const tabOverflowStyles = `
.overflow-btn {
    background: #f8f9fa;
    border: 1px dashed #ccc;
    color: #666;
    font-size: 0.9em;
}

.overflow-btn:hover {
    background: #e9ecef;
    border-color: #999;
}

.overflow-icon {
    margin-right: 4px;
}

.tab-action-btn {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0 4px;
    margin-left: 4px;
    opacity: 0.7;
    font-size: 0.9em;
}

.tab-action-btn:hover {
    opacity: 1;
}

.rename-btn {
    font-size: 0.8em;
}

.file-icon {
    margin-right: 6px;
    font-size: 0.9em;
}

.file-dropdown-content {
    width: 480px;
    max-height: 60vh;
}

.file-dropdown-list {
    max-height: 400px;
    overflow-y: auto;
}

.file-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
}

.file-dropdown-item:hover {
    background: #f5f5f5;
}

.file-dropdown-item.active {
    background: #e3f2fd;
}

.file-item-main {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0; /* Allow truncation */
}

.file-info {
    min-width: 0;
    flex: 1;
}

.file-name {
    font-weight: 500;
    margin-bottom: 2px;
}

.file-path {
    font-size: 0.85em;
    color: #666;
    font-family: monospace;
}

.file-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
}

.file-dropdown-item:hover .file-actions {
    opacity: 1;
}

.file-action-btn {
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #999;
}

.file-action-btn:hover {
    color: #d32f2f;
}

@media (max-width: 600px) {
    .file-dropdown-content {
        width: 90vw;
        max-width: none;
    }
    
    .file-path {
        display: none; /* Hide paths on small screens */
    }
}
`