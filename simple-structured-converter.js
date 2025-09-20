const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');

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

    // Step 2: Create placeholder images (for now)
    console.log('🖼️  Creating placeholder images...');
    let pageImages = [];
    for (let i = 1; i <= pdfData.numpages; i++) {
      const filename = `step_${i}_page_${i}_img_1.png`;
      pageImages.push({
        page: i,
        filename: filename,
        path: `${cleanName}_images/${filename}`,
        width: 1280,
        height: 720,
        placeholder: true
      });
    }

    // Step 3: Parse content into structured format
    console.log('🔧 Structuring content...');
    const structured = parseContentIntoSteps(pdfData.text, pdfName, pageImages);

    // Step 4: Generate JSON file
    const jsonPath = path.join(outputDir, `${cleanName}.json`);
    await fs.writeJson(jsonPath, structured, { spaces: 2 });
    console.log(`✅ JSON saved: ${jsonPath}`);

    // Step 5: Generate HTML file
    const htmlPath = path.join(outputDir, `${cleanName}.html`);
    const htmlContent = generateHtmlFromStructured(structured, cleanName);
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
        images: pageImages.length
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

function parseContentIntoSteps(text, title, pageImages) {
  // Clean and split text into potential steps
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`📖 Found ${lines.length} lines of text`);

  // Try to identify steps by looking for step indicators
  const steps = [];
  let currentStep = null;
  let stepNumber = 1;

  // First, try to identify clear step patterns
  const stepPatterns = [
    /^step\s*(\d+)[:.\s]/i,
    /^(\d+)[\.\)]\s+/,
    /^(\d+)\s*[-–—]\s*/,
    /step\s*(\d+)/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let isNewStep = false;
    let extractedStepNum = null;

    // Check each pattern
    for (const pattern of stepPatterns) {
      const match = line.match(pattern);
      if (match) {
        isNewStep = true;
        extractedStepNum = parseInt(match[1]) || stepNumber;
        break;
      }
    }

    // Also check for manual step indicators
    if (!isNewStep && (
      line.toLowerCase().startsWith('step') ||
      line.match(/^\d+[\.\):]/) ||
      (line.length < 100 && line.includes('click')) ||
      (line.length < 100 && line.includes('navigate'))
    )) {
      isNewStep = true;
      extractedStepNum = stepNumber;
    }

    if (isNewStep) {
      // Save previous step
      if (currentStep && currentStep.description.trim()) {
        steps.push(currentStep);
      }

      // Start new step
      currentStep = {
        step_number: extractedStepNum || stepNumber,
        description: cleanStepDescription(line),
        page: Math.min(stepNumber, pageImages.length),
        images: [],
        confidence: 0.9
      };
      stepNumber++;
    } else if (currentStep) {
      // Add to current step description
      const cleanLine = line.replace(/^\d+\s*/, '').trim();
      if (cleanLine && !cleanLine.match(/^(page \d+|figure \d+)/i)) {
        currentStep.description += ' ' + cleanLine;
      }
    } else {
      // First content - create initial step
      currentStep = {
        step_number: stepNumber,
        description: cleanStepDescription(line),
        page: 1,
        images: [],
        confidence: 0.8
      };
      stepNumber++;
    }
  }

  // Add final step
  if (currentStep && currentStep.description.trim()) {
    steps.push(currentStep);
  }

  // If no clear steps found, create steps from meaningful content chunks
  if (steps.length === 0 || steps.length === 1) {
    console.log('📝 No clear steps found, creating from content chunks...');
    const chunks = intelligentChunkText(text, Math.max(3, Math.min(10, pageImages.length)));
    const newSteps = [];

    chunks.forEach((chunk, index) => {
      if (chunk.trim() && chunk.length > 20) {
        newSteps.push({
          step_number: index + 1,
          description: cleanStepDescription(chunk),
          page: Math.min(index + 1, pageImages.length),
          images: [],
          confidence: 0.7
        });
      }
    });

    if (newSteps.length > steps.length) {
      steps.length = 0;
      steps.push(...newSteps);
    }
  }

  // Assign images to steps and clean up
  steps.forEach((step, index) => {
    const pageImage = pageImages.find(img => img.page === step.page) ||
                     pageImages.find(img => img.page === index + 1) ||
                     pageImages[0];

    if (pageImage) {
      step.images = [pageImage];
    }

    // Clean up descriptions
    step.description = step.description.trim();
    if (step.description.length > 800) {
      step.description = step.description.substring(0, 800) + '...';
    }

    // Remove redundant step number from description
    step.description = step.description
      .replace(/^(step\s*\d+[\s\.:]*)/i, '')
      .replace(/^\d+[\.\):\s]*/, '')
      .trim();

    // Ensure minimum description length
    if (step.description.length < 10) {
      step.description = `Perform action ${step.step_number} as shown in the document.`;
      step.confidence = 0.5;
    }
  });

  console.log(`✅ Created ${steps.length} structured steps`);

  return {
    title: title.replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim(),
    total_steps: steps.length,
    steps: steps,
    metadata: {
      converted_at: new Date().toISOString(),
      source_type: 'pdf',
      extraction_method: 'text-based-structured',
      original_pages: pageImages.length
    }
  };
}

