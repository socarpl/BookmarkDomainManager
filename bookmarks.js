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
      
      // Update statistics without reloading
      updateStatisticsFromCurrentView();
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      alert('Failed to delete bookmark. Please try again.');
    }
  }
}

// Function to delete all bookmarks in a domain group
async function deleteDomainGroup(domainGroup, domain) {
  const shouldConfirm = document.getElementById('confirmDelete').checked;
  const bookmarkCount = domainGroup.querySelectorAll('table tr').length - 1; // -1 for header row
  
  if (!shouldConfirm || confirm(`Are you sure you want to delete all ${bookmarkCount} bookmarks from ${domain}?`)) {
    try {
      // Get all bookmark IDs from the domain group
      const bookmarkRows = domainGroup.querySelectorAll('table tr:not(:first-child)');
      const bookmarkIds = Array.from(bookmarkRows).map(row => {
        const deleteButton = row.querySelector('.delete-button');
        return deleteButton.dataset.bookmarkId;
      });
      
      // Delete all bookmarks
      for (const bookmarkId of bookmarkIds) {
        await chrome.bookmarks.remove(bookmarkId);
      }
      
      // Remove the entire domain group
      domainGroup.remove();
      
      // Update statistics without reloading
      updateStatisticsFromCurrentView();
    } catch (error) {
      console.error('Error deleting domain group:', error);
      alert('Failed to delete domain group. Please try again.');
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
      
      // Update statistics without reloading
      updateStatisticsFromCurrentView();
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
    deleteButton.dataset.bookmarkId = bookmark.id;
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
    }, 500);
  }
}

