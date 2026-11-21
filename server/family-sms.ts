export type SmsStatus = 'pending' | 'dry-run' | 'accepted' | 'delivered' | 'failed';
export interface SmsRecord { sentAt: string; status: SmsStatus }
export interface SmsProvider {
  send(phone: string, caseId: string): Promise<Exclude<SmsStatus, 'pending'>>;
}

export const familyMessage = (id: string) => `మీ కుటుంబ సభ్యుని కేసు ${id} నమోదైంది. సాథి మనిషి మీకు కాల్ చేస్తారు.`;

export function familyProvider(): SmsProvider {
  const key = process.env.MSG91_AUTH_KEY, template = process.env.MSG91_TEMPLATE_ID;
  if (!key || !template) return { send: async () => 'dry-run' };
  return { async send(phone, caseId) {
    // Only the registered template and its case_id substitution leave this service.
    if (!/^GS-[A-Z0-9]{1,16}$/i.test(caseId) || !/^\+?[1-9]\d{7,14}$/.test(phone)) return 'failed';
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST', headers: { authkey: key, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ template_id: template, recipients: [{ mobiles: phone.replace(/^\+/, ''), case_id: caseId }] }),
    });
    if (!response.ok) return 'failed';
    const result = await response.json();
    return result.type === 'success' ? 'accepted' : 'failed';
  }};
}
