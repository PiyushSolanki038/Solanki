import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

// 1. Delete Unused / Marketing Pages
const filesToDelete = [
    'pages/About.tsx',
    'pages/Contact.tsx',
    'pages/Pricing.tsx',
    'pages/Products.tsx',
    'pages/Solutions.tsx',
    'pages/Index.tsx', // Landing page removed as per discussion
    'pages/AdminDashboard.tsx', // Moved to platform admin
    'pages/OrganizationOwnerDashboard.tsx' // Moved to organization
];

filesToDelete.forEach(file => {
    const filePath = path.join(srcDir, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted unused file: ${file}`);
    }
});

// 2. Delete empty directories recursively
function removeEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    if (files.length === 0) {
        fs.rmdirSync(dir);
        console.log(`Removed empty dir: ${dir}`);
    } else {
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                removeEmptyDirs(fullPath);
            }
        }
        // Check again after children are processed
        if (fs.readdirSync(dir).length === 0) {
            fs.rmdirSync(dir);
            console.log(`Removed empty dir: ${dir}`);
        }
    }
}

['pages', 'components', 'hooks', 'lib', 'types', 'integrations'].forEach(dir => {
    removeEmptyDirs(path.join(srcDir, dir));
});

// 3. Mass update imports

// We have moving maps.
// Anything starting with '@/components/ui/' -> '@/ui/shadcn/'
// Anything starting with '@/components/' -> could be in modules or workspaces or ui/components.
// It's safer to resolve these with a regex pass relying on the unified structure.
// Let's iterate all files and update imports matching specific patterns.

const importReplacements = [
    { from: /@\/components\/ui\/toast(er)?/g, to: '@/ui/feedback/toast$1' },
    { from: /@\/ui\/shadcn\/use-toast/g, to: '@/ui/feedback/use-toast' },
    { from: /@\/components\/ui\/sonner/g, to: '@/ui/feedback/sonner' },
    { from: /@\/components\/ui\//g, to: '@/ui/shadcn/' },
    { from: /@\/components\/ErrorBoundary/g, to: '@/ui/components/ErrorBoundary' },
    { from: /@\/components\/NavLink/g, to: '@/ui/components/NavLink' },
    { from: /@\/components\/ScrollToTop/g, to: '@/ui/components/ScrollToTop' },

    // Hooks
    { from: /@\/hooks\/useAuth/g, to: '@/core/auth/useAuth' },
    { from: /@\/hooks\/auth-context/g, to: '@/core/auth/auth-context' },
    { from: /@\/hooks\/AuthProvider/g, to: '@/app/providers/AuthProvider' },

    { from: /@\/hooks\/useTenant/g, to: '@/core/tenant/useTenant' },
    { from: /@\/hooks\/tenant-context/g, to: '@/core/tenant/tenant-context' },
    { from: /@\/hooks\/TenantProvider/g, to: '@/app/providers/TenantProvider' },

    { from: /@\/hooks\/organization-context/g, to: '@/core/hooks/organization-context' },
    { from: /@\/hooks\/OrganizationProvider/g, to: '@/app/providers/OrganizationProvider' },

    { from: /@\/hooks\/theme-context/g, to: '@/app/providers/theme-context' },
    { from: /@\/hooks\/ThemeProvider/g, to: '@/app/providers/ThemeProvider' },

    { from: /@\/hooks\/usePermissions/g, to: '@/core/rbac/usePermissions' },

    { from: /@\/app\/providers\/impersonation-context/g, to: '@/app/providers/impersonation-context' },
    { from: /@\/app\/providers\/ImpersonationProvider/g, to: '@/app/providers/ImpersonationProvider' },

    // Generic hooks to core/hooks
    { from: /@\/hooks\//g, to: '@/core/hooks/' },

    // Types & Libs
    { from: /@\/types\//g, to: '@/core/types/' },
    { from: /@\/lib\//g, to: '@/core/utils/' },

    // Supabase
    { from: /@\/integrations\/supabase\/client/g, to: '@/core/api/client' },
    { from: /@\/integrations\/supabase\/types/g, to: '@/core/api/types' },
    { from: /@\/integrations\/supabase/g, to: '@/core/api' },

    // Auth components
    { from: /@\/components\/auth\//g, to: '@/core/auth/components/' },
    { from: /@\/components\/tenant\//g, to: '@/core/tenant/components/' },

    // Employee Layout
    { from: /@\/components\/employee\//g, to: '@/workspaces/employee/layout/' },
    { from: /@\/components\/layout\//g, to: '@/workspaces/employee/layout/' },

    // Portal Layout
    { from: /@\/components\/customer\//g, to: '@/workspaces/portal/layout/' },

    // Platform Layout
    { from: /@\/components\/platform\//g, to: '@/workspaces/platform/layout/' },

    // Modules Pages & Components 
    // CRM
    { from: /@\/pages\/crm\//g, to: '@/modules/crm/pages/' },
    { from: /@\/components\/crm\//g, to: '@/modules/crm/components/' },

    // CPQ
    { from: /@\/pages\/cpq\//g, to: '@/modules/cpq/pages/' },
    { from: /@\/components\/cpq\//g, to: '@/modules/cpq/components/' },

    // CLM
    { from: /@\/pages\/clm\//g, to: '@/modules/clm/pages/' },
    { from: /@\/components\/clm\//g, to: '@/modules/clm/components/' },

    // ERP
    { from: /@\/pages\/erp\//g, to: '@/modules/erp/pages/' },
    { from: /@\/components\/erp\//g, to: '@/modules/erp/components/' },

    // DOCUMENTS
    { from: /@\/pages\/documents\//g, to: '@/modules/documents/pages/' },
    { from: /@\/components\/documents\//g, to: '@/modules/documents/components/' },

    // ORGANIZATION
    { from: /@\/pages\/organization\//g, to: '@/modules/organization/pages/' },
    { from: /@\/components\/organization\//g, to: '@/modules/organization/components/' },

    // Other Pages
    { from: /@\/pages\/admin\//g, to: '@/workspaces/platform/pages/' },
    { from: /@\/pages\/portal\//g, to: '@/workspaces/portal/pages/' },
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    importReplacements.forEach(({ from, to }) => {
        content = content.replace(from, to);
    });

    // Some relative imports fixing if necessary inside modules:
    // (We primarily relied on absolute @/ imports in Vite, but we fix explicit paths if needed)
    content = content.replace(/\.\.\/ui\//g, '@/ui/shadcn/');
    content = content.replace(/\.\.\/components\/ui\//g, '@/ui/shadcn/');
    content = content.replace(/\.\.\/\.\.\/components\/ui\//g, '@/ui/shadcn/');
    content = content.replace(/\.\.\/lib\//g, '@/core/utils/');
    content = content.replace(/\.\.\/\.\.\/lib\//g, '@/core/utils/');
    content = content.replace(/\.\.\/hooks\//g, '@/core/hooks/');

    // Fix App.css / index.css imports
    content = content.replace(/import ".*?App\.css";/g, 'import "@/styles/App.css";');
    content = content.replace(/import ".*?index\.css";/g, 'import "@/styles/index.css";');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function traverseAndProcess(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseAndProcess(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

traverseAndProcess(srcDir);
console.log('Finished updating imports.');
