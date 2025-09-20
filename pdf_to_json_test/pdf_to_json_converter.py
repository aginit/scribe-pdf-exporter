import fitz
import json
import os
from PIL import Image
import io

def extract_pdf_to_json(pdf_path, output_name):
    doc = fitz.open(pdf_path)

    procedure_data = {
        "title": "",
        "total_steps": 0,
        "steps": []
    }

    images_dir = f"{output_name}_images"
    os.makedirs(images_dir, exist_ok=True)

    step_counter = 0
    current_step = None

    for page_num, page in enumerate(doc, 1):
        text = page.get_text()
        lines = text.strip().split('\n')

        if page_num == 1 and lines:
            for line in lines:
                if "Setup forwarding" in line or "View message logs" in line:
                    procedure_data["title"] = line.strip()
                    break

        for i, line in enumerate(lines):
            line = line.strip()

            if line and line[0].isdigit() and (len(line) > 1 and line[1].isspace() or line[1:3] == '  '):
                try:
                    step_num = int(line.split()[0])
                    step_text = ' '.join(line.split()[1:])

                    if current_step:
                        procedure_data["steps"].append(current_step)

                    step_counter += 1
                    current_step = {
                        "step_number": step_counter,
                        "description": step_text,
                        "page": page_num,
                        "images": []
                    }
                except:
                    continue

        image_list = page.get_images(full=True)
        for img_index, img in enumerate(image_list):
            xref = img[0]

            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]

                image = Image.open(io.BytesIO(image_bytes))

                if image.width > 100 and image.height > 100:
                    image_filename = f"step_{step_counter}_page_{page_num}_img_{img_index + 1}.png"
                    image_path = os.path.join(images_dir, image_filename)
                    image.save(image_path, "PNG")

                    if current_step:
                        current_step["images"].append({
                            "filename": image_filename,
                            "path": image_path,
                            "width": image.width,
                            "height": image.height
                        })
            except Exception as e:
                print(f"Could not extract image {img_index} from page {page_num}: {e}")

    if current_step:
        procedure_data["steps"].append(current_step)

    procedure_data["total_steps"] = len(procedure_data["steps"])

    doc.close()

    json_filename = f"{output_name}.json"
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(procedure_data, f, indent=2)

    return json_filename, images_dir

print("Converting 3CX Forwarding PDF...")
json1, imgs1 = extract_pdf_to_json("3cx_forwarding.pdf", "3cx_forwarding_procedure")
print(f"Created: {json1} and {imgs1}/")

print("\nConverting Twilio Logs PDF...")
json2, imgs2 = extract_pdf_to_json("twilio_logs.pdf", "twilio_logs_procedure")
print(f"Created: {json2} and {imgs2}/")

print("\nConversion complete!")