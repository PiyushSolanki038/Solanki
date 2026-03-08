import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, AlertTriangle, CheckCircle, Clock, ArrowLeft, Sparkles, Shield, Calendar, DollarSign, Users, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { Separator } from "@/ui/shadcn/separator";
import { Progress } from "@/ui/shadcn/progress";
import { toast } from "sonner";

interface ScanResult {
  parties: string[];
  startDate: string;
  endDate: string;
  value: string;
  paymentTerms: string;
  renewalClause: string;
  riskFlags: { level: "low" | "medium" | "high"; message: string }[];
  keyClausesClauses: { title: string; summary: string; risk: "low" | "medium" | "high" }[];
}

export default function ContractScanPage() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsScanning(true);
    setScanResult(null);

    // Simulate AI scanning process
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 300));
      setScanProgress(i);
    }

    // AI scan results - replace with actual API call in production
    const scanResultData: ScanResult = {
      parties: [],
      startDate: "",
      endDate: "",
      value: "",
      paymentTerms: "",
      renewalClause: "",
      riskFlags: [],
      keyClausesClauses: [],
    };

    setScanResult(scanResultData);
    setIsScanning(false);
    toast.success("Contract scan completed");
  };

  const getRiskColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low": return "bg-success/20 text-success-foreground";
      case "medium": return "bg-warning/20 text-warning-foreground";
      case "high": return "bg-destructive/20 text-destructive";
    }
  };

  const getRiskIcon = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low": return <CheckCircle className="h-4 w-4" />;
      case "medium": return <Clock className="h-4 w-4" />;
      case "high": return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const overallRisk = scanResult?.riskFlags.some((r) => r.level === "high")
    ? "high"
    : scanResult?.riskFlags.some((r) => r.level === "medium")
    ? "medium"
    : "low";

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Contract Scanner</h1>
            <p className="text-muted-foreground">AI-powered contract analysis and risk detection</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Contract Analysis
                </CardTitle>
                <CardDescription>Upload a contract to extract key information and identify risks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="block">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">Drop contract file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">PDF, DOCX, DOC (max 10MB)</p>
                  </div>
                  <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" />
                </label>

                {isScanning && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Scanning {fileName}...</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <Progress value={scanProgress} />
                    <p className="text-xs text-muted-foreground">Analyzing document structure, extracting clauses, identifying risks...</p>
                  </div>
                )}

                {scanResult && (
                  <Button variant="outline" className="w-full" onClick={() => { setScanResult(null); setFileName(""); }}>
                    <RefreshCw className="h-4 w-4 mr-2" />Scan Another Contract
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Risk Summary */}
            {scanResult && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <Badge className={`${getRiskColor(overallRisk)} text-lg px-4 py-2`}>
                      {getRiskIcon(overallRisk)}
                      <span className="ml-2 capitalize">{overallRisk} Risk</span>
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {scanResult.riskFlags.map((flag, i) => (
                      <div key={i} className={`p-3 rounded-lg ${getRiskColor(flag.level)}`}>
                        <div className="flex items-start gap-2">
                          {getRiskIcon(flag.level)}
                          <p className="text-sm">{flag.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {!scanResult && !isScanning && (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No contract scanned</h3>
                  <p className="text-muted-foreground">Upload a contract to see AI analysis results</p>
                </div>
              </Card>
            )}

            {isScanning && (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="relative">
                    <Sparkles className="h-16 w-16 mx-auto text-primary animate-pulse" />
                  </div>
                  <h3 className="text-lg font-medium mt-4">Analyzing Contract</h3>
                  <p className="text-muted-foreground">AI is extracting information and identifying risks...</p>
                </div>
              </Card>
            )}

            {scanResult && (
              <>
                {/* Extracted Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Extracted Information</CardTitle>
                    <CardDescription>Key details automatically extracted from the contract</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Users className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Parties</p>
                          {scanResult.parties.map((party, i) => (
                            <p key={i} className="font-medium">{party}</p>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Contract Value</p>
                          <p className="font-medium text-lg">{scanResult.value}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Calendar className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Contract Period</p>
                          <p className="font-medium">{scanResult.startDate} to {scanResult.endDate}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Clock className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Payment Terms</p>
                          <p className="font-medium">{scanResult.paymentTerms}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/30">
                      <p className="text-sm text-muted-foreground">Renewal Clause</p>
                      <p className="font-medium">{scanResult.renewalClause}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Clauses */}
                <Card>
                  <CardHeader>
                    <CardTitle>Key Clauses Analysis</CardTitle>
                    <CardDescription>Important clauses identified with risk assessment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {scanResult.keyClausesClauses.map((clause, i) => (
                        <div key={i} className="p-4 rounded-lg border border-border">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium">{clause.title}</h4>
                            <Badge className={getRiskColor(clause.risk)}>
                              {getRiskIcon(clause.risk)}
                              <span className="ml-1 capitalize">{clause.risk}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{clause.summary}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Ready to proceed with this contract?</p>
                      <div className="flex gap-2">
                        <Button variant="outline">Download Report</Button>
                        <Button onClick={() => navigate("/dashboard/clm/contracts/new")}>Create Contract</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
  );
}
