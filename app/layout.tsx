import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Load Calculator',
  description: 'Created with Next.js',
  generator: 'hbradroc@uwo.ca',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
