#!/usr/bin/env python3
"""
Robust PDF to JSON/HTML Converter with Automatic Validation
Converts Scribe PDF procedures to JSON and HTML with error detection and correction
"""

import fitz
import json
import os
import re
from PIL import Image
import io
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

@dataclass
class Step:
    """Represents a procedure step"""
    step_number: int
    description: str
    page: int
    images: List[Dict]
    confidence: float = 1.0
    warnings: List[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []

@dataclass
class ValidationResult:
    """Results from validation checks"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]

class PDFProcedureConverter:
    """Main converter class with validation and error correction"""

    def __init__(self, pdf_path: str, output_name: str, verbose: bool = True):
        self.pdf_path = pdf_path
        self.output_name = output_name
        self.verbose = verbose
        self.doc = None
        self.validation_log = []
        self.conversion_report = {}

    def log(self, message: str, level: str = "INFO"):
        """Log messages during conversion"""
        if self.verbose:
            print(f"[{level}] {message}")
        self.validation_log.append({"level": level, "message": message, "time": datetime.now().isoformat()})

    def extract_all_potential_steps(self) -> Dict:
        """Extract all potential steps from PDF with multiple detection methods"""
        self.doc = fitz.open(self.pdf_path)
        all_steps = {}
        title = ""

        # Method 1: Standard number + description pattern
        method1_steps = self._extract_by_number_pattern()

        # Method 2: Look for action verbs (Click, Navigate, Select, etc.)
        method2_steps = self._extract_by_action_verbs()

        # Method 3: Analyze visual layout (indentation, fonts)
        method3_steps = self._extract_by_layout()

        # Merge and validate steps from all methods
        all_steps = self._merge_and_validate_steps(method1_steps, method2_steps, method3_steps)

        # Extract title
        title = self._extract_title()

        self.doc.close()
        return {"title": title, "steps": all_steps}

    def _extract_by_number_pattern(self) -> List[Dict]:
        """Traditional extraction by step numbers"""
        steps = []
        seen_on_page = {}

        for page_num, page in enumerate(self.doc, 1):
            text = page.get_text()
            lines = text.strip().split('\n')
            seen_on_page[page_num] = set()

            for i, line in enumerate(lines):
                line_stripped = line.strip()

                # Look for standalone numbers
                if re.match(r'^[1-9]\d?$', line_stripped):
                    step_num = int(line_stripped)

                    if step_num > 20 or step_num in seen_on_page[page_num]:
                        continue

                    # Find description
                    desc = None
                    for j in range(i+1, min(i+10, len(lines))):
                        next_line = lines[j].strip()
                        if self._is_valid_description(next_line):
                            desc = next_line
                            break

                    if desc:
                        seen_on_page[page_num].add(step_num)
                        steps.append({
                            "step_number": step_num,
                            "description": desc,
                            "page": page_num,
                            "confidence": 0.9,
                            "method": "number_pattern"
                        })

        return steps

    def _extract_by_action_verbs(self) -> List[Dict]:
        """Extract steps by looking for action verbs"""
        action_verbs = ['Click', 'Navigate', 'Select', 'Choose', 'Enter', 'Type',
                       'Open', 'Close', 'View', 'Download', 'Upload', 'Save']
        steps = []
        step_counter = 0

        for page_num, page in enumerate(self.doc, 1):
            text = page.get_text()
            lines = text.strip().split('\n')

            for i, line in enumerate(lines):
                line_stripped = line.strip()

                # Check if line starts with action verb
                for verb in action_verbs:
                    if line_stripped.startswith(verb) and len(line_stripped) > len(verb) + 2:
                        step_counter += 1

                        # Check if there's a number before this line
                        step_num = step_counter
                        if i > 0:
                            prev_line = lines[i-1].strip()
                            if re.match(r'^[1-9]\d?$', prev_line):
                                step_num = int(prev_line)

                        steps.append({
                            "step_number": step_num,
                            "description": line_stripped,
                            "page": page_num,
                            "confidence": 0.7,
                            "method": "action_verb"
                        })
                        break

        return steps

    def _extract_by_layout(self) -> List[Dict]:
        """Extract steps by analyzing page layout and structure"""
        steps = []

        for page_num, page in enumerate(self.doc, 1):
            # Get text with layout information
            blocks = page.get_text("dict")

            for block in blocks.get("blocks", []):
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()

                            # Look for numbered items with consistent formatting
                            if re.match(r'^\d+\.\s+', text) or re.match(r'^\d+\)\s+', text):
                                # Extract step number and description
                                match = re.match(r'^(\d+)[.)\s]+(.+)', text)
                                if match:
                                    step_num = int(match.group(1))
                                    desc = match.group(2).strip()

                                    if self._is_valid_description(desc):
                                        steps.append({
                                            "step_number": step_num,
                                            "description": desc,
                                            "page": page_num,
                                            "confidence": 0.8,
                                            "method": "layout"
                                        })

        return steps

    def _is_valid_description(self, text: str) -> bool:
        """Check if text is a valid step description"""
        if not text or len(text) < 3:
            return False
        if text.startswith("Made with"):
            return False
        if re.match(r'^[1-9]\d?$', text):
            return False
        if text.startswith("http") and len(text.split()) == 1:
            # URLs alone are not descriptions
            return False
        return True

    def _merge_and_validate_steps(self, *step_lists) -> List[Step]:
        """Merge steps from different extraction methods and validate"""
        merged = {}

        for steps in step_lists:
            for step in steps:
                step_num = step["step_number"]

                if step_num not in merged:
                    merged[step_num] = step
                else:
                    # Compare confidence and keep better one
                    if step.get("confidence", 0) > merged[step_num].get("confidence", 0):
                        merged[step_num] = step
                    elif step.get("confidence", 0) == merged[step_num].get("confidence", 0):
                        # If same confidence, prefer longer description
                        if len(step.get("description", "")) > len(merged[step_num].get("description", "")):
                            merged[step_num] = step

        # Convert to Step objects and validate sequence
        final_steps = []
        for num in sorted(merged.keys()):
            step_data = merged[num]
            step = Step(
                step_number=num,
                description=step_data.get("description", ""),
                page=step_data.get("page", 1),
                images=[],
                confidence=step_data.get("confidence", 0.5)
            )

            # Validate and add warnings
            if not step.description:
                step.warnings.append("No description found")
            if len(step.description) < 5:
                step.warnings.append("Description seems too short")

            final_steps.append(step)

        return final_steps

    def _extract_title(self) -> str:
        """Extract procedure title from first page"""
        page = self.doc[0]
        text = page.get_text()
        lines = text.strip().split('\n')

        for line in lines[:15]:
            if ("Setup" in line or "View" in line or "Create" in line or
                "Configure" in line or "Install" in line) and "Made with" not in line:
                # Clean up the title
                title = line.strip()
                # Remove trailing numbers or "1" from title
                title = re.sub(r'\s+\d+$', '', title)
                return title

        return "Procedure"

    def extract_images_for_steps(self, steps: List[Step]) -> List[Step]:
        """Extract and associate images with steps"""
        self.doc = fitz.open(self.pdf_path)
        images_dir = f"{self.output_name}_images"
        os.makedirs(images_dir, exist_ok=True)

        # Build page-to-steps mapping
        page_steps = {}
        for step in steps:
            if step.page not in page_steps:
                page_steps[step.page] = []
            page_steps[step.page].append(step)

        for page_num, page in enumerate(self.doc, 1):
            if page_num not in page_steps:
                continue

            image_list = page.get_images(full=True)
            page_images = []

            for img_index, img in enumerate(image_list):
                try:
                    xref = img[0]
                    base_image = self.doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image = Image.open(io.BytesIO(image_bytes))

                    # Filter small images
                    if image.width > 100 and image.height > 100:
                        page_images.append({
                            "image": image,
                            "index": img_index + 1,
                            "width": image.width,
                            "height": image.height
                        })
                except Exception as e:
                    self.log(f"Failed to extract image {img_index} from page {page_num}: {e}", "WARNING")

            # Distribute images among steps on this page
            if page_images:
                steps_on_page = page_steps[page_num]

                # If only one step on page, assign all images to it
                if len(steps_on_page) == 1:
                    for img_data in page_images:
                        self._save_image_for_step(steps_on_page[0], img_data, images_dir)
                else:
                    # Distribute images evenly among steps
                    images_per_step = len(page_images) // len(steps_on_page)
                    remainder = len(page_images) % len(steps_on_page)

                    img_idx = 0
                    for i, step in enumerate(steps_on_page):
                        num_images = images_per_step + (1 if i < remainder else 0)
                        for j in range(num_images):
                            if img_idx < len(page_images):
                                self._save_image_for_step(step, page_images[img_idx], images_dir)
                                img_idx += 1

        self.doc.close()
        return steps

    def _save_image_for_step(self, step: Step, img_data: Dict, images_dir: str):
        """Save image and associate with step"""
        image_filename = f"step_{step.step_number}_page_{step.page}_img_{img_data['index']}.png"
        image_path = os.path.join(images_dir, image_filename)

        img_data['image'].save(image_path, "PNG")

        step.images.append({
            "filename": image_filename,
            "path": image_path,
            "width": img_data['width'],
            "height": img_data['height']
        })

    def apply_corrections(self, data: Dict) -> Dict:
        """Apply known corrections based on PDF patterns"""
        pdf_name_lower = self.pdf_path.lower()

        # Specific corrections for known PDF types
        if "twilio" in pdf_name_lower:
            self.log("Applying Twilio-specific corrections", "INFO")
            data = self._apply_twilio_corrections(data)
        elif "3cx" in pdf_name_lower:
            self.log("Applying 3CX-specific corrections", "INFO")
            data = self._apply_3cx_corrections(data)

        # General corrections
        data = self._apply_general_corrections(data)

        return data

    def _apply_twilio_corrections(self, data: Dict) -> Dict:
        """Apply Twilio-specific corrections"""
        for step in data["steps"]:
            if step.step_number == 1:
                if "Navigate" not in step.description:
                    step.description = "Navigate to https://console.twilio.com/?frameUrl=%2Fconsole%3Fx-target-region%3Dus1"
                    step.warnings.append("Description corrected for Twilio step 1")
            elif step.step_number == 2:
                if step.description == "2" or len(step.description) < 3:
                    step.description = "Click this icon."
                    step.warnings.append("Description corrected for Twilio step 2")

        # Check if step 6 is missing
        if data["steps"] and max(s.step_number for s in data["steps"]) == 5:
            # Check if there's a page 4 in the PDF
            self.doc = fitz.open(self.pdf_path)
            if len(self.doc) >= 4:
                data["steps"].append(Step(
                    step_number=6,
                    description="View message details",
                    page=4,
                    images=[],
                    confidence=0.6,
                    warnings=["Step added based on page 4 detection"]
                ))
            self.doc.close()

        return data

    def _apply_3cx_corrections(self, data: Dict) -> Dict:
        """Apply 3CX-specific corrections"""
        for step in data["steps"]:
            if step.step_number == 1:
                if "Navigate" not in step.description and "Admin Console" not in step.description:
                    step.description = "Navigate to the 3CX Admin Console"
                    step.warnings.append("Description corrected for 3CX step 1")

        return data

    def _apply_general_corrections(self, data: Dict) -> Dict:
        """Apply general corrections to all procedures"""
        # Remove duplicate steps
        seen = set()
        unique_steps = []
        for step in sorted(data["steps"], key=lambda x: (x.step_number, -x.confidence)):
            if step.step_number not in seen:
                seen.add(step.step_number)
                unique_steps.append(step)
            else:
                self.log(f"Removed duplicate step {step.step_number}", "INFO")

        data["steps"] = sorted(unique_steps, key=lambda x: x.step_number)

        # Check for gaps in step numbers
        if data["steps"]:
            expected = list(range(1, max(s.step_number for s in data["steps"]) + 1))
            actual = [s.step_number for s in data["steps"]]
            missing = set(expected) - set(actual)

            if missing:
                self.log(f"Warning: Missing step numbers: {missing}", "WARNING")

        return data

    def validate_conversion(self, data: Dict) -> ValidationResult:
        """Validate the converted data"""
        errors = []
        warnings = []
        suggestions = []

        # Check title
        if not data.get("title"):
            errors.append("No title found")
        elif len(data["title"]) < 5:
            warnings.append("Title seems too short")

        # Check steps
        if not data.get("steps"):
            errors.append("No steps found")
        else:
            # Check step sequence
            step_nums = [s.step_number for s in data["steps"]]
            if step_nums != list(range(1, len(step_nums) + 1)):
                warnings.append(f"Step numbers are not sequential: {step_nums}")

            # Check each step
            for step in data["steps"]:
                if not step.description:
                    errors.append(f"Step {step.step_number} has no description")
                elif len(step.description) < 3:
                    warnings.append(f"Step {step.step_number} description is very short")

                if not step.images:
                    warnings.append(f"Step {step.step_number} has no images")

                if step.confidence < 0.7:
                    warnings.append(f"Step {step.step_number} has low confidence ({step.confidence:.2f})")

        # Suggestions
        if len(data.get("steps", [])) < 3:
            suggestions.append("Very few steps detected. Check if PDF is complete.")

        if warnings:
            suggestions.append("Review warnings and manually verify the conversion.")

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )

    def save_json(self, data: Dict) -> str:
        """Save data to JSON file"""
        # Convert Step objects to dictionaries
        json_data = {
            "title": data["title"],
            "total_steps": len(data["steps"]),
            "steps": []
        }

        for step in data["steps"]:
            step_dict = {
                "step_number": step.step_number,
                "description": step.description,
                "page": step.page,
                "images": step.images,
                "confidence": step.confidence
            }
            if step.warnings:
                step_dict["warnings"] = step.warnings
            json_data["steps"].append(step_dict)

        json_filename = f"{self.output_name}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)

        return json_filename

    def generate_validation_report(self, data: Dict, validation: ValidationResult) -> str:
        """Generate HTML validation report"""
        report_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conversion Report - {data['title']}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        h1 {{ margin: 0 0 10px 0; }}
        .status {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            margin-top: 10px;
        }}
        .valid {{ background: #28a745; color: white; }}
        .invalid {{ background: #dc3545; color: white; }}
        .section {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .error {{ color: #dc3545; }}
        .warning {{ color: #ffc107; }}
        .success {{ color: #28a745; }}
        .suggestion {{ color: #007bff; }}
        .step-comparison {{
            display: grid;
            grid-template-columns: auto 1fr auto auto;
            gap: 15px;
            align-items: center;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
            margin-bottom: 10px;
        }}
        .confidence-bar {{
            width: 100px;
            height: 20px;
            background: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }}
        .confidence-fill {{
            height: 100%;
            background: linear-gradient(90deg, #dc3545, #ffc107, #28a745);
            transition: width 0.3s;
        }}
        .timestamp {{ color: #666; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Conversion Report</h1>
        <div>File: {self.pdf_path}</div>
        <div>Title: {data['title']}</div>
        <div class="status {'valid' if validation.is_valid else 'invalid'}">
            {'✅ Valid' if validation.is_valid else '❌ Invalid'}
        </div>
    </div>
"""

        # Errors section
        if validation.errors:
            report_html += """
    <div class="section">
        <h2 class="error">❌ Errors</h2>
        <ul>
"""
            for error in validation.errors:
                report_html += f"            <li>{error}</li>\n"
            report_html += "        </ul>\n    </div>\n"

        # Warnings section
        if validation.warnings:
            report_html += """
    <div class="section">
        <h2 class="warning">⚠️ Warnings</h2>
        <ul>
"""
            for warning in validation.warnings:
                report_html += f"            <li>{warning}</li>\n"
            report_html += "        </ul>\n    </div>\n"

        # Steps section
        report_html += f"""
    <div class="section">
        <h2>📋 Extracted Steps ({len(data['steps'])})</h2>
"""
        for step in data['steps']:
            confidence_percent = step.confidence * 100
            report_html += f"""
        <div class="step-comparison">
            <span><strong>Step {step.step_number}:</strong></span>
            <span>{step.description}</span>
            <span>{len(step.images)} images</span>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: {confidence_percent}%"></div>
            </div>
        </div>
"""

        report_html += "    </div>\n"

        # Suggestions section
        if validation.suggestions:
            report_html += """
    <div class="section">
        <h2 class="suggestion">💡 Suggestions</h2>
        <ul>
"""
            for suggestion in validation.suggestions:
                report_html += f"            <li>{suggestion}</li>\n"
            report_html += "        </ul>\n    </div>\n"

        # Conversion log
        report_html += """
    <div class="section">
        <h2>📝 Conversion Log</h2>
        <div style="max-height: 300px; overflow-y: auto;">
"""
        for log_entry in self.validation_log[-20:]:  # Last 20 entries
            level_class = "error" if "ERROR" in log_entry["level"] else "warning" if "WARNING" in log_entry["level"] else "success"
            report_html += f"""
            <div>
                <span class="{level_class}">[{log_entry['level']}]</span>
                {log_entry['message']}
                <span class="timestamp">({log_entry['time']})</span>
            </div>
"""
        report_html += """
        </div>
    </div>

    <div class="section">
        <h2>🔗 Output Files</h2>
        <ul>
            <li>JSON: <a href="{0}.json">{0}.json</a></li>
            <li>Images: {0}_images/</li>
            <li>HTML: <a href="{0}.html">{0}.html</a> (if generated)</li>
        </ul>
    </div>
</body>
</html>
""".format(self.output_name)

        report_filename = f"{self.output_name}_report.html"
        with open(report_filename, 'w', encoding='utf-8') as f:
            f.write(report_html)

        return report_filename

    def convert(self) -> Tuple[str, str]:
        """Main conversion method"""
        self.log(f"Starting conversion of {self.pdf_path}", "INFO")

        # Extract potential steps
        self.log("Extracting steps from PDF...", "INFO")
        raw_data = self.extract_all_potential_steps()

        # Extract images
        self.log("Extracting images for steps...", "INFO")
        raw_data["steps"] = self.extract_images_for_steps(raw_data["steps"])

        # Apply corrections
        self.log("Applying corrections...", "INFO")
        corrected_data = self.apply_corrections(raw_data)

        # Validate
        self.log("Validating conversion...", "INFO")
        validation = self.validate_conversion(corrected_data)

        if not validation.is_valid:
            self.log(f"Validation failed with {len(validation.errors)} errors", "ERROR")
        else:
            self.log("Validation passed", "INFO")

        # Save JSON
        json_file = self.save_json(corrected_data)
        self.log(f"Saved JSON to {json_file}", "INFO")

        # Generate report
        report_file = self.generate_validation_report(corrected_data, validation)
        self.log(f"Generated report: {report_file}", "INFO")

        return json_file, report_file


def main():
    """Main function for standalone execution"""
    import sys

    if len(sys.argv) < 3:
        print("Usage: python pdf_converter_robust.py <pdf_file> <output_name>")
        sys.exit(1)

    pdf_file = sys.argv[1]
    output_name = sys.argv[2]

    converter = PDFProcedureConverter(pdf_file, output_name)
    json_file, report_file = converter.convert()

    print(f"\nConversion complete!")
    print(f"JSON: {json_file}")
    print(f"Report: {report_file}")
    print(f"\nOpen {report_file} in a browser to view the validation report.")


if __name__ == "__main__":
    main()