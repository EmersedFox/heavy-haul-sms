import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// UPDATE THIS SECTION
export const metadata: Metadata = {
  title: "Heavy Haul Auto Service | Shop Manager", // <--- The Browser Tab Text
  description: "Shop Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-3JS59HQBBX"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-3JS59HQBBX');
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-slate-950 text-white`}>{children}</body>
    </html>
  );
}