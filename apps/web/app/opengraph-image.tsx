import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export const alt = 'AI Tutor API SAAS Starter';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const logoBuffer = await readFile(join(process.cwd(), 'public', 'logo-square.png'));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b1220',
          backgroundImage:
            'radial-gradient(circle at 22% 20%, rgba(139,92,246,0.35), transparent 45%), radial-gradient(circle at 80% 85%, rgba(249,115,22,0.30), transparent 45%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={132} height={108} alt="" style={{ marginBottom: 28 }} />
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            backgroundImage: 'linear-gradient(to right, #a855f7, #ec4899, #f97316)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          AI Tutor API SAAS Starter
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 30,
            color: '#cbd5e1',
          }}
        >
          Ship AI-workflow SaaS products, faster
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 22,
            color: '#94a3b8',
          }}
        >
          Next.js &middot; Stripe &middot; Postgres &middot; Resend
        </div>
      </div>
    ),
    { ...size }
  );
}
