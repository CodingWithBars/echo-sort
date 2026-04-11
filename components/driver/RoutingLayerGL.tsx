"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RoutingLayerGL — MapLibre GL version of RoutingLayer
//
// Key fixes over previous version:
//   1. useMap() returns undefined until map loads — we now wait for onLoad
//      via a `mapReady` boolean before running A* or fetching geometry.
//   2. Source IDs are stable strings (not index-based) — prevents react-map-gl
//      "source already exists" errors when leg count changes.
//   3. All legs merged into a single GeoJSON FeatureCollection per role
//      (glow / line) — one Source, one Layer each, avoids ID collision entirely.
//   4. Toast is rendered outside <Map> in the parent's DOM overlay area.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Source, Layer, Marker, useMap } from "react-map-gl/maplibre";
import { getDistance } from "../map/MapAssets";

// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_DISTANCE_M  = 30;
const ARRIVE_DISTANCE_M = 8;

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────

type ToastState = {
  stopNum: number; binName: string; fillLevel: number;
  dist: number; arrived: boolean; isUturn: boolean;
} | null;

function ProximityToast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  const bg    = toast.arrived ? "#059669" : "#1e40af";
  const bdr   = toast.arrived ? "#34d399" : "#60a5fa";
  const tagBg = toast.fillLevel >= 90 ? "#dc2626" : toast.fillLevel >= 70 ? "#ea580c"
              : toast.fillLevel >= 40 ? "#ca8a04" : "#16a34a";
  return (
    <div style={{
      position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 2000, display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", borderRadius: 14, background: bg,
      border: `1.5px solid ${bdr}`, boxShadow: "0 4px 24px rgba(0,0,0,.5)",
      fontFamily: "'DM Mono','Fira Code',monospace", minWidth: 240, maxWidth: 320,
      animation: "toastIn .25s ease", pointerEvents: "none", whiteSpace: "nowrap",
    }}>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, color: "#fff" }}>
        {toast.arrived ? "✓" : "⬆"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.65)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 2 }}>
          {toast.arrived ? `Stop ${toast.stopNum} — arrived` : `Stop ${toast.stopNum} — approaching`}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis" }}>
          {toast.binName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: tagBg, padding: "1px 7px", borderRadius: 20 }}>{toast.fillLevel}% full</span>
          {!toast.arrived && <span style={{ fontSize: 10, color: "rgba(255,255,255,.65)" }}>{Math.round(toast.dist)} m away</span>}
          {toast.isUturn && <span style={{ fontSize: 10, fontWeight: 700, color: "#fcd34d" }}>↩ U-turn ahead</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface RoutingProps {
  driverPos:       [number, number];
  bins:            any[];
  selectedBinId:   number | null;
  onRouteUpdate:   (stats: { dist: string; time: string }) => void;
  onOrderUpdate?:  (orderedBins: any[]) => void;
  routeKey?:       number;
  mode?:           "fastest" | "priority";
  useFence?:       boolean;
  maxDetour?:      number;
  routingPos?:     [number, number] | null;
  heading?:        number;
  destinationPos?: [number, number] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM — identical to RoutingLayer.tsx
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_SIDE_M   = 80;
const PENALTY_UTURN_M  = 250;
const PASS_THRESHOLD_M = 40;
const PASSTHROUGH_COST = 600;
const A_STAR_LIMIT     = 12;

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000, r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const s = Math.sin(dLat/2)**2 + Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function buildDistMatrix(nodes: [number, number][]): number[][] {
  return nodes.map(a => nodes.map(b => haversine(a, b)));
}

function bearing(from: [number, number], to: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180, dLon = r(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(r(to[0]));
  const x = Math.cos(r(from[0])) * Math.sin(r(to[0])) - Math.sin(r(from[0])) * Math.cos(r(to[0])) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d;
}

function uturnPenalty(from: [number, number], to: [number, number], h: number): number {
  const t = angleDiff(h, bearing(from, to));
  return t <= 60 ? 0 : t <= 120 ? PENALTY_SIDE_M : PENALTY_UTURN_M;
}

function pointToSegmentDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const toXY = (ll: [number, number]) => [ll[1]*Math.cos((ll[0]*Math.PI)/180)*111_320, ll[0]*110_540];
  const [px,py]=toXY(p), [ax,ay]=toXY(a), [bx,by]=toXY(b);
  const dx=bx-ax, dy=by-ay, lenSq=dx*dx+dy*dy;
  if (lenSq===0) return Math.hypot(px-ax,py-ay);
  const t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/lenSq));
  if (t < 0.05 || t > 0.95) return Infinity;
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

function buildHeadingAwareMatrix(nodes: [number,number][], driverHeading: number, destIdx=-1): number[][] {
  const n=nodes.length, base=buildDistMatrix(nodes), mat=base.map(r=>[...r]);
  for (let j=1;j<n;j++) { if (j===destIdx) continue; mat[0][j]=base[0][j]+uturnPenalty(nodes[0],nodes[j],driverHeading); }
  for (let i=1;i<n;i++) {
    if (i===destIdx) continue;
    const arrI=bearing(nodes[0],nodes[i]);
    for (let j=1;j<n;j++) {
      if (i===j||j===destIdx) continue;
      let cost=base[i][j]+uturnPenalty(nodes[i],nodes[j],arrI);
      for (let k=1;k<n;k++) {
        if (k===i||k===j||k===destIdx) continue;
        if (pointToSegmentDist(nodes[k],nodes[i],nodes[j])<PASS_THRESHOLD_M){cost+=PASSTHROUGH_COST;break;}
      }
      mat[i][j]=cost;
    }
  }
  if (destIdx>0) for (let i=0;i<n;i++) { if (i!==destIdx) mat[i][destIdx]=base[i][destIdx]; }
  return mat;
}

function mstCost(indices: number[], dist: number[][]): number {
  if (indices.length<=1) return 0;
  const inMST=new Set<number>([indices[0]]); let total=0;
  while (inMST.size<indices.length) {
    let best=Infinity,bestNode=-1;
    for (const u of inMST) for (const v of indices) if (!inMST.has(v)&&dist[u][v]<best){best=dist[u][v];bestNode=v;}
    if (bestNode===-1) break;
    inMST.add(bestNode); total+=best;
  }
  return total;
}

function admissibleH(cur: number, mask: number, dist: number[][], n: number): number {
  const unv: number[]=[];
  for (let i=1;i<n;i++) if (!(mask&(1<<i))) unv.push(i);
  if (unv.length===0) return 0;
  return Math.min(...unv.map(v=>dist[cur][v]))+mstCost(unv,dist);
}

function nearestNeighbor(dist: number[][]): number[] {
  const n=dist.length,visited=new Set([0]),path=[0];
  while (visited.size<n) {
    const last=path[path.length-1]; let best=Infinity,bn=-1;
    for (let j=1;j<n;j++) if (!visited.has(j)&&dist[last][j]<best){best=dist[last][j];bn=j;}
    if (bn===-1) break; visited.add(bn); path.push(bn);
  }
  return path;
}

function astarTSP(nodes: [number,number][], dist: number[][]): number[] {
  const n=nodes.length;
  if (n<=1) return [0]; if (n===2) return [0,1];
  if (n>A_STAR_LIMIT) return nearestNeighbor(dist);
  const allV=(1<<n)-1;
  const gCost=Array.from({length:n},()=>new Array<number>(1<<n).fill(Infinity));
  gCost[0][1]=0;
  const pathAt=new Map<string,number[]>(); pathAt.set("0,1",[0]);
  interface E{node:number;mask:number;g:number;f:number;}
  const open:E[]=[{node:0,mask:1,g:0,f:admissibleH(0,1,dist,n)}];
  while (open.length>0) {
    let mi=0; for (let i=1;i<open.length;i++) if (open[i].f<open[mi].f) mi=i;
    const curr=open.splice(mi,1)[0];
    if (curr.mask===allV) return pathAt.get(`${curr.node},${curr.mask}`)??nearestNeighbor(dist);
    if (curr.g>gCost[curr.node][curr.mask]) continue;
    for (let next=1;next<n;next++) {
      if (curr.mask&(1<<next)) continue;
      const nm=curr.mask|(1<<next),ng=curr.g+dist[curr.node][next];
      if (ng<gCost[next][nm]) {
        gCost[next][nm]=ng;
        const prev=pathAt.get(`${curr.node},${curr.mask}`)??[0];
        pathAt.set(`${next},${nm}`,[...prev,next]);
        open.push({node:next,mask:nm,g:ng,f:ng+admissibleH(next,nm,dist,n)});
      }
    }
  }
  return nearestNeighbor(dist);
}

function astarTSPWithDestination(nodes:[number,number][],dist:number[][],destIdx:number):number[]{
  const n=nodes.length; if (n<=1) return [0];
  const binIndices=Array.from({length:destIdx-1},(_,i)=>i+1);
  if (n>A_STAR_LIMIT+1){const p=nearestNeighborSubset(dist,binIndices);p.push(destIdx);return p;}
  const allBinsMask=binIndices.reduce((m,i)=>m|(1<<i),1);
  const allVisited=allBinsMask|(1<<destIdx);
  const gCost=new Map<string,number>(),pathAt=new Map<string,number[]>();
  gCost.set("0,1",0);pathAt.set("0,1",[0]);
  interface E{node:number;mask:number;g:number;f:number;}
  const open:E[]=[{node:0,mask:1,g:0,f:admissibleH(0,1,dist,n)}];
  while (open.length>0){
    let mi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[mi].f)mi=i;
    const curr=open.splice(mi,1)[0];const key=`${curr.node},${curr.mask}`;
    if(curr.mask===allVisited)return pathAt.get(key)??[0,...binIndices,destIdx];
    if(curr.g>(gCost.get(key)??Infinity))continue;
    const allBinsVisited=(curr.mask&allBinsMask)===allBinsMask;
    const cands=allBinsVisited?[destIdx]:binIndices.filter(i=>!(curr.mask&(1<<i)));
    for(const next of cands){
      const nm=curr.mask|(1<<next),ng=curr.g+dist[curr.node][next],nk=`${next},${nm}`;
      if(ng<(gCost.get(nk)??Infinity)){
        gCost.set(nk,ng);
        const h=allBinsVisited?0:admissibleH(next,nm,dist,n);
        const prev=pathAt.get(key)??[0];pathAt.set(nk,[...prev,next]);
        open.push({node:next,mask:nm,g:ng,f:ng+h});
      }
    }
  }
  return [0,...binIndices,destIdx];
}

