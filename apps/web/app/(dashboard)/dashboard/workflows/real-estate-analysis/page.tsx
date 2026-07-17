// app/(dashboard)/dashboard/workflows/real-estate-analysis/page.tsx
"use client";
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import WorkflowResultDisplay from '@/components/ai-tutor-api/WorkflowResultDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

const WORKFLOW_KEY = 'real-estate-analysis';

// A real, identifiable residential address in a mid-size US city, mirroring
// the single input in workflow-templates/real-estate-analysis.json. The model
// researches everything else itself via web search.
const SAMPLE_PROPERTY_ADDRESS = '1600 Pennsylvania Avenue NW, Washington, DC 20500';

interface RealEstateAnalysisVariables {
  property_address: string;
}

interface RealEstateAnalysisResult {
  estimatedPropertyValue: number;
  estimatedMonthlyRent: number;
  propertyType: string;
  verdict: 'Buy' | 'Hold' | 'Pass';
  verdictSummary: string;
  capRatePercent: number;
  capRateExplanation: string;
  estimatedMonthlyCashFlow: number;
  cashFlowExplanation: string;
  risks: string[];
  recommendation: string;
}

// Attempts to parse the model's raw response text into the structured shape.
// Returns null (rather than throwing) on invalid JSON or a missing minimum
// set of keys, so callers can fall back to the markdown-oriented display.
function parseAnalysisResult(raw: string | null): RealEstateAnalysisResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.verdict && parsed.recommendation) {
      return parsed as RealEstateAnalysisResult;
    }
    return null;
  } catch {
    return null;
  }
}

const VERDICT_STYLES: Record<string, string> = {
  Buy: 'bg-green-500 text-white',
  Hold: 'bg-amber-500 text-white',
  Pass: 'bg-red-500 text-white',
};

function formatCurrency(value: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return String(value);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

function RealEstateResult({ data }: { data: RealEstateAnalysisResult }) {
  const badgeClass = VERDICT_STYLES[data.verdict] || 'bg-gray-500 text-white';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Estimated Value</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(data.estimatedPropertyValue)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Estimated Monthly Rent</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(data.estimatedMonthlyRent)}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500">Property type: {data.propertyType}</p>

        <div>
          <span
            data-testid="verdict-badge"
            className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}
          >
            {data.verdict}
          </span>
          <p className="mt-3 text-gray-700">{data.verdictSummary}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Cap Rate</p>
            <p className="text-2xl font-semibold text-gray-900">{data.capRatePercent}%</p>
            <p className="mt-1 text-sm text-gray-500">{data.capRateExplanation}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Monthly Cash Flow</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(data.estimatedMonthlyCashFlow)}
            </p>
            <p className="mt-1 text-sm text-gray-500">{data.cashFlowExplanation}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Risks &amp; Red Flags</h3>
          <ul className="list-disc pl-5 space-y-1 text-gray-700">
            {(data.risks || []).map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Recommendation</h3>
          <p className="text-blue-900">{data.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}

async function runRealEstateAnalysis(variables: RealEstateAnalysisVariables): Promise<any> {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflowKey: WORKFLOW_KEY, variables }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred while analyzing the property.');
  }

  return data;
}

export default function RealEstateAnalysis() {
  const [propertyAddress, setPropertyAddress] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const queryClient = useQueryClient();

  const runAnalysisMutation = useMutation({
    mutationFn: runRealEstateAnalysis,
    onSuccess: (data) => {
      const raw = typeof data?.result === 'string' ? data.result : JSON.stringify(data);
      setOutput(raw);
      queryClient.invalidateQueries({ queryKey: ['team-limit'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history', WORKFLOW_KEY] });
    },
  });

  const loading = runAnalysisMutation.isPending;
  const error =
    formError ||
    (runAnalysisMutation.isError
      ? runAnalysisMutation.error instanceof Error
        ? runAnalysisMutation.error.message
        : 'An error occurred while analyzing the property.'
      : '');

  const isFilled = propertyAddress.trim().length > 0;

  const parsedResult = useMemo(() => parseAnalysisResult(output), [output]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFilled) {
      setFormError('Please enter a property address');
      return;
    }
    setFormError('');
    setOutput(null);
    runAnalysisMutation.mutate({
      property_address: propertyAddress,
    });
  };

  const handleLoadSample = () => {
    setPropertyAddress(SAMPLE_PROPERTY_ADDRESS);
  };

  // Restoring a past run only shows its output; the address field is
  // deliberately left untouched, consistent with this repo's pattern for
  // these workflow pages.
  const handleSelectHistory = (_input: string, historyOutput: string) => {
    setOutput(historyOutput);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Real Estate Investment Analysis
      </h1>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Analyze a Property</CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
                Load sample
              </Button>
              <WorkflowHistoryDrawer workflowKey={WORKFLOW_KEY} onSelectHistory={handleSelectHistory} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="property_address">Property address</Label>
              <p className="text-sm text-gray-500 mb-2">
                We&apos;ll search the web for market value, rent estimates, and tax data automatically.
              </p>
              <Input
                id="property_address"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="123 Main St, Anytown, USA"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500" role="alert">{error}</p>
            )}
            <Button type="submit" disabled={loading || !isFilled} className="w-full">
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

      {output !== null &&
        (parsedResult ? (
          <RealEstateResult data={parsedResult} />
        ) : (
          <WorkflowResultDisplay title="Investment Analysis" result={{ result: output }} />
        ))}
    </section>
  );
}
