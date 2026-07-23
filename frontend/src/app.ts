(function(){
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header=document.getElementById('header');
  var progressFill=document.querySelector('#pageProgress span') as HTMLElement;
  function updateProgress(){if(!progressFill)return;var max=document.documentElement.scrollHeight-window.innerHeight;var pct=max>0?(window.scrollY/max)*100:0;progressFill.style.width=Math.max(0,Math.min(100,pct))+'%';}
  function onScroll(){header.classList.toggle('solid', window.scrollY>window.innerHeight*0.7);updateProgress();}
  onScroll();window.addEventListener('scroll',onScroll,{passive:true});
  var mb=document.getElementById('menuBtn'),mm=document.getElementById('mobileMenu');
  function setMenu(open){mm.classList.toggle('open',open);mb.classList.toggle('open',open);mb.setAttribute('aria-expanded',open?'true':'false');mm.setAttribute('aria-hidden',open?'false':'true');document.body.classList.toggle('menu-open',open);}
  mb.addEventListener('click',function(){setMenu(!mm.classList.contains('open'));});
  mm.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){setMenu(false);});});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false);});

  var bandImg=document.getElementById('bandImg'),band=document.querySelector('.band');
  function bandPar(){if(reduce)return;if(bandImg&&band){var r=band.getBoundingClientRect();bandImg.style.transform='translateY('+((r.top-window.innerHeight/2)*-0.05)+'px)';}}
  window.addEventListener('scroll',bandPar,{passive:true});bandPar();

  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:.16});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
  var navAs=[].slice.call(document.querySelectorAll('.nav-links a'));
  function setActiveNav(id){navAs.forEach(function(a){var on=a.getAttribute('href')==='#'+id;a.classList.toggle('act',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
  function navOffset(){return Math.ceil((header?header.getBoundingClientRect().height:0)+12);}
  function jumpToHash(hash,writeHistory){
    if(!hash||hash==='#')return false;
    var id=hash.slice(1),target=document.getElementById(id);
    if(!target)return false;
    var y=id==='top'?0:target.getBoundingClientRect().top+window.pageYOffset-navOffset();
    window.scrollTo(0,Math.max(0,Math.round(y)));
    if(writeHistory&&window.location.hash!==hash)history.pushState(null,'',hash);
    setActiveNav(id);
    return true;
  }
  document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){var hash=(a as HTMLAnchorElement).getAttribute('href');if(jumpToHash(hash,true)){e.preventDefault();if(mm)mm.classList.remove('open');}});});
  window.addEventListener('hashchange',function(){jumpToHash(window.location.hash,false);});
  window.addEventListener('popstate',function(){jumpToHash(window.location.hash,false);});
  if(window.location.hash)setTimeout(function(){jumpToHash(window.location.hash,false);},0);
  var secIds=navAs.map(function(a){return a.getAttribute('href').slice(1);});
  var nio=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){setActiveNav(en.target.id);}});},{rootMargin:'-40% 0px -55% 0px'});
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
    {x:34,y:22,name:'Project Timberline',coord:'Colorado mountain region · exact site private',st:'active',lbl:'Active · Phase 05'},
    {x:52,y:34,name:'Project North Star',coord:'Colorado high country · exact site private',st:'done',lbl:'Delivered · 2024'},
    {x:68,y:52,name:'Project Cascade',coord:'Mountain West region · exact site private',st:'done',lbl:'Delivered · 2025'},
    {x:44,y:64,name:'Project Aster',coord:'Southwest Colorado · exact site private',st:'done',lbl:'Delivered · 2025'},
    {x:26,y:48,name:'Project Stonepine',coord:'Colorado resort corridor · exact site private',st:'active',lbl:'Active · Phase 03'},
    {x:60,y:20,name:'Project Summit',coord:'Northern Colorado · exact site private',st:'active',lbl:'Active · Phase 04'},
    {x:78,y:70,name:'Project Blue River',coord:'Private lake / river region · exact site private',st:'done',lbl:'Delivered · 2023'}
  ];
  var mapCanvas=document.getElementById('mapCanvas'),mapName=document.getElementById('mapName'),mapCoord=document.getElementById('mapCoord'),mapStatus=document.getElementById('mapStatus');
  function selectSite(s){mapName.style.opacity='0';setTimeout(function(){mapName.textContent=s.name;mapCoord.textContent=s.coord;mapStatus.innerHTML='<span class="d" style="background:'+(s.st==='active'?'var(--bronze)':'var(--ink)')+'"></span> '+s.lbl;mapName.style.opacity='1';},150);}
  sites.forEach(function(s){var m=document.createElement('div');m.className='marker '+(s.st==='active'?'active':'done');m.style.left=s.x+'%';m.style.top=s.y+'%';m.innerHTML='<div class="pin"></div>';m.setAttribute('tabindex','0');m.setAttribute('role','button');m.setAttribute('aria-label',s.name);m.addEventListener('click',function(){selectSite(s);});m.addEventListener('mouseenter',function(){selectSite(s);});m.addEventListener('focus',function(){selectSite(s);});mapCanvas.appendChild(m);});

  var typeName={interiors:'Interiors/Remodeling',residential:'Residential',commercial:'Commercial',custom:'Custom'};
  var fitCopy={
    interiors:{head:'Interior / remodel review',body:'Existing conditions, finish goals, phasing, and occupied-space constraints are reviewed before scope is set.',next:'Walkthrough consult'},
    residential:{head:'Residential discovery',body:'Custom homes and private residences start with goals, site context, privacy, schedule, and design-intent alignment.',next:'Discovery call'},
    commercial:{head:'Commercial discovery',body:'Retail, hospitality, office, and tenant-improvement work starts with operations, phasing, code, and brand requirements.',next:'Use-case review'},
    custom:{head:'Custom scope review',body:'Unique projects begin with a confidential conversation around the vision, constraints, standards, and the right delivery path.',next:'Private consult'}
  };
  var stageNext={'Planning / budgeting':'Scope discovery','Ready to build':'Pre-construction review','In progress / rescue':'Stabilization review'};
  var state={type:'interiors',sqft:6000,stageName:'Planning / budgeting'};
  function calc(){var fit=fitCopy[state.type]||fitCopy.interiors;
    document.getElementById('eoRange').textContent=fit.head;
    document.getElementById('eoPer').textContent=fit.body;
    document.getElementById('eoBase').textContent=typeName[state.type];
    document.getElementById('eoFin').textContent=state.sqft.toLocaleString()+' sq ft';
    document.getElementById('eoStage').textContent=state.stageName;
    document.getElementById('eoDur').textContent=stageNext[state.stageName]||fit.next;
    document.getElementById('lblType').textContent=typeName[state.type];document.getElementById('lblSqft').textContent=state.sqft.toLocaleString()+' sq ft';
    document.getElementById('lblStage').textContent=state.stageName;}
  function segWire(id,fn){var seg=document.getElementById(id);if(!seg)return;seg.querySelectorAll('button').forEach(function(bn){bn.addEventListener('click',function(){seg.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});bn.classList.add('on');fn(bn);calc();});});}
  segWire('segType',function(b){state.type=b.getAttribute('data-type');});
  segWire('segStage',function(b){state.stageName=b.getAttribute('data-stage')||b.textContent;});
  document.getElementById('sqft').addEventListener('input',function(){state.sqft=parseInt((this as HTMLInputElement).value,10);calc();});
  calc();
  function prefillContact(projectType,note){
    var type=document.getElementById('cType') as HTMLSelectElement,notes=document.getElementById('cNotes') as HTMLTextAreaElement,name=document.getElementById('cName') as HTMLInputElement;
    if(type&&projectType)type.value=projectType;
    if(notes&&note&&!notes.value.trim())notes.value=note;
    setTimeout(function(){if(name)name.focus({preventScroll:true});},80);
  }
  var fitCta=document.getElementById('fitCta');
  if(fitCta)fitCta.addEventListener('click',function(){
    prefillContact(typeName[state.type],'Project fit: '+typeName[state.type]+' · '+state.sqft.toLocaleString()+' sq ft · '+state.stageName+'.');
  });
  document.querySelectorAll('[data-enquiry-note]').forEach(function(link){
    link.addEventListener('click',function(){
      prefillContact((link as HTMLElement).getAttribute('data-enquiry-type'),(link as HTMLElement).getAttribute('data-enquiry-note'));
    });
  });
  var contactForm=document.getElementById('contactForm') as HTMLFormElement,ctaSend=document.getElementById('ctaSend') as HTMLButtonElement,formStatus=document.getElementById('formStatus');
  function setFormStatus(msg,type){if(!formStatus)return;formStatus.textContent=msg;formStatus.className='form-status '+(type||'');}
  function setInvalid(el,on){if(el)el.classList.toggle('is-invalid',!!on);}
  if(contactForm)contactForm.addEventListener('submit',async function(e){e.preventDefault();
    var name=document.getElementById('cName') as HTMLInputElement,email=document.getElementById('cEmail') as HTMLInputElement,type=document.getElementById('cType') as HTMLSelectElement,notes=document.getElementById('cNotes') as HTMLTextAreaElement;
    [name,email,type,notes].forEach(function(el){setInvalid(el,false);});
    var errors=[];if(!name.value.trim()){errors.push('name');setInvalid(name,true);}if(!email.validity.valid){errors.push('email');setInvalid(email,true);}if(!type.value){errors.push('project type');setInvalid(type,true);}
    if(errors.length){setFormStatus('Please check your '+errors.join(', ')+' before sending.','err');return;}
    var original=ctaSend.innerHTML;ctaSend.disabled=true;ctaSend.innerHTML='<span class="btn-label">Sending securely...</span>';
    try{
      var res=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value,email:email.value,projectType:type.value,approxSqft:state.sqft,projectStage:state.stageName,notes:notes.value,source:'constructx-site'})});
      var data=await res.json().catch(function(){return{};});
      if(!res.ok){setFormStatus((data&&data.error)||'Could not save the enquiry. Please check the form and try again.','err');ctaSend.innerHTML=original;return;}
      setFormStatus((data&&data.message)||'Enquiry received. We’ll review it and follow up with the right next step.','ok');
      ctaSend.innerHTML='<span class="btn-label">Project conversation started ✓</span>';
      contactForm.reset();
    }catch(err){
      setFormStatus('The site is running, but the enquiry API did not respond. Try again after restarting npm run dev.','err');
      ctaSend.innerHTML=original;
    }finally{
      ctaSend.disabled=false;
    }
  });
})();
