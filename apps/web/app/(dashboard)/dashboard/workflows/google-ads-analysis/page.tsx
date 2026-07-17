// app/(dashboard)/dashboard/workflows/google-ads-analysis/page.tsx
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

const WORKFLOW_KEY = 'google-ads-analysis';

// Mirrors workflow-templates/google-ads-analysis.json's sampleInput.campaign_data.
const SAMPLE_CAMPAIGN_DATA =
  "Campaign: 'Brand - Search'. Last 30 days: Impressions 42,300, Clicks 1,890 (CTR 4.5%), Avg CPC $1.85, Spend $3,496.50, Conversions 58 (Conv. rate 3.07%), Conversion value $8,700. Top keyword 'acme software pricing' has 210 clicks, 2 conversions.";

async function runGoogleAdsAnalysis(campaign_data: string): Promise<any> {
    const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflowKey: WORKFLOW_KEY, variables: { campaign_data } }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'An error occurred while analyzing the campaign data.');
    }

    return data;
}

export default function GoogleAdsAnalysisPage() {
    const [campaignData, setCampaignData] = useState('');
    const [result, setResult] = useState<any>(null);
    const [formError, setFormError] = useState('');
    const queryClient = useQueryClient();

    const runAnalysisMutation = useMutation({
        mutationFn: runGoogleAdsAnalysis,
        onSuccess: (data) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['team-limit'] });
            queryClient.invalidateQueries({ queryKey: ['workflow-history', WORKFLOW_KEY] });
        },
    });

    const loading = runAnalysisMutation.isPending;
    const error = formError || (runAnalysisMutation.isError
        ? (runAnalysisMutation.error instanceof Error ? runAnalysisMutation.error.message : 'An error occurred while analyzing the campaign data.')
        : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!campaignData.trim()) {
            setFormError('Please enter campaign performance data');
            return;
        }
        setFormError('');
        setResult(null);
        runAnalysisMutation.mutate(campaignData);
    };

    const handleLoadSample = () => {
        setCampaignData(SAMPLE_CAMPAIGN_DATA);
    };

    const handleSelectHistory = (input: string, output: string) => {
        setCampaignData(input);
        try {
            // Assuming output is a JSON string or already a JSON object
            const outputData = typeof output === 'string' ? JSON.parse(output) : output;
            setResult(outputData);
        } catch (err) {
            // If parsing fails, just set the raw output
            setResult({ result: output });
        }
    };

    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Google Ads Campaign Analysis
            </h1>
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Analyze Campaign Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center">
                                <Label htmlFor="campaign_data">Campaign performance data</Label>
                                <div className="flex items-center">
                                    <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
                                        Load sample
                                    </Button>
                                    <WorkflowHistoryDrawer workflowKey={WORKFLOW_KEY} onSelectHistory={handleSelectHistory} />
                                </div>
                            </div>
                            <Textarea
                                id="campaign_data"
                                value={campaignData}
                                onChange={(e) => setCampaignData(e.target.value)}
                                placeholder="Paste your Google Ads campaign performance data (impressions, clicks, CTR, CPC, conversions, spend, etc.)..."
                                rows={8}
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
                                'Analyze Campaign'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {result && <WorkflowResultDisplay title="Campaign Analysis" result={result} />}
        </section>
    );
}
