import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// AIRTABLE CONFIG
// Replace these values after setting up your Airtable base.
// See DEPLOY_INSTRUCTIONS.md for step-by-step setup guide.
// ─────────────────────────────────────────────────────────────────────────────
const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.REACT_APP_AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE   = "RSVPs";

// ─── Airtable helpers ─────────────────────────────────────────────────────────
async function airtableSaveRSVP(record) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    // Fallback to localStorage during local dev / before Airtable is configured
    const existing = JSON.parse(localStorage.getItem("cf-rsvps") || "[]");
    localStorage.setItem("cf-rsvps", JSON.stringify([...existing, record]));
    return { error: null };
  }
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            "First Name":            record.first_name,
            "Last Name":             record.last_name,
            "Email":                 record.email,
            "Phone":                 record.phone || "",
            "Plus Count":            record.plus_count,
            "Guest Names":           (record.guests || []).join(", "),
            "Host Dietary":          record.host_waiver?.diet || "No restrictions",
            "Guest Dietary":         (record.guest_waivers || []).map((gw, i) =>
                                       `${record.guests[i]}: ${gw?.diet || "No restrictions"}`).join(" | "),
            "Host Waiver Signed":    record.host_waiver?.waiverSigned ? true : false,
            "Host Signature":        record.host_waiver?.signature || "",
            "Host Waiver Timestamp": record.host_waiver?.waiverTimestamp || "",
            "Guest Waivers":         (record.guest_waivers || []).map((gw, i) =>
                                       `${record.guests[i]}: ${gw?.signature || ""} (${gw?.waiverTimestamp || ""})`).join(" | "),
            "Total in Party":        1 + (record.plus_count || 0),
            "Submitted At":          record.submitted_at,
          },
        }),
      }
    );
    if (!res.ok) { const err = await res.json(); console.error("Airtable error:", JSON.stringify(err)); return { error: err }; }
    return { error: null };
  } catch (e) {
    console.error("Airtable fetch failed:", e.message);
    return { error: e.message };
  }
}

async function airtableLoadRSVPs() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return { data: JSON.parse(localStorage.getItem("cf-rsvps") || "[]") };
  }
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?sort[0][field]=Submitted+At&sort[0][direction]=desc`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    if (!res.ok) return { data: [], error: "Failed to load" };
    const json = await res.json();
    const data = (json.records || []).map(r => ({
      id:           r.id,
      first_name:   r.fields["First Name"],
      last_name:    r.fields["Last Name"],
      email:        r.fields["Email"],
      phone:        r.fields["Phone"],
      plus_count:   r.fields["Plus Count"] || 0,
      guests:       r.fields["Guest Names"] ? r.fields["Guest Names"].split(", ").filter(Boolean) : [],
      host_waiver:  { diet: r.fields["Host Dietary"], signature: r.fields["Host Signature"], waiverSigned: r.fields["Host Waiver Signed"], waiverTimestamp: r.fields["Host Waiver Timestamp"] },
      guest_waivers: [],
      submitted_at: r.fields["Submitted At"],
    }));
    return { data };
  } catch (e) {
    return { data: [], error: e.message };
  }
}

// ─── Admin URL detection ──────────────────────────────────────────────────────
const IS_ADMIN = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("admin") !== null;

// ─── Waiver Text ──────────────────────────────────────────────────────────────
const WAIVER_TEXT = `COLLIER FALLS WINE CLUB — PREMISES LIABILITY WAIVER & RELEASE OF LIABILITY

Event: 1st Annual Wine Club Release Party
Date: April 18, 2026 | 1:00 PM – 4:00 PM
Location: Collier Falls Ranch ("the Property")

By signing below, I ("Guest") acknowledge and agree to the following terms as a condition of my attendance at the above event ("Event"):

1. ASSUMPTION OF RISK
I understand that Collier Falls is a working ranch and that attendance at the Event involves certain inherent risks, including but not limited to: slips, trips, and falls on uneven terrain; contact with livestock or ranch animals; exposure to natural water features; contact with other guests or staff; participation in activities offered at the Event; exposure to outdoor conditions; and any other risks associated with attendance at a working ranch property. I voluntarily assume all such risks.

2. RELEASE OF LIABILITY
In consideration of being permitted to attend the Event, I hereby release, waive, discharge, and covenant not to sue the event organizers, property owners, Collier Falls Ranch, its staff, sponsors, volunteers, and their respective agents, officers, directors, employees, and successors (collectively, "Released Parties") from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, injury, or death that may be sustained by me while on or about the Property, or while traveling to or from the Event.

3. INDEMNIFICATION
I agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or costs they may incur as a result of my attendance at the Event, whether caused by my negligence or otherwise.

