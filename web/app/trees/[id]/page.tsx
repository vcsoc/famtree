"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useNotification } from "../../components/NotificationProvider";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

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

export default function TreeBuilderPage() {
  const params = useParams();
  const treeId = params?.id as string;

  const [token, setToken] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
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
  const [treeName, setTreeName] = useState("");
  const [forestId, setForestId] = useState("");
  const [forestName, setForestName] = useState("");
  const [treeStats, setTreeStats] = useState({
    males: 0,
    females: 0,
    other: 0,
    withImages: 0,
    parentChildRels: 0,
    spouseRels: 0,
    siblingRels: 0
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    birthDate: "",
    deathDate: ""
  });
  const [personImages, setPersonImages] = useState<Array<{id: string, image_url: string, is_primary: number}>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragOverPersonId, setDragOverPersonId] = useState<string | null>(null);
  const [isDraggingFamtree, setIsDraggingFamtree] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ personId: string; photoUrl: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const { showAlert, showConfirm, showCustomConfirm } = useNotification();

  // Keep refs in sync with state and persist to localStorage
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
    if (typeof window !== 'undefined' && treeId) {
      localStorage.setItem(`tree-${treeId}-zoom`, zoom.toString());
      localStorage.setItem(`tree-${treeId}-pan`, JSON.stringify(pan));
    }
  }, [zoom, pan, treeId]);

  // Load saved canvas position after mount
  useEffect(() => {
    if (typeof window !== 'undefined' && treeId) {
      const savedZoom = localStorage.getItem(`tree-${treeId}-zoom`);
      const savedPan = localStorage.getItem(`tree-${treeId}-pan`);
      
      if (savedZoom) {
        setZoom(parseFloat(savedZoom));
      }
      if (savedPan) {
        setPan(JSON.parse(savedPan));
      }
    }
  }, [treeId]);

  const personMap = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const getPhotoUrl = (photoUrl?: string) => {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http')) return photoUrl;
    return `${apiBase}${photoUrl}`;
  };

  useEffect(() => {
    const stored = localStorage.getItem("famtree_token");
    if (stored && treeId) {
      setToken(stored);
      loadTree(stored);
      loadPeople(stored);
      loadRelationships(stored);
    }
  }, [treeId]);

  // Calculate live statistics
  useEffect(() => {
    const males = people.filter(p => p.gender?.toLowerCase() === 'male').length;
    const females = people.filter(p => p.gender?.toLowerCase() === 'female').length;
    const other = people.length - males - females;
    const withImages = people.filter(p => p.photo_url).length;
    
    const parentChildRels = relationships.filter(r => r.type === 'parent-child').length;
    const spouseRels = relationships.filter(r => r.type === 'spouse' || r.type === 'ex-spouse').length;
    const siblingRels = relationships.filter(r => r.type === 'sibling').length;
    
    setTreeStats({
      males,
      females,
      other,
      withImages,
      parentChildRels,
      spouseRels,
      siblingRels
    });
  }, [people, relationships]);

  // Load images when person is selected
  useEffect(() => {
    if (selectedPerson) {
      setEditingPerson(selectedPerson);
      loadPersonImages(selectedPerson.id);
    } else {
      setPersonImages([]);
    }
  }, [selectedPerson]);

  const loadTree = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/trees/${treeId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTreeName(data.name || "");
        setForestId(data.forest_id || "");
        
        // Load forest name
        if (data.forest_id) {
          const forestRes = await fetch(`${apiBase}/api/forests/${data.forest_id}`, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          const forestData = await forestRes.json();
          if (forestRes.ok) {
            setForestName(forestData.name || "");
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPeople = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/people?treeId=${treeId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) setPeople(data.people || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRelationships = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/relationships?treeId=${treeId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) setRelationships(data.relationships || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPersonImages = async (personId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/people/${personId}/images`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPersonImages(data.images || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const uploadPersonImage = async (personId: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`${apiBase}/api/people/${personId}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        await loadPersonImages(personId);
        await loadPeople(token);
        if (selectedPerson && selectedPerson.id === personId) {
          setSelectedPerson({ ...selectedPerson, photo_url: data.photo_url });
        }
        return data;
      } else {
        showAlert('Failed to upload image', 'error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to upload image', 'error');
    }
  };

  const setPrimaryImage = async (personId: string, imageId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/people/${personId}/images/${imageId}/primary`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await loadPersonImages(personId);
        await loadPeople(token);
        if (selectedPerson && selectedPerson.id === personId) {
          const data = await res.json();
          setSelectedPerson({ ...selectedPerson, photo_url: data.photo_url });
        }
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to set primary image', 'error');
    }
  };

  const deletePersonImage = async (personId: string, imageId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/people/${personId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await loadPersonImages(personId);
        await loadPeople(token);
        if (selectedPerson && selectedPerson.id === personId) {
          const data = await res.json();
          setSelectedPerson({ ...selectedPerson, photo_url: data.photo_url });
        }
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to delete image', 'error');
    }
  };

  const exportFamTree = async () => {
    try {
      const res = await fetch(`${apiBase}/api/trees/${treeId}/export-famtree`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${treeName || 'tree'}.famtree`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showAlert('Tree exported successfully', 'success');
      } else {
        showAlert('Failed to export tree', 'error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to export tree', 'error');
    }
  };

  const importFamTree = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.famtree';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const confirmed = await showConfirm(
        'Import this .famtree file? This will add all people, relationships, and images to the current tree.'
      );
      
      if (!confirmed) return;
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch(`${apiBase}/api/trees/${treeId}/import-famtree`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        
        if (res.ok) {
          const data = await res.json();
          showAlert(`Import successful! Added ${data.imported.people} people, ${data.imported.relationships} relationships, ${data.imported.images} images`, 'success');
          loadPeople(token);
          loadRelationships(token);
        } else {
          const error = await res.json();
          showAlert(`Failed to import: ${error.error}`, 'error');
        }
      } catch (err) {
        console.error(err);
        showAlert('Failed to import tree', 'error');
      }
    };
    input.click();
  };

  const addPerson = async () => {
    if (!formData.firstName.trim()) return;

    try {
      const res = await fetch(`${apiBase}/api/people`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          treeId,
          firstName: formData.firstName,
          lastName: formData.lastName || undefined,
          gender: formData.gender || undefined,
          birthDate: formData.birthDate || undefined,
          deathDate: formData.deathDate || undefined,
          positionX: 200 + people.length * 40,
          positionY: 200 + people.length * 30
        })
      });

      if (res.ok) {
        setFormData({ firstName: "", lastName: "", gender: "", birthDate: "", deathDate: "" });
        setShowAddForm(false);
        loadPeople(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updatePersonPosition = async (personId: string, x: number, y: number) => {
    try {
      await fetch(`${apiBase}/api/people/${personId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ positionX: x, positionY: y })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateTreeName = async () => {
    if (!treeName.trim()) return;
    try {
      await fetch(`${apiBase}/api/trees/${treeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: treeName })
      });
    } catch (err) {
      console.error(err);
      showAlert('Failed to update tree name', 'error');
    }
  };

  const exportTree = async () => {
    try {
      const res = await fetch(`${apiBase}/api/trees/${treeId}/export?includeImages=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Convert to YAML format
      const yaml = convertToYAML(data);
      
      // Download file
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tree-${data.tree.name || treeId}-${new Date().toISOString().split('T')[0]}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showAlert('Failed to export tree', 'error');
    }
  };

  const importTree = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = parseYAML(text);
        
        // Add datetime suffix to tree name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        data.tree.name = `${data.tree.name} (${timestamp})`;
        
        const res = await fetch(`${apiBase}/api/trees/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            forestId: forestId || treeId,
            treeData: data
          })
        });
        
        if (res.ok) {
          showAlert('Tree imported successfully!', 'success');
          loadPeople(token);
          loadRelationships(token);
        } else {
          showAlert('Failed to import tree', 'error');
        }
      } catch (err) {
        console.error(err);
        showAlert('Failed to import tree', 'error');
      }
    };
    input.click();
  };

  const convertToYAML = (data: any): string => {
    // Simple YAML converter with base64 image support
    let yaml = `tree:\n`;
    yaml += `  id: ${data.tree.id}\n`;
    yaml += `  name: ${data.tree.name || 'Untitled'}\n`;
    yaml += `  created_at: ${data.tree.created_at}\n\n`;
    
    yaml += `people:\n`;
    for (const person of data.people) {
      yaml += `  - id: ${person.id}\n`;
      yaml += `    first_name: ${person.first_name || ''}\n`;
      if (person.middle_name) yaml += `    middle_name: ${person.middle_name}\n`;
      if (person.last_name) yaml += `    last_name: ${person.last_name}\n`;
      if (person.gender) yaml += `    gender: ${person.gender}\n`;
      if (person.birth_date) yaml += `    birth_date: ${person.birth_date}\n`;
      if (person.death_date) yaml += `    death_date: ${person.death_date}\n`;
      if (person.photo_url) yaml += `    photo_url: ${person.photo_url}\n`;
      yaml += `    position_x: ${person.position_x}\n`;
      yaml += `    position_y: ${person.position_y}\n`;
    }
    
    yaml += `\nrelationships:\n`;
    for (const rel of data.relationships) {
      yaml += `  - id: ${rel.id}\n`;
      yaml += `    person1_id: ${rel.person1_id}\n`;
      yaml += `    person2_id: ${rel.person2_id}\n`;
      yaml += `    type: ${rel.type}\n`;
    }
    
    // Add base64 encoded images if present
    if (data.images && Object.keys(data.images).length > 0) {
      yaml += `\nimages:\n`;
      for (const [filename, imageData] of Object.entries(data.images as Record<string, { original: string; thumbnail: string }>)) {
        yaml += `  ${filename}:\n`;
        yaml += `    original: ${imageData.original}\n`;
        yaml += `    thumbnail: ${imageData.thumbnail}\n`;
      }
    }
    
    return yaml;
  };

  const parseYAML = (yaml: string): any => {
    // Simple YAML parser for our specific format with images support
    const lines = yaml.split('\n');
    const data: any = { tree: {}, people: [], relationships: [] };
    let currentSection = '';
    let currentItem: any = null;
    let currentImageKey = '';
    const images: any = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      if (trimmed === 'tree:') {
        currentSection = 'tree';
      } else if (trimmed === 'people:') {
        currentSection = 'people';
      } else if (trimmed === 'relationships:') {
        currentSection = 'relationships';
      } else if (trimmed === 'images:') {
        currentSection = 'images';
      } else if (trimmed.startsWith('- ')) {
        if (currentItem) {
          if (currentSection === 'people') data.people.push(currentItem);
          if (currentSection === 'relationships') data.relationships.push(currentItem);
        }
        currentItem = {};
        const [key, ...valueParts] = trimmed.substring(2).split(':');
        const value = valueParts.join(':').trim();
        // Convert numeric strings to numbers
        currentItem[key.trim()] = isNaN(Number(value)) || value === '' ? value : Number(value);
      } else if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        if (currentSection === 'tree') {
          data.tree[key.trim()] = value;
        } else if (currentSection === 'images') {
          // Check indentation level on original line (not trimmed)
          const indentLevel = line.length - line.trimStart().length;
          if (indentLevel === 2 && trimmed.endsWith(':')) {
            // New image filename (2 spaces indentation, ends with colon)
            currentImageKey = key.trim();
            images[currentImageKey] = {};
          } else if (currentImageKey && indentLevel === 4) {
            // Image property (4 spaces indentation)
            images[currentImageKey][key.trim()] = value;
          }
        } else if (currentItem) {
          // Convert numeric strings to numbers
          currentItem[key.trim()] = isNaN(Number(value)) || value === '' ? value : Number(value);
        }
      }
    }
    
    if (currentItem) {
      if (currentSection === 'people') data.people.push(currentItem);
      if (currentSection === 'relationships') data.relationships.push(currentItem);
    }
    
    // Only add images if there are any
    if (Object.keys(images).length > 0) {
      data.images = images;
    }
    
    return data;
  };

  const createRelationship = async (from: string, to: string, type: string) => {
    try {
      const res = await fetch(`${apiBase}/api/relationships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ treeId, person1Id: from, person2Id: to, type })
      });

      if (res.ok) {
        loadRelationships(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteRelationship = async (relationshipId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/relationships/${relationshipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadRelationships(token);
        setContextMenu(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateRelationshipType = async (relationshipId: string, type: string) => {
    try {
      const res = await fetch(`${apiBase}/api/relationships/${relationshipId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        loadRelationships(token);
        setContextMenu(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deletePerson = async (personId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/people/${personId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadPeople(token);
        loadRelationships(token);
        setNodeContextMenu(null);
        setSelectedPerson(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updatePerson = async () => {
    if (!selectedPerson) return;
    try {
      // Transform snake_case to camelCase for API
      const payload: any = {};
      if (editingPerson.first_name !== undefined) {
        payload.firstName = editingPerson.first_name || undefined;
      }
      if (editingPerson.middle_name !== undefined) {
        payload.middleName = editingPerson.middle_name || undefined;
      }
      if (editingPerson.last_name !== undefined) {
        payload.lastName = editingPerson.last_name || undefined;
      }
      if (editingPerson.gender !== undefined) {
        payload.gender = editingPerson.gender || undefined;
      }
      if (editingPerson.birth_date !== undefined) {
        payload.birthDate = editingPerson.birth_date || undefined;
      }
      if (editingPerson.death_date !== undefined) {
        payload.deathDate = editingPerson.death_date || undefined;
      }
      
      // Remove undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });
      
      console.log('Update payload:', payload);
      
      const res = await fetch(`${apiBase}/api/people/${selectedPerson.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        loadPeople(token);
        setSelectedPerson(null);
        setEditingPerson({});
      } else {
        const data = await res.json();
        console.error('Update failed:', data);
        showAlert(`Failed to update: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to update person', 'error');
    }
  };

  const saveInlineEdit = async () => {
    if (!editingNodeId || !editingNodeName.trim()) {
      setEditingNodeId(null);
      return;
    }

    const parts = editingNodeName.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";

    try {
      await fetch(`${apiBase}/api/people/${editingNodeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ firstName, lastName })
      });
      loadPeople(token);
    } catch (err) {
      console.error(err);
    }

    setEditingNodeId(null);
    setEditingNodeName("");
  };

  const exportTreeAsPNG = async () => {
    if (people.length === 0) {
      showAlert('No people to export', 'error');
      return;
    }

    // Calculate bounding box
    const padding = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    people.forEach(person => {
      minX = Math.min(minX, person.position_x);
      minY = Math.min(minY, person.position_y);
      maxX = Math.max(maxX, person.position_x + 150);
      maxY = Math.max(maxY, person.position_y + 80);
    });

    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Create temporary container for export
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '0';
    exportContainer.style.top = '0';
    exportContainer.style.width = `${width}px`;
    exportContainer.style.height = `${height}px`;
    exportContainer.style.backgroundColor = '#0b1120';
    exportContainer.style.zIndex = '10000';
    exportContainer.style.overflow = 'hidden';
    document.body.appendChild(exportContainer);

    // Create SVG for export with repositioned elements
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    // Add relationships
    relationships.forEach(rel => {
      const from = personMap.get(rel.person1_id);
      const to = personMap.get(rel.person2_id);
      if (!from || !to) return;

      const relStyle = getRelationshipStyle(rel.type);
      const linePath = getLinePath(
        from.position_x + 75 - minX,
        from.position_y + 40 - minY,
        to.position_x + 75 - minX,
        to.position_y + 40 - minY
      );

      if (linePath.type === 'line') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(linePath.x1));
        line.setAttribute('y1', String(linePath.y1));
        line.setAttribute('x2', String(linePath.x2));
        line.setAttribute('y2', String(linePath.y2));
        line.setAttribute('stroke', relStyle.color);
        line.setAttribute('stroke-width', '2');
        if (relStyle.dashed) line.setAttribute('stroke-dasharray', '8 4');
        svg.appendChild(line);
      } else {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', linePath.d!);
        path.setAttribute('stroke', relStyle.color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        if (relStyle.dashed) path.setAttribute('stroke-dasharray', '8 4');
        svg.appendChild(path);
      }
    });

    exportContainer.appendChild(svg);

    // Add person nodes
    people.forEach(person => {
      const nodeDiv = document.createElement('div');
      nodeDiv.style.position = 'absolute';
      nodeDiv.style.left = `${person.position_x - minX}px`;
      nodeDiv.style.top = `${person.position_y - minY}px`;
      nodeDiv.style.width = '150px';
      nodeDiv.style.height = '80px';
      nodeDiv.style.background = '#1e293b';
      nodeDiv.style.border = '1px solid #334155';
      nodeDiv.style.borderRadius = '8px';
      nodeDiv.style.display = 'flex';
      nodeDiv.style.alignItems = 'center';
      nodeDiv.style.padding = '10px';
      nodeDiv.style.gap = '10px';

      // Photo/placeholder
      const photoDiv = document.createElement('div');
      photoDiv.style.width = '50px';
      photoDiv.style.height = '50px';
      photoDiv.style.borderRadius = '50%';
      photoDiv.style.flexShrink = '0';
      photoDiv.style.display = 'flex';
      photoDiv.style.alignItems = 'center';
      photoDiv.style.justifyContent = 'center';
      photoDiv.style.fontSize = '28px';
      photoDiv.style.fontWeight = '500';
      photoDiv.style.color = '#f8fafc';

      if (person.photo_url) {
        photoDiv.style.backgroundImage = `url(${person.photo_url})`;
        photoDiv.style.backgroundSize = 'cover';
        photoDiv.style.backgroundPosition = 'center';
      } else {
        photoDiv.style.background = person.death_date ? '#000000' : '#1e293b';
        const initials = `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`.toUpperCase();
        photoDiv.textContent = initials;
      }

      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1';
      infoDiv.style.minWidth = '0';

      const nameDiv = document.createElement('div');
      nameDiv.style.fontSize = '14px';
      nameDiv.style.fontWeight = '600';
      nameDiv.style.color = '#f8fafc';
      nameDiv.style.whiteSpace = 'nowrap';
      nameDiv.style.overflow = 'hidden';
      nameDiv.style.textOverflow = 'ellipsis';
      const displayName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
      nameDiv.textContent = displayName;

      const datesDiv = document.createElement('div');
      datesDiv.style.fontSize = '11px';
      datesDiv.style.color = '#94a3b8';
      datesDiv.style.marginTop = '4px';
      const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : '?';
      const deathYear = person.death_date ? new Date(person.death_date).getFullYear() : '';
      datesDiv.textContent = deathYear ? `${birthYear}–${deathYear}` : String(birthYear);

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(datesDiv);

      nodeDiv.appendChild(photoDiv);
      nodeDiv.appendChild(infoDiv);
      
      exportContainer.appendChild(nodeDiv);
    });

    // Use html2canvas - wait for render
    try {
      // Small delay to ensure DOM is rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const html2canvas = await import('html2canvas');
      const canvasEl = await html2canvas.default(exportContainer, {
        backgroundColor: '#0b1120',
        scale: 2,
        useCORS: true,
        logging: false,
        width: width,
        height: height
      });

      document.body.removeChild(exportContainer);

      const link = document.createElement('a');
      link.download = `${treeName || 'family-tree'}.png`;
      link.href = canvasEl.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export error:', err);
      if (document.body.contains(exportContainer)) {
        document.body.removeChild(exportContainer);
      }
      showAlert('Failed to export PNG', 'error');
    }
  };

  const exportTreeAsSVG = () => {
    if (people.length === 0) {
      showAlert('No people to export', 'error');
      return;
    }

    // Calculate bounding box
    const padding = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    people.forEach(person => {
      minX = Math.min(minX, person.position_x);
      minY = Math.min(minY, person.position_y);
      maxX = Math.max(maxX, person.position_x + 150);
      maxY = Math.max(maxY, person.position_y + 80);
    });

    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Helper to offset coordinates
    const offsetX = (x: number) => x - minX;
    const offsetY = (y: number) => y - minY;

    // Create SVG with all elements
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .person-node { font-family: system-ui, -apple-system, sans-serif; }
      .person-name { font-size: 14px; font-weight: 600; fill: #f8fafc; }
      .person-dates { font-size: 11px; fill: #94a3b8; }
      .photo-placeholder { fill: #1e293b; }
      .photo-placeholder.deceased { fill: #000000; }
      .photo-text { fill: #f8fafc; font-size: 28px; font-weight: 500; text-anchor: middle; dominant-baseline: middle; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="#0b1120"/>
  
  <!-- Relationships -->
  <g class="relationships">`;

    // Add relationship lines
    relationships.forEach(rel => {
      const from = personMap.get(rel.person1_id);
      const to = personMap.get(rel.person2_id);
      if (!from || !to) return;

      const relStyle = getRelationshipStyle(rel.type);
      
      // Calculate offset coordinates for line path
      const x1 = offsetX(from.position_x + 75);
      const y1 = offsetY(from.position_y + 40);
      const x2 = offsetX(to.position_x + 75);
      const y2 = offsetY(to.position_y + 40);
      
      const linePath = getLinePath(x1, y1, x2, y2);

      if (linePath.type === 'line') {
        svgContent += `
    <line x1="${linePath.x1}" y1="${linePath.y1}" x2="${linePath.x2}" y2="${linePath.y2}" 
          stroke="${relStyle.color}" stroke-width="2" 
          stroke-dasharray="${relStyle.dashed ? '8 4' : 'none'}" />`;
      } else {
        svgContent += `
    <path d="${linePath.d}" stroke="${relStyle.color}" stroke-width="2" 
          fill="none" stroke-dasharray="${relStyle.dashed ? '8 4' : 'none'}" />`;
      }
    });

    svgContent += `
  </g>
  
  <!-- People -->
  <g class="people">`;

    // Add person nodes
    people.forEach(person => {
      const x = offsetX(person.position_x);
      const y = offsetY(person.position_y);
      const isDeceased = person.death_date;
      const initials = `${person.first_name?.[0] || ''}${person.last_name?.[0] || ''}`.toUpperCase();

      svgContent += `
    <g class="person-node" transform="translate(${x}, ${y})">
      <rect width="150" height="80" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      
      <!-- Photo/Placeholder -->`;
      
      if (person.photo_url) {
        svgContent += `
      <clipPath id="clip-${person.id}">
        <circle cx="35" cy="35" r="25"/>
      </clipPath>
      <image x="10" y="10" width="50" height="50" href="${person.photo_url}" 
             clip-path="url(#clip-${person.id})" preserveAspectRatio="xMidYMid slice"/>`;
      } else {
        svgContent += `
      <circle cx="35" cy="35" r="25" class="photo-placeholder${isDeceased ? ' deceased' : ''}"/>
      <text x="35" y="35" class="photo-text">${initials}</text>`;
      }

      const displayName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
      const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : '?';
      const deathYear = person.death_date ? new Date(person.death_date).getFullYear() : '';
      const dates = deathYear ? `${birthYear}–${deathYear}` : birthYear;
      
      // Truncate name if too long (max ~10 chars for the space available)
      const maxNameLength = 12;
      const truncatedName = displayName.length > maxNameLength ? displayName.substring(0, maxNameLength) + '...' : displayName;

      svgContent += `
      
      <!-- Name -->
      <text x="70" y="28" class="person-name" textLength="${Math.min(truncatedName.length * 8, 70)}" lengthAdjust="spacingAndGlyphs">${truncatedName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
      
      <!-- Dates -->
      <text x="70" y="45" class="person-dates">${dates}</text>
      
      <!-- Gender indicator -->
      <circle cx="140" cy="70" r="4" fill="${person.gender === 'male' ? '#60a5fa' : person.gender === 'female' ? '#f472b6' : '#a78bfa'}"/>
    </g>`;
    });

    svgContent += `
  </g>
</svg>`;

    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `${treeName || 'family-tree'}.svg`;
    link.click();
    URL.revokeObjectURL(svgUrl);
  };

  const getBoardPoint = (event: React.PointerEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const point = getBoardPoint(event);
    setMouse(point);

    if (isPanning) {
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: event.clientX, y: event.clientY });
      return;
    }

    // Handle area selection
    if (isSelecting && selectionStart) {
      setSelectionEnd(point);
      
      // Select nodes in real-time as user drags
      const minX = Math.min(selectionStart.x, point.x);
      const maxX = Math.max(selectionStart.x, point.x);
      const minY = Math.min(selectionStart.y, point.y);
      const maxY = Math.max(selectionStart.y, point.y);
      
      const selected = new Set<string>();
      people.forEach(person => {
        // Check if node bounds intersect with selection box
        const nodeLeft = person.position_x;
        const nodeRight = person.position_x + 150;
        const nodeTop = person.position_y;
        const nodeBottom = person.position_y + 80;
        
        if (nodeLeft <= maxX && nodeRight >= minX && nodeTop <= maxY && nodeBottom >= minY) {
          selected.add(person.id);
        }
      });
      
      setSelectedNodes(selected);
      return;
    }

    // Check if we should start dragging based on threshold
    if (dragStart && !dragging) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only start dragging if moved more than 5 pixels
      if (distance > 5) {
        setDragging(dragStart.personId);
        setIsDraggingNodes(true);
      }
      return;
    }

    if (!dragging) return;

    // Snap to grid helper
    const snapToGrid = (value: number) => Math.round(value / gridSize) * gridSize;

    // If dragging a selected node, move all selected nodes
    if (selectedNodes.has(dragging)) {
      const draggedPerson = personMap.get(dragging);
      if (!draggedPerson) return;
      
      const newX = snapToGrid(point.x - 75);
      const newY = snapToGrid(point.y - 40);
      const dx = newX - draggedPerson.position_x;
      const dy = newY - draggedPerson.position_y;
      
      setPeople((prev) =>
        prev.map((p) => {
          if (selectedNodes.has(p.id)) {
            return { ...p, position_x: p.position_x + dx, position_y: p.position_y + dy };
          }
          return p;
        })
      );
    } else {
      // Single node drag with grid snapping
      const newX = snapToGrid(point.x - 75);
      const newY = snapToGrid(point.y - 40);
      setPeople((prev) =>
        prev.map((p) =>
          p.id === dragging ? { ...p, position_x: newX, position_y: newY } : p
        )
      );
    }
  };

  const handlePointerUp = async (event: React.PointerEvent) => {
    // Mark that we just completed a selection to prevent onClick from clearing it
    if (isSelecting) {
      setJustCompletedSelection(true);
      setTimeout(() => setJustCompletedSelection(false), 50);
    }

    if (dragging) {
      // Update position for all selected nodes if dragging multiple
      if (selectedNodes.has(dragging)) {
        for (const nodeId of selectedNodes) {
          const person = personMap.get(nodeId);
          if (person) {
            updatePersonPosition(nodeId, person.position_x, person.position_y);
          }
        }
      } else {
        // Update single node
        const person = personMap.get(dragging);
        if (person) {
          updatePersonPosition(dragging, person.position_x, person.position_y);
        }
      }
    }

    const targetId = (event.target as HTMLElement)?.dataset?.personId;
    
    // If linking from a node and dropped on empty space, create new person
    if (linkingFrom && !targetId) {
      const point = getBoardPoint(event);
      try {
        const res = await fetch(`${apiBase}/api/people`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            treeId,
            firstName: "New Person",
            positionX: point.x - 75,
            positionY: point.y - 40
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          await createRelationship(linkingFrom, data.id, "parent-child");
          await loadPeople(token);
          // Start inline editing for new person
          setEditingNodeId(data.id);
          setEditingNodeName("New Person");
        }
      } catch (err) {
        console.error(err);
      }
    } else if (linkingFrom && targetId && linkingFrom !== targetId) {
      createRelationship(linkingFrom, targetId, "parent-child");
    }

    // Handle midpoint linking (for children)
    if (linkingFromMidpoint && targetId) {
      const parent1 = linkingFromMidpoint.rel.person1_id;
      const parent2 = linkingFromMidpoint.rel.person2_id;
      // Create parent-child relationships from both parents to the child
      if (targetId !== parent1 && targetId !== parent2) {
        createRelationship(parent1, targetId, "parent-child");
        createRelationship(parent2, targetId, "parent-child");
      }
    }

    setDragging(null);
    setDragStart(null);
    setIsDraggingNodes(false);
    setLinkingFrom(null);
    setLinkingFromMidpoint(null);
    setIsPanning(false);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const getPersonLabel = (person: Person) => {
    const name = `${person.first_name} ${person.last_name || ""}`.trim();
    const dates = person.birth_date ? `b. ${person.birth_date.split("-")[0]}` : "";
    return { name, dates };
  };

  const getLinePath = (x1: number, y1: number, x2: number, y2: number) => {
    if (lineType === 'straight') {
      return { type: 'line' as const, x1, y1, x2, y2 };
    } else if (lineType === 'curved') {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curvature = Math.min(dist / 3, 100);
      return {
        type: 'path' as const,
        d: `M ${x1} ${y1} Q ${midX} ${midY - curvature} ${x2} ${y2}`
      };
    } else { // rightAngled
      const midX = (x1 + x2) / 2;
      return {
        type: 'path' as const,
        d: `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
      };
    }
  };

  const getRelationshipStyle = (type: string) => {
    const styles = {
      'parent-child': { color: '#38bdf8', hoverColor: '#7dd3fc', dashed: false }, // cyan
      'spouse': { color: '#f472b6', hoverColor: '#f9a8d4', dashed: false }, // pink
      'sibling': { color: '#a78bfa', hoverColor: '#c4b5fd', dashed: false }, // purple
      'ex-spouse': { color: '#94a3b8', hoverColor: '#cbd5e1', dashed: true }, // gray, dashed
      'other': { color: '#fbbf24', hoverColor: '#fcd34d', dashed: false } // amber
    };
    return styles[type as keyof typeof styles] || styles.other;
  };

  return (
    <div className="tree-builder-layout">
      {/* Left Sidebar */}
      <aside className="tree-sidebar">
        <div style={{ marginBottom: "16px" }}>
          {forestId && (
            <a 
              href={`/forests/${forestId}`} 
              style={{ 
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#22d3ee",
                fontSize: "14px",
                textDecoration: "none",
                marginBottom: "8px"
              }}
            >
              ← {forestName || "Back to Forest"}
            </a>
          )}
          <h2 style={{ margin: "8px 0" }}>Family Tree</h2>
          {treeName && <p className="muted" style={{ fontSize: "14px", margin: "4px 0" }}>{treeName}</p>}
        </div>

        {/* Live Statistics */}
        <div style={{ 
          background: "#0f172a", 
          border: "1px solid #1f2937",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "16px"
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
        </div>
        
        <div className="zoom-controls">
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

        <button className="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "+ Add Person"}
        </button>
        
        <button className="secondary" onClick={() => setShowSettings(!showSettings)}>
          ⚙ Settings
        </button>

        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "#94a3b8" }}>Export</h3>
          <button className="secondary" onClick={exportTreeAsPNG} style={{ width: "100%", marginBottom: "8px" }}>
            📷 Export as PNG
          </button>
          <button className="secondary" onClick={exportTreeAsSVG} style={{ width: "100%" }}>
            📐 Export as SVG
          </button>
        </div>

        {showAddForm && (
          <div className="sidebar-form">
            <input
              placeholder="First name *"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
            <input
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
            <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Birth date (YYYY, YYYY-MM, or YYYY-MM-DD)"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            />
            <input
              type="text"
              placeholder="Death date (YYYY, YYYY-MM, or YYYY-MM-DD)"
              value={formData.deathDate}
              onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
            />
            <button className="primary" onClick={addPerson}>
              Add to tree
            </button>
          </div>
        )}
      </aside>

      {/* Main Canvas */}
      <section
        ref={boardRef}
        className="tree-canvas"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Check if dragging .famtree file
          const items = e.dataTransfer.items;
          for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'application/json' || items[i].type === '') {
              const file = e.dataTransfer.files[0];
              if (file && file.name.endsWith('.famtree')) {
                setIsDraggingFamtree(true);
                return;
              }
            }
          }
        }}
        onDragLeave={() => {
          setIsDraggingFamtree(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingFamtree(false);
          
          const files = Array.from(e.dataTransfer.files);
          
          // Check for .famtree file first
          const famtreeFile = files.find(f => f.name.endsWith('.famtree'));
          if (famtreeFile) {
            showCustomConfirm(
              `Import "${famtreeFile.name}"?`,
              [
                {
                  label: 'Overwrite Current Tree',
                  variant: 'danger',
                  onClick: async () => {
                    try {
                      const formData = new FormData();
                      formData.append('file', famtreeFile);
                      
                      const res = await fetch(`${apiBase}/api/trees/${treeId}/import-famtree?mode=overwrite`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData
                      });
                      
                      if (res.ok) {
                        const data = await res.json();
                        showAlert(`Import successful! Imported ${data.imported.people} people, ${data.imported.relationships} relationships, ${data.imported.images} images`, 'success');
                        // Reload the page to ensure all images and data are fresh
                        setTimeout(() => {
                          window.location.reload();
                        }, 1500);
                      } else {
                        const error = await res.json();
                        showAlert(`Failed to import: ${error.error}`, 'error');
                      }
                    } catch (err) {
                      console.error(err);
                      showAlert('Failed to import tree', 'error');
                    }
                  }
                },
                {
                  label: 'Create New Tree',
                  variant: 'primary',
                  onClick: async () => {
                    try {
                      const formData = new FormData();
                      formData.append('file', famtreeFile);
                      
                      const res = await fetch(`${apiBase}/api/forests/${forestId}/import-famtree-new`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData
                      });
                      
                      if (res.ok) {
                        const data = await res.json();
                        showAlert(`Import successful! Created "${data.treeName}" with ${data.imported.people} people`, 'success');
                        // Redirect to new tree
                        setTimeout(() => {
                          window.location.href = `/trees/${data.treeId}`;
                        }, 1500);
                      } else {
                        const error = await res.json();
                        showAlert(`Failed to import: ${error.error}`, 'error');
                      }
                    } catch (err) {
                      console.error(err);
                      showAlert('Failed to import tree', 'error');
                    }
                  }
                },
                {
                  label: 'Cancel',
                  variant: 'secondary',
                  onClick: () => {}
                }
              ]
            );
            return;
          }
          
          // Otherwise check for YAML file
          const yamlFile = files.find(f => f.name.endsWith('.yaml') || f.name.endsWith('.yml'));
          
          if (yamlFile) {
            try {
              const text = await yamlFile.text();
              const data = parseYAML(text);
              
              console.log('Parsed YAML data:', data);
              
              // Add datetime suffix to tree name
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
              data.tree.name = `${data.tree.name} (${timestamp})`;
              
              const payload = {
                forestId: forestId || treeId,
                treeData: data
              };
              
              console.log('Sending import payload:', payload);
              
              const res = await fetch(`${apiBase}/api/trees/import`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
              });
              
              if (res.ok) {
                showAlert('Tree imported successfully from drag & drop!', 'success');
                loadPeople(token);
                loadRelationships(token);
              } else {
                const errorData = await res.json();
                console.error('Import error:', errorData);
                showAlert(`Failed to import tree: ${errorData.error || 'Unknown error'}`, 'error');
              }
            } catch (err) {
              console.error('Import exception:', err);
              showAlert('Failed to import tree from dropped file', 'error');
            }
          }
        }}
        onPointerDown={(e) => {
          // Start area selection with shift + left click
          if (e.shiftKey && e.button === 0) {
            const point = getBoardPoint(e);
            setIsSelecting(true);
            setSelectionStart(point);
            setSelectionEnd(point);
            return;
          }
          
          // Start panning with middle mouse button or CTRL + left click
          if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
          }
        }}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const rect = boardRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          // Mouse position relative to canvas
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          // Use refs to get current values
          const currentZoom = zoomRef.current;
          const currentPan = panRef.current;
          
          // World coordinates before zoom
          const worldX = (mouseX - currentPan.x) / currentZoom;
          const worldY = (mouseY - currentPan.y) / currentZoom;
          
          // Calculate new zoom
          const delta = e.deltaY > 0 ? -0.05 : 0.05;
          const newZoom = Math.max(0.3, Math.min(3, currentZoom + delta));
          
          // Calculate new pan to keep world coordinates under mouse
          const newPanX = mouseX - worldX * newZoom;
          const newPanY = mouseY - worldY * newZoom;
          
          // Update both states
          setZoom(newZoom);
          setPan({ x: newPanX, y: newPanY });
        }}
        onClick={(e) => {
          if (justCompletedSelection) return;
          if (e.target === boardRef.current || (e.target as HTMLElement).tagName === 'svg') {
            setSelectedPerson(null);
            setContextMenu(null);
            setNodeContextMenu(null);
            setSelectedNodes(new Set());
          }
        }}
        onContextMenu={(e) => {
          if (e.target === boardRef.current) {
            setContextMenu(null);
          }
        }}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        <div
          className="canvas-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
        {/* Grid overlay - only show when dragging nodes */}
        {isDraggingNodes && (
          <svg 
            className="grid-overlay" 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0.3,
              zIndex: 0,
              overflow: 'visible'
            }}
          >
            <defs>
              <pattern 
                id="grid" 
                width={gridSize} 
                height={gridSize} 
                patternUnits="userSpaceOnUse"
              >
                <path 
                  d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} 
                  fill="none" 
                  stroke="#6366f1" 
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100000" height="100000" x="-50000" y="-50000" fill="url(#grid)" />
          </svg>
        )}
        
        {isDraggingFamtree && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '4px dashed var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            pointerEvents: 'none'
          }}>
            <div style={{
              background: 'var(--bg)',
              padding: '32px 48px',
              borderRadius: '12px',
              border: '2px solid var(--accent)',
              fontSize: '24px',
              fontWeight: '600',
              color: 'var(--accent)'
            }}>
              ⬇ Drop .famtree file to import
            </div>
          </div>
        )}
        
        <svg className="tree-links">{relationships.map((rel) => {
            const from = personMap.get(rel.person1_id);
            const to = personMap.get(rel.person2_id);
            if (!from || !to) return null;
            const midX = (from.position_x + 75 + to.position_x + 75) / 2;
            const midY = (from.position_y + 40 + to.position_y + 40) / 2;
            const isHovered = hoveredRel === rel.id;
            const relStyle = getRelationshipStyle(rel.type);
            const linePath = getLinePath(
              from.position_x + 75,
              from.position_y + 40,
              to.position_x + 75,
              to.position_y + 40
            );
            return (
              <g key={rel.id} style={{ pointerEvents: 'all' }}>
                {/* Visible line */}
                {linePath.type === 'line' ? (
                  <line
                    x1={linePath.x1}
                    y1={linePath.y1}
                    x2={linePath.x2}
                    y2={linePath.y2}
                    stroke={isHovered ? relStyle.hoverColor : relStyle.color}
                    strokeWidth={isHovered ? "4" : "2"}
                    strokeDasharray={relStyle.dashed ? "8 4" : "none"}
                    fill="none"
                    pointerEvents="stroke"
                    style={{ transition: 'all 0.15s ease' }}
                  />
                ) : (
                  <path
                    d={linePath.d}
                    stroke={isHovered ? relStyle.hoverColor : relStyle.color}
                    strokeWidth={isHovered ? "4" : "2"}
                    strokeDasharray={relStyle.dashed ? "8 4" : "none"}
                    fill="none"
                    pointerEvents="stroke"
                    style={{ transition: 'all 0.15s ease' }}
                  />
                )}
                {/* Invisible wider line for easier clicking */}
                {linePath.type === 'line' ? (
                  <line
                    x1={linePath.x1}
                    y1={linePath.y1}
                    x2={linePath.x2}
                    y2={linePath.y2}
                    stroke="transparent"
                    strokeWidth="12"
                    fill="none"
                    pointerEvents="stroke"
                    style={{ cursor: 'context-menu' }}
                    onMouseEnter={() => setHoveredRel(rel.id)}
                    onMouseLeave={() => setHoveredRel(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = boardRef.current?.getBoundingClientRect();
                      setContextMenu({
                        rel,
                        x: e.clientX - (rect?.left || 0),
                        y: e.clientY - (rect?.top || 0)
                      });
                    }}
                  />
                ) : (
                  <path
                    d={linePath.d}
                    stroke="transparent"
                    strokeWidth="12"
                    fill="none"
                    pointerEvents="stroke"
                    style={{ cursor: 'context-menu' }}
                    onMouseEnter={() => setHoveredRel(rel.id)}
                    onMouseLeave={() => setHoveredRel(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = boardRef.current?.getBoundingClientRect();
                      setContextMenu({
                        rel,
                        x: e.clientX - (rect?.left || 0),
                        y: e.clientY - (rect?.top || 0)
                      });
                    }}
                  />
                )}
                {/* Midpoint + button for adding children */}
                <g
                  style={{ cursor: linkingFromMidpoint?.rel.id === rel.id ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setLinkingFromMidpoint({ rel, x: midX, y: midY });
                  }}
                  pointerEvents="all"
                >
                  <circle
                    cx={midX}
                    cy={midY}
                    r="14"
                    fill="#1e293b"
                    stroke="#a78bfa"
                    strokeWidth="2"
                    pointerEvents="all"
                  />
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#a78bfa"
                    fontSize="20"
                    fontWeight="bold"
                    style={{ userSelect: 'none' }}
                    pointerEvents="none"
                  >
                    +
                  </text>
                </g>
              </g>
            );
          })}
          {linkingFrom && (() => {
            const from = personMap.get(linkingFrom);
            if (!from) return null;
            return (
              <line
                x1={from.position_x + 75}
                y1={from.position_y + 40}
                x2={mouse.x}
                y2={mouse.y}
                stroke="#a78bfa"
                strokeDasharray="6 4"
                strokeWidth="2"
              />
            );
          })()}
          {linkingFromMidpoint && (
            <line
              x1={linkingFromMidpoint.x}
              y1={linkingFromMidpoint.y}
              x2={mouse.x}
              y2={mouse.y}
              stroke="#a78bfa"
              strokeDasharray="6 4"
              strokeWidth="2"
            />
          )}
        </svg>

        {people.map((person) => {
          const { name, dates } = getPersonLabel(person);
          return (
            <div
              key={person.id}
              className={`tree-person ${selectedNodes.has(person.id) ? 'selected' : ''} ${dragOverPersonId === person.id ? 'drag-over' : ''}`}
              data-person-id={person.id}
              style={{ left: person.position_x, top: person.position_y }}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverPersonId(person.id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) {
                  setDragOverPersonId(null);
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverPersonId(null);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  await uploadPersonImage(person.id, file);
                }
              }}
              onPointerDown={(e) => {
                // Handle shift-click for multi-select
                if (e.shiftKey) {
                  e.stopPropagation();
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
                
                // Only drag on left mouse button
                if (e.button === 0) {
                  e.preventDefault();
                  setDragStart({ x: e.clientX, y: e.clientY, personId: person.id });
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const menuWidth = 200;
                const menuHeight = 100;
                let x = e.clientX + 10; // 10px to the right of cursor
                let y = e.clientY;
                
                // Check if menu goes off right edge of window
                if (x + menuWidth > window.innerWidth) {
                  x = e.clientX - menuWidth - 10; // Position to the left instead
                }
                
                // Check if menu goes off bottom edge of window
                if (y + menuHeight > window.innerHeight) {
                  y = window.innerHeight - menuHeight - 10;
                }
                
                setNodeContextMenu({ person, x, y });
              }}
            >
              <div className="person-photo">
                {person.photo_url ? (
                  <>
                    <img src={getPhotoUrl(person.photo_url) || ''} alt={name} />
                    <div 
                      className="photo-zoom-icon"
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        const previewWidth = 650;
                        const previewHeight = 650;
                        const padding = 10;
                        
                        let x = e.clientX + padding;
                        let y = e.clientY + padding;

                        // Check right edge
                        if (x + previewWidth > window.innerWidth - padding) {
                          x = e.clientX - previewWidth - padding;
                        }
                        
                        // Check bottom edge
                        if (y + previewHeight > window.innerHeight - padding) {
                          y = e.clientY - previewHeight - padding;
                        }
                        
                        // Check left edge
                        if (x < padding) {
                          x = padding;
                        }
                        
                        // Check top edge
                        if (y < padding) {
                          y = padding;
                        }

                        setPhotoPreview({
                          personId: person.id,
                          photoUrl: getPhotoUrl(person.photo_url) || '',
                          x,
                          y
                        });
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation();
                        if (photoPreview?.personId === person.id) {
                          const previewWidth = 650;
                          const previewHeight = 650;
                          const padding = 10;
                          
                          let x = e.clientX + padding;
                          let y = e.clientY + padding;

                          // Check right edge
                          if (x + previewWidth > window.innerWidth - padding) {
                            x = e.clientX - previewWidth - padding;
                          }
                          
                          // Check bottom edge
                          if (y + previewHeight > window.innerHeight - padding) {
                            y = e.clientY - previewHeight - padding;
                          }
                          
                          // Check left edge
                          if (x < padding) {
                            x = padding;
                          }
                          
                          // Check top edge
                          if (y < padding) {
                            y = padding;
                          }

                          setPhotoPreview({
                            personId: person.id,
                            photoUrl: getPhotoUrl(person.photo_url) || '',
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
                  <div className={`photo-placeholder ${person.gender === 'female' ? 'female' : ''} ${person.death_date ? 'deceased' : ''}`}>{person.first_name[0]}</div>
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
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y)
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
              <h4>Tree Settings</h4>
              <div className="detail-field">
                <label>Tree Name</label>
                <input
                  type="text"
                  value={treeName}
                  onChange={(e) => setTreeName(e.target.value)}
                  onBlur={updateTreeName}
                  placeholder="Enter tree name"
                />
              </div>
            </div>
            
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
              <h4>Backup & Restore</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="primary" onClick={exportFamTree}>
                  ⬇ Export as .famtree
                </button>
                <button className="primary" onClick={importFamTree}>
                  ⬆ Import .famtree
                </button>
                <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }}></div>
                <button className="secondary" onClick={exportTree}>
                  ↓ Export Tree to YAML
                </button>
                <button className="secondary" onClick={importTree}>
                  ↑ Import Tree from YAML
                </button>
              </div>
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
              <h4>Photos</h4>
              <div className="detail-field">
                <label>Profile Pictures</label>
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => {
                    setIsDraggingOver(false);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      await uploadPersonImage(selectedPerson.id, file);
                    }
                  }}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    padding: '16px',
                    background: isDraggingOver ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.05)',
                    border: `2px ${isDraggingOver ? 'solid' : 'dashed'} ${isDraggingOver ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Image Gallery */}
                  {personImages.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      {personImages.map((img) => (
                        <div 
                          key={img.id}
                          style={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: img.is_primary ? '3px solid var(--accent)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => setPrimaryImage(selectedPerson.id, img.id)}
                        >
                          <img 
                            src={getPhotoUrl(img.image_url) || ''} 
                            alt="Profile"
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover'
                            }}
                          />
                          {img.is_primary && (
                            <div style={{
                              position: 'absolute',
                              top: '4px',
                              left: '4px',
                              background: 'var(--accent)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600'
                            }}>
                              PRIMARY
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePersonImage(selectedPerson.id, img.id);
                            }}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: 'rgba(239, 68, 68, 0.9)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              opacity: 0.8,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Zone */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '20px',
                    background: 'rgba(148, 163, 184, 0.05)',
                    borderRadius: '6px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      textAlign: 'center'
                    }}>
                      {isDraggingOver ? 'Drop image here' : 'Drag & drop images here or click to upload'}
                    </div>
                    <label 
                      htmlFor="photo-upload" 
                      style={{ 
                        cursor: 'pointer',
                        padding: '8px 16px',
                        background: 'var(--accent)',
                        color: 'var(--text)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        textAlign: 'center'
                      }}
                    >
                      Choose File
                    </label>
                  </div>

                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await uploadPersonImage(selectedPerson.id, file);
                        e.target.value = '';
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </div>
            
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
            <button onClick={async () => {
              try {
                await fetch(`${apiBase}/api/people/${nodeContextMenu.person.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ gender: 'male' })
                });
                loadPeople(token);
                setNodeContextMenu(null);
              } catch (err) {
                console.error(err);
              }
            }}>
              Male
            </button>
            <button onClick={async () => {
              try {
                await fetch(`${apiBase}/api/people/${nodeContextMenu.person.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ gender: 'female' })
                });
                loadPeople(token);
                setNodeContextMenu(null);
              } catch (err) {
                console.error(err);
              }
            }}>
              Female
            </button>
            <button onClick={async () => {
              try {
                await fetch(`${apiBase}/api/people/${nodeContextMenu.person.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ gender: 'other' })
                });
                loadPeople(token);
                setNodeContextMenu(null);
              } catch (err) {
                console.error(err);
              }
            }}>
              Other
            </button>
          </div>
          <div className="context-menu-divider"></div>
          <button
            className="context-menu-delete"
            onClick={async () => {
              const confirmed = await showConfirm(
                `Delete ${nodeContextMenu.person.first_name}? This will remove all relationships.`
              );
              if (confirmed) {
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
