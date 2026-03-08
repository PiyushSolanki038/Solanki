"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Send, Search, Eye, Loader2, PenTool } from "lucide-react";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";

interface PendingSignature {
  id: string;
  signer_name: string | null;
  signer_email: string | null;
  created_at: string | null;
  contracts: {
    contract_number: string | null;
  } | null;
}

export default function CustomerPendingSignaturesPage() {
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSignatures = async () => {
      if (!user?.email) return;
      
      setIsLoading(true);
      const { data, error } = await supabase
        .from("contract_esignatures")
        .select("*, contracts:contracts(contract_number)")
        .eq("signer_email", user.email)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSignatures(data);
      }
      setIsLoading(false);
    };

    fetchSignatures();
  }, [user?.email]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pending Signatures</h1>
          <p className="text-muted-foreground">Documents waiting for your signature</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {signatures.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending signatures</h3>
              <p className="text-muted-foreground">You don't have any documents waiting for your signature.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Signer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.map((sig) => (
                  <TableRow key={sig.id}>
                    <TableCell className="font-medium">
                      {sig.contracts?.contract_number || "N/A"}
                    </TableCell>
                    <TableCell>{sig.signer_name || sig.signer_email}</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                    </TableCell>
                    <TableCell>{sig.created_at ? new Date(sig.created_at).toLocaleDateString() : "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/portal/pending-signatures/${sig.id}`}>
                          <PenTool className="h-4 w-4 mr-1" />
                          Sign
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
