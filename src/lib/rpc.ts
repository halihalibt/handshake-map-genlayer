import { errorCode, TransportError } from './errors';
import { deployment } from './genlayer';
// The stable SDK owns network calls. This narrowly scoped fetch boundary preserves
// Retry-After and strips raw server errors before SDK diagnostics can log them.
const observers = new Map<string, (status:string)=>void>();
export function watchTransaction(id:string, observer:(status:string)=>void) {
 observers.set(id,observer); return ()=>{observers.delete(id);};
}
export function retryAfterMs(value:string|null, now=Date.now()):number {
 if(!value)return 0;const seconds=Number(value);
 if(Number.isFinite(seconds))return Math.max(0,seconds*1000);
 const date=Date.parse(value);return Number.isNaN(date)?0:Math.max(0,date-now);
}
function semanticError(error:unknown):string {
 const direct=errorCode(error,'RPC_UNAVAILABLE');if(direct!=='RPC_UNAVAILABLE')return direct;
 const e=error as {data?:{receipt?:{result?:unknown}}};const result=e?.data?.receipt?.result;
 if(typeof result==='string')try {const bytes=Uint8Array.from(atob(result),c=>c.charCodeAt(0));if(bytes[0]===1||bytes[0]===2)return errorCode(new Error(new TextDecoder().decode(bytes.slice(1))),'EXECUTION_FAILED');}catch { /* Unknown output never enters diagnostics. */ }
 return 'RPC_UNAVAILABLE';
}
// Allowlisted transaction receipt projection: node settings and server credentials
// cannot enter SDK logs, application state, evidence or result UI.
function safeReceipt(receipt:Record<string,unknown>) {
 const fields=['mode','vote','result','execution_result','contract_state_hash'];
 const clean=Object.fromEntries(fields.filter(f=>f in receipt).map(f=>[f,receipt[f]]));
 const node=receipt.node_config as {address?:unknown}|undefined;
 if(typeof node?.address==='string')clean.node_config={address:node.address};
 return clean;
}
export function sanitizeTransaction(value:unknown):unknown {
 if(!value||typeof value!=='object')return value;
 const v=value as Record<string,unknown>;
 const fields=['hash','from','to','from_address','to_address','status','result','result_name','leader_only','execution_mode','num_of_initial_validators','num_of_rounds','rotation_count','last_round','nonce','value','input','data','blockHash','blockNumber','transactionIndex','gas','gasPrice','type','chainId'];
 const out=Object.fromEntries(fields.filter(f=>f in v).map(f=>[f,v[f]]));
 const c=v.consensus_data as Record<string,unknown>|undefined;
 if(c)out.consensus_data={votes:c.votes,leader_receipt:Array.isArray(c.leader_receipt)?c.leader_receipt.map(r=>safeReceipt(r)):[],validators:Array.isArray(c.validators)?c.validators.map(r=>safeReceipt(r)):[]};
 return out;
}
export function safeRPCFetch(base:typeof fetch, timeoutMs=30000):typeof fetch {
 return async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url!==deployment.rpc)return base(input,init);
  const controller=new AbortController();
  const callerSignal=init?.signal;
  const abort=()=>controller.abort();
  if(callerSignal?.aborted)abort();else callerSignal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,timeoutMs);
  try {
  let response:Response;
  try {response=await base(input,{...init,signal:controller.signal});}catch {throw new TransportError('RPC_UNAVAILABLE');}
  if(response.status===429)throw new TransportError('RPC_RATE_LIMITED',retryAfterMs(response.headers.get('Retry-After')));
  if(!response.ok)throw new TransportError('RPC_UNAVAILABLE',retryAfterMs(response.headers.get('Retry-After')));
  let body:{error?:unknown;result?:unknown};
  try {body=await response.json();}catch {throw new TransportError('RPC_UNAVAILABLE');}
  if(body.error)throw new TransportError(semanticError(body.error));
  let request:{method?:string;params?:unknown[]};
  try {request=JSON.parse(String(init?.body));}catch {throw new TransportError('RPC_UNAVAILABLE');}
  if(request.method==='eth_getTransactionByHash') {
   const tx=body.result as {status?:string}|undefined;
   if(typeof request.params?.[0]==='string'&&typeof tx?.status==='string')observers.get(request.params[0])?.(tx.status);
   body.result=sanitizeTransaction(body.result);
  }
  return new Response(JSON.stringify(body),{status:response.status,headers:{'Content-Type':'application/json'}});
  } finally {clearTimeout(timeout);callerSignal?.removeEventListener('abort',abort);}
 };
}
let installed=false;
export function installRPCFetchBoundary(){if(!installed){globalThis.fetch=safeRPCFetch(globalThis.fetch.bind(globalThis));installed=true;}}
