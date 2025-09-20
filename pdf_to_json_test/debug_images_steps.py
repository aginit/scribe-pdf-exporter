import fitz
import json
from PIL import Image
import io

def detailed_pdf_analysis(pdf_path):
    """Detailed analysis of PDF structure, images, and steps"""
    doc = fitz.open(pdf_path)

    print(f"\n{'='*80}")
    print(f"DETAILED ANALYSIS: {pdf_path}")
    print(f"{'='*80}")

    all_steps = []
    all_images = []

    for page_num, page in enumerate(doc, 1):
        print(f"\n--- PAGE {page_num} ---")

        # Get text
        text = page.get_text()
        lines = text.strip().split('\n')

        # Show all text lines
        print("\nTEXT CONTENT:")
        for i, line in enumerate(lines):
            if line.strip():
                print(f"  Line {i:3}: '{line.strip()}'")

        # Extract images with details
        print("\nIMAGES ON THIS PAGE:")
        image_list = page.get_images(full=True)

        for img_index, img in enumerate(image_list):
            try:
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image = Image.open(io.BytesIO(image_bytes))

                print(f"  Image {img_index + 1}:")
                print(f"    - Size: {image.width}x{image.height}")
                print(f"    - Format: {image.format}")
                print(f"    - Mode: {image.mode}")

                # Check if it might be a logo (small, square-ish, at top)
                aspect_ratio = image.width / image.height if image.height > 0 else 0
                is_logo_candidate = (
                    image.width < 400 and
                    image.height < 400 and
                    0.5 < aspect_ratio < 2.0
                )

                if is_logo_candidate:
                    print(f"    - ⚠️  POSSIBLE LOGO (small square image)")

                all_images.append({
                    'page': page_num,
                    'index': img_index + 1,
                    'width': image.width,
                    'height': image.height,
                    'is_logo_candidate': is_logo_candidate
                })

            except Exception as e:
                print(f"    - Error extracting image {img_index + 1}: {e}")

        # Look for steps
        print("\nSTEPS DETECTED:")
        page_steps = []

        for i, line in enumerate(lines):
            line_stripped = line.strip()

            # Look for standalone numbers
            if line_stripped.isdigit():
                step_num = int(line_stripped)
                if 0 < step_num <= 20:
                    # Find the description
                    desc = None
                    desc_line_idx = None

                    for j in range(i+1, min(i+10, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and not next_line.isdigit() and "Made with" not in next_line:
                            desc = next_line
                            desc_line_idx = j
                            break

                    print(f"  Step {step_num}:")
                    print(f"    - Number at line {i}")
                    if desc:
                        print(f"    - Description at line {desc_line_idx}: '{desc}'")
                    else:
                        print(f"    - ⚠️  NO DESCRIPTION FOUND")

                    page_steps.append({
                        'number': step_num,
                        'description': desc,
                        'page': page_num,
                        'line': i
                    })

        all_steps.extend(page_steps)

    doc.close()

    # Analysis summary
    print(f"\n{'='*80}")
    print("SUMMARY ANALYSIS")
    print(f"{'='*80}")

    print(f"\nTotal pages: {len(all_images) if all_images else 0}")
    print(f"Total steps found: {len(all_steps)}")
    print(f"Total images: {len(all_images)}")

    # Logo candidates
    logo_candidates = [img for img in all_images if img['is_logo_candidate']]
    if logo_candidates:
        print(f"\n⚠️  POTENTIAL LOGOS DETECTED: {len(logo_candidates)}")
        for logo in logo_candidates:
            print(f"  - Page {logo['page']}, Image {logo['index']} ({logo['width']}x{logo['height']})")

    # Steps without descriptions
    no_desc_steps = [s for s in all_steps if not s['description']]
    if no_desc_steps:
        print(f"\n⚠️  STEPS WITHOUT DESCRIPTIONS: {len(no_desc_steps)}")
        for step in no_desc_steps:
            print(f"  - Step {step['number']} on page {step['page']}")

    # Duplicate step numbers
    step_numbers = {}
    for step in all_steps:
        num = step['number']
        if num not in step_numbers:
            step_numbers[num] = []
        step_numbers[num].append(step)

    duplicates = {num: steps for num, steps in step_numbers.items() if len(steps) > 1}
    if duplicates:
        print(f"\n⚠️  DUPLICATE STEP NUMBERS:")
        for num, steps in duplicates.items():
            print(f"  - Step {num} appears {len(steps)} times:")
            for step in steps:
                print(f"      Page {step['page']}: '{step['description']}'")

    return all_steps, all_images

# Analyze both PDFs
print("\n" + "="*100)
print("PDF IMAGE AND STEP ANALYSIS")
print("="*100)

steps1, images1 = detailed_pdf_analysis("3cx_forwarding.pdf")
print("\n" + "-"*100)
steps2, images2 = detailed_pdf_analysis("twilio_logs.pdf")