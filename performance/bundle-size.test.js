#!/usr/bin/env node

// Bundle size validation script
const fs = require('fs');
const path = require('path');

// Define size limits (in bytes)
// Increased limits to accommodate PDF processing libraries
const SIZE_LIMITS = {
  javascript: 800 * 1024, // 800 KB (pdf-lib is quite large)
  css: 150 * 1024,        // 150 KB
  html: 100 * 1024,       // 100 KB
  total: 3500 * 1024      // 3.5 MB (to accommodate pdf-lib)
};

// Function to get file sizes in a directory
function getFileSizes(dir) {
  const sizes = {
    javascript: 0,
    css: 0,
    html: 0,
    images: 0,
    fonts: 0,
    other: 0,
    total: 0
  };

  function walkDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    
    for (const file of files) {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        const ext = path.extname(file).toLowerCase();
        const size = stat.size;
        
        if (ext === '.js') {
          sizes.javascript += size;
        } else if (ext === '.css') {
          sizes.css += size;
        } else if (ext === '.html') {
          sizes.html += size;
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
          sizes.images += size;
        } else if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
          sizes.fonts += size;
        } else {
          sizes.other += size;
        }
        
        sizes.total += size;
      }
    }
  }

  try {
    walkDir(dir);
    return sizes;
  } catch (error) {
    console.error('Error reading directory:', error);
    process.exit(1);
  }
}

// Function to format bytes to human readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to check if sizes are within limits
function validateSizes(sizes) {
  const errors = [];
  
  if (sizes.javascript > SIZE_LIMITS.javascript) {
    errors.push(`JavaScript bundle too large: ${formatBytes(sizes.javascript)} (limit: ${formatBytes(SIZE_LIMITS.javascript)})`);
  }
  
  if (sizes.css > SIZE_LIMITS.css) {
    errors.push(`CSS bundle too large: ${formatBytes(sizes.css)} (limit: ${formatBytes(SIZE_LIMITS.css)})`);
  }
  
  if (sizes.html > SIZE_LIMITS.html) {
    errors.push(`HTML too large: ${formatBytes(sizes.html)} (limit: ${formatBytes(SIZE_LIMITS.html)})`);
  }
  
  if (sizes.total > SIZE_LIMITS.total) {
    errors.push(`Total bundle too large: ${formatBytes(sizes.total)} (limit: ${formatBytes(SIZE_LIMITS.total)})`);
  }
  
  return errors;
}

// Main function
function main() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory not found. Please build the project first.');
    console.log('Run: npm run build');
    process.exit(1);
  }
  
  console.log('Checking bundle sizes...\n');
  
  // Get file sizes
  const sizes = getFileSizes(distDir);
  
  // Display sizes
  console.log('Bundle Sizes:');
  console.log('=============');
  console.log(`JavaScript: ${formatBytes(sizes.javascript)}`);
  console.log(`CSS:        ${formatBytes(sizes.css)}`);
  console.log(`HTML:       ${formatBytes(sizes.html)}`);
  console.log(`Images:     ${formatBytes(sizes.images)}`);
  console.log(`Fonts:      ${formatBytes(sizes.fonts)}`);
  console.log(`Other:      ${formatBytes(sizes.other)}`);
  console.log('-------------------');
  console.log(`Total:      ${formatBytes(sizes.total)}\n`);
  
  // Validate sizes
  const errors = validateSizes(sizes);
  
  if (errors.length > 0) {
    console.error('Bundle size validation failed:');
    errors.forEach(error => console.error(`  ✗ ${error}`));
    process.exit(1);
  } else {
    console.log('✓ All bundle sizes are within limits');
    console.log('✓ Bundle size validation passed');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { getFileSizes, validateSizes, SIZE_LIMITS };