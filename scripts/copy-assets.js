const fs = require('fs');
const path = require('path');

// Adding some flair for that "CodeTease" style
const reset = "\x1b[0m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const cyan = "\x1b[36m";

console.log(`${cyan}>>> Plexo Asset Manager (Teaserverse Edition)${reset}`);

// Define paths
// __dirname is inside 'scripts', so we need to step out '..' to reach root
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'src', 'core', 'inspector.py');
const destDir = path.join(rootDir, 'dist', 'core');
const destFile = path.join(destDir, 'inspector.py');

try {
    // 1. Check if source file exists
    if (!fs.existsSync(sourceFile)) {
        throw new Error(`Ouch! Could not find inspector.py at: ${sourceFile}`);
    }

    // 2. Create destination directory if missing (dist/core)
    if (!fs.existsSync(destDir)) {
        console.log(`${yellow}... Creating directory ${destDir} ${reset}`);
        fs.mkdirSync(destDir, { recursive: true });
    }

    // 3. Copy file
    fs.copyFileSync(sourceFile, destFile);
    
    console.log(`${green}✔ Successfully copied inspector.py to dist/core!${reset}`);
    console.log(`${green}✔ Plexo is ready to rock.${reset}\n`);

} catch (error) {
    console.error(`\n\x1b[31m[ERROR] Failed to copy assets: ${error.message}\x1b[0m`);
    process.exit(1); // Exit code 1 to fail the CI/CD build
}