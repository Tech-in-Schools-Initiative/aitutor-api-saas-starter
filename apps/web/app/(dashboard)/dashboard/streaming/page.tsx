import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import StreamingChat from '@/components/ai-tutor-api/StreamingChat';

export default function Streaming() {
    return (
        <section className="flex-1 p-4 lg:p-8">
            <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
                Streaming
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle>Streaming Chat</CardTitle>
                </CardHeader>
                <CardContent>
                    <StreamingChat />
                </CardContent>
            </Card>
        </section>
    );
}
