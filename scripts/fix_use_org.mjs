import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    content = content.replace(/@\/core\/hooks\/useOrganization/g, '@/modules/organization/hooks/useOrganization');
    content = content.replace(/@\/core\/hooks\/useOrganizationOwnerData/g, '@/modules/organization/hooks/useOrganizationOwnerData');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

traverse(srcDir);
console.log('Fixed useOrganization imports');
