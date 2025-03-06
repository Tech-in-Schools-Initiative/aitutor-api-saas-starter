// src/components/StoryDisplay.tsx
"use client";
import { marked } from 'marked';
import { useState, useEffect } from 'react';

interface ContentDisplayProps {
  result: {
    result?: string;
    success?: boolean;
  };
}

export default function ContentDisplay({ result }: ContentDisplayProps) {
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
                setFormattedResult('Error formatting the content.');
            }
        }
    }, [result]);

    return (
        <div className="glass-morphism p-8 rounded-xl shadow-xl backdrop-blur-lg bg-white/30">
            <div 
                className="content-content prose prose-lg max-w-none"
                style={{
                    color: '#4B5563',
                    lineHeight: '1.8',
                }}
                dangerouslySetInnerHTML={{ __html: formattedResult }}
            />
        </div>
    );
}