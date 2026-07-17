// app/(dashboard)/dashboard/workflows/real-estate-analysis/page.tsx
"use client";
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Separator } from '@repo/ui/components/separator';
import {
  Loader2,
  Sparkles,
  Home,
  Building2,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
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

interface VerdictVisual {
  icon: LucideIcon;
  badgeClass: string;
  heroClass: string;
  iconChipClass: string;
  summaryTextClass: string;
}

const VERDICT_VISUALS: Record<string, VerdictVisual> = {
  Buy: {
    icon: TrendingUp,
    badgeClass: 'bg-green-600 text-white',
    heroClass: 'bg-gradient-to-r from-green-50 via-emerald-50 to-white border-green-200',
    iconChipClass: 'bg-green-600 text-white',
    summaryTextClass: 'text-green-900',
  },
  Hold: {
    icon: AlertTriangle,
    badgeClass: 'bg-amber-500 text-white',
    heroClass: 'bg-gradient-to-r from-amber-50 via-yellow-50 to-white border-amber-200',
    iconChipClass: 'bg-amber-500 text-white',
    summaryTextClass: 'text-amber-900',
  },
  Pass: {
    icon: TrendingDown,
    badgeClass: 'bg-red-600 text-white',
    heroClass: 'bg-gradient-to-r from-red-50 via-rose-50 to-white border-red-200',
    iconChipClass: 'bg-red-600 text-white',
    summaryTextClass: 'text-red-900',
  },
};

const DEFAULT_VERDICT_VISUAL: VerdictVisual = {
  icon: Home,
  badgeClass: 'bg-gray-500 text-white',
  heroClass: 'bg-gradient-to-r from-gray-50 to-white border-gray-200',
  iconChipClass: 'bg-gray-500 text-white',
  summaryTextClass: 'text-gray-900',
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

function StatBlock({
  icon: Icon,
  iconChipClass,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  iconChipClass: string;
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconChipClass}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {helper && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
    </div>
  );
}

function RealEstateResult({ data }: { data: RealEstateAnalysisResult }) {
  const visual = VERDICT_VISUALS[data.verdict] || DEFAULT_VERDICT_VISUAL;
  const VerdictIcon = visual.icon;
  const cashFlowPositive = data.estimatedMonthlyCashFlow >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-pink-500" aria-hidden="true" />
          Investment Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span>Property type: {data.propertyType}</span>
        </div>

        <div className={`rounded-2xl border p-5 sm:p-6 ${visual.heroClass}`}>
          <div className="flex items-start gap-4">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${visual.iconChipClass}`}
            >
              <VerdictIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Verdict
                </span>
                <span
                  data-testid="verdict-badge"
                  className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${visual.badgeClass}`}
                >
                  {data.verdict}
                </span>
              </div>
              <p className={`mt-2 text-base sm:text-lg font-medium leading-snug ${visual.summaryTextClass}`}>
                {data.verdictSummary}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatBlock
            icon={Home}
            iconChipClass="bg-purple-100 text-purple-600"
            label="Estimated Value"
            value={formatCurrency(data.estimatedPropertyValue)}
          />
          <StatBlock
            icon={DollarSign}
            iconChipClass="bg-pink-100 text-pink-600"
            label="Estimated Monthly Rent"
            value={formatCurrency(data.estimatedMonthlyRent)}
          />
          <StatBlock
            icon={Percent}
            iconChipClass="bg-orange-100 text-orange-600"
            label="Cap Rate"
            value={`${data.capRatePercent}%`}
            helper={data.capRateExplanation}
          />
          <StatBlock
            icon={cashFlowPositive ? TrendingUp : TrendingDown}
            iconChipClass={cashFlowPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
            label="Monthly Cash Flow"
            value={formatCurrency(data.estimatedMonthlyCashFlow)}
            helper={data.cashFlowExplanation}
          />
        </div>

        <Separator />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Risks &amp; Red Flags
          </h3>
          <ul className="space-y-1.5 text-amber-900">
            {(data.risks || []).map((risk, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-purple-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Recommendation
          </h3>
          <p className="text-purple-950">{data.recommendation}</p>
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
