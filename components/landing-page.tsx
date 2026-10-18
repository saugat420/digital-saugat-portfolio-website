"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const journey = [
  { number: "01", title: "Attract", copy: "Reach people who need what you sell." },
  { number: "02", title: "Nurture", copy: "Stay helpful, answer questions and build trust." },
  { number: "03", title: "Convert", copy: "Make taking action and buying simple." },
];

const services = [
  "Funnel strategy.",
  "Landing pages & copy.",
  "Email nurturing & automation.",
  "Conversion improvements.",
];

const process = [
  { number: "01", title: "Understand", copy: "Your audience, offer and goals." },
  { number: "02", title: "Plan", copy: "Map the path from discovery to purchase." },
  { number: "03", title: "Build", copy: "Create your pages, messaging and follow-up." },
  { number: "04", title: "Improve", copy: "Refine the experience using real data." },
];

type FormState =
  | { kind: "idle"; message: "" }
  | { kind: "submitting"; message: string }
  | { kind: "success"; message: string; retryAvailable?: boolean }
  | { kind: "error"; message: string };

function Arrow() {
  return <span className="button-arrow" aria-hidden="true">↗</span>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      className={compact ? "brand-image brand-image-compact" : "brand-image"}
      src="/digital-saugat-logo.png"
      alt="Digital Saugat"
      width={300}
      height={100}
      priority={!compact}
    />
  );
}

