"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [editingPerson, setEditingPerson] = useState<Partial<Person>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ rel: Relationship; x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ person: Person; x: number; y: number } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; personId: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lineType, setLineType] = useState<'straight' | 'curved' | 'rightAngled'>('straight');
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    birthDate: "",
    deathDate: ""
  });
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

  useEffect(() => {
    if (selectedPerson) {
      setEditingPerson(selectedPerson);
    }
  }, [selectedPerson]);

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

  const addPerson = () => {
    const newPerson: Person = {
      id: `demo-${Date.now()}`,
      first_name: formData.firstName,
      last_name: formData.lastName,
      gender: formData.gender,
      birth_date: formData.birthDate,
      death_date: formData.deathDate,
      position_x: 100 + people.length * 50,
      position_y: 100 + people.length * 20
    };
    setPeople([...people, newPerson]);
    setFormData({ firstName: "", lastName: "", gender: "", birthDate: "", deathDate: "" });
    setShowAddForm(false);
  };

  const updatePerson = () => {
    if (!selectedPerson) return;
    setPeople(people.map(p => 
      p.id === selectedPerson.id 
        ? { ...p, ...editingPerson } 
        : p
    ));
    setSelectedPerson(null);
  };

  const deletePerson = (personId: string) => {
    setPeople(people.filter(p => p.id !== personId));
    setRelationships(relationships.filter(r => 
      r.person1_id !== personId && r.person2_id !== personId
    ));
    if (selectedPerson?.id === personId) {
      setSelectedPerson(null);
    }
    setNodeContextMenu(null);
  };

  const createRelationship = (person1Id: string, person2Id: string, type: string) => {
    const newRel: Relationship = {
      id: `demo-rel-${Date.now()}`,
      person1_id: person1Id,
      person2_id: person2Id,
      type
    };
    setRelationships([...relationships, newRel]);
    setLinkingFrom(null);
  };

  const updateRelationshipType = (relId: string, newType: string) => {
    setRelationships(relationships.map(r =>
      r.id === relId ? { ...r, type: newType } : r
    ));
    setContextMenu(null);
  };

  const deleteRelationship = (relId: string) => {
    setRelationships(relationships.filter(r => r.id !== relId));
    setContextMenu(null);
  };

  const updatePersonPosition = (personId: string, x: number, y: number) => {
    setPeople(people.map(p =>
      p.id === personId ? { ...p, position_x: x, position_y: y } : p
    ));
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
    }}
    onClick={() => {
      setContextMenu(null);
      setNodeContextMenu(null);
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
            DEMO MODE - Export disabled
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
          <button 
            className="primary" 
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ width: '100%', marginBottom: '16px' }}
          >
            + Add Person
          </button>

          {showAddForm && (
            <div style={{
              background: '#0f172a',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #1f2937'
            }}>
              <input
                type="text"
                placeholder="First name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                placeholder="Last name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                style={{ width: '100%', marginBottom: '8px' }}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                placeholder="Birth date (YYYY-MM-DD)"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                placeholder="Death date (YYYY-MM-DD)"
                value={formData.deathDate}
                onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <button className="primary" onClick={addPerson} style={{ width: '100%' }}>
                Create Person
              </button>
            </div>
          )}
          
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
            cursor: isPanning ? 'grabbing' : linkingFrom ? 'crosshair' : 'grab',
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
            if (linkingFrom || dragging) {
              const point = getBoardPoint(e);
              setMouse(point);
            }
          }}
          onPointerUp={() => {
            setIsPanning(false);
            setDragging(null);
            setDragStart(null);
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
              
              {/* Link preview line */}
              {linkingFrom && (
                <line
                  x1={personMap.get(linkingFrom)!.position_x + 75}
                  y1={personMap.get(linkingFrom)!.position_y + 50}
                  x2={mouse.x}
                  y2={mouse.y}
                  stroke="#60a5fa"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  opacity={0.8}
                />
              )}
            </g>
          </svg>

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              pointerEvents: 'none'
            }}
          >
            {people.map(person => (
              <div
                key={person.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (linkingFrom && linkingFrom !== person.id) {
                    createRelationship(linkingFrom, person.id, 'parent-child');
                  } else if (!linkingFrom) {
                    setDragging(person.id);
                    const point = getBoardPoint(e);
                    setDragStart({ x: point.x, y: point.y, personId: person.id });
                  }
                }}
                onPointerMove={(e) => {
                  if (dragging === person.id && dragStart) {
                    const point = getBoardPoint(e);
                    const dx = point.x - dragStart.x;
                    const dy = point.y - dragStart.y;
                    updatePersonPosition(person.id, person.position_x + dx, person.position_y + dy);
                    setDragStart({ ...dragStart, x: point.x, y: point.y });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPerson(person);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setNodeContextMenu({ person, x: e.clientX, y: e.clientY });
                }}
                style={{
                  position: 'absolute',
                  left: person.position_x,
                  top: person.position_y,
                  width: '150px',
                  padding: '12px',
                  background: selectedPerson?.id === person.id ? '#1e3a8a' : '#0f172a',
                  border: `2px solid ${selectedPerson?.id === person.id ? '#3b82f6' : '#1f2937'}`,
                  borderRadius: '8px',
                  cursor: linkingFrom ? 'crosshair' : 'move',
                  userSelect: 'none',
                  transition: 'all 0.2s',
                  pointerEvents: 'auto'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: -12,
                  right: -12,
                  background: '#3b82f6',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white',
                  pointerEvents: 'auto'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkingFrom === person.id) {
                    setLinkingFrom(null);
                  } else {
                    setLinkingFrom(person.id);
                  }
                }}
                title="Create relationship"
                >
                  {linkingFrom === person.id ? '×' : '+'}
                </div>

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
          <aside className="blade">
            <div className="blade-header">
              <h3>Edit Person</h3>
              <button
                onClick={() => setSelectedPerson(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '24px',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>
            
            <div className="blade-content">
              <div className="blade-section">
                <h4>Basic Info</h4>
                <div className="detail-field">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={editingPerson.first_name || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, first_name: e.target.value })}
                  />
                </div>
                
                <div className="detail-field">
                  <label>Middle Name</label>
                  <input
                    type="text"
                    value={editingPerson.middle_name || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, middle_name: e.target.value })}
                  />
                </div>
                
                <div className="detail-field">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={editingPerson.last_name || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, last_name: e.target.value })}
                  />
                </div>
                
                <div className="detail-field">
                  <label>Gender</label>
                  <select
                    value={editingPerson.gender || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, gender: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="detail-field">
                  <label>Birth Date</label>
                  <input
                    type="text"
                    value={editingPerson.birth_date || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, birth_date: e.target.value })}
                    placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                  />
                </div>
                
                <div className="detail-field">
                  <label>Death Date</label>
                  <input
                    type="text"
                    value={editingPerson.death_date || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, death_date: e.target.value })}
                    placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                  />
                </div>
              </div>
            </div>

            <div className="blade-actions">
              <button className="primary" onClick={updatePerson}>
                Save Changes
              </button>
              <button className="secondary" onClick={() => setSelectedPerson(null)}>
                Cancel
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Relationship Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-section">
            <div className="context-menu-label">Relationship Type</div>
            <button onClick={() => updateRelationshipType(contextMenu.rel.id, "parent-child")}>
              Parent-Child
            </button>
            <button onClick={() => updateRelationshipType(contextMenu.rel.id, "spouse")}>
              Spouse
            </button>
            <button onClick={() => updateRelationshipType(contextMenu.rel.id, "sibling")}>
              Sibling
            </button>
            <button onClick={() => updateRelationshipType(contextMenu.rel.id, "ex-spouse")}>
              Ex-Spouse
            </button>
            <button onClick={() => updateRelationshipType(contextMenu.rel.id, "other")}>
              Other
            </button>
          </div>
          <div className="context-menu-divider"></div>
          <button
            className="context-menu-delete"
            onClick={() => deleteRelationship(contextMenu.rel.id)}
          >
            Delete Relationship
          </button>
        </div>
      )}

      {/* Node Context Menu */}
      {nodeContextMenu && (
        <div
          className="context-menu"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => {
            setSelectedPerson(nodeContextMenu.person);
            setEditingPerson({
              first_name: nodeContextMenu.person.first_name,
              middle_name: nodeContextMenu.person.middle_name || '',
              last_name: nodeContextMenu.person.last_name || '',
              gender: nodeContextMenu.person.gender || '',
              birth_date: nodeContextMenu.person.birth_date || '',
              death_date: nodeContextMenu.person.death_date || ''
            });
            setNodeContextMenu(null);
          }}>
            Edit Details
          </button>
          <div className="context-menu-section">
            <div className="context-menu-label">Set Gender</div>
            <button onClick={() => {
              setPeople(people.map(p => 
                p.id === nodeContextMenu.person.id ? { ...p, gender: 'male' } : p
              ));
              setNodeContextMenu(null);
            }}>
              Male
            </button>
            <button onClick={() => {
              setPeople(people.map(p => 
                p.id === nodeContextMenu.person.id ? { ...p, gender: 'female' } : p
              ));
              setNodeContextMenu(null);
            }}>
              Female
            </button>
            <button onClick={() => {
              setPeople(people.map(p => 
                p.id === nodeContextMenu.person.id ? { ...p, gender: 'other' } : p
              ));
              setNodeContextMenu(null);
            }}>
              Other
            </button>
          </div>
          <div className="context-menu-divider"></div>
          <button
            className="context-menu-delete"
            onClick={() => {
              deletePerson(nodeContextMenu.person.id);
            }}
          >
            Delete Person
          </button>
        </div>
      )}
    </div>
  );
}
