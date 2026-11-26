const form = document.querySelector('#register-form');
const trackForm = document.querySelector('#track-form');
const message = document.querySelector('#form-message');
let pending;
async function api(path, body) {
  const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json();
  if(!response.ok) throw new Error(result.error || 'Please retry.');
  return result;
}
function showTracking(){document.querySelector('#registration').classList.add('hidden');document.querySelector('#tracking').classList.remove('hidden');}
document.querySelector('#track-toggle').onclick=showTracking;
document.querySelector('#back').onclick=()=>{document.querySelector('#registration').classList.remove('hidden');document.querySelector('#tracking').classList.add('hidden');};
form.onsubmit=async event=>{
  event.preventDefault();
  const button=document.querySelector('#submit');button.disabled=true;message.textContent='Submitting your request…';message.className='';
  const values=Object.fromEntries(new FormData(form));values.consent=form.elements.consent.checked;
  // Retain request identity in memory when a network retry is needed.
  if(!pending) pending={id:crypto.randomUUID(),trackingKey:Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')};
  try{
    const result=await api('/api/registration',{...values,...pending});
    trackForm.elements.id.value=result.id;trackForm.elements.trackingKey.value=pending.trackingKey;
    showTracking();const panel=document.querySelector('#status');panel.replaceChildren();
    const text=document.createElement('p');text.className='success';text.textContent='Registration received. Your request is waiting for review.';panel.append(text);
    const ref=document.createElement('p');ref.className='reference';ref.textContent=`Save these details to track your request. Reference ${result.id}. Tracking key ${pending.trackingKey}.`;panel.append(ref);
    message.textContent='';pending=undefined;form.reset();
  }catch(error){message.className='error';message.textContent=error.message;}finally{button.disabled=false;}
};
trackForm.onsubmit=async event=>{
  event.preventDefault();const panel=document.querySelector('#status');panel.textContent='Checking status…';
  try{const result=await api('/api/status',Object.fromEntries(new FormData(trackForm)));panel.replaceChildren();
    const heading=document.createElement('p');heading.textContent=`${result.workspaceUrl} · ${result.state.replaceAll('_',' ')}`;panel.append(heading);
    result.steps.forEach((step,index)=>{const row=document.createElement('div');row.className='status-line '+(index<result.step?'done':index===result.step?'current':'');row.textContent=`${index<result.step?'Completed':index===result.step&&result.state!=='REJECTED'?'Current':'Pending'} — ${step}`;panel.append(row);});
  }catch(error){panel.textContent=error.message;}
};
