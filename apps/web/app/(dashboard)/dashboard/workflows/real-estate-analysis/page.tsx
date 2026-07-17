// app/(dashboard)/dashboard/workflows/real-estate-analysis/page.tsx
"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Textarea } from '@repo/ui/components/textarea';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import WorkflowResultDisplay from '@/components/ai-tutor-api/WorkflowResultDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

const WORKFLOW_KEY = 'real-estate-analysis';

// Matches workflow-templates/real-estate-analysis.json's sampleInput.property_details.
const SAMPLE_PROPERTY_DETAILS =
  '3-bed/2-bath single-family home in Austin, TX. Asking price $415,000. Estimated market rent $2,600/mo. Property taxes ~2.1%/yr. Built 1998, roof replaced 2019. HOA: none.';

async function runRealEstateAnalysis(propertyDetails: string): Promise<any> {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowKey: WORKFLOW_KEY,
      variables: { property_details: propertyDetails },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred while analyzing the property.');
  }

  return data;
}

export default function RealEstateAnalysis() {
  const [propertyDetails, setPropertyDetails] = useState('');
  const [result, setResult] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const queryClient = useQueryClient();

  const runAnalysisMutation = useMutation({
    mutationFn: runRealEstateAnalysis,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['team-limit'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history', WORKFLOW_KEY] });
    },
  });

  const loading = runAnalysisMutation.isPending;
  const error = formError || (runAnalysisMutation.isError
    ? (runAnalysisMutation.error instanceof Error ? runAnalysisMutation.error.message : 'An error occurred while analyzing the property.')
    : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyDetails.trim()) {
      setFormError('Please enter property details');
      return;
    }
    setFormError('');
    setResult(null);
    runAnalysisMutation.mutate(propertyDetails);
  };

  const handleLoadSample = () => {
    setPropertyDetails(SAMPLE_PROPERTY_DETAILS);
  };

  const handleSelectHistory = (input: string, output: string) => {
    setPropertyDetails(input);
    try {
      const outputData = typeof output === 'string' ? JSON.parse(output) : output;
      setResult(outputData);
    } catch (err) {
      setResult({ result: output });
    }
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Real Estate Investment Analysis
      </h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Analyze a Property</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="property_details">Property details</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
                    Load sample
                  </Button>
                  <WorkflowHistoryDrawer workflowKey={WORKFLOW_KEY} onSelectHistory={handleSelectHistory} />
                </div>
              </div>
              <Textarea
                id="property_details"
                value={propertyDetails}
                onChange={(e) => setPropertyDetails(e.target.value)}
                placeholder="E.g., 3-bed/2-bath single-family home, asking price, estimated rent, taxes, HOA..."
                rows={6}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500" role="alert">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Property'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && <WorkflowResultDisplay title="Investment Analysis" result={result} />}
    </section>
  );
}
