import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abi } from 'genlayer-js';
import { CalldataAddress } from 'genlayer-js/types';
import type { CalldataEncodable, GenLayerTransaction } from 'genlayer-js/types';
import { createIntegration, normalizeWorkspace, normalizeId, normalizeReceipt } from '../../src/lib/integration';
import { boundedRead, TransportError, transportError } from '../../src/lib/errors';
import { retryAfterMs, safeRPCFetch, sanitizeTransaction } from '../../src/lib/rpc';
import { Transactions, TX_KEY } from '../../src/lib/transactions';
import { deployment } from '../../src/lib/genlayer';
import { PARTY_A, PARTY_B, demoWorkspace } from '../../src/lib/preview';
import { WalletFake, ports } from './helpers';
const txId='0x'+'a'.repeat(64);
const addressBytes=(address:string)=>Uint8Array.from(address.slice(2).match(/../g)!,s=>parseInt(s,16));
const encoded=(v:CalldataEncodable)=>[...abi.calldata.encode(v)].map(v=>v.toString(16).padStart(2,'0')).join('');
const execution=(v:CalldataEncodable)=>btoa(String.fromCharCode(0,...abi.calldata.encode(v)));
const workspaceWire={...demoWorkspace,id:1n,party_a:new CalldataAddress(addressBytes(PARTY_A)),party_b:new CalldataAddress(addressBytes(PARTY_B))};
let handler:(method:string,params:unknown[])=>unknown;
let rawFetch:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 handler=(method)=>{if(method==='eth_getTransactionCount')return '0x0';if(method==='eth_estimateGas')return '0x30d40';if(method==='eth_gasPrice')return '0x1';if(method==='gen_call')return encoded(workspaceWire);throw new Error('UNEXPECTED_OFFLINE_RPC');};
 rawFetch=vi.fn(async(_input:unknown,init?:RequestInit)=>{const request=JSON.parse(String(init?.body));return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:handler(request.method,request.params??[])}),{status:200});});
 vi.stubGlobal('fetch',safeRPCFetch(rawFetch as unknown as typeof fetch));
});
afterEach(()=>vi.unstubAllGlobals());
describe('offline real SDK adapter: no network requests',()=>{
 it('SDK aggregate finalized read decodes byte addresses, bigint IDs and exact codes',async()=>{const p=createIntegration();const w=await p.contract.get_workspace(1);expect(w).toEqual(demoWorkspace);expect(rawFetch).toHaveBeenCalledTimes(1);const request=JSON.parse(rawFetch.mock.calls[0][1].body);expect(request.method).toBe('gen_call');expect(request.params[0].transaction_hash_variant).toBe('latest-final');expect(request.params[0].from).toBe('0x'+'0'.repeat(40));});
 it('SDK aggregate history encodes address type and performs one read',async()=>{handler=()=>encoded([{id:1n,label:'Example',party_a:workspaceWire.party_a,party_b:workspaceWire.party_b,status:'RECONCILED'}]);const p=createIntegration();expect(await p.contract.get_workspace_summaries(PARTY_A)).toEqual([{id:1,label:'Example',party_a:PARTY_A,party_b:PARTY_B,status:'RECONCILED'}]);expect(rawFetch).toHaveBeenCalledTimes(1);});
 it('wallet-backed SDK write preserves actual provider tx ID, no lifecycle wait/resend inside write',async()=>{const provider=new WalletFake();const base=provider.request.getMockImplementation()!;provider.request.mockImplementation(async request=>request.method==='eth_sendTransaction'?txId:base(request));const p=createIntegration(provider);expect(await p.contract.create_workspace(PARTY_B,'Test',['Monthly invoices are required.'],PARTY_A)).toBe(txId);expect(provider.request.mock.calls.filter(([r])=>r.method==='eth_sendTransaction')).toHaveLength(1);expect(rawFetch.mock.calls.map(c=>JSON.parse(c[1].body).method)).not.toContain('eth_getTransactionByHash');});
 it('wallet chain/account checked before any write; no auto switch prompt',async()=>{const provider=new WalletFake(PARTY_A,1);const p=createIntegration(provider);await expect(p.contract.reconcile(1,PARTY_A)).rejects.toThrow('WRONG_NETWORK');expect(rawFetch).not.toHaveBeenCalled();expect(provider.request.mock.calls.map(([r])=>r.method)).not.toContain('wallet_switchEthereumChain');});
 it('official SDK waiter handles stored FINALIZED receipt and exact execution return ID',async()=>{
  handler=()=>({hash:txId,from:PARTY_A,to:deployment.address,nonce:'0x0',gas:'0x5208',gasPrice:'0x1',value:'0x0',input:'0x',type:'0x0',blockHash:null,blockNumber:null,transactionIndex:null,status:'FINALIZED',data:{},consensus_data:{leader_receipt:[{mode:'leader',result:execution(5n),execution_result:'SUCCESS',node_config:{address:PARTY_A,private_key:'SERVER_SECRET_PLACEHOLDER'}}],validators:[],votes:{}}});
  const p=createIntegration();expect(await p.lifecycle.waitForFinalization(txId)).toEqual({outcome:'SUCCESS',createdWorkspaceId:5});expect(rawFetch).toHaveBeenCalledTimes(1);
 });
 it('SDK 429 wrapper retains Retry-After through Viem, stops after one automatic read retry',async()=>{const rateLimit=vi.fn(async()=>new Response('limited',{status:429,headers:{'Retry-After':'10'}}));vi.stubGlobal('fetch',safeRPCFetch(rateLimit as typeof fetch));const p=createIntegration();const sleep=vi.fn().mockResolvedValue(undefined);await expect(boundedRead(()=>p.contract.get_workspace(1),sleep)).rejects.toThrow('RPC_RATE_LIMITED');expect(rateLimit).toHaveBeenCalledTimes(2);expect(sleep).toHaveBeenCalledExactlyOnceWith(10000);});
});
describe('serialization and sanitized receipts',()=>{
 it('Python JSON-safe addr# representation normalizes only at adapter boundary',()=>{expect(normalizeWorkspace({...demoWorkspace,party_a:PARTY_A.replace('0x','addr#'),party_b:PARTY_B.replace('0x','addr#')})).toEqual(demoWorkspace);});
 it('u64 ID is exact and malformed snapshot fails read',()=>{expect(normalizeId(18446744073709551615n)).toBe('18446744073709551615');expect(()=>normalizeWorkspace({...demoWorkspace,relation_matrix:[1,2,3,8]})).toThrow('READ_FAILED');});
 it('execution rollback maps stable Contract error rather than raw stack',()=>{const tx={statusName:'FINALIZED',consensus_data:{leader_receipt:[{mode:'leader',execution_result:'ERROR',result:btoa(String.fromCharCode(1)+'ALREADY_SEALED')}]}};expect(normalizeReceipt(tx as unknown as GenLayerTransaction)).toEqual({outcome:'FAILED',error:'ALREADY_SEALED'});});
 it('Retry-After accepts seconds and HTTP date',()=>{expect(retryAfterMs('10')).toBe(10000);expect(retryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT',0)).toBe(10000);expect(retryAfterMs('invalid')).toBe(0);});
 it('transaction projection discards server secrets/configuration',()=>{const tx=sanitizeTransaction({status:'FINALIZED',private_key:'SERVER_SECRET_PLACEHOLDER',consensus_data:{leader_receipt:[{mode:'leader',execution_result:'SUCCESS',result:execution(null),node_config:{address:PARTY_A,private_key:'SERVER_SECRET_PLACEHOLDER',api_key:'SERVER_API_PLACEHOLDER'},genvm_result:{private_key:'SERVER_SECRET_PLACEHOLDER'}}],validators:[],votes:{}}});expect(JSON.stringify(tx)).not.toMatch(/SERVER_SECRET|SERVER_API|private_key|genvm_result/);});
 it('RPC user error strips raw node_config before SDK diagnostics',async()=>{const base=vi.fn(async()=>new Response(JSON.stringify({error:{code:-32000,message:'SERVER_SECRET_PLACEHOLDER',data:{receipt:{result:btoa(String.fromCharCode(1)+'UNAUTHORIZED')},node_config:{private_key:'SERVER_SECRET_PLACEHOLDER'}}}})));const safe=safeRPCFetch(base as typeof fetch);await expect(safe(deployment.rpc,{body:JSON.stringify({method:'gen_call'})})).rejects.toThrow('UNAUTHORIZED');});
 it('nested Viem causes retain sanitized code and Retry-After',()=>{const e=new TransportError('RPC_RATE_LIMITED',1234);expect(transportError({message:'RPC_RATE_LIMITED',cause:{cause:e}})).toBe(e);});
});
describe('finalized create ID fallback and recovery',()=>{
 it('only after finalized receipt, one summaries operation, exact A/B/trimmed label, highest matching u64 ID',async()=>{const p=ports();vi.mocked(p.lifecycle.waitForDecision).mockResolvedValue({outcome:'SUCCESS'});vi.mocked(p.lifecycle.waitForFinalization).mockResolvedValue({outcome:'SUCCESS'});vi.mocked(p.contract.get_workspace_summaries).mockResolvedValue([{id:2,label:'Test',party_a:PARTY_A,party_b:PARTY_B,status:'WAITING_FOR_B'},{id:3,label:'Test',party_a:PARTY_A,party_b:PARTY_A,status:'WAITING_FOR_B'},{id:4,label:'Test',party_a:PARTY_A,party_b:PARTY_B,status:'WAITING_FOR_B'}]);vi.mocked(p.contract.get_workspace).mockResolvedValue({...demoWorkspace,id:4});const write=vi.fn().mockResolvedValue(txId);await p.transactions.submit('create_workspace',PARTY_A,write,undefined,{counterparty:PARTY_B,label:'Test'});expect(write).toHaveBeenCalledTimes(1);expect(p.contract.get_workspace_summaries).toHaveBeenCalledExactlyOnceWith(PARTY_A);expect(p.contract.get_workspace).toHaveBeenCalledExactlyOnceWith(4);expect(vi.mocked(p.contract.get_workspace_summaries).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(p.lifecycle.waitForFinalization).mock.invocationCallOrder[0]);});
 it('fallback criteria survive reload; original create is not called again',async()=>{const p=ports();vi.mocked(p.lifecycle.waitForDecision).mockResolvedValue({outcome:'SUCCESS'});vi.mocked(p.lifecycle.waitForFinalization).mockResolvedValue({outcome:'SUCCESS'});vi.mocked(p.contract.get_workspace_summaries).mockRejectedValue(new Error('STATUS_UNAVAILABLE'));const write=vi.fn().mockResolvedValue(txId);await p.transactions.submit('create_workspace',PARTY_A,write,undefined,{counterparty:PARTY_B,label:'Test'});expect(JSON.parse(localStorage.getItem(TX_KEY)!).create).toEqual({counterparty:PARTY_B,label:'Test'});vi.mocked(p.contract.get_workspace_summaries).mockResolvedValue([{id:1,label:'Test',party_a:PARTY_A,party_b:PARTY_B,status:'WAITING_FOR_B'}]);const recovered=new Transactions(p.contract,p.lifecycle,localStorage,async()=>{});await recovered.resume();expect(write).toHaveBeenCalledTimes(1);expect(recovered.getSnapshot().workspaceId).toBe(1);});
});
describe('bounded real transport timeout',()=>{
 it('per-request abort stops a stalled RPC; no background polling or write retry',async()=>{
  const base=vi.fn((_input:unknown,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
   init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  }));
  await expect(safeRPCFetch(base as typeof fetch,5)(deployment.rpc,{body:JSON.stringify({method:'gen_call'})})).rejects.toThrow('RPC_UNAVAILABLE');
  expect(base).toHaveBeenCalledTimes(1);
 });
});
