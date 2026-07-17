// components/ai-tutor-api/WorkflowResultDisplay.tsx
"use client";
import { marked } from 'marked';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';

interface WorkflowResultDisplayProps {
  title: string;
  result: {
    result?: string;
    success?: boolean;
  };
}

export default function WorkflowResultDisplay({ title, result }: WorkflowResultDisplayProps) {
    const [formattedResult, setFormattedResult] = useState('');

    useEffect(() => {
        if (result && result.result) {
            const parser = new marked.Parser();
            const lexer = new marked.Lexer();

            try {
                const tokens = lexer.lex(result.result);
                const htmlContent = parser.parse(tokens);
                setFormattedResult(htmlContent);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                setFormattedResult('Error formatting the result.');
            }
        }
    }, [result]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    className="workflow-result-content max-w-none text-gray-600 leading-[1.8] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                    dangerouslySetInnerHTML={{ __html: formattedResult }}
                />
            </CardContent>
        </Card>
    );
}
