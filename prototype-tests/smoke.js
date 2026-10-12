const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1240,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(p.url()+' '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(p.url()+' console '+m.text())});
for(const u of ['','tasks.html','workflows.html','rules.html','apps.html','onboarding.html','sent.html','practice.html','doc.html?d=ash-agreement','practice.html?wf=x']){await p.goto('http://localhost:8765/'+u);await p.waitForTimeout(300);const t=await p.evaluate(()=>document.querySelector('main')?document.querySelector('main').innerText.slice(0,150).replace(/\n/g,' | '):document.body.innerText.slice(0,150));console.log(u||'index','::',t);}
console.log('ERRORS',errs);await b.close();})();
