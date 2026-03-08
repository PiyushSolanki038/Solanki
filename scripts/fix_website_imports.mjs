import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');
const websiteDir = path.join(srcDir, 'workspaces/website');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Replace old sections and layout paths with local workspace paths
    content = content.replace(/@\/components\/layout/g, '@/workspaces/website/components/layout');
    content = content.replace(/@\/components\/sections/g, '@/workspaces/website/components/sections');

    // Replace old UI paths with the new central design system paths
    content = content.replace(/@\/components\/ui\/button/g, '@/ui/shadcn/button');
    content = content.replace(/@\/components\/ui\/input/g, '@/ui/shadcn/input');
    content = content.replace(/@\/components\/ui\/textarea/g, '@/ui/shadcn/textarea');
    content = content.replace(/@\/components\/ui\/card/g, '@/ui/shadcn/card');
    content = content.replace(/@\/components\/ui\/accordion/g, '@/ui/shadcn/accordion');
    content = content.replace(/@\/components\/ui\/badge/g, '@/ui/shadcn/badge');
    content = content.replace(/@\/components\/ui\/separator/g, '@/ui/shadcn/separator');
    content = content.replace(/@\/components\/ui\//g, '@/ui/shadcn/');

    // Replace hook imports
    content = content.replace(/@\/hooks\/use-toast/g, '@/ui/feedback/use-toast');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function traverse(dir) {
    if (!fs.existsSync(dir)) return;
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

traverse(websiteDir);
console.log('Fixed website workspace imports');
