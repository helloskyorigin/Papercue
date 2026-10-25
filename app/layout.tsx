import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"PaperCue AI — Never miss what matters",description:"Turn scholarship, admission and exam notices into clear next steps, deadlines and source-backed checklists.",robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
