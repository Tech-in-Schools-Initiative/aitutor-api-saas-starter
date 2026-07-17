// app/(dashboard)/dashboard/workflows/real-estate-analysis/page.tsx
"use client";
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Textarea } from '@repo/ui/components/textarea';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import WorkflowResultDisplay from '@/components/ai-tutor-api/WorkflowResultDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

const WORKFLOW_KEY = 'real-estate-analysis';

// A single internally-consistent sample (small duplex, modest but plausible
// cap rate) mirroring workflow-templates/real-estate-analysis.json's inputs.
const SAMPLE_PROPERTY_ADDRESS = '482 Maple Street, Columbus, OH 43215';
const SAMPLE_PROPERTY_TYPE = 'Duplex (2 units, side-by-side)';
const SAMPLE_ASKING_PRICE = '$310,000';
const SAMPLE_ESTIMATED_MONTHLY_RENT = '$2,400 combined ($1,200/unit)';
const SAMPLE_ANNUAL_PROPERTY_TAXES = '$4,650';
const SAMPLE_MONTHLY_HOA = '0';
const SAMPLE_NOTABLE_FEATURES =
  'Built 1985, both units renovated in 2021 (new kitchens, flooring). Separate utility meters. New roof in 2023. Unit A has a long-term tenant on a month-to-month lease at $1,050/mo (below market); Unit B is vacant and move-in ready.';

interface RealEstateAnalysisVariables {
  property_address: string;
  property_type: string;
  asking_price: string;
  estimated_monthly_rent: string;
  annual_property_taxes: string;
  monthly_hoa: string;
  notable_features: string;
}

interface RealEstateAnalysisResult {
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
  const [propertyType, setPropertyType] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [estimatedMonthlyRent, setEstimatedMonthlyRent] = useState('');
  const [annualPropertyTaxes, setAnnualPropertyTaxes] = useState('');
  const [monthlyHoa, setMonthlyHoa] = useState('');
  const [notableFeatures, setNotableFeatures] = useState('');
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

  const allFieldsFilled =
    propertyAddress.trim().length > 0 &&
    propertyType.trim().length > 0 &&
    askingPrice.trim().length > 0 &&
    estimatedMonthlyRent.trim().length > 0 &&
    annualPropertyTaxes.trim().length > 0 &&
    monthlyHoa.trim().length > 0 &&
    notableFeatures.trim().length > 0;

  const parsedResult = useMemo(() => parseAnalysisResult(output), [output]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFieldsFilled) {
      setFormError('Please fill in all fields');
      return;
    }
    setFormError('');
    setOutput(null);
    runAnalysisMutation.mutate({
      property_address: propertyAddress,
      property_type: propertyType,
      asking_price: askingPrice,
      estimated_monthly_rent: estimatedMonthlyRent,
      annual_property_taxes: annualPropertyTaxes,
      monthly_hoa: monthlyHoa,
      notable_features: notableFeatures,
    });
  };

  const handleLoadSample = () => {
    setPropertyAddress(SAMPLE_PROPERTY_ADDRESS);
    setPropertyType(SAMPLE_PROPERTY_TYPE);
    setAskingPrice(SAMPLE_ASKING_PRICE);
    setEstimatedMonthlyRent(SAMPLE_ESTIMATED_MONTHLY_RENT);
    setAnnualPropertyTaxes(SAMPLE_ANNUAL_PROPERTY_TAXES);
    setMonthlyHoa(SAMPLE_MONTHLY_HOA);
    setNotableFeatures(SAMPLE_NOTABLE_FEATURES);
  };

  // Restoring a past run only shows its output. The history drawer joins all
  // 7 fields into a single "key: value"-per-line string purely for display
  // purposes; reverse-parsing that back into 7 independent form fields would
  // be fragile and isn't attempted here. This is a deliberate scope decision.
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
              <Input
                id="property_address"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="123 Main St, Anytown, USA"
              />
            </div>
            <div>
              <Label htmlFor="property_type">Property type (e.g. single-family, duplex, condo)</Label>
              <Input
                id="property_type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                placeholder="Single-family"
              />
            </div>
            <div>
              <Label htmlFor="asking_price">Asking price</Label>
              <Input
                id="asking_price"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="$350,000"
              />
            </div>
            <div>
              <Label htmlFor="estimated_monthly_rent">Estimated monthly rent</Label>
              <Input
                id="estimated_monthly_rent"
                value={estimatedMonthlyRent}
                onChange={(e) => setEstimatedMonthlyRent(e.target.value)}
                placeholder="$2,200"
              />
            </div>
            <div>
              <Label htmlFor="annual_property_taxes">Annual property taxes</Label>
              <Input
                id="annual_property_taxes"
                value={annualPropertyTaxes}
                onChange={(e) => setAnnualPropertyTaxes(e.target.value)}
                placeholder="$4,000"
              />
            </div>
            <div>
              <Label htmlFor="monthly_hoa">Monthly HOA fee (0 if none)</Label>
              <Input
                id="monthly_hoa"
                value={monthlyHoa}
                onChange={(e) => setMonthlyHoa(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="notable_features">Notable features / condition notes</Label>
              <Textarea
                id="notable_features"
                value={notableFeatures}
                onChange={(e) => setNotableFeatures(e.target.value)}
                placeholder="Roof age, renovations, tenant situation, etc."
                rows={4}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500" role="alert">{error}</p>
            )}
            <Button type="submit" disabled={loading || !allFieldsFilled} className="w-full">
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
