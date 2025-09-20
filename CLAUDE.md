# Scribe PDF Exporter - Claude Documentation

## Project Overview

This is a Node.js application that converts Scribe PDF exports into structured HTML and JSON documents with professional formatting. The system includes a web dashboard for managing conversions and a robust PDF processing pipeline.

## Key Features

- **PDF to Structured Format Conversion**: Converts Scribe PDFs into clean JSON and HTML formats
- **Web Dashboard**: Express.js server with authentication for managing documents
- **🆕 Document Editor**: Rich editing interface for modifying converted documents
- **Clean Title Extraction**: Removes metadata junk from document titles
- **Professional HTML Output**: Matches high-quality formatting standards
- **Image Extraction Ready**: Supports multiple PDF-to-image conversion methods
- **File Management**: API endpoints for listing and filtering converted documents
- **🆕 Version Control**: Automatic backup system with restore functionality

## Architecture

### Core Components

1. **Server** (`server.js`): Express.js application with authentication middleware
2. **PDF Converters**: Multiple conversion scripts with different capabilities
3. **Web Dashboard** (`public/dashboard.html`): Frontend interface for document management
4. **🆕 Document Editor** (`public/editor.html`): Rich editing interface for converted documents
5. **Authentication**: Basic auth protection for the dashboard

### PDF Converter Options

1. **`working-pdf-converter.js`** (RECOMMENDED FOR COMPLETE CONVERSION)
   - **HIGH-QUALITY IMAGE EXTRACTION**: Uses `pdfimages` to extract native embedded screenshots
   - **Logo Filtering**: Automatically removes company logos (< 50KB)
   - **Professional Output**: Clean HTML/JSON with proper step numbering
   - **Step Alignment**: Correctly matches step descriptions with images
   - Use this for production conversions with images

2. **`polished-pdf-converter.js`** (For Text-Only)
   - Clean title extraction
   - Professional HTML/JSON output
   - Placeholder-based image structure
   - Use only when images are not needed

3. **`improved-pdf-converter.js`**
   - PDF.js + Canvas approach
   - Currently has Node.js compatibility issues
   - Potential for future enhancement

## Installation & Setup

### Prerequisites
```bash
# Required
node.js (v16+)
npm

# Optional (for image extraction)
sudo apt install ghostscript        # Recommended
sudo apt install poppler-utils      # Alternative
sudo apt install imagemagick        # Alternative
```

### Installation
```bash
npm install
```

### Running the Server
```bash
npm start
# Server runs on http://localhost:3000
```

### Authentication
- Username: `admin`
- Password: `password123`
- Configure in `server.js` lines 9-10

## Usage

### Converting PDFs

#### Using Working Converter (RECOMMENDED)
```bash
# For complete conversion with high-quality images
node working-pdf-converter.js path/to/document.pdf output/directory/
```

#### Using Polished Converter (Text-Only)
```bash
# For text-only conversion without images
node polished-pdf-converter.js path/to/document.pdf output/directory/
```

### Web Dashboard
1. Navigate to `http://localhost:8080`
2. Login with admin credentials: `admin` / `ScribeExport25.`
3. Use "View Downloads" to see converted documents
4. Filter by type: PDF, Converted, or All
5. Click "✏️ Edit" buttons to open documents in the editor

### 🆕 Document Editor
The comprehensive document editor allows users to modify converted documents with professional-grade tools:

#### Editor Features
- **Rich Text Editing**: Bold, italic, underline, lists, links with formatting toolbar
- **Step Management**: Add, delete, duplicate, and reorder steps via drag-and-drop
- **Image Management**: Upload images with drag-and-drop, preview, and removal
- **Live Preview**: Real-time preview panel showing formatted document
- **Auto-save**: Automatic drafts saved every 30 seconds
- **Version Control**: Automatic backups created before each save
- **Undo/Redo**: Full change history with keyboard shortcuts (Ctrl+Z/Ctrl+Y)

