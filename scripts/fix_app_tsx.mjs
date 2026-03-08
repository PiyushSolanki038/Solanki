import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appTsxPath = path.join(__dirname, '../src/app/App.tsx');

let content = fs.readFileSync(appTsxPath, 'utf8');

// 1. Remove deleted pages from lazy imports and Routes
content = content.replace(/const Index = lazy\(\(\) => import\("\.\/pages\/Index"\)\);\n/g, '');
content = content.replace(/const Products = lazy\(\(\) => import\("\.\/pages\/Products"\)\);\n/g, '');
content = content.replace(/const Solutions = lazy\(\(\) => import\("\.\/pages\/Solutions"\)\);\n/g, '');
content = content.replace(/const Pricing = lazy\(\(\) => import\("\.\/pages\/Pricing"\)\);\n/g, '');
content = content.replace(/const About = lazy\(\(\) => import\("\.\/pages\/About"\)\);\n/g, '');
content = content.replace(/const Contact = lazy\(\(\) => import\("\.\/pages\/Contact"\)\);\n/g, '');

// 2. Remove their Route elements
content = content.replace(/<Route path="\/" element={<Index \/>} \/>\n/g, '<Route path="/" element={<Navigate to="/auth/sign-in" replace />} />\n');
content = content.replace(/<Route path="\/products" element={<Products \/>} \/>\n/g, '');
content = content.replace(/<Route path="\/solutions" element={<Solutions \/>} \/>\n/g, '');
content = content.replace(/<Route path="\/pricing" element={<Pricing \/>} \/>\n/g, '');
content = content.replace(/<Route path="\/about" element={<About \/>} \/>\n/g, '');
content = content.replace(/<Route path="\/contact" element={<Contact \/>} \/>\n/g, '');

// 3. Fix lazy imports for moved files
const replacements = [
    // core
    { from: /\.\/components\/auth\//g, to: '../core/auth/components/' },
    { from: /\.\/components\/tenant\//g, to: '../core/tenant/components/' },

    // workspaces/auth
    { from: /\.\/pages\/Auth/g, to: '../workspaces/auth/pages/Auth' },
    { from: /\.\/pages\/SignUp/g, to: '../workspaces/auth/pages/SignUp' },
    { from: /\.\/pages\/AcceptEmployeeInvitation/g, to: '../workspaces/auth/pages/AcceptEmployeeInvitation' },
    { from: /\.\/pages\/AcceptClientInvitation/g, to: '../workspaces/auth/pages/AcceptClientInvitation' },
    { from: /\.\/pages\/ForgotPassword/g, to: '../workspaces/auth/pages/ForgotPassword' },
    { from: /\.\/pages\/ResetPassword/g, to: '../workspaces/auth/pages/ResetPassword' },

    // workspaces/employee
    { from: /\.\/pages\/Dashboard/g, to: '../workspaces/employee/pages/Dashboard' },

    // workspaces/portal
    { from: /\.\/pages\/portal\//g, to: '../workspaces/portal/pages/' },
    { from: /\.\/components\/customer\//g, to: '../workspaces/portal/layout/' },

    // workspaces/platform
    { from: /\.\/pages\/admin\/PlatformAdminDashboard/g, to: '../workspaces/platform/pages/PlatformAdminDashboard' },
    { from: /\.\/pages\/admin\/panels\//g, to: '../workspaces/platform/pages/panels/' },
    { from: /\.\/components\/platform\//g, to: '../workspaces/platform/layout/' },

    // modules
    { from: /\.\/pages\/clm\//g, to: '../modules/clm/pages/' },
    { from: /\.\/pages\/cpq\//g, to: '../modules/cpq/pages/' },
    { from: /\.\/pages\/crm\//g, to: '../modules/crm/pages/' },
    { from: /\.\/pages\/documents\//g, to: '../modules/documents/pages/' },
    { from: /\.\/pages\/erp\//g, to: '../modules/erp/pages/' },
    { from: /\.\/pages\/organization\//g, to: '../modules/organization/pages/' },
    { from: /\.\/components\/organization\//g, to: '../modules/organization/components/' },

    // common root level pages that moved
    { from: /\.\/pages\/Unauthorized/g, to: '../modules/organization/pages/Unauthorized' }, // Wait, Unauthorized, NotFound, PendingApproval were left or moved?
    // Let me just replace ./pages/ with ../modules/organization/pages/ for any leftovers assuming they are there, or I should check.
];

replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
});

// Since I might have missed Unauthorized, NotFound, PendingApproval, let's fix them manually:
content = content.replace(/import\("\.\/pages\/Unauthorized"\)/g, 'import("../workspaces/auth/pages/Unauthorized")');
content = content.replace(/import\("\.\/pages\/NotFound"\)/g, 'import("../workspaces/auth/pages/NotFound")');
content = content.replace(/import\("\.\/pages\/PendingApproval"\)/g, 'import("../workspaces/auth/pages/PendingApproval")');

fs.writeFileSync(appTsxPath, content, 'utf8');
console.log('App.tsx lazy imports fixed.');
