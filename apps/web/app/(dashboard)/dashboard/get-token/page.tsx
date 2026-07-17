"use client";
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';

interface TokenResponse {
  success: boolean;
  token: string;
}

async function fetchToken(): Promise<TokenResponse> {
    const response = await fetch('/api/token', {
        method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to get token');
    }
    return data;
}

export default function Token() {
    const tokenMutation = useMutation({
        mutationFn: fetchToken,
    });

    const tokenResponse = tokenMutation.data;
    const tokenLoading = tokenMutation.isPending;
    const error = tokenMutation.isError
        ? (tokenMutation.error instanceof Error ? tokenMutation.error.message : 'Failed to get token')
        : '';

    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Get Token
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle>API Token</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-start space-y-6">
                        <Button onClick={() => tokenMutation.mutate()} disabled={tokenLoading}>
                            {tokenLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Getting Token...
                                </>
                            ) : (
                                'Get New Token'
                            )}
                        </Button>

                        {tokenResponse && (
                            <div className="w-full space-y-4">
                                <div>
                                    <Label>Token</Label>
                                    <code className="block p-3 mt-2 bg-muted rounded border text-sm overflow-x-auto">
                                        {tokenResponse.token}
                                    </code>
                                </div>

                                <div>
                                    <Label>Full Response</Label>
                                    <pre className="block p-3 mt-2 bg-muted rounded border text-sm overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(tokenResponse, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="w-full text-sm text-red-500" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
