# Document Editor Testing Guide

## Complete Workflow Test

### 1. Start the Server
```bash
npm start
# or
node server.js
```

### 2. Access the Dashboard
1. Open browser: http://localhost:8080
2. Login with credentials: `admin` / `ScribeExport25.`
3. You should see the dashboard with converted documents

### 3. Test Editor Access
1. Look for JSON files with "✏️ Edit" buttons
2. Click on an Edit button for any converted document
3. You should be redirected to: `/editor?id=filename.json`

### 4. Editor Interface Features to Test

#### Document Information Section
- [x] Document title editing
- [x] Document description editing

#### Step Management
- [x] Click on steps in sidebar to edit them
- [x] Add new step with "Add New Step" button
- [x] Delete steps with "Delete Step" button
- [x] Duplicate steps with "Duplicate Step" button
- [x] Drag and drop steps to reorder

#### Rich Text Editing
- [x] Bold, italic, underline formatting
- [x] Bullet lists and numbered lists
- [x] Insert links
- [x] Clear formatting

#### Image Management
- [x] Drag and drop images onto upload area
- [x] Click to browse and select images
- [x] Remove images with X button
- [x] View image previews

#### Auto-save and Versioning
- [x] Changes auto-save every 30 seconds
- [x] Manual "Save Draft" button
- [x] "Publish Changes" regenerates HTML
- [x] Backup versions created automatically

#### Navigation and Controls
- [x] Undo/Redo buttons work
- [x] Live preview updates in real-time
- [x] Cancel returns to dashboard
- [x] Preview opens in new window

### 5. Expected URLs
- Dashboard: `http://localhost:8080/`
- Editor: `http://localhost:8080/editor?id=document.json`
- API endpoints working: `/api/documents/:id/edit`

### 6. File Structure Created
```
scribe-exporter/
├── public/
│   └── editor.html          # ✅ Editor interface
├── uploads/                 # ✅ Image uploads directory
├── backups/                 # ✅ Document backups directory
└── server.js               # ✅ Updated with editor APIs
```

### 7. Troubleshooting

#### "Cannot GET /editor"
- Ensure you're logged in first
- Check server is running on port 8080
- Verify authentication session

#### Images not uploading
- Check uploads directory exists and is writable
- Verify multer configuration in server.js

#### Auto-save not working
- Check browser console for JavaScript errors
- Verify API endpoints are responding

### 8. Features Summary
✅ **Rich Document Editor** - Complete editing interface
✅ **Drag-and-drop Reordering** - Step organization
✅ **Image Upload System** - File management with previews
✅ **Auto-save & Versioning** - Data protection
✅ **Rich Text Editor** - Formatting tools
✅ **Dashboard Integration** - Edit buttons added
✅ **Live Preview** - Real-time updates
✅ **Undo/Redo** - Change history
✅ **Professional Output** - Maintains quality standards

The document editor is fully functional and ready for use!