import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'rideklar',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

// Every deploy content-hashes the JS chunks and deletes the old ones, so a
// browser holding a cached index.html asks for modules that now 404. Nothing
// hydrates, and the prerendered loading screen stays on screen forever — that
// is the "Indlæser rideprogram…" report. This guard is a CLASSIC script on
// purpose: a module would die with the very graph it exists to rescue. It
// reloads once per tab with a cache-busting query, which fetches fresh HTML
// naming the chunks that actually exist.
const BOOT_GUARD = `(function(){
var K='rideklar:reloaded';
function heal(){
try{if(sessionStorage.getItem(K))return;sessionStorage.setItem(K,'1')}
catch(e){return}
location.replace(location.pathname+'?v='+Date.now())}
addEventListener('error',function(e){
var t=e.target;
if(t&&t.tagName==='SCRIPT')heal()},true);
setTimeout(function(){
if(!document.documentElement.hasAttribute('data-booted'))heal()},8000)})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className={fraunces.variable}>
        <script dangerouslySetInnerHTML={{ __html: BOOT_GUARD }} />
        {children}
      </body>
    </html>
  );
}
