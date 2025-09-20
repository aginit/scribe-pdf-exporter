const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function convertPdfToMarkdown(pdfPath, outputPath) {
  try {
    console.log(`Converting ${path.basename(pdfPath)} to markdown...`);

    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    // Clean up the text and format as markdown
    let markdownContent = data.text
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/\f/g, '\n\n---\n\n') // Replace form feeds with page breaks
      .trim();

    // Add basic markdown formatting
    const filename = path.basename(pdfPath, '.pdf');
    const formattedContent = `# ${filename.replace(/_/g, ' ')}\n\n${markdownContent}`;

    fs.writeFileSync(outputPath, formattedContent, 'utf8');
    console.log(`✅ Converted to: ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`❌ Error converting ${pdfPath}:`, error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node pdf-to-markdown.js <pdf-file> [output-file]');
    process.exit(1);
  }

  const pdfPath = args[0];
  const outputPath = args[1] || pdfPath.replace('.pdf', '.md');

  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  const success = await convertPdfToMarkdown(pdfPath, outputPath);
  process.exit(success ? 0 : 1);
}

main();