function FunnelVisual() {
  return (
    <div className="funnel-wrap" aria-label="Attract, nurture, convert funnel">
      <div className="funnel-guide funnel-guide-left" aria-hidden="true" />
      <div className="funnel-guide funnel-guide-right" aria-hidden="true" />
      {journey.map((item, index) => (
        <div className={`funnel-stage funnel-stage-${index + 1}`} key={item.title}>
          <span className="funnel-number">{item.number}</span>
          <div>
            <strong>{item.title}</strong>
            <span>{index === 0 ? "Get discovered" : index === 1 ? "Build trust" : "Win customers"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>({ kind: "idle", message: "" });
  const submissionId = useRef("");
  const firstMenuLink = useRef<HTMLAnchorElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("js-ready");
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("js-ready");
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    firstMenuLink.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("menu-is-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("menu-is-open");
    };
  }, [menuOpen]);

  async function sendForm(form: HTMLFormElement) {
    if (!submissionId.current) submissionId.current = crypto.randomUUID();
    setFormState({ kind: "submitting", message: "Sending your enquiry…" });
    const data = new FormData(form);
    const payload = {
      submissionId: submissionId.current,
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      business: String(data.get("business") || ""),
      message: String(data.get("message") || ""),
      company: String(data.get("company") || ""),
      sourcePageUrl: window.location.href,
    };

    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { received?: boolean; notified?: boolean; message?: string };
      if (result.received) {
        setFormState({
          kind: "success",
          message: result.notified
            ? "Thanks! Your enquiry has been received. I’ll get back to you soon."
            : "Thanks! Your enquiry has been received. I’ll get back to you soon. The email alert is delayed, but your details are safely recorded.",
          retryAvailable: !result.notified,
        });
        if (result.notified) {
          form.reset();
          submissionId.current = "";
        }
        return;
      }
      setFormState({ kind: "error", message: result.message || "The enquiry service is temporarily unavailable. Please try again later." });
    } catch {
      setFormState({ kind: "error", message: "The enquiry service is temporarily unavailable. Please try again later." });
    }
  }

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a href="#top" className="logo-link" aria-label="Digital Saugat home"><Brand /></a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#expertise">Expertise</a>
            <a href="#approach">Approach</a>
            <a href="#about">About</a>
            <a className="button button-small" href="#consultation">Let’s talk <Arrow /></a>
          </nav>
          <button ref={menuButton} className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}>
            <span /><span />
          </button>
        </div>
        <nav id="mobile-menu" className={`mobile-menu ${menuOpen ? "is-open" : ""}`} aria-label="Mobile navigation" aria-hidden={!menuOpen}>
          <a ref={firstMenuLink} href="#expertise" onClick={() => setMenuOpen(false)}>Expertise</a>
          <a href="#approach" onClick={() => setMenuOpen(false)}>Approach</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#consultation" onClick={() => setMenuOpen(false)}>Let’s talk <Arrow /></a>
        </nav>
      </header>

      <section className="section dark hero" id="top">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow hero-enter delay-1">Conversion-focused funnel expert</p>
            <h1 className="hero-enter delay-2">Attract new people.<br />Build their trust.<br /><span>Turn them into customers.</span></h1>
            <p className="hero-intro hero-enter delay-3">I help businesses attract new people, nurture them with the right message, and convert them into paying customers.</p>
            <div className="hero-actions hero-enter delay-4">
              <a className="button" href="#consultation">Book a Free Consultation <Arrow /></a>
              <a className="text-link" href="#approach">How I work <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-visual hero-enter delay-3"><FunnelVisual /></div>
        </div>
      </section>

      <section className="section light" id="approach">
        <div className="container" data-reveal>
          <p className="eyebrow">A connected customer journey</p>
          <div className="section-heading split-heading">
            <h2>Make every step<br />lead somewhere.</h2>
            <p>The right people. The right message. A clear next step.</p>
          </div>
          <div className="journey-grid">
            {journey.map((item) => (
              <article className="journey-item" key={item.title}>
                <span className="step-number">{item.number}</span><h3>{item.title}</h3><p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark" id="expertise">
        <div className="container expertise-grid" data-reveal>
          <div>
            <h2>Strategy and execution.<br /><span>Working together.</span></h2>
            <p className="section-copy">From the first ad to the follow-up email, I connect the pieces of your funnel.</p>
          </div>
          <div className="service-list">
            {services.map((service, index) => (
              <div className="service-row" key={service}><span>{String(index + 1).padStart(2, "0")}</span><h3>{service}</h3></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section light process-section">
        <div className="container" data-reveal>
          <div className="process-heading">
            <p className="eyebrow">A simple process</p>
            <h2>A simple process.<br />A clear way forward.</h2>
          </div>
          <div className="process-grid">
            {process.map((item) => (
              <article className="process-item" key={item.title}><span className="step-number">{item.number}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div></article>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark about-section" id="about">
        <div className="container about-grid" data-reveal>
          <div className="about-heading"><p className="eyebrow">About Digital Saugat</p><h2>Hi, I’m Saugat Basnet.</h2></div>
          <div className="about-copy"><p>I combine marketing strategy, clear messaging and conversion-focused design to help businesses attract, nurture and convert.</p></div>
        </div>
      </section>

      <section className="section light consultation-section" id="consultation">
        <div className="container consultation-grid" data-reveal>
          <div className="consultation-copy">
            <h2>Let’s turn more interest into customers.</h2>
            <p>Book a free consultation to discuss your business, your funnel and your next steps.</p>
          </div>
          <form ref={formRef} className="consultation-form" onSubmit={(event) => { event.preventDefault(); void sendForm(event.currentTarget); }}>
            <div className="honeypot" aria-hidden="true"><label htmlFor="company">Company</label><input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" /></div>
            <div className="field"><label htmlFor="name">Your name <span aria-hidden="true">*</span></label><input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" required minLength={2} maxLength={80} /></div>
            <div className="field"><label htmlFor="email">Email address <span aria-hidden="true">*</span></label><input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} /></div>
            <div className="field"><label htmlFor="business">Website or business <span aria-hidden="true">*</span></label><input id="business" name="business" type="text" placeholder="https:// or your business name" autoComplete="organization" required maxLength={160} /></div>
            <div className="field"><label htmlFor="message">What would you like help with? <span>(optional)</span></label><textarea id="message" name="message" rows={3} placeholder="A short note about your funnel" maxLength={1500} /></div>
            <button className="button form-button" type="submit" disabled={formState.kind === "submitting"}>{formState.kind === "submitting" ? "Sending…" : "Request a Free Consultation"} <Arrow /></button>
            <p className="privacy-note">I’ll use these details to respond to your enquiry.</p>
            <div className={`form-status ${formState.kind}`} role="status" aria-live="polite" aria-atomic="true">
              {formState.message}
              {formState.kind === "success" && formState.retryAvailable ? <button className="retry-button" type="button" onClick={() => formRef.current && void sendForm(formRef.current)}>Retry the email alert</button> : null}
            </div>
          </form>
        </div>
      </section>

      <footer className="site-footer dark"><div className="container footer-inner"><div><Brand compact /><p>© {new Date().getFullYear()} Digital Saugat. All rights reserved.</p></div><p>Attract. Nurture. Convert.</p></div></footer>
    </main>
  );
}
