// app/(dashboard)/dashboard/workflows/google-ads-analysis/page.tsx
"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Textarea } from '@repo/ui/components/textarea';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import WorkflowResultDisplay from '@/components/ai-tutor-api/WorkflowResultDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

const WORKFLOW_KEY = 'google-ads-analysis';

// Mirrors workflow-templates/google-ads-analysis.json's `inputs` array.
// Order, `name`, and `label` must stay in sync with that file.
const FIELDS = [
  { name: 'campaign_name', label: 'Campaign name', kind: 'input' },
  { name: 'impressions', label: 'Impressions', kind: 'input' },
  { name: 'clicks', label: 'Clicks', kind: 'input' },
  { name: 'spend', label: 'Spend', kind: 'input' },
  { name: 'conversions', label: 'Conversions', kind: 'input' },
  { name: 'conversion_value', label: 'Conversion value', kind: 'input' },
  { name: 'top_keyword_data', label: 'Top keyword performance (name, clicks, conversions)', kind: 'textarea' },
] as const;

type FieldName = (typeof FIELDS)[number]['name'];
type FormValues = Record<FieldName, string>;

const EMPTY_FORM_VALUES: FormValues = {
  campaign_name: '',
  impressions: '',
  clicks: '',
  spend: '',
  conversions: '',
  conversion_value: '',
  top_keyword_data: '',
};

// A single, internally-consistent sample campaign:
// 48,200 impressions, 2,532 clicks -> CTR 5.25%
// $4,545.24 spend / 2,532 clicks -> CPC $1.80
// 121 conversions / 2,532 clicks -> conv. rate 4.78%
// $19,360 conversion value / $4,545.24 spend -> ROAS ~4.26x
const SAMPLE_VALUES: FormValues = {
  campaign_name: 'Search - Non-Brand - Project Management Software',
  impressions: '48200',
  clicks: '2532',
  spend: '4545.24',
  conversions: '121',
  conversion_value: '19360.00',
  top_keyword_data: "'project management software' - 640 clicks, 41 conversions",
};

interface GoogleAdsResultData {
  performanceSummary: string;
  ctr: string;
  cpc: string;
  conversionRate: string;
  roas: string;
  workingWell: string[];
  underperforming: { issue: string; rootCause: string }[];
  recommendedActions: string[];
  nextTest: string;
}

function parseGoogleAdsResult(raw: unknown): GoogleAdsResultData | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.performanceSummary === 'string' &&
      Array.isArray(parsed.recommendedActions)
    ) {
      return parsed as GoogleAdsResultData;
    }
    return null;
  } catch {
    return null;
  }
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function GoogleAdsResult({ data }: { data: GoogleAdsResultData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-gray-700">{data.performanceSummary}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock label="CTR" value={data.ctr} />
          <StatBlock label="Avg. CPC" value={data.cpc} />
          <StatBlock label="Conv. Rate" value={data.conversionRate} />
          <StatBlock label="ROAS" value={data.roas} />
        </div>

        {Array.isArray(data.workingWell) && data.workingWell.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What&apos;s Working</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              {data.workingWell.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(data.underperforming) && data.underperforming.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What&apos;s Underperforming</h3>
            <ul className="space-y-2">
              {data.underperforming.map((item, i) => (
                <li key={i}>
                  <p className="text-gray-800 font-medium">{item.issue}</p>
                  <p className="text-sm text-muted-foreground">{item.rootCause}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(data.recommendedActions) && data.recommendedActions.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Recommended Actions</h3>
            <ol className="list-decimal pl-6 space-y-1 text-gray-700">
              {data.recommendedActions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        )}

        {data.nextTest && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Suggested Next Test</p>
            <p className="text-sm text-blue-800">{data.nextTest}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleAdsResultView({ raw }: { raw: string }) {
  const parsed = parseGoogleAdsResult(raw);
  if (parsed) {
    return <GoogleAdsResult data={parsed} />;
  }
  return <WorkflowResultDisplay title="Campaign Analysis" result={{ result: raw }} />;
}

async function runGoogleAdsAnalysis(variables: FormValues): Promise<any> {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflowKey: WORKFLOW_KEY, variables }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred while analyzing the campaign data.');
  }

  return data;
}

export default function GoogleAdsAnalysisPage() {
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM_VALUES);
  const [resultRaw, setResultRaw] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const runAnalysisMutation = useMutation({
    mutationFn: runGoogleAdsAnalysis,
    onSuccess: (data) => {
      setResultRaw(data.result);
      queryClient.invalidateQueries({ queryKey: ['team-limit'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history', WORKFLOW_KEY] });
    },
  });

  const loading = runAnalysisMutation.isPending;
  const error = runAnalysisMutation.isError
    ? runAnalysisMutation.error instanceof Error
      ? runAnalysisMutation.error.message
      : 'An error occurred while analyzing the campaign data.'
    : '';

  const allFieldsFilled = FIELDS.every((field) => formValues[field.name].trim().length > 0);

  const handleChange = (name: FieldName, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFieldsFilled) return;
    setResultRaw(null);
    runAnalysisMutation.mutate(formValues);
  };

  const handleLoadSample = () => {
    setFormValues(SAMPLE_VALUES);
  };

  // History items are for viewing a past run's output only. The stored
  // `input` is a server-built "key: value" per-line join meant for display
  // in the history list, not something meant to be reverse-parsed back into
  // the 7 individual form fields, so we deliberately leave the form alone.
  const handleSelectHistory = (_input: string, output: string) => {
    setResultRaw(output);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900">
          Google Ads Campaign Analysis
        </h1>
        <div className="flex items-center">
          <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
            Load sample
          </Button>
          <WorkflowHistoryDrawer workflowKey={WORKFLOW_KEY} onSelectHistory={handleSelectHistory} />
        </div>
      </div>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Analyze Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <Label htmlFor={field.name}>{field.label}</Label>
                {field.kind === 'textarea' ? (
                  <Textarea
                    id={field.name}
                    value={formValues[field.name]}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    rows={4}
                  />
                ) : (
                  <Input
                    id={field.name}
                    value={formValues[field.name]}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
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
                'Analyze Campaign'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {resultRaw && <GoogleAdsResultView raw={resultRaw} />}
    </section>
  );
}
