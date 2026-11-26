let token='';
const message=document.querySelector('#operator-message');
const fields=[[],['tenantId','domainReference'],['oktaIssuer','oktaClientId','oktaAdminUserId'],['accessTestReference'],['notificationReference'],['activationReference']];
const labels={tenantId:'Tenant registry ID',domainReference:'Domain, DNS and HTTPS verification reference',oktaIssuer:'Okta issuer URL',oktaClientId:'Okta OIDC application client ID',oktaAdminUserId:'Workspace administrator’s Okta user ID',accessTestReference:'Successful sign-in and tenant-permission test reference',notificationReference:'Sent onboarding message reference',activationReference:'Customer portal tenant activation reference'};
const guidance=[
 'Verify the organisation, contact the administrator to confirm their identity and authority, and approve or reject the request.',
 'Create the tenant record in the customer portal, add the customer hostname to Vercel, configure DNS and verify HTTPS. Domain creation can use the automation button when server provisioning credentials are configured.',
 'Configure or reuse the Okta OIDC application. Add the exact customer callback and sign-out URLs, create or find the administrator, grant workspace-scoped administration and assign the application. Record IDs here. Send activation using Okta’s normal activation flow.',
 'Have the administrator sign in. Verify the workspace, administrator role and denial of access to another customer’s records.',
 'Send the welcome message to the verified administrator with the workspace URL and sign-in instructions. Record the sent-message ID. Use the automated email button when the email provider is configured.',
 'Enable the tenant in the customer portal and record its activation reference. Completing this task marks this onboarding request active.'
];
async function request(path,body){const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;}
function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
async function load(){const {requests,steps}=await request('/api/operator');const root=document.querySelector('#requests');root.replaceChildren();if(!requests.length)root.append(element('p','No registrations yet.'));
 for(const record of requests){const card=element('section',null,'card request');card.append(element('h2',record.organisation),element('p',`${record.slug}.zapplink.com · ${record.state.replaceAll('_',' ')}`),element('p',`${record.admin_name} · ${record.email} · ${record.role} · ${record.erp}`));
  if(record.step<6&&record.state!=='REJECTED'){card.append(element('h3',steps[record.step]),element('p',guidance[record.step]));const form=element('form');
   for(const field of fields[record.step]){const label=element('label',labels[field]);const input=element('input');input.name=field;input.required=true;input.maxLength=500;label.append(input);form.append(label);}
   const label=element('label','Completion evidence / review notes');const notes=element('textarea');notes.required=true;notes.minLength=3;notes.maxLength=2000;label.append(notes);form.append(label);
   const actions=element('div',null,'actions');const complete=element('button',record.step===0?'Approve request':record.step===5?'Mark workspace active':'Complete task','primary');actions.append(complete);
   if(record.step===0){const reject=element('button','Reject request');reject.type='button';reject.onclick=()=>submit('reject');actions.append(reject);}
   if(record.step===1||record.step===4){const auto=element('button',record.step===1?'Create domain entry':'Send onboarding email');auto.type='button';auto.onclick=async()=>{auto.disabled=true;try{const result=await request(record.step===1?'/api/provision':'/api/notify',{id:record.id});message.textContent=JSON.stringify(result,null,2);if(record.step===4)await load();}catch(error){message.textContent=error.message;}finally{auto.disabled=false;}};actions.append(auto);}
   form.append(actions);card.append(form);
   async function submit(decision){if(!form.reportValidity())return;complete.disabled=true;try{await request('/api/operator',{id:record.id,expectedStep:record.step,decision,notes:notes.value,evidence:Object.fromEntries(new FormData(form))});await load();message.textContent='Task recorded.';}catch(error){message.textContent=error.message;}finally{complete.disabled=false;}}
   form.onsubmit=event=>{event.preventDefault();submit('complete');};
  }
  const history=element('details');history.append(element('summary','Audit history'));for(const entry of record.history)history.append(element('p',`${entry.at} · ${entry.action} · ${entry.notes||'Registration submitted'}`));card.append(history);root.append(card);
 }
}
document.querySelector('#unlock').onsubmit=async event=>{event.preventDefault();token=document.querySelector('#operator-key').value;document.querySelector('#operator-key').value='';try{await load();message.textContent='Workdesk unlocked.';}catch(error){message.textContent=error.message;}};