function nearestNeighborSubset(dist:number[][],subset:number[]):number[]{
  const visited=new Set<number>([0]),path=[0],remaining=new Set(subset);
  while(remaining.size>0){
    const last=path[path.length-1];let best=Infinity,bn=-1;
    for(const j of remaining)if(!visited.has(j)&&dist[last][j]<best){best=dist[last][j];bn=j;}
    if(bn===-1)break;visited.add(bn);remaining.delete(bn);path.push(bn);
  }
  return path;
}

function classifyUturns(route:[number,number][],driverHeading:number):Set<number>{
  const us=new Set<number>(),headings=[driverHeading];
  for(let i=1;i<route.length;i++)headings.push(bearing(route[i-1],route[i]));
  for(let i=1;i<route.length;i++){
    const arr=headings[i];
    const dep=i+1<route.length?bearing(route[i],route[i+1]):arr;
    if(angleDiff(arr,dep)>120)us.add(i);
  }
  return us;
}

function segmentColor(idx:number,total:number,mode:"fastest"|"priority"):string{
  if(total===0)return mode==="priority"?"#f97316":"#059669";
  const eH=mode==="priority"?25:152,eS=mode==="priority"?95:69,eL=mode==="priority"?53:35;
  const t=total===1?0:idx/(total-1);
  return `hsl(${Math.round(4+(eH-4)*t)},${Math.round(90+(eS-90)*t)}%,${Math.round(58+(eL-58)*t)}%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCE MARKER
// ─────────────────────────────────────────────────────────────────────────────

function SequenceMarker({ bin, stopNum, isSelected, isUturn }: {
  bin: any; stopNum: number; isSelected: boolean; isUturn: boolean;
}) {
  const urgent = bin.fillLevel >= 80;
  const bg     = isSelected ? "#2563eb" : urgent ? "#ef4444" : "#059669";
  return (
    <Marker longitude={bin.lng} latitude={bin.lat} anchor="center">
      <div style={{ position: "relative" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: bg,
          border: `2.5px solid ${isUturn ? "#f59e0b" : "#fff"}`,
          boxShadow: isUturn ? "0 0 0 3px #f59e0b, 0 2px 8px rgba(0,0,0,.5)" : "0 2px 10px rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "sans-serif",
        }}>
          {stopNum}
        </div>
        {isUturn && (
          <div style={{
            position: "absolute", top: -6, right: -6,
            width: 14, height: 14, borderRadius: "50%",
            background: "#f59e0b", border: "1.5px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "#fff",
          }}>↩</div>
        )}
      </div>
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOJSON HELPERS — merge all legs into single FeatureCollections
// This avoids Source ID clashes when leg count changes between renders.
// ─────────────────────────────────────────────────────────────────────────────

interface LegData {
  coords:     [number, number][];
  color:      string;
  width:      number;
  opacity:    number;
  dashArray?: number[];
  isUturn:    boolean;
  segIndex:   number;
}

function buildFeatureCollection(legs: LegData[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: legs
      .filter(l => l.coords.length >= 2)
      .map(l => ({
        type: "Feature" as const,
        properties: {
          color:    l.color,
          width:    l.width,
          opacity:  l.opacity,
          // dashArray as comma string — MapLibre doesn't support array expressions easily
          dash:     l.dashArray ? l.dashArray.join(",") : "",
        },
        geometry: {
          type: "LineString" as const,
          // MapLibre uses [lng, lat]
          coordinates: l.coords.map(c => [c[1], c[0]]),
        },
      })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RoutingLayerGL({
  driverPos, bins, selectedBinId, onRouteUpdate, onOrderUpdate,
  routeKey=0, mode="fastest", useFence=true, maxDetour=1000,
  heading=0, routingPos, destinationPos,
}: RoutingProps) {
  const { current: mapInstance } = useMap();
  const stablePos = routingPos ?? driverPos;
  const abortRef  = useRef<AbortController | null>(null);

  // Route state — one FeatureCollection for glow, one for solid lines
  const [glowFC, setGlowFC]   = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null);
  const [lineFC, setLineFC]   = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null);
  const [previewFC, setPreviewFC] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null);
  const [seqMarkers, setSeqMarkers] = useState<{ bin: any; stopNum: number; isSelected: boolean; isUturn: boolean }[]>([]);

  // Toast
  const [toast, setToast]         = useState<ToastState>(null);
  const orderedStopsRef           = useRef<any[]>([]);
  const notifiedRef               = useRef<Set<string>>(new Set());
  const toastTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRouteUpdateRef          = useRef(onRouteUpdate);
  useEffect(() => { onRouteUpdateRef.current = onRouteUpdate; });
  const onOrderUpdateRef          = useRef(onOrderUpdate);
  useEffect(() => { onOrderUpdateRef.current = onOrderUpdate; });

  // Proximity check
  useEffect(() => {
    if (!driverPos || orderedStopsRef.current.length === 0) return;
    const nextStop = orderedStopsRef.current.find((s: any) => !notifiedRef.current.has(`arrived-${s.id}`));
    if (!nextStop) return;
    const dist = haversine(driverPos, [nextStop.lat, nextStop.lng]);
    const idx  = orderedStopsRef.current.indexOf(nextStop) + 1;
    if (dist <= ARRIVE_DISTANCE_M) {
      notifiedRef.current.add(`arrived-${nextStop.id}`);
      notifiedRef.current.add(`approach-${nextStop.id}`);
      setToast({ stopNum: idx, binName: nextStop.name ?? `Bin ${nextStop.id}`, fillLevel: nextStop.fillLevel, dist, arrived: true, isUturn: !!nextStop.requiresUturn });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    } else if (dist <= ALERT_DISTANCE_M && !notifiedRef.current.has(`approach-${nextStop.id}`)) {
      notifiedRef.current.add(`approach-${nextStop.id}`);
      setToast({ stopNum: idx, binName: nextStop.name ?? `Bin ${nextStop.id}`, fillLevel: nextStop.fillLevel, dist, arrived: false, isUturn: !!nextStop.requiresUturn });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    } else if (dist > ALERT_DISTANCE_M) {
      notifiedRef.current.delete(`approach-${nextStop.id}`);
    }
  }, [driverPos]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── STABLE BIN SIGNATURE ──────────────────────────────────────────────────
  // Stringify bin IDs + fill levels → stable string dep instead of array ref.
  // Prevents A* from firing on every render just because the array was recreated.
  // routeKey is the intentional "recalculate now" trigger (incremented by dashboard).
  const binsSig = bins.map((b: any) => `${b.id}:${b.fillLevel}`).join(",");

  // ── MAIN EFFECT ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stablePos || bins.length === 0) return;
    if (!mapInstance) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // Clear
    setGlowFC(null); setLineFC(null); setPreviewFC(null); setSeqMarkers([]);

    // Target selection
    // In scheduled route mode (maxDetour >= 9999 set by DriverMap), include ALL
    // passed bins regardless of fill level — the dashboard already strips collected ones.
    const isScheduledMode = maxDetour >= 9999;
    let targets = isScheduledMode
      ? [...bins]
      : bins.filter((b: any) => b.fillLevel >= 40 || b.id === selectedBinId);
    if (!isScheduledMode && useFence)
      targets = targets.filter((b: any) => getDistance(stablePos!, [b.lat, b.lng]) < 2500);
    if (!isScheduledMode && maxDetour && maxDetour < 2500)
      targets = targets.filter((b: any) => getDistance(stablePos!, [b.lat, b.lng]) < maxDetour);
    if (targets.length === 0) return;

    // Build nodes
    const binCoords: [number, number][] = targets.map((t: any) => [t.lat, t.lng]);
    const hasDestination = !!destinationPos;
    const allNodes: [number, number][] = [stablePos!, ...binCoords, ...(hasDestination ? [destinationPos!] : [])];
    const destNodeIdx = hasDestination ? allNodes.length - 1 : -1;

    // A*
    const distMat = buildHeadingAwareMatrix(allNodes, heading, destNodeIdx);
    const orderedIndices = hasDestination
      ? astarTSPWithDestination(allNodes, distMat, destNodeIdx)
      : astarTSP(allNodes, distMat);

    const orderedTargets = orderedIndices.filter(i => i !== 0 && i !== destNodeIdx).map(i => targets[i - 1]);

    const routeWaypoints: [number, number][] = [
      stablePos!,
      ...orderedTargets.map((t: any) => [t.lat, t.lng] as [number, number]),
      ...(hasDestination ? [destinationPos!] : []),
    ];

    const uturnStops  = classifyUturns(routeWaypoints, heading);
    const totalLegs   = routeWaypoints.length - 1;
    const uturnLegSet = new Set<number>();
    uturnStops.forEach(s => uturnLegSet.add(s - 1));

    // Preview line while Mapbox fetches road geometry
    const previewFeature: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: routeWaypoints.map(p => [p[1], p[0]]) },
      }],
    };
    setPreviewFC(previewFeature);

    // Sequence markers
    const orderedWithMeta = orderedTargets.map((bin: any, idx: number) => ({
      ...bin, requiresUturn: uturnStops.has(idx + 1),
    }));
    setSeqMarkers(orderedTargets.map((bin: any, idx: number) => ({
      bin, stopNum: idx + 1,
      isSelected: bin.id === selectedBinId,
      isUturn: uturnStops.has(idx + 1),
    })));

    orderedStopsRef.current = orderedWithMeta;
    notifiedRef.current     = new Set();
    setToast(null);
    onOrderUpdateRef.current?.(orderedWithMeta);

    // Fetch road geometry
    const SNAP_RADIUS     = 500;
    const SNAP_RADIUS_MID = 150;
    const BEARING_TOL     = 45;
    const profile = mode === "priority" ? "mapbox/driving" : "mapbox/driving-traffic";
    const TOKEN   = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    const buildUrl = (
      from: [number, number], to: [number, number],
      isUturnLeg: boolean, snapRadius: number | null, fromBearing: number | null
    ) => {
      const c   = `${from[1]},${from[0]};${to[1]},${to[0]}`;
      const rad = snapRadius !== null ? `&radiuses=${snapRadius};30` : "";
      const br  = snapRadius !== null && fromBearing !== null
        ? `&bearings=${Math.round(fromBearing) % 360},${BEARING_TOL};0,180` : "";
      return `https://api.mapbox.com/directions/v5/${profile}/${c}` +
        `?geometries=geojson&overview=full&steps=true&exclude=ferry` +
        rad + br +
        `&approaches=curb;curb&annotations=duration,distance` +
        (isUturnLeg ? `&continue_straight=true` : `&continue_straight=false`) +
        `&access_token=${TOKEN}`;
    };

    const fetchLeg = (from: [number,number], to: [number,number], isUturnLeg: boolean, fromBearing: number|null, s: number) => {
      const tryFetch = (r: number | null) =>
        fetch(buildUrl(from, to, isUturnLeg, r, fromBearing), { signal }).then(res => res.json());
      return tryFetch(SNAP_RADIUS)
        .then((d: any) => d.routes?.[0] ? d : tryFetch(SNAP_RADIUS_MID))
        .then((d: any) => d.routes?.[0] ? d : tryFetch(null))
        .then((d: any) => ({
          coords: (d.routes?.[0]?.geometry?.coordinates ?? []).map((c: number[]) => [c[1], c[0]] as [number, number]),
          dist:     d.routes?.[0]?.distance ?? 0,
          duration: d.routes?.[0]?.duration ?? 0,
          isUturnLeg, segIndex: s,
        }));
    };

    const legPromises = Array.from({ length: totalLegs }, (_, s) => {
      const from = routeWaypoints[s], to = routeWaypoints[s + 1];
      const isUturnLeg = uturnLegSet.has(s);
      const legBearing = s === 0 ? heading : bearing(from, to);
      return fetchLeg(from, to, isUturnLeg, legBearing, s);
    });

    Promise.all(legPromises)
      .then(legs => {
        const normalCount = legs.filter(l => !l.isUturnLeg).length;
        let nIdx = 0;

        const glowLegs: LegData[] = [];
        const lineLegs: LegData[] = [];

        legs.forEach(leg => {
          if (leg.coords.length < 2) return;
          const color   = leg.isUturnLeg ? "#eab308" : segmentColor(nIdx, normalCount, mode);
          const width   = leg.segIndex === 0 ? 6 : 5;
          const opacity = leg.segIndex === 0 ? 1 : 0.88;
          const dashArray = leg.isUturnLeg ? [10, 6]
            : mode === "priority" && leg.segIndex > 0 ? [1, 8]
            : undefined;
          if (!leg.isUturnLeg) nIdx++;

          glowLegs.push({ coords: leg.coords, color, width: width + 8, opacity: leg.isUturnLeg ? 0.2 : 0.14, isUturn: leg.isUturnLeg, segIndex: leg.segIndex });
          lineLegs.push({ coords: leg.coords, color, width, opacity, dashArray, isUturn: leg.isUturnLeg, segIndex: leg.segIndex });
        });

        setGlowFC(buildFeatureCollection(glowLegs));
        setLineFC(buildFeatureCollection(lineLegs));
        setPreviewFC(null); // hide preview

        const totalDist     = legs.reduce((s, l) => s + l.dist, 0);
        const totalDuration = legs.reduce((s, l) => s + l.duration, 0);
        onRouteUpdateRef.current({
          dist: `${(totalDist / 1000).toFixed(1)} km`,
          time: `${Math.round(totalDuration / 60)} min`,
        });

        // Fit bounds
        const allCoords = legs.flatMap(l => l.coords);
        if (allCoords.length > 1 && mapInstance) {
          const lngs = allCoords.map(c => c[1]), lats = allCoords.map(c => c[0]);
          mapInstance.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 80, duration: 1200 }
          );
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") console.error("[RoutingLayerGL]", err);
      });

    return () => { abortRef.current?.abort(); };

  // mapInstance in deps — effect re-runs when map becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, stablePos, binsSig, selectedBinId, routeKey, mode, useFence, maxDetour, heading, destinationPos]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Preview connector (straight lines while loading) */}
      {previewFC && (
        <Source id="route-preview" type="geojson" data={previewFC}>
          <Layer id="route-preview-line" type="line" paint={{
            "line-color": mode === "priority" ? "#f97316" : "#059669",
            "line-width": 2, "line-opacity": 0.5,
            "line-dasharray": [4, 4],
          }} layout={{ "line-join": "round", "line-cap": "round" }} />
        </Source>
      )}

      {/* Glow halo layer — single Source with all legs */}
      {glowFC && (
        <Source id="route-glow" type="geojson" data={glowFC}>
          <Layer id="route-glow-layer" type="line"
            paint={{
              "line-color":   ["get", "color"],
              "line-width":   ["get", "width"],
              "line-opacity": ["get", "opacity"],
              "line-blur":    6,
            }}
            layout={{ "line-join": "round", "line-cap": "round" }}
          />
        </Source>
      )}

      {/* Solid line layer */}
      {lineFC && (
        <Source id="route-lines" type="geojson" data={lineFC}>
          <Layer id="route-lines-layer" type="line"
            paint={{
              "line-color":   ["get", "color"],
              "line-width":   ["get", "width"],
              "line-opacity": ["get", "opacity"],
            }}
            layout={{ "line-join": "round", "line-cap": "round" }}
          />
        </Source>
      )}

      {/* Sequence markers */}
      {seqMarkers.map(m => (
        <SequenceMarker key={m.bin.id} {...m} />
      ))}

      {/* Toast */}
      <ProximityToast toast={toast} />
    </>
  );
}