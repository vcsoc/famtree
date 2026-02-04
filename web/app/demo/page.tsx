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
  const [editingPerson, setEditingPerson] = useState<Partial<Person>>({});
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeName, setEditingNodeName] = useState("");
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkingFromMidpoint, setLinkingFromMidpoint] = useState<{ rel: Relationship; x: number; y: number } | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ rel: Relationship; x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ person: Person; x: number; y: number } | null>(null);
  const [hoveredRel, setHoveredRel] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; personId: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [justCompletedSelection, setJustCompletedSelection] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lineType, setLineType] = useState<'straight' | 'curved' | 'rightAngled'>('straight');
  const [gridSize, setGridSize] = useState(20);
  const [isDraggingNodes, setIsDraggingNodes] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    birthDate: "",
    deathDate: ""
  });
  const [photoPreview, setPhotoPreview] = useState<{ personId: string; photoUrl: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Keep refs in sync with state
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

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

  const getPersonLabel = (p: Person) => {
    const name = getDisplayName(p);
    let dates = "";
    if (p.birth_date && p.death_date) {
      dates = `${p.birth_date} – ${p.death_date}`;
    } else if (p.birth_date) {
      dates = `b. ${p.birth_date}`;
    } else if (p.death_date) {
      dates = `d. ${p.death_date}`;
    }
    return { name, dates };
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

  const snapToGrid = (value: number) => {
    return Math.round(value / gridSize) * gridSize;
  };

  const addPerson = () => {
    if (!formData.firstName.trim()) return;
    const newPerson: Person = {
      id: `demo-${Date.now()}`,
      first_name: formData.firstName,
      last_name: formData.lastName,
      gender: formData.gender || undefined,
      birth_date: formData.birthDate || undefined,
      death_date: formData.deathDate || undefined,
      position_x: 200 + people.length * 40,
      position_y: 200 + people.length * 30
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
    setEditingPerson({});
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
    setLinkingFromMidpoint(null);
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

  const saveInlineEdit = () => {
    if (!editingNodeId || !editingNodeName.trim()) {
      setEditingNodeId(null);
      return;
    }

    const parts = editingNodeName.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

    setPeople(people.map(p =>
      p.id === editingNodeId
        ? { ...p, first_name: firstName, last_name: lastName || undefined }
        : p
    ));

    setEditingNodeId(null);
    setEditingNodeName("");
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
      if (justCompletedSelection) {
        setJustCompletedSelection(false);
      }
    }}
    >
      {/* Header */}
      <header style={{
        height: '60px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>
            Demo Family Tree
          </h1>
          <div style={{
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            color: '#fbbf24',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            DEMO MODE - Export disabled
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? 'var(--accent)' : 'rgba(148, 163, 184, 0.1)',
              color: 'var(--text)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ⚙ Settings
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'var(--accent)',
              color: 'var(--text)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back to Home
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div style={{
        height: '50px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '16px',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)'
      }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            background: showAddForm ? 'var(--accent)' : 'rgba(148, 163, 184, 0.1)',
            color: 'var(--text)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          + Add Person
        </button>
        <div style={{ width: '1px', height: '24px', background: 'rgba(148, 163, 184, 0.2)' }}></div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '16px' }}>
          <span>👥 {people.length} people</span>
          <span>🔗 {relationships.length} relationships</span>
          <span>♂ {treeStats.males}</span>
          <span>♀ {treeStats.females}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setZoom(Math.max(0.1, zoom - 0.1));
            }}
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              color: 'var(--text)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            −
          </button>
          <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '60px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              setZoom(Math.min(3, zoom + 0.1));
            }}
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              color: 'var(--text)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            +
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              color: 'var(--text)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Add Person Form */}
      {showAddForm && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          padding: '16px 24px'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--muted)' }}>
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: 'var(--text)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '150px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--muted)' }}>
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: 'var(--text)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '150px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--muted)' }}>
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: 'var(--text)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '120px'
                }}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--muted)' }}>
                Birth Date
              </label>
              <input
                type="text"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                placeholder="YYYY or YYYY-MM-DD"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: 'var(--text)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '150px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--muted)' }}>
                Death Date
              </label>
              <input
                type="text"
                value={formData.deathDate}
                onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                placeholder="YYYY or YYYY-MM-DD"
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: 'var(--text)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '150px'
                }}
              />
            </div>
            <button
              onClick={addPerson}
              disabled={!formData.firstName.trim()}
              style={{
                background: formData.firstName.trim() ? 'var(--accent)' : 'rgba(148, 163, 184, 0.1)',
                color: 'var(--text)',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '6px',
                cursor: formData.firstName.trim() ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500',
                opacity: formData.firstName.trim() ? 1 : 0.5
              }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                color: 'var(--text)',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <section style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          ref={boardRef}
          className="tree-board"
          style={{
            position: 'absolute',
            inset: 0,
            cursor: isPanning ? 'grabbing' : (isSelecting ? 'crosshair' : 'grab'),
            overflow: 'hidden',
            background: '#0a0f1a'
          }}
          onPointerDown={(e) => {
            if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
              e.preventDefault();
              setIsPanning(true);
              setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            } else if (e.button === 0 && e.ctrlKey) {
              e.preventDefault();
              const pt = getBoardPoint(e);
              setIsSelecting(true);
              setSelectionStart(pt);
              setSelectionEnd(pt);
            } else if (e.button === 0) {
              const target = e.target as HTMLElement;
              if (target.classList.contains('tree-board')) {
                setSelectedPerson(null);
                setSelectedNodes(new Set());
              }
            }
          }}
          onPointerMove={(e) => {
            setMouse({ x: e.clientX, y: e.clientY });
            
            if (isPanning) {
              setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
              });
            } else if (isSelecting && selectionStart) {
              const pt = getBoardPoint(e);
              setSelectionEnd(pt);
            } else if (dragStart && !isDraggingNodes) {
              const dx = e.clientX - dragStart.x;
              const dy = e.clientY - dragStart.y;
              if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                setIsDraggingNodes(true);
              }
            } else if (isDraggingNodes && dragStart) {
              const dx = (e.clientX - dragStart.x) / zoom;
              const dy = (e.clientY - dragStart.y) / zoom;

              if (selectedNodes.size > 0) {
                const nodesToMove = Array.from(selectedNodes);
                setPeople(people.map(p => {
                  if (nodesToMove.includes(p.id)) {
                    const person = personMap.get(p.id)!;
                    return {
                      ...p,
                      position_x: snapToGrid(person.position_x + dx),
                      position_y: snapToGrid(person.position_y + dy)
                    };
                  }
                  return p;
                }));
              } else if (dragStart.personId) {
                const person = personMap.get(dragStart.personId);
                if (person) {
                  setPeople(people.map(p =>
                    p.id === dragStart.personId
                      ? {
                          ...p,
                          position_x: snapToGrid(person.position_x + dx),
                          position_y: snapToGrid(person.position_y + dy)
                        }
                      : p
                  ));
                }
              }

              setDragStart({ x: e.clientX, y: e.clientY, personId: dragStart.personId });
            }
          }}
          onPointerUp={() => {
            setIsPanning(false);
            setIsDraggingNodes(false);
            setDragStart(null);

            if (isSelecting && selectionStart && selectionEnd) {
              const minX = Math.min(selectionStart.x, selectionEnd.x);
              const maxX = Math.max(selectionStart.x, selectionEnd.x);
              const minY = Math.min(selectionStart.y, selectionEnd.y);
              const maxY = Math.max(selectionStart.y, selectionEnd.y);

              const selected = people.filter(p =>
                p.position_x >= minX &&
                p.position_x <= maxX &&
                p.position_y >= minY &&
                p.position_y <= maxY
              );

              setSelectedNodes(new Set(selected.map(p => p.id)));
              setJustCompletedSelection(true);
            }

            setIsSelecting(false);
            setSelectionStart(null);
            setSelectionEnd(null);
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            setZoom(Math.max(0.1, Math.min(3, zoom + delta)));
          }}
        >
        {/* Relationships */}
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
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {relationships.map((rel) => {
              const p1 = personMap.get(rel.person1_id);
              const p2 = personMap.get(rel.person2_id);
              if (!p1 || !p2) return null;

              const x1 = p1.position_x;
              const y1 = p1.position_y;
              const x2 = p2.position_x;
              const y2 = p2.position_y;

              const config = getLineConfig(lineType);
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              let color = config.stroke;
              if (rel.type === 'parent-child') color = '#60a5fa';
              else if (rel.type === 'spouse') color = '#f472b6';
              else if (rel.type === 'sibling') color = '#a78bfa';
              else if (rel.type === 'ex-spouse') color = '#fb923c';

              return (
                <g key={rel.id}>
                  <path
                    d={drawPath(x1, y1, x2, y2, config)}
                    stroke={color}
                    strokeWidth={hoveredRel === rel.id ? 3 : config.strokeWidth}
                    fill="none"
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerEnter={() => setHoveredRel(rel.id)}
                    onPointerLeave={() => setHoveredRel(null)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.button === 2) return;
                      if (e.button === 0) {
                        const rect = boardRef.current!.getBoundingClientRect();
                        const menuWidth = 200;
                        const menuHeight = 180;
                        let x = e.clientX + 10;
                        let y = e.clientY;

                        if (x + menuWidth > window.innerWidth) {
                          x = e.clientX - menuWidth - 10;
                        }
                        if (y + menuHeight > window.innerHeight) {
                          y = window.innerHeight - menuHeight - 10;
                        }

                        setContextMenu({ rel, x, y });
                      } else if (e.button === 1) {
                        const rect = boardRef.current!.getBoardingClientRect();
                        setLinkingFromMidpoint({
                          rel,
                          x: midX,
                          y: midY
                        });
                      }
                    }}
                  />
                  {linkingFromMidpoint?.rel.id === rel.id && (
                    <circle
                      cx={midX}
                      cy={midY}
                      r={8}
                      fill="#3b82f6"
                      stroke="#fff"
                      strokeWidth={2}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}

            {/* Active linking line */}
            {(linkingFrom || linkingFromMidpoint) && (
              <line
                x1={linkingFrom ? personMap.get(linkingFrom)?.position_x : linkingFromMidpoint?.x}
                y1={linkingFrom ? personMap.get(linkingFrom)?.position_y : linkingFromMidpoint?.y}
                x2={(mouse.x - pan.x) / zoom}
                y2={(mouse.y - pan.y) / zoom}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
            )}
          </g>
        </svg>

        {/* Person nodes */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}>
        {people.map((person) => {
          const { name, dates } = getPersonLabel(person);
          const isSelected = selectedNodes.has(person.id) || selectedPerson?.id === person.id;

          return (
            <div
              key={person.id}
              className={`person-node ${isSelected ? 'selected' : ''}`}
              style={{
                position: 'absolute',
                left: person.position_x * zoom + pan.x,
                top: person.position_y * zoom + pan.y,
                transform: `translate(-50%, -50%) scale(${zoom})`,
                transformOrigin: 'center center',
                pointerEvents: 'auto',
                cursor: 'pointer',
                zIndex: isSelected ? 1000 : dragging === person.id ? 999 : 1
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (linkingFrom && linkingFrom !== person.id) {
                  createRelationship(linkingFrom, person.id, 'parent-child');
                  return;
                }
                if (linkingFromMidpoint) {
                  const rel = linkingFromMidpoint.rel;
                  const newPerson1 = rel.person1_id;
                  createRelationship(newPerson1, person.id, rel.type);
                  return;
                }
                if (e.ctrlKey || e.metaKey) {
                  setSelectedNodes(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(person.id)) {
                      newSet.delete(person.id);
                    } else {
                      newSet.add(person.id);
                    }
                    return newSet;
                  });
                } else if (!justCompletedSelection) {
                  setSelectedPerson(person);
                  setEditingPerson(person);
                }
              }}
              onPointerDown={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  setSelectedNodes(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(person.id)) {
                      newSet.delete(person.id);
                    } else {
                      newSet.add(person.id);
                    }
                    return newSet;
                  });
                  return;
                }
                
                if (e.button === 0) {
                  e.preventDefault();
                  setDragStart({ x: e.clientX, y: e.clientY, personId: person.id });
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const menuWidth = 200;
                const menuHeight = 200;
                let x = e.clientX + 10;
                let y = e.clientY;
                
                if (x + menuWidth > window.innerWidth) {
                  x = e.clientX - menuWidth - 10;
                }
                if (y + menuHeight > window.innerHeight) {
                  y = window.innerHeight - menuHeight - 10;
                }
                
                setNodeContextMenu({ person, x, y });
              }}
            >
              <div className="person-photo">
                {person.photo_url ? (
                  <>
                    <img src={person.photo_url} alt={name} />
                    <div 
                      className="photo-zoom-icon"
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        const previewSize = 650;
                        const offset = 20;
                        
                        // Start with cursor position plus offset
                        let x = e.clientX + offset;
                        let y = e.clientY + offset;

                        // If preview would go off right edge, position it to the left of cursor
                        if (x + previewSize > window.innerWidth) {
                          x = e.clientX - previewSize - offset;
                        }
                        
                        // If preview would go off bottom edge, position it above cursor
                        if (y + previewSize > window.innerHeight) {
                          y = e.clientY - previewSize - offset;
                        }
                        
                        // Final boundary checks to ensure it stays on screen
                        x = Math.max(10, Math.min(x, window.innerWidth - previewSize - 10));
                        y = Math.max(10, Math.min(y, window.innerHeight - previewSize - 10));

                        setPhotoPreview({
                          personId: person.id,
                          photoUrl: person.photo_url || '',
                          x,
                          y
                        });
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation();
                        if (photoPreview?.personId === person.id) {
                          const previewSize = 650;
                          const offset = 20;
                          
                          // Start with cursor position plus offset
                          let x = e.clientX + offset;
                          let y = e.clientY + offset;

                          // If preview would go off right edge, position it to the left of cursor
                          if (x + previewSize > window.innerWidth) {
                            x = e.clientX - previewSize - offset;
                          }
                          
                          // If preview would go off bottom edge, position it above cursor
                          if (y + previewSize > window.innerHeight) {
                            y = e.clientY - previewSize - offset;
                          }
                          
                          // Final boundary checks to ensure it stays on screen
                          x = Math.max(10, Math.min(x, window.innerWidth - previewSize - 10));
                          y = Math.max(10, Math.min(y, window.innerHeight - previewSize - 10));

                          setPhotoPreview({
                            personId: person.id,
                            photoUrl: person.photo_url || '',
                            x,
                            y
                          });
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        setPhotoPreview(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      🔍
                    </div>
                  </>
                ) : (
                  <div className={`photo-placeholder ${person.gender === 'female' ? 'female' : ''} ${person.death_date ? 'deceased' : ''}`}>
                    {person.first_name[0]}
                  </div>
                )}
              </div>
              <div className="person-info" data-person-id={person.id}>
                {editingNodeId === person.id ? (
                  <input
                    type="text"
                    className="node-name-input"
                    value={editingNodeName}
                    onChange={(e) => setEditingNodeName(e.target.value)}
                    onBlur={saveInlineEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveInlineEdit();
                      } else if (e.key === "Escape") {
                        setEditingNodeId(null);
                        setEditingNodeName("");
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                  />
                ) : (
                  <>
                    <div 
                      className="person-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingNodeId(person.id);
                        setEditingNodeName(`${person.first_name} ${person.last_name || ''}`.trim());
                      }}
                    >
                      {name}
                    </div>
                    {dates && <div className="person-dates">{dates}</div>}
                  </>
                )}
              </div>
              <button
                className="node-link node-link-bottom-right"
                data-person-id={person.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setLinkingFrom(person.id);
                }}
              >
                +
              </button>
            </div>
          );
        })}
        
        {/* Selection box */}
        {isSelecting && selectionStart && selectionEnd && (
          <div
            className="selection-box"
            style={{
              position: 'absolute',
              left: Math.min(selectionStart.x, selectionEnd.x) * zoom + pan.x,
              top: Math.min(selectionStart.y, selectionEnd.y) * zoom + pan.y,
              width: Math.abs(selectionEnd.x - selectionStart.x) * zoom,
              height: Math.abs(selectionEnd.y - selectionStart.y) * zoom,
              border: '2px dashed #3b82f6',
              background: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Photo Preview Popup */}
        {photoPreview && (
          <div
            style={{
              position: 'fixed',
              left: photoPreview.x,
              top: photoPreview.y,
              width: '650px',
              height: '650px',
              background: '#1e293b',
              border: '2px solid #475569',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            <img
              src={photoPreview.photoUrl}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        )}
        </div>
      </section>

      {/* Settings Blade */}
      {showSettings && (
        <aside className="details-blade">
          <div className="blade-header">
            <h3>Settings</h3>
            <button className="blade-close" onClick={() => setShowSettings(false)}>
              ×
            </button>
          </div>
          
          <div className="blade-content">
            <div className="blade-section">
              <h4>Appearance</h4>
              <div className="detail-field">
                <label>Line Type</label>
                <select 
                  value={lineType}
                  onChange={(e) => setLineType(e.target.value as 'straight' | 'curved' | 'rightAngled')}
                >
                  <option value="straight">Straight (Default)</option>
                  <option value="curved">Curved</option>
                  <option value="rightAngled">Right Angled</option>
                </select>
              </div>
              <div className="detail-field">
                <label>Grid Size (px)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  step="5"
                  value={gridSize}
                  onChange={(e) => setGridSize(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                />
              </div>
            </div>
            
            <div className="blade-section">
              <h4>Demo Information</h4>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                This is a demo family tree with all features enabled except export. All changes are stored locally and will be lost when you refresh the page.
              </p>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '8px' }}>
                To save your family trees permanently, please sign up for an account.
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Details Blade */}
      {selectedPerson && (
        <aside className="details-blade">
          <div className="blade-header">
            <h3>{getPersonLabel(selectedPerson).name}</h3>
            <button className="blade-close" onClick={() => setSelectedPerson(null)}>
              ×
            </button>
          </div>
          
          <div className="blade-content">
            <div className="blade-section">
              <h4>Personal Details</h4>
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
                <p className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                  Enter full date (YYYY-MM-DD), year and month (YYYY-MM), or just year (YYYY)
                </p>
              </div>
              <div className="detail-field">
                <label>Death Date</label>
                <input 
                  type="text" 
                  value={editingPerson.death_date || ''} 
                  onChange={(e) => setEditingPerson({ ...editingPerson, death_date: e.target.value })}
                  placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                />
                <p className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                  Enter full date (YYYY-MM-DD), year and month (YYYY-MM), or just year (YYYY)
                </p>
              </div>
            </div>

            <div className="blade-section">
              <h4>Relationships</h4>
              <div className="relationships-list">
                {relationships.filter(r => 
                  r.person1_id === selectedPerson.id || r.person2_id === selectedPerson.id
                ).map(rel => {
                  const otherId = rel.person1_id === selectedPerson.id ? rel.person2_id : rel.person1_id;
                  const otherPerson = personMap.get(otherId);
                  if (!otherPerson) return null;
                  return (
                    <div key={rel.id} className="relationship-item">
                      <div className="rel-person">{getPersonLabel(otherPerson).name}</div>
                      <div className="rel-type">{rel.type}</div>
                    </div>
                  );
                })}
                {relationships.filter(r => 
                  r.person1_id === selectedPerson.id || r.person2_id === selectedPerson.id
                ).length === 0 && (
                  <div className="muted">No relationships</div>
                )}
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
                p.id === nodeContextMenu.person.id
                  ? { ...p, gender: 'male' }
                  : p
              ));
              setNodeContextMenu(null);
            }}>
              Male
            </button>
            <button onClick={() => {
              setPeople(people.map(p =>
                p.id === nodeContextMenu.person.id
                  ? { ...p, gender: 'female' }
                  : p
              ));
              setNodeContextMenu(null);
            }}>
              Female
            </button>
            <button onClick={() => {
              setPeople(people.map(p =>
                p.id === nodeContextMenu.person.id
                  ? { ...p, gender: 'other' }
                  : p
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
              if (confirm(`Delete ${nodeContextMenu.person.first_name}? This will remove all relationships.`)) {
                deletePerson(nodeContextMenu.person.id);
              }
            }}
          >
            Delete Person
          </button>
        </div>
      )}
    </div>
  );
}