4. MEDICAL AUTHORIZATION
In the event of an emergency, I authorize the Released Parties to seek medical treatment on my behalf if I am unable to do so, and I accept full financial responsibility for any such treatment.

5. PHOTO & MEDIA RELEASE
I consent to the use of my image, likeness, or voice in photographs or video recordings taken at the Event for promotional or archival purposes by Collier Falls Wine Club.

6. ACKNOWLEDGMENT
I confirm that I am 18 years of age or older (or have a parent/guardian signing on my behalf), that I have read this waiver in its entirety, and that I understand its terms. I sign this waiver freely and voluntarily, without coercion.`;

const DIETARY_OPTIONS = ["No restrictions","Vegetarian","Vegan","Gluten-free","Kosher","Halal","Nut allergy","Dairy-free","Other"];

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  width:"100%", boxSizing:"border-box",
  background:"rgba(255,255,255,0.05)",
  border:"1px solid rgba(255,255,255,0.12)",
  borderRadius:8, padding:"12px 14px",
  color:"#e8e0d0", fontSize:15,
  fontFamily:"'DM Sans', sans-serif",
  outline:"none", transition:"border-color 0.2s",
};
const labelStyle = {
  display:"block", fontFamily:"'DM Sans', sans-serif",
  fontSize:12, letterSpacing:"0.12em", textTransform:"uppercase",
  color:"rgba(212,175,55,0.8)", marginBottom:8, fontWeight:500,
};
const selectStyle = { ...inputStyle, cursor:"pointer", appearance:"none", WebkitAppearance:"none" };
const btnStyle = {
  background:"linear-gradient(135deg, #d4af37, #b8922a)",
  color:"#1a1206", border:"none", borderRadius:8,
  padding:"14px 28px", fontSize:14, fontWeight:700,
  fontFamily:"'DM Sans', sans-serif", letterSpacing:"0.08em",
  textTransform:"uppercase", cursor:"pointer",
  transition:"all 0.2s", boxShadow:"0 4px 20px rgba(212,175,55,0.3)",
};

// ─── WaiverForm ───────────────────────────────────────────────────────────────
// ─── Field component (must be outside App to prevent focus loss on re-render) ─
function Field({ label, name, placeholder, type="text", half, rsvpData, setRsvpData, errors, setErrors }) {
  return (
    <div style={{ flex: half ? "0 0 calc(50% - 6px)" : "1 1 100%", marginBottom:16 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={rsvpData[name]}
        onChange={e => {
          setRsvpData(d => ({...d, [name]: e.target.value}));
          setErrors(er => ({...er, [name]: undefined}));
        }}
        style={{ ...inputStyle, borderColor: errors[name] ? "#e05252" : "rgba(255,255,255,0.12)" }}
      />
      {errors[name] && <div style={{ color:"#e05252", fontSize:11, marginTop:4 }}>{errors[name]}</div>}
    </div>
  );
}

function WaiverForm({ name, email, isGuest=false, guestIndex=null, onComplete }) {
  const [scrolled,   setScrolled]   = useState(false);
  const [checked,    setChecked]    = useState(false);
  const [signature,  setSignature]  = useState("");
  const [diet,       setDiet]       = useState("No restrictions");
  const [dietOther,  setDietOther]  = useState("");
  const waiverRef = useRef(null);

  const handleScroll = () => {
    const el = waiverRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setScrolled(true);
  };

  const canSubmit = scrolled && checked && signature.trim().length > 1;

  return (
    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:12, padding:"28px 32px", marginBottom:24 }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:13, letterSpacing:"0.2em", textTransform:"uppercase", color:"#d4af37", marginBottom:4 }}>
          {isGuest ? `Guest ${guestIndex + 1} Waiver` : "Your Liability Waiver"}
        </div>
        <div style={{ fontSize:15, color:"#e8e0d0", fontWeight:500, fontFamily:"'DM Sans', sans-serif" }}>{name}</div>
        {!isGuest && <div style={{ fontSize:13, color:"rgba(232,224,208,0.5)", marginTop:2 }}>{email}</div>}
      </div>

      {/* Dietary */}
      <div style={{ marginBottom:20 }}>
        <label style={labelStyle}>Dietary Restrictions</label>
        <select value={diet} onChange={e => setDiet(e.target.value)} style={selectStyle}>
          {DIETARY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {diet === "Other" && (
          <input placeholder="Please specify..." value={dietOther} onChange={e => setDietOther(e.target.value)} style={{ ...inputStyle, marginTop:8 }} />
        )}
      </div>

      {/* Property notice */}
      <div style={{ background:"rgba(180,120,20,0.1)", border:"1px solid rgba(212,175,55,0.25)", borderRadius:8, padding:"14px 16px", marginBottom:16, display:"flex", gap:10, alignItems:"flex-start" }}>
        <span style={{ fontSize:16, flexShrink:0 }}>🌾</span>
        <div>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#d4af37", marginBottom:4, fontFamily:"'DM Sans', sans-serif" }}>About the Property</div>
          <p style={{ fontSize:13, color:"rgba(232,224,208,0.75)", lineHeight:1.6, fontFamily:"'DM Sans', sans-serif", margin:0 }}>
            Collier Falls is a working ranch. As our guest, please be aware that the property contains inherent risks including uneven terrain, livestock areas, natural water features, and rural ranch conditions. Please watch your step and follow all posted guidelines while on the property.
          </p>
        </div>
      </div>

      {/* Waiver scroll */}
      <div style={{ marginBottom:16 }}>
        <label style={labelStyle}>Read & Acknowledge Waiver</label>
        <div ref={waiverRef} onScroll={handleScroll} style={{
          height:180, overflowY:"scroll",
          background:"rgba(0,0,0,0.3)",
          border:`1px solid ${scrolled ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.1)"}`,
          borderRadius:8, padding:"14px 16px",
          fontFamily:"'DM Sans', sans-serif", fontSize:11.5, lineHeight:1.7,
          color:"rgba(232,224,208,0.7)", whiteSpace:"pre-wrap", transition:"border-color 0.3s",
        }}>{WAIVER_TEXT}</div>
        {!scrolled && <div style={{ fontSize:11, color:"#d4af37", marginTop:6, fontFamily:"'DM Sans', sans-serif" }}>↓ Please scroll to the bottom to continue</div>}
      </div>

      {/* Checkbox */}
      <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginBottom:16, opacity: scrolled ? 1 : 0.4, transition:"opacity 0.3s" }}>
        <div onClick={() => scrolled && setChecked(!checked)} style={{
          width:20, height:20, borderRadius:4,
          border:`2px solid ${checked ? "#d4af37" : "rgba(255,255,255,0.3)"}`,
          background: checked ? "#d4af37" : "transparent", flexShrink:0, marginTop:1,
          display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s",
        }}>
          {checked && <span style={{ color:"#1a1206", fontSize:13, fontWeight:700 }}>✓</span>}
        </div>
        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, color:"rgba(232,224,208,0.8)", lineHeight:1.5 }}>
          I have read, understand, and agree to the Premises Liability Waiver and Release of Liability above.
        </span>
      </label>

      {/* Signature */}
      <div style={{ marginBottom:20 }}>
        <label style={labelStyle}>Electronic Signature <span style={{ color:"rgba(232,224,208,0.4)", fontWeight:400 }}>(type your full legal name)</span></label>
        <input
          placeholder={`e.g. ${name || "Full Name"}`}
          value={signature} onChange={e => setSignature(e.target.value)}
          disabled={!scrolled || !checked}
          style={{ ...inputStyle, fontFamily:"'Cormorant Garamond', serif", fontSize:18, fontStyle:"italic", opacity:(!scrolled || !checked) ? 0.4 : 1 }}
        />
      </div>

      <button
        onClick={() => canSubmit && onComplete({ diet: diet === "Other" ? (dietOther||"Other") : diet, signature, waiverSigned:true, waiverTimestamp:new Date().toISOString() })}
        disabled={!canSubmit}
        style={{ ...btnStyle, opacity: canSubmit ? 1 : 0.35, cursor: canSubmit ? "pointer" : "not-allowed", width:"100%" }}
      >
        {isGuest ? `Sign Waiver for Guest ${guestIndex + 1}` : "Sign My Waiver"}
      </button>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const [allRSVPs,   setAllRSVPs]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [unlocked,   setUnlocked]   = useState(false);
  const [passInput,  setPassInput]  = useState("");
  const [wrongPass,  setWrongPass]  = useState(false);
  const [loadError,  setLoadError]  = useState(null);

  const fetchRSVPs = () => {
    setLoading(true);
    airtableLoadRSVPs().then(({ data, error }) => {
      if (error) setLoadError(error);
      setAllRSVPs(data || []);
      setLoading(false);
    });
  };

  useEffect(() => { if (unlocked) fetchRSVPs(); }, [unlocked]);

  const totalGuests  = allRSVPs.reduce((s, r) => s + 1 + (r.plus_count || 0), 0);
  const totalWaivers = allRSVPs.reduce((s, r) => s + 1 + (r.guest_waivers?.length || 0), 0);

  const dietMap = {};
  allRSVPs.forEach(r => {
    const d = r.host_waiver?.diet || "No restrictions";
    if (d !== "No restrictions") dietMap[d] = (dietMap[d]||0) + 1;
  });

  const tryUnlock = () => {
    if (passInput === "releaseParty2026") { setUnlocked(true); setWrongPass(false); }
    else setWrongPass(true);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0c07", backgroundImage:"radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.12) 0%, transparent 70%)", padding:"60px 16px", color:"#e8e0d0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:720, margin:"0 auto" }}>
        <div style={{ marginBottom:36 }}>
          <div style={{ fontSize:11, letterSpacing:"0.4em", textTransform:"uppercase", color:"#d4af37", marginBottom:10 }}>Admin · Collier Falls</div>
          <h1 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:36, fontWeight:300, color:"#e8d08a", lineHeight:1.2 }}>
            Wine Club Release Party<br/>
            <span style={{ fontSize:20, opacity:0.55 }}>RSVP Dashboard</span>
          </h1>
        </div>

        {!unlocked ? (
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.15)", borderRadius:16, padding:"48px", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:16 }}>🔐</div>
            <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:24, color:"#e8d08a", marginBottom:20 }}>Admin Access Required</div>
            <input type="password" placeholder="Enter password" value={passInput}
              onChange={e => { setPassInput(e.target.value); setWrongPass(false); }}
              onKeyDown={e => e.key === "Enter" && tryUnlock()}
              style={{ ...inputStyle, maxWidth:280, margin:"0 auto 12px", display:"block", textAlign:"center" }}
            />
            {wrongPass && <div style={{ color:"#e05252", fontSize:13, marginBottom:12, fontFamily:"'DM Sans', sans-serif" }}>Incorrect password.</div>}
            <button onClick={tryUnlock} style={btnStyle}>Unlock Dashboard</button>
          </div>
        ) : loading ? (
          <div style={{ textAlign:"center", padding:80, color:"rgba(232,224,208,0.3)", fontFamily:"'DM Sans', sans-serif" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>Loading RSVPs from Airtable…
          </div>
        ) : (
          <>
            {loadError && (
              <div style={{ background:"rgba(224,82,82,0.1)", border:"1px solid rgba(224,82,82,0.25)", borderRadius:10, padding:"14px 18px", marginBottom:20, fontSize:13, color:"#e05252", fontFamily:"'DM Sans', sans-serif" }}>
                ⚠️ Could not load from Airtable: {loadError}
              </div>
            )}

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
              {[{label:"RSVPs",value:allRSVPs.length,icon:"📋"},{label:"Total Guests",value:totalGuests,icon:"👥"},{label:"Waivers",value:totalWaivers,icon:"✍️"}].map(s => (
                <div key={s.label} style={{ background:"rgba(212,175,55,0.07)", border:"1px solid rgba(212,175,55,0.18)", borderRadius:12, padding:"18px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:38, color:"#d4af37", lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"rgba(232,224,208,0.4)", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:6 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Dietary */}
            {Object.keys(dietMap).length > 0 && (
              <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px 20px", marginBottom:20 }}>
                <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(212,175,55,0.6)", marginBottom:10 }}>Dietary Needs</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {Object.entries(dietMap).map(([d,n]) => (
                    <span key={d} style={{ background:"rgba(212,175,55,0.1)", border:"1px solid rgba(212,175,55,0.2)", borderRadius:100, padding:"4px 12px", fontSize:13, color:"#d4af37", fontFamily:"'DM Sans', sans-serif" }}>
                      🍽️ {d} × {n}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(212,175,55,0.6)" }}>Guest List</div>
              <button onClick={fetchRSVPs} style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"5px 12px", color:"rgba(232,224,208,0.45)", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
                ↻ Refresh
              </button>
            </div>

            {allRSVPs.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:"rgba(232,224,208,0.25)", fontFamily:"'DM Sans', sans-serif", background:"rgba(255,255,255,0.02)", borderRadius:12 }}>
                No RSVPs yet. Share your link to get started!
              </div>
            ) : allRSVPs.map((r, i) => (
              <div key={r.id||i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(212,175,55,0.1)", borderRadius:12, padding:"20px 24px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:18, color:"#e8d08a" }}>{r.first_name} {r.last_name}</div>
                    <div style={{ fontSize:13, color:"rgba(232,224,208,0.45)", marginTop:2, fontFamily:"'DM Sans', sans-serif" }}>{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:12, color:"rgba(232,224,208,0.35)", fontFamily:"'DM Sans', sans-serif" }}>
                    <div>Party of {1 + (r.plus_count||0)}</div>
                    <div>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}</div>
                  </div>
                </div>
                {r.guests?.length > 0 && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.05)", fontSize:13, color:"rgba(232,224,208,0.5)", fontFamily:"'DM Sans', sans-serif" }}>
                    {r.host_waiver?.diet && r.host_waiver.diet !== "No restrictions" && <span style={{ marginRight:12 }}>🍽️ {r.first_name}: {r.host_waiver.diet}</span>}
                    {(r.guests||[]).map((g,j) => <span key={j} style={{ marginRight:12 }}>· {g}</span>)}
                  </div>
                )}
                <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
                  <span style={{ background:"rgba(60,180,100,0.1)", border:"1px solid rgba(60,180,100,0.2)", borderRadius:100, padding:"3px 10px", fontSize:11, color:"#5de89a", fontFamily:"'DM Sans', sans-serif" }}>✓ Host waiver</span>
                  {(r.guest_waivers||[]).map((_,j) => (
                    <span key={j} style={{ background:"rgba(60,180,100,0.1)", border:"1px solid rgba(60,180,100,0.2)", borderRadius:100, padding:"3px 10px", fontSize:11, color:"#5de89a", fontFamily:"'DM Sans', sans-serif" }}>✓ Guest {j+1} waiver</span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <style>{`input:focus { border-color: rgba(212,175,55,0.5) !important; }`}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  if (IS_ADMIN) return <AdminPanel />;

  const [step,          setStep]          = useState("rsvp");
  const [rsvpData,      setRsvpData]      = useState({ firstName:"", lastName:"", email:"", phone:"", plusCount:"0", guests:[] });
  const [errors,        setErrors]        = useState({});
  const [hostWaiver,    setHostWaiver]    = useState(null);
  const [guestWaivers,  setGuestWaivers]  = useState([]);
  const [totalConfirmed,setTotalConfirmed]= useState(0);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState(null);

  useEffect(() => {
    airtableLoadRSVPs().then(({ data }) => {
      if (data) setTotalConfirmed(data.reduce((s,r) => s + 1 + (r.plus_count||0), 0));
    });
  }, []);

  const plusCount = parseInt(rsvpData.plusCount) || 0;

  const validateRSVP = () => {
    const e = {};
    if (!rsvpData.firstName.trim()) e.firstName = "Required";
    if (!rsvpData.lastName.trim())  e.lastName  = "Required";
    if (!rsvpData.email.trim() || !/\S+@\S+\.\S+/.test(rsvpData.email)) e.email = "Valid email required";
    rsvpData.guests.forEach((g,i) => { if (!g.trim()) e[`guest_${i}`] = "Required"; });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePlusCountChange = (val) => {
    const n = Math.max(0, Math.min(10, parseInt(val)||0));
    setRsvpData(d => ({ ...d, plusCount:String(n), guests:Array.from({length:n},(_,i) => d.guests[i]||"") }));
  };

  const allWaiversSigned = () => hostWaiver && guestWaivers.length >= plusCount;

  const handleSubmit = async () => {
    if (!allWaiversSigned() || submitting) return;
    setSubmitting(true); setSubmitError(null);
    const record = {
      id: Date.now(),
      submitted_at:  new Date().toISOString(),
      first_name:    rsvpData.firstName,
      last_name:     rsvpData.lastName,
      email:         rsvpData.email,
      phone:         rsvpData.phone,
      plus_count:    plusCount,
      guests:        rsvpData.guests,
      host_waiver:   hostWaiver,
      guest_waivers: guestWaivers,
    };
    const { error } = await airtableSaveRSVP(record);
    setSubmitting(false);
    if (error) { setSubmitError("Airtable error: " + (typeof error === "object" ? JSON.stringify(error) : error)); return; }
    setTotalConfirmed(c => c + 1 + plusCount);
    setStep("confirm");
  };



  return (
    <div style={{
      minHeight:"100vh", background:"#0f0c07",
      backgroundImage:`
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 80% 80%, rgba(180,120,20,0.08) 0%, transparent 60%),
        radial-gradient(ellipse 30% 50% at 10% 60%, rgba(100,60,10,0.06) 0%, transparent 60%)
      `,
      fontFamily:"'DM Sans', sans-serif", color:"#e8e0d0", padding:"0 16px 80px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet" />

      <div style={{ height:3, background:"linear-gradient(90deg, transparent, #d4af37 30%, #b8922a 70%, transparent)" }} />

      {/* ── Header ── */}
      <div style={{ textAlign:"center", padding:"60px 0 48px" }}>
        <div style={{ fontSize:11, letterSpacing:"0.5em", textTransform:"uppercase", color:"#d4af37", marginBottom:14, fontWeight:500 }}>
          April 18, 2026 · 1:00 – 4:00 PM
        </div>
        <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:13, letterSpacing:"0.3em", textTransform:"uppercase", color:"rgba(212,175,55,0.45)", marginBottom:10 }}>
          Collier Falls
        </div>
        <h1 style={{
          fontFamily:"'Cormorant Garamond', serif",
          fontSize:"clamp(30px, 6.5vw, 58px)",
          fontWeight:300, lineHeight:1.15, margin:"0 0 4px",
          background:"linear-gradient(160deg, #f0e0a0 0%, #d4af37 50%, #b8922a 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>
          Wine Club<br />Release Party
        </h1>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, margin:"22px 0" }}>
          <div style={{ height:1, width:40, background:"linear-gradient(90deg, transparent, rgba(212,175,55,0.5))" }} />
          <div style={{ fontSize:16, color:"rgba(212,175,55,0.5)" }}>✦</div>
          <div style={{ height:1, width:40, background:"linear-gradient(90deg, rgba(212,175,55,0.5), transparent)" }} />
        </div>

        {/* ── Event description ── */}
        <div style={{ maxWidth:500, margin:"0 auto" }}>
          <p style={{ fontSize:17, color:"rgba(232,224,208,0.85)", lineHeight:1.8, fontWeight:300, margin:"0 0 14px" }}>
            Join us for our 1st Annual Wine Club Release Party!
          </p>
          <p style={{ fontSize:15, color:"rgba(232,224,208,0.58)", lineHeight:1.8, fontWeight:300, margin:"0 0 14px" }}>
            Come hungry! We'll have a taco truck onsite and be pouring our new release wines and old favorites.
          </p>
          <p style={{ fontSize:15, color:"rgba(232,224,208,0.58)", lineHeight:1.8, fontWeight:300, margin:0 }}>
            And for the adventurous, we welcome you to take advantage of our namesake waterfall for a spring cold plunge 🌊
          </p>
        </div>

        {/* Live headcount badge */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:8,
          background:"rgba(212,175,55,0.08)", border:"1px solid rgba(212,175,55,0.2)",
          borderRadius:100, padding:"9px 22px", marginTop:30,
          fontSize:13, color:"#d4af37", fontWeight:500,
        }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"#d4af37", display:"inline-block", animation:"pulse 2s infinite" }} />
          {totalConfirmed} {totalConfirmed === 1 ? "guest" : "guests"} confirmed
        </div>
      </div>

      <div style={{ maxWidth:580, margin:"0 auto" }}>

        {/* ── Step 1: RSVP Form ── */}
        {step === "rsvp" && (
          <div style={{ animation:"fadeUp 0.5s ease" }}>
            <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(212,175,55,0.15)", borderRadius:16, padding:"36px 38px" }}>
              <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:26, fontWeight:400, marginBottom:6, color:"#e8d08a" }}>Secure Your Spot</div>
              <div style={{ fontSize:13, color:"rgba(232,224,208,0.35)", marginBottom:28 }}>All fields required unless noted</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"0 12px" }}>
                <Field label="First Name" name="firstName" placeholder="First" half rsvpData={rsvpData} setRsvpData={setRsvpData} errors={errors} setErrors={setErrors} />
                <Field label="Last Name"  name="lastName"  placeholder="Last"  half rsvpData={rsvpData} setRsvpData={setRsvpData} errors={errors} setErrors={setErrors} />
                <Field label="Email Address" name="email" placeholder="you@email.com" type="email" rsvpData={rsvpData} setRsvpData={setRsvpData} errors={errors} setErrors={setErrors} />
                <Field label="Phone" name="phone" placeholder="+1 (555) 000-0000  (optional)" type="tel" rsvpData={rsvpData} setRsvpData={setRsvpData} errors={errors} setErrors={setErrors} />
              </div>

              <div style={{ marginBottom:24 }}>
                <label style={labelStyle}>Bringing Guests?</label>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <button onClick={() => handlePlusCountChange(plusCount-1)} style={{ width:40, height:40, borderRadius:8, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#e8e0d0", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                  <span style={{ fontSize:24, fontFamily:"'Cormorant Garamond', serif", minWidth:32, textAlign:"center", color:"#e8d08a" }}>{plusCount}</span>
                  <button onClick={() => handlePlusCountChange(plusCount+1)} style={{ width:40, height:40, borderRadius:8, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"#e8e0d0", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  <span style={{ fontSize:13, color:"rgba(232,224,208,0.4)" }}>
                    {plusCount === 0 ? "Just me attending" : `+${plusCount} additional guest${plusCount>1?"s":""}`}
                  </span>
                </div>
              </div>

              {plusCount > 0 && (
                <div style={{ marginBottom:20 }}>
                  <label style={labelStyle}>Guest Names</label>
                  {rsvpData.guests.map((g,i) => (
                    <div key={i} style={{ marginBottom:8 }}>
                      <input placeholder={`Guest ${i+1} full name`} value={g}
                        onChange={e => {
                          const gs=[...rsvpData.guests]; gs[i]=e.target.value;
                          setRsvpData(d=>({...d,guests:gs}));
                          setErrors(er=>({...er,[`guest_${i}`]:undefined}));
                        }}
                        style={{ ...inputStyle, borderColor: errors[`guest_${i}`] ? "#e05252" : "rgba(255,255,255,0.12)" }}
                      />
                      {errors[`guest_${i}`] && <div style={{ color:"#e05252", fontSize:11, marginTop:4 }}>Required</div>}
                    </div>
                  ))}
                  <div style={{ fontSize:12, color:"rgba(212,175,55,0.55)", marginTop:10, lineHeight:1.6 }}>
                    Each guest will sign their own liability waiver in the next step.
                  </div>
                </div>
              )}

              <button onClick={() => validateRSVP() && setStep("waivers")} style={{ ...btnStyle, width:"100%", padding:"16px 28px", marginTop:4 }}>
                Continue to Waiver →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Waivers ── */}
        {step === "waivers" && (
          <div style={{ animation:"fadeUp 0.5s ease" }}>
            <div style={{ marginBottom:28 }}>
              <div style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:30, color:"#e8d08a", marginBottom:8 }}>Liability Waivers</div>
              <p style={{ fontSize:14, color:"rgba(232,224,208,0.45)", lineHeight:1.65 }}>
                All attendees must sign before arriving. Please complete {plusCount>0 ? `all ${1+plusCount} waivers` : "your waiver"} below.
              </p>
            </div>

            {plusCount > 0 && (
              <div style={{ display:"flex", gap:6, marginBottom:24 }}>
                {[rsvpData.firstName, ...rsvpData.guests].map((name,i) => {
                  const signed = i===0 ? !!hostWaiver : !!guestWaivers[i-1];
                  return (
                    <div key={i} style={{ flex:1, background: signed?"rgba(60,180,100,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${signed?"rgba(60,180,100,0.3)":"rgba(255,255,255,0.08)"}`, borderRadius:6, padding:"6px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:10, color: signed?"#5de89a":"rgba(232,224,208,0.3)", fontFamily:"'DM Sans', sans-serif", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                        {signed?"✓ ":""}{name.split(" ")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!hostWaiver ? (
              <WaiverForm name={`${rsvpData.firstName} ${rsvpData.lastName}`} email={rsvpData.email} onComplete={setHostWaiver} />
            ) : (
              <div style={{ background:"rgba(60,180,100,0.06)", border:"1px solid rgba(60,180,100,0.25)", borderRadius:12, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(60,180,100,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:"#5de89a" }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#5de89a", fontFamily:"'DM Sans', sans-serif" }}>Your waiver signed</div>
                  <div style={{ fontSize:12, color:"rgba(232,224,208,0.4)" }}>{rsvpData.firstName} {rsvpData.lastName} · {new Date(hostWaiver.waiverTimestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            )}

            {rsvpData.guests.map((gName,i) => (
              guestWaivers[i] ? (
                <div key={i} style={{ background:"rgba(60,180,100,0.06)", border:"1px solid rgba(60,180,100,0.25)", borderRadius:12, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(60,180,100,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ color:"#5de89a" }}>✓</span>
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#5de89a", fontFamily:"'DM Sans', sans-serif" }}>Guest {i+1} waiver signed</div>
                    <div style={{ fontSize:12, color:"rgba(232,224,208,0.4)" }}>{gName} · {new Date(guestWaivers[i].waiverTimestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ) : hostWaiver && (
                <WaiverForm key={i} name={gName} isGuest guestIndex={i} onComplete={(data) => {
                  const updated=[...guestWaivers]; updated[i]=data; setGuestWaivers(updated);
                }} />
              )
            ))}

            {allWaiversSigned() && (
              <div>
                {submitError && (
                  <div style={{ background:"rgba(224,82,82,0.1)", border:"1px solid rgba(224,82,82,0.3)", borderRadius:8, padding:"12px 16px", marginBottom:14, fontSize:14, color:"#e05252", fontFamily:"'DM Sans', sans-serif" }}>
                    {submitError}
                  </div>
                )}
                <button onClick={handleSubmit} disabled={submitting} style={{ ...btnStyle, width:"100%", fontSize:15, padding:"17px 28px", opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? "Saving your RSVP…" : "Confirm My RSVP ✓"}
                </button>
              </div>
            )}

            <button onClick={() => setStep("rsvp")} style={{ background:"none", border:"none", color:"rgba(232,224,208,0.3)", fontSize:13, cursor:"pointer", marginTop:18, display:"block", width:"100%", textAlign:"center", fontFamily:"'DM Sans', sans-serif" }}>
              ← Edit RSVP details
            </button>
          </div>
        )}

        {/* ── Step 3: Confirmation ── */}
        {step === "confirm" && (
          <div style={{ textAlign:"center", animation:"fadeUp 0.6s ease", padding:"48px 20px" }}>
            <div style={{ fontSize:60, marginBottom:24, filter:"drop-shadow(0 0 20px rgba(212,175,55,0.35))" }}>🍷</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:46, fontWeight:300, color:"#e8d08a", margin:"0 0 14px", lineHeight:1.1 }}>
              You're on the list.
            </h2>
            <p style={{ fontSize:16, color:"rgba(232,224,208,0.6)", maxWidth:420, margin:"0 auto 36px", lineHeight:1.8, fontWeight:300 }}>
              See you April 18th, {rsvpData.firstName}!{" "}
              {plusCount > 0 ? `You and your ${plusCount} guest${plusCount>1?"s are":" is"} all confirmed. ` : ""}
              We can't wait to celebrate with you at Collier Falls.
            </p>
            <div style={{ background:"rgba(212,175,55,0.07)", border:"1px solid rgba(212,175,55,0.18)", borderRadius:14, padding:"22px 32px", display:"inline-block", textAlign:"left", minWidth:280 }}>
              <div style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"#d4af37", marginBottom:14 }}>Your Confirmation</div>
              <div style={{ fontSize:14, color:"rgba(232,224,208,0.7)", lineHeight:2.2, fontFamily:"'DM Sans', sans-serif" }}>
                <div>📅 April 18, 2026 · 1:00 – 4:00 PM</div>
                <div>📍 Collier Falls Ranch</div>
                <div>📧 {rsvpData.email}</div>
                <div>👥 Party of {1+plusCount}</div>
                <div>📋 {1+plusCount} waiver{(1+plusCount)>1?"s":""} signed</div>
              </div>
            </div>
            <div style={{ marginTop:28, fontSize:13, color:"rgba(232,224,208,0.2)" }}>{totalConfirmed} total guests confirmed</div>

            {/* ── Add to Calendar ── */}
            <div style={{ marginTop:32 }}>
              <div style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"rgba(212,175,55,0.5)", marginBottom:14, fontFamily:"'DM Sans', sans-serif" }}>Add to Calendar</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                <a
                  href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Collier+Falls+Wine+Club+Release+Party&dates=20260418T130000/20260418T160000&details=1st+Annual+Wine+Club+Release+Party.+Taco+truck+onsite,+new+release+wines+and+old+favorites.+Cold+plunge+available!&location=Collier+Falls+Ranch"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display:"inline-flex", alignItems:"center", gap:8,
                    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)",
                    borderRadius:8, padding:"11px 20px", fontSize:13, fontWeight:500,
                    fontFamily:"'DM Sans', sans-serif", color:"#e8e0d0", textDecoration:"none",
                    transition:"all 0.2s",
                  }}
                >
                  <span>📅</span> Google Calendar
                </a>
                <a
                  href="data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:20260418T130000%0ADTEND:20260418T160000%0ASUMMARY:Collier+Falls+Wine+Club+Release+Party%0ADESCRIPTION:1st+Annual+Wine+Club+Release+Party.+Taco+truck+onsite%2C+new+release+wines+and+old+favorites.+Cold+plunge+available!%0ALOCATION:Collier+Falls+Ranch%0AEND:VEVENT%0AEND:VCALENDAR"
                  download="collier-falls-wine-party.ics"
                  style={{
                    display:"inline-flex", alignItems:"center", gap:8,
                    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)",
                    borderRadius:8, padding:"11px 20px", fontSize:13, fontWeight:500,
                    fontFamily:"'DM Sans', sans-serif", color:"#e8e0d0", textDecoration:"none",
                    transition:"all 0.2s",
                  }}
                >
                  <span>🍎</span> Apple / iCal
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        input:focus, select:focus { border-color: rgba(212,175,55,0.5) !important; }
        button:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.3); border-radius:2px; }
        select option { background:#1a1206; color:#e8e0d0; }
      `}</style>
    </div>
  );
}
