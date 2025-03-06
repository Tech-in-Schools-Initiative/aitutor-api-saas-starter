"use client";
import { useState } from 'react';
import Link from 'next/link';

interface TokenResponse {
  success: boolean;
  token: string;
}

export default function Token() {
    const [tokenResponse, setTokenResponse] = useState<TokenResponse | null>(null);
    const [error, setError] = useState('');
    const [tokenLoading, setTokenLoading] = useState(false);

    const handleGetToken = async () => {
        setTokenLoading(true);
        setError('');
        try {
            const response = await fetch('/api/token', {
                method: 'POST',
            });
            const data = await response.json();
            if (response.ok) {
                setTokenResponse(data);
            } else {
                setError(data.error || 'Failed to get token');
            }
        } catch (err) {
            setError('Failed to get token');
        } finally {
            setTokenLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 p-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8 p-8">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text inline-block" 
                        style={{ lineHeight: '1.5', padding: '0.5em 0' }}>
                        AI Content Generator - Get Token
                    </h1>
                </div>

                <div className="glass-morphism p-8 mb-8 rounded-xl shadow-xl backdrop-blur-lg bg-white/30">
                    <div className="flex flex-col items-center space-y-6">
                        <button
                            onClick={handleGetToken}
                            disabled={tokenLoading}
                            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {tokenLoading ? 'Getting Token...' : 'Get New Token'}
                        </button>
                        
                        {tokenResponse && (
                            <div className="w-full space-y-4">
                                <div className="p-4 bg-white/50 rounded-lg">
                                    <p className="text-gray-700 font-medium mb-2">Token:</p>
                                    <code className="block p-3 bg-gray-100 rounded border border-gray-200 text-sm overflow-x-auto">
                                        {tokenResponse.token}
                                    </code>
                                </div>
                                
                                <div className="p-4 bg-white/50 rounded-lg">
                                    <p className="text-gray-700 font-medium mb-2">Full Response:</p>
                                    <pre className="block p-3 bg-gray-100 rounded border border-gray-200 text-sm overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(tokenResponse, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="w-full p-4 bg-red-50 rounded-lg text-red-600">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
