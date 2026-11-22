export type SmsStatus = 'pending' | 'dry-run' | 'accepted' | 'delivered' | 'failed';
export interface SmsRecord { sentAt: string; status: SmsStatus; providerId?: string; deliveryCheck?: { by: string; at: string } }
export interface SmsProvider {
  send(phone: string, caseId: string, recordProviderId?: (id: string) => void): Promise<Exclude<SmsStatus, 'pending'>>;
}

export const familyMessage = (id: string) => `మీ కుటుంబ సభ్యుని కేసు ${id} నమోదైంది. సాథి మనిషి మీకు కాల్ చేస్తారు.`;

export function familyProvider(): SmsProvider {
  const key = process.env.MSG91_AUTH_KEY, template = process.env.MSG91_TEMPLATE_ID;
  if (!key || !template) return { send: async () => 'dry-run' };
  return { async send(phone, caseId, recordProviderId) {
    // Only the registered template and its case_id substitution leave this service.
    if (!/^GS-[A-Z0-9]{1,16}$/i.test(caseId) || !/^\+?[1-9]\d{7,14}$/.test(phone)) return 'failed';
    return sendTemplate(phone, key, template, {case_id:caseId}, recordProviderId);
  }};
}


async function sendTemplate(phone:string,key:string,template:string,fields:Record<string,string>, recordProviderId?: (id: string) => void):Promise<'accepted'|'failed'> {
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST', headers: { authkey: key, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ template_id: template, recipients: [{ mobiles: phone.replace(/^\+/, ''), ...fields }] }),
    });
    if (!response.ok) return 'failed';
    const result = await response.json();
    if (result.type !== 'success') return 'failed';
    const id = result.request_id ?? result.message;
    if (typeof id === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(id)) recordProviderId?.(id);
    return 'accepted';
}
export async function placeSms(phone:string,name:string,link:string) {
  const key=process.env.MSG91_AUTH_KEY,template=process.env.MSG91_PLACE_TEMPLATE_ID;
  if(!key||!template)return 'dry-run';
  if(!/^\+?[1-9]\d{7,14}$/.test(phone))return 'failed';
  try { return await sendTemplate(phone,key,template,{place_name:name,maps_link:link}); }
  catch { return 'failed'; }
}