function cleanStepDescription(text) {
  return text
    .replace(/^(step\s*\d+[\.\):\s]*)/i, '')
    .replace(/^\d+[\.\):\s]*/, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\.\,\!\?\-\(\)]/g, '')
    .trim();
}

function intelligentChunkText(text, numChunks) {
  // Split by sentences first
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  if (sentences.length < numChunks) {
    // Fall back to word-based chunking
    const words = text.split(/\s+/);
    const chunkSize = Math.ceil(words.length / numChunks);
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
  }

  // Distribute sentences across chunks
  const chunkSize = Math.ceil(sentences.length / numChunks);
  const chunks = [];

  for (let i = 0; i < sentences.length; i += chunkSize) {
    chunks.push(sentences.slice(i, i + chunkSize).join('. ') + '.');
  }

  return chunks;
}

function generateHtmlFromStructured(data, cleanName) {
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
            margin-bottom: 40px;
            border: 1px solid #e1e8ed;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .step:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }

        .step-header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-bottom: 1px solid #e1e8ed;
        }

        .step-number {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            text-align: center;
            line-height: 40px;
            font-weight: bold;
            font-size: 18px;
            margin-right: 15px;
            box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);
        }

        .step-title {
            display: inline-block;
            vertical-align: top;
            margin-top: 8px;
            font-size: 1.1em;
            font-weight: 600;
            color: #2c3e50;
        }

        .step-content {
            padding: 25px;
        }

        .step-description {
            font-size: 16px;
            line-height: 1.8;
            color: #555;
            margin-bottom: 20px;
        }

        .step-images {
            display: grid;
            gap: 15px;
            margin-top: 20px;
        }

        .step-image {
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            padding: 40px;
            text-align: center;
            color: #6c757d;
        }

        .step-image:hover {
            transform: scale(1.02);
        }

        .step-image.placeholder {
            font-style: italic;
        }

        .step-image img {
            width: 100%;
            height: auto;
            display: block;
        }

        .metadata {
            background: #f8f9fa;
            padding: 20px;
            margin-top: 30px;
            border-radius: 10px;
            font-size: 14px;
            color: #6c757d;
        }

        .confidence-indicator {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }

        .confidence-high { background: #d4edda; color: #155724; }
        .confidence-medium { background: #fff3cd; color: #856404; }
        .confidence-low { background: #f8d7da; color: #721c24; }
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
                    <div class="step-header">
                        <span class="step-number">${step.step_number}</span>
                        <span class="step-title">Step ${step.step_number}</span>
                        <span class="confidence-indicator confidence-${getConfidenceClass(step.confidence)}">
                            ${Math.round((step.confidence || 0.8) * 100)}% confidence
                        </span>
                    </div>
                    <div class="step-content">
                        <div class="step-description">${step.description}</div>
                        ${step.images && step.images.length > 0 ? `
                            <div class="step-images">
                                ${step.images.map(img => `
                                    <div class="step-image ${img.placeholder ? 'placeholder' : ''}">
                                        ${img.placeholder ?
                                          `📸 Screenshot placeholder for Step ${step.step_number}<br><small>Image will be extracted: ${img.filename}</small>` :
                                          `<img src="${img.path}" alt="Step ${step.step_number} - ${img.filename}" title="Page ${step.page} - ${img.filename}">`
                                        }
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}

            <div class="metadata">
                <strong>Document Information:</strong><br>
                📄 Total Steps: ${steps.length}<br>
                📑 Original Pages: ${data.metadata?.original_pages || 'Unknown'}<br>
                🔄 Converted: ${data.metadata?.converted_at ? new Date(data.metadata.converted_at).toLocaleString() : 'Unknown'}<br>
                🛠️ Method: ${data.metadata?.extraction_method || 'automated'}
            </div>
        </div>
    </div>
</body>
</html>`;
}

function getConfidenceClass(confidence) {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node simple-structured-converter.js <pdf-file> [output-directory]');
    process.exit(1);
  }

  const pdfPath = args[0];
  const outputDir = args[1] || path.dirname(pdfPath);

  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log('🚀 Starting simple structured PDF conversion...');
  const result = await convertPdfToStructuredFormat(pdfPath, outputDir);

  if (result.success) {
    console.log('\n✅ Conversion completed successfully!');
    console.log(`📊 Stats: ${result.stats.pages} pages, ${result.stats.steps} steps, ${result.stats.images} images`);
    console.log(`📁 Outputs:`);
    console.log(`  JSON: ${result.outputs.json}`);
    console.log(`  HTML: ${result.outputs.html}`);
    console.log(`  Images: ${result.outputs.images}/ (placeholders created)`);
  } else {
    console.log('\n❌ Conversion failed:', result.error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertPdfToStructuredFormat };