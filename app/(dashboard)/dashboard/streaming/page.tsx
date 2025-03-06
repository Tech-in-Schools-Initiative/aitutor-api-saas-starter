import StreamingChat from '@/components/ai-tutor-api/StreamingChat';
import Link from 'next/link';

export default function Streaming() {
    return (
        <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8 p-8">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text inline-block" 
                        style={{ lineHeight: '1.5', padding: '0.5em 0' }}>
                        AI Content Generator - Streaming
                    </h1>
                </div>

                <div className="glass-morphism p-8 mb-8 rounded-xl shadow-xl backdrop-blur-lg bg-white/30">
                    <StreamingChat />
                </div>
            </div>
        </div>
    );
}
