import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

function Chat() {
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId), [rooms, activeRoomId]);

  const loadRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      const list = res.data || [];
      setRooms(list);
      if (!activeRoomId && list.length > 0) {
        setActiveRoomId(list[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load chat rooms');
    }
  };

  const loadMessages = async (roomId) => {
    if (!roomId) return;
    try {
      const res = await api.get('/chat/messages', { params: { roomId } });
      setMessages(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load messages');
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    loadMessages(activeRoomId);
    const t = setInterval(() => loadMessages(activeRoomId), 3000);
    return () => clearInterval(t);
  }, [activeRoomId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!activeRoomId || !text.trim()) return;
    try {
      await api.post('/chat/messages', { roomId: activeRoomId, text: text.trim() });
      setText('');
      await loadMessages(activeRoomId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to send message');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-11rem)]">
      <div className="md:col-span-1 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-medium text-slate-200">Chat Rooms</h2>
        </div>
        <div className="p-2 space-y-1">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs ${activeRoomId === room.id ? 'bg-primary-600 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
            >
              {room.name}
            </button>
          ))}
          {rooms.length === 0 && <p className="text-xs text-slate-500 px-2 py-2">No rooms available.</p>}
        </div>
      </div>

      <div className="md:col-span-3 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-200">{activeRoom?.name || 'Select a room'}</h3>
        </div>

        {error && <div className="px-4 py-2 text-rose-400 text-xs border-b border-slate-800">{error}</div>}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg._id} className="rounded-lg bg-slate-950 border border-slate-800 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-200">{msg.senderName || msg.senderEmail || 'User'} <span className="text-slate-500">({msg.senderRole || '-'})</span></span>
                <span className="text-[10px] text-slate-500">{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</span>
              </div>
              <p className="text-sm text-slate-100 whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="text-xs text-slate-500">No messages yet.</p>}
        </div>

        <form onSubmit={sendMessage} className="p-3 border-t border-slate-800 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={!activeRoomId || !text.trim()}
            className="rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm px-4 py-2"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
