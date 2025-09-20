#!/usr/bin/env python3
"""
Complete PDF to HTML Procedure Converter Workflow
Automates the entire conversion process with validation and reporting
"""

import os
import sys
import json
import argparse
from pathlib import Path
from pdf_converter_robust import PDFProcedureConverter


def generate_html_from_json(json_file: str, output_html: str = None) -> str:
    """Generate HTML from JSON file"""
    with open(json_file, 'r') as f:
        data = json.load(f)

    if not output_html:
        output_html = json_file.replace('.json', '.html')

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{data['title']}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}

        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }}

        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}

        h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }}

        .metadata {{
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            font-size: 1.1em;
        }}

        .metadata-item {{
            opacity: 0.9;
        }}

        .validation-status {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            background: rgba(255,255,255,0.2);
            margin-top: 15px;
        }}

        .steps-container {{
            padding: 40px;
        }}

        .step {{
            margin-bottom: 50px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 15px;
            position: relative;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }}

        .step:hover {{
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }}

        .step-number {{
            position: absolute;
            top: -20px;
            left: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5em;
            font-weight: bold;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }}

        .step-content {{
            margin-top: 20px;
        }}

        .step-description {{
            font-size: 1.2em;
            margin-bottom: 20px;
            color: #2c3e50;
            font-weight: 500;
        }}

        .step-metadata {{
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            font-size: 0.9em;
            color: #666;
        }}

        .confidence-indicator {{
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }}

        .confidence-bar {{
            width: 60px;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
        }}

        .confidence-fill {{
            height: 100%;
            background: linear-gradient(90deg, #dc3545, #ffc107, #28a745);
        }}

        .warnings {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 15px 0;
            border-radius: 5px;
            font-size: 0.9em;
            color: #856404;
        }}

        .step-images {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
            margin-top: 20px;
        }}

        .step-image {{
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            cursor: pointer;
        }}

        .step-image:hover {{
            transform: scale(1.02);
            box-shadow: 0 12px 30px rgba(0,0,0,0.25);
        }}

        .navigation {{
            text-align: center;
            padding: 30px;
            background: #f8f9fa;
        }}

        .nav-button {{
            display: inline-block;
            margin: 0 10px;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
        }}

        .nav-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }}

        .modal {{
            display: none;
            position: fixed;
            z-index: 1000;
            padding-top: 50px;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }}

        .modal-content {{
            margin: auto;
            display: block;
            max-width: 90%;
            max-height: 90%;
        }}

        .close {{
            position: absolute;
            top: 15px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.3s;
        }}

        .close:hover {{
            color: #bbb;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{data['title']}</h1>
            <div class="metadata">
                <div class="metadata-item">📋 {data['total_steps']} Steps</div>
                <div class="metadata-item">📄 Converted from PDF</div>
            </div>
"""

    # Check if all steps have high confidence
    all_high_confidence = all(step.get('confidence', 1.0) >= 0.8 for step in data['steps'])
    if all_high_confidence:
        html_content += '            <div class="validation-status">✅ High Confidence Conversion</div>\n'

    html_content += """        </div>

        <div class="steps-container">
"""

    for step in data['steps']:
        confidence = step.get('confidence', 1.0)
        confidence_percent = confidence * 100

        html_content += f"""
            <div class="step">
                <div class="step-number">{step['step_number']}</div>
                <div class="step-content">
                    <div class="step-description">{step['description']}</div>
                    <div class="step-metadata">
                        <span>Page {step['page']}</span>
                        <span>{len(step.get('images', []))} images</span>
"""

        if 'confidence' in step:
            html_content += f"""
                        <div class="confidence-indicator">
                            <span>Confidence:</span>
                            <div class="confidence-bar">
                                <div class="confidence-fill" style="width: {confidence_percent}%"></div>
                            </div>
                            <span>{confidence_percent:.0f}%</span>
                        </div>
"""

        html_content += "                    </div>\n"

        if step.get('warnings'):
            html_content += '                    <div class="warnings">\n'
            html_content += '                        <strong>⚠️ Notes:</strong><br>\n'
            for warning in step['warnings']:
                html_content += f'                        • {warning}<br>\n'
            html_content += '                    </div>\n'

        if step.get('images'):
            html_content += '                    <div class="step-images">\n'
            for image in step['images']:
                html_content += f"""
                        <img src="{image['path']}" alt="Step {step['step_number']}"
                             class="step-image" onclick="openModal(this.src)">
"""
            html_content += '                    </div>\n'

        html_content += """                </div>
            </div>
"""

    # Extract base name for report link
    base_name = os.path.splitext(os.path.basename(json_file))[0]

    html_content += f"""
        </div>

        <div class="navigation">
            <a href="{base_name}_report.html" class="nav-button">📊 View Validation Report</a>
            <a href="index.html" class="nav-button">📚 All Procedures</a>
        </div>
    </div>

    <div id="imageModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImage">
    </div>

    <script>
        function openModal(src) {{
            document.getElementById('imageModal').style.display = "block";
            document.getElementById('modalImage').src = src;
        }}

        function closeModal() {{
            document.getElementById('imageModal').style.display = "none";
        }}

        document.addEventListener('keydown', function(event) {{
            if (event.key === 'Escape') {{
                closeModal();
            }}
        }});

        document.getElementById('imageModal').onclick = function(event) {{
            if (event.target.id === 'imageModal') {{
                closeModal();
            }}
        }}
    </script>
</body>
</html>
"""

    with open(output_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    return output_html


def main():
    """Main workflow function"""
    parser = argparse.ArgumentParser(description='Convert PDF procedures to JSON and HTML with validation')
    parser.add_argument('pdf_file', help='Path to PDF file')
    parser.add_argument('output_name', help='Base name for output files')
    parser.add_argument('--no-html', action='store_true', help='Skip HTML generation')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if not os.path.exists(args.pdf_file):
        print(f"Error: PDF file '{args.pdf_file}' not found")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"PDF to Procedure Converter")
    print(f"{'='*60}\n")

    # Step 1: Convert PDF to JSON with validation
    print("📄 Converting PDF to JSON...")
    converter = PDFProcedureConverter(args.pdf_file, args.output_name, verbose=args.verbose)
    json_file, report_file = converter.convert()

    # Step 2: Generate HTML if requested
    if not args.no_html:
        print("🎨 Generating HTML...")
        html_file = generate_html_from_json(json_file)
        print(f"   Created: {html_file}")

    # Step 3: Display results
    print(f"\n{'='*60}")
    print("✅ Conversion Complete!")
    print(f"{'='*60}\n")

    print("📁 Generated Files:")
    print(f"   • JSON:   {json_file}")
    print(f"   • Report: {report_file}")
    if not args.no_html:
        print(f"   • HTML:   {html_file}")
    print(f"   • Images: {args.output_name}_images/")

    # Load and display validation summary
    with open(json_file, 'r') as f:
        data = json.load(f)

    print(f"\n📊 Conversion Summary:")
    print(f"   • Title: {data['title']}")
    print(f"   • Steps: {data['total_steps']}")
    print(f"   • Images: {sum(len(s.get('images', [])) for s in data['steps'])}")

    # Check for warnings
    total_warnings = sum(len(s.get('warnings', [])) for s in data['steps'])
    if total_warnings > 0:
        print(f"   • ⚠️  Warnings: {total_warnings} (see report for details)")

    print(f"\n👉 Open {report_file} in a browser to view the detailed validation report")


if __name__ == "__main__":
    main()