// Function to export bookmarks
function exportBookmarks(bookmarksByDomain) {
  // Create HTML content in Netscape Bookmark File Format
  let htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  // Sort domains alphabetically
  const sortedDomains = Object.entries(bookmarksByDomain).sort(([a], [b]) => a.localeCompare(b));

  // Add bookmarks for each domain
  sortedDomains.forEach(([domain, bookmarks]) => {
    // Add domain as a folder
    htmlContent += `    <DT><H3 ADD_DATE="0" LAST_MODIFIED="0">${domain}</H3>\n`;
    htmlContent += `    <DL><p>\n`;

    // Add bookmarks in this domain
    bookmarks.forEach(bookmark => {
      const addDate = Math.floor(bookmark.dateAdded / 1000); // Convert to Unix timestamp
      htmlContent += `        <DT><A HREF="${bookmark.url}" ADD_DATE="${addDate}" LAST_MODIFIED="${addDate}">${bookmark.title || bookmark.url}</A>\n`;
    });

    htmlContent += `    </DL><p>\n`;
  });

  htmlContent += `</DL><p>`;

  // Create and download the file
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bookmarks.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Function to update statistics
function updateStatistics(bookmarksByDomain) {
  const domainCount = Object.keys(bookmarksByDomain).length;
  const totalBookmarks = Object.values(bookmarksByDomain).reduce((sum, bookmarks) => sum + bookmarks.length, 0);
  
  document.getElementById('domainCount').textContent = domainCount;
  document.getElementById('bookmarkCount').textContent = totalBookmarks;
}

// Function to update statistics from current DOM without reloading
function updateStatisticsFromCurrentView() {
  const container = document.getElementById('bookmarks-container');
  const groupingMethod = document.getElementById('groupingDropdown').value;
  
  if (groupingMethod === 'year') {
    // For year grouping, count year groups and all bookmarks within them
    const yearGroups = container.querySelectorAll('.year-group');
    const domainCount = yearGroups.length;
    let totalBookmarks = 0;
    
    yearGroups.forEach(yearGroup => {
      const domainGroups = yearGroup.querySelectorAll('.domain-group');
      totalBookmarks += domainGroups.length;
    });
    
    document.getElementById('domainCount').textContent = domainCount;
    document.getElementById('bookmarkCount').textContent = totalBookmarks;
  } else {
    // For domain grouping, count domain groups and bookmarks
    const domainGroups = container.querySelectorAll('.domain-group');
    const domainCount = domainGroups.length;
    let totalBookmarks = 0;
    
    domainGroups.forEach(domainGroup => {
      const bookmarkRows = domainGroup.querySelectorAll('table tr:not(:first-child)');
      totalBookmarks += bookmarkRows.length;
    });
    
    document.getElementById('domainCount').textContent = domainCount;
    document.getElementById('bookmarkCount').textContent = totalBookmarks;
  }
}

// Function to display bookmarks
async function displayBookmarks() {
  updateProgress(0, 'Loading bookmarks...');
  const container = document.getElementById('bookmarks-container');
  container.innerHTML = '';
  
  try {
    const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
    const bookmarksByDomain = {};
    
    function processNode(node) {
      if (node.url) {
        bookmarksByDomain[extractDomain(node.url)] = bookmarksByDomain[extractDomain(node.url)] || [];
        bookmarksByDomain[extractDomain(node.url)].push({
          ...node,
          location: getFolderPath(node, tree),
          dateAdded: formatDate(node.dateAdded)
        });
      }
      if (node.children) {
        node.children.forEach(processNode);
      }
    }
    processNode(tree[0]);
    
    updateProgress(50, 'Processing bookmarks...');
    
    // Update statistics
    updateStatistics(bookmarksByDomain);
    
    // Get sorting method and grouping method from dropdowns
    const sortMethod = document.getElementById('sortDropdown').value;
    const groupingMethod = document.getElementById('groupingDropdown').value;
    
    // Hide year navigation by default
    const yearNavigation = document.getElementById('yearNavigation');
    yearNavigation.style.display = 'none';
    
    // Sort domains based on selected method
    let sortedDomains;
    switch (sortMethod) {
      case 'alphabetically':
        sortedDomains = Object.entries(bookmarksByDomain).sort(([a], [b]) => a.localeCompare(b));
        break;
      case 'ascending':
        sortedDomains = Object.entries(bookmarksByDomain).sort(([a, bookmarksA], [b, bookmarksB]) => {
          if (bookmarksA.length !== bookmarksB.length) {
            return bookmarksB.length - bookmarksA.length; // Most bookmarks first
          }
          return a.localeCompare(b); // Alphabetically if same count
        });
        break;
      case 'descending':
        sortedDomains = Object.entries(bookmarksByDomain).sort(([a, bookmarksA], [b, bookmarksB]) => {
          if (bookmarksA.length !== bookmarksB.length) {
            return bookmarksA.length - bookmarksB.length; // Least bookmarks first
          }
          return a.localeCompare(b); // Alphabetically if same count
        });
        break;
      default:
        sortedDomains = Object.entries(bookmarksByDomain).sort(([a], [b]) => a.localeCompare(b));
    }
    
    // Group by year if selected
    if (groupingMethod === 'year') {
      // Show year navigation
      const yearNavigation = document.getElementById('yearNavigation');
      yearNavigation.style.display = 'block';
      
      // Group all bookmarks by year
      const bookmarksByYear = {};
      
      // We need to get the original bookmark data with timestamps
      const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
      const allBookmarks = [];
      
      function collectBookmarks(node) {
        if (node.url) {
          allBookmarks.push(node);
        }
        if (node.children) {
          node.children.forEach(collectBookmarks);
        }
      }
      collectBookmarks(tree[0]);
      
      allBookmarks.forEach(bookmark => {
        const year = new Date(bookmark.dateAdded).getFullYear();
        if (!bookmarksByYear[year]) {
          bookmarksByYear[year] = [];
        }
        bookmarksByYear[year].push({
          ...bookmark,
          location: getFolderPath(bookmark, tree),
          dateAdded: formatDate(bookmark.dateAdded)
        });
      });
      
      // Sort years in descending order (newest first)
      const sortedYears = Object.keys(bookmarksByYear).sort((a, b) => b - a);
      
      // Populate year navigation dropdown
      const yearJumpDropdown = document.getElementById('yearJumpDropdown');
      yearJumpDropdown.innerHTML = '<option value="">Select a year...</option>';
      sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearJumpDropdown.appendChild(option);
      });
      
      // Add year jump functionality
      yearJumpDropdown.addEventListener('change', (e) => {
        const selectedYear = e.target.value;
        if (selectedYear) {
          const yearElement = document.querySelector(`[data-year="${selectedYear}"]`);
          if (yearElement) {
            yearElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
      
      // Create year groups
      sortedYears.forEach((year, yearIndex) => {
        const yearGroup = document.createElement('div');
        yearGroup.className = 'year-group';
        yearGroup.setAttribute('data-year', year); // Add data attribute for navigation
        
        const yearHeader = document.createElement('div');
        yearHeader.className = 'year-header';
        yearHeader.textContent = `Bookmarks from ${year}`;
        yearGroup.appendChild(yearHeader);
        
        // Update progress
        const yearProgress = 50 + ((yearIndex + 1) / sortedYears.length * 30);
        updateProgress(yearProgress, 'Creating year groups...');
        
        // Sort bookmarks within this year by domain
        const yearBookmarks = bookmarksByYear[year];
        const yearBookmarksByDomain = {};
        yearBookmarks.forEach(bookmark => {
          const domain = extractDomain(bookmark.url);
          if (!yearBookmarksByDomain[domain]) {
            yearBookmarksByDomain[domain] = [];
          }
          yearBookmarksByDomain[domain].push(bookmark);
        });
        
        // Sort domains within this year
        const yearDomains = Object.entries(yearBookmarksByDomain);
        let sortedYearDomains;
        switch (sortMethod) {
          case 'alphabetically':
            sortedYearDomains = yearDomains.sort(([a], [b]) => a.localeCompare(b));
            break;
          case 'ascending':
            sortedYearDomains = yearDomains.sort(([a, bookmarksA], [b, bookmarksB]) => {
              if (bookmarksA.length !== bookmarksB.length) {
                return bookmarksB.length - bookmarksA.length;
              }
              return a.localeCompare(b);
            });
            break;
          case 'descending':
            sortedYearDomains = yearDomains.sort(([a, bookmarksA], [b, bookmarksB]) => {
              if (bookmarksA.length !== bookmarksB.length) {
                return bookmarksA.length - bookmarksB.length;
              }
              return a.localeCompare(b);
            });
            break;
          default:
            sortedYearDomains = yearDomains.sort(([a], [b]) => a.localeCompare(b));
        }
        
        // Create domain groups within this year
        sortedYearDomains.forEach(([domain, bookmarks]) => {
          const domainGroup = document.createElement('div');
          domainGroup.className = 'domain-group';
          
          const header = document.createElement('div');
          header.className = 'domain-header';
          header.innerHTML = `
            <div class="domain-header-content">
              <span class="expand-icon">[+]</span>
              <span>${domain} (${bookmarks.length})</span>
            </div>
            <button class="domain-delete-button">Delete All</button>
          `;
          
          const table = createBookmarkTable(bookmarks, domainGroup, domain);
          
          // Add click handler for the header content (not the delete button)
          const headerContent = header.querySelector('.domain-header-content');
          headerContent.addEventListener('click', () => toggleTable(header, table));
          
          // Add click handler for the domain delete button
          const domainDeleteButton = header.querySelector('.domain-delete-button');
          domainDeleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteDomainGroup(domainGroup, domain);
          });
          
          domainGroup.appendChild(header);
          domainGroup.appendChild(table);
          yearGroup.appendChild(domainGroup);
        });
        
        container.appendChild(yearGroup);
      });
      
      updateProgress(100, 'Complete!');
      return; // Exit early for year grouping
    }
    
    const totalDomains = sortedDomains.length;
    
    // Create and append domain groups
    const domainGroups = [];  // Store references to all groups for expand/collapse all
    
    sortedDomains.forEach(([domain, bookmarks], index) => {
      const domainGroup = document.createElement('div');
      domainGroup.className = 'domain-group';
      
      const header = document.createElement('div');
      header.className = 'domain-header';
      header.innerHTML = `
        <div class="domain-header-content">
        <span class="expand-icon">[+]</span>
        <span>${domain} (${bookmarks.length})</span>
        </div>
        <button class="domain-delete-button">Delete All</button>
      `;
      
      const table = createBookmarkTable(bookmarks, domainGroup, domain);
      
      // Add click handler for the header content (not the delete button)
      const headerContent = header.querySelector('.domain-header-content');
      headerContent.addEventListener('click', () => toggleTable(header, table));
      
      // Add click handler for the domain delete button
      const domainDeleteButton = header.querySelector('.domain-delete-button');
      domainDeleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDomainGroup(domainGroup, domain);
      });
      
      domainGroup.appendChild(header);
      domainGroup.appendChild(table);
      container.appendChild(domainGroup);
      
      domainGroups.push({ header, table });
      
      const percent = 50 + ((index + 1) / totalDomains * 50);
      updateProgress(percent, 'Creating bookmark groups...');
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
    
    // Add sorting change handler
    document.getElementById('sortDropdown').addEventListener('change', () => {
      displayBookmarks();
    });
    
    // Add grouping change handler
    document.getElementById('groupingDropdown').addEventListener('change', () => {
      displayBookmarks();
    });
    
    updateProgress(100, 'Complete!');
    
  } catch (error) {
    console.error('Error displaying bookmarks:', error);
    alert('An error occurred while loading bookmarks. Please try refreshing the page.');
    updateProgress(100, 'Error occurred!');
  }
}

// Initialize the display when the page loads
document.addEventListener('DOMContentLoaded', displayBookmarks); 