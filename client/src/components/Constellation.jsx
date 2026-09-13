import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../api.js';
import './Constellation.css';

// A lightweight force layout — no physics library needed for the
// entry counts this app is built for (hundreds, not tens of thousands).
// Nodes repel each other; links pull connected nodes together; entries
// with no connections drift to a quiet outer ring rather than
// cluttering the center.
function useForceLayout(nodeIds, edgeList, width, height) {
  const posRef = useRef({});
  const [, forceRender] = useState(0);

  useEffect(() => {
    // Seed any new nodes with a random position; keep existing ones.
    for (const id of nodeIds) {
      if (!posRef.current[id]) {
        posRef.current[id] = {
          x: width / 2 + (Math.random() - 0.5) * width * 0.6,
          y: height / 2 + (Math.random() - 0.5) * height * 0.6,
          vx: 0,
          vy: 0,
        };
      }
    }
    // Drop stale nodes.
    for (const id of Object.keys(posRef.current)) {
      if (!nodeIds.includes(id)) delete posRef.current[id];
    }

    let frame;
    let tick = 0;
    const maxTicks = 220;

    function step() {
      const pos = posRef.current;
      const ids = nodeIds;

      // Repulsion between all pairs (fine at this scale).
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]];
          const b = pos[ids[j]];
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = Math.max(dx * dx + dy * dy, 1);
          const force = 1400 / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Attraction along edges.
      for (const [aId, bId] of edgeList) {
        const a = pos[aId];
        const b = pos[bId];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 140;
        const force = (dist - targetDist) * 0.02;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Mild centering pull + damping + integrate.
      for (const id of ids) {
        const p = pos[id];
        if (!p) continue;
        p.vx += (width / 2 - p.x) * 0.0015;
        p.vy += (height / 2 - p.y) * 0.0015;
        p.vx *= 0.85;
        p.vy *= 0.85;
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(24, Math.min(width - 24, p.x));
        p.y = Math.max(24, Math.min(height - 24, p.y));
      }

      tick++;
      forceRender(n => n + 1);
      if (tick < maxTicks) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIds.join(','), edgeList.length, width, height]);

  return posRef.current;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Constellation() {
  const [entries, setEntries] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 520 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [entryData, linkData] = await Promise.all([api.listEntries(), api.listAllLinks()]);
      setEntries(entryData);
      setLinks(linkData);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setSize({ width, height: Math.max(420, width * 0.7) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only show entries that have at least one connection — an entry
  // with no links yet has nothing to place it in a constellation, and
  // showing every entry as an isolated dot would just be noise.
  const connectedIds = useMemo(() => {
    const s = new Set();
    for (const l of links) {
      s.add(l.entry_id_a);
      s.add(l.entry_id_b);
    }
    return [...s].filter(id => entries.some(e => e.id === id));
  }, [links, entries]);

  const edgeList = useMemo(
    () => links.map(l => [l.entry_id_a, l.entry_id_b]),
    [links]
  );

  const entryById = useMemo(() => {
    const map = {};
    for (const e of entries) map[e.id] = e;
    return map;
  }, [entries]);

  const positions = useForceLayout(connectedIds, edgeList, size.width, size.height);

  const selectedEntry = selected ? entryById[selected] : null;
  const selectedLinks = selected
    ? links.filter(l => l.entry_id_a === selected || l.entry_id_b === selected)
    : [];

  return (
    <div className="page constellation-page">
      <p className="lede">
        Every connection your reflections have drawn between entries, laid out as a web. Click a point to see what it holds.
      </p>

      {loading && <p className="muted">Loading…</p>}

      {!loading && connectedIds.length === 0 && (
        <p className="muted empty-state">
          Nothing here yet. Connections appear once reflections start linking entries together — write a bit more,
          then reflect.
        </p>
      )}

      {!loading && connectedIds.length > 0 && (
        <>
          <div className="constellation-wrap" ref={containerRef}>
            <svg width={size.width} height={size.height} className="constellation-svg">
              <defs>
                <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {edgeList.map(([a, b], i) => {
                const pa = positions[a];
                const pb = positions[b];
                if (!pa || !pb) return null;
                const mx = (pa.x + pb.x) / 2 + (pb.y - pa.y) * 0.12;
                const my = (pa.y + pb.y) / 2 - (pb.x - pa.x) * 0.12;
                const isActive = selected === a || selected === b;
                return (
                  <path
                    key={i}
                    d={`M ${pa.x} ${pa.y} Q ${mx} ${my} ${pb.x} ${pb.y}`}
                    className={isActive ? 'constellation-edge active' : 'constellation-edge'}
                    fill="none"
                  />
                );
              })}

              {connectedIds.map(id => {
                const p = positions[id];
                if (!p) return null;
                const isSelected = selected === id;
                return (
                  <g
                    key={id}
                    transform={`translate(${p.x}, ${p.y})`}
                    className="constellation-node"
                    onClick={() => setSelected(isSelected ? null : id)}
                  >
                    <circle
                      r={isSelected ? 8 : 5}
                      className={isSelected ? 'node-dot selected' : 'node-dot'}
                      filter={isSelected ? 'url(#glow)' : undefined}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Keyboard/screen-reader path to the same data — the SVG
              graph above is a supplementary visual, not the only way
              to reach these entries. */}
          <details className="constellation-fallback">
            <summary>Browse connections as a list</summary>
            <ul>
              {links.map(l => {
                const a = entryById[l.entry_id_a];
                const b = entryById[l.entry_id_b];
                if (!a || !b) return null;
                return (
                  <li key={l.id}>
                    <button onClick={() => setSelected(l.entry_id_a)}>{formatDate(a.created_at)}</button>
                    {' — '}
                    <span className="connection-relation-inline">{l.relation}</span>
                    {' — '}
                    <button onClick={() => setSelected(l.entry_id_b)}>{formatDate(b.created_at)}</button>
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}

      {selectedEntry && (
        <div className="selected-panel">
          <div className="selected-meta">
            <span>{formatDate(selectedEntry.created_at)}</span>
            <button className="text-btn" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p className="selected-body">{selectedEntry.body}</p>
          {selectedLinks.length > 0 && (
            <p className="selected-relations">
              {selectedLinks.map(l => l.relation).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
