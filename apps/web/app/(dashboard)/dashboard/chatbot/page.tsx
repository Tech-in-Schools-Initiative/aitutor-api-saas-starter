import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';

export default function Chatbot() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Chatbot
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>AI Story Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src="https://aitutor-api.vercel.app/embed/chatbot/cm6w0fkel0001vfbweh9y6j1a"
            title="AI Story Generator chatbot"
            className="w-full h-[600px] rounded-lg border"
          />
        </CardContent>
      </Card>
    </section>
  );
}
