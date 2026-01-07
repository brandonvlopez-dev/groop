import React, { useState, useEffect } from 'react';
import { X, Copy, MessageSquare } from 'lucide-react';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBHfWuWm6Tpdpv3Ofg9PBGW9bMMaAQ_54o",
  authDomain: "groop-6ad70.firebaseapp.com",
  projectId: "groop-6ad70",
  storageBucket: "groop-6ad70.firebasestorage.app",
  messagingSenderId: "543571662686",
  appId: "1:543571662686:web:07327c6079fef37619e1cf",
  measurementId: "G-96MHVDV4HJ"
};

// Firebase service using fetch API
const firebaseService = {
  async createInvite(data) {
    const id = Math.random().toString(36).substr(2, 9);
    
    try {
      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              id: { stringValue: id },
              title: { stringValue: data.title },
              options: { 
                arrayValue: { 
                  values: data.options.map(opt => ({
                    mapValue: {
                      fields: {
                        name: { stringValue: opt.name },
                        date: { stringValue: opt.date },
                        time: { stringValue: opt.time }
                      }
                    }
                  }))
                }
              },
              hasGuestLimit: { booleanValue: data.hasGuestLimit },
              guestLimit: { integerValue: data.guestLimit.toString() },
              responses: { arrayValue: { values: [] } },
              createdAt: { integerValue: Date.now().toString() }
            }
          })
        }
      );
      
      if (response.ok) {
        return id;
      }
      throw new Error('Failed to create invite');
    } catch (error) {
      console.error('Error creating invite:', error);
      return null;
    }
  },
  
  async getInvite(id) {
    try {
      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/invites?pageSize=1000`
      );
      
      if (!response.ok) throw new Error('Failed to fetch invites');
      
      const data = await response.json();
      const invite = data.documents?.find(doc => {
        const fields = doc.fields;
        return fields.id?.stringValue === id;
      });
      
      if (!invite) return null;
      
      const fields = invite.fields;
      return {
        id: fields.id?.stringValue,
        title: fields.title?.stringValue,
        options: fields.options?.arrayValue?.values?.map(v => ({
          name: v.mapValue?.fields?.name?.stringValue,
          date: v.mapValue?.fields?.date?.stringValue,
          time: v.mapValue?.fields?.time?.stringValue
        })) || [],
        hasGuestLimit: fields.hasGuestLimit?.booleanValue || false,
        guestLimit: parseInt(fields.guestLimit?.integerValue || '4'),
        responses: fields.responses?.arrayValue?.values?.map(v => ({
          name: v.mapValue?.fields?.name?.stringValue,
          phone: v.mapValue?.fields?.phone?.stringValue,
          optionIndex: parseInt(v.mapValue?.fields?.optionIndex?.integerValue || '0'),
          timestamp: parseInt(v.mapValue?.fields?.timestamp?.integerValue || '0')
        })) || [],
        docName: invite.name
      };
    } catch (error) {
      console.error('Error getting invite:', error);
      return null;
    }
  },
  
  async addResponse(inviteId, response) {
    try {
      const invite = await this.getInvite(inviteId);
      if (!invite) return false;
      
      const existingIndex = invite.responses.findIndex(r => r.phone === response.phone);
      let updatedResponses = [...invite.responses];
      
      if (existingIndex >= 0) {
        updatedResponses[existingIndex] = response;
      } else {
        updatedResponses.push(response);
      }
      
      const responsesArray = updatedResponses.map(r => ({
        mapValue: {
          fields: {
            name: { stringValue: r.name },
            phone: { stringValue: r.phone },
            optionIndex: { integerValue: r.optionIndex.toString() },
            timestamp: { integerValue: r.timestamp.toString() }
          }
        }
      }));
      
      const updateResponse = await fetch(
  `https://firestore.googleapis.com/v1/${invite.docName}?updateMask.fieldPaths=responses`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              responses: { arrayValue: { values: responsesArray } }
            }
          })
        }
      );
      
      return updateResponse.ok;
    } catch (error) {
      console.error('Error adding response:', error);
      return false;
    }
  }
};

