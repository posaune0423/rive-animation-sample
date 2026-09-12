import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rive gift animation sample',
  description: 'Live-streaming gift effects (T1–T5) rendered with generated .riv files',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="dark h-full antialiased">
      <body className="min-h-full bg-black">{children}</body>
    </html>
  )
}
