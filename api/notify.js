import { db, endpoint, requireAdmin } from '../lib/store.js';
export default endpoint(async (req,res)=>{
  requireAdmin(req);
  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  const record=await db('get',{id:req.body?.id});
  if(record.step!==4)return res.status(409).json({error:'Notification is available after the sign-in test.'});
  if(!process.env.RESEND_API_KEY||!process.env.ONBOARDING_EMAIL_FROM)return res.status(503).json({error:'Email delivery awaits a verified sender and email-provider key. Send the onboarding email manually and record its message reference.'});
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`onboarding-${record.id}`},body:JSON.stringify({from:process.env.ONBOARDING_EMAIL_FROM,to:[record.email],subject:'Your EntaiLink workspace is ready for activation',text:`Hello ${record.admin_name},\n\nYour organisation’s EntaiLink workspace has passed its access checks.\n\nWorkspace: https://${record.slug}.zapplink.com\n\nUse the identity-provider invitation to set up your sign-in. Our onboarding team will confirm activation.\n\nZappride Technologies`})});
  const result=await response.json();
  if(!response.ok||!result.id)return res.status(502).json({error:'Email delivery could not be accepted. Retry using the same request.'});
  const updated=await db('complete',{id:record.id,expectedStep:4,notes:'Onboarding email accepted by the email provider.',evidence:{notificationReference:result.id}});
  res.json({message:'Email accepted for delivery.',state:updated.state,step:updated.step});
});