export default function Home() {
  const [screen, setScreen] = useState('splash');
  const [inviteData, setInviteData] = useState({
    title: '',
    options: [],
    hasGuestLimit: false,
    guestLimit: 4
  });
  const [currentOption, setCurrentOption] = useState({
    name: '',
    date: '',
    time: ''
  });
  const [inviteId, setInviteId] = useState(null);
  const [invite, setInvite] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [rsvpForm, setRsvpForm] = useState({ name: '', phone: '' });
  const [existingRsvp, setExistingRsvp] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (screen === 'splash') {
      const timer = setTimeout(() => setScreen('create'), 2000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  useEffect(() => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('invite');
    const view = params.get('view');
    if (id && view === 'dashboard') {
      loadInvite(id).then(() => setScreen('dashboard'));
    } else if (id) {
      loadInvite(id);
    }
  }
}, []);

  const loadInvite = async (id, skipScreenChange = false) => {
  setLoading(true);
  const data = await firebaseService.getInvite(id);
  if (data) {
    setInvite(data);
    setInviteId(id);
    if (!skipScreenChange) {
      setScreen('rsvp');
    }
  }
  setLoading(false);
};

  const addOption = () => {
    if (currentOption.name && currentOption.date && currentOption.time) {
      setInviteData({
        ...inviteData,
        options: [...inviteData.options, currentOption]
      });
      setCurrentOption({ name: '', date: '', time: '' });
    }
  };

  const removeOption = (index) => {
    setInviteData({
      ...inviteData,
      options: inviteData.options.filter((_, i) => i !== index)
    });
  };

  const createInvite = async () => {
    if (inviteData.title && inviteData.options.length > 0) {
      setLoading(true);
      try {
        const id = await firebaseService.createInvite(inviteData);
        if (id) {
          setInviteId(id);
          setScreen('share');
        } else {
          alert('Failed to create invite. Please try again.');
        }
      } catch (error) {
        console.error('Error creating invite:', error);
        alert('Error creating invite: ' + error.message);
      }
      setLoading(false);
    }
  };

  const checkExistingRsvp = async () => {
    if (!rsvpForm.phone || !invite) return;
    const existing = invite.responses.find(r => r.phone === rsvpForm.phone);
    if (existing) {
      setExistingRsvp(existing);
      setSelectedOption(existing.optionIndex);
    }
  };

  const submitRsvp = async () => {
    if (rsvpForm.name && rsvpForm.phone && selectedOption !== null) {
      setLoading(true);
      const response = {
        name: rsvpForm.name,
        phone: rsvpForm.phone,
        optionIndex: selectedOption,
        timestamp: Date.now()
      };
      
      const success = await firebaseService.addResponse(inviteId, response);
      if (success) {
        setScreen('confirmation');
        setTimeout(async () => {
          await loadInvite(inviteId);
        }, 2000);
      }
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTotalResponses = () => {
    return invite?.responses?.length || 0;
  };

  const getOptionResponses = (optionIndex) => {
    return invite?.responses?.filter(r => r.optionIndex === optionIndex) || [];
  };

  const isCapacityReached = () => {
    return invite?.hasGuestLimit && getTotalResponses() >= invite.guestLimit;
  };

  const copyLink = () => {
    const link = `${window.location.origin}?invite=${inviteId}`;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  const messageGroup = () => {
    const link = `${window.location.origin}?invite=${inviteId}`;
    const message = `Join me for ${inviteData.title}! Click here to RSVP: ${link}`;
    
    if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
    } else {
      navigator.clipboard.writeText(message);
      alert('Message copied to clipboard!');
    }
  };

  const viewDashboard = async () => {
  setLoading(true);
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', `?invite=${inviteId}&view=dashboard`);
  }
  await loadInvite(inviteId);
  setScreen('dashboard');
  setLoading(false);
};

  const refreshDashboard = async () => {
  setLoading(true);
  await loadInvite(inviteId, true);
  setLoading(false);
};

  // Splash Screen
  if (screen === 'splash') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#C4BDAA' }}>
        <div className="relative" style={{ 
          width: '280px', 
          height: '560px', 
          backgroundColor: '#E5B88A',
          borderRadius: '140px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <h1 className="text-white text-7xl font-light tracking-tight">groop</h1>
          <p className="text-white text-lg">Let's get together.</p>
        </div>
      </div>
    );
  }

  // Loading overlay
  if (loading && screen !== 'splash') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto mb-4" style={{ borderColor: '#E5B88A' }}></div>
          <p className="text-lg" style={{ color: '#3D3D3D' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Create Invite Screen
  if (screen === 'create') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="max-w-md mx-auto p-6 pb-40">
          <div className="mb-8">
            <input
              type="text"
              placeholder="Let's"
              value={inviteData.title}
              onChange={(e) => setInviteData({ ...inviteData, title: e.target.value })}
              className="text-5xl font-bold w-full bg-transparent border-b-4 border-black outline-none pb-2"
              style={{ color: '#3D3D3D' }}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6">
              <h3 className="font-bold text-lg mb-3">Date + Time</h3>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={currentOption.date}
                  onChange={(e) => setCurrentOption({ ...currentOption, date: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-full text-sm font-medium outline-none"
                  style={{ backgroundColor: '#E5B88A' }}
                />
                <input
                  type="time"
                  value={currentOption.time}
                  onChange={(e) => setCurrentOption({ ...currentOption, time: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-full text-sm font-medium outline-none"
                  style={{ backgroundColor: '#E5B88A' }}
                />
              </div>
            </div>

            <div className="rounded-3xl p-6" style={{ backgroundColor: '#D9D9D9' }}>
              <h3 className="font-bold text-lg mb-3">Location</h3>
              <input
                type="text"
                placeholder="INSERT LOCATION"
                value={currentOption.name}
                onChange={(e) => setCurrentOption({ ...currentOption, name: e.target.value })}
                className="w-full px-4 py-3 rounded-full text-sm font-medium outline-none"
                style={{ backgroundColor: '#E5B88A' }}
              />
            </div>

            <div className="bg-white rounded-3xl p-6">
              <h3 className="font-bold text-lg mb-3">Guest limit?</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setInviteData({ ...inviteData, hasGuestLimit: true })}
                  className="px-8 py-3 rounded-full font-medium"
                  style={{ backgroundColor: inviteData.hasGuestLimit ? '#E5B88A' : '#D9D9D9' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setInviteData({ ...inviteData, hasGuestLimit: false })}
                  className="px-8 py-3 rounded-full font-medium"
                  style={{ backgroundColor: !inviteData.hasGuestLimit ? '#E5B88A' : '#D9D9D9' }}
                >
                  No
                </button>
              </div>
              {inviteData.hasGuestLimit && (
                <input
                  type="number"
                  min="1"
                  value={inviteData.guestLimit}
                  onChange={(e) => setInviteData({ ...inviteData, guestLimit: parseInt(e.target.value) || 1 })}
                  className="w-full mt-3 px-4 py-3 rounded-full text-sm font-medium outline-none"
                  style={{ backgroundColor: '#E5B88A' }}
                  placeholder="Number of guests"
                />
              )}
            </div>

            {inviteData.options.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {inviteData.options.map((opt, i) => (
                  <div key={i} className="px-4 py-2 rounded-full text-sm" style={{ backgroundColor: '#D9D9D9' }}>
                    {opt.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-6 flex gap-3" style={{ backgroundColor: '#5C5F52' }}>
            <button
              onClick={addOption}
              className="px-6 py-4 rounded-full font-medium"
              style={{ backgroundColor: '#F5F1E8' }}
            >
              Add option +
            </button>
            <button
              onClick={createInvite}
              disabled={!inviteData.title || inviteData.options.length === 0}
              className="flex-1 py-4 rounded-full font-medium disabled:opacity-50"
              style={{ backgroundColor: '#F4E96D' }}
            >
              Create invite
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Share Screen
  if (screen === 'share') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="max-w-md mx-auto p-6 pb-32">
          <h2 className="text-4xl font-bold mb-6" style={{ color: '#3D3D3D' }}>
            The {inviteData.title} options
          </h2>

          <div className="space-y-3 mb-8">
            {inviteData.options.map((option, i) => (
              <div
                key={i}
                className="p-6 rounded-3xl"
                style={{ backgroundColor: '#C4BDAA' }}
              >
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#3D3D3D' }}>
                  {option.name}
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-lg" style={{ color: '#3D3D3D' }}>
                    {new Date(option.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#5C5F52', color: 'white' }}>
                    {option.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-6">
            <h3 className="font-bold text-lg mb-3">Share</h3>
            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 py-3 rounded-full font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: '#E5B88A' }}
              >
                <Copy size={20} />
                Copy link
              </button>
              <button
                onClick={messageGroup}
                className="flex-1 py-3 rounded-full font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: '#E5B88A' }}
              >
                <MessageSquare size={20} />
                Message group
              </button>
            </div>
            <p className="text-sm text-center mt-4" style={{ color: '#666' }}>
              Anyone with link can respond. No app required.
            </p>
          </div>

          <button
            onClick={viewDashboard}
            className="w-full mt-4 py-3 rounded-full font-medium"
            style={{ backgroundColor: '#5C5F52', color: 'white' }}
          >
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  // RSVP Screen
  if (screen === 'rsvp' && invite) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="max-w-md mx-auto p-6 pb-32">
          <h2 className="text-4xl font-bold mb-6" style={{ color: '#3D3D3D' }}>
            The options
          </h2>

          {existingRsvp && (
            <div className="mb-4 p-4 bg-yellow-100 rounded-2xl">
              <p className="text-sm font-medium">You've already RSVPed! You can change your selection below.</p>
            </div>
          )}

          {isCapacityReached() && !existingRsvp && (
            <div className="mb-4 p-4 bg-red-100 rounded-2xl">
              <p className="text-sm font-medium">This event is at capacity. No more spots available.</p>
            </div>
          )}

          <div className="space-y-3 mb-8">
            {invite.options.map((option, i) => {
              const responses = getOptionResponses(i);
              const optionFull = invite.hasGuestLimit && getTotalResponses() >= invite.guestLimit && responses.length === 0;
              const isSelected = selectedOption === i;
              
              return (
                <button
                  key={i}
                  onClick={() => !isCapacityReached() || existingRsvp ? setSelectedOption(i) : null}
                  disabled={isCapacityReached() && !existingRsvp}
                  className="w-full p-6 rounded-3xl text-left relative"
                  style={{ 
                    backgroundColor: isSelected ? '#C4BDAA' : optionFull ? '#D9D9D9' : '#F5F1E8',
                    opacity: (isCapacityReached() && !existingRsvp) ? 0.5 : 1
                  }}
                >
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOption(null);
                      }}
                      className="absolute top-4 right-4"
                    >
                      <X size={24} />
                    </button>
                  )}
                  
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#3D3D3D' }}>
                    {option.name}
                  </h3>
                  
                  {invite.hasGuestLimit && (
                    <div className="flex gap-1 mb-2">
                      {[...Array(invite.guestLimit)].map((_, idx) => (
                        <div
                          key={idx}
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: idx < responses.length ? '#F4E96D' : '#D9D9D9' }}
                        />
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-lg" style={{ color: '#3D3D3D' }}>
                      {new Date(option.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#5C5F52', color: 'white' }}>
                      {option.time}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Name"
              value={rsvpForm.name}
              onChange={(e) => setRsvpForm({ ...rsvpForm, name: e.target.value })}
              className="w-full px-6 py-4 rounded-full font-medium outline-none"
              style={{ backgroundColor: '#E5B88A' }}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={rsvpForm.phone}
              onChange={(e) => setRsvpForm({ ...rsvpForm, phone: e.target.value })}
              onBlur={checkExistingRsvp}
              className="w-full px-6 py-4 rounded-full font-medium outline-none"
              style={{ backgroundColor: '#E5B88A' }}
            />
            <button
              onClick={submitRsvp}
              disabled={!rsvpForm.name || !rsvpForm.phone || selectedOption === null || (isCapacityReached() && !existingRsvp)}
              className="w-full py-4 rounded-full font-medium disabled:opacity-50"
              style={{ backgroundColor: '#F4E96D' }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation Screen
  if (screen === 'confirmation') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#C4BDAA' }}>
        <div className="relative" style={{ 
          width: '280px', 
          height: '560px', 
          backgroundColor: '#E5B88A',
          borderRadius: '140px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <h1 className="text-white text-7xl font-light tracking-tight">groop</h1>
          <p className="text-white text-lg text-center px-8">
            Your response<br />is confirmed
          </p>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  if (screen === 'dashboard' && invite) {
    const totalResponses = getTotalResponses();
    const isComplete = invite.hasGuestLimit && totalResponses >= invite.guestLimit;
    
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="max-w-md mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-5xl font-bold" style={{ color: '#3D3D3D' }}>
              {isComplete ? "Let's go!" : totalResponses === 0 ? "Waiting..." : "Groops"}
            </h2>
            <button
              onClick={refreshDashboard}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: '#E5B88A' }}
            >
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {invite.options.map((option, i) => {
              const responses = getOptionResponses(i);
              const hasResponses = responses.length > 0;
              
              return (
                <div
                  key={i}
                  className="p-6 rounded-3xl relative"
                  style={{ backgroundColor: hasResponses ? '#C4BDAA' : '#D9D9D9' }}
                >
                  <h3 className="text-2xl font-bold mb-2" style={{ color: '#3D3D3D' }}>
                    {option.name}
                  </h3>
                  
                  {invite.hasGuestLimit && (
                    <div className="flex gap-1 mb-2">
                      {responses.map((response, idx) => (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ 
                            backgroundColor: '#F4E96D',
                            color: '#3D3D3D'
                          }}
                          title={`${response.name} - ${response.phone}`}
                        >
                          {getInitials(response.name)}
                        </div>
                      ))}
                      {[...Array(Math.max(0, invite.guestLimit - responses.length))].map((_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
                        />
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-lg" style={{ color: '#3D3D3D' }}>
                      {new Date(option.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#5C5F52', color: 'white' }}>
                      {option.time}
                    </span>
                  </div>

                  {!invite.hasGuestLimit && responses.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-400">
                      <p className="text-sm font-medium mb-2">RSVPs:</p>
                      <div className="flex flex-wrap gap-2">
                        {responses.map((response, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-1 rounded-full text-xs"
                            style={{ backgroundColor: '#F4E96D' }}
                            title={response.phone}
                          >
                            {response.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setScreen('share')}
            className="w-full mt-6 py-4 rounded-full font-medium"
            style={{ backgroundColor: '#5C5F52', color: 'white' }}
          >
            Back to Share
          </button>
        </div>
      </div>
    );
  }

  return null;
}
