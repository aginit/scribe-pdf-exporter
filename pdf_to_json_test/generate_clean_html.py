#!/usr/bin/env python3
"""
Clean HTML Generator for Procedure JSONs
No metadata text above images
"""

import json
import os


def generate_clean_html(json_file: str, output_html: str = None) -> str:
    """Generate clean HTML without metadata text above images"""
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

        .step-count {{
            font-size: 1.2em;
            opacity: 0.9;
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

        .step-description {{
            font-size: 1.2em;
            margin-top: 20px;
            margin-bottom: 25px;
            color: #2c3e50;
            font-weight: 500;
        }}

        .step-images {{
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
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

        @media (max-width: 768px) {{
            .container {{
                margin: 10px;
            }}

            h1 {{
                font-size: 1.8em;
            }}

            .steps-container {{
                padding: 20px;
            }}

            .step {{
                padding: 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{data['title']}</h1>
            <div class="step-count">Total Steps: {data['total_steps']}</div>
        </div>

        <div class="steps-container">
"""

    for step in data['steps']:
        html_content += f"""
            <div class="step">
                <div class="step-number">{step['step_number']}</div>
                <div class="step-description">{step['description']}</div>
"""

        # Add images WITHOUT the metadata text
        if step.get('images'):
            html_content += '                <div class="step-images">\n'
            for image in step['images']:
                html_content += f"""                    <img src="{image['path']}" alt="Step {step['step_number']}"
                         class="step-image" onclick="openModal(this.src)">
"""
            html_content += '                </div>\n'

        html_content += """            </div>
"""

    html_content += """
        </div>

        <div class="navigation">
            <a href="index.html" class="nav-button">📚 Back to Procedures</a>
        </div>
    </div>

    <div id="imageModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImage">
    </div>

    <script>
        function openModal(src) {
            document.getElementById('imageModal').style.display = "block";
            document.getElementById('modalImage').src = src;
        }

        function closeModal() {
            document.getElementById('imageModal').style.display = "none";
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });

        document.getElementById('imageModal').onclick = function(event) {
            if (event.target.id === 'imageModal') {
                closeModal();
            }
        }
    </script>
</body>
</html>
"""

    with open(output_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    return output_html


def main():
    """Generate clean HTML for the perfect JSON files"""
    print("Generating clean HTML without metadata text...")

    # Generate clean HTML for both procedures
    html1 = generate_clean_html('3cx_perfect.json', '3cx_clean.html')
    print(f"✅ {html1} (no metadata text)")

    html2 = generate_clean_html('twilio_perfect.json', 'twilio_clean.html')
    print(f"✅ {html2} (no metadata text)")

    print("\nClean HTML files generated successfully!")


if __name__ == "__main__":
    main()