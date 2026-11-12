const {safePdfUrl,safeLink,spreadFor,nextPage,normalizeConfig}=await import(new URL('file:///'+process.argv[2]+'/media/js/model.mjs').href);
globalThis.location={href:'https://x.example/'};
const bases=['https://site.example/cms/','https://site.example/'];
const cases=['images/ok.pdf','images//ok.pdf','images/a%2Bb%26c%27.pdf','images/sub/Brosch%C3%BCre.pdf','images/sub/Broschüre.pdf','images/%2fetc.pdf','images%2f..%2fx.pdf','images/%E2%80%AE.pdf','IMAGES/ok.pdf','images/ok.PDF','images/x.pdf;a=b','images/x.pdf\t','images/%C0%AE%C0%AE/x.pdf','imagesX/x.pdf','images.pdf','/cms/imagesx/a.pdf','/cms/images/../x.pdf','https://site.example:443/cms/images/a.pdf','HTTPS://SCHOOL.EXAMPLE/cms/images/a.pdf','http://site.example/cms/images/a.pdf','images/a.pdf%3F','\u3000images/a.pdf','images/\u00a0a.pdf','images/\u2028a.pdf'];
for(const b of bases)for(const c of cases){let r;try{r='ACCEPT '+safePdfUrl(c,b);}catch(e){r='reject '+e.message;}console.log(b.padEnd(28),JSON.stringify(c).padEnd(45),r);}
for(const l of ['HTTPS://A.example','mailto:x@y.z?subject=a','mailto:javascript:alert(1)','http://[::1]/','https://intranet.local/admin','tel:123',' https://a.example','https://a.example/\u0000']) console.log('link',JSON.stringify(l),safeLink(l));
console.log(JSON.stringify(normalizeConfig({background:'#ABCDEF',height:'1e9',duration:-5,mode:'x',download:0,title:{toString(){return 'obj'}}})));
console.log(spreadFor(2,2),spreadFor(1,1),spreadFor(2,3,false,true),nextPage(3,8,false,-1),spreadFor(0,8),spreadFor(NaN,8),spreadFor(5.9,8,true));
