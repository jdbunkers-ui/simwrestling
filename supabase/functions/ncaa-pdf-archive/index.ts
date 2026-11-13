// Sim Wrestling NCAA V2: private, versioned tournament PDF archival worker.
// Deploy with JWT verification disabled ONLY because the request is protected by
// a separate high-entropy NCAA_ARCHIVE_WORKER_TOKEN secret (see README).
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Row = Record<string, unknown>;
const BUCKET = 'simwrestling-ncaa-brackets-v2';
const ascii = (value: unknown): string => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
const shorten = (value: unknown, max = 34) => {
  const s = ascii(value);
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
};
const isUuid = (v: unknown): v is string => typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
};
const safeEq = (a: string, b: string): boolean => {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
};

function participantText(match: Row, pos: 1 | 2, byGuid: Map<string, Row>, bySeed: Map<number, Row>) {
  const inputs = (match.inputs as Row[] || []);
  const input = inputs.find(x => Number(x.position) === pos) || {};
  const guid = match[`participant_${pos}_wrestler_guid`];
  const wrestler = isUuid(guid) ? byGuid.get(guid) :
    input.source_type === 'SEED' ? bySeed.get(Number(input.seed_number)) : undefined;
  if (wrestler) return `#${wrestler.seed_number ?? '?'} ${shorten(wrestler.wrestler_name, 26)}`;
  if (input.source_type === 'SEED') return `#${input.seed_number} BYE`;
  if (input.source_type === 'BYE') return 'BYE';
  if (input.source_type === 'WINNER' || input.source_type === 'LOSER')
    return `${input.source_type === 'WINNER' ? 'Winner' : 'Loser'} of ${shorten(input.source_match_code || 'pending', 20)}`;
  return 'To be determined';
}

// NCAA-inspired one-page print bracket. Only the drawing/layout changes; the
// payload contract, worker authorization and immutable archive upload stay intact.
type BracketNode = { match: Row; x: number; y: number; width: number; fs: number };

