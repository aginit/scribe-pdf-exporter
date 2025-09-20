const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');
const { createCanvas } = require('canvas');

// Set up PDF.js with node environment
global.DOMParser = require('xmldom').DOMParser;
const pdfjs = require('pdfjs-dist/build/pdf.js');

async function convertPdfToStructuredFormat(pdfPath, outputDir) {
  try {
    const pdfName = path.basename(pdfPath, '.pdf');
    const cleanName = pdfName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    console.log(`\n🔄 Converting ${pdfName}...`);

    // Create output directories
    const imagesDir = path.join(outputDir, `${cleanName}_images`);
    await fs.ensureDir(imagesDir);

    // Step 1: Extract text content
    console.log('📝 Extracting text content...');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);

    // Step 2: Extract actual images from PDF using PDF.js
    console.log('🖼️  Extracting actual images from PDF...');
    let pageImages = [];

    try {
      const pdfDocument = await pdfjs.getDocument({
        data: dataBuffer,
        verbosity: 0
      }).promise;

      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        console.log(`📄 Processing page ${pageNum}...`);

        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        // Create canvas
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        // Render page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;

        // Save image
        const filename = `step_${pageNum}_page_${pageNum}.png`;
        const imagePath = path.join(imagesDir, filename);

        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(imagePath, buffer);

        console.log(`✅ Saved: ${filename}`);

        pageImages.push({
          page: pageNum,
          filename: filename,
          path: `${cleanName}_images/${filename}`,
          width: viewport.width,
          height: viewport.height,
          placeholder: false // Real image, not placeholder
        });
      }

      console.log(`✅ Extracted ${pageImages.length} page images`);

    } catch (imageError) {
      console.log(`⚠️  Image extraction failed: ${imageError.message}`);
      console.log('🔄 Falling back to placeholders...');

      // Fallback to placeholders
      for (let i = 1; i <= pdfData.numpages; i++) {
        const filename = `step_${i}_page_${i}.png`;
        pageImages.push({
          page: i,
          filename: filename,
          path: `${cleanName}_images/${filename}`,
          width: 1280,
          height: 713,
          placeholder: true
        });
      }
    }

    // Step 3: Parse content into high-quality structured format
    console.log('🔧 Creating polished structure...');
    const structured = parseContentIntoHighQualitySteps(pdfData.text, pdfName, pageImages);

    // Step 4: Generate JSON file
    const jsonPath = path.join(outputDir, `${cleanName}.json`);
    await fs.writeJson(jsonPath, structured, { spaces: 2 });
    console.log(`✅ JSON saved: ${jsonPath}`);

    // Step 5: Generate polished HTML file
    const htmlPath = path.join(outputDir, `${cleanName}.html`);
    const htmlContent = generatePolishedHtml(structured, cleanName);
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`✅ HTML saved: ${htmlPath}`);

    console.log(`\n✅ Polished conversion completed!`);
    console.log(`📊 Stats: ${pdfData.numpages} pages, ${structured.total_steps} steps, ${pageImages.length} images`);
    console.log(`📁 Outputs:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  HTML: ${htmlPath}`);
    console.log(`  Images: ${imagesDir}/ ${pageImages.some(img => !img.placeholder) ? '(actual screenshots)' : '(ready for screenshots)'}`);

    return structured;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

function extractCleanTitle(filename) {
  // Remove file extension and convert underscores to spaces
  let title = filename.replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim();

  console.log(`🏷️  Original title: "${title}"`);

  // Remove various metadata patterns
  title = title
    // Remove "X steps Y time ago" patterns
    .replace(/\s*\d+\s*steps?\s*\d+\s*(months?|years?|weeks?|days?)\s*ago.*/i, '')
    // Remove long numeric IDs at the end
    .replace(/\s*\d{10,}.*$/, '')
    // Remove "init consulting" and similar
    .replace(/\s*init\s*consulting.*$/i, '')
    // Remove "created by me"
    .replace(/\s*created\s*by\s*me\s*/i, ' ')
    // Remove usernames like "andrew greene"
    .replace(/\s*andrew\s*greene.*$/i, '')
    // Remove common prefixes
    .replace(/^(client[\s_]*software[\s_]*)+/i, 'Client Software ')
    .replace(/^(unsorted[\s_]*)+/i, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`🧹 After cleanup: "${title}"`);

  // Convert to title case
  title = title
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  console.log(`✨ Final title: "${title}"`);

  return title;
}

