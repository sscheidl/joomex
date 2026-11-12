// Every relative import carries ?v=<version> so a module update never mixes cached files (checked by scripts/build.py).
import { normalizeConfig, safePdfUrl, safeLink, spreadFor, nextPage, statusText, nextMode, messageFor, ViewerError } from './model.mjs?v=0.1.0-alpha.3';
import { PdfDocument, pdfVersion } from './pdf.mjs?v=0.1.0-alpha.3';
import { PageTurn } from './turn.mjs?v=0.1.0-alpha.3';

const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const blank=()=>{const c=make('canvas');c.width=600;c.height=800;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,800);return c;};
const MODE_LABEL={auto:'Seitenansicht: automatisch',single:'Seitenansicht: Einzelseite',double:'Seitenansicht: Doppelseite'};
let serial=0;

export class PdfBook {
  constructor(element, config) {
    this.el=element;this.config=normalizeConfig(config);this.page=1;this.zoom=1;this.id=++serial;this.abort=new AbortController();
    this.pdf=new PdfDocument();this.items=[];this.busy=false;this.pending=null;this.disposed=false;this.single=true;this.autoTimer=null;
    this.build();this.ready=this.load();
  }
  on(el,type,fn){el.addEventListener(type,fn,{signal:this.abort.signal});}
  button(label,text,action){const b=make('button','pdfbook-button',text);b.type='button';b.title=label;b.setAttribute('aria-label',label);this.on(b,'click',action);return b;}
  build(){
    this.el.classList.add('pdfbook');this.el.classList.toggle('is-fill',this.config.fill);this.el.dataset.state='loading';this.el.setAttribute('role','region');this.el.setAttribute('aria-label',this.config.title);
    this.el.style.setProperty('--pdfbook-height',`${this.config.height}px`);this.el.style.setProperty('--pdfbook-bg',this.config.background);
    const heading=make('div','pdfbook-heading');heading.append(make('strong','',this.config.title));
    this.status=make('span','pdfbook-status','PDF wird geladen …');this.status.setAttribute('role','status');heading.append(this.status);
    this.body=make('div','pdfbook-body');this.sidebar=make('aside','pdfbook-sidebar');this.sidebar.hidden=true;
    this.stage=make('div','pdfbook-stage');this.stage.tabIndex=0;this.stage.setAttribute('aria-label','Buchseiten. Mit Pfeiltasten blättern.');
    this.spread=make('div','pdfbook-spread');this.stage.append(this.spread);this.body.append(this.sidebar,this.stage);
    this.toolbar=make('div','pdfbook-toolbar');this.toolbar.setAttribute('role','group');this.toolbar.setAttribute('aria-label','PDF-Steuerung');
    this.first=this.button('Erste Seite','⇤',()=>this.go(1));this.prev=this.button('Vorherige Seite','‹',()=>this.move(-1));
    const label=make('label','pdfbook-page-label','Seite ');this.input=make('input');this.input.type='number';this.input.min='1';this.input.value='1';this.input.setAttribute('aria-label','Seitennummer');
    this.total=make('span','',' / –');label.append(this.input,this.total);
    this.on(this.input,'change',()=>this.go(Number(this.input.value)));this.on(this.input,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.go(Number(this.input.value));}});
    this.next=this.button('Nächste Seite','›',()=>this.move(1));this.last=this.button('Letzte Seite','⇥',()=>this.go(this.pdf.count));
    this.thumbs=this.button('Seitenübersicht','▦',()=>this.showSidebar('thumbs'));this.outline=this.button('Inhaltsverzeichnis','☷',()=>this.showSidebar('outline'));
    this.zoomOut=this.button('Verkleinern','−',()=>this.setZoom(this.zoom-.25));this.zoomIn=this.button('Vergrößern','+',()=>this.setZoom(this.zoom+.25));
    // Cycles auto → single → double → auto, so the automatic mode can always be restored.
    this.mode=this.button(MODE_LABEL[this.config.mode],'▣',()=>{this.config.mode=nextMode(this.config.mode);this.updateModeButton();this.go(this.target(),false);});
    this.full=this.button('Vollbild','⛶',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await this.el.requestFullscreen();}catch{this.status.textContent='Vollbild ist hier nicht verfügbar.';}});
    this.auto=this.button('Automatisch blättern','▷',()=>this.toggleAuto());this.auto.setAttribute('aria-pressed','false');
    this.download=make('a','pdfbook-button','PDF öffnen');this.download.target='_blank';this.download.rel='noopener noreferrer';this.download.hidden=!this.config.download;
    this.toolbar.append(this.first,this.prev,label,this.next,this.last,this.thumbs,this.outline,this.zoomOut,this.zoomIn,this.mode,this.full,this.auto,this.download);
    this.el.replaceChildren(heading,this.body,this.toolbar);
    this.on(this.stage,'keydown',e=>{if(e.target!==this.stage)return;const rtl=this.config.direction==='rtl';if(e.key==='ArrowRight'){e.preventDefault();this.move(rtl?-1:1);}if(e.key==='ArrowLeft'){e.preventDefault();this.move(rtl?1:-1);}if(e.key==='Home'){e.preventDefault();this.go(1);}if(e.key==='End'){e.preventDefault();this.go(this.pdf.count);}});
    this.on(this.stage,'pointerdown',e=>{if(e.button===0&&!e.target.closest('a,button'))this.pointer={x:e.clientX,y:e.clientY};});
    this.on(this.stage,'pointerup',e=>{
      if(!this.pointer)return;const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;this.pointer=null;
      if(Math.abs(dx)<=65||Math.abs(dx)<=Math.abs(dy)*1.5)return;
      // When zoomed, a horizontal swipe scrolls the page first and only turns it at the scroll edge.
      if(this.zoom>1){const s=this.stage,max=s.scrollWidth-s.clientWidth;if(max>1&&(dx<0?s.scrollLeft<max-1:s.scrollLeft>1))return;}
      this.move((dx<0?1:-1)*(this.config.direction==='rtl'?-1:1));
    });
    this.on(this.stage,'pointercancel',()=>this.pointer=null);
    this.on(document,'visibilitychange',()=>{if(document.hidden)this.stopAuto();});
    this.resize=new ResizeObserver(()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>{if(this.pdf.doc&&!this.disposed&&this.el.dataset.state!=='error')this.go(this.target(),false);},180);});this.resize.observe(this.stage);
    this.updateControls();
  }
  async load(){
    try {
      this.url=safePdfUrl(this.config.src,this.config.base);this.download.href=this.url;
      let shown=-1;
      await this.pdf.open(this.url,(loaded,total)=>{
        if(this.disposed)return;
        // Announce progress in coarse steps only (the status element is a live region).
        const step=total?Math.min(9,Math.floor(loaded/total*10)):Math.floor(loaded/1048576);
        if(step===shown)return;shown=step;
        this.status.textContent=total?`PDF wird geladen … ${step*10} %`:`PDF wird geladen … ${step} MB`;
      });
      if(this.disposed)return;
      this.total.textContent=` / ${this.pdf.count}`;this.input.max=String(this.pdf.count);
      await this.go(1,false);this.el.dataset.pdfjs=pdfVersion;
    }catch(error){if(!this.disposed){this.fail(error);await this.pdf.dispose();}}
  }
  fail(error){
    console.warn('PDF Book:',error);
    this.el.dataset.state='error';this.status.textContent=messageFor(error);this.pending=null;this.stopAuto();this.updateControls();
  }
  /** Page the viewer is heading to: a queued request, else the page being rendered, else the page shown. */
  target(){return this.pending?.number??this.inflight??this.page;}
  async go(number, animate=true){
    if(this.disposed||!this.pdf.doc||this.el.dataset.state==='error')return;
    // Input that arrives while a page renders or turns is queued (latest request wins) instead of being dropped.
    if(this.busy){this.pending={number,animate:false};this.updateControls();return;}
    const target=Math.max(1,Math.min(this.pdf.count,Math.trunc(number)||1));
    const single=this.config.mode==='single'||(this.config.mode==='auto'&&(this.stage.clientWidth<640||this.pdf.count<=2));
    const numbers=spreadFor(target,this.pdf.count,single,this.config.direction==='rtl');
    const previous=this.items,oldPage=this.page;
    this.busy=true;this.inflight=target;this.el.setAttribute('aria-busy','true');
    try{
      const width=Math.max(240,(this.stage.clientWidth-48)/(single?1:2))*Math.min(devicePixelRatio,2)*this.zoom;
      const items=[];
      for(const n of numbers)items.push(n?await this.pdf.render(n,width):null);
      if(this.disposed)return;
      const canAnimate=animate&&!this.pending&&!single&&!this.single&&previous.length===2&&target!==oldPage&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&this.config.renderer!=='flat';
      this.single=single;this.page=target;this.items=items;
      this.mountPages(items);
      if(canAnimate&&this.turn?.available){
        const direction=(target>oldPage?1:-1)*(this.config.direction==='rtl'?-1:1);
        const from=direction>0?1:0,to=1-from;
        // Destination spread underneath; the animated sheet supplies its front and back.
        await this.turn.play(previous[from]?.canvas||blank(),items[to]?.canvas||blank(),direction,this.config.duration);
      }
      if(this.disposed)return;
      this.status.textContent=statusText(numbers);
      this.el.dataset.state='ready';this.el.dataset.page=String(target);this.el.dataset.renderer=this.turn?.available&&!single?'webgl':'flat';
    }catch(error){if(!this.disposed)this.fail(error instanceof ViewerError?error:new ViewerError('render',error));}
    finally{
      this.busy=false;this.inflight=null;this.el.removeAttribute('aria-busy');
      if(!this.disposed){
        const queued=this.pending;this.pending=null;this.updateControls();
        if(queued&&this.el.dataset.state!=='error')this.go(queued.number,queued.animate);
      }
    }
  }
  mountPages(items){
    this.pageAbort?.abort();this.pageAbort=new AbortController();
    if(this.single||this.config.renderer==='flat'){this.turn?.dispose();this.turn=null;this.overlay=null;}
    const first=items.find(Boolean),ratio=first?first.canvas.width/first.canvas.height:.707;
    const availableHeight=Math.max(220,this.stage.clientHeight-48),availableWidth=Math.max(200,this.stage.clientWidth-48);
    const pageWidth=Math.min(availableWidth/items.length,availableHeight*ratio)*this.zoom;
    this.spread.style.width=`${pageWidth*items.length}px`;this.spread.style.height=`${pageWidth/ratio}px`;
    this.spread.replaceChildren();this.spread.classList.toggle('is-single',this.single);
    for(const item of items){
      const wrapper=make('div',`pdfbook-page${item?'':' is-blank'}`);
      if(item){
        const canvas=make('canvas');canvas.width=item.canvas.width;canvas.height=item.canvas.height;canvas.getContext('2d').drawImage(item.canvas,0,0);
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PDF-Seite ${item.number}`);wrapper.append(canvas);
        for(const annotation of item.annotations){
          if(annotation.subtype!=='Link'||!annotation.rect)continue;
          const href=safeLink(annotation.url);
          if(!href&&!annotation.dest)continue;
          const a=make(href?'a':'button','pdfbook-annotation');
          a.setAttribute('aria-label',href?'Link im PDF öffnen':'Zu verknüpfter PDF-Seite');
          if(href){a.href=href;a.target='_blank';a.rel='noopener noreferrer';}
          else{a.type='button';a.addEventListener('click',()=>this.navigateDestination(annotation.dest),{signal:this.pageAbort.signal});}
          const [x1,y1]=item.viewport.convertToViewportPoint(annotation.rect[0],annotation.rect[1]);
          const [x2,y2]=item.viewport.convertToViewportPoint(annotation.rect[2],annotation.rect[3]);
          a.style.left=`${Math.min(x1,x2)/item.viewport.width*100}%`;a.style.top=`${Math.min(y1,y2)/item.viewport.height*100}%`;
          a.style.width=`${Math.abs(x2-x1)/item.viewport.width*100}%`;a.style.height=`${Math.abs(y2-y1)/item.viewport.height*100}%`;wrapper.append(a);
        }
      }
      this.spread.append(wrapper);
    }
    if(!this.single&&this.config.renderer!=='flat'){
      if(!this.overlay){this.overlay=make('canvas','pdfbook-turn');this.overlay.hidden=true;this.overlay.setAttribute('aria-hidden','true');this.turn=new PageTurn(this.overlay);}
      this.spread.append(this.overlay);
    }
  }
  async navigateDestination(dest){try{const n=await this.pdf.destination(dest);if(n)await this.go(n);}catch{this.status.textContent='Verknüpfte Seite nicht verfügbar.';}}
  move(delta){return this.go(nextPage(this.target(),this.pdf.count,this.single,delta));}
  setZoom(value){
    this.zoom=Math.max(.75,Math.min(2.5,value));
    // Zoomed pages must be pannable by touch in both directions; unzoomed, horizontal swipes turn pages.
    this.stage.style.touchAction=this.zoom>1?'pan-x pan-y':'';
    return this.go(this.target(),false);
  }
  updateModeButton(){const label=MODE_LABEL[this.config.mode];this.mode.title=label;this.mode.setAttribute('aria-label',label);}
  updateControls(){
    // Controls stay enabled while busy: their input is queued by go().
    const unavailable=!this.pdf.doc||this.disposed||this.el.dataset.state==='error';
    for(const button of this.toolbar.querySelectorAll('button,input'))button.disabled=unavailable;
    if(!unavailable){const page=this.target();this.first.disabled=this.prev.disabled=page===1;this.next.disabled=this.last.disabled=spreadFor(page,this.pdf.count,this.single).includes(this.pdf.count);}
    if(document.activeElement!==this.input)this.input.value=String(this.target());
  }
  async showSidebar(kind){
    if(!this.pdf.doc||this.disposed)return;
    if(!this.sidebar.hidden&&this.sidebar.dataset.kind===kind){this.sidebar.hidden=true;return;}
    this.sidebarAbort?.abort();this.sidebarAbort=new AbortController();this.thumbObserver?.disconnect();
    const sidebarButton=(label,text,action)=>{const b=make('button','pdfbook-button',text);b.type='button';b.setAttribute('aria-label',label);b.addEventListener('click',action,{signal:this.sidebarAbort.signal});return b;};
    this.sidebar.hidden=false;this.sidebar.dataset.kind=kind;this.sidebar.replaceChildren(make('h3','',kind==='thumbs'?'Seitenübersicht':'Inhaltsverzeichnis'));
    const token=Symbol();this.sidebarToken=token;
    if(kind==='outline'){
      try{
        const outline=await this.pdf.doc.getOutline();if(this.disposed||token!==this.sidebarToken)return;
        let remaining=300;
        const add=(entries,depth=0)=>{for(const entry of (entries||[])){if(remaining--<=0)return;const b=sidebarButton(String(entry.title||'Kapitel').slice(0,200),String(entry.title||'Kapitel').slice(0,200),()=>this.navigateDestination(entry.dest));b.classList.add('pdfbook-outline');b.style.paddingInlineStart=`${12+Math.min(depth,6)*12}px`;this.sidebar.append(b);if(depth<6)add(entry.items,depth+1);}};
        if(outline?.length)add(outline);else this.sidebar.append(make('p','','Dieses PDF enthält keine Lesezeichen.'));
      }catch{if(!this.disposed)this.sidebar.append(make('p','','Inhaltsverzeichnis nicht verfügbar.'));}
    }else{
      // Only render visible thumbnails, with a separate bounded sequential queue.
      this.thumbObserver?.disconnect();
      let chain=Promise.resolve();
      this.thumbObserver=new IntersectionObserver(entries=>{
        for(const entry of entries){if(!entry.isIntersecting)continue;this.thumbObserver.unobserve(entry.target);
          chain=chain.then(async()=>{if(this.disposed||token!==this.sidebarToken)return;try{const item=await this.pdf.render(Number(entry.target.dataset.number),120);if(this.disposed||token!==this.sidebarToken)return;const c=make('canvas');c.width=item.canvas.width;c.height=item.canvas.height;c.getContext('2d').drawImage(item.canvas,0,0);entry.target.prepend(c);}catch{/* main viewer remains usable */}});
        }
      },{root:this.sidebar});
      for(let n=1;n<=this.pdf.count;n++){const b=sidebarButton(`Seite ${n}`,String(n),()=>this.go(n));b.classList.add('pdfbook-thumbnail');b.dataset.number=String(n);this.sidebar.append(b);this.thumbObserver.observe(b);}
    }
  }
  toggleAuto(){if(this.autoTimer){this.stopAuto();return;}this.auto.setAttribute('aria-pressed','true');this.autoTimer=setInterval(()=>{if(this.busy||this.pending)return;if(this.next.disabled)this.stopAuto();else this.move(1);},3000);}
  stopAuto(){clearInterval(this.autoTimer);this.autoTimer=null;this.auto.setAttribute('aria-pressed','false');}
  async dispose(){if(this.disposed)return;this.disposed=true;this.pending=null;this.stopAuto();this.abort.abort();this.pageAbort?.abort();this.sidebarAbort?.abort();this.resize.disconnect();this.thumbObserver?.disconnect();clearTimeout(this.resizeTimer);this.turn?.dispose();await this.pdf.dispose();}
}

const instances=new WeakMap();
export function initBooks(root=document){
  for(const el of root.querySelectorAll('[data-pdfbook]')){
    if(instances.has(el))continue;
    try{const config=JSON.parse(el.dataset.pdfbook);const book=new PdfBook(el,config);instances.set(el,book);}catch{el.textContent=messageFor(new ViewerError('config'));}
  }
  for(const button of root.querySelectorAll('[data-pdfbook-open]')){
    if(instances.has(button))continue;instances.set(button,true);
    button.addEventListener('click',()=>{
      let config;try{config=JSON.parse(button.dataset.pdfbookOpen);}catch{return;}
      const dialog=make('dialog','pdfbook-dialog');dialog.setAttribute('aria-label',String(config.title||'PDF-Flipbook'));
      const close=make('button','pdfbook-close','Schließen ×');close.type='button';
      const mount=make('div');dialog.append(close,mount);document.body.append(dialog);dialog.showModal();
      // The dialog is a flex column; the book fills the remaining height, so a wrapping toolbar never leaves the dialog.
      const book=new PdfBook(mount,{...config,fill:true});
      close.addEventListener('click',()=>dialog.close());
      dialog.addEventListener('close',()=>{book.dispose().catch(()=>{});dialog.remove();button.focus();},{once:true});close.focus();
    });
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initBooks(),{once:true});else initBooks();
