# Scribe PDF Exporter

A comprehensive Node.js application that converts Scribe PDF exports into structured HTML and JSON documents with a professional document editing interface.

## 🚀 Features

### Core Functionality
- **PDF to Structured Format Conversion**: Converts Scribe PDFs into clean JSON and HTML formats
- **Web Dashboard**: Express.js server with authentication for managing documents
- **🆕 Document Editor**: Rich editing interface for modifying converted documents
- **Professional HTML Output**: High-quality formatting with responsive design
- **Image Extraction**: Direct extraction of embedded PDF images for optimal quality
- **Version Control**: Automatic backup system with restore functionality

### 🆕 Document Editor
The comprehensive editor provides professional-grade tools for modifying converted documents:

- **Rich Text Editing**: Bold, italic, underline, lists, links with formatting toolbar
- **Step Management**: Add, delete, duplicate, and reorder steps via drag-and-drop
- **Image Management**: Upload images with drag-and-drop, preview, and removal
- **Live Preview**: Real-time preview panel showing formatted document
- **Auto-save**: Automatic drafts saved every 30 seconds
- **Undo/Redo**: Full change history with keyboard shortcuts (Ctrl+Z/Ctrl+Y)

## 📋 Quick Start

### Prerequisites
```bash
# Required
node.js (v16+)
npm

# Optional (for image extraction)
sudo apt install poppler-utils      # For pdfimages
sudo apt install ghostscript        # Alternative
sudo apt install imagemagick        # Alternative
```

### Installation
```bash
git clone https://github.com/aginit/scribe-pdf-exporter.git
cd scribe-pdf-exporter
npm install
```

### Running the Application
```bash
npm start
# Server runs on http://localhost:8080
```

### Default Login
- **Username**: `admin`
- **Password**: `ScribeExport25.`

## 🎯 Usage

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

### Web Interface
1. Navigate to `http://localhost:8080`
2. Login with admin credentials
3. View converted documents on the dashboard
4. Click "✏️ Edit" buttons to open documents in the editor

### Document Editor
1. From dashboard, click "✏️ Edit" on any converted JSON document
2. Edit document title, description, and individual steps
3. Use rich text tools, drag-and-drop reordering, and image management
4. Save as draft or publish final changes

## 📁 Project Structure

```
scribe-pdf-exporter/
├── server.js                     # Main Express server with editor APIs
├── working-pdf-converter.js      # RECOMMENDED: Complete PDF converter
├── polished-pdf-converter.js     # Text-only PDF converter
├── public/
│   ├── dashboard.html            # Web dashboard interface
│   └── editor.html              # 🆕 Document editor interface
├── downloads/                    # PDF files and converted outputs
├── uploads/                     # 🆕 Document image uploads
├── backups/                     # 🆕 Document version backups
└── CLAUDE.md                    # Comprehensive documentation
```

## 🔧 API Endpoints

### Document Management
- `GET /api/downloads?type=converted` - List converted documents
- `GET /api/downloads?type=pdf` - List PDF files
- `GET /api/downloads?type=all` - List all files

### 🆕 Document Editor APIs
- `GET /api/documents/:id/edit` - Load document for editing
- `PUT /api/documents/:id/edit` - Save edited document (draft or published)
- `POST /api/upload-image` - Upload images for document steps
- `GET /api/documents/:id/versions` - List document backup versions
- `POST /api/documents/:id/restore` - Restore previous document version

## 🖼️ Image Extraction

### High-Quality Image Processing
The system uses `pdfimages` from poppler-utils to extract native embedded screenshots directly from PDFs:

```bash
# Install required tools
sudo apt install poppler-utils

# The converter automatically extracts images with:
pdfimages -png input.pdf output_directory/
```

**Note**: Never use Ghostscript page rendering as it creates poor quality images. Scribe PDFs contain embedded high-resolution screenshots that should be extracted directly.

## 🎨 Editor Interface

### Three-Panel Layout
- **Left Sidebar**: Step list with drag-and-drop reordering
- **Main Editor**: Document info and step editing with rich text tools
- **Right Panel**: Live preview of changes

### Rich Text Features
- Bold, italic, underline formatting
- Bullet lists and numbered lists
- Insert links with URL validation
- Clear formatting tools

### Image Management
- Drag-and-drop image upload
- Image preview with removal options
- Automatic file organization
- Format validation (PNG, JPG, GIF, WebP)

## 🔒 Security

- Authentication required for all functions
- Session-based access control
- File upload validation and size limits
- Protected routes with middleware

## 📖 Documentation

For comprehensive documentation, see [CLAUDE.md](CLAUDE.md) which includes:
- Detailed setup instructions
- PDF conversion best practices
- Editor usage guide
- API documentation
- Troubleshooting tips

## 🛠️ Dependencies

- `express`: Web server framework
- `fs-extra`: Enhanced file system operations
- `multer`: File upload handling for editor images
- `express-session`: Session management
- `passport`: Authentication middleware
- `bcrypt`: Password hashing
- `pdf-parse`: PDF text extraction

## 🧪 Testing

Test the conversion pipeline:
```bash
# Test polished converter
node polished-pdf-converter.js "pdf_to_json_test/3cx_forwarding.pdf" "downloads/"

# Test editor functionality
node test-editor.js
```

## 🔄 Version Control

The system automatically creates backups before document edits:
- Timestamped backup files in `backups/` directory
- Restore previous versions via API
- Draft vs published states
- Undo/redo functionality in editor

## 🎯 Quality Standards

Output follows professional formatting standards:
- Clean title extraction (removes metadata)
- Proper step numbering and alignment
- Responsive design for mobile devices
- Professional gradient styling
- Modal image viewing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Repository**: https://github.com/aginit/scribe-pdf-exporter
- **Issues**: https://github.com/aginit/scribe-pdf-exporter/issues
- **Documentation**: [CLAUDE.md](CLAUDE.md)

---

*🤖 Generated with Claude Code*