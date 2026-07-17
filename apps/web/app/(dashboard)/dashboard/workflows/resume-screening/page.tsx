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

// Mirrors workflow-templates/resume-screening.json's inputs. A realistic,
// internally-consistent but only partial match, so the sample output has an
// interesting (non-trivial) fit score, real gaps, and real interview questions.
const SAMPLE_JOB_TITLE = 'Senior Backend Engineer';
const SAMPLE_MUST_HAVE_SKILLS = 'Node.js, TypeScript, PostgreSQL, AWS, and experience leading a small team';
const SAMPLE_YEARS_EXPERIENCE_REQUIRED = '5+ years';
const SAMPLE_JOB_DESCRIPTION =
  "We're hiring a Senior Backend Engineer to own our core payments API. You'll design and maintain services handling millions of transactions per day, mentor junior engineers, and partner with product on technical roadmap. Formal people-management experience is not required, but you should be comfortable guiding a small group of engineers on design and code quality.";
const SAMPLE_RESUME =
  "Jane Doe - 6 years of professional experience. 4 years building Python/Django services at a fintech startup, followed by 2 years working in Node.js/TypeScript at her current role, building REST APIs on AWS Lambda with Postgres (RDS). Informally mentored 2 junior engineers on code review and design, but has never held a formal team-lead title.";

interface ResumeScreeningVariables {
  job_title: string;
  must_have_skills: string;
  years_experience_required: string;
  job_description: string;
  resume: string;
}

// Shape the resume-screening workflow's prompt template asks the model for.
// We only require fitScore + recommendation to consider a parse "valid" -
// the rest render defensively in case the model omits an optional field.
interface ParsedResumeScreeningResult {
  fitScore: number;
  fitScoreReason?: string;
  matchingStrengths?: string[];
  gaps?: string[];
  interviewQuestions?: string[];
  recommendation: string;
  recommendationReason?: string;
}

function parseStructuredResult(rawResult: unknown): ParsedResumeScreeningResult | null {
  if (typeof rawResult !== 'string') return null;
  try {
    const candidate = JSON.parse(rawResult);
    if (
      candidate &&
      typeof candidate === 'object' &&
      candidate.fitScore !== undefined &&
      candidate.recommendation !== undefined
    ) {
      return candidate as ParsedResumeScreeningResult;
    }
    return null;
  } catch {
    return null;
  }
}

