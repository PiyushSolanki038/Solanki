import { Link } from "react-router-dom"; // <-- Added this missing import
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/crm/StatsCard";
import { useAutoDocuments } from "@/hooks/useDocuments";
import { 
  FileStack, FilePlus, FileText, Send, CheckCircle2, 
  ArrowRight, History, Zap
} from "lucide-react";

const quickActions = [
  { icon: FilePlus, title: "Create Document", description: "Generate a new document from template", path: "/dashboard/documents/create", color: "from-primary to-primary/60" },
  { icon: FileText, title: "Manage Templates", description: "Edit and create document templates", path: "/dashboard/documents/templates", color: "from-accent to-accent/60" },
  { icon: History, title: "View History", description: "Document generation history and logs", path: "/dashboard/documents/history", color: "from-chart-3 to-chart-3/60" },
  { icon: Send, title: "Pending Approvals", description: "Documents awaiting signature", path: "/dashboard/documents/pending", color: "from-chart-4 to-chart-4/60" },
];

const statusStyles: Record<string, { bg: string; text: string }> = {
  signed: { bg: "bg-primary/10", text: "text-primary" },
  pending: { bg: "bg-accent/10", text: "text-accent" },
  approved: { bg: "bg-chart-3/10", text: "text-chart-3" },
  sent: { bg: "bg-chart-4/10", text: "text-chart-4" },
  draft: { bg: "bg-muted", text: "text-muted-foreground" },
};

const DocumentsDashboard = () => {
  const { data: documents = [], isLoading } = useAutoDocuments();
  
  const stats = [
    { title: "Documents Generated", value: documents.length.toString(), change: "+0%", icon: FileStack },
    { title: "Pending Signatures", value: documents.filter((d: any) => d.status === "pending").length.toString(), change: "0%", icon: Send },
    { title: "Approved Documents", value: documents.filter((d: any) => d.status === "signed" || d.status === "approved").length.toString(), change: "+0%", icon: CheckCircle2 },
    { title: "Automation Rate", value: "0%", change: "+0%", icon: Zap },
  ];

  const recentDocuments = documents.slice(0, 5).map((doc: any) => ({
    id: doc.id,
    name: doc.name || "Untitled Document",
    type: doc.type || "Document",
    status: doc.status || "draft",
    time: "Recently created"
  }));

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Document Automation</h1>
            <p className="text-muted-foreground">Create, manage, and deliver documents at scale</p>
          </div>
          <Link to="/dashboard/documents/create">
            <Button variant="hero">
              <FilePlus className="w-4 h-4 mr-2" />
              Create Document
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <StatsCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              trend={{ value: parseInt(stat.change), isPositive: stat.change.startsWith("+") }}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.path}
                className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-card-hover transition-all flex items-center gap-4 group"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{action.title}</div>
                  <div className="text-sm text-muted-foreground truncate">{action.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Documents</h2>
            <Link to="/dashboard/documents/history">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading documents...
              </div>
            ) : recentDocuments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileStack className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div>No documents yet. Create one to get started!</div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 hover:bg-secondary/50 transition-colors flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileStack className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{doc.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {doc.id} • {doc.type} • {doc.time}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusStyles[doc.status]?.bg} ${statusStyles[doc.status]?.text}`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Workflow Overview */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Document Workflow</h2>
          <div className="grid sm:grid-cols-5 gap-4">
            {[
              { step: "1", label: "Create", icon: FilePlus, desc: "Generate from template" },
              { step: "2", label: "Review", icon: FileText, desc: "Content verification" },
              { step: "3", label: "Approve", icon: CheckCircle2, desc: "Internal approval" },
              { step: "4", label: "Sign", icon: Send, desc: "E-signature collection" },
              { step: "5", label: "Store", icon: FileStack, desc: "Secure archival" },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                <div className="p-4 rounded-xl bg-card border border-border text-center">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="font-semibold text-foreground mb-1">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                {index < 4 && (
                  <div className="hidden sm:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
  );
};

export default DocumentsDashboard;