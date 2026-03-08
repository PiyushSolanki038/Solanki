import { useOpportunities } from "@/modules/crm/hooks/useCRM";
import { OpportunityPipeline } from "@/modules/crm/components/OpportunityPipeline";

export default function PipelinePage() {
  const { data: opportunities = [], isLoading } = useOpportunities();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
    );
  }

  return (
    <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Sales Pipeline</h1><p className="text-muted-foreground">Drag and drop opportunities between stages</p></div>
        <OpportunityPipeline opportunities={opportunities} />
      </div>
  );
}
