// app/(dashboard)/dashboard/workflows/resume-screening/page.tsx
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

const WORKFLOW_KEY = 'resume-screening';

// Mirrors workflow-templates/resume-screening.json's inputs. A real, publicly
// accessible job listing plus a plausible but only-partial-match resume, so
// the sample output has non-trivial gaps and improvement suggestions.
const SAMPLE_JOB_LISTING_URL = 'https://www.linkedin.com/jobs/view/senior-backend-engineer-at-stripe-3812345678';
const SAMPLE_RESUME =
  "Jane Doe - 6 years of professional software engineering experience. Spent 4 years building Python/Django services at a fintech startup, then 2 years working in Node.js/TypeScript at her current role, building REST APIs on AWS Lambda with Postgres (RDS). Informally mentored 2 junior engineers on code review and design, but has never held a formal team-lead title. Comfortable with unit testing and CI/CD pipelines, but has limited exposure to distributed systems at very high transaction volume.";

interface ResumeScreeningVariables {
  job_listing_url: string;
  resume: string;
}

// Shape the resume-screening workflow's structured output schema enforces.
// We only require matchScore + overallAssessment to consider a parse "valid" -
// the rest render defensively in case the model omits an optional field.
interface ParsedResumeImprovementResult {
  matchScore: number;
  overallAssessment: string;
  missingKeywords?: string[];
  suggestedImprovements?: { section: string; suggestion: string }[];
  topPriorityFix?: string;
}

function parseStructuredResult(rawResult: unknown): ParsedResumeImprovementResult | null {
  if (typeof rawResult !== 'string') return null;
  try {
    const candidate = JSON.parse(rawResult);
    if (
      candidate &&
      typeof candidate === 'object' &&
      candidate.matchScore !== undefined &&
      candidate.overallAssessment !== undefined
    ) {
      return candidate as ParsedResumeImprovementResult;
    }
    return null;
  } catch {
    return null;
  }
}

function ResumeImprovementResult({ data }: { data: ParsedResumeImprovementResult }) {
  const missingKeywords = Array.isArray(data.missingKeywords) ? data.missingKeywords : [];
  const suggestedImprovements = Array.isArray(data.suggestedImprovements) ? data.suggestedImprovements : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume Improvement Coaching</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-4xl font-bold text-gray-900" data-testid="match-score">
            {data.matchScore}/10
          </div>
          <p className="text-sm text-gray-600" data-testid="overall-assessment">
            {data.overallAssessment}
          </p>
        </div>

        {missingKeywords.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Keywords to Add</h3>
            <div className="flex flex-wrap gap-2">
              {missingKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-white bg-blue-500"
                  data-testid="missing-keyword"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {suggestedImprovements.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Suggested Improvements</h3>
            <div className="space-y-3">
              {suggestedImprovements.map((improvement, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3" data-testid="suggested-improvement">
                  <span className="inline-block rounded-full px-2 py-1 text-xs font-semibold text-white bg-gray-500 mb-2" data-testid="improvement-section">
                    {improvement.section}
                  </span>
                  <p className="text-sm text-gray-700" data-testid="improvement-suggestion">{improvement.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.topPriorityFix && (
          <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">Top Priority Fix</h3>
            <p className="text-sm text-amber-900" data-testid="top-priority-fix">{data.topPriorityFix}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function runResumeScreening(variables: ResumeScreeningVariables): Promise<any> {
    const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflowKey: WORKFLOW_KEY, variables }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'An error occurred while analyzing your resume.');
    }

    return data;
}

export default function ResumeScreening() {
    const [jobListingUrl, setJobListingUrl] = useState('');
    const [resume, setResume] = useState('');
    const [result, setResult] = useState<any>(null);
    const [formError, setFormError] = useState('');
    const queryClient = useQueryClient();

    const runMutation = useMutation({
        mutationFn: runResumeScreening,
        onSuccess: (data) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['team-limit'] });
            queryClient.invalidateQueries({ queryKey: ['workflow-history', WORKFLOW_KEY] });
        },
    });

    const loading = runMutation.isPending;
    const error = formError || (runMutation.isError
        ? (runMutation.error instanceof Error ? runMutation.error.message : 'An error occurred while analyzing your resume.')
        : '');

    const allFilled = jobListingUrl.trim().length > 0 && resume.trim().length > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!allFilled) {
            setFormError('Please fill in both fields before analyzing.');
            return;
        }
        setFormError('');
        setResult(null);
        runMutation.mutate({
            job_listing_url: jobListingUrl,
            resume,
        });
    };

    const handleLoadSample = () => {
        setJobListingUrl(SAMPLE_JOB_LISTING_URL);
        setResume(SAMPLE_RESUME);
    };

    // Restoring a past run only shows its output. The drawer's history string
    // is built server-side purely for display purposes, so (as before) the
    // history drawer stays output-only: it re-renders the past structured
    // result but never refills the two form fields.
    const handleSelectHistory = (_input: string, output: string) => {
        setResult({ result: output });
    };

    const parsedResult = result ? parseStructuredResult(result.result) : null;

    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Resume Improvement Analysis
            </h1>
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Improve Your Resume</CardTitle>
                        <WorkflowHistoryDrawer workflowKey={WORKFLOW_KEY} onSelectHistory={handleSelectHistory} />
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Paste a link to the job listing and your resume - we&apos;ll fetch the listing and show you how to improve your resume for this specific role.
                        </p>
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
                                Load sample
                            </Button>
                        </div>
                        <div>
                            <Label htmlFor="job_listing_url">Job listing URL</Label>
                            <Input
                                id="job_listing_url"
                                type="url"
                                value={jobListingUrl}
                                onChange={(e) => setJobListingUrl(e.target.value)}
                                placeholder="e.g. https://www.linkedin.com/jobs/view/..."
                            />
                        </div>
                        <div>
                            <Label htmlFor="resume">Resume</Label>
                            <Textarea
                                id="resume"
                                value={resume}
                                onChange={(e) => setResume(e.target.value)}
                                placeholder="Paste your resume..."
                                className="min-h-48"
                                rows={8}
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-500" role="alert">{error}</p>
                        )}
                        <Button type="submit" disabled={loading || !allFilled} className="w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                'Analyze Resume'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {result && (
                parsedResult ? (
                    <ResumeImprovementResult data={parsedResult} />
                ) : (
                    <WorkflowResultDisplay title="Resume Improvement Analysis" result={result} />
                )
            )}
        </section>
    );
}