#### Editor Access
1. From dashboard, click "✏️ Edit" on any converted JSON document
2. Direct URL: `/editor?id=document.json` (requires login)
3. Edit document title, description, and individual steps
4. Save as draft or publish final changes

#### Editor Interface
- **Left Sidebar**: Step list with drag-and-drop reordering
- **Main Editor**: Document info and step editing with rich text tools
- **Right Panel**: Live preview of changes
- **Status Bar**: Auto-save status and last saved time

### API Endpoints

#### Document Management
- `GET /api/downloads?type=converted` - List converted documents
- `GET /api/downloads?type=pdf` - List PDF files
- `GET /api/downloads?type=all` - List all files

#### 🆕 Document Editor APIs
- `GET /api/documents/:id/edit` - Load document for editing
- `PUT /api/documents/:id/edit` - Save edited document (draft or published)
- `POST /api/upload-image` - Upload images for document steps
- `GET /api/documents/:id/versions` - List document backup versions
- `POST /api/documents/:id/restore` - Restore previous document version

## Document Quality Standards

The converters follow the quality standard established by `3cx_clean.html`:

- **Clean Titles**: Remove metadata like "init consulting10 steps4 months ago 1757788223084"
- **Professional Layout**: Floating step numbers with gradient backgrounds
- **Structured Steps**: Each step has description and associated images
- **Modal Functionality**: Click-to-expand image viewing
- **Responsive Design**: Mobile-friendly layout

## File Structure

```
/home/andrew/scribe_download/scribe-exporter/
├── server.js                     # Main Express server with editor APIs
├── polished-pdf-converter.js     # Recommended PDF converter
├── working-pdf-converter.js      # Multi-method converter
├── improved-pdf-converter.js     # PDF.js converter (WIP)
├── public/
│   ├── dashboard.html            # Web dashboard interface
│   └── editor.html              # 🆕 Document editor interface
├── downloads/                    # PDF files and converted outputs
├── uploads/                     # 🆕 Document image uploads
├── backups/                     # 🆕 Document version backups
├── pdf_to_json_test/            # Quality reference examples
│   ├── 3cx_clean.html           # Quality standard reference
│   └── 3cx_perfect.json         # JSON structure reference
└── node_modules/                # Dependencies
```

## Image Extraction

### Current Status
- **High-Quality Embedded Images**: `working-pdf-converter.js` extracts native screenshots from PDFs
- **Real Images**: Uses `pdfimages` from poppler-utils for optimal quality

### CRITICAL: Correct Image Extraction Method
**NEVER use Ghostscript page rendering** - it creates poor quality images. Scribe PDFs contain embedded high-resolution screenshots that must be extracted directly.

#### Correct Approach (working-pdf-converter.js)
```bash
# Extract embedded images (NOT page renders)
pdfimages -png "${pdfPath}" "${imagesDir}/extracted_img"
```

#### Wrong Approach (DO NOT USE)
```bash
# This creates blurry, poor quality images
gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r300 -sOutputFile="${imagesDir}/page_%03d.png" "${pdfPath}"
```

### Installation Requirements
```bash
# REQUIRED: Poppler utilities for pdfimages
sudo apt install poppler-utils

# OPTIONAL: Other tools for legacy support
sudo apt install ghostscript imagemagick
```

### Key Image Processing Features
1. **Logo Filtering**: Automatically removes company logos by filtering images < 50KB
2. **Consecutive Renaming**: Creates step_1.png, step_2.png, etc. for proper HTML linking
3. **Native Quality**: Preserves original screenshot quality from embedded PDF images

## Common Tasks

### Convert a Single PDF with Images
```bash
# RECOMMENDED: Full conversion with high-quality images
node working-pdf-converter.js "downloads/document.pdf" "downloads/"
```

### Convert a Single PDF (Text Only)
```bash
# Text-only conversion without images
node polished-pdf-converter.js "downloads/document.pdf" "downloads/"
```

