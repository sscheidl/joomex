import test from 'node:test';
import assert from 'node:assert/strict';
import {safePdfUrl,safeLink,spreadFor,nextPage,renderDimensions,LIMITS} from '../media/js/model.mjs';
const base='https://site.example/cms/';
test('only same-origin public media PDFs, including Joomla subdirectories',()=>{
  assert.equal(safePdfUrl('images/book.pdf',base),'https://site.example/cms/images/book.pdf');
  assert.equal(safePdfUrl('/cms/images/book.pdf',base),'https://site.example/cms/images/book.pdf');
  for(const input of ['https://evil.example/images/a.pdf','//evil.example/a.pdf','javascript:alert(1)','data:application/pdf,a','file:///a.pdf','images/../private.pdf','images/%2e%2e/a.pdf','images/%252e%252e/a.pdf','images/a.pdf?x=1','images/a.pdf#foo','images\\a.pdf','images/%5ca.pdf','images/%00a.pdf','/images/a.pdf','https://u:p@site.example/cms/images/a.pdf','images/a.html','images/%ZZ.pdf'])assert.throws(()=>safePdfUrl(input,base),input);
});
test('safe annotation links',()=>{assert.equal(safeLink('https://site.example'),'https://site.example/');for(const x of ['javascript:alert(1)','data:text/html,hello','file:///a','//evil','https://u:p@site.example'])assert.equal(safeLink(x),null);});
test('cover, spreads, odd final page, backwards, RTL',()=>{assert.deepEqual(spreadFor(1,8),[0,1]);assert.deepEqual(spreadFor(3,8),[2,3]);assert.deepEqual(spreadFor(8,8),[8,0]);assert.deepEqual(spreadFor(5,5),[4,5]);assert.deepEqual(spreadFor(3,8,false,true),[3,2]);assert.equal(nextPage(2,8,false,-1),1);assert.equal(nextPage(1,8,false,1),2);assert.equal(nextPage(4,8,false,1),6);assert.equal(nextPage(8,8,true,1),8);});
test('render memory budget and maximum texture dimensions',()=>{for(const [w,h,z] of [[600,800,6000],[9000,4000,99999],[1,20000,3000],[2000000,1,50000]]){const d=renderDimensions(w,h,z);assert.ok(d.width*d.height<=LIMITS.pixels);assert.ok(d.width<=LIMITS.dimension&&d.height<=LIMITS.dimension);}assert.throws(()=>renderDimensions(NaN,800,200));});
