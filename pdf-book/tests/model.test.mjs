import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safePdfUrl,safeLink,spreadFor,nextPage,renderDimensions,letterboxDimensions,statusText,nextMode,messageFor,ViewerError,MESSAGES,LIMITS,PDFJS_ERRORS,setting} from '../media/js/model.js';
test('numeric settings follow the shared vectors (same as the dispatcher, N18-5)',()=>{const v=JSON.parse(readFileSync(new URL('./numeric-vectors.json',import.meta.url),'utf8'));for(const c of v.cases)assert.equal(setting(c.in,v.min,v.max,v.default),c.out,JSON.stringify(c.in));});
const base='https://site.example/cms/';
test('only same-origin public media PDFs, including Joomla subdirectories',()=>{
  assert.equal(safePdfUrl('images/book.pdf',base),'https://site.example/cms/images/book.pdf');
  assert.equal(safePdfUrl('/cms/images/book.pdf',base),'https://site.example/cms/images/book.pdf');
  for(const input of ['https://evil.example/images/a.pdf','//evil.example/a.pdf','javascript:alert(1)','data:application/pdf,a','file:///a.pdf','images/../private.pdf','images/%2e%2e/a.pdf','images/%252e%252e/a.pdf','images/a.pdf?x=1','images/a.pdf#foo','images\\a.pdf','images/%5ca.pdf','images/%00a.pdf','/images/a.pdf','https://u:p@site.example/cms/images/a.pdf','images/a.html','images/%ZZ.pdf','images/a b.pdf','images/%09a.pdf'])assert.throws(()=>safePdfUrl(input,base),input);
});
test('F9: URL-encoded spaces are accepted, raw spaces and other controls are not',()=>{
  assert.equal(safePdfUrl('images/mit%20leerzeichen.pdf',base),'https://site.example/cms/images/mit%20leerzeichen.pdf');
  assert.throws(()=>safePdfUrl('images/mit leerzeichen.pdf',base));
});
test('safe annotation links',()=>{assert.equal(safeLink('https://site.example'),'https://site.example/');for(const x of ['javascript:alert(1)','data:text/html,hello','file:///a','//evil','https://u:p@site.example'])assert.equal(safeLink(x),null);});
test('cover, spreads, odd final page, backwards, RTL',()=>{assert.deepEqual(spreadFor(1,8),[0,1]);assert.deepEqual(spreadFor(3,8),[2,3]);assert.deepEqual(spreadFor(8,8),[8,0]);assert.deepEqual(spreadFor(5,5),[4,5]);assert.deepEqual(spreadFor(3,8,false,true),[3,2]);assert.equal(nextPage(2,8,false,-1),1);assert.equal(nextPage(1,8,false,1),2);assert.equal(nextPage(4,8,false,1),6);assert.equal(nextPage(8,8,true,1),8);});
test('render memory budget and maximum texture dimensions',()=>{for(const [w,h,z] of [[600,800,6000],[9000,4000,99999],[1,20000,3000],[2000000,1,50000]]){const d=renderDimensions(w,h,z);assert.ok(d.width*d.height<=LIMITS.pixels);assert.ok(d.width<=LIMITS.dimension&&d.height<=LIMITS.dimension);}assert.throws(()=>renderDimensions(NaN,800,200));});

