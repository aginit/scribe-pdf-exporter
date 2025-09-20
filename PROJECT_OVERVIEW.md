# Scribe PDF Exporter - Project Overview

## Executive Summary

Scribe PDF Exporter is a comprehensive Node.js-based document conversion and editing system designed to transform Scribe PDF exports into clean, structured HTML and JSON formats. The project includes a complete web application with authentication, a dashboard interface, a professional document editor, multiple PDF conversion strategies, and advanced document management capabilities optimized for extracting and editing high-quality content and images from Scribe documentation.

## Core Functionality

### 1. PDF Conversion Pipeline
- **Primary Purpose**: Convert Scribe-generated PDFs (step-by-step guides with embedded screenshots) into professional HTML/JSON formats
- **Multiple Converter Options**:
  - `working-pdf-converter.js`: Production-ready converter with high-quality image extraction using pdfimages
  - `polished-pdf-converter.js`: Text-focused converter for when images aren't needed
  - Multiple experimental converters exploring different extraction methods

### 2. Web Application Server
- **Express.js-based server** with session management and authentication
- **Passport.js authentication** using local strategy with bcrypt password hashing
- **RESTful API endpoints** for document management and conversion triggering
- **Static file serving** for converted documents with access control

### 3. Web Dashboard
- **Modern, responsive interface** for document management
- **Document filtering**: View PDFs, converted files, or all documents
- **Real-time conversion status** and file management capabilities
- **Professional UI** with gradient headers and card-based layout
- **🆕 Edit buttons** for seamless access to document editor

### 4. 🆕 Professional Document Editor
- **Rich editing interface** with three-panel layout (sidebar, editor, preview)
- **Step management**: Add, delete, duplicate, and reorder steps via drag-and-drop
- **Rich text editing**: Bold, italic, underline, lists, links with formatting toolbar
- **Image management**: Upload, preview, and organize images with drag-and-drop
- **Live preview**: Real-time document preview with professional formatting
- **Auto-save**: Automatic drafts saved every 30 seconds with status indicators
- **Version control**: Automatic backups before saves with restore functionality
- **Undo/Redo**: Full change history with keyboard shortcuts (Ctrl+Z/Ctrl+Y)

## Current Status

### ✅ Fully Functional Components
- **Authentication System**: Complete with login/logout, session management, and protected routes
- **PDF Text Extraction**: Reliable extraction using pdf-parse library
- **Image Extraction**: Working solution using pdfimages from poppler-utils
- **HTML/JSON Generation**: Clean, professional output matching quality standards
- **Web Dashboard**: Full CRUD operations for document viewing and filtering
- **Title Cleanup**: Automated removal of Scribe metadata from document titles
- **🆕 Document Editor**: Professional editing interface with all advanced features
- **🆕 Step Management**: Complete step editing, reordering, and organization
- **🆕 Image Upload System**: Drag-and-drop image management with validation
- **🆕 Version Control**: Automatic backups and restore functionality
- **🆕 Rich Text Editing**: Comprehensive formatting tools and WYSIWYG editor
- **🆕 Auto-save System**: Real-time draft saving with status indicators
- **🆕 Live Preview**: Real-time document preview with professional formatting

### 🚧 Areas for Enhancement
- **Batch Conversion**: Currently requires manual command-line execution for multiple files
- **Multi-user Support**: Basic single-admin setup, no role-based access control yet
- **Advanced Search**: Document search and filtering beyond basic type filtering
- **Cloud Storage**: Local filesystem only, no cloud integration
- **Collaborative Editing**: Single-user editing, no real-time collaboration

## Technical Architecture

### Technology Stack
- **Backend**: Node.js with Express.js framework
- **Authentication**: Passport.js with local strategy, bcrypt for password hashing
- **PDF Processing**: pdf-parse for text, pdfimages/ghostscript for images
- **Frontend**: Vanilla JavaScript with modern CSS (no framework dependencies)
- **File Storage**: Local filesystem with structured directory organization
- **🆕 File Uploads**: Multer middleware for image handling
- **🆕 Session Management**: Express-session with secure cookie configuration

