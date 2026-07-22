(function(){
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header=document.getElementById('header');
  function onScroll(){header.classList.toggle('solid', window.scrollY>window.innerHeight*0.7);}
  onScroll();window.addEventListener('scroll',onScroll,{passive:true});
  var mb=document.getElementById('menuBtn'),mm=document.getElementById('mobileMenu');
  mb.addEventListener('click',function(){mm.classList.toggle('open');});
  mm.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){mm.classList.remove('open');});});

  var bandImg=document.getElementById('bandImg'),band=document.querySelector('.band');
  function bandPar(){if(reduce)return;if(bandImg&&band){var r=band.getBoundingClientRect();bandImg.style.transform='translateY('+((r.top-window.innerHeight/2)*-0.05)+'px)';}}
  window.addEventListener('scroll',bandPar,{passive:true});bandPar();

  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:.16});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
  var navAs=[].slice.call(document.querySelectorAll('.nav-links a'));
  var secIds=navAs.map(function(a){return a.getAttribute('href').slice(1);});
  var nio=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){var id=en.target.id;navAs.forEach(function(a){a.classList.toggle('act',a.getAttribute('href')==='#'+id);});}});},{rootMargin:'-40% 0px -55% 0px'});
  secIds.forEach(function(id){var s=document.getElementById(id);if(s)nio.observe(s);});
  var fio=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');fio.unobserve(en.target);}});},{threshold:.28});
  document.querySelectorAll('.f-media').forEach(function(el){fio.observe(el);});

  function fmt(v,dec){return v.toFixed(dec);}
  function animCount(el){var target=parseFloat(el.getAttribute('data-count')),suffix=el.getAttribute('data-suffix')||'',dec=(target%1!==0)?1:0;if(reduce){el.textContent=fmt(target,dec)+suffix;return;}var start=null;function step(ts){if(!start)start=ts;var p=Math.min((ts-start)/1500,1),e=1-Math.pow(1-p,3);el.textContent=fmt(target*e,dec)+suffix;if(p<1)requestAnimationFrame(step);else el.textContent=fmt(target,dec)+suffix;}requestAnimationFrame(step);}
  var cio=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){animCount(en.target);cio.unobserve(en.target);}});},{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(function(el){cio.observe(el);});
  var bio=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){(en.target as HTMLElement).style.width=en.target.getAttribute('data-bar')+'%';bio.unobserve(en.target);}});},{threshold:.5});
  document.querySelectorAll('[data-bar]').forEach(function(el){bio.observe(el);});
  var proc=document.getElementById('proc'),procFill=document.getElementById('procFill');
  var pio=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){procFill.style.width='100%';proc.querySelectorAll('.proc-step').forEach(function(s,i){setTimeout(function(){s.classList.add('on');},i*230);});pio.unobserve(en.target);}});},{threshold:.4});
  if(proc)pio.observe(proc);

  var sites=[
    {x:34,y:22,name:'Elk Range Lodge',coord:"N 39°38'02\" · W 106°22'40\"",st:'active',lbl:'Active · Phase 05'},
    {x:52,y:34,name:'Aspen Ridge',coord:"N 39°11'26\" · W 106°49'11\"",st:'done',lbl:'Delivered · 2024'},
    {x:68,y:52,name:'Cascade Lodge',coord:"N 43°28'55\" · W 110°45'40\"",st:'done',lbl:'Delivered · 2025'},
    {x:44,y:64,name:'The Aster Residence',coord:"N 37°56'14\" · W 107°48'42\"",st:'done',lbl:'Delivered · 2025'},
    {x:26,y:48,name:'Powderhorn Estate',coord:"N 39°35'10\" · W 106°38'02\"",st:'active',lbl:'Active · Phase 03'},
    {x:60,y:20,name:'Timberline Villa',coord:"N 40°30'22\" · W 106°49'01\"",st:'active',lbl:'Active · Phase 04'},
    {x:78,y:70,name:'Blue River Retreat',coord:"N 39°28'11\" · W 106°02'02\"",st:'done',lbl:'Delivered · 2023'}
  ];
  var mapCanvas=document.getElementById('mapCanvas'),mapName=document.getElementById('mapName'),mapCoord=document.getElementById('mapCoord'),mapStatus=document.getElementById('mapStatus');
  function selectSite(s){mapName.style.opacity='0';setTimeout(function(){mapName.textContent=s.name;mapCoord.textContent=s.coord;mapStatus.innerHTML='<span class="d" style="background:'+(s.st==='active'?'var(--bronze)':'var(--ink)')+'"></span> '+s.lbl;mapName.style.opacity='1';},150);}
  sites.forEach(function(s){var m=document.createElement('div');m.className='marker '+(s.st==='active'?'active':'done');m.style.left=s.x+'%';m.style.top=s.y+'%';m.innerHTML='<div class="pin"></div>';m.setAttribute('tabindex','0');m.setAttribute('role','button');m.setAttribute('aria-label',s.name);m.addEventListener('click',function(){selectSite(s);});m.addEventListener('mouseenter',function(){selectSite(s);});m.addEventListener('focus',function(){selectSite(s);});mapCanvas.appendChild(m);});

  var rates={res:[350,470],est:[420,560],ren:[320,520]},typeName={res:'Mountain home',est:'Estate / lodge',ren:'Renovation'};
  var state={type:'res',sqft:6000,fin:1.8,finName:'Bespoke',site:1,siteName:'Standard'};
  function money(n){return n>=1e6?'$'+(n/1e6).toFixed(2)+'M':'$'+Math.round(n/1000)+'K';}
  function calc(){var r=rates[state.type],loR=r[0]*state.fin*state.site,hiR=r[1]*state.fin*state.site,lo=loR*state.sqft,hi=hiR*state.sqft;
    document.getElementById('eoRange').textContent=money(lo)+' – '+money(hi);
    document.getElementById('eoPer').textContent='≈ $'+Math.round(loR)+' – $'+Math.round(hiR)+' / sq ft · '+state.sqft.toLocaleString()+' sq ft';
    document.getElementById('eoBase').textContent='$'+r[0]+' – $'+r[1]+' / sq ft';
    document.getElementById('eoFin').textContent=state.finName+' ×'+state.fin.toFixed(2);
    document.getElementById('eoSite').textContent=state.siteName+' ×'+state.site.toFixed(2);
    var months=Math.round(10+state.sqft/720*state.site);document.getElementById('eoDur').textContent=(months-1)+' – '+(months+2)+' months';
    document.getElementById('lblType').textContent=typeName[state.type];document.getElementById('lblSqft').textContent=state.sqft.toLocaleString()+' sq ft';
    document.getElementById('lblFinish').textContent=state.finName;document.getElementById('lblSite').textContent=state.siteName;}
  function segWire(id,fn){var seg=document.getElementById(id);seg.querySelectorAll('button').forEach(function(bn){bn.addEventListener('click',function(){seg.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});bn.classList.add('on');fn(bn);calc();});});}
  segWire('segType',function(b){state.type=b.getAttribute('data-type');});
  segWire('segFinish',function(b){state.fin=parseFloat(b.getAttribute('data-fin'));state.finName=b.textContent;});
  segWire('segSite',function(b){state.site=parseFloat(b.getAttribute('data-site'));state.siteName=b.textContent;});
  document.getElementById('sqft').addEventListener('input',function(){state.sqft=parseInt((this as HTMLInputElement).value,10);calc();});
  calc();
  var coBtn=document.getElementById('coBtn');if(coBtn)coBtn.addEventListener('click',function(){this.textContent='Approved ✓';this.style.background='var(--bronze-d)';});
  var ctaSend=document.getElementById('ctaSend');if(ctaSend)ctaSend.addEventListener('click',function(){var n=(document.getElementById('cName') as HTMLInputElement).value.trim();this.innerHTML=(n?'Thank you, '+n.split(' ')[0]+" — we'll be in touch ✓":'Request received ✓');});
})();
