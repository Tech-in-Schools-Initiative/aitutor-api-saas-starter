// app/(dashboard)/dashboard/workflow/page.tsx
"use client";
import { useState } from 'react';
import StoryDisplay from '@/components/ai-tutor-api/StoryDisplay';
import Link from 'next/link';
import { WorkflowHistoryDrawer } from '@/components/workflow/WorkflowHistoryDrawer';

export default function Workflow() {
    const [story, setStory] = useState('');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!story.trim()) {
            setError('Please enter a story');
            return;
        }
        setError('');
        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ story }),
            });

            const data = await response.json();

            if (response.ok) {
                setResult(data);
                setError('');
            } else {
                setError(data.error || 'An error occurred while fetching the story.');
            }
        } catch (err) {
            setError('An error occurred while fetching the story.');
        } finally {
            setLoading(false);
        }
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
        <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8 p-8">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text inline-block" 
                        style={{ lineHeight: '1.5', padding: '0.5em 0' }}>
                        AI Story Generator - Workflow
                    </h1>
                </div>

                <div className="glass-morphism p-8 mb-8 rounded-xl shadow-xl backdrop-blur-lg bg-white/30">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label htmlFor="story" className="block text-lg font-medium text-gray-700">
                                    Enter your story prompt:
                                </label>
                                <WorkflowHistoryDrawer onSelectHistory={handleSelectHistory} />
                            </div>
                            <input
                                id="story"
                                type="text"
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                placeholder="E.g., Tell me a story about a magical forest..."
                                className="w-full p-4 rounded-lg bg-white/50 border border-purple-200 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-inner"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating...
                                </span>
                            ) : (
                                'Generate Story'
                            )}
                        </button>
                    </form>
                </div>

                {error && (
                    <div className="glass-morphism p-4 mb-8 text-red-600 text-center rounded-lg bg-red-50/50">
                        {error}
                    </div>
                )}

                {result && <StoryDisplay result={result} />}
            </div>
        </div>
    );
}