### Key Dependencies
```json
{
  "express": "^5.1.0",          // Web server framework
  "passport": "^0.7.0",          // Authentication middleware
  "bcrypt": "^6.0.0",           // Password hashing
  "pdf-parse": "^1.1.1",        // PDF text extraction
  "fs-extra": "^11.2.0",       // 🆕 Enhanced file system operations
  "multer": "^1.4.5",          // 🆕 File upload handling
  "express-session": "^1.18.0", // 🆕 Session management
  "pdfjs-dist": "^5.4.149",     // PDF rendering (experimental)
  "playwright": "^1.55.0",      // Browser automation (for Scribe scraping)
  "puppeteer": "^24.22.0"       // Alternative browser automation
}
```

### Directory Structure
```
scribe-pdf-exporter/
├── server.js                    # Main Express application with editor APIs
├── working-pdf-converter.js     # Production PDF converter
├── polished-pdf-converter.js    # Text-only converter
├── public/
│   ├── dashboard.html          # Web dashboard interface with edit buttons
│   ├── editor.html             # 🆕 Professional document editor
│   └── login.html              # Authentication page
├── downloads/                  # PDF storage and converted outputs
│   ├── *.pdf                  # Original Scribe PDFs
│   ├── *.html                 # Converted HTML documents
│   ├── *.json                 # Structured JSON data
│   └── *_images/              # Extracted images per document
├── uploads/                    # 🆕 Editor image uploads
├── backups/                    # 🆕 Document version backups
├── pdf_to_json_test/          # Reference quality examples
├── README.md                   # 🆕 Comprehensive project documentation
└── CLAUDE.md                   # 🆕 Detailed usage and implementation guide
```

## Document Processing Workflow

### Conversion Pipeline
1. **Input**: Scribe PDF with embedded metadata and screenshots
2. **Text Extraction**: Parse PDF to extract step descriptions and instructions
3. **Title Cleaning**: Remove timestamps, user IDs, and metadata artifacts
4. **Image Extraction**: Extract embedded screenshots using pdfimages
5. **Image Filtering**: Remove logos and small images (< 50KB)
6. **Structure Creation**: Generate JSON with steps, descriptions, and image references
7. **HTML Generation**: Create professional HTML with modals and responsive design
8. **Output**: Clean HTML/JSON files with associated image directory

### 🆕 Document Editing Workflow
1. **Access**: Click "✏️ Edit" button on dashboard to open document editor
2. **Loading**: System loads JSON structure with step titles, descriptions, and images
3. **Editing**: Use rich text tools, drag-and-drop reordering, and image management
4. **Auto-save**: Drafts automatically saved every 30 seconds
5. **Preview**: Live preview panel shows real-time formatting
6. **Publishing**: Save as draft or publish to regenerate HTML output
7. **Backup**: Automatic versioned backups created before each save
8. **Output**: Updated JSON/HTML files with preserved quality standards

## API Endpoints

### Document Management APIs
- `GET /api/downloads?type=converted` - List converted documents
- `GET /api/downloads?type=pdf` - List PDF files
- `GET /api/downloads?type=all` - List all files
- `GET /api/user` - Get current user information
- `GET /api/export` - Trigger PDF conversion process

### 🆕 Document Editor APIs
- `GET /editor` - Access document editor interface
- `GET /api/documents/:id/edit` - Load document structure for editing
- `PUT /api/documents/:id/edit` - Save document changes (draft or published)
- `POST /api/upload-image` - Upload images for document steps (10MB limit)
- `GET /api/documents/:id/versions` - List available document versions
- `POST /api/documents/:id/restore` - Restore previous document version

### Authentication APIs
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `GET /logout` - Logout and clear session

### Static File Serving
- `/downloads/*` - Access converted documents (authentication required)
- `/uploads/*` - Access uploaded images (authentication required)

## Quality Standards

The system follows established quality benchmarks:
- **Clean titles** without metadata artifacts
- **Professional HTML** with floating step numbers and gradient backgrounds
- **High-quality images** extracted at native resolution
- **Structured JSON** for programmatic access
- **Responsive design** for mobile and desktop viewing
- **🆕 Editor consistency** - Maintains original quality standards after editing
- **🆕 Version integrity** - Preserves document structure across edits

