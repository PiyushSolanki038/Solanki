import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    content = content.replace(/@\/core\/hooks\/useCRM/g, '@/modules/crm/hooks/useCRM');
    content = content.replace(/@\/core\/hooks\/useCPQ/g, '@/modules/cpq/hooks/useCPQ');
    content = content.replace(/@\/core\/hooks\/useCLM/g, '@/modules/clm/hooks/useCLM');
    content = content.replace(/@\/core\/hooks\/useERP/g, '@/modules/erp/hooks/useERP');
    content = content.replace(/@\/core\/hooks\/useDOCUMENTS/g, '@/modules/documents/hooks/useDOCUMENTS');

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
console.log('Fixed domain hook imports');
