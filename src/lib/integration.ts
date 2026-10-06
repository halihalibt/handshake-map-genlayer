import { createClient, abi } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { CalldataAddress, TransactionStatus, TransactionHashVariant } from 'genlayer-js/types';
import type { CalldataEncodable, GenLayerTransaction, TransactionHash } from 'genlayer-js/types';
import type { Address, ContractPort, LifecyclePort, Receipt, Relation, Status, Workspace, WorkspaceId, WorkspaceSummary } from './contract';
import { derivePairs, deriveStatus, sameAddress, validWorkspaceId } from './contract';
import type { EIP1193 } from './wallet';
import { deployment } from './genlayer';
import { errorCode, TransportError, transportError } from './errors';
import { installRPCFetchBoundary, watchTransaction } from './rpc';
const contractAddress=deployment.address as Address;
const calldataAddress = (value:Address) => new CalldataAddress(Uint8Array.from(value.slice(2).match(/../g)!,pair=>parseInt(pair,16)));
function object(raw:unknown):Record<string,unknown> {if(raw instanceof Map)return Object.fromEntries(raw);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TransportError('READ_FAILED');return raw as Record<string,unknown>;}
function address(raw:unknown):Address {const s=raw instanceof CalldataAddress?raw.bytes:raw;let text:string;if(s instanceof Uint8Array)text=`0x${[...s].map(v=>v.toString(16).padStart(2,'0')).join('')}`;else text=String(s).replace(/^addr#/, '0x');if(!/^0x[0-9a-fA-F]{40}$/.test(text))throw new TransportError('READ_FAILED');return text as Address;}
export function normalizeId(raw:unknown):WorkspaceId {const text=String(raw);if(!validWorkspaceId(text))throw new TransportError('READ_FAILED');return BigInt(text)<=BigInt(Number.MAX_SAFE_INTEGER)?Number(text):text;}
function strings(raw:unknown):string[]{if(!Array.isArray(raw)||raw.some(v=>typeof v!=='string'))throw new TransportError('READ_FAILED');return raw;}
function status(raw:unknown):Status {if(raw!=='WAITING_FOR_B'&&raw!=='READY'&&raw!=='RECONCILED')throw new TransportError('READ_FAILED');return raw;}
export function normalizeWorkspace(raw:unknown):Workspace {
 const v=object(raw);if(typeof v.label!=='string'||typeof v.party_b_submitted!=='boolean'||typeof v.reconciled!=='boolean'||!Array.isArray(v.relation_matrix))throw new TransportError('READ_FAILED');
 const matrix=v.relation_matrix.map(c=>{const n=typeof c==='bigint'?Number(c):c;if(typeof n!=='number'||!Number.isInteger(n)||n<0||n>3)throw new TransportError('READ_FAILED');return n as Relation;});
 const w:Workspace={id:normalizeId(v.id),label:v.label,party_a:address(v.party_a),party_b:address(v.party_b),clauses_a:strings(v.clauses_a),clauses_b:strings(v.clauses_b),party_b_submitted:v.party_b_submitted,reconciled:v.reconciled,relation_matrix:matrix,derived_status:status(v.derived_status)};
 if(w.derived_status!==deriveStatus(w)||!w.reconciled&&w.relation_matrix.length!==0)throw new TransportError('READ_FAILED');derivePairs(w);return w;
}
export function normalizeSummaries(raw:unknown):WorkspaceSummary[]{if(!Array.isArray(raw))throw new TransportError('READ_FAILED');return raw.map(entry=>{const v=object(entry);if(typeof v.label!=='string')throw new TransportError('READ_FAILED');return {id:normalizeId(v.id),label:v.label,party_a:address(v.party_a),party_b:address(v.party_b),status:status(v.status)};});}
export function normalizeReceipt(raw:GenLayerTransaction):Receipt {
 const tx=raw as unknown as Record<string,unknown>;const name=String(tx.statusName??tx.status_name??tx.status);const cs=tx.consensus_data as {leader_receipt?:Record<string,unknown>[]}|undefined;
 const leader=cs?.leader_receipt?.find(r=>r.mode==='leader');
 if(['UNDETERMINED','LEADER_TIMEOUT','VALIDATORS_TIMEOUT'].includes(name))return {outcome:'UNDETERMINED'};
 if(['CANCELED','REJECTED'].includes(name))return {outcome:'REJECTED'};
 if(!leader)throw new TransportError('STATUS_UNAVAILABLE');
 let encoded=leader.result;if(encoded&&typeof encoded==='object')encoded=(encoded as {raw?:unknown}).raw;
 if(typeof encoded!=='string') {if(leader.execution_result==='SUCCESS')return {outcome:'SUCCESS'};throw new TransportError('STATUS_UNAVAILABLE');}
 try {
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(bytes[0]!==0)return {outcome:'FAILED',error:errorCode(new Error(new TextDecoder().decode(bytes.slice(1))),'EXECUTION_FAILED')};
  if(leader.execution_result!=='SUCCESS')return {outcome:'FAILED'};
  const returned=abi.calldata.decode(bytes.slice(1));
  return {outcome:'SUCCESS',...(typeof returned==='number'||typeof returned==='bigint'?{createdWorkspaceId:normalizeId(returned)}:{})};
 }catch(e){if(e instanceof TransportError)throw e;throw new TransportError('STATUS_UNAVAILABLE');}
}
export function createIntegration(provider?:EIP1193) {
 installRPCFetchBoundary();
 const readClient=createClient({chain:studionet});
 async function read(method:string,args:CalldataEncodable[]){try{return await readClient.readContract({address:contractAddress,functionName:method,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL,jsonSafeReturn:false});}catch(e){throw transportError(e,'READ_FAILED');}}
 async function write(method:string,args:CalldataEncodable[],sender:Address){
  if(!provider)throw new TransportError('WALLET_UNAVAILABLE');
  const chain=Number(await provider.request({method:'eth_chainId'}));if(chain!==deployment.chainId)throw new TransportError('WRONG_NETWORK');
  const accounts=await provider.request({method:'eth_accounts'}) as string[];if(!sameAddress(accounts[0],sender))throw new TransportError('UNAUTHORIZED');
  let submittedId:string|undefined;
  const guardedProvider={request:async(request:{method:string;params?:unknown[]})=>{
   if(request.method==='eth_sendTransaction'&&submittedId)return submittedId;
   try {const result=await provider.request(request);if(request.method==='eth_sendTransaction'&&typeof result==='string')submittedId=result;return result;}catch(e){throw transportError(e,'EXECUTION_FAILED');}
  }};
  const client=createClient({chain:studionet,account:sender,provider:guardedProvider});
  try {const id=await client.writeContract({address:contractAddress,functionName:method,args,value:0n,leaderOnly:false});if(typeof id!=='string'||!id)throw new TransportError('STATUS_UNAVAILABLE');return id;}catch(e){if(submittedId)return submittedId;throw transportError(e,'EXECUTION_FAILED');}
 }
 const contract:ContractPort={
  create_workspace:(counterparty,label,clauses,sender)=>write('create_workspace',[calldataAddress(counterparty),label,clauses],sender),
  respond_and_seal:(id,clauses,sender)=>write('respond_and_seal',[BigInt(id),clauses],sender),
  reconcile:(id,sender)=>write('reconcile',[BigInt(id)],sender),
  get_workspace:async id=>normalizeWorkspace(await read('get_workspace',[BigInt(id)])),
  get_workspace_summaries:async wallet=>normalizeSummaries(await read('get_workspace_summaries',[calldataAddress(wallet)])),
  get_relation:async(id,a,b)=>{const code=await read('get_relation',[BigInt(id),a,b]);const n=Number(code);if(!Number.isInteger(n)||n<0||n>3)throw new TransportError('READ_FAILED');return n as Relation;}
 };
 async function wait(id:string,stage:TransactionStatus,onConsensus?:()=>void):Promise<Receipt>{
  const unwatch=watchTransaction(id,status=>{if(['PROPOSING','COMMITTING','REVEALING','EXECUTING'].includes(status))onConsensus?.();});
  try {const args={hash:id as TransactionHash,status:stage,interval:15000,retries:20,fullTransaction:true};const tx=await readClient.waitForTransactionReceipt(args);return normalizeReceipt(tx);}catch(e){throw transportError(e,'STATUS_UNAVAILABLE');}finally{unwatch();}
 }
 const lifecycle:LifecyclePort={waitForDecision:(id,onConsensus)=>wait(id,TransactionStatus.ACCEPTED,onConsensus),waitForFinalization:id=>wait(id,TransactionStatus.FINALIZED)};
 return {contract,lifecycle,readClient};
}
