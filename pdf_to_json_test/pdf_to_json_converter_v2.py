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

    all_text = ""
    page_images = {}

    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        all_text += f"\n--- PAGE {page_num} ---\n{text}"

        page_images[page_num] = []
        image_list = page.get_images(full=True)

        for img_index, img in enumerate(image_list):
            xref = img[0]

            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]

                image = Image.open(io.BytesIO(image_bytes))

                if image.width > 100 and image.height > 100:
                    page_images[page_num].append({
                        "img_index": img_index + 1,
                        "image": image,
                        "image_bytes": image_bytes
                    })
            except Exception as e:
                print(f"Could not extract image {img_index} from page {page_num}: {e}")

    lines = all_text.split('\n')

    for line in lines[:20]:
        if "Setup forwarding" in line or "View Message Logs" in line:
            procedure_data["title"] = line.strip().replace("Made with Scribe - https://scribehow.com", "").strip()
            if procedure_data["title"].endswith(" 1"):
                procedure_data["title"] = procedure_data["title"][:-2]
            break

    step_pattern = re.compile(r'^(\d+)\s+(.+)$')
    current_page = 1

    for i, line in enumerate(lines):
        line = line.strip()

        if f"--- PAGE " in line:
            page_match = re.search(r'--- PAGE (\d+) ---', line)
            if page_match:
                current_page = int(page_match.group(1))

        match = step_pattern.match(line)
        if match and len(match.group(2)) > 2:
            step_num = int(match.group(1))
            step_text = match.group(2)

            if step_num > 0 and step_num < 20:
                step_images = []

                if current_page in page_images and page_images[current_page]:
                    for img_data in page_images[current_page]:
                        image_filename = f"step_{step_num}_page_{current_page}_img_{img_data['img_index']}.png"
                        image_path = os.path.join(images_dir, image_filename)

                        img_data['image'].save(image_path, "PNG")

                        step_images.append({
                            "filename": image_filename,
                            "path": image_path,
                            "width": img_data['image'].width,
                            "height": img_data['image'].height
                        })

                procedure_data["steps"].append({
                    "step_number": step_num,
                    "description": step_text,
                    "page": current_page,
                    "images": step_images
                })

    procedure_data["total_steps"] = len(procedure_data["steps"])

    doc.close()

    json_filename = f"{output_name}.json"
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(procedure_data, f, indent=2)

    return json_filename, images_dir

print("Converting 3CX Forwarding PDF...")
json1, imgs1 = extract_pdf_to_json("3cx_forwarding.pdf", "3cx_forwarding_final")
print(f"Created: {json1} and {imgs1}/")

with open(json1, 'r') as f:
    data = json.load(f)
    print(f"  - Title: {data['title']}")
    print(f"  - Total steps: {data['total_steps']}")
    for step in data['steps']:
        print(f"    Step {step['step_number']}: {step['description'][:50]}... ({len(step['images'])} images)")

print("\nConverting Twilio Logs PDF...")
json2, imgs2 = extract_pdf_to_json("twilio_logs.pdf", "twilio_logs_final")
print(f"Created: {json2} and {imgs2}/")

with open(json2, 'r') as f:
    data = json.load(f)
    print(f"  - Title: {data['title']}")
    print(f"  - Total steps: {data['total_steps']}")
    for step in data['steps']:
        print(f"    Step {step['step_number']}: {step['description'][:50]}... ({len(step['images'])} images)")

print("\nConversion complete!")