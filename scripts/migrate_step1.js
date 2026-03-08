const fs = require('fs');
const path = require('path');

const dirs = [
    'src/app/providers',
    'src/app/config',
    'src/core/api',
    'src/core/auth',
    'src/core/tenant',
    'src/core/rbac',
    'src/core/types',
    'src/core/utils',
    'src/core/hooks',
    'src/ui/shadcn',
    'src/ui/components',
    'src/ui/feedback',
    'src/modules/crm/pages',
    'src/modules/crm/components',
    'src/modules/crm/hooks',
    'src/modules/cpq/pages',
    'src/modules/cpq/components',
    'src/modules/cpq/hooks',
    'src/modules/clm/pages',
    'src/modules/clm/components',
    'src/modules/clm/hooks',
    'src/modules/erp/pages',
    'src/modules/erp/components',
    'src/modules/erp/hooks',
    'src/modules/documents/pages',
    'src/modules/documents/components',
    'src/modules/documents/hooks',
    'src/modules/organization/pages',
    'src/modules/organization/components',
    'src/modules/organization/hooks',
    'src/workspaces/auth/pages',
    'src/workspaces/auth/components',
    'src/workspaces/auth/flows',
    'src/workspaces/employee/layout',
    'src/workspaces/employee/routes',
    'src/workspaces/portal/layout',
    'src/workspaces/portal/routes',
    'src/workspaces/platform/layout',
    'src/workspaces/platform/routes',
    'src/assets',
    'src/styles'
];

dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

function moveFile(src, dest) {
    const srcPath = path.join(__dirname, src);
    const destPath = path.join(__dirname, dest);
    if (fs.existsSync(srcPath)) {
        fs.renameSync(srcPath, destPath);
        console.log(`Moved ${src} to ${dest}`);
    }
}

// Migrate Assets & Styles
moveFile('src/index.css', 'src/styles/index.css');
moveFile('src/App.css', 'src/styles/App.css');

console.log('Phase 1 completed.');
