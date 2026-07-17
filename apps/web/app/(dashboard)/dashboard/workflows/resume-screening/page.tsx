// app/(dashboard)/dashboard/workflows/resume-screening/page.tsx
"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Textarea } from '@repo/ui/components/textarea';
import { Label } from '@repo/ui/components/label';
import { Separator } from '@repo/ui/components/separator';
import {
  Loader2,
  Sparkles,
  Target,
  Lightbulb,
  AlertCircle,
  FileText,
} from 'lucide-react';
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

// Ring/typography treatment for the hero match-score metric. Thresholds are
// deliberately coarse (>=8 strong, >=5 mixed, below that needs work) since the
// score itself is only ever an integer 0-10.
function getScoreTone(score: number) {
  if (score >= 8) {
    return { ring: 'text-emerald-500', text: 'text-emerald-600', label: 'Strong match' };
  }
  if (score >= 5) {
    return { ring: 'text-amber-500', text: 'text-amber-600', label: 'Partial match' };
  }
  return { ring: 'text-red-500', text: 'text-red-600', label: 'Needs work' };
}

function MatchScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(10, score));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - clamped / 10);
  const tone = getScoreTone(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className={tone.ring}
          />
        </svg>
        <div className={`absolute text-2xl font-extrabold ${tone.text}`} data-testid="match-score">
          {score}/10
        </div>
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>{tone.label}</span>
    </div>
  );
}

function ResumeImprovementResult({ data }: { data: ParsedResumeImprovementResult }) {
  const missingKeywords = Array.isArray(data.missingKeywords) ? data.missingKeywords : [];
  const suggestedImprovements = Array.isArray(data.suggestedImprovements) ? data.suggestedImprovements : [];

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" aria-hidden="true" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-pink-500" aria-hidden="true" />
          Resume Improvement Coaching
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <MatchScoreRing score={data.matchScore} />
          <p className="text-sm leading-relaxed text-gray-600" data-testid="overall-assessment">
            {data.overallAssessment}
          </p>
        </div>

        {missingKeywords.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                <Target className="h-4 w-4 text-pink-500" aria-hidden="true" />
                Keywords to Add
              </h3>
              <div className="flex flex-wrap gap-2">
                {missingKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 shadow-sm"
                    data-testid="missing-keyword"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {suggestedImprovements.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                <Lightbulb className="h-4 w-4 text-pink-500" aria-hidden="true" />
                Suggested Improvements
              </h3>
              <div className="space-y-3">
                {suggestedImprovements.map((improvement, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg border border-gray-200 bg-gray-50/60 p-3 pl-4 overflow-hidden"
                    data-testid="suggested-improvement"
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-500 via-pink-500 to-orange-500"
                      aria-hidden="true"
                    />
                    <span
                      className="block text-xs font-semibold uppercase tracking-wide text-pink-600 mb-1"
                      data-testid="improvement-section"
                    >
                      {improvement.section}
                    </span>
                    <p className="text-sm text-gray-700" data-testid="improvement-suggestion">{improvement.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {data.topPriorityFix && (
          <>
            <Separator />
            <div className="rounded-lg border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">Top Priority Fix</h3>
                  <p className="text-sm text-amber-900" data-testid="top-priority-fix">{data.topPriorityFix}</p>
                </div>
              </div>
            </div>
          </>
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
            <h1 className="flex items-center gap-2 text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                <FileText className="h-5 w-5 lg:h-6 lg:w-6 text-pink-500" aria-hidden="true" />
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