function parseContentIntoHighQualitySteps(text, filename, pageImages) {
  console.log('🔍 Analyzing text for polished step extraction...');

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log(`📖 Found ${lines.length} lines of text`);

  // Filter out noise and keep meaningful content
  const meaningfulLines = lines.filter(line => {
    return line.length > 3 &&
           !line.match(/^\d+$/) &&
           !line.match(/^page \d+/i) &&
           !line.match(/^scribe$/i) &&
           !line.match(/^\s*$/) &&
           !line.match(/^[^\w]*$/) &&
           line.length < 200; // Avoid very long lines that are likely noise
  });

  console.log(`🧹 Cleaned to ${meaningfulLines.length} meaningful lines`);

  // Create steps from meaningful content
  const steps = [];
  let currentPage = 1;

  meaningfulLines.forEach((line, index) => {
    // Skip lines that are just numbers or very short
    if (line.length < 5 || line.match(/^\d+$/)) return;

    // Determine which page this step belongs to (distribute evenly if unclear)
    const stepPage = Math.min(currentPage, pageImages.length);

    // Find corresponding images for this page
    const stepImages = pageImages.filter(img => img.page === stepPage);

    steps.push({
      step_number: steps.length + 1,
      description: line,
      page: stepPage,
      images: stepImages
    });

    // Advance page occasionally to distribute steps
    if ((index + 1) % Math.max(1, Math.floor(meaningfulLines.length / pageImages.length)) === 0) {
      currentPage = Math.min(currentPage + 1, pageImages.length);
    }
  });

  console.log(`✅ Created ${steps.length} polished steps`);

  return {
    title: extractCleanTitle(filename),
    total_steps: steps.length,
    steps: steps
  };
}

function generatePolishedHtml(data, cleanName) {
  const steps = data.steps.map(step => {
    const imageElements = step.images.map(img => {
      if (img.placeholder) {
        return `<div class="step-image placeholder">
                            📸 Screenshot for Step ${step.step_number}
                            <br><small>Image: ${img.filename}</small>
                        </div>`;
      } else {
        return `<img src="${img.path}" alt="Step ${step.step_number}" class="step-image" onclick="openModal('${img.path}')">`;
      }
    }).join('\n                    ');

    return `
            <div class="step">
                <div class="step-number">${step.step_number}</div>
                <div class="step-description">${step.description}</div>
                <div class="step-images">
                    ${imageElements}
                </div>
            </div>`;
  }).join('\n            ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .step-count {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .steps-container {
            padding: 40px;
        }

        .step {
            margin-bottom: 50px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 15px;
            position: relative;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .step:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .step-number {
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
        }

        .step-description {
            font-size: 1.2em;
            margin-top: 20px;
            margin-bottom: 25px;
            color: #2c3e50;
            font-weight: 500;
        }

        .step-images {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
        }

        .step-image {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            cursor: pointer;
        }

        .step-image:hover {
            transform: scale(1.02);
            box-shadow: 0 12px 30px rgba(0,0,0,0.25);
        }

        .step-image.placeholder {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            padding: 40px;
            text-align: center;
            color: #6c757d;
            font-style: italic;
            min-height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }

        .navigation {
            text-align: center;
            padding: 30px;
            background: #f8f9fa;
        }

        .nav-button {
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
        }

        .nav-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            padding-top: 50px;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
        }

        .modal-content {
            margin: auto;
            display: block;
            width: 90%;
            max-width: 1200px;
            border-radius: 10px;
        }

        .close {
            position: absolute;
            top: 20px;
            right: 35px;
            color: #f1f1f1;
            font-size: 40px;
            font-weight: bold;
            transition: 0.3s;
            cursor: pointer;
        }

        .close:hover {
            color: #bbb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.title}</h1>
            <div class="step-count">${data.total_steps} Steps</div>
        </div>

        <div class="steps-container">
            ${steps}
        </div>

        <div class="navigation">
            <a href="#" class="nav-button" onclick="window.print()">Print Guide</a>
            <a href="#" class="nav-button" onclick="window.scrollTo(0,0)">Back to Top</a>
        </div>
    </div>

    <!-- Image Modal -->
    <div id="imageModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImage">
    </div>

    <script>
        function openModal(src) {
            document.getElementById('imageModal').style.display = 'block';
            document.getElementById('modalImage').src = src;
        }

        function closeModal() {
            document.getElementById('imageModal').style.display = 'none';
        }

        // Close modal when clicking outside of image
        window.onclick = function(event) {
            const modal = document.getElementById('imageModal');
            if (event.target === modal) {
                closeModal();
            }
        }

        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });
    </script>
</body>
</html>`;
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node image-pdf-converter.js <pdf-file> [output-directory]');
    process.exit(1);
  }

  const pdfFile = args[0];
  const outputDir = args[1] || path.dirname(pdfFile);

  console.log('🚀 Starting image-enabled PDF conversion...');

  convertPdfToStructuredFormat(pdfFile, outputDir)
    .catch(error => {
      console.error('❌ Conversion failed:', error.message);
      process.exit(1);
    });
}

module.exports = { convertPdfToStructuredFormat };