import fitz
import json
import os
from PIL import Image
import io
import re

def extract_pdf_to_json(pdf_path, output_name):
    doc = fitz.open(pdf_path)

    procedure_data = {
        "title": "",
        "total_steps": 0,
        "steps": []
    }

    images_dir = f"{output_name}_images"
    os.makedirs(images_dir, exist_ok=True)

    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        lines = text.strip().split('\n')

        if page_num == 1:
            for line in lines:
                if ("Setup forwarding" in line or "View Message Logs" in line) and "Made with" not in line:
                    procedure_data["title"] = line.strip()
                    break

        for i, line in enumerate(lines):
            line_stripped = line.strip()

            if re.match(r'^\d+$', line_stripped):
                step_num = int(line_stripped)

                if 0 < step_num < 20:
                    step_description = ""

                    for j in range(i + 1, min(i + 5, len(lines))):
                        next_line = lines[j].strip()
                        if next_line and not next_line.startswith("Made with"):
                            step_description = next_line
                            break

                    if not step_description:
                        continue

                    step_images = []
                    image_list = page.get_images(full=True)

                    for img_index, img in enumerate(image_list):
                        xref = img[0]

                        try:
                            base_image = doc.extract_image(xref)
                            image_bytes = base_image["image"]

                            image = Image.open(io.BytesIO(image_bytes))

                            if image.width > 100 and image.height > 100:
                                image_filename = f"step_{step_num}_page_{page_num}_img_{img_index + 1}.png"
                                image_path = os.path.join(images_dir, image_filename)

                                image.save(image_path, "PNG")

                                step_images.append({
                                    "filename": image_filename,
                                    "path": image_path,
                                    "width": image.width,
                                    "height": image.height
                                })
                        except Exception as e:
                            print(f"Could not extract image {img_index} from page {page_num}: {e}")

                    procedure_data["steps"].append({
                        "step_number": step_num,
                        "description": step_description,
                        "page": page_num,
                        "images": step_images
                    })

    procedure_data["steps"] = sorted(procedure_data["steps"], key=lambda x: x["step_number"])

    seen_steps = set()
    unique_steps = []
    for step in procedure_data["steps"]:
        if step["step_number"] not in seen_steps:
            seen_steps.add(step["step_number"])
            unique_steps.append(step)

    procedure_data["steps"] = unique_steps
    procedure_data["total_steps"] = len(procedure_data["steps"])

    doc.close()

    json_filename = f"{output_name}.json"
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(procedure_data, f, indent=2, ensure_ascii=False)

    return json_filename, images_dir

print("Converting 3CX Forwarding PDF...")
json1, imgs1 = extract_pdf_to_json("3cx_forwarding.pdf", "3cx_forwarding_converted")
print(f"Created: {json1} and {imgs1}/")

with open(json1, 'r') as f:
    data = json.load(f)
    print(f"  - Title: {data['title']}")
    print(f"  - Total steps: {data['total_steps']}")
    for step in data['steps']:
        desc = step['description'][:60] if len(step['description']) > 60 else step['description']
        print(f"    Step {step['step_number']}: {desc} ({len(step['images'])} images)")

print("\nConverting Twilio Logs PDF...")
json2, imgs2 = extract_pdf_to_json("twilio_logs.pdf", "twilio_logs_converted")
print(f"Created: {json2} and {imgs2}/")

with open(json2, 'r') as f:
    data = json.load(f)
    print(f"  - Title: {data['title']}")
    print(f"  - Total steps: {data['total_steps']}")
    for step in data['steps']:
        desc = step['description'][:60] if len(step['description']) > 60 else step['description']
        print(f"    Step {step['step_number']}: {desc} ({len(step['images'])} images)")

print("\nConversion complete!")