function fitText(value: unknown, font: any, size: number, maxWidth: number): string {
  let text = ascii(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  while (text.length && font.widthOfTextAtSize(`${text}...`, size) > maxWidth)
    text = text.slice(0, -1);
  return `${text}...`;
}

function sortedRound(matches: Row[], prefix: string): Row[] {
  // The original display_order, not alphabetic match codes, determines seed placement.
  return matches.filter(m => String(m.match_code || '').startsWith(prefix + '_'))
    .sort((a,b) => Number(a.display_order) - Number(b.display_order));
}

function sourceFor(match: Row, position: number): {type: string; code: string} {
  const input = ((match.inputs as Row[]) || []).find(x => Number(x.position) === position);
  return {
    type: String(input?.source_type || ''),
    code: String(input?.source_match_code || ''),
  };
}

async function generatePdf(payload: Row, archiveVersion: string): Promise<Uint8Array> {
  const tournament = (payload.tournament || {}) as Row;
  const entries = (payload.entries || []) as Row[];
  const matches = (payload.matches || []) as Row[];
  if (!matches.length || !entries.length || payload.version !== 'NCAA_V2')
    throw new Error('NCAA V2 payload missing bracket matches or tournament entries');
  const byGuid = new Map(entries.filter(x => isUuid(x.wrestler_guid))
    .map(x => [String(x.wrestler_guid), x]));
  const bySeed = new Map(entries.map(x => [Number(x.seed_number), x]));
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${ascii(tournament.tournament_name)} - ${archiveVersion} - NCAA V2`);
  pdf.setProducer('Sim Wrestling NCAA V2 permanent archive');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // A3 portrait. One division/weight per page, championship above wrestlebacks.
  const width = 841.89, height = 1190.55;
  const page = pdf.addPage([width,height]);
  const ink = rgb(.12,.16,.20), muted = rgb(.40,.44,.47);
  const lineColor = rgb(.29,.33,.36), accent = rgb(.07,.21,.34);
  const draw = (text: string, x: number, y: number, size = 7, strong = false, max = 160) =>
    page.drawText(fitText(text,strong ? bold : regular,size,max),
      {x,y,size,font:strong ? bold : regular,color:ink});
  const line = (x1: number,y1: number,x2: number,y2: number,thickness=.65) =>
    page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness,color:lineColor});

  page.drawRectangle({x:0,y:height-63,width,height:63,color:accent});
  page.drawText(fitText(tournament.tournament_name || 'NCAA Tournament',bold,17,width-52),
    {x:25,y:height-29,size:17,font:bold,color:rgb(1,1,1)});
  page.drawText(fitText(`SEASON ${tournament.season_code || '5'}  |  ${archiveVersion}  |  NCAA V2`,regular,9,630),
    {x:26,y:height-47,size:9,font:regular,color:rgb(.85,.92,.98)});
  page.drawText(`ENTRANTS: ${entries.length}`,{x:width-123,y:height-47,size:8,font:bold,color:rgb(.85,.92,.98)});

  const nodes = new Map<string,BracketNode>();
  const matchByCode = new Map(matches.map(m=>[String(m.match_code),m]));
  const participant = (m:Row,p:1|2):string => participantText(m,p,byGuid,bySeed);
  const renderNode = (node:BracketNode) => {
    const {match:m,x,y,width:w,fs} = node;
    const upper = y+7,lower=y-7;
    // NCAA-style thin horizontal competitor lines and a joining match stem.
    line(x,upper,x+w,upper); line(x,lower,x+w,lower);
    line(x+w,lower,x+w,upper);
    const winner = String(m.winner_wrestler_guid || '');
    const p1 = String(m.participant_1_wrestler_guid || '');
    const p2 = String(m.participant_2_wrestler_guid || '');
    draw(participant(m,1),x+2,upper+2,fs,Boolean(winner && winner===p1),w-7);
    draw(participant(m,2),x+2,lower+2,fs,Boolean(winner && winner===p2),w-7);
    draw(String(m.match_code || ''),x+w-33,lower-9,5.1,false,35);
    // Result text appears when present in the payload; no score is fabricated.
    const result = m.result_text ?? m.result_summary ?? m.score_text ?? m.result_display;
    if (result) draw(String(result),x+2,lower-9,5.1,false,w-40);
  };
  const connect = (m:Row,p:1|2,dest:BracketNode) => {
    const source = sourceFor(m,p);
    if (source.type !== 'WINNER') return; // Drops to consolation are labeled on their lines.
    const from = nodes.get(source.code);
    if (!from || from.x >= dest.x) return;
    const yTo = dest.y+(p===1 ? 7 : -7);
    // Out of predecessor's middle, elbow, then into next competitor's line.
    const startX=from.x+from.width, bendX=Math.min(dest.x-5,startX+9);
    line(startX,from.y,bendX,from.y,.55);
    line(bendX,from.y,bendX,yTo,.55);
    line(bendX,yTo,dest.x,yTo,.55);
  };
  const placeRound = (rows:Row[],x:number,w:number,base:number,step:number,fs:number) => {
    rows.forEach((m,i)=>nodes.set(String(m.match_code),{match:m,x,y:base-i*step,width:w,fs}));
  };
  const placeFromSources = (rows:Row[],x:number,w:number,fallbackBase:number,fallbackStep:number,fs:number) => {
    rows.forEach((m,i)=>{
      const sources=[sourceFor(m,1),sourceFor(m,2)]
        .filter(src=>src.type==='WINNER' && nodes.has(src.code))
        .map(src=>nodes.get(src.code)!.y);
      const y = sources.length === 2 ? (sources[0]+sources[1])/2 :
        sources.length === 1 ? sources[0] : fallbackBase-i*fallbackStep;
      nodes.set(String(m.match_code),{match:m,x,y,width:w,fs});
    });
  };
  const championship = matches.filter(m=>String(m.bracket_side)==='CHAMPIONSHIP');
  const chSpecs = [
    {prefix:'R32',label:'ROUND OF 32',x:24,w:127},
    {prefix:'R16',label:'ROUND OF 16',x:192,w:125},
    {prefix:'QF',label:'QUARTERFINALS',x:355,w:125},
    {prefix:'SF',label:'SEMIFINALS',x:518,w:125},
  ];
  const champTop = 1076, champStep = 34.4;
  chSpecs.forEach((spec,i)=>{
    const rows=sortedRound(championship,spec.prefix);
    if (i===0) placeRound(rows,spec.x,spec.w,champTop,champStep,6.7);
    else placeFromSources(rows,spec.x,spec.w,champTop,champStep*Math.pow(2,i),6.7);
    draw(spec.label,spec.x,1096,8.0,true,spec.w+25);
  });
  const finals=championship.filter(m=>String(m.round_code)==='FINAL' || String(m.match_code)==='FINAL');
  placeFromSources(finals,683,128,798,0,7.2);
  draw('CHAMPIONSHIP FINAL',683,1096,8,true,150);
  // Connect source winners before painting nodes, so lines never cover names.
  for (const m of championship) {
    const node=nodes.get(String(m.match_code)); if (!node) continue;
    connect(m,1,node);connect(m,2,node);
  }
  for (const m of championship) {const node=nodes.get(String(m.match_code));if(node)renderNode(node);}
  if (finals.length) draw('CHAMPION',687,(nodes.get(String(finals[0].match_code))?.y || 798)-27,9,true,112);

  line(24,511,width-24,511,1.2);
  draw('WRESTLEBACKS / CONSOLATION',25,489,12,true,400);
  const consolation = matches.filter(m=>String(m.bracket_side)==='CONSOLATION');
  const consSpecs = [
    {prefix:'C1',label:'CONS R1',x:25,w:91},
    {prefix:'C2',label:'CONS R2',x:148,w:91},
    {prefix:'C3',label:'CONS R3',x:270,w:91},
    {prefix:'C4',label:'CONS R4',x:392,w:91},
    {prefix:'C5',label:'CONS QF',x:514,w:91},
    {prefix:'C6',label:'CONS SF',x:636,w:91},
  ];
  const consBase=449,consStep=38.8;
  consSpecs.forEach((spec,i)=>{
    const rows=sortedRound(consolation,spec.prefix);
    // Preserve bracket-order sequencing for all consolation rounds: loser drop-ins
    // make a pure binary-tree midpoint calculation incorrect in these rounds.
    const step = (rows.length>=8 ? consStep : rows.length>=4 ? consStep*2 : consStep*4);
    const start = rows.length>=8 ? consBase : rows.length>=4 ? consBase-consStep/2 : consBase-consStep*1.5;
    placeRound(rows,spec.x,spec.w,start,step,5.9);
    draw(spec.label,spec.x,467,7.2,true,spec.w+13);
  });
  const placements=matches.filter(m=>String(m.bracket_side)==='PLACEMENT')
    .sort((a,b)=>Number(a.display_order)-Number(b.display_order));
  const placeY=[419,312,205];
  placements.forEach((m,i)=>nodes.set(String(m.match_code),
    {match:m,x:745,y:placeY[i] || 105-i*33,width:72,fs:5.5}));
  draw('PLACEMENT',745,467,7.2,true,88);
  for (const m of [...consolation,...placements]) {
    const node=nodes.get(String(m.match_code));if(node){connect(m,1,node);connect(m,2,node);}
  }
  for (const m of [...consolation,...placements]) {
    const node=nodes.get(String(m.match_code));if(node)renderNode(node);
  }
  placements.forEach((m,i)=>{
    const label=String(m.match_code).startsWith('P3')?'THIRD PLACE':
      String(m.match_code).startsWith('P5')?'FIFTH PLACE':
      String(m.match_code).startsWith('P7')?'SEVENTH PLACE':`PLACE ${i+1}`;
    draw(label,745,(nodes.get(String(m.match_code))?.y || placeY[i])-28,6.4,true,91);
  });
  // Keep original archive semantics: this is a new rendering for future jobs;
  // never regenerate an existing READY object at the same immutable path.
  line(24,48,width-24,48,.65);
  page.drawText('Sim Wrestling | NCAA V2 | Frozen tournament record | Earlier archive versions retained',
    {x:25,y:30,size:8,font:regular,color:muted});
  return await pdf.save();
}

const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
  .map(b=>b.toString(16).padStart(2,'0')).join('');

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', {status:405});
  try {
    const token = env('NCAA_ARCHIVE_WORKER_TOKEN');
    const provided = request.headers.get('x-worker-token') || '';
    if (!safeEq(provided, token)) return new Response('Unauthorized', {status:401});
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:job,error:claimError} = await db.rpc('claim_ncaa_pdf_archive_v2');
    if (claimError) throw claimError;
    if (!job || job.status === 'IDLE') return Response.json({status:'IDLE'});
    const guid = String(job.archive_guid || '');
    try {
      if (!isUuid(guid) || !isUuid(job.tournament_guid) || job.bucket_id !== BUCKET ||
          job.archive_version !== 'PRELIMINARY') throw new Error('Invalid archive job');
      const path = String(job.storage_path);
      if (path !== `season-${path.split('/')[0].replace('season-','')}/${job.tournament_guid}/PRELIMINARY.pdf` ||
          !/^season-[5-9][0-9]*\/[0-9a-f-]{36}\/PRELIMINARY\.pdf$/i.test(path))
        throw new Error('Unexpected storage path');
      const {data:payload,error:payloadError} = await db.rpc('get_ncaa_tournament_payload_v2',
        {p_tournament_guid:job.tournament_guid});
      if (payloadError || !payload) throw payloadError || new Error('Tournament payload missing');
      const bytes = await generatePdf(payload as Row,String(job.archive_version));
      const digest = await sha256(bytes);
      // No overwrite permitted. If a prior upload succeeded before a crash,
      // verify the existing bytes rather than replacing the archived object.
      const {error:uploadError} = await db.storage.from(BUCKET).upload(path,bytes,
        {contentType:'application/pdf',upsert:false,cacheControl:'31536000'});
      if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
      const {data:download,error:downloadError} = await db.storage.from(BUCKET).download(path);
      if (downloadError || !download) throw downloadError || new Error('Uploaded PDF cannot be read back');
      const stored = new Uint8Array(await download.arrayBuffer());
      if (stored.length !== bytes.length || await sha256(stored) !== digest)
        throw new Error('Stored PDF checksum or byte length mismatch');
      const {error:completeError} = await db.rpc('complete_ncaa_pdf_archive_v2',
        {p_archive_guid:guid,p_success:true,p_file_size_bytes:stored.length,p_sha256_hex:digest});
      if (completeError) throw completeError;
      return Response.json({status:'READY',archive_guid:guid,tournament_guid:job.tournament_guid,
        archive_version:job.archive_version,file_size_bytes:stored.length,sha256_hex:digest});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isUuid(guid)) {
        const {error:reportError} = await db.rpc('complete_ncaa_pdf_archive_v2',
          {p_archive_guid:guid,p_success:false,p_error:message});
        if (reportError) console.error('Failed to record worker error',reportError);
      }
      return Response.json({status:'FAILED',archive_guid:guid,error:message},{status:500});
    }
  } catch (error) {
    console.error('Archive worker startup/claim failure',error);
    return Response.json({status:'ERROR',error:'Worker failed to start or claim job'},{status:500});
  }
});
