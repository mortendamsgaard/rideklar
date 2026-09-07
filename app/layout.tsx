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
//
// The error filter is deliberately limited to /_next/static/: a dead app
// bundle is the only failure a reload can fix. Third-party scripts are blocked
// by ad blockers as a matter of course, and healing on those would reload the
// page for a large share of visitors who have nothing wrong with them.
const BOOT_GUARD = `(function(){
var K='rideklar:reloaded';
function heal(){
try{if(sessionStorage.getItem(K))return;sessionStorage.setItem(K,'1')}
catch(e){return}
location.replace(location.pathname+'?v='+Date.now())}
addEventListener('error',function(e){
var t=e.target;
if(t&&t.tagName==='SCRIPT'&&(t.src||'').indexOf('/_next/static/')>-1)heal()},true);
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
        {/*
          Visit counts only. GoatCounter is cookieless and stores no personal
          data, which is what keeps a consent banner off a site used by
          children. Explicit https rather than GoatCounter's own
          protocol-relative snippet, and async so it can never sit in front of
          the boot path.
        */}
        <script
          data-goatcounter="https://rideklar.goatcounter.com/count"
          async
          src="https://gc.zgo.at/count.js"
        />
        {children}
      </body>
    </html>
  );
}
