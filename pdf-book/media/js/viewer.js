// Every relative import carries ?v=<version> so a module update never mixes cached files (checked by scripts/build.py).
import { normalizeConfig, safePdfUrl, safeLink, spreadFor, nextPage, statusText, nextMode, messageFor, ViewerError } from './model.js?v=0.1.0-alpha.14';
import { PdfDocument, pdfVersion } from './pdfdoc.js?v=0.1.0-alpha.14';
import { PageTurn } from './turn.js?v=0.1.0-alpha.14';

const copyLayer=layer=>{const copy=layer.cloneNode(true),from=layer.querySelectorAll('canvas'),to=copy.querySelectorAll('canvas');to.forEach((c,i)=>c.getContext('2d').drawImage(from[i],0,0));copy.querySelectorAll('a,button').forEach(e=>e.remove());return copy;};
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const blank=()=>{const c=make('canvas');c.width=600;c.height=800;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,800);return c;};
const MODE_LABEL={auto:'Seitenansicht: automatisch',single:'Seitenansicht: Einzelseite',double:'Seitenansicht: Doppelseite'};
// Own line icons (24 px grid), drawn as SVG paths so that they are large and look the same on every platform.
const ICONS={first:'M6 5v14M19 6l-8 6 8 6',prev:'M15 5l-7 7 7 7',next:'M9 5l7 7-7 7',last:'M18 5v14M5 6l8 6-8 6',
  thumbs:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',outline:'M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11',
  zoomOut:'M5 12h14',zoomIn:'M12 5v14M5 12h14',mode:'M3 5h8v14H3zM13 5h8v14h-8z',full:'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',auto:'M8 5l11 7-11 7z'};
