# Scribe Exporter - Project Overview

## Executive Summary

Scribe Exporter is a Node.js-based document conversion system designed to transform Scribe PDF exports into clean, structured HTML and JSON formats. The project includes a complete web application with authentication, a dashboard interface, and multiple PDF conversion strategies optimized for extracting high-quality content and images from Scribe documentation.

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

## Current Status

### ✅ Fully Functional Components
- **Authentication System**: Complete with login/logout, session management, and protected routes
- **PDF Text Extraction**: Reliable extraction using pdf-parse library
- **Image Extraction**: Working solution using pdfimages from poppler-utils
- **HTML/JSON Generation**: Clean, professional output matching quality standards
- **Web Dashboard**: Full CRUD operations for document viewing and filtering
- **Title Cleanup**: Automated removal of Scribe metadata from document titles

### 🚧 Areas for Enhancement
- **Batch Conversion**: Currently requires manual command-line execution for multiple files
- **Image Quality**: Some converters still experimenting with optimal extraction methods
- **Progress Indicators**: No real-time progress feedback during long conversions
- **User Management**: Basic single-admin setup, no multi-user support yet

## Technical Architecture

### Technology Stack
- **Backend**: Node.js with Express.js framework
- **Authentication**: Passport.js with local strategy, bcrypt for password hashing
- **PDF Processing**: pdf-parse for text, pdfimages/ghostscript for images
- **Frontend**: Vanilla JavaScript with modern CSS (no framework dependencies)
- **File Storage**: Local filesystem with structured directory organization

### Key Dependencies
```json
{
  "express": "^5.1.0",          // Web server
  "passport": "^0.7.0",          // Authentication
  "bcrypt": "^6.0.0",           // Password hashing
  "pdf-parse": "^1.1.1",        // PDF text extraction
  "pdfjs-dist": "^5.4.149",     // PDF rendering (experimental)
  "playwright": "^1.55.0",      // Browser automation (for Scribe scraping)
  "puppeteer": "^24.22.0"       // Alternative browser automation
}
```

### Directory Structure
```
scribe-exporter/
├── server.js                    # Main Express application
├── working-pdf-converter.js     # Production PDF converter
├── polished-pdf-converter.js    # Text-only converter
├── public/
│   ├── dashboard.html          # Web dashboard interface
│   └── login.html              # Authentication page
├── downloads/                  # PDF storage and converted outputs
│   ├── *.pdf                  # Original Scribe PDFs
│   ├── *.html                 # Converted HTML documents
│   ├── *.json                 # Structured JSON data
│   └── *_images/              # Extracted images per document
└── pdf_to_json_test/          # Reference quality examples
```

## Document Processing Workflow

1. **Input**: Scribe PDF with embedded metadata and screenshots
2. **Text Extraction**: Parse PDF to extract step descriptions and instructions
3. **Title Cleaning**: Remove timestamps, user IDs, and metadata artifacts
4. **Image Extraction**: Extract embedded screenshots using pdfimages
5. **Image Filtering**: Remove logos and small images (< 50KB)
6. **Structure Creation**: Generate JSON with steps, descriptions, and image references
7. **HTML Generation**: Create professional HTML with modals and responsive design
8. **Output**: Clean HTML/JSON files with associated image directory

## Quality Standards

The system follows established quality benchmarks:
- **Clean titles** without metadata artifacts
- **Professional HTML** with floating step numbers and gradient backgrounds
- **High-quality images** extracted at native resolution
- **Structured JSON** for programmatic access
- **Responsive design** for mobile and desktop viewing

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
# Single document with images
node working-pdf-converter.js "downloads/document.pdf" "downloads/"

# Batch conversion
for pdf in downloads/*.pdf; do
    node working-pdf-converter.js "$pdf" "downloads/"
done
```

## Security Considerations

- **Authentication Required**: All document access protected by login
- **Session Management**: 24-hour session timeout with httpOnly cookies
- **Password Security**: Bcrypt hashing with salt rounds
- **Path Traversal Protection**: Static file serving restricted to downloads directory
- **No External Dependencies**: All processing done locally, no external API calls

## Future Roadmap

### Short-term Improvements
- Add batch conversion through web interface
- Implement conversion progress indicators
- Add document search and filtering capabilities
- Support for document categories/tags

### Long-term Enhancements
- Multi-user support with role-based access
- Cloud storage integration (S3, Azure Blob)
- API for programmatic access
- Webhook notifications for conversion completion
- Support for additional input formats (Word, Markdown)

## Known Issues & Limitations

1. **Large PDFs**: Processing can take 30+ seconds for documents with many pages
2. **Memory Usage**: PDF.js implementation uses significant memory for large files
3. **Image Quality**: Ghostscript page rendering produces lower quality than pdfimages
4. **Browser Automation**: Scribe scraping scripts require manual cookie management
5. **Error Handling**: Limited error recovery in conversion pipeline

## Maintenance Notes

- **Cookie Updates**: Scribe scraping scripts require periodic cookie refresh
- **Dependencies**: Regular updates needed for security patches
- **Storage Management**: Downloads directory requires periodic cleanup
- **Logs**: No centralized logging system, console output only

## Conclusion

Scribe Exporter is a functional, production-ready system for converting Scribe documentation into professional web-ready formats. While there are areas for enhancement, the core functionality is stable and delivers high-quality output that preserves the original document structure and visual elements. The modular architecture allows for easy extension and improvement of individual components without affecting the overall system stability.