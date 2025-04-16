// Function to extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'unknown';
  }
}

// Function to get folder path
function getFolderPath(bookmark, bookmarkTree) {
  const path = [];
  let current = bookmark;
  
  const findParentInTree = (parentId, tree) => {
    for (const node of tree) {
      if (node.id === parentId) return node;
      if (node.children) {
        const found = findParentInTree(parentId, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  while (current && current.parentId) {
    const parent = findParentInTree(current.parentId, bookmarkTree);
    if (!parent) break;
    
    if (parent.title) {
      path.unshift(parent.title);
    }
    current = parent;
  }
  
  return path.length > 0 ? path.join('\\') : 'Root';
}

// Function to format date
function formatDate(dateAdded) {
  return new Date(dateAdded).toLocaleDateString();
}

// Function to toggle table visibility
function toggleTable(header, table, forceState = null) {
  const isExpanded = forceState !== null ? !forceState : table.classList.contains('show');
  table.classList.toggle('show', !isExpanded);
  header.querySelector('.expand-icon').textContent = isExpanded ? '[+]' : '[-]';
}

// Function to delete bookmark
async function deleteBookmark(bookmarkId, row, domain, domainGroup) {
  const shouldConfirm = document.getElementById('confirmDelete').checked;
  
  if (!shouldConfirm || confirm('Are you sure you want to delete this bookmark?')) {
    try {
      await chrome.bookmarks.remove(bookmarkId);
      row.remove();
      
      // Update bookmark count in domain header
      const remainingRows = domainGroup.querySelectorAll('table tr').length - 1; // -1 for header row
      if (remainingRows <= 0) {
        domainGroup.remove();
      } else {
        const countSpan = domainGroup.querySelector('.domain-header span:last-child');
        countSpan.textContent = `${domain} (${remainingRows})`;
      }
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      alert('Failed to delete bookmark. Please try again.');
    }
  }
}

// Function to build folder tree
function buildFolderTree(node, level = 0) {
  if (!node) return '';
  
  let html = '';
  const padding = '&nbsp;'.repeat(level * 4);
  
  if (!node.url) {  // Only folders, not bookmarks
    html += `<div class="folder-item" data-id="${node.id}">
      ${padding}<span class="folder-icon">&#128193;</span>${node.title || 'Root'}
    </div>`;
    
    if (node.children) {
      node.children.forEach(child => {
        html += buildFolderTree(child, level + 1);
      });
    }
  }
  
  return html;
}

// Function to show move modal
function showMoveModal(bookmarkId, row, domain, domainGroup) {
  const modal = document.getElementById('moveModal');
  const folderTree = document.getElementById('folderTree');
  const closeBtn = document.querySelector('.close-modal');
  const cancelBtn = document.getElementById('cancelMove');
  const confirmBtn = document.getElementById('confirmMove');
  const newFolderBtn = document.getElementById('newFolderBtn');
  const newFolderInput = document.getElementById('newFolderInput');
  const createFolderBtn = document.getElementById('createFolderBtn');
  const cancelFolderBtn = document.getElementById('cancelFolderBtn');
  const folderNameInput = newFolderInput.querySelector('input');
  let selectedFolderId = null;

  // Function to refresh folder tree
  const refreshFolderTree = async () => {
    const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
    folderTree.innerHTML = buildFolderTree(tree[0]);
    
    // Reattach click handlers
    const folderItems = folderTree.querySelectorAll('.folder-item');
    folderItems.forEach(item => {
      item.addEventListener('click', () => {
        folderItems.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedFolderId = item.dataset.id;
      });
    });
  };

  // Get all folders and build the tree
  refreshFolderTree();

  // Show modal
  modal.style.display = 'block';

  // New Folder button handler
  newFolderBtn.onclick = () => {
    newFolderInput.classList.add('show');
    folderNameInput.focus();
  };

  // Cancel new folder handler
  cancelFolderBtn.onclick = () => {
    newFolderInput.classList.remove('show');
    folderNameInput.value = '';
  };

  // Create folder handler
  createFolderBtn.onclick = async () => {
    const folderName = folderNameInput.value.trim();
    if (!folderName) {
      alert('Please enter a folder name');
      return;
    }

    try {
      // Create in the selected folder or in root if none selected
      const parentId = selectedFolderId || '0';
      await chrome.bookmarks.create({
        parentId: parentId,
        title: folderName
      });

      // Reset new folder input
      newFolderInput.classList.remove('show');
      folderNameInput.value = '';

      // Refresh the folder tree
      await refreshFolderTree();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  // Close modal handlers
  const closeModal = () => {
    modal.style.display = 'none';
    selectedFolderId = null;
    newFolderInput.classList.remove('show');
    folderNameInput.value = '';
  };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  
  // Handle click outside modal
  modal.onclick = (event) => {
    if (event.target === modal) {
      closeModal();
    }
  };

  // Handle move confirmation
  confirmBtn.onclick = async () => {
    if (!selectedFolderId) {
      alert('Please select a destination folder');
      return;
    }

    try {
      await chrome.bookmarks.move(bookmarkId, { parentId: selectedFolderId });
      
      // Get updated bookmark info to show new location
      const [movedBookmark] = await chrome.bookmarks.get(bookmarkId);
      const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
      const newLocation = getFolderPath(movedBookmark, tree);
      
      // Update the location cell in the row
      const locationCell = row.querySelector('td:nth-child(2)');
      locationCell.textContent = newLocation;
      
      closeModal();
    } catch (error) {
      console.error('Error moving bookmark:', error);
      alert('Failed to move bookmark. Please try again.');
    }
  };

  // Handle Enter key in folder name input
  folderNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      createFolderBtn.click();
    }
  });
}

// Function to create bookmark table
function createBookmarkTable(bookmarks, domainGroup, domain) {
  const table = document.createElement('table');
  table.className = 'bookmark-table';
  
  const header = document.createElement('tr');
  header.innerHTML = `
    <th>URL</th>
    <th>Location</th>
    <th>Date Added</th>
    <th>Actions</th>
  `;
  table.appendChild(header);
  
  bookmarks.forEach(bookmark => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><a href="${bookmark.url}" target="_blank">${bookmark.title || bookmark.url}</a></td>
      <td>${bookmark.location}</td>
      <td>${bookmark.dateAdded}</td>
      <td>
        <div class="action-buttons">
          <button class="move-button">Move</button>
          <button class="delete-button">Delete</button>
        </div>
      </td>
    `;
    
    // Add move functionality
    const moveButton = row.querySelector('.move-button');
    moveButton.addEventListener('click', (e) => {
      e.stopPropagation();
      showMoveModal(bookmark.id, row, domain, domainGroup);
    });
    
    // Add delete functionality
    const deleteButton = row.querySelector('.delete-button');
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBookmark(bookmark.id, row, domain, domainGroup);
    });
    
    table.appendChild(row);
  });
  
  return table;
}

// Function to update progress
function updateProgress(percent, message) {
  const progressText = document.getElementById('progressText');
  const loadingContainer = document.getElementById('loadingContainer');
  const loadingText = document.querySelector('.loading-text');
  
  loadingText.textContent = message;
  progressText.textContent = `${Math.round(percent)}% complete`;
  
  if (percent === 0) {
    loadingContainer.style.display = 'flex';
  } else if (percent === 100) {
    setTimeout(() => {
      loadingContainer.style.display = 'none';
    }, 500); // Keep visible briefly to show completion
  }
}

// Function to export bookmarks
function exportBookmarks(bookmarksByDomain) {
  let content = 'Bookmarks by Domain\n\n';
  
  Object.entries(bookmarksByDomain)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([domain, bookmarks]) => {
      content += `${domain} (${bookmarks.length} bookmarks)\n`;
      content += '='.repeat(50) + '\n\n';
      
      bookmarks.forEach(bookmark => {
        content += `Title: ${bookmark.title || bookmark.url}\n`;
        content += `URL: ${bookmark.url}\n`;
        content += `Location: ${bookmark.location}\n`;
        content += `Added: ${bookmark.dateAdded}\n`;
        content += '-'.repeat(30) + '\n\n';
      });
      
      content += '\n';
    });
    
  // Create blob and download
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookmarks_export_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Main function to organize and display bookmarks
function displayBookmarks() {
  updateProgress(0, 'Loading bookmarks...');

  chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
    try {
      // Flatten the bookmark tree while preserving hierarchy information
      const allBookmarks = [];
      function processNode(node) {
        if (node.url) {
          allBookmarks.push(node);
        }
        if (node.children) {
          node.children.forEach(processNode);
        }
      }
      bookmarkTreeNodes.forEach(processNode);
      
      updateProgress(20, 'Processing bookmarks...');

      // Group bookmarks by domain
      const bookmarksByDomain = {};
      let processed = 0;
      const total = allBookmarks.length;
      
      for (const bookmark of allBookmarks) {
        if (bookmark.url) {
          const domain = extractDomain(bookmark.url);
          if (!bookmarksByDomain[domain]) {
            bookmarksByDomain[domain] = [];
          }
          bookmarksByDomain[domain].push({
            ...bookmark,
            location: getFolderPath(bookmark, bookmarkTreeNodes),
            dateAdded: formatDate(bookmark.dateAdded)
          });
        }
        
        processed++;
        // Update progress from 20% to 70%
        const percent = 20 + (processed / total * 50);
        updateProgress(percent, 'Organizing bookmarks...');
      }
      
      updateProgress(70, 'Creating bookmark groups...');

      // Create and append domain groups
      const container = document.getElementById('bookmarks-container');
      const domainGroups = [];  // Store references to all groups for expand/collapse all

      const sortedDomains = Object.entries(bookmarksByDomain).sort(([a], [b]) => a.localeCompare(b));
      const totalDomains = sortedDomains.length;
      
      sortedDomains.forEach(([domain, bookmarks], index) => {
        const domainGroup = document.createElement('div');
        domainGroup.className = 'domain-group';
        
        const header = document.createElement('div');
        header.className = 'domain-header';
        header.innerHTML = `
          <span class="expand-icon">[+]</span>
          <span>${domain} (${bookmarks.length})</span>
        `;
        
        const table = createBookmarkTable(bookmarks, domainGroup, domain);
        
        header.addEventListener('click', () => toggleTable(header, table));
        
        domainGroup.appendChild(header);
        domainGroup.appendChild(table);
        container.appendChild(domainGroup);

        // Store reference to header and table for expand/collapse all
        domainGroups.push({ header, table });
        
        // Update progress from 70% to 100%
        const percent = 70 + ((index + 1) / totalDomains * 30);
        updateProgress(percent, 'Finalizing display...');
      });

      // Add expand/collapse all functionality
      document.getElementById('expandAll').addEventListener('click', () => {
        domainGroups.forEach(group => toggleTable(group.header, group.table, true));
      });

      document.getElementById('collapseAll').addEventListener('click', () => {
        domainGroups.forEach(group => toggleTable(group.header, group.table, false));
      });

      // Add export functionality
      document.getElementById('exportBtn').addEventListener('click', () => {
        exportBookmarks(bookmarksByDomain);
      });
      
      updateProgress(100, 'Complete!');
      
    } catch (error) {
      console.error('Error processing bookmarks:', error);
      alert('An error occurred while loading bookmarks. Please try refreshing the page.');
      updateProgress(100, 'Error occurred!');
    }
  });
}

// Initialize the display when the page loads
document.addEventListener('DOMContentLoaded', displayBookmarks); 