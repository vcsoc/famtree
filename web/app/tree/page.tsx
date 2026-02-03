"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PersonNode = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type Link = {
  id: string;
  from: string;
  to: string;
};

const createId = () => crypto.randomUUID();

export default function FamilyTreePage() {
  const [nodes, setNodes] = useState<PersonNode[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes([{ id: createId(), name: "You", x: 120, y: 140 }]);
  }, []);

  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  const addNode = () => {
    if (!name.trim()) {
      return;
    }
    setNodes((prev) => [
      ...prev,
      {
        id: createId(),
        name: name.trim(),
        x: 160 + prev.length * 30,
        y: 200 + prev.length * 20
      }
    ]);
    setName("");
  };

  const getBoardPoint = (event: React.PointerEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: event.clientX, y: event.clientY };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const point = getBoardPoint(event);
    setMouse(point);
    if (!dragging) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === dragging
          ? { ...node, x: point.x - 60, y: point.y - 30 }
          : node
      )
    );
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const targetId = (event.target as HTMLElement)?.dataset?.nodeId;
    if (linkingFrom && targetId && linkingFrom !== targetId) {
      setLinks((prev) => [
        ...prev,
        { id: createId(), from: linkingFrom, to: targetId }
      ]);
    }
    setDragging(null);
    setLinkingFrom(null);
  };

  return (
    <div className="container">
      <section className="panel">
        <h2>Family Tree Builder</h2>
        <p className="muted">
          Add people, drag nodes to position them, and drag the connector to
          create a relationship link.
        </p>
        <div className="tree-controls">
          <input
            placeholder="Person name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="primary" onClick={addNode}>
            Add person
          </button>
          <span className="muted">Links: {links.length}</span>
        </div>
      </section>

      <section
        ref={boardRef}
        className="tree-board"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg className="tree-links">
          {links.map((link) => {
            const from = nodeMap.get(link.from);
            const to = nodeMap.get(link.to);
            if (!from || !to) return null;
            return (
              <line
                key={link.id}
                x1={from.x + 60}
                y1={from.y + 30}
                x2={to.x + 60}
                y2={to.y + 30}
                stroke="#38bdf8"
                strokeWidth="2"
              />
            );
          })}
          {linkingFrom ? (() => {
            const from = nodeMap.get(linkingFrom);
            if (!from) return null;
            return (
              <line
                x1={from.x + 60}
                y1={from.y + 30}
                x2={mouse.x}
                y2={mouse.y}
                stroke="#a78bfa"
                strokeDasharray="6 4"
                strokeWidth="2"
              />
            );
          })() : null}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className="tree-node"
            data-node-id={node.id}
            style={{ left: node.x, top: node.y }}
            onPointerDown={() => setDragging(node.id)}
          >
            <div className="node-name" data-node-id={node.id}>
              {node.name}
            </div>
            <button
              className="node-link"
              data-node-id={node.id}
              onPointerDown={(event) => {
                event.stopPropagation();
                setLinkingFrom(node.id);
              }}
            >
              +
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
