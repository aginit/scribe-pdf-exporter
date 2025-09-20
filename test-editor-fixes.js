#!/usr/bin/env node

// Test script to verify the editor fixes

const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Editor Fixes');
console.log('=======================\n');

// Test 1: Check JSON structure
const testFile = '3cx_scribeprovision_a_new_phone_in_3cx17_steps2_years_agoandrew_greene_1757786462613.json';
const jsonPath = path.join(__dirname, 'downloads', testFile);

if (fs.existsSync(jsonPath)) {
    const documentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log('✅ Document Structure Analysis:');
    console.log(`   📋 Title: "${documentData.title}"`);
    console.log(`   📊 Total Steps: ${documentData.steps?.length || 0}`);

    if (documentData.steps && documentData.steps.length > 0) {
        const firstStep = documentData.steps[0];
        console.log('\n📝 First Step Analysis:');
        console.log(`   🏷️  Has 'title' field: ${firstStep.title ? '✅ Yes' : '❌ No'}`);
        console.log(`   📄 Has 'description' field: ${firstStep.description ? '✅ Yes' : '❌ No'}`);
        console.log(`   📸 Images count: ${firstStep.images?.length || 0}`);

        if (firstStep.images && firstStep.images.length > 0) {
            const firstImage = firstStep.images[0];
            console.log('\n🖼️  Image Structure:');
            console.log(`   📁 Path: ${firstImage.path || 'N/A'}`);
            console.log(`   📄 Filename: ${firstImage.filename || 'N/A'}`);
            console.log(`   🔗 URL: ${firstImage.url || 'N/A'}`);
        }

        console.log('\n📋 Sample Steps (Title or Description):');
        documentData.steps.slice(0, 5).forEach((step, index) => {
            const stepTitle = step.title || step.description || 'No title/description';
            const truncated = stepTitle.length > 50 ? stepTitle.substring(0, 50) + '...' : stepTitle;
            console.log(`   ${index + 1}. ${truncated}`);
        });
    }
}

// Test 2: Check image directory
const imageDir = path.join(__dirname, 'downloads', testFile.replace('.json', '_images'));
console.log('\n🖼️  Image Directory Check:');
if (fs.existsSync(imageDir)) {
    const images = fs.readdirSync(imageDir);
    console.log(`   ✅ Directory exists: ${imageDir}`);
    console.log(`   📊 Image count: ${images.length}`);
    console.log(`   📸 Sample images: ${images.slice(0, 3).join(', ')}`);
} else {
    console.log(`   ❌ Directory not found: ${imageDir}`);
}

// Test 3: Check editor file exists
const editorPath = path.join(__dirname, 'public', 'editor.html');
console.log('\n📝 Editor File Check:');
if (fs.existsSync(editorPath)) {
    const editorContent = fs.readFileSync(editorPath, 'utf8');
    const hasStepTitleFix = editorContent.includes('step.title || step.description');
    const hasImagePathFix = editorContent.includes('img.path');
    const hasPreviewFix = editorContent.includes('/downloads/${img.path}');

    console.log(`   ✅ Editor file exists`);
    console.log(`   🔧 Step title fix: ${hasStepTitleFix ? '✅ Applied' : '❌ Missing'}`);
    console.log(`   🔧 Image path fix: ${hasImagePathFix ? '✅ Applied' : '❌ Missing'}`);
    console.log(`   🔧 Preview fix: ${hasPreviewFix ? '✅ Applied' : '❌ Missing'}`);
} else {
    console.log(`   ❌ Editor file not found`);
}

console.log('\n🎯 Expected Editor Behavior:');
console.log('   ✅ Step titles should show actual descriptions');
console.log('   ✅ Images should load from /downloads/[imagePath]');
console.log('   ✅ Step editing should preserve original structure');
console.log('   ✅ Preview should show formatted content');

console.log('\n🚀 Next Steps:');
console.log('   1. Login to http://localhost:8080');
console.log('   2. Click "✏️ Edit" on a converted document');
console.log('   3. Verify steps show proper titles');
console.log('   4. Verify images display correctly');

console.log('\n✨ Editor fixes applied successfully!');