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
  const width = 1190.55, height = 841.89; // A3 landscape in points
  const grouped = ['CHAMPIONSHIP', 'CONSOLATION', 'PLACEMENT'];
  let pageNo = 0;
  for (const side of grouped) {
    const sideMatches = matches.filter(m => String(m.bracket_side) === side);
    if (!sideMatches.length) continue;
    const rounds = [...new Map(sideMatches.sort((a, b) => Number(a.display_order) - Number(b.display_order))
      .map(m => [String(m.round_code), String(m.round_code)])).keys()];
    for (let start = 0; start < rounds.length; start += 4) {
      const subset = rounds.slice(start, start + 4);
      const page = pdf.addPage([width, height]);
      pageNo++;
      page.drawRectangle({x:0,y:height-75,width,height:75,color:rgb(0.07,0.19,0.29)});
      page.drawText(shorten(tournament.tournament_name, 85), {x:28,y:height-31,size:19,font:bold,color:rgb(1,1,1)});
      page.drawText(`SEASON ${shorten(tournament.season_code || '5')}  |  ${archiveVersion}  |  ${side}`, {x:28,y:height-55,size:11,font:regular,color:rgb(0.84,0.92,1)});
      page.drawText(`NCAA V2  |  Entrants: ${entries.length}  |  ${pageNo}`, {x:width-245,y:height-55,size:10,font:regular,color:rgb(0.84,0.92,1)});
      const colW = (width-58-(subset.length-1)*12)/subset.length;
      for (let ci=0; ci<subset.length; ci++) {
        const code = subset[ci];
        const list = sideMatches.filter(m => String(m.round_code) === code)
          .sort((a,b)=>Number(a.display_order)-Number(b.display_order));
        const x = 28 + ci*(colW+12);
        page.drawText(shorten(code.replace(/_/g,' '), 32), {x,y:height-99,size:13,font:bold,color:rgb(0.12,0.25,0.39)});
        const cellH = Math.min(45, Math.floor((height-145)/Math.max(1,list.length)));
        if (cellH < 14) throw new Error(`Bracket round too large for page: ${code}`);
        for (let j=0; j<list.length; j++) {
          const m = list[j];
          const y = height-113-(j+1)*cellH;
          page.drawRectangle({x,y,width:colW,height:cellH-2,borderWidth:.6,borderColor:rgb(.67,.72,.78),color:rgb(.96,.975,.99)});
          const compact = cellH < 28;
          const fs = compact ? 6.8 : 8;
          const name1 = participantText(m,1,byGuid,bySeed);
          const name2 = participantText(m,2,byGuid,bySeed);
          const winner = String(m.winner_wrestler_guid || '');
          const participant1 = String(m.participant_1_wrestler_guid || '');
          const participant2 = String(m.participant_2_wrestler_guid || '');
          page.drawText(shorten(String(m.match_code),12), {x:x+4,y:y+cellH-11,size:6.8,font:bold,color:rgb(.22,.33,.43)});
          if (compact) {
            page.drawText(shorten(`${name1} / ${name2}`, Math.floor(colW/3.6)), {x:x+70,y:y+cellH-11,size:fs,font:regular,color:rgb(.12,.17,.23)});
          } else {
            page.drawText(shorten(name1,Math.floor(colW/5.5)), {x:x+8,y:y+cellH-23,size:fs,font:winner&&winner===participant1?bold:regular,color:rgb(.12,.17,.23)});
            page.drawText(shorten(name2,Math.floor(colW/5.5)), {x:x+8,y:y+cellH-33,size:fs,font:winner&&winner===participant2?bold:regular,color:rgb(.12,.17,.23)});
          }
        }
      }
      page.drawText('Frozen tournament record  |  Earlier archive versions are retained', {x:28,y:18,font:regular,size:9,color:rgb(.35,.41,.48)});
    }
  }
  if (!pageNo) throw new Error('No recognized bracket sides in NCAA V2 payload');
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
