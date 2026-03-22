import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mutation Storyteller',
  description: 'Understand any genetic mutation in plain language. Powered by AlphaFold + Gemini.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
  },
  openGraph: {
    title: 'Mutation Storyteller',
    description: 'Type a mutation. See the protein. Understand the science.',
    images: ['/icon.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Mutation Storyteller',
    description: 'Type a mutation. See the protein. Understand the science.',
    images: ['/icon.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Script src="https://3Dmol.org/build/3Dmol-min.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
