(function(){
  var T=(window as any).THREE,mount=document.getElementById('hero3d'),heroImg=document.getElementById('heroImg');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fallback(){if(heroImg)heroImg.style.display='';if(mount)mount.style.display='none';}
  var gl=false;try{var tc=document.createElement('canvas');gl=!!(window.WebGLRenderingContext&&(tc.getContext('webgl')||tc.getContext('experimental-webgl')));}catch(e){gl=false;}
  if(!T||!mount||!gl){fallback();return;}
  function start(){try{buildHero();}catch(e){fallback();}}
  if(document.readyState==='complete')start();else window.addEventListener('load',start);

  function buildHero(){
    var W=mount.clientWidth||900,H=mount.clientHeight||700;
    var renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(W,H);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    if(T.sRGBEncoding)renderer.outputEncoding=T.sRGBEncoding;
    if(T.ACESFilmicToneMapping)renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
    mount.appendChild(renderer.domElement);
    var scene=new T.Scene();

    function cnv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    function tex(canvas,rx,ry){var t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx||1,ry||1);if(T.sRGBEncoding)t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;}
    var stoneC=(function(){var c=cnv(256,256),x=c.getContext('2d');x.fillStyle='#c7bfae';x.fillRect(0,0,256,256);var y=0,row=0;while(y<256){var bh=26;for(var bx=(row%2?-24:0);bx<256;bx+=52){var bw=44+((bx*13+row*7)%16);var tt=196+((bx*row*17)%44);x.fillStyle='rgb('+(tt-18)+','+(tt-28)+','+(tt-46)+')';x.fillRect(bx+1,y+1,bw-2,bh-2);}x.strokeStyle='rgba(120,110,92,.85)';x.lineWidth=2;x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke();y+=bh;row++;}for(var i=0;i<1600;i++){x.fillStyle='rgba(0,0,0,'+(Math.random()*0.05)+')';x.fillRect(Math.random()*256,Math.random()*256,1,1);}return c;})();
    var woodC=(function(){var c=cnv(256,256),x=c.getContext('2d');x.fillStyle='#8a5f38';x.fillRect(0,0,256,256);for(var px=0;px<256;px+=22){x.fillStyle='rgba(60,40,22,.55)';x.fillRect(px,0,2,256);for(var s=0;s<44;s++){x.fillStyle='rgba('+(140+Math.random()*40|0)+','+(95+Math.random()*30|0)+','+(55+Math.random()*20|0)+',.16)';x.fillRect(px+2+Math.random()*18,Math.random()*256,10,1);}}return c;})();
    function facadeC(cols,rows){var c=cnv(256,256),x=c.getContext('2d');var g2=x.createLinearGradient(0,0,220,256);g2.addColorStop(0,'#e6d9b8');g2.addColorStop(.5,'#f4e8c8');g2.addColorStop(1,'#d6c096');x.fillStyle=g2;x.fillRect(0,0,256,256);x.strokeStyle='rgba(28,22,16,.72)';x.lineWidth=4;for(var a=0;a<=cols;a++){x.beginPath();x.moveTo(a*256/cols,0);x.lineTo(a*256/cols,256);x.stroke();}for(var b=0;b<=rows;b++){x.beginPath();x.moveTo(0,b*256/rows);x.lineTo(256,b*256/rows);x.stroke();}return c;}

    function stoneMat(rx,ry){return new T.MeshStandardMaterial({map:tex(stoneC,rx,ry),roughness:.9,metalness:0,envMapIntensity:.5});}
    function woodMat(rx,ry){return new T.MeshStandardMaterial({map:tex(woodC,rx,ry),roughness:.6,metalness:0,envMapIntensity:.3});}
    function glassMat(cols,rows){return new T.MeshPhysicalMaterial({map:tex(facadeC(cols,rows),1,1),color:0xdfe7ee,metalness:0,roughness:.05,clearcoat:1,clearcoatRoughness:.05,transparent:true,opacity:.4,envMapIntensity:1.4});}
    var bronzeMat=new T.MeshStandardMaterial({color:0x241f18,metalness:.65,roughness:.4,envMapIntensity:1.2});
    var snowMat=new T.MeshStandardMaterial({color:0xeef3f8,roughness:.85,metalness:0});
    var railMat=new T.MeshPhysicalMaterial({color:0xcfe0ea,metalness:0,roughness:.05,transparent:true,opacity:.16,clearcoat:1});
    function warmMat(){return new T.MeshBasicMaterial({color:0xffcf8f});}

    var g=new T.Group();scene.add(g);
    function box(w,h,d,m,x,y,z){var b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;}
    function warm(w,h,x,y,z){var p=new T.Mesh(new T.PlaneGeometry(w,h),warmMat());p.position.set(x,y,z);g.add(p);return p;}

    box(6.4,0.16,4.2,stoneMat(4,2),0,0.08,1.4);
    box(5,1.5,3.2,stoneMat(4,2),0,0.78,0);
    warm(3.4,1.05,0.3,0.75,1.54);box(3.5,1.15,0.06,glassMat(4,2),0.3,0.75,1.6);
    box(5.7,0.2,3.8,bronzeMat,0,1.64,0);
    box(4.7,1.4,3.0,stoneMat(4,2),-0.1,2.5,0);
    warm(3.7,1.0,0.25,2.5,1.5);box(3.8,1.15,0.06,glassMat(5,2),0.25,2.5,1.56);
    box(4.6,0.5,0.04,railMat,0.2,1.98,1.78);
    box(5.5,0.2,3.7,bronzeMat,-0.05,3.34,0);
    box(3.4,1.3,2.4,stoneMat(3,2),-0.4,4.05,-0.1);
    warm(2.2,0.95,0.1,4.05,1.14);box(2.3,1.05,0.06,glassMat(3,2),0.1,4.05,1.2);
    box(3.2,0.4,0.04,railMat,0.1,3.55,1.25);
    box(3.7,0.18,2.8,bronzeMat,-0.4,4.75,-0.1);
    box(3.5,0.07,2.6,snowMat,-0.4,4.85,-0.1);
    box(0.85,2.7,0.85,stoneMat(1,3),1.75,3.5,-0.2);
    box(0.98,0.16,0.98,bronzeMat,1.75,4.9,-0.2);
    box(4.6,0.06,0.5,woodMat(4,1),0.2,1.55,1.75);
    box(4.4,0.06,0.5,woodMat(4,1),0.15,3.25,1.7);

    function pine(x,z,h){var tr=new T.Mesh(new T.CylinderGeometry(0.05*h,0.075*h,0.32*h,6),new T.MeshStandardMaterial({color:0x53402c,roughness:.9}));tr.position.set(x,0.16*h,z);tr.castShadow=true;g.add(tr);var green=new T.MeshStandardMaterial({color:0x2c4531,roughness:.9});for(var i=0;i<4;i++){var t=i/4,r=0.34*h*(1-t*0.68),ch=0.44*h*(1-t*0.22),cy=0.3*h+i*0.24*h;var cone=new T.Mesh(new T.ConeGeometry(r,ch,8),green);cone.position.set(x,cy,z);cone.castShadow=true;g.add(cone);var cap=new T.Mesh(new T.ConeGeometry(r*0.72,ch*0.5,8),snowMat);cap.position.set(x,cy+ch*0.24,z);g.add(cap);}}
    pine(-3.1,2.0,3.7);pine(3.2,1.6,3.1);pine(-3.4,-1.6,4.0);pine(3.4,-1.9,3.4);pine(-4.2,0.3,3.3);

    function glight(x,z){var st=new T.Mesh(new T.CylinderGeometry(0.015,0.015,0.5,5),bronzeMat);st.position.set(x,0.25,z);g.add(st);var gl2=new T.Mesh(new T.SphereGeometry(0.07,10,8),warmMat());gl2.position.set(x,0.5,z);g.add(gl2);}
    for(var i=0;i<7;i++){glight(-2.4+i*0.7,2.35);}

    var ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xe8edf3,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    var scv=cnv(128,128),scx=scv.getContext('2d');var rgs=scx.createRadialGradient(64,64,8,64,64,64);rgs.addColorStop(0,'rgba(20,18,14,.4)');rgs.addColorStop(1,'rgba(20,18,14,0)');scx.fillStyle=rgs;scx.fillRect(0,0,128,128);
    var blob=new T.Mesh(new T.PlaneGeometry(12,9),new T.MeshBasicMaterial({map:new T.CanvasTexture(scv),transparent:true,depthWrite:false}));blob.rotation.x=-Math.PI/2;blob.position.set(0,0.02,0.4);scene.add(blob);

    var sky=(function(){var c=cnv(1024,512),x=c.getContext('2d');var grd=x.createLinearGradient(0,0,0,512);grd.addColorStop(0,'#2f3a63');grd.addColorStop(.5,'#f0b07a');grd.addColorStop(.52,'#cfd6de');grd.addColorStop(1,'#bfc6cf');x.fillStyle=grd;x.fillRect(0,0,1024,512);var sx2=0.8*1024,sy2=0.7*512*0.55;var rg2=x.createRadialGradient(sx2,sy2,4,sx2,sy2,300);rg2.addColorStop(0,'#ffdca6');rg2.addColorStop(.15,'rgba(255,210,140,.6)');rg2.addColorStop(1,'rgba(255,210,140,0)');x.fillStyle=rg2;x.fillRect(0,0,1024,340);function ridge(baseY,minH,maxH,col,snow){x.beginPath();x.moveTo(0,baseY);var n=14,pts=[];for(var i=0;i<=n;i++){var pxx=i/n*1024,pyy=baseY-(minH+Math.abs(Math.sin(i*1.7+baseY))*(maxH-minH));pts.push([pxx,pyy]);x.lineTo(pxx,pyy);}x.lineTo(1024,baseY);x.closePath();x.fillStyle=col;x.fill();x.fillStyle=snow;for(var j=0;j<pts.length;j++){var p=pts[j];if(baseY-p[1]>minH+(maxH-minH)*0.45){x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(p[0]-13,p[1]+20);x.lineTo(p[0]+13,p[1]+20);x.closePath();x.fill();}}}ridge(262,60,150,'rgba(143,160,189,.85)','rgba(238,243,250,.9)');ridge(266,30,90,'rgba(109,127,158,.95)','rgba(226,234,244,.85)');var t=new T.CanvasTexture(c);t.mapping=T.EquirectangularReflectionMapping;if(T.sRGBEncoding)t.encoding=T.sRGBEncoding;return t;})();
    scene.background=sky;scene.fog=new T.Fog(new T.Color(0xdcc6b2),18,54);
    var envMap=sky;try{var pm=new T.PMREMGenerator(renderer);pm.compileEquirectangularShader();envMap=pm.fromEquirectangular(sky).texture;}catch(e){}
    scene.environment=envMap;

    scene.add(new T.HemisphereLight(0x9fb0d0,0x2b2620,.55));
    var sun=new T.DirectionalLight(0xffc27a,1.7);sun.position.set(7,5,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=.5;sun.shadow.camera.far=60;var bnd=10;sun.shadow.camera.left=-bnd;sun.shadow.camera.right=bnd;sun.shadow.camera.top=bnd;sun.shadow.camera.bottom=-bnd;sun.shadow.bias=-0.0004;sun.shadow.radius=6;scene.add(sun);
    var fl=new T.DirectionalLight(0x7d8fd0,.28);fl.position.set(-6,4,-4);scene.add(fl);
    var pl=new T.PointLight(0xffb060,.7,10);pl.position.set(0.4,1.3,3);scene.add(pl);

    var cam=new T.PerspectiveCamera(33,W/H,0.1,300);cam.position.set(7,3.6,9.6);cam.lookAt(new T.Vector3(0,2.1,0));

    var rotY=0.5,spinT=0.5,dragging=false,px=0,interacted=false;g.rotation.y=rotY;
    function down(e){dragging=true;interacted=true;mount.style.cursor='grabbing';px=e.clientX;if(e.cancelable&&e.pointerType!=='touch')e.preventDefault();}
    function move(e){if(!dragging)return;spinT+=(e.clientX-px)*0.01;px=e.clientX;}
    function up(){dragging=false;mount.style.cursor='grab';}
    mount.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);mount.style.cursor='grab';
    (function loop(){requestAnimationFrame(loop);if(!dragging&&!interacted&&!reduce)spinT+=0.0022;rotY+=(spinT-rotY)*0.08;g.rotation.y=rotY;renderer.render(scene,cam);})();
    window.addEventListener('resize',function(){var w=mount.clientWidth,h=mount.clientHeight;if(!w||!h)return;cam.aspect=w/h;cam.updateProjectionMatrix();renderer.setSize(w,h);});
  }
})();
