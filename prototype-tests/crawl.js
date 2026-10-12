const {chromium}=require('playwright');
const BASE=process.env.BASE||'http://localhost:8765/';
const PAGES=['index.html','handled.html','handled.html#p-maya','handled.html#p-kim','doc.html?d=ash-appraisal','doc.html?d=marcus-email&view=original','report.html?view=original','tasks.html','workflows.html','rules.html','apps.html','onboarding.html','sent.html','practice.html','practice.html?wf=appraisal','doc.html?d=linden-title','report.html','comps.html'];
const SEL='button, a[href], [role=button], input[type=checkbox], select';
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1240,height:900}});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(p.url()+' :: '+e.message));
p.on('dialog',d=>{errs.push('DIALOG '+d.message());d.dismiss();});
let clicked=0,nav=0,nochange=[],skipped=0,second=0; const links=new Set();
const snap=()=>p.evaluate(()=>location.href+'|'+document.body.innerHTML.length+'|'+document.body.innerText.length+'|'+[...document.querySelectorAll('input,select')].map(i=>i.type==='checkbox'?i.checked:i.value).join(',')+'|'+document.activeElement?.outerHTML?.slice(0,60));
async function fresh(u){await p.goto(BASE+u);await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});await p.goto(BASE+u);await p.waitForTimeout(150);}
async function info(h){return h.evaluate(el=>{const r=el.getBoundingClientRect();const vis=r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';const a=el.closest('a');let href=a?a.getAttribute('href'):null;const navs=a&&!el.hasAttribute('data-doc')&&!a.hasAttribute('data-doc')&&href&&!href.startsWith('#')&&!/^javascript/.test(href);return {vis,href,navs,dis:el.disabled,txt:(el.innerText||el.getAttribute('aria-label')||el.tagName).trim().slice(0,40),tag:el.tagName}})}
async function act(h,i){ if(i.tag==='SELECT'){const opts=await h.evaluate(s=>[...s.options].map(o=>o.value));await h.selectOption(opts[opts.length-1]);} else if(i.tag==='INPUT') await h.click({timeout:2000,force:true}); /* switches hide the input under their track */ else await h.click({timeout:2000}); }
for(const u of PAGES){
  await fresh(u); const n=(await p.$$(SEL)).length; let pc=0;
  for(let i=0;i<n;i++){
    await fresh(u); const hs=await p.$$(SEL); const h=hs[i]; if(!h){continue;}
    const inf=await info(h); if(!inf.vis||inf.dis){skipped++;continue;}
    if(inf.navs){links.add(new URL(inf.href,BASE+u).href.split('#')[0]);nav++;continue;}
    const before=await snap(); const beforeSet=new Set(await p.$$eval(SEL,els=>els.map((e,k)=>k+e.outerHTML.slice(0,80))));
    try{await act(h,inf);}catch(e){errs.push(u+' click fail '+inf.txt+' '+e.message.split('\n')[0]);continue;}
    clicked++;pc++; await p.waitForTimeout(1100);
    const after=await snap(); if(after===before) nochange.push(u+' -> '+inf.txt);
    if(!p.url().startsWith(BASE+u.split('?')[0])) continue;
    // second level: newly visible controls
    const hs2=await p.$$(SEL);
    for(let j=0;j<hs2.length&&j<60;j++){
      const h2=(await p.$$(SEL))[j]; if(!h2) break; let i2; try{i2=await info(h2);}catch(e){continue;}
      const key=await h2.evaluate((e)=>e.outerHTML.slice(0,80)).catch(()=>null); if(!key) continue;
      if([...beforeSet].some(s=>s.endsWith(key))) continue;
      if(!i2.vis||i2.dis) continue;
      if(i2.navs){links.add(new URL(i2.href,BASE+u).href.split('#')[0]);nav++;continue;}
      const bf=await snap(); try{await act(h2,i2);second++;}catch(e){continue;}
      await p.waitForTimeout(250); const af=await snap(); if(af===bf) nochange.push(u+' -> '+inf.txt+' >> '+i2.txt);
      if(!p.url().startsWith(BASE+u.split('?')[0])) break;
    }
  }
  console.log(u,'controls',n,'clicked',pc);
}
// verify links
// Offsite: only the Follow Up Boss link (the agent's CRM) is allowed; it isn't fetched (no network).
const EXTERNAL_OK=['https://app.followupboss.com/'];
const bad=[]; for(const l of links){if(!l.startsWith(BASE)){if(!EXTERNAL_OK.includes(l))bad.push('offsite '+l);continue;}const r=await p.request.get(l);if(!r||r.status()>=400)bad.push(l+' '+(r&&r.status()));}
console.log(JSON.stringify({clicked,second,nav,skipped,links:[...links].map(l=>l.replace(BASE,'')),badLinks:bad,nochange,errs},null,1));
console.log('crawl: '+(bad.length||errs.length?'FAIL':'PASS')+' · '+clicked+' controls clicked, '+second+' second-level, '+links.size+' links checked, '+bad.length+' bad links, '+errs.length+' errors');
await b.close();})();