test('mixed-format letterboxes respect pixel and GPU limits even for extreme aspect ratios',()=>{
  for(const cap of [512,1024,2048,4096,16384])for(const ratio of [1e-300,.001,.1,.707,1,10,1000,1e300]){
    const d=letterboxDimensions(607,858,ratio,cap);
    assert.ok(d.width>=1&&d.height>=1&&Number.isInteger(d.width)&&Number.isInteger(d.height));
    assert.ok(d.width<=Math.min(cap,LIMITS.dimension)&&d.height<=Math.min(cap,LIMITS.dimension));
    assert.ok(d.width*d.height<=LIMITS.pixels);
  }
  assert.deepEqual(letterboxDimensions(607,858,.1,1024),{width:102,height:1024});
  assert.throws(()=>letterboxDimensions(607,858,NaN));
});
test('F12: status text uses the singular for one visible page',()=>{
  assert.equal(statusText([0,1]),'Seite 1');assert.equal(statusText([6,0]),'Seite 6');assert.equal(statusText([4,5]),'Seiten 4–5');assert.equal(statusText([3]),'Seite 3');
});
test('F11: page-mode switch cycles back to automatic',()=>{
  assert.equal(nextMode('auto'),'single');assert.equal(nextMode('single'),'double');assert.equal(nextMode('double'),'auto');assert.equal(nextMode('bogus'),'auto');
});
test('F5: only fixed German messages reach the interface',()=>{
  const english=/[A-Za-z]+ (?:PDF structure|to fetch|aborted|without reason)/;
  for(const error of [new TypeError('Failed to fetch'),Object.assign(new Error('Invalid PDF structure.'),{name:'InvalidPDFException'}),new DOMException('signal is aborted without reason','AbortError'),
    Object.assign(new Error('No password given'),{name:'PasswordException'}),new ViewerError('timeout'),new ViewerError('too-many-pages'),new Error('anything else')]){
    const text=messageFor(error);assert.ok(Object.values(MESSAGES).includes(text),text);assert.doesNotMatch(text,english);
  }
  assert.equal(messageFor(Object.assign(new Error('x'),{name:'PasswordException'})),MESSAGES.password);
  assert.equal(messageFor(new ViewerError('timeout')),MESSAGES.timeout);
  assert.equal(messageFor(Object.assign(new Error('Invalid PDF structure.'),{name:'InvalidPDFException'})),MESSAGES.invalid);
});
test('F4: separate, bounded timeouts',()=>{
  assert.ok(LIMITS.responseTimeout<=25000&&LIMITS.idleTimeout<=25000&&LIMITS.parseTimeout>0);
});
test('N3: every mapped PDF.js error name exists in the shipped PDF.js build',()=>{
  const source=readFileSync(new URL('../media/vendor/pdfjs/build/pdf.js',import.meta.url),'utf8');
  const classes=new Set([...source.matchAll(/class (\w+(?:Exception|Error))\b/g)].map(m=>m[1]));
  for(const name of Object.keys(PDFJS_ERRORS))assert.ok(classes.has(name),name);
});
test('page turn: the sheet starts and ends flat at full size and never dips below the pages',async()=>{
  const {sheetProfile,SEGMENTS,easeOutSine}=await import('../media/js/turn.js');
  const start=sheetProfile(0),end=sheetProfile(1);
  assert.equal(start.length,SEGMENTS+1);
  assert.ok(Math.abs(start.at(-1).x-1)<1e-9&&start.every(p=>p.z===0));          // exactly the flat source page
  assert.ok(Math.abs(end.at(-1).x+1)<1e-9&&end.every(p=>Math.abs(p.z)<1e-9));    // exactly the flat target page
  for(let p=0;p<=1;p+=0.05){
    const points=sheetProfile(p);let length=0;
    for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
    assert.ok(points.every(q=>q.z>=0),'above the pages at '+p);
    assert.ok(Math.abs(length-1)<1e-6,'paper keeps its width at '+p);
  }
  const mid=sheetProfile(0.5);assert.ok(mid.at(-1).z>0.5&&Math.min(...mid.map(q=>q.x))<-0.05);   // bent: the middle runs ahead of the edge
  assert.ok(start.every(q=>Math.abs(q.nz-1)<1e-9&&Math.abs(q.nx)<1e-9)&&Math.abs(start.at(-1).s-1)<1e-9);   // flat: normal straight up
  assert.equal(easeOutSine(0),0);assert.ok(Math.abs(easeOutSine(1)-1)<1e-12);
});
test('adjustable look: rigid sheet at curvature 0, valid geometry at the maximum, settings clamped',async()=>{
  const {sheetProfile}=await import('../media/js/turn.js');
  const {normalizeConfig}=await import('../media/js/model.js');
  const rigid=sheetProfile(0.3,0);                                               // one straight line
  assert.ok(rigid.every(q=>Math.abs(q.nx-rigid[0].nx)<1e-9&&Math.abs(q.nz-rigid[0].nz)<1e-9));
  for(const lead of [0,1,2])for(let p=0;p<=1.0001;p+=0.1){
    const points=sheetProfile(p,lead);let length=0;
    for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
    assert.ok(points.every(q=>q.z>=0)&&Math.abs(length-1)<1e-6,`curvature ${lead} at ${p}`);
  }
  globalThis.location={href:'https://site.example/cms/page'};
  const d=normalizeConfig({});
  assert.deepEqual([d.renderer,d.duration,d.curvature,d.shadowDensity,d.shadowSoftness,d.shadowWidth],['webgl',800,50,22,50,50]);
  const c=normalizeConfig({renderer:'slide',curvature:0,shadowDensity:999,shadowSoftness:-5,shadowWidth:'70',duration:5});
  assert.deepEqual([c.renderer,c.duration,c.curvature,c.shadowDensity,c.shadowSoftness,c.shadowWidth],['slide',150,0,60,0,70]);
  assert.equal(normalizeConfig({renderer:'bogus',curvature:'x'}).renderer,'webgl');
  assert.equal(normalizeConfig({curvature:'x'}).curvature,50);
});