function recommendationBadgeClass(recommendation: string): string {
  switch (recommendation) {
    case 'Advance':
      return 'bg-green-500';
    case 'Maybe':
      return 'bg-amber-500';
    case 'Pass':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function ResumeScreeningResult({ data }: { data: ParsedResumeScreeningResult }) {
  const matchingStrengths = Array.isArray(data.matchingStrengths) ? data.matchingStrengths : [];
  const gaps = Array.isArray(data.gaps) ? data.gaps : [];
  const interviewQuestions = Array.isArray(data.interviewQuestions) ? data.interviewQuestions : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Fit Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-4xl font-bold text-gray-900" data-testid="fit-score">
            {data.fitScore}/10
          </div>
          {data.fitScoreReason && (
            <p className="text-sm text-gray-600" data-testid="fit-score-reason">
              {data.fitScoreReason}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold text-white ${recommendationBadgeClass(
              data.recommendation
            )}`}
            data-testid="recommendation-badge"
          >
            {data.recommendation}
          </span>
          {data.recommendationReason && (
            <p className="text-sm text-gray-600" data-testid="recommendation-reason">
              {data.recommendationReason}
            </p>
          )}
        </div>

        {matchingStrengths.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Matching Strengths</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700">
              {matchingStrengths.map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </div>
        )}

        {gaps.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Gaps or Concerns</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700">
              {gaps.map((gap, index) => (
                <li key={index}>{gap}</li>
              ))}
            </ul>
          </div>
        )}

        {interviewQuestions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Suggested Interview Questions</h3>
            <ol className="list-decimal pl-6 space-y-1 text-sm text-gray-700">
              {interviewQuestions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ol>
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
        throw new Error(data.error || 'An error occurred while analyzing the candidate.');
    }

    return data;
}

export default function ResumeScreening() {
    const [jobTitle, setJobTitle] = useState('');
    const [mustHaveSkills, setMustHaveSkills] = useState('');
    const [yearsExperienceRequired, setYearsExperienceRequired] = useState('');
    const [jobDescription, setJobDescription] = useState('');
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
        ? (runMutation.error instanceof Error ? runMutation.error.message : 'An error occurred while analyzing the candidate.')
        : '');

    const allFilled =
        jobTitle.trim().length > 0 &&
        mustHaveSkills.trim().length > 0 &&
        yearsExperienceRequired.trim().length > 0 &&
        jobDescription.trim().length > 0 &&
        resume.trim().length > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!allFilled) {
            setFormError('Please fill in all fields before analyzing.');
            return;
        }
        setFormError('');
        setResult(null);
        runMutation.mutate({
            job_title: jobTitle,
            must_have_skills: mustHaveSkills,
            years_experience_required: yearsExperienceRequired,
            job_description: jobDescription,
            resume,
        });
    };

    const handleLoadSample = () => {
        setJobTitle(SAMPLE_JOB_TITLE);
        setMustHaveSkills(SAMPLE_MUST_HAVE_SKILLS);
        setYearsExperienceRequired(SAMPLE_YEARS_EXPERIENCE_REQUIRED);
        setJobDescription(SAMPLE_JOB_DESCRIPTION);
        setResume(SAMPLE_RESUME);
    };

    // Restoring a past run only shows its output. The drawer's history string
    // is a single joined "key: value"-per-line string built server-side purely
    // for display purposes - splitting it back into 5 independent form fields
    // would need a fragile reverse-parse, so (as with this page's previous,
    // 2-field version) the history drawer stays output-only: it re-renders the
    // past structured result but never refills the inputs.
    const handleSelectHistory = (_input: string, output: string) => {
        setResult({ result: output });
    };

    const parsedResult = result ? parseStructuredResult(result.result) : null;

    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Resume &amp; Candidate Fit Analysis
            </h1>
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Analyze a Candidate</CardTitle>
                        <WorkflowHistoryDrawer workflowKey={WORKFLOW_KEY} onSelectHistory={handleSelectHistory} />
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={handleLoadSample}>
                                Load sample
                            </Button>
                        </div>
                        <div>
                            <Label htmlFor="job_title">Job title</Label>
                            <Input
                                id="job_title"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                placeholder="e.g. Senior Backend Engineer"
                            />
                        </div>
                        <div>
                            <Label htmlFor="must_have_skills">Must-have skills</Label>
                            <Input
                                id="must_have_skills"
                                value={mustHaveSkills}
                                onChange={(e) => setMustHaveSkills(e.target.value)}
                                placeholder="e.g. Node.js, TypeScript, AWS"
                            />
                        </div>
                        <div>
                            <Label htmlFor="years_experience_required">Years of experience required</Label>
                            <Input
                                id="years_experience_required"
                                value={yearsExperienceRequired}
                                onChange={(e) => setYearsExperienceRequired(e.target.value)}
                                placeholder="e.g. 5+ years"
                            />
                        </div>
                        <div>
                            <Label htmlFor="job_description">Full job description</Label>
                            <Textarea
                                id="job_description"
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the full job description..."
                                className="min-h-32"
                                rows={6}
                            />
                        </div>
                        <div>
                            <Label htmlFor="resume">Candidate resume</Label>
                            <Textarea
                                id="resume"
                                value={resume}
                                onChange={(e) => setResume(e.target.value)}
                                placeholder="Paste the candidate's resume..."
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
                                'Analyze Fit'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {result && (
                parsedResult ? (
                    <ResumeScreeningResult data={parsedResult} />
                ) : (
                    <WorkflowResultDisplay title="Candidate Fit Analysis" result={result} />
                )
            )}
        </section>
    );
}
