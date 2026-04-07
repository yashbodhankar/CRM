import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

function Chat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesBottomRef = useRef(null);
  const typingDebounceRef = useRef(null);

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);
  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) =>
      String(room.name || '').toLowerCase().includes(q)
      || String(room.description || '').toLowerCase().includes(q)
      || String(room.type || '').toLowerCase().includes(q)
    );
  }, [rooms, roomSearch]);

  const canSend = Boolean(activeRoomId && text.trim() && !sending);

  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      setError('');
      const res = await api.get('/chat/rooms');
      const list = res.data || [];
      setRooms(list);
      if (list.length > 0) {
        const activeStillValid = list.some((r) => r.id === activeRoomId);
        if (!activeRoomId || !activeStillValid) {
          setActiveRoomId(list[0].id);
        }
      } else {
        setActiveRoomId('');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load chat rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadMessages = async (roomId) => {
    if (!roomId) return;
    setLoadingMessages(true);
    try {
      setError('');
      const res = await api.get('/chat/messages', { params: { roomId } });
      setMessages(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadTypingUsers = async (roomId) => {
    if (!roomId) return;
    try {
      const res = await api.get('/chat/typing', { params: { roomId } });
      setTypingUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTypingUsers([]);
    }
  };

  const updateTyping = async (roomId, isTyping) => {
    if (!roomId) return;
    try {
      await api.post('/chat/typing', { roomId, isTyping });
    } catch {
      // Non-blocking UX signal.
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    loadMessages(activeRoomId);
    loadTypingUsers(activeRoomId);
    const t = setInterval(() => {
      loadMessages(activeRoomId);
      loadTypingUsers(activeRoomId);
    }, 5000);
    return () => clearInterval(t);
  }, [activeRoomId]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) return;
    const hasText = Boolean(text.trim());
    updateTyping(activeRoomId, hasText);

    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }

    if (hasText) {
      typingDebounceRef.current = setTimeout(() => {
        updateTyping(activeRoomId, false);
      }, 1500);
    }

    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, [text, activeRoomId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!activeRoomId || !text.trim()) return;
    setSending(true);
    try {
      await api.post('/chat/messages', { roomId: activeRoomId, text: text.trim() });
      setText('');
      await updateTyping(activeRoomId, false);
      await loadMessages(activeRoomId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        sendMessage(e);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[calc(100vh-11rem)]">
      <div className="md:col-span-1 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 space-y-2">
          <h2 className="text-sm font-medium text-slate-200">Chat Rooms</h2>
          <input
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
            placeholder="Search rooms"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
          />
        </div>
        <div className="p-2 space-y-1 max-h-[68vh] overflow-y-auto">
          {filteredRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs border ${activeRoomId === room.id ? 'bg-primary-600 text-white border-primary-500' : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'}`}
            >
              <p className="font-medium">{room.name}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{room.description || room.type}</p>
            </button>
          ))}
          {loadingRooms && <p className="text-xs text-slate-500 px-2 py-2">Loading rooms...</p>}
          {!loadingRooms && filteredRooms.length === 0 && <p className="text-xs text-slate-500 px-2 py-2">No rooms available.</p>}
        </div>
      </div>

      <div className="md:col-span-3 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-slate-200">{activeRoom?.name || 'Select a room'}</h3>
            <p className="text-[11px] text-slate-500">{activeRoom?.description || 'Messages refresh every 5 seconds'}</p>
          </div>
          <button
            onClick={() => loadMessages(activeRoomId)}
            disabled={!activeRoomId || loadingMessages}
            className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs px-2 py-1"
          >
            {loadingMessages ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && <div className="px-4 py-2 text-rose-400 text-xs border-b border-slate-800">{error}</div>}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingMessages && <p className="text-xs text-slate-500">Loading messages...</p>}
          {messages.map((msg) => (
            <div
              key={msg._id}
              className={`rounded-lg border p-3 max-w-[85%] ${String(msg.senderEmail || '').toLowerCase() === String(user?.email || '').toLowerCase() ? 'bg-primary-600/15 border-primary-500/40 ml-auto' : 'bg-slate-950 border-slate-800'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-200">{msg.senderName || msg.senderEmail || 'User'} <span className="text-slate-500">({msg.senderRole || '-'})</span></span>
                <span className="text-[10px] text-slate-500">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</span>
              </div>
              <p className="text-sm text-slate-100 whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))}
          {!loadingMessages && messages.length === 0 && <p className="text-xs text-slate-500">No messages yet. Start the conversation.</p>}
          {typingUsers.length > 0 && (
            <p className="text-[11px] text-sky-300">
              {typingUsers.map((u) => u.name || u.email || 'Someone').join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </p>
          )}
          <div ref={messagesBottomRef} />
        </div>

        <form onSubmit={sendMessage} className="p-3 border-t border-slate-800 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Type a message..."
            rows={2}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">Enter to send, Shift+Enter for new line.</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">{text.trim().length} chars</span>
              <button
                type="submit"
                disabled={!canSend}
                className="rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm px-4 py-2"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Chat;
