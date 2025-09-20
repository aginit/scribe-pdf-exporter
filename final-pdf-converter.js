const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');
const pdfPoppler = require('pdf-poppler');

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

    // Step 2: Extract actual images from PDF pages
    console.log('🖼️  Extracting actual screenshots...');
    let pageImages = [];

    try {
      const options = {
        format: 'png',
        out_dir: imagesDir,
        out_prefix: 'step',
        page: null, // Convert all pages
        scale: 1536 // High resolution
      };

      const imageFiles = await pdfPoppler.convert(pdfPath, options);
      console.log(`📸 Successfully extracted ${imageFiles ? imageFiles.length : pdfData.numpages} page images`);

      // Create image metadata
      for (let i = 1; i <= pdfData.numpages; i++) {
        const filename = `step-${i}.png`;
        const filePath = path.join(imagesDir, filename);

        // Check if file was actually created
        if (await fs.pathExists(filePath)) {
          pageImages.push({
            page: i,
            filename: filename,
            path: `${cleanName}_images/${filename}`,
            width: 1280,
            height: 713,
            placeholder: false
          });
          console.log(`  ✅ Page ${i} image created: ${filename}`);
        } else {
          // Fallback to placeholder
          pageImages.push({
            page: i,
            filename: `step_${i}_page_${i}.png`,
            path: `${cleanName}_images/step_${i}_page_${i}.png`,
            width: 1280,
            height: 713,
            placeholder: true
          });
          console.log(`  ⚠️  Page ${i} fallback to placeholder`);
        }
      }
    } catch (imageError) {
      console.log(`⚠️  Image extraction failed: ${imageError.message}`);
      // Fallback to placeholders
      for (let i = 1; i <= pdfData.numpages; i++) {
        pageImages.push({
          page: i,
          filename: `step_${i}_page_${i}.png`,
          path: `${cleanName}_images/step_${i}_page_${i}.png`,
          width: 1280,
          height: 713,
          placeholder: true
        });
      }
    }

    // Step 3: Parse content into high-quality structured format
    console.log('🔧 Creating high-quality structure...');
    const structured = parseContentIntoHighQualitySteps(pdfData.text, pdfName, pageImages);

    // Step 4: Generate JSON file
    const jsonPath = path.join(outputDir, `${cleanName}.json`);
    await fs.writeJson(jsonPath, structured, { spaces: 2 });
    console.log(`✅ JSON saved: ${jsonPath}`);

    // Step 5: Generate high-quality HTML file
    const htmlPath = path.join(outputDir, `${cleanName}.html`);
    const htmlContent = generateHighQualityHtml(structured, cleanName);
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`✅ HTML saved: ${htmlPath}`);

    return {
      success: true,
      outputs: {
        json: jsonPath,
        html: htmlPath,
        images: imagesDir
      },
      stats: {
        pages: pdfData.numpages,
        steps: structured.steps?.length || 0,
        images: pageImages.length,
        actualImages: pageImages.filter(img => !img.placeholder).length
      }
    };

  } catch (error) {
    console.error(`❌ Error converting ${pdfPath}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

function parseContentIntoHighQualitySteps(text, title, pageImages) {
  console.log('🔍 Analyzing text for high-quality step extraction...');

  // Clean and split text into potential steps
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`📖 Found ${lines.length} lines of text`);

  // Extract meaningful content and filter out Scribe metadata
  const cleanedLines = lines.filter(line => {
    // Remove Scribe watermarks and metadata
    return !line.match(/made with scribe/i) &&
           !line.includes('scribehow.com') &&
           !line.match(/^\d{10,}$/) && // Remove long numbers (IDs)
           !line.match(/^[a-f0-9-]{30,}$/i) && // Remove GUIDs
           line.length > 3;
  });

  console.log(`🧹 Cleaned to ${cleanedLines.length} meaningful lines`);

  // Try to identify clear action steps
  const actionSteps = [];
  let currentStep = null;
  let stepNumber = 1;

  // Look for clear step indicators and action words
  const actionWords = ['navigate', 'click', 'select', 'enter', 'type', 'choose', 'open', 'close', 'save', 'create', 'delete', 'add', 'remove', 'edit', 'update', 'configure', 'set'];
  const stepPatterns = [
    /^(\d+)[\.\)]\s*(.+)/,  // "1. Action" or "1) Action"
    /^step\s*(\d+)[\s\.:]*(.+)/i,  // "Step 1: Action"
    /^(\d+)\s*[-–—]\s*(.+)/,  // "1 - Action"
  ];

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    let isNewStep = false;
    let stepText = line;
    let extractedStepNum = null;

    // Check for explicit step patterns
    for (const pattern of stepPatterns) {
      const match = line.match(pattern);
      if (match) {
        isNewStep = true;
        extractedStepNum = parseInt(match[1]);
        stepText = match[2] ? match[2].trim() : line;
        break;
      }
    }

    // If no explicit pattern, check for action-oriented content
    if (!isNewStep) {
      const lowerLine = line.toLowerCase();
      const hasActionWord = actionWords.some(word => lowerLine.includes(word));
      const isShortActionable = line.length < 100 && hasActionWord;
      const startsWithAction = actionWords.some(word => lowerLine.startsWith(word));

      if (isShortActionable || startsWithAction) {
        isNewStep = true;
        stepText = line;
        extractedStepNum = stepNumber;
      }
    }

    if (isNewStep) {
      // Save previous step
      if (currentStep && currentStep.description.trim()) {
        actionSteps.push(currentStep);
      }

      // Start new step with cleaned description
      currentStep = {
        step_number: extractedStepNum || stepNumber,
        description: cleanAndCapitalizeDescription(stepText),
        page: Math.min(stepNumber, pageImages.length),
        images: []
      };
      stepNumber++;
    } else if (currentStep && !line.match(/^\d+$/) && line.length > 10) {
      // Add to current step description if it's meaningful content
      currentStep.description += '. ' + cleanAndCapitalizeDescription(line);
    }
  }

  // Add final step
  if (currentStep && currentStep.description.trim()) {
    actionSteps.push(currentStep);
  }

  // If we couldn't find clear steps, create them from meaningful content
  if (actionSteps.length === 0) {
    console.log('📝 Creating steps from meaningful content chunks...');
    const meaningfulContent = cleanedLines.filter(line =>
      line.length > 15 &&
      !line.match(/^\d+$/) &&
      !line.match(/^page \d+/i)
    );

    const chunkSize = Math.max(1, Math.floor(meaningfulContent.length / Math.min(pageImages.length, 8)));

    for (let i = 0; i < meaningfulContent.length; i += chunkSize) {
      const chunk = meaningfulContent.slice(i, i + chunkSize).join('. ');
      if (chunk.trim()) {
        actionSteps.push({
          step_number: actionSteps.length + 1,
          description: cleanAndCapitalizeDescription(chunk),
          page: Math.min(actionSteps.length + 1, pageImages.length),
          images: []
        });
      }
    }
  }

  // Assign images to steps and finalize
  actionSteps.forEach((step, index) => {
    const pageImage = pageImages.find(img => img.page === step.page) ||
                     pageImages[index] ||
                     pageImages[0];

    if (pageImage) {
      step.images = [pageImage];
    }

    // Final cleanup of description
    step.description = step.description
      .replace(/\.\s*\./g, '.') // Remove double periods
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Ensure reasonable length
    if (step.description.length > 200) {
      step.description = step.description.substring(0, 200).trim() + '...';
    }

    // Ensure minimum quality
    if (step.description.length < 10) {
      step.description = `Complete step ${step.step_number} as shown in the screenshot`;
    }
  });

  console.log(`✅ Created ${actionSteps.length} high-quality steps`);

  return {
    title: extractCleanTitle(title),
    total_steps: actionSteps.length,
    steps: actionSteps
  };
}

function cleanAndCapitalizeDescription(text) {
  return text
    .replace(/^(step\s*\d+[\s\.:]*)/i, '') // Remove step prefixes
    .replace(/^\d+[\.\):\s]*/, '') // Remove number prefixes
    .replace(/[^\w\s\.\,\!\?\-\(\)"']/g, ' ') // Clean special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
}

function extractCleanTitle(filename) {
  // Extract title from filename patterns like:
  // "Client_Software___Created_by_Me_microsoftconnect_microsoft_sentinel_workspace_in_security_centerinit_consulting10_steps4_months_ago_1757788306283"

  let title = filename
    .replace(/[_]/g, ' ') // Replace underscores with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Remove common Scribe metadata patterns
  title = title
    .replace(/\s*\d+\s*steps?\s*\d+\s*(months?|years?|weeks?|days?)\s*ago.*/i, '') // Remove "10 steps 4 months ago..."
    .replace(/\s*\d{10,}.*$/, '') // Remove long numbers at end
    .replace(/\s*init\s*consulting.*$/i, '') // Remove "init consulting..."
    .replace(/\s*created\s*by\s*me\s*/i, ' ') // Clean "created by me"
    .replace(/\s*shared\s*with\s*me\s*/i, ' ') // Clean "shared with me"
    .replace(/\s*(andrew\s*greene|[a-z]+\s*greene)\s*/i, ' ') // Remove author names
    .replace(/\s+/g, ' ') // Normalize spaces again
    .trim();

  // Capitalize properly
  title = title
    .split(' ')
    .map(word => {
      // Don't capitalize small connecting words unless they're first
      const smallWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      return smallWords.includes(word.toLowerCase()) && title.indexOf(word) !== 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Ensure first word is capitalized
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // If title is too short or empty, create a fallback
  if (title.length < 5) {
    title = 'Document Process Guide';
  }

  return title;
}

function generateHighQualityHtml(data, cleanName) {
  const title = data.title;
  const steps = data.steps || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
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
            <h1>${title}</h1>
            <div class="step-count">${steps.length} Steps</div>
        </div>

        <div class="steps-container">
            ${steps.map(step => `
            <div class="step">
                <div class="step-number">${step.step_number}</div>
                <div class="step-description">${step.description}</div>
                <div class="step-images">
                    ${step.images && step.images.length > 0 ? step.images.map(img => {
                        if (img.placeholder) {
                            return `<div class="step-image placeholder">
                                📸 Screenshot for Step ${step.step_number}
                                <br><small>Image: ${img.filename}</small>
                            </div>`;
                        } else {
                            return `<img src="${img.path}" alt="Step ${step.step_number}"
                                         class="step-image" onclick="openModal(this.src)">`;
                        }
                    }).join('') : ''}
                </div>
            </div>
            `).join('')}
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

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node final-pdf-converter.js <pdf-file> [output-directory]');
    process.exit(1);
  }

  const pdfPath = args[0];
  const outputDir = args[1] || path.dirname(pdfPath);

  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log('🚀 Starting final high-quality PDF conversion...');
  const result = await convertPdfToStructuredFormat(pdfPath, outputDir);

  if (result.success) {
    console.log('\n✅ Final conversion completed!');
    console.log(`📊 Stats: ${result.stats.pages} pages, ${result.stats.steps} steps, ${result.stats.actualImages} actual images + ${result.stats.images - result.stats.actualImages} placeholders`);
    console.log(`📁 Outputs:`);
    console.log(`  JSON: ${result.outputs.json}`);
    console.log(`  HTML: ${result.outputs.html}`);
    console.log(`  Images: ${result.outputs.images}/`);
  } else {
    console.log('\n❌ Conversion failed:', result.error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertPdfToStructuredFormat };