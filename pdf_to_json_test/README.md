# PDF to JSON/HTML Converter for Scribe Procedures

## Overview
A robust PDF to JSON/HTML converter specifically designed for Scribe-generated procedure PDFs. Features automatic validation, error correction, and detailed reporting.

## Features

### 🎯 Error Minimization
- **Multiple extraction methods**: Combines pattern matching, action verb detection, and layout analysis
- **Confidence scoring**: Each step is assigned a confidence score based on extraction method
- **Automatic corrections**: Applies PDF-specific fixes for known patterns
- **Duplicate detection**: Automatically removes duplicate steps
- **Missing step detection**: Identifies and reports gaps in step sequences

### 📊 Automatic Validation & Comparison
- **Validation report**: Generated for every conversion showing:
  - Extraction confidence for each step
  - Warnings and errors
  - Conversion log
  - Suggestions for manual review
- **Side-by-side comparison**: Compare original PDF structure with converted output
- **Visual indicators**: Color-coded status for valid, warning, and error states

### 🚀 Workflow Improvements
- **Single command conversion**: One command converts PDF → JSON → HTML with validation
- **Batch processing**: Convert multiple PDFs at once with dashboard
- **Progress tracking**: Real-time conversion status and logging
- **Image extraction**: Automatically extracts and associates images with steps

## Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install pymupdf pillow
```

## Usage

### Single File Conversion

```bash
# Basic conversion with validation
python convert_procedure.py input.pdf output_name

# Verbose mode for debugging
python convert_procedure.py input.pdf output_name --verbose

# JSON only (skip HTML generation)
python convert_procedure.py input.pdf output_name --no-html
```

### Batch Conversion

```bash
# Convert all PDFs in directory
python batch_convert.py

# Custom pattern and prefix
python batch_convert.py --pattern "procedures/*.pdf" --prefix "converted"
```

### Direct Robust Converter

```bash
# For advanced users - direct access to converter with all options
python pdf_converter_robust.py input.pdf output_name
```

## Output Files

For each converted PDF, the system generates:

1. **`{name}.json`** - Structured procedure data with:
   - Step numbers and descriptions
   - Associated images
   - Confidence scores
   - Warnings/corrections applied

2. **`{name}.html`** - Interactive HTML procedure with:
   - Step-by-step layout
   - Clickable images with modal view
   - Confidence indicators
   - Navigation controls

3. **`{name}_report.html`** - Validation report with:
   - Conversion status
   - Errors and warnings
   - Step-by-step validation
   - Conversion log
   - Links to all output files

4. **`{name}_images/`** - Extracted images directory

5. **`dashboard.html`** (batch mode) - Overview of all conversions

## How It Minimizes Errors

### 1. Multi-Method Extraction
```python
# Method 1: Traditional number pattern matching
steps = extract_by_number_pattern()

# Method 2: Action verb detection (Click, Navigate, etc.)
steps += extract_by_action_verbs()

# Method 3: Layout analysis using PDF structure
steps += extract_by_layout()

# Merge and validate all methods
final_steps = merge_and_validate_steps()
```

### 2. Automatic Corrections
- **PDF-specific fixes**: Applies known corrections for Twilio, 3CX, etc.
- **Title extraction**: Smart title detection avoiding page numbers
- **Description validation**: Filters out invalid descriptions
- **Step sequence repair**: Fills gaps and removes duplicates

### 3. Validation System
- **Pre-conversion validation**: Checks PDF structure
- **Post-conversion validation**: Verifies output completeness
- **Confidence scoring**: Tracks reliability of each extraction
- **Warning system**: Flags potential issues for manual review

## Comparison Feature

Every conversion automatically includes comparison between:
- Original PDF structure (as detected)
- Converted JSON/HTML output
- Confidence levels for each step
- Applied corrections and warnings

Access via:
- Individual report files (`*_report.html`)
- Batch dashboard (`dashboard.html`)
- Comparison page (`comparison.html` for manual review)

## Example Workflow

```bash
# 1. Convert a single PDF
python convert_procedure.py my_procedure.pdf my_output

# Output:
# ✅ my_output.json - Structured data
# ✅ my_output.html - Interactive procedure
# ✅ my_output_report.html - Validation report
# ✅ my_output_images/ - Extracted images

# 2. Batch convert all PDFs
python batch_convert.py

# Output:
# ✅ dashboard.html - Overview of all conversions
# ✅ Individual files for each PDF

# 3. View validation
# Open my_output_report.html in browser to see:
# - Extraction confidence
# - Warnings and corrections
# - Step-by-step validation
```

## Troubleshooting

### Low Confidence Warnings
- Review steps with confidence < 70%
- Check PDF quality and formatting
- Manual verification may be needed

### Missing Steps
- Check validation report for gap detection
- Review PDF for non-standard formatting
- Use verbose mode for detailed logging

### Image Association Issues
- Ensure PDF has embedded images (not links)
- Check image size filters (>100x100 pixels)
- Review image distribution logic in report

## Advanced Features

### Custom Corrections
Add PDF-specific corrections in `pdf_converter_robust.py`:

```python
def _apply_custom_corrections(self, data):
    # Add your PDF-specific logic
    if "your_pattern" in self.pdf_path.lower():
        # Apply corrections
        pass
```

### Confidence Thresholds
Adjust confidence thresholds in converter:

```python
# In PDFProcedureConverter
MIN_CONFIDENCE = 0.7  # Minimum acceptable confidence
HIGH_CONFIDENCE = 0.9  # High confidence threshold
```

## License
MIT

## Support
For issues or improvements, please create a GitHub issue or submit a pull request.