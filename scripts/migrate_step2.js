const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

// Helper to ensure directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Helper to move a file or directory
function move(src, dest) {
    const srcPath = path.join(srcDir, src);
    const destPath = path.join(srcDir, dest);
    if (fs.existsSync(srcPath)) {
        ensureDir(path.dirname(destPath));
        fs.renameSync(srcPath, destPath);
        console.log(`Moved ${src} to ${dest}`);
    } else {
        console.log(`Skip (not found): ${src}`);
    }
}

// Helper to move all files matching a prefix (like moving folder contents)
function moveAllInDir(srcFolder, destFolder) {
    const srcPath = path.join(srcDir, srcFolder);
    if (!fs.existsSync(srcPath)) return;

    ensureDir(path.join(srcDir, destFolder));

    const files = fs.readdirSync(srcPath);
    for (const file of files) {
        fs.renameSync(path.join(srcPath, file), path.join(srcDir, destFolder, file));
        console.log(`Moved ${srcFolder}/${file} to ${destFolder}/${file}`);
    }
}

// Phase 2: UI System (ui/)
moveAllInDir('components/ui', 'ui/shadcn');
move('components/ErrorBoundary.tsx', 'ui/components/ErrorBoundary.tsx');
move('components/NavLink.tsx', 'ui/components/NavLink.tsx');
move('components/ScrollToTop.tsx', 'ui/components/ScrollToTop.tsx');
move('ui/shadcn/toast.tsx', 'ui/feedback/toast.tsx');
move('ui/shadcn/toaster.tsx', 'ui/feedback/toaster.tsx');
move('ui/shadcn/sonner.tsx', 'ui/feedback/sonner.tsx');
move('ui/shadcn/use-toast.ts', 'ui/feedback/use-toast.ts');

// Phase 3: Core Logic (core/)
move('integrations/supabase/client.ts', 'core/api/client.ts');
move('hooks/useAuth.ts', 'core/auth/useAuth.ts');
move('hooks/auth-context.ts', 'core/auth/auth-context.ts');
moveAllInDir('components/auth', 'core/auth/components');
move('hooks/useTenant.ts', 'core/tenant/useTenant.ts');
move('hooks/tenant-context.ts', 'core/tenant/tenant-context.ts');
move('hooks/usePermissions.ts', 'core/rbac/usePermissions.ts');
moveAllInDir('types', 'core/types');
moveAllInDir('lib', 'core/utils');

// Move remaining hooks to core/hooks, ignoring ones already moved
const hookFiles = fs.existsSync(path.join(srcDir, 'hooks')) ? fs.readdirSync(path.join(srcDir, 'hooks')) : [];
hookFiles.forEach(file => {
    if (file.endsWith('.ts') && !file.includes('Provider')) {
        move(`hooks/${file}`, `core/hooks/${file}`);
    }
});

// Phase 4: App Bootstrap (app/)
hookFiles.forEach(file => {
    if (file.includes('Provider')) {
        move(`hooks/${file}`, `app/providers/${file}`);
    }
});
moveAllInDir('app/providers', 'app/providers'); // In case some are already in app/providers
move('App.tsx', 'app/App.tsx');

// Phase 5: Domain Modules (modules/)
const domains = ['crm', 'cpq', 'clm', 'erp', 'documents', 'organization'];
domains.forEach(domain => {
    moveAllInDir(`pages/${domain}`, `modules/${domain}/pages`);
    moveAllInDir(`components/${domain}`, `modules/${domain}/components`);
    // Move domain specific hooks
    if (fs.existsSync(path.join(srcDir, `core/hooks/use${domain.toUpperCase()}.ts`))) {
        move(`core/hooks/use${domain.toUpperCase()}.ts`, `modules/${domain}/hooks/use${domain.toUpperCase()}.ts`);
    } else if (fs.existsSync(path.join(srcDir, `core/hooks/use${domain.charAt(0).toUpperCase() + domain.slice(1)}.ts`))) {
        move(`core/hooks/use${domain.charAt(0).toUpperCase() + domain.slice(1)}.ts`, `modules/${domain}/hooks/use${domain.charAt(0).toUpperCase() + domain.slice(1)}.ts`);
    }
});

// Phase 6: Workspaces (workspaces/)
// Auth
move('pages/Auth.tsx', 'workspaces/auth/pages/Auth.tsx');
move('pages/SignUp.tsx', 'workspaces/auth/pages/SignUp.tsx');
move('pages/ForgotPassword.tsx', 'workspaces/auth/pages/ForgotPassword.tsx');
move('pages/ResetPassword.tsx', 'workspaces/auth/pages/ResetPassword.tsx');
move('pages/AcceptEmployeeInvitation.tsx', 'workspaces/auth/pages/AcceptEmployeeInvitation.tsx');
move('pages/AcceptClientInvitation.tsx', 'workspaces/auth/pages/AcceptClientInvitation.tsx');

// Employee
move('pages/Dashboard.tsx', 'workspaces/employee/pages/Dashboard.tsx');
moveAllInDir('components/employee', 'workspaces/employee/layout');
moveAllInDir('components/layout', 'workspaces/employee/layout'); // Global layout pieces often used in employee

// Portal (Customer)
move('pages/portal/PortalDashboard.tsx', 'workspaces/portal/pages/PortalDashboard.tsx');
moveAllInDir('components/customer', 'workspaces/portal/layout');
moveAllInDir('pages/portal', 'workspaces/portal/pages');

// Platform (Admin)
moveAllInDir('pages/admin', 'workspaces/platform/pages');
moveAllInDir('components/platform', 'workspaces/platform/layout');

// Tenants Layout
moveAllInDir('components/tenant', 'workspaces/employee/layout/tenant'); // Or similar

console.log('Phase 2-6 completed.');
