// app/(dashboard)/dashboard/workflows/google-ads-analysis/page.tsx
"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import WorkflowResultDisplay from '@/components/ai-tutor-api/WorkflowResultDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

const WORKFLOW_KEY = 'google-ads-analysis';

// A real, stable, publicly-accessible marketing homepage with substantive
// content for the AI Tutor API's server-side URL-fetching input to analyze.
const SAMPLE_WEBSITE_URL = 'https://www.notion.com';

interface AdVariation {
  headline: string;
  description: string;
}

interface GoogleAdsResultData {
  companyName: string;
  industry: string;
  targetAudience: string;
  suggestedDailyBudget: string;
  keywords: string[];
  adVariations: AdVariation[];
}

function parseGoogleAdsResult(raw: unknown): GoogleAdsResultData | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.companyName === 'string' &&
      Array.isArray(parsed.adVariations) &&
      parsed.adVariations.length > 0
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
        <CardTitle>Campaign Proposal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{data.companyName}</h2>
          {data.industry && (
            <span className="rounded-full px-2 py-1 text-xs font-semibold text-white bg-blue-500">
              {data.industry}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatBlock label="Target Audience" value={data.targetAudience} />
          <StatBlock label="Suggested Daily Budget" value={data.suggestedDailyBudget} />
        </div>

        {Array.isArray(data.keywords) && data.keywords.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Keywords to Target</h3>
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((keyword, i) => (
                <span
                  key={i}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-white bg-blue-500"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(data.adVariations) && data.adVariations.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Proposed Ad Variations</h3>
            <div className="space-y-3">
              {data.adVariations.map((variation, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-blue-700 font-medium text-base">{variation.headline}</p>
                  <p className="text-sm text-gray-700 mt-1">{variation.description}</p>
                </div>
              ))}
            </div>
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
  return <WorkflowResultDisplay title="Campaign Proposal" result={{ result: raw }} />;
}

async function runGoogleAdsAnalysis(variables: { website_url: string }): Promise<any> {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflowKey: WORKFLOW_KEY, variables }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred while proposing the campaign.');
  }

  return data;
}

export default function GoogleAdsAnalysisPage() {
  const [websiteUrl, setWebsiteUrl] = useState('');
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
      : 'An error occurred while proposing the campaign.'
    : '';

  const isFilled = websiteUrl.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFilled) return;
    setResultRaw(null);
    runAnalysisMutation.mutate({ website_url: websiteUrl });
  };

  const handleLoadSample = () => {
    setWebsiteUrl(SAMPLE_WEBSITE_URL);
  };

  // History items are for viewing a past run's output only; we deliberately
  // leave the URL field alone rather than trying to reverse-parse it back
  // out of the stored history string.
  const handleSelectHistory = (_input: string, output: string) => {
    setResultRaw(output);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg lg:text-2xl font-medium text-gray-900">
          Google Ads Campaign Proposal
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
          <CardTitle>Propose a Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="website_url">Website URL</Label>
              <p className="text-sm text-muted-foreground mb-2">
                We&apos;ll analyze your website and propose a ready-to-launch Google Ads campaign.
              </p>
              <Input
                id="website_url"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500" role="alert">{error}</p>
            )}
            <Button type="submit" disabled={loading || !isFilled} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Proposing...
                </>
              ) : (
                'Propose Campaign'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {resultRaw && <GoogleAdsResultView raw={resultRaw} />}
    </section>
  );
}
