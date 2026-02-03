"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4001";

export default function PersonPage() {
  const params = useParams();
  const personId = params?.id as string;

  const [token, setToken] = useState("");
  const [person, setPerson] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [eventData, setEventData] = useState({ type: "", title: "", description: "", eventDate: "", location: "" });
  const [storyData, setStoryData] = useState({ title: "", content: "" });

  useEffect(() => {
    const stored = localStorage.getItem("famtree_token");
    if (stored && personId) {
      setToken(stored);
      loadPerson(stored);
      loadEvents(stored);
      loadStories(stored);
    }
  }, [personId]);

  const loadPerson = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/people?treeId=temp`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        const found = data.people?.find((p: any) => p.id === personId);
        if (found) setPerson(found);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadEvents = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/events?personId=${personId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStories = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/api/stories?personId=${personId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) setStories(data.stories || []);
    } catch (err) {
      console.error(err);
    }
  };

  const addEvent = async () => {
    if (!eventData.title.trim()) return;

    try {
      await fetch(`${apiBase}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ personId, ...eventData })
      });

      setEventData({ type: "", title: "", description: "", eventDate: "", location: "" });
      setShowEventForm(false);
      loadEvents(token);
    } catch (err) {
      console.error(err);
    }
  };

  const addStory = async () => {
    if (!storyData.title.trim() || !storyData.content.trim()) return;

    try {
      await fetch(`${apiBase}/api/stories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ personId, treeId: person?.tree_id || "temp", ...storyData })
      });

      setStoryData({ title: "", content: "" });
      setShowStoryForm(false);
      loadStories(token);
    } catch (err) {
      console.error(err);
    }
  };

  if (!person) {
    return <div className="container"><p className="muted">Loading...</p></div>;
  }

  const fullName = `${person.first_name} ${person.last_name || ""}`.trim();

  return (
    <div className="container">
      <section className="panel">
        <div className="person-header">
          {person.photo_url ? (
            <img src={person.photo_url} alt={fullName} className="profile-photo" />
          ) : (
            <div className="profile-photo placeholder">{person.first_name[0]}</div>
          )}
          <div>
            <h2>{fullName}</h2>
            <p className="muted">{person.birth_date || "Birth unknown"} — {person.death_date || "Present"}</p>
            {person.biography && <p>{person.biography}</p>}
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Life Timeline</h3>
        <button className="primary" onClick={() => setShowEventForm(!showEventForm)}>
          {showEventForm ? "Cancel" : "+ Add event"}
        </button>

        {showEventForm && (
          <div className="form-grid">
            <select value={eventData.type} onChange={(e) => setEventData({ ...eventData, type: e.target.value })}>
              <option value="">Event type</option>
              <option value="birth">Birth</option>
              <option value="marriage">Marriage</option>
              <option value="education">Education</option>
              <option value="career">Career</option>
              <option value="death">Death</option>
              <option value="other">Other</option>
            </select>
            <input
              placeholder="Event title *"
              value={eventData.title}
              onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
            />
            <input
              type="date"
              value={eventData.eventDate}
              onChange={(e) => setEventData({ ...eventData, eventDate: e.target.value })}
            />
            <input
              placeholder="Location"
              value={eventData.location}
              onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
            />
            <input
              placeholder="Description"
              value={eventData.description}
              onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
            />
            <button className="primary" onClick={addEvent}>
              Add event
            </button>
          </div>
        )}

        <div className="timeline">
          {events.map((event) => (
            <div key={event.id} className="timeline-item">
              <div className="timeline-date">{event.event_date || "Unknown date"}</div>
              <div className="timeline-content">
                <h4>{event.title}</h4>
                {event.location && <p className="muted">{event.location}</p>}
                {event.description && <p>{event.description}</p>}
              </div>
            </div>
          ))}
          {events.length === 0 && <p className="muted">No events yet.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Stories & Memories</h3>
        <button className="primary" onClick={() => setShowStoryForm(!showStoryForm)}>
          {showStoryForm ? "Cancel" : "+ Add story"}
        </button>

        {showStoryForm && (
          <div className="story-form">
            <input
              placeholder="Story title *"
              value={storyData.title}
              onChange={(e) => setStoryData({ ...storyData, title: e.target.value })}
            />
            <textarea
              placeholder="Tell the story..."
              rows={6}
              value={storyData.content}
              onChange={(e) => setStoryData({ ...storyData, content: e.target.value })}
            />
            <button className="primary" onClick={addStory}>
              Add story
            </button>
          </div>
        )}

        <div className="stories-list">
          {stories.map((story) => (
            <div key={story.id} className="story-card">
              <h4>{story.title}</h4>
              <p>{story.content}</p>
              <p className="muted">Added {new Date(story.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          {stories.length === 0 && <p className="muted">No stories yet.</p>}
        </div>
      </section>
    </div>
  );
}
