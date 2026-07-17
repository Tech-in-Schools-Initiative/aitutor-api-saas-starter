// app/(dashboard)/dashboard/workflows/resume-screening/page.tsx
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

const WORKFLOW_KEY = 'resume-screening';

// Mirrors workflow-templates/resume-screening.json's sampleInput.
const SAMPLE_JOB_DESCRIPTION =
  'Senior Backend Engineer, needs 5+ years Node.js/TypeScript, Postgres, AWS, and experience leading a small team.';
const SAMPLE_RESUME =
  "Jane Doe - 6 years experience. 4 years Python/Django at a fintech startup, 2 years Node.js/TypeScript at current role building REST APIs on AWS Lambda with Postgres (RDS). Mentored 2 junior engineers informally. No formal team-lead title.";

interface ResumeScreeningVariables {
  job_description: string;
  resume: string;
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

    const bothFilled = jobDescription.trim().length > 0 && resume.trim().length > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!bothFilled) {
            setFormError('Please enter both the job description and the resume');
            return;
        }
        setFormError('');
        setResult(null);
        runMutation.mutate({ job_description: jobDescription, resume });
    };

    const handleLoadSample = () => {
        setJobDescription(SAMPLE_JOB_DESCRIPTION);
        setResume(SAMPLE_RESUME);
    };

    // Restoring a past run only shows its output. Splitting the drawer's
    // single joined "job_description: ...\n\nresume: ..." history string back
    // into two independent form fields would need a fragile parse, so the
    // history drawer stays informational-only for this two-variable page.
    const handleSelectHistory = (_input: string, output: string) => {
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
                            <Label htmlFor="job_description">Job description</Label>
                            <Textarea
                                id="job_description"
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the job description..."
                                className="min-h-32"
                            />
                        </div>
                        <div>
                            <Label htmlFor="resume">Resume</Label>
                            <Textarea
                                id="resume"
                                value={resume}
                                onChange={(e) => setResume(e.target.value)}
                                placeholder="Paste the candidate's resume..."
                                className="min-h-32"
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-500" role="alert">{error}</p>
                        )}
                        <Button type="submit" disabled={loading || !bothFilled} className="w-full">
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

            {result && <WorkflowResultDisplay title="Candidate Fit Analysis" result={result} />}
        </section>
    );
}
