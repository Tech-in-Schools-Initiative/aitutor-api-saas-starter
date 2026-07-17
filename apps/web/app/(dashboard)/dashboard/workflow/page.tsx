// app/(dashboard)/dashboard/workflow/page.tsx
"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import StoryDisplay from '@/components/ai-tutor-api/StoryDisplay';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

async function runStory(story: string): Promise<any> {
    const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ story }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'An error occurred while fetching the story.');
    }

    return data;
}

export default function Workflow() {
    const [story, setStory] = useState('');
    const [result, setResult] = useState<any>(null);
    const [formError, setFormError] = useState('');
    const queryClient = useQueryClient();

    const runStoryMutation = useMutation({
        mutationFn: runStory,
        onSuccess: (data) => {
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['team-limit'] });
            queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
        },
    });

    const loading = runStoryMutation.isPending;
    const error = formError || (runStoryMutation.isError
        ? (runStoryMutation.error instanceof Error ? runStoryMutation.error.message : 'An error occurred while fetching the story.')
        : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!story.trim()) {
            setFormError('Please enter a story');
            return;
        }
        setFormError('');
        setResult(null);
        runStoryMutation.mutate(story);
    };

    const handleSelectHistory = (input: string, output: string) => {
        setStory(input);
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
                Workflow
            </h1>
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Generate a Story</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center">
                                <Label htmlFor="story">Enter your story prompt</Label>
                                <WorkflowHistoryDrawer onSelectHistory={handleSelectHistory} />
                            </div>
                            <Input
                                id="story"
                                type="text"
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                placeholder="E.g., Tell me a story about a magical forest..."
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-500" role="alert">{error}</p>
                        )}
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Story'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {result && <StoryDisplay result={result} />}
        </section>
    );
}