### Batch Convert PDFs
```bash
# Convert all PDFs in downloads directory with images
for pdf in downloads/*.pdf; do
    node working-pdf-converter.js "$pdf" "downloads/"
done
```

### Start Development Server
```bash
npm start
# Access dashboard at http://localhost:3000
```

### View Server Logs
```bash
# Check background processes
ps aux | grep node

# Check specific server logs
npm start 2>&1 | tee server.log
```

## Troubleshooting

### Image Quality Issues
1. **"Screenshots look like dogshit"**: You're using Ghostscript page rendering instead of `pdfimages`
   - **Solution**: Use `working-pdf-converter.js` with `pdfimages -png`
   - **Never use**: `gs -r300` or similar page rendering commands

2. **Company logos appearing as steps**: Not filtering small images
   - **Solution**: Ensure file size filtering (< 50KB) is active in converter
   - **Check**: Logo images should be skipped automatically

3. **Broken image links in HTML**: Image files not numbered consecutively
   - **Symptoms**: HTML references `step_1.png` but files are `step_28.png`
   - **Solution**: Ensure consecutive renaming from extracted images to step_N.png

4. **Step descriptions off by one**: Using document title as step 1
   - **Symptoms**: Step 1 shows document title instead of first actual step
   - **Solution**: Use `meaningfulLines[index + 1]` not `meaningfulLines[index]`

### PDF Conversion Issues
1. **Text extraction fails**: Check PDF is not corrupted or password-protected
2. **Images show as placeholders**: Install poppler-utils (`sudo apt install poppler-utils`)
3. **Title cleanup not working**: Verify filename format matches expected patterns
4. **No images extracted**: Check `pdfimages` command is available (`which pdfimages`)

### Common Image Extraction Failures
```bash
# Verify pdfimages is installed
which pdfimages
# Should return: /usr/bin/pdfimages

# Test image extraction manually
pdfimages -png /path/to/file.pdf /tmp/test_extract

# Check if images were extracted
ls -la /tmp/test_extract*
```

### Server Issues
1. **Port already in use**: Change port in `server.js` or kill existing process
2. **Authentication fails**: Check credentials in `server.js`
3. **Dashboard not loading**: Verify `public/dashboard.html` exists

### Performance
- **Large PDFs**: May take 30+ seconds to convert
- **Many files**: Dashboard loads all files, may be slow with 100+ documents
- **Memory usage**: PDF.js conversion uses significant memory for large files

## Development Notes

### Quality Reference
- `3cx_clean.html`: The gold standard for output formatting
- `3cx_perfect.json`: Reference JSON structure
- Title cleanup removes: timestamps, user IDs, "init consulting", step counts

### Code Organization
- PDF converters are standalone scripts
- Server provides web interface and API
- Authentication is basic but functional
- File filtering supports converted/pdf/all types

### Future Enhancements
1. Fix PDF.js Node.js compatibility for improved image extraction
2. Add batch conversion through web interface
3. Implement proper user management
4. Add progress indicators for long conversions
5. Support for additional input formats

## Dependencies

Key packages:
- `express`: Web server framework
- `pdf-parse`: PDF text extraction
- `fs-extra`: Enhanced file system operations
- `🆕 multer`: File upload handling for editor images
- `express-session`: Session management for authentication
- `passport`: Authentication middleware
- `bcrypt`: Password hashing
- `pdfjs-dist`: PDF.js for rendering (experimental)
- `canvas`: Node.js Canvas implementation
- `puppeteer`: Browser automation (experimental)

## Testing

Test the conversion pipeline:
```bash
# Test polished converter
node polished-pdf-converter.js "pdf_to_json_test/3cx_forwarding.pdf" "downloads/"

# Verify output quality matches reference
diff downloads/output.json pdf_to_json_test/3cx_perfect.json
```

---

*Generated for Claude Code assistant - this documentation covers the current state and usage of the Scribe PDF Exporter project.*