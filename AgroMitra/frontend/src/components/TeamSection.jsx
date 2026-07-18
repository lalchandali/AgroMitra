import React from 'react';
import lalchand from '../assets/lalchand.png'
import ashraful from '../assets/ashraful.png'
import shakil from '../assets/shakil.jpeg'


export default function TeamSection() {
    const teamMembers = [
        {
            name: " Md Lal Chand Ali",
            role: "Lead Full-Stack & AI Developer",
            university: "B.Sc. in Computer Science & Engineering\nUttara University",
            details: "Building AI-powered agricultural solutions using React, FastAPI, TensorFlow and PostgreSQL.",
            expertise: ["AI Integration", "Machine Learning", "REST API", "Smart Agriculture", "UI/UX Development"],
            contribution: ["9 AI Modules", "Crop Recommendation", "Price Prediction", "Weather Intelligence", "Marketplace Development"],
            skills: ["React", "FastAPI", "Python", "TensorFlow", "PostgreSQL", "Git"],
            github: "https://github.com/lalchandali",
            linkedin: "https://linkedin.com/in/lalchand-ali",
            tag: "Student",
            avatar: typeof lalchand !== 'undefined' ? lalchand : '👨‍💻',
        },
        {
            name: 'Md Shakil khan',
            role: 'Developer & Researcher',
            details: 'Full-stack development · AI/ML integration · React + FastAPI',
            skills: ["React", "FastAPI", "Python"],
            github: "#",
            linkedin: "#",
            tag: 'Student',
            avatar: typeof shakil !== 'undefined' ? shakil : '👨‍💻',
        },
        {
            name: 'Shakil khan',
            role: 'Developer & Researcher',
            details: 'Full-stack development · AI/ML integration · React + FastAPI',
            skills: ["React", "FastAPI"],
            github: "#",
            linkedin: "#",
            tag: 'Student',
            avatar: typeof shakil !== 'undefined' ? shakil : '👨‍💻',
        },
        {
            name: 'Lal Chand Ali',
            role: 'Developer & Researcher',
            details: 'Full-stack development · AI/ML integration · React + FastAPI',
            skills: ["React", "FastAPI"],
            github: "#",
            linkedin: "#",
            tag: 'Student',
            avatar: typeof lalchand !== 'undefined' ? lalchand : '👨‍💻',
        },
        {
            name: 'Lal Chand Ali',
            role: 'Developer & Researcher',
            details: 'Full-stack development · AI/ML integration · React + FastAPI',
            skills: ["React", "FastAPI"],
            github: "#",
            linkedin: "#",
            tag: 'Student',
            avatar: typeof lalchand !== 'undefined' ? lalchand : '👨‍💻',
        },
        {
            name: 'Md. Ashraful Kabir',
            role: 'Project Supervisor',
            details: 'Department of CSE · Uttara University, Dhaka',
            skills: ["Research", "Guidance", "AI/ML"],
            github: "#",
            linkedin: "#",
            tag: 'Supervisor',
            avatar: typeof ashraful !== 'undefined' ? ashraful : '👨‍🏫',
        },
    ];

    return (
        <section className="am-section am-reveal" style={{ padding: '60px 20px', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', borderRadius: '12px' }}>

            {/* Head Section */}
            <div className="am-section-head" style={{ textAlign: 'center', marginBottom: 50 }}>
                <div className="am-section-eyebrow" style={{ color: '#38bdf8', fontSize: 14, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                    Uttara University — CSE Department
                </div>
                <h2 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px 0', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Meet the Team
                </h2>
                <p className="am-section-sub" style={{ color: '#94a3b8', fontSize: 15, margin: 0 }}>
                    Final year project — Batch 60-C, Evening Program
                </p>
            </div>

            {/* Team Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 30,
                maxWidth: 1100,
                margin: '0 auto'
            }}>
                {teamMembers.map((m, i) => (
                    <div key={i} style={{
                        position: 'relative',
                        // Glassmorphism effect
                        background: 'rgba(30, 41, 59, 0.4)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        borderRadius: 20,
                        padding: '35px 24px 28px',
                        textAlign: 'center',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                    }}
                        // সিএসএস ফাইলে হোভার হ্যান্ডেল করার জন্য ক্লাস এড করা যেতে পারে, এখানে ইনলাইন ক্লিন রাখা হয়েছে
                        className="team-card-premium"
                    >
                        {/* Top-Right Badge like Apple Dev Card */}
                        <div style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            background: m.tag === 'Supervisor' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: m.tag === 'Supervisor' ? '#f59e0b' : '#38bdf8',
                            padding: '4px 10px',
                            borderRadius: 30,
                            textTransform: 'uppercase'
                        }}>{m.tag}</div>

                        {/* Avatar block */}
                        <div style={{
                            width: 90,
                            height: 90,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            margin: '0 auto 20px',
                            border: '2px solid rgba(255, 255, 255, 0.2)',
                            background: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                            fontSize: 40,
                        }}>
                            {typeof m.avatar === 'string' && !m.avatar.startsWith('/') && !m.avatar.includes('.') ? (
                                m.avatar
                            ) : (
                                <img src={m.avatar} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                        </div>

                        {/* Name & Role */}
                        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, color: '#f8fafc' }}>{m.name}</div>
                        <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 500, marginBottom: 16, letterSpacing: '0.3px' }}>{m.role}</div>

                        {/* Details/Bio */}
                        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20, flexGrow: 1 }}>{m.details}</div>

                        {/* Skills Badges (GitHub Profile style tags) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
                            {m.skills?.map((skill, index) => (
                                <span key={index} style={{
                                    fontSize: 11,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: '#cbd5e1',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    {skill}
                                </span>
                            ))}
                        </div>

                        {/* Social Links (Minimalist Icons instead of raw text) */}
                        <div style={{
                            display: 'flex',
                            gap: 16,
                            justifyContent: 'center',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            paddingTop: 16
                        }}>
                            {m.github && (
                                <a href={m.github} target="_blank" rel="noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>
                                    GitHub
                                </a>
                            )}
                            {m.linkedin && (
                                <a href={m.linkedin} target="_blank" rel="noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z" /></svg>
                                    LinkedIn
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* University Badge - Premium Bottom Sheet Look */}
            <div style={{ marginTop: 60, textAlign: 'center' }}>
                <div className="team-card-premium-uu" style={{
                    background: 'rgba(30, 41, 59, 0.25)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 16,
                    padding: '20px 30px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 16,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                }}>
                    <span style={{ fontSize: 38 }}>🎓</span>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 18, color: '#f8fafc' }}>Uttara University</div>
                        <div style={{ fontSize: 14, color: '#94a3b8' }}>Department of Computer Science & Engineering</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Dhaka, Bangladesh · Final Year Project 2026</div>
                    </div>
                </div>
            </div>

        </section>
    );
}