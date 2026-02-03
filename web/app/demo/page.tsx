"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_PEOPLE, DEMO_RELATIONSHIPS } from "./data";

type Person = {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  gender?: string;
  birth_date?: string;
  death_date?: string;
  photo_url?: string;
  position_x: number;
  position_y: number;
};

type Relationship = {
  id: string;
  person1_id: string;
  person2_id: string;
  type: string;
};

export default function DemoPage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>(DEMO_PEOPLE as Person[]);
  const [relationships, setRelationships] = useState<Relationship[]>(DEMO_RELATIONSHIPS);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lineType, setLineType] = useState<'straight' | 'curved' | 'rightAngled'>('straight');
  const [showSettings, setShowSettings] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const personMap = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const treeStats = useMemo(() => {
    const males = people.filter(p => p.gender === 'male').length;
    const females = people.filter(p => p.gender === 'female').length;
    const other = people.length - males - females;
    const parentChildRels = relationships.filter(r => r.type === 'parent-child').length;
    const spouseRels = relationships.filter(r => r.type === 'spouse').length;
    const siblingRels = relationships.filter(r => r.type === 'sibling').length;
    
    return {
      males,
      females,
      other,
      withImages: 0,
      parentChildRels,
      spouseRels,
      siblingRels
    };
  }, [people, relationships]);

  const getBoardPoint = (e: React.MouseEvent | React.PointerEvent) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom
    };
  };

  const getDisplayName = (p: Person) => {
    const parts = [p.first_name, p.middle_name, p.last_name].filter(Boolean);
    return parts.join(" ") || "No name";
  };

  const getLineConfig = (type: 'straight' | 'curved' | 'rightAngled') => {
    switch (type) {
      case 'curved':
        return { stroke: '#38bdf8', strokeWidth: 2, style: 'curved' };
      case 'rightAngled':
        return { stroke: '#f472b6', strokeWidth: 2, style: 'rightAngled' };
      default:
        return { stroke: '#94a3b8', strokeWidth: 2, style: 'straight' };
    }
  };

  const drawPath = (x1: number, y1: number, x2: number, y2: number, config: any) => {
    if (config.style === 'curved') {
      const midX = (x1 + x2) / 2;
      return `M ${x1},${y1} Q ${midX},${y1} ${midX},${(y1 + y2) / 2} T ${x2},${y2}`;
    } else if (config.style === 'rightAngled') {
      const midY = (y1 + y2) / 2;
      return `M ${x1},${y1} L ${x1},${midY} L ${x2},${midY} L ${x2},${y2}`;
    }
    return `M ${x1},${y1} L ${x2},${y2}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0f1a'
    }}>
      {/* Top Bar */}
      <div style={{
        height: '56px',
        background: '#0b1220',
        borderBottom: '1px solid #1f2937',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
            Demo Family Tree
          </h2>
          <span style={{
            padding: '4px 12px',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600
          }}>
            DEMO MODE - Import features disabled
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="secondary"
            onClick={() => router.push('/')}
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: '280px',
          background: '#0b1220',
          borderRight: '1px solid #1f2937',
          overflowY: 'auto',
          padding: '16px'
        }}>
          <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "#94a3b8" }}>Statistics</h3>
          
          <div className="sidebar-stats">
            <div className="stat-item">
              <span className="stat-value">{people.length}</span>
              <span className="stat-label">People</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{relationships.length}</span>
              <span className="stat-label">Links</span>
            </div>
          </div>

          <div style={{ 
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginTop: "12px",
            fontSize: "13px"
          }}>
            <div>
              <p className="muted" style={{ fontSize: "11px" }}>Males</p>
              <p style={{ color: "#22d3ee", fontWeight: "600" }}>{treeStats.males}</p>
            </div>
            <div>
              <p className="muted" style={{ fontSize: "11px" }}>Females</p>
              <p style={{ color: "#ec4899", fontWeight: "600" }}>{treeStats.females}</p>
            </div>
            <div>
              <p className="muted" style={{ fontSize: "11px" }}>Other</p>
              <p style={{ fontWeight: "600" }}>{treeStats.other}</p>
            </div>
            <div>
              <p className="muted" style={{ fontSize: "11px" }}>With Photos</p>
              <p style={{ color: "#10b981", fontWeight: "600" }}>{treeStats.withImages}</p>
            </div>
          </div>

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #1f2937" }}>
            <p className="muted" style={{ fontSize: "11px", marginBottom: "6px" }}>Relationships</p>
            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Parent-Child</span>
                <span style={{ color: "#38bdf8" }}>{treeStats.parentChildRels}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Spouse</span>
                <span style={{ color: "#f472b6" }}>{treeStats.spouseRels}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Sibling</span>
                <span style={{ color: "#a78bfa" }}>{treeStats.siblingRels}</span>
              </div>
            </div>
          </div>

          <div className="zoom-controls" style={{ marginTop: '24px' }}>
            <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 3))} title="Zoom In">
              +
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.3))} title="Zoom Out">
              −
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset View">
              ⟲
            </button>
          </div>

          <button 
            className="secondary" 
            onClick={() => setShowSettings(!showSettings)}
            style={{ marginTop: '16px' }}
          >
            ⚙ Settings
          </button>

          {showSettings && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #1f2937'
            }}>
              <h4 style={{ fontSize: '12px', marginBottom: '8px', color: '#94a3b8' }}>Line Style</h4>
              <select
                value={lineType}
                onChange={(e) => setLineType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: '#0a0f1a',
                  border: '1px solid #1f2937',
                  borderRadius: '4px',
                  color: '#f8fafc',
                  fontSize: '12px'
                }}
              >
                <option value="straight">Straight Lines</option>
                <option value="curved">Curved Lines</option>
                <option value="rightAngled">Right-Angled Lines</option>
              </select>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={boardRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : 'grab',
            background: '#0a0f1a'
          }}
          onPointerDown={(e) => {
            if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
              e.preventDefault();
              setIsPanning(true);
              setPanStart({ x: e.clientX, y: e.clientY });
            }
          }}
          onPointerMove={(e) => {
            if (isPanning) {
              const dx = e.clientX - panStart.x;
              const dy = e.clientY - panStart.y;
              setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              setPanStart({ x: e.clientX, y: e.clientY });
            }
          }}
          onPointerUp={() => {
            setIsPanning(false);
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(prev => Math.max(0.3, Math.min(3, prev + delta)));
          }}
        >
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {relationships.map(rel => {
                const p1 = personMap.get(rel.person1_id);
                const p2 = personMap.get(rel.person2_id);
                if (!p1 || !p2) return null;

                const lineConfig = getLineConfig(lineType);
                const x1 = p1.position_x + 75;
                const y1 = p1.position_y + 50;
                const x2 = p2.position_x + 75;
                const y2 = p2.position_y + 50;

                return (
                  <path
                    key={rel.id}
                    d={drawPath(x1, y1, x2, y2, lineConfig)}
                    stroke={lineConfig.stroke}
                    strokeWidth={lineConfig.strokeWidth}
                    fill="none"
                    opacity={0.6}
                  />
                );
              })}
            </g>
          </svg>

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0'
            }}
          >
            {people.map(person => (
              <div
                key={person.id}
                onClick={() => setSelectedPerson(person)}
                style={{
                  position: 'absolute',
                  left: person.position_x,
                  top: person.position_y,
                  width: '150px',
                  padding: '12px',
                  background: selectedPerson?.id === person.id ? '#1e3a8a' : '#0f172a',
                  border: `2px solid ${selectedPerson?.id === person.id ? '#3b82f6' : '#1f2937'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  marginBottom: '4px',
                  color: '#f8fafc'
                }}>
                  {getDisplayName(person)}
                </div>
                {person.gender && (
                  <div style={{
                    fontSize: '11px',
                    color: person.gender === 'male' ? '#22d3ee' : person.gender === 'female' ? '#ec4899' : '#94a3b8',
                    marginBottom: '4px'
                  }}>
                    {person.gender}
                  </div>
                )}
                {person.birth_date && (
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Born: {person.birth_date}
                  </div>
                )}
                {person.death_date && (
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Died: {person.death_date}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        {selectedPerson && (
          <div style={{
            width: '320px',
            background: '#0b1220',
            borderLeft: '1px solid #1f2937',
            overflowY: 'auto',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', color: '#f8fafc' }}>Person Details</h3>
              <button
                onClick={() => setSelectedPerson(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p className="muted" style={{ fontSize: '12px', marginBottom: '4px' }}>First Name</p>
              <p style={{ fontSize: '14px', color: '#f8fafc' }}>{selectedPerson.first_name || '-'}</p>
            </div>
            
            {selectedPerson.middle_name && (
              <div style={{ marginBottom: '16px' }}>
                <p className="muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Middle Name</p>
                <p style={{ fontSize: '14px', color: '#f8fafc' }}>{selectedPerson.middle_name}</p>
              </div>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <p className="muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Last Name</p>
              <p style={{ fontSize: '14px', color: '#f8fafc' }}>{selectedPerson.last_name || '-'}</p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p className="muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Gender</p>
              <p style={{ fontSize: '14px', color: '#f8fafc' }}>{selectedPerson.gender || '-'}</p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p className="muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Birth Date</p>
              <p style={{ fontSize: '14px', color: '#f8fafc' }}>{selectedPerson.birth_date || '-'}</p>
            </div>
            
            {selectedPerson.death_date && (
              <div style={{ marginBottom: '16px' }}>
                <p className="muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Death Date</p>
                <p style={{ fontSize: '14px', color: '#f8fafc' }}>{selectedPerson.death_date}</p>
              </div>
            )}

            <div style={{
              padding: '12px',
              background: '#fef3c7',
              borderRadius: '8px',
              marginTop: '24px'
            }}>
              <p style={{ fontSize: '12px', color: '#92400e', textAlign: 'center' }}>
                This is a demo. Editing is disabled.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
