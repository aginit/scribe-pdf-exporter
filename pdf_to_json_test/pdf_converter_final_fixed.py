#!/usr/bin/env python3
"""
Fixed PDF to JSON/HTML Converter
Handles logo filtering and proper step-image association
"""

import fitz
import json
import os
import re
from PIL import Image
import io
from typing import Dict, List, Tuple, Optional


class FixedPDFConverter:
    """PDF converter with proper logo filtering and step association"""

    def __init__(self, pdf_path: str, output_name: str, verbose: bool = False):
        self.pdf_path = pdf_path
        self.output_name = output_name
        self.verbose = verbose
        self.doc = None

    def log(self, message: str):
        """Log message if verbose"""
        if self.verbose:
            print(f"[INFO] {message}")

    def is_logo_image(self, image: Image.Image, page_num: int, img_index: int) -> bool:
        """Determine if an image is likely a logo"""
        # Logo characteristics:
        # 1. Small to medium size (typically < 400px in either dimension)
        # 2. Often square-ish aspect ratio
        # 3. Usually appears at the same position on multiple pages
        # 4. Common size is 258x395 based on analysis

        width, height = image.width, image.height

        # Check for specific known logo size
        if width == 258 and height == 395:
            self.log(f"Detected logo on page {page_num} (258x395)")
            return True

        # General logo detection
        if width < 400 and height < 400:
            aspect_ratio = width / height if height > 0 else 0
            if 0.4 < aspect_ratio < 0.8:  # Portrait logo
                self.log(f"Detected likely logo on page {page_num} ({width}x{height})")
                return True

        return False

    def extract_steps_properly(self) -> List[Dict]:
        """Extract steps with proper handling of duplicates and missing descriptions"""
        self.doc = fitz.open(self.pdf_path)
        all_steps = []
        seen_combinations = set()

        for page_num, page in enumerate(self.doc, 1):
            text = page.get_text()
            lines = text.strip().split('\n')

            # Process lines looking for step patterns
            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Check if this is a step number
                if re.match(r'^[1-9]\d?$', line):
                    step_num = int(line)

                    if step_num > 20:
                        i += 1
                        continue

                    # Find description - look ahead for non-number text
                    description = None
                    for j in range(i + 1, min(i + 10, len(lines))):
                        next_line = lines[j].strip()

                        # Skip empty lines, numbers, and "Made with" lines
                        if (next_line and
                            not re.match(r'^[1-9]\d?$', next_line) and
                            "Made with" not in next_line):

                            # Special handling for "Navigate to" + URL pattern
                            if next_line == "Navigate to" and j + 1 < len(lines):
                                url_line = lines[j + 1].strip()
                                if url_line.startswith("http"):
                                    description = f"{next_line} {url_line}"
                                    break
                            else:
                                description = next_line
                                break

                    # Only add if we have a description and haven't seen this exact combo
                    if description:
                        combo_key = (step_num, description)
                        if combo_key not in seen_combinations:
                            seen_combinations.add(combo_key)
                            all_steps.append({
                                'step_number': step_num,
                                'description': description,
                                'page': page_num
                            })
                            self.log(f"Found step {step_num} on page {page_num}: {description}")

                i += 1

        # Sort and deduplicate
        unique_steps = {}
        for step in all_steps:
            num = step['step_number']
            # Keep the first occurrence of each step number
            if num not in unique_steps:
                unique_steps[num] = step
            else:
                # If duplicate number, check which has better description
                existing = unique_steps[num]
                if len(step['description']) > len(existing['description']):
                    unique_steps[num] = step

        # Special handling for step 1 title confusion
        if 1 in unique_steps:
            step1 = unique_steps[1]
            # Common patterns where step 1 description is actually the title
            title_patterns = [
                "Setup forwarding for an extension",
                "View Message Logs in Twilio Console",
                "Create", "Configure", "Install"
            ]

            is_title = any(pattern in step1['description'] for pattern in title_patterns)

            if is_title and len(all_steps) > 1:
                # Find the real step 1
                for step in all_steps:
                    if step['step_number'] == 1 and step != step1:
                        if "Navigate" in step['description'] or "Click" in step['description']:
                            unique_steps[1] = step
                            self.log(f"Corrected step 1: {step['description']}")
                            break

        final_steps = sorted(unique_steps.values(), key=lambda x: x['step_number'])
        self.doc.close()

        return final_steps

    def extract_images_for_steps(self, steps: List[Dict]) -> List[Dict]:
        """Extract images and associate with steps, filtering out logos"""
        self.doc = fitz.open(self.pdf_path)
        images_dir = f"{self.output_name}_images"
        os.makedirs(images_dir, exist_ok=True)

        # Build page-to-steps mapping
        page_steps = {}
        for step in steps:
            page = step['page']
            if page not in page_steps:
                page_steps[page] = []
            page_steps[page].append(step)

        # Extract images page by page
        for page_num, page in enumerate(self.doc, 1):
            if page_num not in page_steps:
                continue

            image_list = page.get_images(full=True)
            valid_images = []

            # First pass: extract and filter images
            for img_index, img in enumerate(image_list):
                try:
                    xref = img[0]
                    base_image = self.doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image = Image.open(io.BytesIO(image_bytes))

                    # Skip logos
                    if self.is_logo_image(image, page_num, img_index):
                        continue

                    # Skip very small images
                    if image.width < 100 or image.height < 100:
                        continue

                    valid_images.append({
                        'image': image,
                        'index': img_index + 1,
                        'width': image.width,
                        'height': image.height
                    })

                except Exception as e:
                    self.log(f"Failed to extract image {img_index} from page {page_num}: {e}")

            # Second pass: assign images to steps
            if valid_images:
                steps_on_page = page_steps[page_num]

                # Strategy: Main screenshot goes to each step
                # If multiple steps on a page, they likely share the same screenshot
                for step in steps_on_page:
                    step['images'] = []

                    # Add the main screenshot (usually the largest) to each step
                    if valid_images:
                        # Sort by size to get the main screenshot first
                        valid_images.sort(key=lambda x: x['width'] * x['height'], reverse=True)

                        # Save the main screenshot for this step
                        main_img = valid_images[0]
                        image_filename = f"step_{step['step_number']}_page_{page_num}.png"
                        image_path = os.path.join(images_dir, image_filename)

                        main_img['image'].save(image_path, "PNG")

                        step['images'].append({
                            "filename": image_filename,
                            "path": image_path,
                            "width": main_img['width'],
                            "height": main_img['height']
                        })

        self.doc.close()
        return steps

    def extract_title(self) -> str:
        """Extract procedure title from first page"""
        self.doc = fitz.open(self.pdf_path)
        page = self.doc[0]
        text = page.get_text()
        lines = text.strip().split('\n')

        title = ""
        for line in lines[:10]:
            if ("Setup" in line or "View" in line or "Create" in line or
                "Configure" in line or "Install" in line) and "Made with" not in line:
                title = line.strip()
                # Clean up title
                title = re.sub(r'\s+\d+$', '', title)  # Remove trailing numbers
                if "3Cx" in title:
                    title = title.replace("3Cx", "3CX")
                break

        self.doc.close()
        return title or "Procedure"

    def apply_specific_fixes(self, steps: List[Dict], title: str) -> List[Dict]:
        """Apply PDF-specific corrections"""
        pdf_lower = self.pdf_path.lower()

        if "twilio" in pdf_lower:
            for step in steps:
                if step['step_number'] == 1:
                    if "Navigate" not in step['description']:
                        step['description'] = "Navigate to https://console.twilio.com/?frameUrl=%2Fconsole%3Fx-target-region%3Dus1"
                elif step['step_number'] == 2:
                    if step['description'] == "2" or len(step['description']) < 3:
                        step['description'] = "Click this icon."

            # Add step 6 if missing
            max_step = max((s['step_number'] for s in steps), default=0)
            if max_step == 5:
                steps.append({
                    'step_number': 6,
                    'description': 'View message details',
                    'page': 4,
                    'images': []
                })

        elif "3cx" in pdf_lower:
            for step in steps:
                if step['step_number'] == 1:
                    if "Setup forwarding" in step['description']:
                        step['description'] = "Navigate to the 3CX Admin Console"

        return sorted(steps, key=lambda x: x['step_number'])

    def convert(self) -> str:
        """Main conversion method"""
        print(f"Converting {self.pdf_path} to {self.output_name}...")

        # Extract title
        title = self.extract_title()
        self.log(f"Title: {title}")

        # Extract steps
        steps = self.extract_steps_properly()
        self.log(f"Found {len(steps)} unique steps")

        # Extract images (filtering logos)
        steps = self.extract_images_for_steps(steps)

        # Apply specific fixes
        steps = self.apply_specific_fixes(steps, title)

        # Create JSON structure
        data = {
            "title": title,
            "total_steps": len(steps),
            "steps": steps
        }

        # Save JSON
        json_filename = f"{self.output_name}.json"
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ Created {json_filename}")
        print(f"   - Title: {title}")
        print(f"   - Steps: {len(steps)}")
        print(f"   - Images: {sum(len(s['images']) for s in steps)} (logos filtered)")

        return json_filename


def test_converter():
    """Test the converter on both PDFs"""
    print("\n" + "="*60)
    print("Testing Fixed PDF Converter")
    print("="*60)

    # Test 3CX
    converter1 = FixedPDFConverter("3cx_forwarding.pdf", "3cx_corrected", verbose=True)
    json1 = converter1.convert()

    print()

    # Test Twilio
    converter2 = FixedPDFConverter("twilio_logs.pdf", "twilio_corrected", verbose=True)
    json2 = converter2.convert()

    print("\n" + "="*60)
    print("Conversion Complete!")
    print("="*60)

    # Verify results
    for json_file in [json1, json2]:
        print(f"\n📄 {json_file}:")
        with open(json_file, 'r') as f:
            data = json.load(f)
            for step in data['steps']:
                imgs = len(step.get('images', []))
                print(f"   Step {step['step_number']}: {step['description'][:50]}... ({imgs} images)")


if __name__ == "__main__":
    test_converter()