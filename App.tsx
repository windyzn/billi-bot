
import React, { useState, useMemo, useEffect } from 'react';
import { Friend, BillItem, TaxCategory, GST_RATE, PST_RATE, Venue } from './types';
import { calculateIndividualCosts, solveDebts, calculateItemTotals, getItemTaxRate } from './utils/finance';
import StepProgress from './components/StepProgress';

const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="15" x2="8" y2="15.01" />
    <line x1="16" y1="15" x2="16" y2="15.01" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
);

const DeleteIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const DEFAULT_VENUE_ID = 'default';

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);
  const [venues, setVenues] = useState<Venue[]>([{
    id: DEFAULT_VENUE_ID,
    name: 'Main Place',
    tip: 0,
    tipMode: 'percent',
    tipPercent: 15,
    discount: 0,
    discountMode: 'amount',
    discountPercent: 0,
    manualGrandTotal: 0
  }]);
  const [activeVenueId, setActiveVenueId] = useState<string>(DEFAULT_VENUE_ID);
  const [payments, setPayments] = useState<Record<string, number>>({});
  const [etransferEmail, setEtransferEmail] = useState('');
  const [linkingFriendId, setLinkingFriendId] = useState<string | null>(null);
  const [showCoupleHint, setShowCoupleHint] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameHistory, setNameHistory] = useState<string[]>([]);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editVenueName, setEditVenueName] = useState('');

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bill_bot_name_history');
    if (saved) {
      try {
        setNameHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load name history");
      }
    }
  }, []);

  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  const goToStep = (s: number) => setStep(s);

  const addFriend = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    
    const newFriend = { id: Math.random().toString(36).substr(2, 9), name: trimmedName };
    setFriends([...friends, newFriend]);
    setNameInput('');

    // Update history
    const updatedHistory = [trimmedName, ...nameHistory.filter(n => n !== trimmedName)].slice(0, 10);
    setNameHistory(updatedHistory);
    localStorage.setItem('bill_bot_name_history', JSON.stringify(updatedHistory));
  };

  const removeFriend = (id: string) => {
    const friend = friends.find(f => f.id === id);
    let updatedFriends = friends.filter(f => f.id !== id);
    if (friend?.partnerId) {
      updatedFriends = updatedFriends.map(f => f.id === friend.partnerId ? { ...f, partnerId: undefined } : f);
    }
    setFriends(updatedFriends);
    setItems(items.map(item => ({
      ...item,
      sharedWith: item.sharedWith.filter(fid => fid !== id)
    })));
  };

  const toggleCouple = (id: string) => {
    if (linkingFriendId === id) {
      setLinkingFriendId(null);
      return;
    }
    if (!linkingFriendId) {
      const friend = friends.find(f => f.id === id);
      if (friend?.partnerId) {
        setFriends(friends.map(f => 
          (f.id === id || f.id === friend.partnerId) ? { ...f, partnerId: undefined } : f
        ));
      } else {
        setLinkingFriendId(id);
      }
    } else {
      setFriends(friends.map(f => {
        if (f.id === id) return { ...f, partnerId: linkingFriendId };
        if (f.id === linkingFriendId) return { ...f, partnerId: id };
        return f;
      }));
      setLinkingFriendId(null);
    }
  };

  const addVenue = (name: string) => {
    const newVenue: Venue = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || `Place ${venues.length + 1}`,
      tip: 0,
      tipMode: 'percent',
      tipPercent: 15,
      discount: 0,
      discountMode: 'amount',
      discountPercent: 0,
      manualGrandTotal: 0
    };
    setVenues([...venues, newVenue]);
    setActiveVenueId(newVenue.id);
  };

  const updateVenue = (venueId: string, updates: Partial<Venue>) => {
    setVenues(venues.map(v => v.id === venueId ? { ...v, ...updates } : v));
  };

  const addItem = (name: string, price: number, taxCategory: TaxCategory, isTaxIncluded = false, customTaxRate?: number) => {
    const newItem: BillItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      price,
      taxCategory,
      sharedWith: [],
      isTaxIncluded,
      customTaxRate,
      venueId: activeVenueId
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const toggleShare = (itemId: string, friendId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const isShared = item.sharedWith.includes(friendId);
        return {
          ...item,
          sharedWith: isShared 
            ? item.sharedWith.filter(id => id !== friendId)
            : [...item.sharedWith, friendId]
        };
      }
      return item;
    }));
  };

  const splitAllEvenly = () => {
    const allFriendIds = friends.map(f => f.id);
    setItems(items.map(item => ({ ...item, sharedWith: [...allFriendIds] })));
  };

  const activeVenue = useMemo(() => 
    venues.find(v => v.id === activeVenueId) || venues[0],
    [venues, activeVenueId]
  );

  const calculations = useMemo(() => {
    const venueCosts: Record<string, Record<string, number>> = {}; // venueId -> friendId -> cost
    const venueTotals: Record<string, { subtotal: number, taxTotal: number, total: number, effectiveTip: number, effectiveDiscount: number, grandTotal: number }> = {};

    venues.forEach(venue => {
      const venueItems = items.filter(i => i.venueId === venue.id);
      const totals = calculateItemTotals(venueItems);
      
      let effectiveDiscount = venue.discount;
      if (venue.discountMode === 'percent') {
        effectiveDiscount = totals.subtotal * (venue.discountPercent / 100);
      }

      let effectiveTip = venue.tip;
      if (venue.tipMode === 'percent') {
        effectiveTip = totals.subtotal * (venue.tipPercent / 100);
      } else if (venue.tipMode === 'total') {
        effectiveTip = Math.max(0, venue.manualGrandTotal - totals.total + effectiveDiscount);
      }

      const netAdjustment = effectiveTip - effectiveDiscount;
      const itemCosts = calculateIndividualCosts(friends, venueItems, netAdjustment);
      const grandTotal = totals.total + effectiveTip - effectiveDiscount;

      venueCosts[venue.id] = itemCosts;
      venueTotals[venue.id] = { ...totals, effectiveTip, effectiveDiscount, grandTotal };
    });

    const aggregateItemCosts: Record<string, number> = {};
    friends.forEach(f => {
      aggregateItemCosts[f.id] = venues.reduce((sum, v) => sum + (venueCosts[v.id][f.id] || 0), 0);
    });

    const totalGrandTotal = Object.values(venueTotals).reduce((sum, vt) => sum + vt.grandTotal, 0);
    
    const balances: Record<string, number> = {};
    friends.forEach(f => {
      balances[f.id] = (payments[f.id] || 0) - (aggregateItemCosts[f.id] || 0);
    });
    const settlements = solveDebts(balances, friends);
    
    return { itemCosts: aggregateItemCosts, venueTotals, totalGrandTotal, settlements };
  }, [friends, items, venues, payments]);

  const paidTotal = useMemo(() => 
    (Object.values(payments) as number[]).reduce((acc, curr) => acc + (curr || 0), 0),
    [payments]
  );

  const setSinglePayer = (friendId: string) => {
    const newPayments: Record<string, number> = {};
    friends.forEach(f => {
      newPayments[f.id] = f.id === friendId ? Number(calculations.totalGrandTotal.toFixed(2)) : 0;
    });
    setPayments(newPayments);
  };

  const generateReportText = () => {
    let text = `Total Sessions: $${calculations.totalGrandTotal.toFixed(2)}\n`;
    text += `-------------------\n`;
    
    venues.forEach(v => {
      const vt = calculations.venueTotals[v.id];
      if (vt.grandTotal > 0) {
        text += `${v.name}: $${vt.grandTotal.toFixed(2)}\n`;
      }
    });
    text += `-------------------\n`;

    if (calculations.settlements.length > 0) {
      text += `SETTLEMENTS:\n`;
      text += calculations.settlements.map(s => `• ${s.fromName} pays ${s.toName}: $${s.amount.toFixed(2)}`).join('\n');
      text += `\n-------------------\n`;
    }

    text += `BREAKDOWN:\n`;
    const breakdownLines = friends.map(f => {
      const totalCost = calculations.itemCosts[f.id] || 0;
      
      if (totalCost > 0) {
        return `${f.name}: $${totalCost.toFixed(2)}`;
      }
      return null;
    }).filter(Boolean);
    
    text += breakdownLines.join('\n');
    text += `\n`;

    if (etransferEmail.trim()) {
      text += `\n💰 e-Transfer to: ${etransferEmail.trim()}\n`;
    }
    
    text += `\nSplit via Bill Bot 🤖 https://windyzn.github.io/billi-bot/`;
    return text;
  };

  const shareResults = async () => {
    const text = generateReportText();
    if (navigator.share) {
      try { 
        await navigator.share({ 
          title: 'Bill Summary', 
          text: text 
        }); 
      } catch (err) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    const text = generateReportText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        alert("Failed to copy! Please select and copy manually.");
      }
      document.body.removeChild(textArea);
    }
  };

  const getBotSpeech = () => {
    switch (step) {
      case 1: return "Hello! I'm Billi. Who are we splitting the bill with today? You can link couples too!";
      case 2: return "Let's record everything that was ordered. You can add multiple places!";
      case 3: 
        if (activeVenue.tipMode === 'total' && activeVenue.manualGrandTotal === 0) {
          return `Assign items for ${activeVenue.name}. Enter the total from your receipt!`;
        }
        return `Tipping for ${activeVenue.name}. Tap names to split items!`;
      case 4: return "Almost there! Tell me who paid what for all places combined.";
      case 5: return "Calculation complete! I've found the most efficient way to settle up.";
      default: return "Beep boop!";
    }
  };

  // Suggestions for Step 1
  const suggestedNames = useMemo(() => {
    const currentFriendsNames = new Set(friends.map(f => f.name.toLowerCase()));
    const filtered = nameHistory.filter(name => 
      !currentFriendsNames.has(name.toLowerCase()) && 
      (nameInput === '' || name.toLowerCase().includes(nameInput.toLowerCase()))
    );
    return nameInput === '' ? filtered.slice(0, 5) : filtered.slice(0, 10);
  }, [nameHistory, friends, nameInput]);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center p-0 md:p-8">
      <div className="w-full max-w-lg bg-white min-h-screen md:min-h-0 md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 relative">
        <header className="bg-indigo-700 px-8 py-10 text-white relative overflow-hidden">
          <div className="absolute top-10 right-8 bot-float opacity-30"><BotIcon className="w-16 h-16" /></div>
          <div className="relative z-10 flex flex-col items-start gap-1">
            <h1 className="text-4xl font-black tracking-tight leading-none">Bill Bot</h1>
            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap">Simple restaurant bill splitter</p>
          </div>
        </header>

        <main className="p-6 flex-1 bg-white flex flex-col relative overflow-y-auto no-scrollbar">
          <StepProgress currentStep={step} onStepClick={goToStep} />

          <div className="mb-8 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-700">
            <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 shrink-0"><BotIcon className="w-6 h-6" /></div>
            <div className="pt-1"><p className="text-lg font-bold text-slate-800 leading-tight">{getBotSpeech()}</p></div>
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text" 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter a name..." 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-indigo-500 outline-none transition-all pr-14 text-lg font-bold shadow-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') { addFriend(nameInput); } }}
                  />
                  <button onClick={() => addFriend(nameInput)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                  </button>
                </div>

                {suggestedNames.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                      {nameInput === '' ? 'Recent Friends' : 'Suggestions'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedNames.map((name) => (
                        <button
                          key={name}
                          onClick={() => addFriend(name)}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {friends.map(f => {
                  const partner = friends.find(p => p.id === f.partnerId);
                  const isLinking = linkingFriendId === f.id;
                  return (
                    <div key={f.id} className={`bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center group transition-all ${isLinking ? 'border-indigo-500 bg-indigo-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-slate-400 text-xs shadow-sm">{f.name[0].toUpperCase()}</div>
                        <div>
                          <span className="font-bold text-slate-700">{f.name}</span>
                          {partner && <span className="text-[10px] block text-indigo-500 font-bold uppercase tracking-tighter">❤ Linked with {partner.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCouple(f.id)} className={`p-2 rounded-xl transition-all ${partner ? 'text-rose-500 bg-rose-50' : isLinking ? 'text-white bg-indigo-500' : 'text-slate-300 hover:text-indigo-500'}`} title={partner ? "Break couple" : "Link as couple"}>
                          <HeartIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeFriend(f.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex items-center justify-between px-1">
                <button 
                  onClick={() => setShowCoupleHint(!showCoupleHint)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight hover:text-indigo-500 transition-colors"
                >
                  <HeartIcon className="w-2.5 h-2.5" />
                  What is linking?
                </button>
                {nameHistory.length > 0 && (
                  <button 
                    onClick={() => { setNameHistory([]); localStorage.removeItem('bill_bot_name_history'); }}
                    className="text-[10px] font-bold text-slate-300 uppercase tracking-tight hover:text-rose-400 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
              {showCoupleHint && (
                <p className="mt-1 text-[9px] text-slate-400 font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  Linking two people combines their debt. They will be treated as one unit in the final results. Tap the heart icon on any person to start linking!
                </p>
              )}

              {linkingFriendId && <div className="text-center animate-pulse text-xs font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 py-2 rounded-xl">Select another person to link with</div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-0 animate-in slide-in-from-right-4 duration-500">
              {/* Venue Tabs */}
              <div className="flex items-end gap-1 px-2">
                {venues.map(v => (
                  <div key={v.id} className="relative group shrink-0">
                    {editingVenueId === v.id ? (
                      <div className="flex items-center bg-white rounded-t-2xl border-t border-x border-slate-200 overflow-hidden shadow-sm">
                        <input 
                          autoFocus
                          type="text" 
                          value={editVenueName}
                          onChange={(e) => setEditVenueName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateVenue(v.id, { name: editVenueName || v.name });
                              setEditingVenueId(null);
                            }
                            if (e.key === 'Escape') setEditingVenueId(null);
                          }}
                          onBlur={() => {
                            updateVenue(v.id, { name: editVenueName || v.name });
                            setEditingVenueId(null);
                          }}
                          className="px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none w-32"
                        />
                      </div>
                    ) : (
                      <button 
                        onClick={() => setActiveVenueId(v.id)}
                        onDoubleClick={() => {
                          setEditingVenueId(v.id);
                          setEditVenueName(v.name);
                        }}
                        className={`px-5 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-t border-x ${v.id === activeVenueId ? 'bg-slate-50 border-slate-200 text-indigo-600' : 'bg-slate-100/50 border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-500'}`}
                      >
                        {v.name}
                      </button>
                    )}
                    {v.id !== DEFAULT_VENUE_ID && v.id === activeVenueId && editingVenueId !== v.id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${v.name}?`)) {
                            setVenues(venues.filter(venue => venue.id !== v.id));
                            setItems(items.filter(item => item.venueId !== v.id));
                            setActiveVenueId(DEFAULT_VENUE_ID);
                          }
                        }}
                        className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] border border-white shadow-sm transition-transform hover:scale-110"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                
                {isAddingVenue ? (
                  <div className="flex items-center bg-white rounded-t-2xl border-t border-x border-indigo-200 overflow-hidden shadow-sm shrink-0">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Place name..."
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newVenueName.trim()) {
                          addVenue(newVenueName.trim());
                          setIsAddingVenue(false);
                          setNewVenueName('');
                        }
                        if (e.key === 'Escape') setIsAddingVenue(false);
                      }}
                      onBlur={() => {
                        if (newVenueName.trim()) {
                          addVenue(newVenueName.trim());
                        }
                        setIsAddingVenue(false);
                        setNewVenueName('');
                      }}
                      className="px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none w-32"
                    />
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAddingVenue(true)}
                    className="px-4 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-500 border-t border-x border-indigo-100 hover:bg-indigo-100/50 transition-all font-mono"
                  >
                    + NEW PLACE
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="bg-slate-50 border border-slate-200 rounded-b-3xl rounded-tr-3xl p-6 space-y-6 shadow-inner -mt-[1px]">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Item Name (e.g. Burger)" 
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none font-bold shadow-sm"
                      id="itemNameInput"
                    />
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <div className="flex-[7] relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                          <input 
                            type="number" 
                            inputMode="decimal" 
                            placeholder="0.00" 
                            className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-4 py-3 text-sm focus:border-indigo-500 outline-none font-mono shadow-sm"
                            id="itemPriceInput"
                          />
                        </div>
                        <select 
                          id="itemTaxSelect"
                          onChange={(e) => {
                            const customInput = document.getElementById('customTaxContainer');
                            if (e.target.value === TaxCategory.CUSTOM) {
                              customInput?.classList.remove('hidden');
                            } else {
                              customInput?.classList.add('hidden');
                            }
                          }}
                          className="flex-[3] bg-white border border-slate-300 rounded-xl px-2 py-3 text-[10px] font-bold text-slate-600 focus:border-indigo-500 outline-none shadow-sm"
                        >
                          <option value={TaxCategory.GST}>GST 5%</option>
                          <option value={TaxCategory.GST_PST}>GST+PST 12%</option>
                          <option value={TaxCategory.HST_13}>HST 13%</option>
                          <option value={TaxCategory.CUSTOM}>Custom %</option>
                          <option value="INCLUDED">Tax Included</option>
                        </select>
                      </div>
                      
                      <div id="customTaxContainer" className="hidden animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="relative">
                          <input 
                            id="customTaxRateInput"
                            type="number" 
                            inputMode="decimal" 
                            placeholder="Custom Tax % (e.g. 10)" 
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none font-bold" 
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                        </div>
                      </div>
                    </div>
                    
                    <button onClick={() => {
                        const n = document.getElementById('itemNameInput') as HTMLInputElement;
                        const p = document.getElementById('itemPriceInput') as HTMLInputElement;
                        const t = document.getElementById('itemTaxSelect') as HTMLSelectElement;
                        const c = document.getElementById('customTaxRateInput') as HTMLInputElement;
                        
                        if (n.value && p.value) { 
                          const isInc = t.value === 'INCLUDED';
                          const cat = isInc ? TaxCategory.GST : t.value as TaxCategory;
                          const customRate = cat === TaxCategory.CUSTOM ? (parseFloat(c.value) / 100) : undefined;
                          
                          addItem(n.value, parseFloat(p.value), cat, isInc, customRate); 
                          
                          // Reset
                          n.value = ''; 
                          p.value = ''; 
                          c.value = '';
                          t.value = TaxCategory.GST;
                          document.getElementById('customTaxContainer')?.classList.add('hidden');
                        }
                      }} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-100 uppercase tracking-widest text-xs">
                      Add to {activeVenue.name}
                    </button>
                  </div>
                </div>
                
                <div className="max-h-[35vh] overflow-y-auto space-y-2 pr-1 no-scrollbar pt-4 border-t border-slate-200">
                  {items.filter(i => i.venueId === activeVenueId).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-all group">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${item.isTaxIncluded ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-100 text-blue-700'}`}>
                          {item.isTaxIncluded ? 'Tax Included' : `${item.taxCategory === TaxCategory.CUSTOM ? (item.customTaxRate! * 100).toFixed(0) : (getItemTaxRate(item) * 100).toFixed(0)}% Tax`}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-black text-slate-900">${item.price.toFixed(2)}</span>
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                          <DeleteIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.filter(i => i.venueId === activeVenueId).length === 0 && (
                    <div className="p-12 text-center bg-white/50 rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No items for this place yet.</p>
                      <p className="text-[9px] font-bold text-slate-300 mt-1 uppercase tracking-widest">Type them in above!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-0 animate-in slide-in-from-right-4 duration-500">
              {/* Venue Tabs */}
              <div className="flex items-end gap-1 px-2">
                {venues.map(v => (
                  <button 
                    key={v.id} 
                    onClick={() => setActiveVenueId(v.id)}
                    className={`px-5 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-t border-x ${v.id === activeVenueId ? 'bg-slate-50 border-slate-200 text-indigo-600' : 'bg-slate-100/50 border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-500'}`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>

              {/* Tab Body */}
              <div className="bg-slate-50 border border-slate-200 rounded-b-3xl rounded-tr-3xl p-6 space-y-8 shadow-inner -mt-[1px]">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Who split what at {activeVenue.name}?</h2>
                  <button 
                    onClick={() => {
                    const venueItems = items.filter(i => i.venueId === activeVenueId);
                    const allFriendIds = friends.map(f => f.id);
                    setItems(items.map(item => 
                      item.venueId === activeVenueId 
                        ? { ...item, sharedWith: [...allFriendIds] } 
                        : item
                    ));
                  }} 
                  className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 uppercase hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Split All {activeVenue.name} Evenly
                </button>
              </div>
              <div className="relative">
                <div className={`space-y-4 max-h-[30vh] overflow-y-auto pr-1 no-scrollbar rounded-3xl ${items.filter(i => i.venueId === activeVenueId).length > 2 ? 'scroll-hint' : ''}`}>
                  {items.filter(i => i.venueId === activeVenueId).map(item => (
                    <div key={item.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:border-indigo-200 transition-all">
                      <div className="bg-slate-50 px-5 py-3 flex justify-between items-center border-b border-slate-100">
                        <span className="font-bold text-slate-800 text-sm truncate">{item.name}</span>
                        <span className="text-[10px] font-black text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
                          ${(item.price * (1 + getItemTaxRate(item))).toFixed(2)} Total
                        </span>
                      </div>
                      <div className="p-4 flex flex-wrap gap-2">
                        {friends.map(f => (
                          <button key={f.id} onClick={() => toggleShare(item.id, f.id)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${item.sharedWith.includes(f.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300'}`}>
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {items.filter(i => i.venueId === activeVenueId).length === 0 && (
                    <div className="p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No items for this place yet.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-4 border-t-2 border-slate-100 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Tip for {activeVenue.name}</label>
                      <button onClick={() => updateVenue(activeVenueId, { tipMode: 'total' })} className="text-[9px] font-black text-indigo-500 flex items-center gap-1 mt-1 hover:text-indigo-700 transition-colors">
                        <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        Calculate tip from receipt?
                      </button>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => updateVenue(activeVenueId, { tipMode: 'percent' })} className={`px-2 py-1.5 rounded-lg text-[9px] font-black transition-all ${activeVenue.tipMode === 'percent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>%</button>
                      <button onClick={() => updateVenue(activeVenueId, { tipMode: 'amount' })} className={`px-2 py-1.5 rounded-lg text-[9px] font-black transition-all ${activeVenue.tipMode === 'amount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>$</button>
                      <button onClick={() => updateVenue(activeVenueId, { tipMode: 'total' })} className={`px-2 py-1.5 rounded-lg text-[9px] font-black transition-all ${activeVenue.tipMode === 'total' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>BILL TOTAL</button>
                    </div>
                  </div>
                  {activeVenue.tipMode === 'total' ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="relative group max-w-[240px] mx-auto">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg text-indigo-600">$</span>
                        <input type="number" inputMode="decimal" value={activeVenue.manualGrandTotal || ''} onChange={(e) => updateVenue(activeVenueId, { manualGrandTotal: parseFloat(e.target.value) || 0 })} placeholder="Total..." className="w-full bg-slate-50 border-2 border-indigo-100 rounded-xl py-3 pl-8 pr-4 text-xl font-black text-indigo-600 text-center focus:border-indigo-500 outline-none transition-all" autoFocus />
                      </div>
                      <div className="flex justify-between items-center px-4 bg-emerald-50 py-2 rounded-xl border border-emerald-100">
                        <span className="text-[9px] font-black text-emerald-600 uppercase">Calculated Tip</span>
                        <span className="text-sm font-black text-emerald-700 font-mono">${calculations.venueTotals[activeVenueId].effectiveTip.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative max-w-[160px] mx-auto">
                      <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg transition-colors ${activeVenue.tipMode === 'amount' ? 'text-indigo-600' : 'hidden'}`}>$</span>
                      <input type="number" inputMode="decimal" value={activeVenue.tipMode === 'percent' ? activeVenue.tipPercent : (activeVenue.tip || '')} onChange={(e) => activeVenue.tipMode === 'percent' ? updateVenue(activeVenueId, { tipPercent: parseFloat(e.target.value) || 0 }) : updateVenue(activeVenueId, { tip: parseFloat(e.target.value) || 0 })} className={`w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 text-xl font-black text-indigo-600 text-center focus:border-indigo-500 outline-none transition-all shadow-sm ${activeVenue.tipMode === 'amount' ? 'pl-8' : ''}`} />
                      <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-black text-lg transition-colors ${activeVenue.tipMode === 'percent' ? 'text-indigo-600' : 'hidden'}`}>%</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Discount for {activeVenue.name}</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => updateVenue(activeVenueId, { discountMode: 'percent' })} className={`px-2 py-1.5 rounded-lg text-[9px] font-black transition-all ${activeVenue.discountMode === 'percent' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>%</button>
                      <button onClick={() => updateVenue(activeVenueId, { discountMode: 'amount' })} className={`px-2 py-1.5 rounded-lg text-[9px] font-black transition-all ${activeVenue.discountMode === 'amount' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>$</button>
                    </div>
                  </div>
                  <div className="relative max-w-[160px] mx-auto">
                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg transition-colors text-rose-600 ${activeVenue.discountMode === 'amount' ? '' : 'hidden'}`}>-$</span>
                    <input 
                      type="number" 
                      inputMode="decimal" 
                      value={activeVenue.discountMode === 'percent' ? (activeVenue.discountPercent || '') : (activeVenue.discount || '')} 
                      onChange={(e) => activeVenue.discountMode === 'percent' ? updateVenue(activeVenueId, { discountPercent: parseFloat(e.target.value) || 0 }) : updateVenue(activeVenueId, { discount: parseFloat(e.target.value) || 0 })} 
                      placeholder="0"
                      className={`w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 text-xl font-black text-rose-600 text-center focus:border-rose-400 outline-none transition-all shadow-sm ${activeVenue.discountMode === 'amount' ? 'pl-10' : ''}`} 
                    />
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-black text-lg transition-colors text-rose-600 ${activeVenue.discountMode === 'percent' ? '' : 'hidden'}`}>% off</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                <div className="absolute -right-8 -top-8 text-indigo-500 opacity-20"><BotIcon className="w-32 h-32" /></div>
                <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Combined Total</p>
                    <h3 className="text-4xl font-black mb-6">${calculations.totalGrandTotal.toFixed(2)}</h3>
                    <div className="flex justify-between items-center text-xs font-bold border-t border-white/10 pt-4">
                        <span className="opacity-60 uppercase">Currently Recorded</span>
                        <span className={`text-lg font-mono ${Math.abs(paidTotal - calculations.totalGrandTotal) < 0.01 ? 'text-emerald-400' : 'text-white'}`}>${paidTotal.toFixed(2)}</span>
                    </div>
                </div>
              </div>
              <div className="space-y-4">
                {friends.map(f => {
                  const shareAmount = calculations.itemCosts[f.id] || 0;
                  return (
                    <div key={f.id} className={`p-4 rounded-2xl border-2 transition-all ${Math.abs((payments[f.id] || 0) - calculations.totalGrandTotal) < 0.01 ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-white shadow-sm'}`}>
                      <div className="flex items-center gap-3">
                          <div className="flex items-center gap-3 shrink-0">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600 text-xs">{f.name[0]}</div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-sm leading-none">{f.name}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase mt-1">Share: ${shareAmount.toFixed(2)}</span>
                              </div>
                          </div>
                          <div className="flex-1"></div>
                          <div className="flex items-center gap-2 shrink-0">
                              <div className="flex flex-col items-center gap-0.5">
                                  <button onClick={() => setSinglePayer(f.id)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95 border border-indigo-100 flex items-center justify-center" title="Mark as having paid the entire bill">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                  </button>
                                  <span className="text-[8px] font-black uppercase text-indigo-400 tracking-tighter whitespace-nowrap">Paid Full</span>
                              </div>
                              <div className="relative w-24">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                                  <input type="number" inputMode="decimal" value={payments[f.id] || ''} onChange={(e) => setPayments({...payments, [f.id]: parseFloat(e.target.value) || 0})} placeholder="0.00" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-right font-mono font-black text-slate-900 text-sm outline-none focus:border-indigo-500" />
                              </div>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-8 animate-in zoom-in-95 duration-500 flex-1 flex flex-col relative">
              <div className="text-center">
                <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-indigo-100 text-white mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Settlements</h2>
              </div>

              <button 
                onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
                className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight hover:text-indigo-700 transition-colors flex items-center gap-1 mx-auto mb-2"
              >
                {showDetailedBreakdown ? 'Hide Detailed Breakdown' : 'Show Detailed Breakdown'}
                <svg className={`w-3 h-3 transition-transform ${showDetailedBreakdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
              </button>

              {showDetailedBreakdown && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 mb-6">
                  {venues.map(v => {
                    const venueItems = items.filter(i => i.venueId === v.id);
                    if (venueItems.length === 0) return null;
                    const vt = calculations.venueTotals[v.id];

                    return (
                      <div key={v.id} className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{v.name} Breakdown</h4>
                        {friends.map(f => {
                          const friendItems = venueItems.filter(item => item.sharedWith.includes(f.id));
                          if (friendItems.length === 0) return null;

                          const subtotalWithTax = friendItems.reduce((acc, item) => {
                            const shareCount = item.sharedWith.length;
                            const baseShare = item.price / shareCount;
                            const taxRate = getItemTaxRate(item);
                            const taxShare = (item.price * taxRate) / shareCount;
                            return acc + baseShare + taxShare;
                          }, 0);
                          
                          // Proportional tip for this friend in this venue
                          const venueSubtotal = calculateItemTotals(venueItems).total;
                          const tipShare = venueSubtotal > 0 ? (subtotalWithTax / venueSubtotal) * vt.effectiveTip : 0;
                          const totalForFriendInVenue = subtotalWithTax + tipShare;

                          return (
                            <div key={f.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                              <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                                <span className="font-black text-slate-800 text-[10px] uppercase">{f.name}</span>
                                <span className="font-black text-indigo-600 text-[10px]">${totalForFriendInVenue.toFixed(2)}</span>
                              </div>
                              <div className="space-y-1">
                                {friendItems.map(item => (
                                  <div key={item.id} className="flex justify-between text-[9px] text-slate-500">
                                    <span className="flex-1 truncate mr-2">{item.name} (1/{item.sharedWith.length})</span>
                                    <span className="font-mono">${((item.price * (1 + getItemTaxRate(item))) / item.sharedWith.length).toFixed(2)}</span>
                                  </div>
                                ))}
                                {Math.abs(tipShare) > 0.005 && (
                                  <div className="flex justify-between text-[9px] text-indigo-400 font-bold pt-1 border-t border-slate-200 mt-1">
                                    <span>Tip & Adjustments</span>
                                    <span className="font-mono">{tipShare >= 0 ? '+' : ''}${tipShare.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-4 flex-1">
                {calculations.settlements.length > 0 ? (
                  <div className="space-y-3">
                    {calculations.settlements.map((s, idx) => (
                        <div key={idx} className="bg-slate-50 p-6 rounded-[2.5rem] flex items-center justify-between border border-slate-100 shadow-sm relative group hover:border-indigo-300 transition-all">
                          <div className="flex-1">
                            <span className="font-black text-slate-900 text-lg block leading-none">{s.fromName}</span>
                            <div className="flex items-center gap-3 text-slate-400 my-4">
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Pays to</span>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </div>
                            <span className="font-black text-indigo-600 text-lg block leading-none">{s.toName}</span>
                          </div>
                          <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter shrink-0">${s.amount.toFixed(2)}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                    <BotIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="font-black text-slate-400 uppercase text-sm tracking-widest">No transfers needed!</p>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">e-Transfer Email (Optional)</label>
                <div className="relative">
                  <input type="email" value={etransferEmail} onChange={(e) => setEtransferEmail(e.target.value)} placeholder="name@example.com" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold shadow-sm focus:border-indigo-500 outline-none transition-all" />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z"/></svg></div>
                </div>
              </div>
              
              <div className="pt-4 pb-4 space-y-3">
                <div className="flex gap-3">
                  <button onClick={shareResults} className="flex-1 flex items-center justify-center gap-3 bg-indigo-600 text-white px-4 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                    Share
                  </button>
                  <button onClick={copyToClipboard} className={`flex-1 flex items-center justify-center gap-3 border-2 px-4 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest transition-all ${copyFeedback ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600'}`}>
                    {copyFeedback ? (
                      <svg className="w-5 h-5 animate-in zoom-in duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    )}
                    {copyFeedback ? 'Copied!' : 'Copy Text'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="p-8 bg-white border-t border-slate-100 flex flex-col gap-4 sticky bottom-0 z-[60]">
          <div className="flex gap-4">
            {step > 1 && <button onClick={prevStep} className="flex-1 bg-white border-2 border-slate-200 text-slate-400 font-black py-4 rounded-2xl hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest">Back</button>}
            <button onClick={step === 5 ? () => window.location.reload() : nextStep} disabled={step === 1 && friends.length < 2} className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-xl transition-all ${ (step === 1 && friends.length < 2) ? 'bg-slate-300 shadow-none grayscale opacity-50' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]' }`}>
              {step === 5 ? 'New Bill Split 🤖' : 'Next Step'}
            </button>
          </div>
          <div className="text-center pt-2">
            <p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] pointer-events-none whitespace-nowrap">
              - made by wubdubs -
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
