import fitz
import json
import re

def debug_pdf_structure(pdf_path):
    doc = fitz.open(pdf_path)

    print(f"\n{'='*60}")
    print(f"ANALYZING: {pdf_path}")
    print(f"{'='*60}")

    all_steps = []

    for page_num, page in enumerate(doc, 1):
        print(f"\n--- PAGE {page_num} ---")

        text = page.get_text()
        lines = text.strip().split('\n')

        # Show first 30 lines of each page to understand structure
        print(f"First 30 lines of page {page_num}:")
        for i, line in enumerate(lines[:30]):
            print(f"  Line {i:2}: '{line.strip()}'")

        # Look for step patterns
        print(f"\nStep patterns found on page {page_num}:")
        for i, line in enumerate(lines):
            line_stripped = line.strip()

            # Check for standalone numbers
            if re.match(r'^[1-9]\d?$', line_stripped):
                step_num = int(line_stripped)
                if step_num <= 20:
                    # Look for the description in the next few lines
                    desc = None
                    for j in range(i+1, min(i+10, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and not next_line.startswith("Made with") and len(next_line) > 3:
                            desc = next_line
                            break

                    print(f"  Found step {step_num}: '{desc}'")
                    all_steps.append({
                        "page": page_num,
                        "step_number": step_num,
                        "description": desc,
                        "line_index": i
                    })

        # Count images on this page
        image_list = page.get_images(full=True)
        print(f"\nImages on page {page_num}: {len(image_list)}")

    doc.close()

    # Show summary
    print(f"\n{'='*60}")
    print("SUMMARY OF STEPS FOUND:")
    print(f"{'='*60}")
    for step in sorted(all_steps, key=lambda x: x['step_number']):
        print(f"Step {step['step_number']} (Page {step['page']}): {step['description']}")

    return all_steps

# Debug both PDFs
print("\n" + "="*80)
print("PDF STRUCTURE ANALYSIS")
print("="*80)

steps1 = debug_pdf_structure("3cx_forwarding.pdf")
steps2 = debug_pdf_structure("twilio_logs.pdf")

# Compare with our JSON output
print("\n" + "="*80)
print("COMPARING WITH CONVERTED JSON")
print("="*80)

def compare_with_json(json_file, original_steps):
    print(f"\n--- {json_file} ---")
    with open(json_file, 'r') as f:
        data = json.load(f)

    print(f"Title in JSON: '{data['title']}'")
    print(f"Steps in JSON: {len(data['steps'])}")

    print("\nComparison:")
    for step in data['steps']:
        print(f"  Step {step['step_number']}: '{step['description']}'")
        # Find matching original
        orig = next((s for s in original_steps if s['step_number'] == step['step_number']), None)
        if orig and orig['description'] != step['description']:
            print(f"    ⚠️  MISMATCH - Original was: '{orig['description']}'")

    # Check for missing steps
    json_step_nums = {s['step_number'] for s in data['steps']}
    orig_step_nums = {s['step_number'] for s in original_steps}

    missing = orig_step_nums - json_step_nums
    if missing:
        print(f"\n⚠️  Missing steps in JSON: {missing}")

compare_with_json("3cx_forwarding_converted.json", steps1)
compare_with_json("twilio_logs_converted.json", steps2)