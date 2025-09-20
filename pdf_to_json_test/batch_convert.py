#!/usr/bin/env python3
"""
Batch PDF Converter with Validation Dashboard
Converts multiple PDFs and creates a dashboard showing all results
"""

import os
import sys
import json
import glob
from pathlib import Path
from datetime import datetime
from convert_procedure import generate_html_from_json
from pdf_converter_robust import PDFProcedureConverter


def create_dashboard(conversions):
    """Create an HTML dashboard showing all conversions"""
    dashboard_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Batch Conversion Dashboard</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            margin: 0;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}

        .header {{
            background: white;
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }}

        h1 {{
            margin: 0 0 10px 0;
            color: #333;
        }}

        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}

        .stat-card {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }}

        .stat-value {{
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }}

        .stat-label {{
            color: #666;
            margin-top: 5px;
        }}

        .conversions-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }}

        .conversion-card {{
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            transition: transform 0.3s, box-shadow 0.3s;
        }}

        .conversion-card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }}

        .card-header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
        }}

        .card-title {{
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 5px;
        }}

        .card-subtitle {{
            opacity: 0.9;
            font-size: 0.9em;
        }}

        .card-body {{
            padding: 20px;
        }}

        .status {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            margin-bottom: 15px;
        }}

        .status.valid {{
            background: #d4edda;
            color: #155724;
        }}

        .status.warning {{
            background: #fff3cd;
            color: #856404;
        }}

        .status.error {{
            background: #f8d7da;
            color: #721c24;
        }}

        .metrics {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 15px 0;
        }}

        .metric {{
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #e0e0e0;
        }}

        .links {{
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }}

        .link-btn {{
            flex: 1;
            text-align: center;
            padding: 10px;
            background: #f8f9fa;
            color: #667eea;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: background 0.3s;
        }}

        .link-btn:hover {{
            background: #e9ecef;
        }}

        .timestamp {{
            text-align: center;
            color: #666;
            margin-top: 30px;
            padding: 20px;
            background: white;
            border-radius: 10px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Batch Conversion Dashboard</h1>
            <p>Converted {len(conversions)} PDF procedures</p>

            <div class="summary">
                <div class="stat-card">
                    <div class="stat-value">{len(conversions)}</div>
                    <div class="stat-label">Total Files</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{sum(1 for c in conversions if c['valid'])}</div>
                    <div class="stat-label">Valid</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{sum(1 for c in conversions if c['warnings'] > 0)}</div>
                    <div class="stat-label">With Warnings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{sum(c['total_steps'] for c in conversions)}</div>
                    <div class="stat-label">Total Steps</div>
                </div>
            </div>
        </div>

        <div class="conversions-grid">
"""

    for conv in conversions:
        status_class = 'valid' if conv['valid'] else 'error' if conv['errors'] > 0 else 'warning'
        status_text = '✅ Valid' if conv['valid'] else '❌ Has Errors' if conv['errors'] > 0 else '⚠️ Has Warnings'

        dashboard_html += f"""
            <div class="conversion-card">
                <div class="card-header">
                    <div class="card-title">{conv['title']}</div>
                    <div class="card-subtitle">{conv['pdf_name']}</div>
                </div>
                <div class="card-body">
                    <div class="status {status_class}">{status_text}</div>

                    <div class="metrics">
                        <div class="metric">
                            <span>Steps:</span>
                            <strong>{conv['total_steps']}</strong>
                        </div>
                        <div class="metric">
                            <span>Images:</span>
                            <strong>{conv['total_images']}</strong>
                        </div>
                        <div class="metric">
                            <span>Warnings:</span>
                            <strong>{conv['warnings']}</strong>
                        </div>
                        <div class="metric">
                            <span>Avg Confidence:</span>
                            <strong>{conv['avg_confidence']:.0%}</strong>
                        </div>
                    </div>

                    <div class="links">
                        <a href="{conv['html_file']}" class="link-btn">📄 View</a>
                        <a href="{conv['report_file']}" class="link-btn">📊 Report</a>
                        <a href="{conv['json_file']}" class="link-btn">📋 JSON</a>
                    </div>
                </div>
            </div>
"""

    dashboard_html += f"""
        </div>

        <div class="timestamp">
            Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
"""

    with open('dashboard.html', 'w') as f:
        f.write(dashboard_html)

    return 'dashboard.html'


def batch_convert(pdf_pattern='*.pdf', output_prefix='converted'):
    """Convert multiple PDFs matching a pattern"""
    pdf_files = glob.glob(pdf_pattern)

    if not pdf_files:
        print(f"No PDF files found matching pattern: {pdf_pattern}")
        return

    print(f"\n{'='*60}")
    print(f"Batch PDF Converter")
    print(f"{'='*60}")
    print(f"Found {len(pdf_files)} PDF files to convert\n")

    conversions = []
    successful = 0
    failed = 0

    for i, pdf_file in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}] Processing: {pdf_file}")
        print("-" * 40)

        # Generate output name
        base_name = Path(pdf_file).stem
        output_name = f"{output_prefix}_{base_name}"

        try:
            # Convert PDF
            converter = PDFProcedureConverter(pdf_file, output_name, verbose=False)
            json_file, report_file = converter.convert()

            # Generate HTML
            html_file = generate_html_from_json(json_file)

            # Load JSON to get statistics
            with open(json_file, 'r') as f:
                data = json.load(f)

            # Calculate statistics
            total_warnings = sum(len(s.get('warnings', [])) for s in data['steps'])
            total_images = sum(len(s.get('images', [])) for s in data['steps'])
            avg_confidence = sum(s.get('confidence', 1.0) for s in data['steps']) / len(data['steps']) if data['steps'] else 0

            conversion_info = {
                'pdf_name': pdf_file,
                'title': data['title'],
                'output_name': output_name,
                'json_file': json_file,
                'html_file': html_file,
                'report_file': report_file,
                'total_steps': data['total_steps'],
                'total_images': total_images,
                'warnings': total_warnings,
                'errors': 0,
                'valid': total_warnings == 0,
                'avg_confidence': avg_confidence
            }

            conversions.append(conversion_info)
            successful += 1
            print(f"✅ Successfully converted: {data['title']}")

        except Exception as e:
            print(f"❌ Failed to convert {pdf_file}: {e}")
            failed += 1

            # Add failed conversion to list
            conversions.append({
                'pdf_name': pdf_file,
                'title': f"Failed: {base_name}",
                'output_name': output_name,
                'json_file': '',
                'html_file': '',
                'report_file': '',
                'total_steps': 0,
                'total_images': 0,
                'warnings': 0,
                'errors': 1,
                'valid': False,
                'avg_confidence': 0
            })

    # Create dashboard
    dashboard_file = create_dashboard(conversions)

    # Print summary
    print(f"\n{'='*60}")
    print("Batch Conversion Complete!")
    print(f"{'='*60}")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total procedures: {sum(c['total_steps'] for c in conversions)} steps")
    print(f"\n👉 Open {dashboard_file} to view the conversion dashboard")


def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description='Batch convert PDF procedures')
    parser.add_argument('--pattern', default='*.pdf', help='File pattern for PDFs (default: *.pdf)')
    parser.add_argument('--prefix', default='converted', help='Output file prefix (default: converted)')

    args = parser.parse_args()

    batch_convert(args.pattern, args.prefix)


if __name__ == "__main__":
    main()