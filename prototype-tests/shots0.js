const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for (const [vw,tag] of [[{width:1240,height:900},'d'],[{width:390,height:844},'p']]){
const c=await b.newContext({viewport:vw, deviceScaleFactor:1});const p=await c.newPage();
for(const u of ['index','tasks','workflows','rules','apps','sent','practice','onboarding']){await p.goto('http://localhost:8765/'+u+'.html');await p.waitForTimeout(400);await p.screenshot({path:'site2/_shots/0-'+u+'-'+tag+'.png',fullPage:true});}
await c.close();}
await b.close();})();
