import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'NETZSCH Databooks',
    template: '%s | NETZSCH Databooks',
  },
  description: 'Sistema interno de gerenciamento de Databooks de Peças - NETZSCH',
  robots: { index: false, follow: false }, // sistema interno — não indexar
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
