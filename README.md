# Bookmark Domain Manager

A Chrome extension that helps you organize and manage your bookmarks by domain, with powerful features for duplicate detection and management.
(c) Marek 'SOCAR' Malecki 2025 https://www.socar.pl
Compiled with CursorAI https://www.cursor.com/

## Features

### Bookmark Organization
- **Domain-based Grouping**: Automatically groups bookmarks by their domain
- **Expandable/Collapsible Groups**: Easily view or hide bookmarks within each domain
- **Statistics**: View total number of domains and bookmarks at a glance
- **Alphabetical Sorting**: Domains are sorted alphabetically for easy navigation

### Bookmark Management
- **Delete Bookmarks**: Remove unwanted bookmarks with optional confirmation
- **Move Bookmarks**: Move bookmarks to different folders with a visual folder tree
- **Create New Folders**: Create new folders directly from the move dialog
- **Export Bookmarks**: Export your bookmarks to a text file for backup or sharing

### Duplicate Management
- **Find Duplicates**: Identify duplicate bookmarks across your collection
- **Remove Duplicates**: Keep one copy and remove all duplicates with a single click
- **Duplicate Statistics**: View the number of duplicates for each URL
- **Sort by Duplication**: Groups are sorted by number of duplicates (most duplicated first)

### User Interface
- **Modern Design**: Clean and intuitive interface
- **Loading Indicators**: Visual feedback during operations
- **Confirmation Dialogs**: Prevent accidental deletions
- **Responsive Layout**: Works well on different screen sizes

## Usage

### Main Bookmark Manager
1. Click on a domain group to expand/collapse its bookmarks
2. Use "Expand All" or "Collapse All" to manage multiple groups
3. For each bookmark:
   - Click "Delete" to remove the bookmark
   - Click "Move" to move the bookmark to a different folder
   - Click the URL to open the bookmark in a new tab

### Duplicate Manager
1. View all duplicate bookmarks grouped by URL
2. For each group:
   - Click "Open" to open the URL in a new tab
   - Click "Remove Duplicates" to keep one copy and remove all duplicates
3. Use "Expand All" or "Collapse All" to manage multiple groups

### Exporting Bookmarks
1. Click the "Export" button
2. A text file will be downloaded containing:
   - All bookmarks grouped by domain
   - Title, URL, location, and date added for each bookmark

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Requirements

- Google Chrome browser
- Chrome extension permissions for bookmarks management

## Privacy

This extension only accesses your bookmarks and does not collect or transmit any data to external servers. All operations are performed locally in your browser.

## Note about Icons

The current extension uses placeholder icons. You can replace them with your own custom icons by replacing the files in the `icons` directory:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels) 