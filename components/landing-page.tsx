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
  | { kind: "success"; message: string }
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
  const firstMenuLink = useRef<HTMLAnchorElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

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
    const params = new URLSearchParams(window.location.search);
    const enquiry = params.get("enquiry");
    let nextState: FormState | null = null;

    if (enquiry === "received") {
      nextState = { kind: "success", message: "Thanks! Your enquiry has been received. I’ll get back to you soon." };
    } else if (enquiry === "delayed") {
      nextState = {
        kind: "success",
        message: "Thanks! Your enquiry has been received. Your details are safely recorded and I’ll get back to you soon.",
      };
    } else if (enquiry === "check") {
      nextState = { kind: "error", message: "Please check the form and try again." };
    } else if (enquiry === "retry") {
      nextState = {
        kind: "error",
        message: "Your enquiry could not be delivered just now. Please try again or email digitalsaugatb@gmail.com.",
      };
    }

    if (enquiry) {
      window.history.replaceState({}, "", `${window.location.pathname}#consultation`);
    }

    if (!nextState) return;
    const status = nextState;
    const timer = window.setTimeout(() => setFormState(status), 0);
    return () => window.clearTimeout(timer);
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
          <figure className="about-portrait">
            <Image
              src="/saugat-basnet.jpg"
              alt="Portrait of Saugat Basnet"
              width={1200}
              height={1600}
              sizes="(max-width: 760px) 320px, (max-width: 1200px) 30vw, 360px"
            />
          </figure>
          <div className="about-content">
            <div className="about-heading">
              <p className="eyebrow">About Digital Saugat</p>
              <h2>Hi, I’m Saugat Basnet.</h2>
            </div>
            <div className="about-copy">
              <p>Since 2017, I’ve helped more than 100 businesses across a wide range of industries turn digital marketing into measurable growth.</p>
              <p>I bring strategy, clear messaging and conversion-focused execution together to generate demand, increase sales and revenue, and ultimately improve profitability.</p>
            </div>
            <div className="about-stats" aria-label="Experience highlights">
              <div><strong>9+</strong><span>years in digital marketing</span></div>
              <div><strong>100+</strong><span>businesses supported</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section light consultation-section" id="consultation">
        <div className="container consultation-grid" data-reveal>
          <div className="consultation-copy">
            <h2>Let’s turn more interest into customers.</h2>
            <p>Answer a few quick questions so I can understand your goals, recommend the right next step and make our consultation useful from the start.</p>
          </div>
          <form className="consultation-form" method="post" action="/api/consultation">
            <div className="honeypot" aria-hidden="true">
              <input name="contact_preference_confirm" type="text" tabIndex={-1} autoComplete="new-password" />
            </div>
            <div className="field"><label htmlFor="name">Your name <span aria-hidden="true">*</span></label><input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" required minLength={2} maxLength={80} /></div>
            <div className="field"><label htmlFor="email">Email address <span aria-hidden="true">*</span></label><input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} /></div>
            <div className="field"><label htmlFor="business">Website or business <span aria-hidden="true">*</span></label><input id="business" name="business" type="text" placeholder="https:// or your business name" autoComplete="organization" required maxLength={160} /></div>
            <div className="field">
              <label htmlFor="goal">What would you most like to improve? <span aria-hidden="true">*</span></label>
              <select id="goal" name="goal" defaultValue="" required>
                <option value="" disabled>Select your main goal</option>
                <option>More qualified leads</option>
                <option>Better website or landing page conversions</option>
                <option>Email nurturing and automation</option>
                <option>A complete funnel strategy</option>
                <option>Not sure yet</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="budget">What monthly budget are you prepared to invest? <span aria-hidden="true">*</span></label>
              <select id="budget" name="budget" defaultValue="" required>
                <option value="" disabled>Select an approximate budget</option>
                <option>Under USD 1,000/month</option>
                <option>USD 1,000–3,000/month</option>
                <option>USD 3,000–5,000/month</option>
                <option>USD 5,000–10,000/month</option>
                <option>USD 10,000+/month</option>
                <option>Not decided yet</option>
              </select>
              <p className="field-help">This helps me suggest a realistic scope—not pressure you into a package.</p>
            </div>
            <div className="field">
              <label htmlFor="readiness">How ready are you to move forward? <span aria-hidden="true">*</span></label>
              <select id="readiness" name="readiness" defaultValue="" required>
                <option value="" disabled>Select your timeline</option>
                <option>Ready to start now</option>
                <option>Ready within the next 30 days</option>
                <option>Planning for the next 1–3 months</option>
                <option>Exploring options for later</option>
              </select>
            </div>
            <div className="field"><label htmlFor="challenge">What is the biggest challenge holding your growth back? <span aria-hidden="true">*</span></label><textarea id="challenge" name="challenge" rows={4} placeholder="Tell me what is happening now and what you want to change" required minLength={15} maxLength={1500} /></div>
            <button className="button form-button" type="submit">Request a Free Consultation <Arrow /></button>
            <p className="privacy-note">I’ll review your answers before the call and only use them to respond to your enquiry.</p>
            <div className={`form-status ${formState.kind}`} role="status" aria-live="polite" aria-atomic="true">
              {formState.message}
            </div>
          </form>
        </div>
      </section>

      <footer className="site-footer dark"><div className="container footer-inner"><div><Brand compact /><p>© {new Date().getFullYear()} Digital Saugat. All rights reserved.</p></div></div></footer>
    </main>
  );
}
