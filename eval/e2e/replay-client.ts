import { basename } from 'node:path';

export async function replayRecording(audio:Blob, file:string, language:string, model:string, secret:string, url:URL) {
  const body=new FormData();
  body.append('audio',audio,basename(file));
  body.append('model',model);
  if (language!=='auto') body.append('language',language);
  const response=await fetch(url,{method:'POST',body,headers:{'x-saathi-secret':secret},signal:AbortSignal.timeout(65000)});
  const result=await response.json();
  if (!response.ok) throw Error(result.error || 'HTTP '+response.status);
  if (result.model!==model || typeof result.text!=='string' || !Number.isFinite(result.ms) || result.ms<0) {
    throw Error('Invalid transcription response');
  }
  return result as {model:string;text:string;ms:number};
}
