import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "InsightEye Analytics",
  description: "Real-time Gaze and Iris Tracking HUD",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-darkBg text-cyberSilver selection:bg-cyberCyan selection:text-darkBg">
        {children}
      </body>
    </html>
  )
}
