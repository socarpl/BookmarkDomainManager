// Function to format date
function formatDate(dateAdded) {
  return new Date(dateAdded).toLocaleDateString();
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

// Function to toggle table visibility
function toggleTable(header, table, forceState = null) {
  const isExpanded = forceState !== null ? !forceState : table.classList.contains('show');
  table.classList.toggle('show', !isExpanded);
  header.querySelector('.expand-icon').textContent = isExpanded ? '[+]' : '[-]';
}

// Function to open URL in new tab
function openUrl(url, e) {
  e.stopPropagation(); // Prevent triggering the toggle
  chrome.tabs.create({ url: url });
}

// Function to delete bookmark
async function deleteBookmark(bookmarkId, row, url, urlGroup) {
  try {
    await chrome.bookmarks.remove(bookmarkId);
    row.remove();
    
    // Update bookmark count in URL header
    const remainingRows = urlGroup.querySelectorAll('table tr').length - 1; // -1 for header row
    if (remainingRows <= 1) { // If only 1 or 0 bookmarks left, it's no longer a duplicate
      urlGroup.remove();
      
      // Check if there are no more duplicate groups
      const container = document.getElementById('duplicates-container');
      if (!container.querySelector('.url-group')) {
        container.innerHTML = '<div class="no-duplicates">No duplicate bookmarks found.</div>';
      }
    } else {
      const countSpan = urlGroup.querySelector('.url-header span:last-child');
      countSpan.textContent = `(${remainingRows} duplicates)`;
    }
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    alert('Failed to delete bookmark. Please try again.');
  }
}

// Function to create bookmark table
function createBookmarkTable(bookmarks, urlGroup, url) {
  const table = document.createElement('table');
  table.className = 'bookmark-table';
  
  const header = document.createElement('tr');
  header.innerHTML = `
    <th>Title</th>
    <th>Location</th>
    <th>Date Added</th>
    <th>Actions</th>
  `;
  table.appendChild(header);
  
  bookmarks.forEach(bookmark => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${bookmark.title || bookmark.url}</td>
      <td>${bookmark.location}</td>
      <td>${bookmark.dateAdded}</td>
      <td>
        <div class="action-buttons">
          <button class="delete-button">Delete</button>
        </div>
      </td>
    `;
    
    // Add delete functionality
    const deleteButton = row.querySelector('.delete-button');
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBookmark(bookmark.id, row, url, urlGroup);
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

// Main function to find and display duplicate bookmarks
function displayDuplicates() {
  updateProgress(0, 'Finding duplicates...');

  chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
    try {
      // Flatten the bookmark tree
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

      // Group bookmarks by URL
      const bookmarksByUrl = {};
      let processed = 0;
      const total = allBookmarks.length;
      
      for (const bookmark of allBookmarks) {
        if (bookmark.url) {
          if (!bookmarksByUrl[bookmark.url]) {
            bookmarksByUrl[bookmark.url] = [];
          }
          bookmarksByUrl[bookmark.url].push({
            ...bookmark,
            location: getFolderPath(bookmark, bookmarkTreeNodes),
            dateAdded: formatDate(bookmark.dateAdded)
          });
        }
        
        processed++;
        const percent = 20 + (processed / total * 50);
        updateProgress(percent, 'Finding duplicates...');
      }
      
      updateProgress(70, 'Creating duplicate groups...');

      // Filter out URLs with no duplicates and create groups
      const container = document.getElementById('duplicates-container');
      const urlGroups = [];  // Store references for expand/collapse all

      const duplicateUrls = Object.entries(bookmarksByUrl)
        .filter(([_, bookmarks]) => bookmarks.length > 1)
        .sort(([a], [b]) => a.localeCompare(b));

      if (duplicateUrls.length === 0) {
        container.innerHTML = '<div class="no-duplicates">No duplicate bookmarks found.</div>';
        updateProgress(100, 'Complete!');
        return;
      }

      const totalUrls = duplicateUrls.length;
      
      duplicateUrls.forEach(([url, bookmarks], index) => {
        const urlGroup = document.createElement('div');
        urlGroup.className = 'url-group';
        
        const header = document.createElement('div');
        header.className = 'url-header';
        
        // Create header content with Open button
        const headerContent = document.createElement('div');
        headerContent.className = 'header-content';
        headerContent.innerHTML = `
          <span class="expand-icon">[+]</span>
          <span class="url-text">${url}</span>
          <span class="duplicate-count">(${bookmarks.length} duplicates)</span>
        `;
        
        // Create Open button
        const openButton = document.createElement('button');
        openButton.className = 'open-button';
        openButton.textContent = 'Open';
        openButton.addEventListener('click', (e) => openUrl(url, e));
        
        // Add header content and button to header
        header.appendChild(headerContent);
        header.appendChild(openButton);
        
        const table = createBookmarkTable(bookmarks, urlGroup, url);
        
        // Add click event to header content only
        headerContent.addEventListener('click', () => toggleTable(header, table));
        
        urlGroup.appendChild(header);
        urlGroup.appendChild(table);
        container.appendChild(urlGroup);

        urlGroups.push({ header, table });
        
        const percent = 70 + ((index + 1) / totalUrls * 30);
        updateProgress(percent, 'Finalizing display...');
      });

      // Add expand/collapse all functionality
      document.getElementById('expandAll').addEventListener('click', () => {
        urlGroups.forEach(group => toggleTable(group.header, group.table, true));
      });

      document.getElementById('collapseAll').addEventListener('click', () => {
        urlGroups.forEach(group => toggleTable(group.header, group.table, false));
      });
      
      updateProgress(100, 'Complete!');
      
    } catch (error) {
      console.error('Error finding duplicates:', error);
      alert('An error occurred while finding duplicates. Please try refreshing the page.');
      updateProgress(100, 'Error occurred!');
    }
  });
}

// Initialize the display when the page loads
document.addEventListener('DOMContentLoaded', displayDuplicates); 