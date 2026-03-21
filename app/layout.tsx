import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mutation Storyteller',
  description: 'Understand any genetic mutation in plain language. Powered by AlphaFold + Gemini.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        {children}
        <Script src="https://3Dmol.org/build/3Dmol-min.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
