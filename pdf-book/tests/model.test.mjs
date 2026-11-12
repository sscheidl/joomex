import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safePdfUrl,safeLink,spreadFor,nextPage,renderDimensions,statusText,nextMode,messageFor,ViewerError,MESSAGES,LIMITS,PDFJS_ERRORS} from '../media/js/model.mjs';
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
  const source=readFileSync(new URL('../media/vendor/pdfjs/build/pdf.mjs',import.meta.url),'utf8');
  const classes=new Set([...source.matchAll(/class (\w+(?:Exception|Error))\b/g)].map(m=>m[1]));
  for(const name of Object.keys(PDFJS_ERRORS))assert.ok(classes.has(name),name);
});