## Deployment & Usage

### Installation
```bash
# Install dependencies
npm install

# Install system tools for image extraction
sudo apt install poppler-utils  # Required for pdfimages
```

### Running the Server
```bash
npm start
# Server runs on http://localhost:8080
# Login: admin / ScribeExport25.
```

### Converting Documents
```bash
# Single document with images (RECOMMENDED)
node working-pdf-converter.js "downloads/document.pdf" "downloads/"

# Text-only conversion
node polished-pdf-converter.js "downloads/document.pdf" "downloads/"

# Batch conversion
for pdf in downloads/*.pdf; do
    node working-pdf-converter.js "$pdf" "downloads/"
done
```

### 🆕 Using the Document Editor
```bash
# Access via web interface
# 1. Open http://localhost:8080
# 2. Login with admin credentials
# 3. Click "✏️ Edit" on any converted JSON document
# 4. Use rich editing tools and save changes
```

## Security Considerations

- **Authentication Required**: All document access protected by login
- **Session Management**: 24-hour session timeout with httpOnly cookies
- **Password Security**: Bcrypt hashing with salt rounds
- **Path Traversal Protection**: Static file serving restricted to downloads directory
- **No External Dependencies**: All processing done locally, no external API calls
- **🆕 File Upload Security**: Multer validation with file type and size restrictions
- **🆕 Editor Protection**: All editor functions require authentication
- **🆕 Backup Security**: Automatic versioning prevents data loss

## Future Roadmap

### Short-term Improvements
- Add batch conversion through web interface
- Implement conversion progress indicators
- Add document search and filtering capabilities
- Support for document categories/tags
- Collaborative editing features

### Long-term Enhancements
- Multi-user support with role-based access
- Cloud storage integration (S3, Azure Blob)
- Real-time collaborative editing
- Webhook notifications for conversion completion
- Support for additional input formats (Word, Markdown)
- Advanced document templates and themes
- Integration with external documentation systems

## Known Issues & Limitations

1. **Large PDFs**: Processing can take 30+ seconds for documents with many pages
2. **Memory Usage**: PDF.js implementation uses significant memory for large files
3. **Browser Automation**: Scribe scraping scripts require manual cookie management
4. **Single User Editor**: No real-time collaborative editing support
5. **Local Storage Only**: No cloud backup or synchronization
6. **Limited File Formats**: Currently supports PDFs and images only

## Maintenance Notes

- **Cookie Updates**: Scribe scraping scripts require periodic cookie refresh
- **Dependencies**: Regular updates needed for security patches
- **Storage Management**: Downloads, uploads, and backups directories require periodic cleanup
- **🆕 Backup Management**: Automatic backups accumulate over time, consider cleanup policies
- **🆕 Image Storage**: Uploaded images stored permanently, implement cleanup if needed
- **Logs**: No centralized logging system, console output only

## Conclusion

Scribe PDF Exporter is a comprehensive, production-ready system for converting and editing Scribe documentation into professional web-ready formats. The recent addition of the professional document editor significantly enhances the platform's capabilities, providing users with rich editing tools, version control, and seamless document management.

### Current State Summary
- ✅ **Fully Functional**: Complete PDF conversion pipeline with high-quality output
- ✅ **Professional Editor**: Rich editing interface with all advanced features
- ✅ **Version Control**: Automatic backups and restore functionality
- ✅ **Security**: Robust authentication and file protection
- ✅ **Quality Maintained**: Preserves original document standards through editing
- ✅ **Production Ready**: Stable, tested, and documented system

The system now provides both conversion capabilities and professional editing tools, making it a complete solution for managing Scribe documentation. The modular architecture allows for easy extension and improvement while maintaining system stability and preserving document quality standards.

### Repository Information
- **GitHub**: https://github.com/aginit/scribe-pdf-exporter
- **Current Version**: Feature-complete with document editor
- **Status**: ✅ Production Ready & Actively Maintained