const icon=name=>{const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');path.setAttribute('d',ICONS[name]);svg.append(path);return svg;};
let serial=0;
// The book that last had the pointer or the focus receives the arrow keys.
let activeBook=null;

export class PdfBook {
  constructor(element, config) {
    this.el=element;this.config=normalizeConfig(config);this.page=1;this.zoom=1;this.id=++serial;this.abort=new AbortController();
    this.pdf=new PdfDocument();this.items=[];this.busy=false;this.pending=null;this.disposed=false;this.single=true;this.autoTimer=null;
    this.previousActive=activeBook;if(this.config.fill||!activeBook)activeBook=this;
    this.build();this.ready=this.load();
  }
  on(el,type,fn){el.addEventListener(type,fn,{signal:this.abort.signal});}
  button(label,name,action){const b=make('button','pdfbook-button');b.append(icon(name));b.type='button';b.title=label;b.setAttribute('aria-label',label);this.on(b,'click',action);return b;}
  build(){
    this.el.classList.add('pdfbook');this.el.classList.toggle('is-fill',this.config.fill);this.el.dataset.state='loading';this.el.setAttribute('role','region');this.el.setAttribute('aria-label',this.config.title);
    this.el.style.setProperty('--pdfbook-height',`${this.config.height}px`);this.el.style.setProperty('--pdfbook-bg',this.config.background);
    const heading=make('div','pdfbook-heading');heading.append(make('strong','',this.config.title));
    this.status=make('span','pdfbook-status','PDF wird geladen …');this.status.setAttribute('role','status');heading.append(this.status);
    this.body=make('div','pdfbook-body');this.sidebar=make('aside','pdfbook-sidebar');this.sidebar.hidden=true;
    this.stage=make('div','pdfbook-stage');this.stage.tabIndex=0;this.stage.setAttribute('aria-label','Buchseiten. Mit Pfeiltasten blättern.');
    this.spread=make('div','pdfbook-spread');this.stage.append(this.spread);
    // The turn overlay covers the whole stage area (not only the spread), so a lifted page is not clipped at the page edges.
    this.stageWrap=make('div','pdfbook-stagewrap');this.stageWrap.append(this.stage);this.body.append(this.sidebar,this.stageWrap);
    this.toolbar=make('div','pdfbook-toolbar');this.toolbar.setAttribute('role','group');this.toolbar.setAttribute('aria-label','PDF-Steuerung');
    this.first=this.button('Erste Seite','first',()=>this.go(1));this.prev=this.button('Vorherige Seite','prev',()=>this.move(-1));
    const label=make('label','pdfbook-page-label','Seite ');this.input=make('input');this.input.type='number';this.input.min='1';this.input.value='1';this.input.setAttribute('aria-label','Seitennummer');
    this.total=make('span','',' / –');label.append(this.input,this.total);
    this.on(this.input,'change',()=>this.go(Number(this.input.value)));this.on(this.input,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.go(Number(this.input.value));}});
    this.next=this.button('Nächste Seite','next',()=>this.move(1));this.last=this.button('Letzte Seite','last',()=>this.go(this.pdf.count));
    this.thumbs=this.button('Seitenübersicht','thumbs',()=>this.showSidebar('thumbs'));this.outline=this.button('Inhaltsverzeichnis','outline',()=>this.showSidebar('outline'));
    this.zoomOut=this.button('Verkleinern','zoomOut',()=>this.setZoom(this.zoom-.25));this.zoomIn=this.button('Vergrößern','zoomIn',()=>this.setZoom(this.zoom+.25));
    // Shows the current zoom; a click restores the original size.
    this.zoomReset=make('button','pdfbook-button pdfbook-zoom','100 %');this.zoomReset.type='button';this.zoomReset.title='Originalgröße (100 %)';this.zoomReset.setAttribute('aria-label','Originalgröße wiederherstellen, Zoom 100 %');this.on(this.zoomReset,'click',()=>this.setZoom(1));
    // Cycles auto → single → double → auto, so the automatic mode can always be restored.
    this.mode=this.button(MODE_LABEL[this.config.mode],'mode',()=>{this.config.mode=nextMode(this.config.mode);this.updateModeButton();this.go(this.target(),false);});
    this.full=this.button('Vollbild','full',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await this.el.requestFullscreen();}catch{this.status.textContent='Vollbild ist hier nicht verfügbar.';}});
    this.auto=this.button('Automatisch blättern','auto',()=>this.toggleAuto());this.auto.setAttribute('aria-pressed','false');
    this.download=make('a','pdfbook-button pdfbook-download','PDF öffnen');this.download.target='_blank';this.download.rel='noopener noreferrer';this.download.hidden=!this.config.download;
    this.toolbar.append(this.first,this.prev,label,this.next,this.last,this.thumbs,this.outline,this.zoomOut,this.zoomReset,this.zoomIn,this.mode,this.full,this.auto,this.download);
    // Cinema mode: without heading the status becomes an overlay on the stage (visible while loading or on error,
    // otherwise only for screen readers); without toolbar the controls stay as detached state holders.
    this.el.classList.toggle('no-heading',!this.config.showHeading);this.el.classList.toggle('no-frame',!this.config.showFrame);
    this.el.classList.toggle('is-autoheight',this.config.autoHeight&&!this.config.fill);
    if(!this.config.showHeading)this.stageWrap.append(this.status);
    this.el.replaceChildren(...(this.config.showHeading?[heading]:[]),this.body,...(this.config.showToolbar?[this.toolbar]:[]));
    // Audio may only start after a user gesture in the page; prepare it on the first one.
    for(const type of ['pointerdown','keydown'])this.on(this.el,type,()=>this.unlockSound());
    // Home/End need focus on the stage; the arrow keys also work without focus for the active book (see onKey).
    this.on(this.stage,'keydown',e=>{if(e.target!==this.stage)return;if(e.key==='Home'){e.preventDefault();this.go(1);}if(e.key==='End'){e.preventDefault();this.go(this.pdf.count);}});
    this.on(document,'keydown',e=>this.onKey(e));
    for(const type of ['pointerenter','pointerdown','focusin'])this.on(this.el,type,()=>{activeBook=this;});
    this.on(this.stage,'pointerdown',e=>{if(e.button===0&&!e.target.closest('a,button'))this.pointer={x:e.clientX,y:e.clientY};});
    this.on(this.stage,'pointerup',e=>{
      if(!this.pointer)return;const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;this.pointer=null;
      const rtl=this.config.direction==='rtl'?-1:1;
      if(Math.abs(dx)<8&&Math.abs(dy)<8){
        // A plain click or tap on a page turns it: right half forwards, left half backwards.
        const box=this.spread.getBoundingClientRect(),area=this.stage.getBoundingClientRect();
        if(e.clientX-area.left>this.stage.clientWidth||e.clientY-area.top>this.stage.clientHeight)return;   // scrollbars
        if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)return;
        this.move((e.clientX<box.left+box.width/2?-1:1)*rtl);return;
      }
      if(Math.abs(dx)<=65||Math.abs(dx)<=Math.abs(dy)*1.5)return;
      // When zoomed, a horizontal swipe scrolls the page first and only turns it at the scroll edge.
      if(this.zoom>1){const s=this.stage,max=s.scrollWidth-s.clientWidth;if(max>1&&(dx<0?s.scrollLeft<max-1:s.scrollLeft>1))return;}
      this.move((dx<0?1:-1)*rtl);
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
      if(this.config.autoplay&&!this.disposed&&this.el.dataset.state==='ready')this.startAuto();
    }catch(error){if(!this.disposed){this.fail(error);await this.pdf.dispose();}}
  }
  fail(error){
    console.warn('PDF Book:',error);
    this.el.dataset.state='error';this.status.textContent=messageFor(error);this.pending=null;this.stopAuto();this.updateControls();
    // The error state is final: release document, worker, render tasks and page cache right away (N2).
    this.thumbObserver?.disconnect();this.turn?.dispose();this.turn=null;this.overlay?.remove();this.overlay=null;
    this.pdf.dispose().catch(()=>{});
  }
  /** Page the viewer is heading to: a queued request, else the page being rendered, else the page shown. */
  target(){return this.pending?.number??this.inflight??this.page;}
  async go(number, animate=true){
    if(this.disposed||!this.pdf.doc||this.el.dataset.state==='error')return;
    // Input that arrives while a page renders or turns is queued (latest page wins) instead of being dropped. The queued
    // request keeps its animation: after the running turn has finished, one complete turn goes straight to that page.
    if(this.busy){this.pending={number,animate:animate||!!this.pending?.animate};this.updateControls();return;}
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
      // Newer input arrived while rendering and before anything moved: skip this page and turn once to the newest one.
      if(animate&&this.pending&&this.pending.number!==target){this.pending.animate=true;return;}
      const wasSingle=this.single,kind=this.config.renderer;
      const motion=animate&&previous.length>0&&target!==oldPage&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
      const direction=(target>oldPage?1:-1)*(this.config.direction==='rtl'?-1:1);
      this.single=single;this.page=target;this.items=items;
      if(animate&&previous.length>0&&target!==oldPage)this.rustle();
      if(motion&&(kind==='slide'||kind==='flip'||kind==='fade')&&single===wasSingle){
        await (kind==='slide'?this.slide(items,direction):kind==='flip'?this.flip(items,direction,target>oldPage):this.fade(items));
        if(this.disposed)return;
      }else if(motion&&kind==='webgl'&&!single&&!wasSingle&&previous.length===2&&this.turn?.available){
        const from=direction>0?1:0,to=1-from;
        // While the sheet turns, the side it leaves already shows the new page and the side it lands on still shows
        // the old one; the sheet carries the old page on its front and the new page on its back.
        const during=[];during[from]=items[from];during[to]=previous[to];
        this.mountPages(during,false);
        const c=this.config,look={curvature:c.curvature/50,opacity:c.shadowDensity/100,blur:c.shadowSoftness/100*.1,shift:c.shadowWidth/100*.8};
        await this.turn.play(previous[from]?.canvas||blank(),items[to]?.canvas||blank(),direction,c.duration,this.spread,look);
        if(this.disposed)return;
        this.mountPages(items);
      }else this.mountPages(items);
      if(this.disposed)return;
      this.status.textContent=statusText(numbers);
      this.el.dataset.state='ready';this.el.dataset.page=String(target);this.el.dataset.renderer=kind==='slide'||kind==='flip'||kind==='fade'?kind:this.turn?.available&&!single?'webgl':'flat';
    }catch(error){if(!this.disposed)this.fail(error instanceof ViewerError?error:new ViewerError('render',error));}
    finally{
      this.busy=false;this.inflight=null;this.el.removeAttribute('aria-busy');
      if(!this.disposed){
        const queued=this.pending;this.pending=null;this.updateControls();
        if(queued&&this.el.dataset.state!=='error')this.go(queued.number,queued.animate);
      }
    }
  }
  /** Alternative to the 3D turn: the old pages slide out and the new ones slide in. Works without WebGL and for single pages. */
  async slide(items,direction){
    const old=make('div','pdfbook-slide');old.append(...this.spread.children);
    this.mountPages(items);
    const fresh=make('div','pdfbook-slide');fresh.append(...this.spread.children);
    this.spread.append(old,fresh);this.spread.classList.add('is-sliding');
    const options={duration:this.config.duration,easing:'cubic-bezier(.3,0,.2,1)'};
    try{
      await Promise.all([
        old.animate([{transform:'translateX(0)'},{transform:`translateX(${-direction*100}%)`}],options).finished,
        fresh.animate([{transform:`translateX(${direction*100}%)`},{transform:'translateX(0)'}],options).finished,
      ]);
    }catch{/* cancelled: fall through to the final state */}
    old.remove();
    if(fresh.parentNode===this.spread){this.spread.append(...fresh.children);fresh.remove();}
    this.spread.classList.remove('is-sliding');
  }
  /**
   * Flip-board fold: the spread (or the single page) is split in the middle and one half folds over like a rigid
   * board, with perspective and shading. CSS 3D only, so it needs no WebGL and works for single pages too.
   * Horizontal: forward the right half folds onto the left (mirrored for right-to-left books). Vertical: forward the
   * top half folds down, backward the bottom half folds up (owner preference since alpha.13). "auto" folds vertically in single-page view.
   */
  async flip(items,direction,ahead){
    const vertical=this.config.flipAxis==='vertical'||(this.config.flipAxis==='auto'&&this.single);
    const moverB=vertical?!ahead:direction>0;   // A = left/top half, B = right/bottom half; the mover half folds over
    const old=make('div','pdfbook-slide');old.append(...this.spread.children);
    const oldCopy=copyLayer(old);
    this.mountPages(items);
    const fresh=make('div','pdfbook-slide');fresh.append(...this.spread.children);
    const freshCopy=copyLayer(fresh);
    const half=b=>vertical?(b?'inset(50% 0 0 0)':'inset(0 0 50% 0)'):(b?'inset(0 0 0 50%)':'inset(0 50% 0 0)');
    // The half the board leaves shows the new pages at once; the half it lands on keeps the old ones until covered.
    old.style.clipPath=half(!moverB);fresh.style.clipPath=half(moverB);
    // Horizontal part of a half that holds a page, as [left, width] fractions; empty page slots (beside the cover) get no shade.
    const filled=(layer,b)=>{const p=[...layer.children].map(e=>!e.classList.contains('is-blank'));
      if(p.length<2)return p[0]?[0,1]:null;
      if(!vertical)return p[b?1:0]?[0,1]:null;
      return p[0]&&p[1]?[0,1]:p[0]?[0,.5]:p[1]?[.5,.5]:null;};
    const shade=(b,span)=>{const el=make('div','pdfbook-fold-shade');if(!span){el.hidden=true;return el;}
      Object.assign(el.style,vertical?{top:b?'50%':'0',height:'50%',left:`${span[0]*100}%`,width:`${span[1]*100}%`}:{top:'0',height:'100%',left:b?'50%':'0',width:'50%'});return el;};
    const revealed=shade(moverB,filled(fresh,moverB)),covered=shade(!moverB,filled(old,!moverB));
    const board=make('div','pdfbook-fold');
    Object.assign(board.style,vertical?{left:'0',width:'100%',top:moverB?'50%':'0',height:'50%',transformOrigin:moverB?'center top':'center bottom'}
      :{top:'0',height:'100%',left:moverB?'50%':'0',width:'50%',transformOrigin:moverB?'left center':'right center'});
    const axis=vertical?'rotateX':'rotateY',turn=(vertical?1:-1)*(moverB?180:-180);
    const face=(layer,b,back)=>{
      const f=make('div','pdfbook-fold-face');if(back)f.style.transform=`${axis}(180deg)`;
      layer.classList.add('pdfbook-fold-pages');layer.classList.toggle('is-vertical',vertical);layer.style[vertical?'top':'left']=b?'-100%':'0';
      const dark=make('div','pdfbook-fold-dark'),span=filled(layer,b);
      if(!span)dark.hidden=true;else if(vertical){dark.style.left=`${span[0]*100}%`;dark.style.width=`${span[1]*100}%`;}
      f.append(layer,dark);board.append(f);return dark;
    };
    // Front: the old half that lifts; back: the new half that comes down on the other side.
    const frontDark=face(oldCopy,moverB,false),backDark=face(freshCopy,!moverB,true);
    this.spread.append(old,fresh,revealed,covered,board);
    this.spread.classList.add('is-folding');this.stage.classList.add('is-folding');
    this.spread.style.perspective=`${Math.round((vertical?this.spread.offsetHeight:this.spread.offsetWidth)*3.5)}px`;
    const options={duration:this.config.duration,easing:'cubic-bezier(.45,0,.25,1)'};
    try{
      await Promise.all([
        board.animate([{transform:`${axis}(0deg)`},{transform:`${axis}(${turn/2}deg)`},{transform:`${axis}(${turn}deg)`}],options).finished,
        frontDark.animate([{opacity:0},{opacity:.35},{opacity:.35}],options).finished,
        backDark.animate([{opacity:.35},{opacity:.35},{opacity:0}],options).finished,
        revealed.animate([{opacity:.3},{opacity:0},{opacity:0}],options).finished,
        covered.animate([{opacity:0},{opacity:0},{opacity:.3}],options).finished,
      ]);
    }catch{/* cancelled: fall through to the final state */}
    old.remove();revealed.remove();covered.remove();board.remove();
    if(fresh.parentNode===this.spread){fresh.style.clipPath='';this.spread.append(...fresh.children);fresh.remove();}
    this.spread.classList.remove('is-folding');this.stage.classList.remove('is-folding');this.spread.style.perspective='';
  }
  /** Cross-fade: the new pages fade in under the old ones, then the old ones fade out. Works for single pages too. */
  async fade(items){
    const old=make('div','pdfbook-slide');old.append(...this.spread.children);
    this.mountPages(items);
    const fresh=make('div','pdfbook-slide');fresh.append(...this.spread.children);
    this.spread.append(fresh,old);this.spread.classList.add('is-sliding');
    const options={duration:this.config.duration,easing:'ease-in-out'};
    try{
      await Promise.all([
        fresh.animate([{opacity:0},{opacity:1,offset:.35},{opacity:1}],options).finished,
        old.animate([{opacity:1},{opacity:1,offset:.15},{opacity:0}],options).finished,
      ]);
    }catch{/* cancelled: fall through to the final state */}
    old.remove();
    if(fresh.parentNode===this.spread){this.spread.append(...fresh.children);fresh.remove();}
    this.spread.classList.remove('is-sliding');
  }
  mountPages(items,interactive=true){
    this.pageAbort?.abort();this.pageAbort=new AbortController();
    if(this.single||this.config.renderer!=='webgl'){this.turn?.dispose();this.turn=null;this.overlay?.remove();this.overlay=null;}
    const first=items.find(Boolean),ratio=first?first.canvas.width/first.canvas.height:.707;
    if(this.config.autoHeight&&!this.config.fill&&document.fullscreenElement!==this.el)this.fitHeight(ratio,items.length);
    const availableHeight=Math.max(220,this.stage.clientHeight-48),availableWidth=Math.max(200,this.stage.clientWidth-48);
    const pageWidth=Math.min(availableWidth/items.length,availableHeight*ratio)*this.zoom;
    this.spread.style.width=`${pageWidth*items.length}px`;this.spread.style.height=`${pageWidth/ratio}px`;
    this.spread.replaceChildren();this.spread.classList.toggle('is-single',this.single);
    for(const item of items){
      const wrapper=make('div',`pdfbook-page${item?'':' is-blank'}`);
      if(item){
        const canvas=make('canvas');canvas.width=item.canvas.width;canvas.height=item.canvas.height;canvas.getContext('2d').drawImage(item.canvas,0,0);
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PDF-Seite ${item.number}`);wrapper.append(canvas);
        for(const annotation of interactive?item.annotations:[]){
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
    if(!this.single&&this.config.renderer==='webgl'){
      if(!this.overlay){this.overlay=make('canvas','pdfbook-turn');this.overlay.hidden=true;this.overlay.setAttribute('aria-hidden','true');this.turn=new PageTurn(this.overlay);}
      if(this.overlay.parentNode!==this.stageWrap)this.stageWrap.append(this.overlay);
    }
  }
  /**
   * Automatic height: the stage gets the height at which the pages fill its width, using the format of the first page
   * shown (kept for the whole document, so the book does not jump between pages). At most the window height.
   * Width changes below 20 px keep the height, so a page scrollbar that appears or disappears cannot make it oscillate.
   */
  fitHeight(ratio,count){
    this.autoRatio??=ratio;const width=this.stage.clientWidth;
    if(this.autoFit&&this.autoFit.count===count&&Math.abs(this.autoFit.width-width)<20)return;
    const chrome=this.el.offsetHeight-this.body.offsetHeight,cap=Math.max(320,innerHeight-chrome-16);
    const pad=parseFloat(getComputedStyle(this.stage).paddingTop)*2||48;   // stage padding: 24 px, 12 px on narrow screens
    const height=Math.round(Math.min(cap,Math.max(160,Math.max(120,width-pad)/count/this.autoRatio+pad)));
    this.autoFit={count,width};this.el.style.setProperty('--pdfbook-height',`${height}px`);
  }
  async navigateDestination(dest){try{const n=await this.pdf.destination(dest);if(n)await this.go(n);}catch{this.status.textContent='Verknüpfte Seite nicht verfügbar.';}}
  onKey(e){
    if(activeBook!==this||this.disposed||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
    const target=e.target;
    if(target instanceof Element&&(target.closest('input,textarea,select,[contenteditable]')||(target.closest('.pdfbook')&&!this.el.contains(target))))return;
    const modal=document.querySelector('dialog[open]');if(modal&&!modal.contains(this.el))return;
    const box=this.el.getBoundingClientRect();if(box.bottom<0||box.top>innerHeight)return;   // not on screen
    e.preventDefault();this.unlockSound();this.move((e.key==='ArrowRight'?1:-1)*(this.config.direction==='rtl'?-1:1));
  }
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
    const percent=Math.round(this.zoom*100);this.zoomReset.textContent=`${percent} %`;this.zoomReset.setAttribute('aria-label',`Originalgröße wiederherstellen, Zoom ${percent} %`);
    if(!unavailable){this.zoomReset.disabled=percent===100;this.zoomOut.disabled=this.zoom<=.75;this.zoomIn.disabled=this.zoom>=2.5;}
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
  toggleAuto(){if(this.autoTimer)this.stopAuto();else this.startAuto();}
  startAuto(){
    if(this.autoTimer||this.disposed)return;this.auto.setAttribute('aria-pressed','true');
    // The interval never falls below the turn itself, so turns do not queue up.
    const every=Math.max(this.config.autoplayInterval*1000,this.config.duration+300);
    this.autoTimer=setInterval(()=>{
      if(this.busy||this.pending||this.el.dataset.state!=='ready')return;
      if(this.next.disabled){if(this.config.autoplayLoop)this.go(1);else this.stopAuto();}else this.move(1);
    },every);
  }
  unlockSound(){
    if(!this.config.sound||this.disposed)return;
    try{if(!this.audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;this.audio=new Context();}
      if(this.audio.state==='suspended')this.audio.resume().catch(()=>{});}catch{this.audio=null;}
  }
  /** Page sound, synthesised (no audio file): band-passed noise with an irregular grain, a quick rise and a long fade. */
  rustle(){
    const ctx=this.audio;if(!this.config.sound||!ctx||ctx.state!=='running')return;
    try{
      const length=Math.min(.7,Math.max(.18,this.config.duration/1000*.6)),rate=ctx.sampleRate,n=Math.floor(length*rate);
      const buffer=ctx.createBuffer(1,n,rate),data=buffer.getChannelData(0),decay=Math.exp(-1/(rate*.04));
      let grain=0;
      for(let i=0;i<n;i++){const t=i/n;if(Math.random()<240/rate)grain=.5+Math.random()*.8;grain*=decay;data[i]=(Math.random()*2-1)*Math.min(1,t/.08)*Math.pow(1-t,1.6)*(.55+grain);}
      const source=ctx.createBufferSource(),band=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),gain=ctx.createGain(),now=ctx.currentTime;
      source.buffer=buffer;band.type='bandpass';band.Q.value=.7;high.type='highpass';high.frequency.value=500;gain.gain.value=.5;
      band.frequency.setValueAtTime(1400,now);band.frequency.linearRampToValueAtTime(3800,now+length*.35);band.frequency.linearRampToValueAtTime(2000,now+length);
      source.connect(band).connect(high).connect(gain).connect(ctx.destination);source.start(now);
    }catch{/* sound is optional */}
  }
  stopAuto(){clearInterval(this.autoTimer);this.autoTimer=null;this.auto.setAttribute('aria-pressed','false');}
  async dispose(){if(this.disposed)return;this.disposed=true;if(activeBook===this)activeBook=this.previousActive?.disposed?null:this.previousActive||null;this.pending=null;this.stopAuto();this.abort.abort();this.pageAbort?.abort();this.sidebarAbort?.abort();this.resize.disconnect();this.thumbObserver?.disconnect();clearTimeout(this.resizeTimer);this.turn?.dispose();this.audio?.close().catch(()=>{});this.audio=null;await this.pdf.dispose();}
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
