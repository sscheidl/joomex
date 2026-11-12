import { initBooks } from '../media/js/viewer.mjs';
const config={src:'images/test-book.pdf',base:new URL('../',import.meta.url).href,title:'Testheft',height:520,background:'#edf1ee',duration:800};
document.querySelector('#main-book').dataset.pdfbook=JSON.stringify(config);
document.querySelector('#cover').dataset.pdfbookOpen=JSON.stringify(config);
initBooks();
